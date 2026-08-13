from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0013_rename_member_membership_number_to_national_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="fine",
            name="is_waived",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="fine",
            name="waived_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="waived_fines",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="fine",
            name="waived_on",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="fine",
            name="waiver_reason",
            field=models.TextField(blank=True, default=""),
        ),
    ]
