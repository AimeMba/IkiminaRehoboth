from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0009_loan_due_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanrequest",
            name="approved_loan",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="source_request",
                to="api.loan",
            ),
        ),
        migrations.AddField(
            model_name="loanrequest",
            name="client",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="loan_requests",
                to="api.client",
            ),
        ),
        migrations.AlterField(
            model_name="loanrequest",
            name="member",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="loan_requests",
                to="api.member",
            ),
        ),
    ]
