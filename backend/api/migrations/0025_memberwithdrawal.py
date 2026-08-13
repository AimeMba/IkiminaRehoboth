from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0024_memberprofitpayout"),
    ]

    operations = [
        migrations.CreateModel(
            name="MemberWithdrawal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "withdrawal_type",
                    models.CharField(
                        choices=[("EXIT", "Member Exit"), ("PROFIT", "Profit Withdrawal"), ("OTHER", "Other")],
                        default="OTHER",
                        max_length=20,
                    ),
                ),
                ("amount", models.PositiveBigIntegerField()),
                ("withdrawn_on", models.DateField(blank=True, null=True)),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="approved_member_withdrawals",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "member",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="withdrawals",
                        to="api.member",
                    ),
                ),
                (
                    "member_exit",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="withdrawal_record",
                        to="api.memberexit",
                    ),
                ),
            ],
            options={
                "ordering": ["-withdrawn_on", "-id"],
            },
        ),
    ]
