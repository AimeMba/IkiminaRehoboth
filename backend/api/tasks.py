from decimal import Decimal, ROUND_HALF_UP

from celery import shared_task
from django.utils import timezone
from api.models import MemberSavingChoice, MonthlySaving, Fine, FineRule
from api.services.reminder_service import send_monthly_saving_reminders, send_loan_payment_reminders


def _previous_month_year(reference_date):
    if reference_date.month == 1:
        return 12, reference_date.year - 1
    return reference_date.month - 1, reference_date.year


@shared_task
def generate_late_fines():
    today = timezone.localdate()
    target_month, target_year = _previous_month_year(today)

    rule, _ = FineRule.objects.get_or_create(
        name="Late Saving 10%",
        fine_type=FineRule.FineType.SAVING,
        defaults={
            "percentage": Decimal("10.00"),
            "applies_after_days": 5,
            "is_active": True
        }
    )
    if not rule.is_active:
        return "Late saving rule is disabled"

    # Savings due date is the 5th of the current month for previous month's saving.
    # Fines start on the 6th at 00:00, so we run from day > applies_after_days (default 5).
    if today.day <= rule.applies_after_days:
        return "Fine date not reached yet"

    # December unpaid saving is handled at annual closing (shares/profit deduction),
    # not by monthly fine generation.
    if target_month == 12:
        return "December unpaid saving is handled at annual closing"

    choices = MemberSavingChoice.objects.filter(
        is_active=True,
        member__is_active=True,
        category__year=target_year,
    ).select_related("member", "category")

    for choice in choices:
        paid = MonthlySaving.objects.filter(
            saving_choice=choice,
            month=target_month,
            year=target_year
        ).exists()

        if paid:
            continue

        fine_exists = Fine.objects.filter(
            member=choice.member,
            rule=rule,
            calculated_on__month=today.month,
            calculated_on__year=today.year
        ).exists()

        if fine_exists:
            continue

        fine_amount = int(
            (choice.category.monthly_amount * rule.percentage) / Decimal("100")
        )

        Fine.objects.create(
            member=choice.member,
            rule=rule,
            amount=fine_amount,
            is_paid=False
        )

    return "Late fines generated"


@shared_task
def send_saving_reminders():
    return send_monthly_saving_reminders(force=False)


@shared_task
def send_loan_reminders():
    return send_loan_payment_reminders(force=False)


