# api/views/annual_closing_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP

from ..models import (
    AnnualClosing,
    MemberAnnualProfit,
    MemberProfitPayout,
    MemberProfitRequest,
    MemberWithdrawal,
    MemberCertificateApproval,
    Notification,
    MonthlySaving,
    LoanRepayment,
    Fine,
    Expense,
    Income,
    Member,
    MemberSavingChoice,
    FineRule,
    User,
)
from ..serializers.annual_serializers import (
    AnnualClosingSerializer,
    MemberAnnualProfitSerializer,
    MemberProfitPayoutSerializer,
    MemberProfitRequestSerializer,
    MemberProfitRequestReviewSerializer,
)
from ..permissions.role_permissions import (
    IsAdminFinanceOrAuditor,
    IsAdminFinanceOrManager,
    IsAdminOrFinance,
    IsMember,
)
from ..services.annual_closing_metrics import (
    get_closing_profit_rate_percent,
    get_closing_total_adjusted_capital,
    get_member_profit_rate_percent,
)
from ..services.member_profit_service import allocate_member_profit_payout
from ..services.transaction_logger import log_transaction
from ..utils.pdf_reports import build_pdf_report_response
from ..utils.report_language import get_report_lang, report_choice, report_text

SHARE_PRICE = 2000
DECEMBER_MONTH = 12
DECEMBER_UNPAID_DEDUCTION_PERCENT = Decimal("10.00")
ANNUAL_CLOSING_POLICY_VERSION = "annual_closing_v2_snapshot"


def notify_profit_request_staff(member, requested_by, amount):
    recipients = User.objects.filter(
        role__in={"ADMIN", "FINANCE", "MANAGER"},
        is_active=True,
    ).exclude(pk=getattr(requested_by, "pk", None))
    requester_name = (
        requested_by.get_full_name() or requested_by.username
        if requested_by
        else (member.user.get_full_name() or member.user.username)
    )
    member_name = member.user.get_full_name() or member.user.username or member.national_id
    for staff_user in recipients:
        Notification.objects.create(
            user=staff_user,
            notification_type=Notification.NotificationType.SYSTEM,
            title="profit_request_created_title",
            message=(
                f"profit_request_created_message|{requester_name}|{member_name}|{int(amount)}"
            ),
        )


def _get_member_profits_queryset(request):
    queryset = MemberAnnualProfit.objects.select_related(
        "member",
        "member__user",
        "closing",
    )
    year = request.query_params.get("year")
    if year:
        closing = get_object_or_404(AnnualClosing, year=year)
        queryset = queryset.filter(closing=closing)
    return queryset.order_by("-closing__year", "member__user__first_name", "member__user__last_name")


