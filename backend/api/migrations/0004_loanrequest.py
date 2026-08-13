from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_client_national_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="LoanRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("requested_amount", models.PositiveIntegerField()),
                ("purpose", models.TextField(blank=True)),
                ("requested_on", models.DateTimeField(auto_now_add=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDING", "Pending"),
                            ("APPROVED", "Approved"),
                            ("REJECTED", "Rejected"),
                        ],
                        default="PENDING",
                        max_length=20,
                    ),
                ),
                ("reviewed_on", models.DateTimeField(blank=True, null=True)),
                ("review_notes", models.TextField(blank=True)),
                (
                    "member",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="loan_requests",
                        to="api.member",
                    ),
                ),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reviewed_loan_requests",
                        to="api.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-requested_on"],
            },
        ),
    ]
