from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0015_loanrequest_attachments"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanrequest",
            name="requested_loan_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="loan_requests",
                to="api.loantype",
            ),
        ),
    ]
