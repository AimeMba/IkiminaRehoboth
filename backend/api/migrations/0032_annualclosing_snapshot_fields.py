from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations, models
from django.db.models import Sum


POLICY_VERSION = "annual_closing_v2_snapshot"
RATE_PRECISION = Decimal("0.0001")
SHARE_PRICE = 2000


def backfill_annual_closing_snapshots(apps, schema_editor):
    AnnualClosing = apps.get_model("api", "AnnualClosing")
    Income = apps.get_model("api", "Income")
    MemberAnnualProfit = apps.get_model("api", "MemberAnnualProfit")

    for closing in AnnualClosing.objects.all().iterator():
        income_total = Income.objects.filter(
            income_date__year=closing.year
        ).aggregate(total=Sum("amount"))["total"]
        if income_total is None:
            income_total = int(closing.net_profit or 0) + int(closing.expenses or 0)

        total_adjusted_capital = int(
            MemberAnnualProfit.objects.filter(closing=closing).aggregate(total=Sum("total_amount"))[
                "total"
            ]
            or 0
        )
        total_shares = total_adjusted_capital // SHARE_PRICE
        if total_adjusted_capital > 0:
            profit_rate_percent = (
                (Decimal(str(closing.net_profit or 0)) / Decimal(str(total_adjusted_capital)))
                * Decimal("100")
            ).quantize(RATE_PRECISION, rounding=ROUND_HALF_UP)
        else:
            profit_rate_percent = Decimal("0.0000")

        AnnualClosing.objects.filter(pk=closing.pk).update(
            total_income=int(income_total or 0),
            total_adjusted_capital=total_adjusted_capital,
            profit_rate_percent=profit_rate_percent,
            total_shares=total_shares,
            december_unpaid_deducted_members=0,
            policy_version=POLICY_VERSION,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0031_alter_employee_department_alter_expense_category_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="annualclosing",
            name="december_unpaid_deducted_members",
            field=models.PositiveIntegerField(default=0, editable=False),
        ),
        migrations.AddField(
            model_name="annualclosing",
            name="policy_version",
            field=models.CharField(
                default="annual_closing_v2_snapshot",
                editable=False,
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name="annualclosing",
            name="profit_rate_percent",
            field=models.DecimalField(
                decimal_places=4,
                default=0,
                editable=False,
                max_digits=9,
            ),
        ),
        migrations.AddField(
            model_name="annualclosing",
            name="total_adjusted_capital",
            field=models.PositiveBigIntegerField(default=0, editable=False),
        ),
        migrations.AddField(
            model_name="annualclosing",
            name="total_income",
            field=models.PositiveBigIntegerField(default=0, editable=False),
        ),
        migrations.AddField(
            model_name="annualclosing",
            name="total_shares",
            field=models.PositiveBigIntegerField(default=0, editable=False),
        ),
        migrations.RunPython(backfill_annual_closing_snapshots, migrations.RunPython.noop),
    ]
