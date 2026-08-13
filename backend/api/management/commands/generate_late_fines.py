# api/management/commands/generate_late_fines.py

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import (
    MemberSavingChoice,
    MonthlySaving,
    Fine,
    FineRule
)


def _previous_month_year(reference_date):
    if reference_date.month == 1:
        return 12, reference_date.year - 1
    return reference_date.month - 1, reference_date.year


class Command(BaseCommand):
    help = "Generate monthly 10% late fine starting on 6th for previous month unpaid saving"

    def handle(self, *args, **kwargs):
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
            self.stdout.write("Late saving rule is disabled.")
            return

        # Savings due date is the 5th for previous month's saving.
        # Fines start on the 6th at 00:00 => day must be > applies_after_days.
        if today.day <= rule.applies_after_days:
            self.stdout.write("No fines generated (fine date not reached yet).")
            return

        # December unpaid saving is handled at annual closing (shares/profit deduction),
        # not by monthly fine generation.
        if target_month == 12:
            self.stdout.write("Skipping monthly fine: December unpaid is handled at annual closing.")
            return

        choices = MemberSavingChoice.objects.filter(
            is_active=True,
            member__is_active=True,
            category__year=target_year,
        ).select_related("member", "category")

        for choice in choices:

            # Check if saving already paid
            paid = MonthlySaving.objects.filter(
                saving_choice=choice,
                month=target_month,
                year=target_year
            ).exists()

            if paid:
                continue

            # Check if fine already created for this month
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

            self.stdout.write(
                f"Fine created for {choice.member} - {fine_amount} RWF ({target_month}/{target_year})"
            )

        self.stdout.write("Late fine generation completed.")

