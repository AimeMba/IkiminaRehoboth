from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


def seed_staff_account_holders(apps, schema_editor):
    Employee = apps.get_model("api", "Employee")
    StaffAccountHolderHistory = apps.get_model("api", "StaffAccountHolderHistory")

    for employee in Employee.objects.exclude(user__isnull=True):
        StaffAccountHolderHistory.objects.get_or_create(
            user_id=employee.user_id,
            employee_id=employee.id,
            is_current=True,
            defaults={
                "started_at": timezone.now(),
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0029_roleassignmenthistory"),
    ]

    operations = [
        migrations.CreateModel(
            name="StaffAccountHolderHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("started_at", models.DateTimeField(default=timezone.now)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("is_current", models.BooleanField(default=True)),
                (
                    "assigned_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assigned_staff_holder_histories",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "employee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="account_holder_history",
                        to="api.employee",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="staff_holder_history",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-started_at", "-id"],
            },
        ),
        migrations.RunPython(seed_staff_account_holders, migrations.RunPython.noop),
    ]
