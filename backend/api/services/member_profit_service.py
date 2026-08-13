from django.utils import timezone
from rest_framework.exceptions import ValidationError

from api.models import MemberAnnualProfit, MemberProfitPayout, MemberWithdrawal


def allocate_member_profit_payout(
    *,
    member,
    amount,
    approved_by=None,
    notes="",
    withdrawal_type=MemberWithdrawal.WithdrawalType.PROFIT,
):
    payout_amount = int(amount or 0)
    if payout_amount <= 0:
        raise ValidationError({"amount": "Amount must be greater than zero."})

    unpaid_total = member.total_unpaid_profit()
    if payout_amount > unpaid_total:
        raise ValidationError(
            {"amount": f"Amount exceeds unpaid profit balance of {unpaid_total} RWF."}
        )

    annual_rows = MemberAnnualProfit.objects.select_related("closing").filter(
        member=member,
        profit__gt=0,
    ).order_by("closing__year", "id")

    remaining = payout_amount
    created = []
    for annual_profit in annual_rows:
        available = annual_profit.unpaid_amount
        if available <= 0:
            continue

        allocation = min(available, remaining)
        payout = MemberProfitPayout.objects.create(
            member=member,
            annual_profit=annual_profit,
            amount=allocation,
            paid_on=timezone.localdate(),
            approved_by=approved_by,
            notes=notes,
        )
        created.append(payout)
        remaining -= allocation
        if remaining <= 0:
            break

    if remaining > 0:
        raise ValidationError(
            {"amount": "Unable to allocate payout across annual profits."}
        )

    withdrawal = MemberWithdrawal.objects.create(
        member=member,
        withdrawal_type=withdrawal_type,
        amount=payout_amount,
        withdrawn_on=timezone.localdate(),
        approved_by=approved_by,
        notes=notes or "Member profit withdrawal",
    )

    return created, withdrawal
