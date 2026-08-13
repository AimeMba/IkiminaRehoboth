from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import MembershipFee, Member
from ..serializers.membership_serializers import MembershipFeeSerializer
from ..permissions.role_permissions import IsTellerOrAdmin, IsAdminFinanceOrAuditor
from ..services.transaction_logger import log_transaction


# -------------------------------
# MEMBERSHIP FEES
# -------------------------------

class MembershipFeeCreateView(generics.CreateAPIView):
    """
    Teller records membership fee payment.
    Automatically creates Income record.
    """
    queryset = MembershipFee.objects.all()
    serializer_class = MembershipFeeSerializer
    permission_classes = [IsAuthenticated, IsTellerOrAdmin]

    def perform_create(self, serializer):
        fee = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="MEMBERSHIP",
            action="PAY",
            related_model="MembershipFee",
            related_object_id=fee.id,
            amount=fee.amount,
            description=f"Membership fee recorded for {fee.member.national_id}",
            request=self.request,
        )


class MembershipFeeListView(generics.ListAPIView):
    """
    Finance/Admin can view all membership fee payments.
    """
    serializer_class = MembershipFeeSerializer
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get_queryset(self):
        return _get_membership_fees_queryset(self.request)


class MembershipFeeOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsTellerOrAdmin]

    def get(self, request):
        members = (
            Member.objects.select_related("user")
            .filter(
                is_active=True,
                enrollment_type=Member.EnrollmentType.NEW,
                membership_fee__isnull=True,
                user__is_active=False,
            )
            .order_by("user__first_name", "user__last_name", "national_id")
        )
        payload = [
            {
                "id": member.id,
                "label": (
                    member.user.get_full_name()
                    or member.user.username
                    or member.national_id
                ),
                "national_id": member.national_id,
                "account_number": member.account_number,
            }
            for member in members
        ]
        return Response({"members": payload})


def _get_membership_fees_queryset(request):
    from django.db.models import Q

    queryset = MembershipFee.objects.select_related(
        "member__user",
        "received_by",
    ).order_by("-paid_on", "-id")
    params = request.query_params
    search = (params.get("search") or "").strip()
    member_id = params.get("member")
    date_from = params.get("date_from")
    date_to = params.get("date_to")

    if search:
        search_query = (
            Q(member__national_id__icontains=search)
            | Q(member__account_number__icontains=search)
            | Q(member__user__username__icontains=search)
            | Q(member__user__first_name__icontains=search)
            | Q(member__user__last_name__icontains=search)
            | Q(received_by__username__icontains=search)
            | Q(received_by__first_name__icontains=search)
            | Q(received_by__last_name__icontains=search)
        )
        if search.isdigit():
            search_query |= Q(id=int(search)) | Q(amount=int(search))
        queryset = queryset.filter(search_query)

    if member_id:
        queryset = queryset.filter(member_id=member_id)
    if date_from:
        queryset = queryset.filter(paid_on__gte=date_from)
    if date_to:
        queryset = queryset.filter(paid_on__lte=date_to)

    return queryset


class MembershipFeeExportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsAdminFinanceOrAuditor]

    def get(self, request):
        from ..utils.pdf_reports import build_pdf_report_response
        from ..utils.report_language import get_report_lang, report_text

        lang = get_report_lang(request)
        queryset = _get_membership_fees_queryset(request)
        serializer = MembershipFeeSerializer(queryset, many=True)
        total_amount = 0
        rows = []

        for item in serializer.data:
            amount = int(item.get("amount") or 0)
            total_amount += amount
            rows.append(
                [
                    item.get("id") or "-",
                    item.get("member_name") or "-",
                    item.get("national_id") or "-",
                    item.get("account_number") or "-",
                    f"{amount:,} RWF",
                    item.get("paid_on") or "-",
                    report_text(lang, "value.paid"),
                    item.get("received_by_name") or "-",
                ]
            )

        return build_pdf_report_response(
            filename="membership_fees_report.pdf",
            title=report_text(lang, "report.membership_fees.title"),
            subtitle=report_text(lang, "report.membership_fees.subtitle"),
            headers=[
                report_text(lang, "label.id"),
                report_text(lang, "label.member"),
                report_text(lang, "label.national_id"),
                report_text(lang, "label.account_number"),
                report_text(lang, "label.amount"),
                report_text(lang, "label.paid_on"),
                report_text(lang, "label.payment_status"),
                report_text(lang, "label.received_by"),
            ],
            rows=rows or [["-", "-", "-", "-", "-", "-", "-", "-"]],
            generated_by=request.user.get_full_name().strip() or request.user.username,
            filters={
                report_text(lang, "label.search"): request.query_params.get("search"),
                report_text(lang, "label.member"): request.query_params.get("member"),
                f"{report_text(lang, 'label.paid_on')} ({report_text(lang, 'label.from')})": request.query_params.get("date_from"),
                f"{report_text(lang, 'label.paid_on')} ({report_text(lang, 'label.to')})": request.query_params.get("date_to"),
            },
            summary={
                report_text(lang, "label.total_records"): queryset.count(),
                report_text(lang, "label.total_amount"): f"{total_amount:,} RWF",
            },
            lang=lang,
            acting_user=request.user,
        )

