from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0007_member_enrollment_type"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "notification_type",
                    models.CharField(
                        choices=[("SAVING_REMINDER", "Saving Reminder"), ("SYSTEM", "System")],
                        max_length=30,
                    ),
                ),
                ("title", models.CharField(max_length=150)),
                ("message", models.TextField()),
                ("year", models.PositiveIntegerField(blank=True, null=True)),
                ("month", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("sent_email", models.BooleanField(default=False)),
                ("sent_sms", models.BooleanField(default=False)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.UniqueConstraint(
                fields=("user", "notification_type", "year", "month"),
                name="unique_monthly_notification_per_user",
            ),
        ),
    ]
