from django.db import migrations


DEFAULT_INCOME_CATEGORIES = [
    "Membership Fee",
    "Loan Interest",
    "Fines",
    "Retained Member Exit Funds",
    "Other Income",
]

DEFAULT_EXPENSE_CATEGORIES = [
    "Operations",
    "Utilities",
    "Transport",
    "Salaries",
    "Other Expenses",
]


def seed_finance_reference_data(apps, schema_editor):
    IncomeCategory = apps.get_model("api", "IncomeCategory")
    ExpenseCategory = apps.get_model("api", "ExpenseCategory")

    for name in DEFAULT_INCOME_CATEGORIES:
        IncomeCategory.objects.get_or_create(name=name)

    for name in DEFAULT_EXPENSE_CATEGORIES:
        ExpenseCategory.objects.get_or_create(name=name)


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0032_annualclosing_snapshot_fields"),
    ]

    operations = [
        migrations.RunPython(seed_finance_reference_data, migrations.RunPython.noop),
    ]