def _get_annual_closings_queryset(request):
    queryset = AnnualClosing.objects.select_related("closed_by").all().order_by("-year")
    params = request.query_params
    year = params.get("year")
    year_from = params.get("year_from")
    year_to = params.get("year_to")
    date_from = params.get("date_from")
    date_to = params.get("date_to")

    if year:
        queryset = queryset.filter(year=year)
    if year_from:
        queryset = queryset.filter(year__gte=year_from)
    if year_to:
        queryset = queryset.filter(year__lte=year_to)
    if date_from:
        queryset = queryset.filter(closed_on__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(closed_on__date__lte=date_to)
    return queryset


def _get_member_profit_payouts_queryset(request, member_user_only=False):
    queryset = MemberProfitPayout.objects.select_related(
        "member",
        "member__user",
        "annual_profit",
        "annual_profit__closing",
        "approved_by",
    )
    if member_user_only:
        queryset = queryset.filter(member__user=request.user)

    member_id = request.query_params.get("member")
    year = request.query_params.get("year")
    search = (request.query_params.get("search") or "").strip()
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")

    if search:
        search_query = (
            Q(member__national_id__icontains=search)
            | Q(member__user__username__icontains=search)
            | Q(member__user__first_name__icontains=search)
            | Q(member__user__last_name__icontains=search)
            | Q(approved_by__username__icontains=search)
            | Q(approved_by__first_name__icontains=search)
            | Q(approved_by__last_name__icontains=search)
            | Q(notes__icontains=search)
        )
        if search.isdigit():
            search_query |= Q(amount=int(search)) | Q(annual_profit__closing__year=int(search))
        queryset = queryset.filter(search_query)
    if member_id:
        queryset = queryset.filter(member_id=member_id)
    if year:
        queryset = queryset.filter(
            Q(annual_profit__closing__year=year) | Q(paid_on__year=year)
        )
    if date_from:
        queryset = queryset.filter(paid_on__gte=date_from)
    if date_to:
        queryset = queryset.filter(paid_on__lte=date_to)
    return queryset.order_by("-paid_on", "-id")


def _get_member_profit_requests_queryset(request):
    params = request.query_params
    role = getattr(request.user, "role", "")
    search = (params.get("search") or "").strip()
    if role == "MEMBER":
        queryset = (
            MemberProfitRequest.objects.select_related(
                "member",
                "member__user",
                "requested_by",
                "reviewed_by",
            )
            .filter(member__user=request.user)
        )
    else:
        if role not in {"ADMIN", "FINANCE", "MANAGER", "AUDITOR"}:
            raise ValidationError("You do not have permission to perform this action.")

        queryset = MemberProfitRequest.objects.select_related(
            "member",
            "member__user",
            "requested_by",
            "reviewed_by",
        )

        member_id = params.get("member")
        if member_id:
            queryset = queryset.filter(member_id=member_id)

    if search:
        search_query = (
            Q(member__national_id__icontains=search)
            | Q(member__user__username__icontains=search)
            | Q(member__user__first_name__icontains=search)
            | Q(member__user__last_name__icontains=search)
            | Q(requested_by__username__icontains=search)
            | Q(requested_by__first_name__icontains=search)
            | Q(requested_by__last_name__icontains=search)
            | Q(reviewed_by__username__icontains=search)
            | Q(reviewed_by__first_name__icontains=search)
            | Q(reviewed_by__last_name__icontains=search)
            | Q(request_notes__icontains=search)
            | Q(review_notes__icontains=search)
            | Q(status__icontains=search)
            | Q(request_mode__icontains=search)
        )
        if search.isdigit():
            search_query |= (
                Q(requested_amount=int(search))
                | Q(approved_amount=int(search))
                | Q(requested_balance=int(search))
            )
        queryset = queryset.filter(search_query)

    status_filter = params.get("status")
    request_mode = params.get("request_mode")
    date_from = params.get("date_from")
    date_to = params.get("date_to")

    if status_filter:
        queryset = queryset.filter(status=status_filter)
    if request_mode:
        queryset = queryset.filter(request_mode=request_mode)
    if date_from:
        queryset = queryset.filter(requested_on__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(requested_on__date__lte=date_to)
    return queryset.order_by("-requested_on", "-id")

# =============================
# CREATE ANNUAL CLOSING
# =============================
class AnnualClosingView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFinance]

    def post(self, request):
        year = request.data.get("year")
        try:
            year = int(year)
        except (TypeError, ValueError):
            return Response(
                {"error": "Year must be a valid number"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if AnnualClosing.objects.filter(year=year).exists():
            return Response(
                {"error": "Annual closing already done for this year"},
                status=status.HTTP_400_BAD_REQUEST
            )

        closing_date = timezone.localdate()
        member_unpaid_fines_totals = {}

        with transaction.atomic():
            # Auto-collect all unpaid (and not waived) fines up to this closing year.
            pending_fines = Fine.objects.select_related("member").filter(
                is_paid=False,
                is_waived=False,
                calculated_on__year__lte=year,
            )
            for fine in pending_fines:
                member_unpaid_fines_totals[fine.member_id] = (
                    member_unpaid_fines_totals.get(fine.member_id, 0) + int(fine.amount)
                )
                fine.is_paid = True
                fine.paid_on = closing_date
                fine.save(update_fields=["is_paid", "paid_on"])

            total_savings = MonthlySaving.objects.filter(year=year).aggregate(
                total=Sum("amount_paid")
            )["total"] or 0

            loan_interest = Income.objects.filter(
                related_model="LoanRepayment",
                income_date__year=year,
            ).aggregate(total=Sum("amount"))["total"] or 0

            fines = Income.objects.filter(
                related_model="Fine",
                income_date__year=year,
            ).aggregate(total=Sum("amount"))["total"] or 0

            total_income = Income.objects.filter(
                income_date__year=year
            ).aggregate(total=Sum("amount"))["total"] or 0

            expenses = Expense.objects.filter(
                expense_date__year=year
            ).aggregate(total=Sum("amount"))["total"] or 0

            net_profit = total_income - expenses

            # DISTRIBUTION TO MEMBERS
            # Formula:
            # 1) Member capital base = lifetime savings up to closing year + previous years profit.
            # 2) Adjust base by deductions (December unpaid rule + unpaid fine auto-collection).
            # 3) Cooperative profit rate = net_profit / total_adjusted_capital.
            # 4) Member profit = adjusted_member_capital * profit_rate.
            members = Member.objects.filter(is_active=True)
            member_temp = []
            deducted_members = 0
            total_adjusted_capital = 0

            for member in members:
                lifetime_savings = (
                    MonthlySaving.objects.filter(
                        saving_choice__member=member,
                        year__lte=year,
                    ).aggregate(total=Sum("amount_paid"))["total"]
                    or 0
                )
                previous_profit = member.total_unpaid_profit(up_to_year=year - 1)
                member_capital_base = int(lifetime_savings) + int(previous_profit)

                december_deduction = 0
                december_choice = (
                    MemberSavingChoice.objects.select_related("category")
                    .filter(member=member, category__year=year, is_active=True)
                    .first()
                )
                if december_choice:
                    december_paid = MonthlySaving.objects.filter(
                        saving_choice=december_choice,
                        year=year,
                        month=DECEMBER_MONTH,
                    ).exists()
                    if not december_paid:
                        december_deduction = int(
                            (
                                Decimal(december_choice.category.monthly_amount)
                                * DECEMBER_UNPAID_DEDUCTION_PERCENT
                                / Decimal("100")
                            ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                        )
                        if december_deduction > 0:
                            deducted_members += 1

                unpaid_fines_total = int(member_unpaid_fines_totals.get(member.id, 0))
                adjusted_amount = max(
                    int(member_capital_base) - december_deduction - unpaid_fines_total,
                    0,
                )
                shares = adjusted_amount // SHARE_PRICE
                total_adjusted_capital += adjusted_amount
                member_temp.append((member, adjusted_amount, shares))

            total_shares = total_adjusted_capital // SHARE_PRICE
            profit_rate = (
                (Decimal(str(net_profit)) / Decimal(str(total_adjusted_capital)))
                if total_adjusted_capital
                else Decimal("0")
            )
            profit_rate_percent = (profit_rate * Decimal("100")).quantize(
                Decimal("0.0001"),
                rounding=ROUND_HALF_UP,
            )

            closing = AnnualClosing.objects.create(
                year=year,
                total_savings=total_savings,
                total_income=total_income,
                loan_interest=loan_interest,
                fines=fines,
                expenses=expenses,
                total_adjusted_capital=total_adjusted_capital,
                net_profit=net_profit,
                profit_rate_percent=profit_rate_percent,
                total_shares=total_shares,
                december_unpaid_deducted_members=deducted_members,
                policy_version=ANNUAL_CLOSING_POLICY_VERSION,
                closed_by=request.user,
            )

            created_rows = []
            distributed_profit = 0
            for member, amount, shares in member_temp:
                profit = int(
                    (Decimal(str(amount)) * profit_rate).quantize(
                        Decimal("1"), rounding=ROUND_HALF_UP
                    )
                )
                distributed_profit += profit
                created_rows.append((member, amount, shares, profit))

            # Keep accounting exact: adjust last row with rounding difference.
            rounding_diff = int(net_profit) - distributed_profit
            if created_rows and rounding_diff != 0:
                last_member, last_amount, last_shares, last_profit = created_rows[-1]
                created_rows[-1] = (
                    last_member,
                    last_amount,
                    last_shares,
                    last_profit + rounding_diff,
                )

            for member, amount, shares, profit in created_rows:
                MemberAnnualProfit.objects.create(
                    member=member,
                    closing=closing,
                    total_amount=amount,
                    shares=shares,
                    profit=profit,
                )

            log_transaction(
                user=request.user,
                transaction_type="SYSTEM",
                action="CREATE",
                related_model="AnnualClosing",
                related_object_id=closing.id,
                amount=net_profit,
                description=f"Annual closing completed for year {year}",
                request=request,
            )

        return Response({
            "message": "Annual closing completed successfully",
            "year": year,
            "total_income": total_income,
            "net_profit": net_profit,
            "profit_rate_percent": float(profit_rate_percent),
            "total_adjusted_capital": total_adjusted_capital,
            "total_shares": total_shares,
            "december_unpaid_deducted_members": deducted_members,
            "policy_version": ANNUAL_CLOSING_POLICY_VERSION,
        })


# =============================
# LIST ANNUAL CLOSINGS
# =============================
class AnnualClosingListView(generics.ListAPIView):
    serializer_class = AnnualClosingSerializer
    permission_classes = [IsAdminFinanceOrAuditor]

    def get_queryset(self):
        return _get_annual_closings_queryset(self.request)


# =============================
# LIST MEMBER PROFITS
# =============================
class MemberAnnualProfitListView(generics.ListAPIView):
    serializer_class = MemberAnnualProfitSerializer
    permission_classes = [IsAdminFinanceOrAuditor]

    def get_queryset(self):
        return _get_member_profits_queryset(self.request)


class MyMemberAnnualProfitListView(generics.ListAPIView):
    serializer_class = MemberAnnualProfitSerializer
    permission_classes = [IsMember]

    def get_queryset(self):
        year = self.request.query_params.get("year")
        queryset = MemberAnnualProfit.objects.select_related("closing", "member").filter(
            member__user=self.request.user
        )
        if year:
            queryset = queryset.filter(closing__year=year)
        return queryset.order_by("-closing__year")


def _get_member_certificate_payload(request):
    member = get_object_or_404(Member, user=request.user)
    year_param = request.query_params.get("year")
    active_year = timezone.now().year
    available_years = list(
        AnnualClosing.objects.filter(year__lt=active_year)
        .order_by("-year")
        .values_list("year", flat=True)
    )

    if not available_years:
        return None, Response(
            {
                "error": "No eligible certificate year yet. Certificates are available only for closed past years.",
                "available_years": [],
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    if year_param:
        try:
            year = int(year_param)
        except (TypeError, ValueError):
            return None, Response(
                {"error": "Year must be a valid number"},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        year = available_years[0]

    if year not in available_years:
        return None, Response(
            {
                "error": "Certificate is available only for closed past years.",
                "available_years": available_years,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    lifetime_savings = (
        MonthlySaving.objects.filter(
            saving_choice__member=member,
            year__lte=year,
        ).aggregate(total=Sum("amount_paid"))["total"]
        or 0
    )
    lifetime_profit = member.total_unpaid_profit(up_to_year=year)

    year_savings = (
        MonthlySaving.objects.filter(
            saving_choice__member=member,
            year=year,
        ).aggregate(total=Sum("amount_paid"))["total"]
        or 0
    )
    year_profit = (
        MemberAnnualProfit.objects.filter(
            member=member,
            closing__year=year,
        ).aggregate(total=Sum("profit"))["total"]
        or 0
    )

    issued_date = timezone.localdate()
    full_name = member.user.get_full_name() or member.user.username
    approval = MemberCertificateApproval.objects.select_related("approved_by").filter(
        member=member,
        year=year,
    ).first()
    if not approval:
        return None, Response(
            {
                "error": "Certificate is not approved yet for this year.",
                "available_years": available_years,
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    manager_name = None
    if approval.approved_by:
        manager_name = approval.approved_by.get_full_name() or approval.approved_by.username

    return (
        {
            "member_id": member.id,
            "member_name": full_name,
            "national_id": member.national_id,
            "account_number": member.account_number,
            "joined_date": member.joined_date,
            "certificate_year": year,
            "issued_date": issued_date,
            "available_years": available_years,
            "year_savings": year_savings,
            "year_profit": year_profit,
            "lifetime_savings": lifetime_savings,
            "lifetime_profit": lifetime_profit,
            "lifetime_total": lifetime_savings + lifetime_profit,
            "authorized_by": manager_name or "N/A",
            "approved_on": approval.approved_on,
        },
        None,
    )


class MyMemberCertificateAPIView(APIView):
    permission_classes = [IsMember]

    def get(self, request):
        payload, error_response = _get_member_certificate_payload(request)
        if error_response:
            return error_response
        return Response(payload)


class MyMemberCertificatePDFAPIView(APIView):
    permission_classes = [IsMember]

    def get(self, request):
        lang = get_report_lang(request)
        payload, error_response = _get_member_certificate_payload(request)
        if error_response:
            return error_response

        certificate_year = payload.get("certificate_year") or ""
        authorized_by = payload.get("authorized_by") or "-"
        approved_on = payload.get("approved_on") or "-"

        rows = [
            [report_text(lang, "label.member"), payload.get("member_name") or "-"],
            [report_text(lang, "label.national_id"), payload.get("national_id") or "-"],
            [report_text(lang, "label.account_number"), payload.get("account_number") or "-"],
            [report_text(lang, "label.joined_date"), payload.get("joined_date") or "-"],
            [report_text(lang, "label.year"), certificate_year or "-"],
            [report_text(lang, "label.authorized_by"), authorized_by],
            [report_text(lang, "label.approved_on"), approved_on],
            [report_text(lang, "label.issued_date"), payload.get("issued_date") or "-"],
        ]

        return build_pdf_report_response(
            filename=f"member_certificate_{certificate_year or 'report'}.pdf",
            title=report_text(lang, "report.member_certificate.title"),
            subtitle=report_text(lang, "report.member_certificate.subtitle"),
            headers=[
                report_text(lang, "label.details"),
                report_text(lang, "label.value"),
            ],
            rows=rows,
            generated_by=request.user.get_full_name().strip() or request.user.username,
            summary={
                report_text(lang, "label.year_savings"): f"{int(payload.get('year_savings') or 0):,} RWF",
                report_text(lang, "label.year_profit"): f"{int(payload.get('year_profit') or 0):,} RWF",
                report_text(lang, "label.lifetime_savings"): f"{int(payload.get('lifetime_savings') or 0):,} RWF",
                report_text(lang, "label.lifetime_profit"): f"{int(payload.get('lifetime_profit') or 0):,} RWF",
                report_text(lang, "label.lifetime_total"): f"{int(payload.get('lifetime_total') or 0):,} RWF",
            },
            lang=lang,
            landscape_mode=False,
            signatures=[
                {
                    "name": authorized_by,
                    "title": report_text(lang, "label.authorized_by"),
                    "date": approved_on,
                }
            ],
            acting_user=request.user,
        )


class MemberProfitPayoutListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = MemberProfitPayoutSerializer
    permission_classes = [IsAdminFinanceOrAuditor]

    def get_queryset(self):
        return _get_member_profit_payouts_queryset(self.request)

    def perform_create(self, serializer):
        payout = serializer.save()
        MemberWithdrawal.objects.create(
            member=payout.member,
            withdrawal_type=MemberWithdrawal.WithdrawalType.PROFIT,
            amount=payout.amount,
            withdrawn_on=payout.paid_on,
            approved_by=self.request.user,
            notes=payout.notes or "Direct member profit payout",
        )
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="PAY",
            related_model="MemberProfitPayout",
            related_object_id=payout.id,
            amount=payout.amount,
            description=f"Profit payout recorded for {payout.member.national_id}",
            request=self.request,
        )


class MemberProfitBulkPayoutAPIView(APIView):
    permission_classes = [IsAdminFinanceOrAuditor]

    def post(self, request):
        member_id = request.data.get("member")
        amount = request.data.get("amount")
        pay_all = str(request.data.get("pay_all", "")).lower() in {"1", "true", "yes", "on"}
        notes = request.data.get("notes", "")

        if not member_id:
            return Response({"error": "Member is required."}, status=status.HTTP_400_BAD_REQUEST)

        member = get_object_or_404(Member, pk=member_id)
        unpaid_total = member.total_unpaid_profit()
        if unpaid_total <= 0:
            return Response(
                {"error": "This member has no unpaid profit balance."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if pay_all:
            payout_amount = unpaid_total
        else:
            try:
                payout_amount = int(amount)
            except (TypeError, ValueError):
                return Response(
                    {"error": "Amount must be a valid number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if payout_amount <= 0:
            return Response(
                {"error": "Amount must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if payout_amount > unpaid_total:
            return Response(
                {"error": f"Amount exceeds unpaid profit balance of {unpaid_total} RWF."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            payout_rows, _withdrawal = allocate_member_profit_payout(
                member=member,
                amount=payout_amount,
                approved_by=request.user,
                notes=notes
                or (
                    "Bulk profit payout"
                    if pay_all
                    else f"Partial bulk profit payout ({payout_amount} RWF requested)"
                ),
            )
        created = [
            {
                "id": payout.id,
                "year": payout.annual_profit.closing.year if payout.annual_profit_id else None,
                "amount": int(payout.amount),
            }
            for payout in payout_rows
        ]

        log_transaction(
            user=request.user,
            transaction_type="SYSTEM",
            action="PAY",
            related_model="MemberProfitPayout",
            related_object_id=created[0]["id"] if created else None,
            amount=payout_amount,
            description=(
                f"Bulk profit payout recorded for {member.national_id} "
                f"across {len(created)} annual profit records"
            ),
            request=request,
        )

        return Response(
            {
                "message": "Profit payout recorded successfully.",
                "member_id": member.id,
                "member_name": member.user.get_full_name() or member.user.username or member.national_id,
                "requested_amount": payout_amount,
                "remaining_unpaid_profit": member.total_unpaid_profit(),
                "rows_created": created,
            },
            status=status.HTTP_201_CREATED,
        )


class MyMemberProfitSummaryAPIView(APIView):
    permission_classes = [IsMember]

    def get(self, request):
        member = get_object_or_404(Member, user=request.user)
        year_param = request.query_params.get("year")
        up_to_year = None
        if year_param:
            try:
                up_to_year = int(year_param)
            except (TypeError, ValueError):
                return Response(
                    {"error": "Year must be a valid number"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        latest_profit_row = MemberAnnualProfit.objects.select_related("closing").filter(member=member)
        if up_to_year is not None:
            latest_profit_row = latest_profit_row.filter(closing__year__lte=up_to_year)
        latest_profit_row = latest_profit_row.order_by("-closing__year", "-id").first()

        return Response(
            {
                "member_id": member.id,
                "member_name": member.user.get_full_name() or member.user.username,
                "national_id": member.national_id,
                "savings_total": member.total_savings_amount(up_to_year),
                "allocated_profit_total": member.total_allocated_profit(up_to_year),
                "paid_profit_total": member.total_paid_profit(up_to_year),
                "unpaid_profit_total": member.total_unpaid_profit(up_to_year),
                "total_amount_in_system": member.total_amount_in_system(up_to_year),
                "shares": member.current_shares(up_to_year),
                "member_asset_base": int(latest_profit_row.total_amount or 0) if latest_profit_row else 0,
                "member_profit_rate_percent": float(get_member_profit_rate_percent(latest_profit_row)),
                "cooperative_profit_rate_percent": (
                    float(get_closing_profit_rate_percent(latest_profit_row.closing))
                    if latest_profit_row
                    else 0.0
                ),
                "profit_rate_year": latest_profit_row.closing.year if latest_profit_row else None,
                "year": up_to_year,
            }
        )


class MyMemberProfitPayoutListAPIView(generics.ListAPIView):
    serializer_class = MemberProfitPayoutSerializer
    permission_classes = [IsMember]

    def get_queryset(self):
        return _get_member_profit_payouts_queryset(self.request, member_user_only=True)


class MyMemberProfitRequestListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = MemberProfitRequestSerializer
    permission_classes = [IsMember]

    def get_queryset(self):
        queryset = MemberProfitRequest.objects.select_related(
            "member",
            "member__user",
            "reviewed_by",
        ).filter(member__user=self.request.user)
        status_filter = self.request.query_params.get("status")
        request_mode = self.request.query_params.get("request_mode")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if request_mode:
            queryset = queryset.filter(request_mode=request_mode)
        if date_from:
            queryset = queryset.filter(requested_on__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(requested_on__date__lte=date_to)
        return queryset

    def perform_create(self, serializer):
        member = get_object_or_404(Member, user=self.request.user, is_active=True)
        if member.total_unpaid_profit() <= 0:
            raise ValidationError("This member has no unpaid profit balance.")
        if MemberProfitRequest.objects.filter(
            member=member,
            status=MemberProfitRequest.StatusChoices.PENDING,
        ).exists():
            raise ValidationError("You already have a pending profit request.")

        request_obj = serializer.save(member=member, requested_by=self.request.user)
        notify_profit_request_staff(
            member=member,
            requested_by=self.request.user,
            amount=request_obj.effective_requested_amount,
        )
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="MemberProfitRequest",
            related_object_id=request_obj.id,
            amount=request_obj.effective_requested_amount,
            description=f"Member {member.national_id} requested profit withdrawal",
            request=self.request,
        )


class MemberProfitRequestListAPIView(generics.ListCreateAPIView):
    serializer_class = MemberProfitRequestSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdminFinanceOrManager()]
        return [IsAdminFinanceOrAuditor()]

    def get_queryset(self):
        return _get_member_profit_requests_queryset(self.request)

    def perform_create(self, serializer):
        member = serializer.validated_data.get("member")
        if not member:
            raise ValidationError({"member": "Member is required."})
        if not member.is_active:
            raise ValidationError({"member": "Only active members can request profit withdrawal."})
        if member.total_unpaid_profit() <= 0:
            raise ValidationError({"member": "This member has no unpaid profit balance."})
        if MemberProfitRequest.objects.filter(
            member=member,
            status=MemberProfitRequest.StatusChoices.PENDING,
        ).exists():
            raise ValidationError({"member": "This member already has a pending profit request."})

        request_obj = serializer.save(requested_by=self.request.user)
        notify_profit_request_staff(
            member=member,
            requested_by=self.request.user,
            amount=request_obj.effective_requested_amount,
        )
        requester_name = self.request.user.get_full_name() or self.request.user.username
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="MemberProfitRequest",
            related_object_id=request_obj.id,
            amount=request_obj.effective_requested_amount,
            description=(
                f"{requester_name} created a profit request for member {member.national_id}"
            ),
            request=self.request,
        )


class MemberProfitRequestReviewAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrFinance]

    def post(self, request, pk):
        profit_request = MemberProfitRequest.objects.select_related(
            "member",
            "member__user",
            "requested_by",
            "reviewed_by",
        ).filter(pk=pk).first()
        if not profit_request:
            raise ValidationError("Profit request not found.")
        if profit_request.status != MemberProfitRequest.StatusChoices.PENDING:
            raise ValidationError("Only pending profit requests can be reviewed.")

        serializer = MemberProfitRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        member = profit_request.member
        current_unpaid = member.total_unpaid_profit()
        requested_cap = min(profit_request.effective_requested_amount, current_unpaid)
        approved_amount = payload.get("approved_amount")
        if payload["status"] == MemberProfitRequest.StatusChoices.APPROVED:
            approved_amount = int(approved_amount or requested_cap)
            if approved_amount <= 0:
                raise ValidationError({"approved_amount": "Approved amount must be greater than zero."})
            if approved_amount > requested_cap:
                raise ValidationError(
                    {
                        "approved_amount": (
                            f"Approved amount cannot exceed available requested balance of {requested_cap} RWF."
                        )
                    }
                )

        with transaction.atomic():
            if payload["status"] == MemberProfitRequest.StatusChoices.APPROVED:
                allocate_member_profit_payout(
                    member=member,
                    amount=approved_amount,
                    approved_by=request.user,
                    notes=payload.get("review_notes", "") or f"Approved from profit request #{profit_request.id}",
                )

            profit_request.status = payload["status"]
            profit_request.review_notes = payload.get("review_notes", "")
            profit_request.reviewed_by = request.user
            profit_request.reviewed_on = timezone.now()
            profit_request.approved_amount = approved_amount if payload["status"] == MemberProfitRequest.StatusChoices.APPROVED else None
            profit_request.save(
                update_fields=[
                    "status",
                    "review_notes",
                    "reviewed_by",
                    "reviewed_on",
                    "approved_amount",
                ]
            )

            Notification.objects.create(
                user=member.user,
                notification_type=Notification.NotificationType.SYSTEM,
                title=(
                    "profit_request_approved_title"
                    if profit_request.status == MemberProfitRequest.StatusChoices.APPROVED
                    else "profit_request_rejected_title"
                ),
                message=(
                    f"profit_request_approved_message|{approved_amount}"
                    if profit_request.status == MemberProfitRequest.StatusChoices.APPROVED
                    else "profit_request_rejected_message"
                ),
            )

        log_transaction(
            user=request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="MemberProfitRequest",
            related_object_id=profit_request.id,
            amount=profit_request.approved_amount or profit_request.effective_requested_amount,
            description=f"Profit request #{profit_request.id} {profit_request.status.lower()}",
            request=request,
        )

        return Response(
            {
                "detail": f"Profit request {profit_request.status.lower()} successfully.",
                "approved_amount": profit_request.approved_amount,
            }
        )


class AnnualClosingExportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        lang = get_report_lang(request)
        closings = _get_annual_closings_queryset(request)
        year = request.query_params.get("year")

        rows = []
        total_net_profit = 0
        total_expenses = 0
        total_savings = 0
        total_adjusted_capital = 0
        for item in closings:
            adjusted_capital = get_closing_total_adjusted_capital(item)
            profit_rate_percent = get_closing_profit_rate_percent(item)
            total_net_profit += int(item.net_profit or 0)
            total_expenses += int(item.expenses or 0)
            total_savings += int(item.total_savings or 0)
            total_adjusted_capital += adjusted_capital
            rows.append(
                [
                    item.year,
                    f"{int(item.total_savings or 0):,} RWF",
                    f"{adjusted_capital:,} RWF",
                    f"{profit_rate_percent:.2f}%",
                    f"{int(item.loan_interest or 0):,} RWF",
                    f"{int(item.fines or 0):,} RWF",
                    f"{int(item.expenses or 0):,} RWF",
                    f"{int(item.net_profit or 0):,} RWF",
                    (
                        item.closed_by.get_full_name().strip() or item.closed_by.username
                        if item.closed_by
                        else "-"
                    ),
                    timezone.localtime(item.closed_on).strftime("%Y-%m-%d %H:%M")
                    if item.closed_on
                    else "-",
                ]
            )

        return build_pdf_report_response(
            filename="annual_closing_report.pdf",
            title=report_text(lang, "report.annual_closing.title"),
            subtitle=report_text(lang, "report.annual_closing.subtitle"),
            headers=[
                report_text(lang, "label.year"),
                report_text(lang, "label.savings"),
                report_text(lang, "label.total_adjusted_capital"),
                report_text(lang, "label.profit_rate"),
                report_text(lang, "label.loan_interest"),
                report_text(lang, "label.fines"),
                report_text(lang, "label.expenses"),
                report_text(lang, "label.net_profit"),
                report_text(lang, "label.closed_by"),
                report_text(lang, "label.closed_on"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.year"): year,
                f"{report_text(lang, 'label.year')} ({report_text(lang, 'label.from')})": request.query_params.get("year_from"),
                f"{report_text(lang, 'label.year')} ({report_text(lang, 'label.to')})": request.query_params.get("year_to"),
                f"{report_text(lang, 'label.closed_on')} ({report_text(lang, 'label.from')})": request.query_params.get("date_from"),
                f"{report_text(lang, 'label.closed_on')} ({report_text(lang, 'label.to')})": request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_closings"): closings.count(),
                report_text(lang, "label.total_savings"): f"{total_savings:,} RWF",
                report_text(lang, "label.total_adjusted_capital"): f"{total_adjusted_capital:,} RWF",
                report_text(lang, "label.total_expenses"): f"{total_expenses:,} RWF",
                report_text(lang, "label.net_profit"): f"{total_net_profit:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )


class MemberProfitPayoutExportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        lang = get_report_lang(request)
        queryset = _get_member_profit_payouts_queryset(request)
        serializer = MemberProfitPayoutSerializer(queryset, many=True)
        total_amount = 0
        rows = []
        for item in serializer.data:
            amount = int(item.get("amount") or 0)
            total_amount += amount
            rows.append(
                [
                    item.get("member_name") or "-",
                    item.get("annual_profit_year") or "-",
                    f"{amount:,} RWF",
                    item.get("paid_on") or "-",
                    item.get("approved_by_name") or "-",
                    item.get("notes") or "-",
                ]
            )

        return build_pdf_report_response(
            filename="profit_payouts_report.pdf",
            title=report_text(lang, "report.profit_payouts.title"),
            subtitle=report_text(lang, "report.profit_payouts.subtitle"),
            headers=[
                report_text(lang, "label.member"),
                report_text(lang, "label.year"),
                report_text(lang, "label.amount"),
                report_text(lang, "label.paid_on"),
                report_text(lang, "label.recorded_by"),
                report_text(lang, "label.notes"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.year"): request.query_params.get("year"),
                report_text(lang, "label.member"): request.query_params.get("member"),
                report_text(lang, "label.search"): request.query_params.get("search"),
                f"{report_text(lang, 'label.paid_on')} ({report_text(lang, 'label.from')})": request.query_params.get("date_from"),
                f"{report_text(lang, 'label.paid_on')} ({report_text(lang, 'label.to')})": request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_payouts"): queryset.count(),
                report_text(lang, "label.total_amount"): f"{total_amount:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )


class MemberProfitRequestExportPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lang = get_report_lang(request)
        queryset = _get_member_profit_requests_queryset(request)
        serializer = MemberProfitRequestSerializer(queryset, many=True)
        total_requested = 0
        total_approved = 0
        pending_count = 0
        rows = []
        for item in serializer.data:
            requested_amount = int(item.get("effective_requested_amount") or 0)
            approved_amount = int(item.get("approved_amount") or 0)
            status_value = item.get("status") or "-"
            total_requested += requested_amount
            total_approved += approved_amount
            pending_count += 1 if str(status_value).upper() == "PENDING" else 0
            rows.append(
                [
                    item.get("member_name") or "-",
                    item.get("requested_by_name") or "-",
                    report_choice(lang, "request_mode", item.get("request_mode"), default="-"),
                    f"{requested_amount:,} RWF",
                    f"{approved_amount:,} RWF" if approved_amount else "-",
                    report_choice(lang, "request_status", status_value, default=status_value),
                    item.get("requested_on") or "-",
                    item.get("reviewed_by_name") or "-",
                ]
            )

        return build_pdf_report_response(
            filename="profit_requests_report.pdf",
            title=report_text(lang, "report.profit_requests.title"),
            subtitle=report_text(lang, "report.profit_requests.subtitle"),
            headers=[
                report_text(lang, "label.member"),
                report_text(lang, "label.requested_by"),
                report_text(lang, "label.mode"),
                report_text(lang, "label.requested"),
                report_text(lang, "label.approved"),
                report_text(lang, "label.status"),
                report_text(lang, "label.requested_on"),
                report_text(lang, "label.reviewed_by"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.status"): report_choice(
                    lang,
                    "request_status",
                    request.query_params.get("status"),
                    default=request.query_params.get("status"),
                ),
                report_text(lang, "label.mode"): report_choice(
                    lang,
                    "request_mode",
                    request.query_params.get("request_mode"),
                    default=request.query_params.get("request_mode"),
                ),
                report_text(lang, "label.member"): request.query_params.get("member"),
                report_text(lang, "label.search"): request.query_params.get("search"),
                f"{report_text(lang, 'label.requested_on')} ({report_text(lang, 'label.from')})": request.query_params.get("date_from"),
                f"{report_text(lang, 'label.requested_on')} ({report_text(lang, 'label.to')})": request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_requests"): queryset.count(),
                report_text(lang, "label.pending_requests"): pending_count,
                report_text(lang, "label.requested_amount"): f"{total_requested:,} RWF",
                report_text(lang, "label.approved_amount"): f"{total_approved:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )

