from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from datetime import timedelta
from django.db.models import Sum, Q
from django.utils import timezone

from ..models import Loan, LoanRepayment, Member, Client, LoanType
from ..serializers.loan_serializers import (
    LoanSerializer,
    LoanRepaymentSerializer,
    LoanTypeOptionSerializer,
)

from ..permissions.role_permissions import (
    IsLoanOfficerOrAdmin,
    IsTellerOrAdmin,
    IsAdmin,
    IsMemberOrClient,
    IsLoanReadStaff,
    IsRepaymentReadStaff,
    IsLoanTypeViewer,
)
from ..services.transaction_logger import log_transaction
from ..utils.pdf_reports import build_pdf_report_response
from ..utils.report_language import get_report_lang, report_choice, report_text


def _parse_bool(value):
    if value is None:
        return None
    value = str(value).strip().lower()
    if value in {"1", "true", "yes"}:
        return True
    if value in {"0", "false", "no"}:
        return False
    return None


def _get_loans_queryset(request):
    queryset = Loan.objects.select_related(
        "member",
        "member__user",
        "client",
        "loan_type",
        "requested_by",
    )

    params = request.query_params
    search = params.get("search")
    status = params.get("status")
    status_group = params.get("status_group")
    owner_type = params.get("owner_type")
    owner_id = params.get("owner_id")
    loan_type = params.get("loan_type")
    issued_from = params.get("issued_from")
    issued_to = params.get("issued_to")
    due_from = params.get("due_from")
    due_to = params.get("due_to")
    near_due_days = int(params.get("near_due_days") or 7)
    is_overdue = _parse_bool(params.get("is_overdue"))

    if search:
        queryset = queryset.filter(
            Q(loan_type__name__icontains=search)
            | Q(member__national_id__icontains=search)
            | Q(member__user__username__icontains=search)
            | Q(client__full_name__icontains=search)
            | Q(id__icontains=search)
        )

    if status:
        queryset = queryset.filter(status=status)
    if owner_type == "MEMBER":
        queryset = queryset.filter(member__isnull=False)
    elif owner_type == "CLIENT":
        queryset = queryset.filter(client__isnull=False)
    if owner_id:
        if owner_type == "CLIENT":
            queryset = queryset.filter(client_id=owner_id)
        else:
            queryset = queryset.filter(member_id=owner_id)
    if loan_type:
        queryset = queryset.filter(loan_type_id=loan_type)
    if issued_from:
        queryset = queryset.filter(issued_date__gte=issued_from)
    if issued_to:
        queryset = queryset.filter(issued_date__lte=issued_to)
    if due_from:
        queryset = queryset.filter(due_date__gte=due_from)
    if due_to:
        queryset = queryset.filter(due_date__lte=due_to)

    today = timezone.localdate()
    if is_overdue is True:
        queryset = queryset.exclude(status="PAID").filter(due_date__lt=today)
    elif is_overdue is False:
        queryset = queryset.filter(due_date__gte=today)

    if status_group == "PAID":
        queryset = queryset.filter(status="PAID")
    elif status_group == "UNPAID":
        queryset = queryset.exclude(status="PAID")
    elif status_group == "OVERDUE":
        queryset = queryset.exclude(status="PAID").filter(due_date__lt=today)
    elif status_group == "NEAR_DUE":
        queryset = queryset.exclude(status="PAID").filter(
            due_date__gte=today,
            due_date__lte=today + timedelta(days=near_due_days),
        )

    return queryset.order_by("-issued_date", "-id")


def _get_loan_repayments_queryset(request):
    queryset = LoanRepayment.objects.select_related(
        "loan",
        "loan__loan_type",
        "loan__member__user",
        "loan__client",
        "received_by"
    )

    params = request.query_params
    search = params.get("search")
    owner_type = params.get("owner_type")
    owner_id = params.get("owner_id")
    loan_status = params.get("loan_status")
    loan_type = params.get("loan_type")
    paid_from = params.get("date_from")
    paid_to = params.get("date_to")

    if search:
        queryset = queryset.filter(
            Q(loan__id__icontains=search)
            | Q(loan__member__national_id__icontains=search)
            | Q(loan__member__user__username__icontains=search)
            | Q(loan__client__full_name__icontains=search)
        )

    if owner_type == "MEMBER":
        queryset = queryset.filter(loan__member__isnull=False)
    elif owner_type == "CLIENT":
        queryset = queryset.filter(loan__client__isnull=False)
    if owner_id:
        if owner_type == "CLIENT":
            queryset = queryset.filter(loan__client_id=owner_id)
        else:
            queryset = queryset.filter(loan__member_id=owner_id)
    if loan_status:
        queryset = queryset.filter(loan__status=loan_status)
    if loan_type:
        queryset = queryset.filter(loan__loan_type_id=loan_type)
    if paid_from:
        queryset = queryset.filter(paid_on__gte=paid_from)
    if paid_to:
        queryset = queryset.filter(paid_on__lte=paid_to)

    return queryset.order_by("-paid_on", "-id")

# =====================================================
# LOANS CRUD
# =====================================================

class LoanCreateView(generics.CreateAPIView):
    """
    Create Loan (Loan Officer/Admin only)
    """
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated, IsLoanOfficerOrAdmin]

    def perform_create(self, serializer):
        member = serializer.validated_data.get("member")
        client = serializer.validated_data.get("client")
        owner_user = member.user if member else (client.user if client else None)
        request_origin = Loan.RequestOrigin.ON_BEHALF
        if owner_user and owner_user.id == self.request.user.id:
            request_origin = Loan.RequestOrigin.SELF

        loan = serializer.save(
            requested_by=self.request.user,
            request_origin=request_origin,
        )
        log_transaction(
            user=self.request.user,
            transaction_type="LOAN",
            action="CREATE",
            related_model="Loan",
            related_object_id=loan.id,
            amount=loan.principal_amount,
            description=f"Created loan #{loan.id}",
            request=self.request,
        )


class LoanListAPIView(generics.ListAPIView):
    """
    List Loans (Finance/Auditor/Admin)
    """
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated, IsLoanReadStaff]

    def get_queryset(self):
        return _get_loans_queryset(self.request)


class LoanDetailAPIView(generics.RetrieveAPIView):
    """
    Retrieve Loan details
    """
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated, IsLoanReadStaff]

    def get_queryset(self):
        return Loan.objects.select_related(
            "member",
            "client",
            "loan_type"
        )


class LoanUpdateAPIView(generics.UpdateAPIView):
    """
    Update Loan (Loan Officer/Admin)
    """
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated, IsLoanOfficerOrAdmin]

    def perform_update(self, serializer):
        loan = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="LOAN",
            action="UPDATE",
            related_model="Loan",
            related_object_id=loan.id,
            amount=loan.principal_amount,
            description=f"Updated loan #{loan.id}",
            request=self.request,
        )


class LoanDeleteAPIView(generics.DestroyAPIView):
    """
    Delete Loan (Admin only)
    """
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def perform_destroy(self, instance):
        loan_id = instance.id
        amount = instance.principal_amount
        super().perform_destroy(instance)
        log_transaction(
            user=self.request.user,
            transaction_type="LOAN",
            action="DELETE",
            related_model="Loan",
            related_object_id=loan_id,
            amount=amount,
            description=f"Deleted loan #{loan_id}",
            request=self.request,
        )


# =====================================================
# LOAN REPAYMENTS CRUD
# =====================================================

class LoanRepaymentCreateView(generics.CreateAPIView):
    """
    Record repayment.

    Automatically:
    âœ… Creates Income record for interest (Serializer)
    âœ… Updates loan status when principal is fully paid
    """
    queryset = LoanRepayment.objects.all()
    serializer_class = LoanRepaymentSerializer
    permission_classes = [IsAuthenticated, IsTellerOrAdmin]

    def perform_create(self, serializer):
        repayment = serializer.save()

        loan = repayment.loan

        # ===============================
        # Update Loan Status
        # ===============================

        principal_paid = loan.repayments.aggregate(
            total=Sum("principal_amount")
        )["total"] or 0

        if principal_paid >= loan.principal_amount:
            loan.status = "PAID"
        else:
            loan.status = "ONGOING"

        loan.save()

        log_transaction(
            user=self.request.user,
            transaction_type="REPAYMENT",
            action="PAY",
            related_model="LoanRepayment",
            related_object_id=repayment.id,
            amount=repayment.amount,
            description=f"Recorded repayment for loan #{loan.id}",
            request=self.request,
        )


class LoanRepaymentListAPIView(generics.ListAPIView):
    """
    List repayments (Finance/Admin)
    """
    serializer_class = LoanRepaymentSerializer
    permission_classes = [IsAuthenticated, IsRepaymentReadStaff]

    def get_queryset(self):
        return _get_loan_repayments_queryset(self.request)


class LoanTypeListAPIView(generics.ListAPIView):
    serializer_class = LoanTypeOptionSerializer
    permission_classes = [IsAuthenticated, IsLoanTypeViewer]

    def get_queryset(self):
        return LoanType.objects.filter(is_active=True).order_by("name")


class LoanFormOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsLoanOfficerOrAdmin]

    def get(self, request):
        members = Member.objects.filter(is_active=True).select_related("user").order_by(
            "user__first_name",
            "user__last_name",
            "national_id",
        )
        clients = Client.objects.filter(is_active=True).order_by("full_name")

        member_options = [
            {
                "id": member.id,
                "label": (
                    member.user.get_full_name()
                    or member.user.username
                    or member.national_id
                ),
                "username": member.user.username if member.user else "",
                "full_name": member.user.get_full_name() if member.user else "",
                "email": member.user.email if member.user else "",
                "national_id": member.national_id,
                "account_number": member.account_number,
                "phone": member.phone,
                "joined_date": member.joined_date,
                "address_name": member.address.name if member.address else "",
                "is_active": member.is_active,
            }
            for member in members
        ]
        client_options = [
            {
                "id": client.id,
                "label": client.full_name,
                "full_name": client.full_name,
                "account_number": client.account_number,
                "national_id": client.national_id,
                "phone": client.phone,
                "address_name": client.address.name if client.address else "",
                "is_active": client.is_active,
            }
            for client in clients
        ]

        return Response(
            {
                "members": member_options,
                "clients": client_options,
            }
        )


class LoanRepaymentFormOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsTellerOrAdmin]

    def get(self, request):
        owner_type = request.query_params.get("owner_type")
        owner_id = request.query_params.get("owner_id")
        loans = Loan.objects.select_related(
            "member__user",
            "client",
            "loan_type",
        ).order_by("-issued_date", "-id")

        if owner_id:
            if owner_type == "CLIENT":
                loans = loans.filter(client_id=owner_id)
            else:
                loans = loans.filter(member_id=owner_id)

        options = []
        for loan in loans:
            principal_paid = loan.repayments.aggregate(
                total=Sum("principal_amount")
            )["total"] or 0
            remaining_principal = int(loan.principal_amount) - int(principal_paid)
            if remaining_principal <= 0:
                continue

            if loan.member:
                member_user = loan.member.user
                owner_name = (
                    member_user.get_full_name()
                    or member_user.username
                    or loan.member.national_id
                )
                owner_type = "MEMBER"
            elif loan.client:
                owner_name = loan.client.full_name
                owner_type = "CLIENT"
            else:
                owner_name = "-"
                owner_type = "-"

            options.append(
                {
                    "id": loan.id,
                    "label": f"#{loan.id} - {owner_name}",
                    "owner_name": owner_name,
                    "owner_type": owner_type,
                    "loan_type_name": loan.loan_type.name if loan.loan_type else "-",
                    "principal_amount": int(loan.principal_amount),
                    "remaining_principal": int(remaining_principal),
                    "interest_rate": float(loan.interest_rate),
                    "status": loan.status,
                    "due_date": loan.due_date,
                }
            )

        return Response({"loans": options})


class LoanExportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsLoanReadStaff]

    def get(self, request):
        lang = get_report_lang(request)
        queryset = _get_loans_queryset(request)
        serializer = LoanSerializer(queryset, many=True)
        rows = []
        total_principal = 0
        total_amount = 0
        total_remaining = 0
        for item in serializer.data:
            principal = int(item.get("principal_amount") or 0)
            amount = int(item.get("total_amount") or 0)
            remaining = int(item.get("remaining_balance") or 0)
            total_principal += principal
            total_amount += amount
            total_remaining += remaining
            rows.append(
                [
                    item.get("id") or "-",
                    item.get("owner_name") or "-",
                    report_choice(lang, "owner_type", item.get("owner_type"), default="-"),
                    item.get("loan_type_name") or "-",
                    f"{principal:,} RWF",
                    f"{amount:,} RWF",
                    f"{remaining:,} RWF",
                    report_choice(lang, "loan_status", item.get("status"), default="-"),
                    item.get("due_date") or "-",
                ]
            )

        return build_pdf_report_response(
            filename="loans_report.pdf",
            title=report_text(lang, "report.loans.title"),
            subtitle=report_text(lang, "report.loans.subtitle"),
            headers=[
                report_text(lang, "label.id"),
                report_text(lang, "label.owner"),
                report_text(lang, "label.owner_type"),
                report_text(lang, "label.loan_type"),
                report_text(lang, "label.principal"),
                report_text(lang, "label.total_amount"),
                report_text(lang, "label.remaining"),
                report_text(lang, "label.status"),
                report_text(lang, "label.due_date"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.search"): request.query_params.get("search"),
                report_text(lang, "label.status_group"): report_choice(
                    lang,
                    "status_group",
                    request.query_params.get("status_group"),
                    default=request.query_params.get("status_group"),
                ),
                report_text(lang, "label.owner_type"): report_choice(
                    lang,
                    "owner_type",
                    request.query_params.get("owner_type"),
                    default=request.query_params.get("owner_type"),
                ),
                report_text(lang, "label.owner_id"): request.query_params.get("owner_id"),
                report_text(lang, "label.loan_type"): request.query_params.get("loan_type"),
                report_text(lang, "label.due_from"): request.query_params.get("due_from"),
                report_text(lang, "label.due_to"): request.query_params.get("due_to"),
            },
            summary={
                report_text(lang, "label.total_records"): queryset.count(),
                report_text(lang, "label.total_principal"): f"{total_principal:,} RWF",
                report_text(lang, "label.total_amount"): f"{total_amount:,} RWF",
                report_text(lang, "label.remaining_balance"): f"{total_remaining:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )


class LoanRepaymentExportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsRepaymentReadStaff]

    def get(self, request):
        lang = get_report_lang(request)
        queryset = _get_loan_repayments_queryset(request)
        serializer = LoanRepaymentSerializer(queryset, many=True)
        rows = []
        total_paid = 0
        total_principal = 0
        total_interest = 0
        for item in serializer.data:
            amount = int(item.get("amount") or 0)
            principal = int(item.get("principal_amount") or 0)
            interest = int(item.get("interest_amount") or 0)
            total_paid += amount
            total_principal += principal
            total_interest += interest
            rows.append(
                [
                    item.get("id") or "-",
                    item.get("loan") or "-",
                    item.get("loan_owner") or "-",
                    report_choice(lang, "owner_type", item.get("loan_owner_type"), default="-"),
                    item.get("loan_type_name") or "-",
                    f"{amount:,} RWF",
                    f"{principal:,} RWF",
                    f"{interest:,} RWF",
                    item.get("paid_on") or "-",
                ]
            )

        return build_pdf_report_response(
            filename="loan_repayments_report.pdf",
            title=report_text(lang, "report.loan_repayments.title"),
            subtitle=report_text(lang, "report.loan_repayments.subtitle"),
            headers=[
                report_text(lang, "label.id"),
                report_text(lang, "label.loan_id"),
                report_text(lang, "label.owner"),
                report_text(lang, "label.owner_type"),
                report_text(lang, "label.loan_type"),
                report_text(lang, "label.amount"),
                report_text(lang, "label.principal"),
                report_text(lang, "label.interest"),
                report_text(lang, "label.paid_on"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.search"): request.query_params.get("search"),
                report_text(lang, "label.owner_type"): report_choice(
                    lang,
                    "owner_type",
                    request.query_params.get("owner_type"),
                    default=request.query_params.get("owner_type"),
                ),
                report_text(lang, "label.owner_id"): request.query_params.get("owner_id"),
                report_text(lang, "label.loan_status"): report_choice(
                    lang,
                    "loan_status",
                    request.query_params.get("loan_status"),
                    default=request.query_params.get("loan_status"),
                ),
                report_text(lang, "label.loan_type"): request.query_params.get("loan_type"),
                report_text(lang, "label.from"): request.query_params.get("date_from"),
                report_text(lang, "label.to"): request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_records"): queryset.count(),
                report_text(lang, "label.total_paid"): f"{total_paid:,} RWF",
                report_text(lang, "label.principal_repaid"): f"{total_principal:,} RWF",
                report_text(lang, "label.interest_income"): f"{total_interest:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )


class MyLoanListAPIView(generics.ListAPIView):
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated, IsMemberOrClient]

    def get_queryset(self):
        queryset = Loan.objects.select_related("member", "client", "loan_type")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if self.request.user.role == "MEMBER":
            queryset = queryset.filter(member__user=self.request.user)
        else:
            queryset = queryset.filter(client__user=self.request.user)

        if date_from:
            queryset = queryset.filter(issued_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(issued_date__lte=date_to)

        return queryset.order_by("-issued_date", "-id")


class MyLoanRepaymentListAPIView(generics.ListAPIView):
    serializer_class = LoanRepaymentSerializer
    permission_classes = [IsAuthenticated, IsMemberOrClient]

    def get_queryset(self):
        queryset = LoanRepayment.objects.select_related(
            "loan",
            "loan__loan_type",
            "loan__member__user",
            "loan__client__user",
            "received_by",
        )
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if self.request.user.role == "MEMBER":
            queryset = queryset.filter(loan__member__user=self.request.user)
        else:
            queryset = queryset.filter(loan__client__user=self.request.user)

        if date_from:
            queryset = queryset.filter(paid_on__gte=date_from)
        if date_to:
            queryset = queryset.filter(paid_on__lte=date_to)

        return queryset.order_by("-paid_on", "-id")

