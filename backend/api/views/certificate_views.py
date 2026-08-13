from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    AnnualClosing,
    Loan,
    Member,
    MemberCertificateApproval,
    MemberSavingChoice,
    MonthlySaving,
)
from ..permissions.role_permissions import IsAdminOrManager, IsManager
from ..services.transaction_logger import log_transaction


def _get_closed_past_years():
    active_year = timezone.now().year
    return list(
        AnnualClosing.objects.filter(year__lt=active_year)
        .order_by("-year")
        .values_list("year", flat=True)
    )


def _member_eligibility(member, year):
    total_savings = (
        MonthlySaving.objects.filter(saving_choice__member=member, year=year).aggregate(
            total=Sum("amount_paid")
        )["total"]
        or 0
    )
    expected_savings = (
        MemberSavingChoice.objects.filter(member=member, category__year=year).aggregate(
            total=Sum("category__monthly_amount")
        )["total"]
        or 0
    ) * 12

    savings_ok = expected_savings > 0 and total_savings >= expected_savings

    unpaid_loans_exists = Loan.objects.filter(member=member).exclude(status="PAID").filter(
        issued_date__year__lte=year
    ).exists()
    loans_ok = not unpaid_loans_exists

    return {
        "total_savings": total_savings,
        "expected_savings": expected_savings,
        "savings_ok": savings_ok,
        "loans_ok": loans_ok,
        "eligible": savings_ok and loans_ok,
    }


class CertificateApprovalListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get(self, request):
        closed_years = _get_closed_past_years()
        if not closed_years:
            return Response({"year": None, "available_years": [], "results": []})

        year_param = request.query_params.get("year")
        if year_param:
            try:
                year = int(year_param)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Year must be a valid number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            year = closed_years[0]

        if year not in closed_years:
            return Response(
                {"detail": "Only closed past years can be approved.", "available_years": closed_years},
                status=status.HTTP_400_BAD_REQUEST,
            )

        approvals = {
            item.member_id: item
            for item in MemberCertificateApproval.objects.select_related("approved_by").filter(year=year)
        }

        results = []
        members = Member.objects.select_related("user").filter(is_active=True).order_by("national_id")
        for member in members:
            eligibility = _member_eligibility(member, year)
            approval = approvals.get(member.id)
            results.append(
                {
                    "member_id": member.id,
                    "member_name": member.user.get_full_name() or member.user.username,
                    "national_id": member.national_id,
                    "year": year,
                    **eligibility,
                    "approved": bool(approval),
                    "approved_on": approval.approved_on if approval else None,
                    "approved_by": (
                        (approval.approved_by.get_full_name() or approval.approved_by.username)
                        if approval and approval.approved_by
                        else None
                    ),
                }
            )

        return Response({"year": year, "available_years": closed_years, "results": results})


class CertificateApprovalCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsManager]

    def post(self, request):
        member_id = request.data.get("member_id")
        year = request.data.get("year")

        if not member_id or not year:
            return Response(
                {"detail": "member_id and year are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            year = int(year)
        except (TypeError, ValueError):
            return Response({"detail": "Year must be a valid number."}, status=status.HTTP_400_BAD_REQUEST)

        closed_years = _get_closed_past_years()
        if year not in closed_years:
            return Response(
                {"detail": "Only closed past years can be approved.", "available_years": closed_years},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = get_object_or_404(Member, id=member_id)
        eligibility = _member_eligibility(member, year)
        if not eligibility["eligible"]:
            return Response(
                {
                    "detail": "Member does not meet certificate requirements for this year.",
                    **eligibility,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        approval, created = MemberCertificateApproval.objects.get_or_create(
            member=member,
            year=year,
            defaults={"approved_by": request.user},
        )
        if not created and approval.approved_by_id != request.user.id:
            approval.approved_by = request.user
            approval.save(update_fields=["approved_by"])

        log_transaction(
            user=request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="MemberCertificateApproval",
            related_object_id=approval.id,
            description=f"Certificate approved for {member.national_id} ({year})",
            request=request,
        )

        return Response(
            {
                "message": "Certificate approved successfully.",
                "member_id": member.id,
                "year": year,
                "approved_by": request.user.get_full_name() or request.user.username,
            }
        )

