from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0025_memberwithdrawal"),
    ]

    operations = [
        migrations.CreateModel(
            name="MemberProfitRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("request_mode", models.CharField(choices=[("ALL", "All Profits"), ("PARTIAL", "Partial Profit")], default="ALL", max_length=20)),
                ("requested_amount", models.PositiveBigIntegerField(blank=True, null=True)),
                ("requested_balance", models.PositiveBigIntegerField(default=0, editable=False)),
                ("request_notes", models.TextField(blank=True, default="")),
                ("requested_on", models.DateTimeField(auto_now_add=True)),
                ("status", models.CharField(choices=[("PENDING", "Pending"), ("APPROVED", "Approved"), ("REJECTED", "Rejected")], default="PENDING", max_length=20)),
                ("approved_amount", models.PositiveBigIntegerField(blank=True, null=True)),
                ("reviewed_on", models.DateTimeField(blank=True, null=True)),
                ("review_notes", models.TextField(blank=True, default="")),
                ("member", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="profit_requests", to="api.member")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_profit_requests", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-requested_on", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="memberprofitrequest",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status", "PENDING")),
                fields=("member",),
                name="unique_pending_profit_request_per_member",
            ),
        ),
    ]
