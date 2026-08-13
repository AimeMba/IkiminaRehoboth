from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0017_loan_terms_months"),
    ]

    operations = [
        migrations.AddField(
            model_name="loan",
            name="term_days",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="loanrequest",
            name="requested_term_days",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
