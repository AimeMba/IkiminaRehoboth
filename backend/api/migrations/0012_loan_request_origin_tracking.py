from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0011_merge_20260222_loanrequest_notification"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="loan",
            name="request_origin",
            field=models.CharField(
                choices=[
                    ("SELF", "Self Requested"),
                    ("ON_BEHALF", "Requested On Behalf"),
                    ("DIRECT", "Direct Loan Entry"),
                ],
                default="DIRECT",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="loan",
            name="requested_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="requested_loans",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="loanrequest",
            name="request_origin",
            field=models.CharField(
                choices=[("SELF", "Self Requested"), ("ON_BEHALF", "Requested On Behalf")],
                default="SELF",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="loanrequest",
            name="requested_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="created_loan_requests",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
