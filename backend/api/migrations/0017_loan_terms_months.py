from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0016_loanrequest_requested_loan_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="loan",
            name="term_months",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="loanrequest",
            name="requested_term_months",
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
