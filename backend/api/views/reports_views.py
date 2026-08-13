from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum
from django.utils.timezone import now

from ..models import (
    MonthlySaving,
    Expense,
    Income,
    Member
)
from ..permissions.role_permissions import IsAdminFinanceOrAuditor, IsAdmin

SHARE_PRICE = 2000
class IkiminaSummaryReport(APIView):
    permission_classes = [IsAdminFinanceOrAuditor]

    def get(self, request):
        total_savings = MonthlySaving.objects.aggregate(
            total=Sum('amount_paid')
        )['total'] or 0

        total_loan_interest = Income.objects.filter(
            related_model="LoanRepayment"
        ).aggregate(total=Sum("amount"))["total"] or 0

        total_fines = Income.objects.filter(
            related_model="Fine"
        ).aggregate(total=Sum("amount"))["total"] or 0

        total_income = Income.objects.aggregate(total=Sum("amount"))["total"] or 0

        total_expenses = Expense.objects.aggregate(
            total=Sum('amount')
        )['total'] or 0

        net_profit = total_income - total_expenses

        return Response({
            "total_savings": total_savings,
            "loan_interest": total_loan_interest,
            "fines": total_fines,
            "total_income": total_income,
            "expenses": total_expenses,
            "net_profit": net_profit
        })
class MemberSharesReport(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        members = Member.objects.all()

        total_capital = 0
        member_data = []

        for member in members:
            member_savings = MonthlySaving.objects.filter(
                saving_choice__member=member
            ).aggregate(total=Sum('amount_paid'))['total'] or 0

            total_capital += member_savings

            shares = member_savings // SHARE_PRICE

            member_data.append({
                "member_id": member.id,
                "national_id": member.national_id,
                "total_amount": member_savings,
                "shares": shares,
            })

        total_shares = sum(m["shares"] for m in member_data)

        return Response({
            "share_price": SHARE_PRICE,
            "total_capital": total_capital,
            "total_shares": total_shares,
            "members": member_data
        })

