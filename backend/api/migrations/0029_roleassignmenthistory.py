from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def seed_role_assignment_history(apps, schema_editor):
    User = apps.get_model("api", "User")
    RoleAssignmentHistory = apps.get_model("api", "RoleAssignmentHistory")

    histories = []
    for user in User.objects.all():
        histories.append(
            RoleAssignmentHistory(
                user_id=user.id,
                role=user.role,
                started_at=user.date_joined or django.utils.timezone.now(),
                assigned_by_id=user.created_by_id,
                is_current=True,
            )
        )
    RoleAssignmentHistory.objects.bulk_create(histories, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0028_savingchoicechangerequest_origin_requested_by"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoleAssignmentHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("ADMIN", "Admin"), ("MANAGER", "Manager"), ("MEMBER", "Member"), ("TELLER", "Teller"), ("LOAN_OFFICER", "Loan Officer"), ("FINANCE", "Finance"), ("AUDITOR", "Auditor"), ("CLIENT", "Client")], max_length=20)),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("is_current", models.BooleanField(default=True)),
                ("assigned_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_role_histories", to=settings.AUTH_USER_MODEL)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="role_assignment_history", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-started_at", "-id"],
            },
        ),
        migrations.RunPython(seed_role_assignment_history, migrations.RunPython.noop),
    ]
