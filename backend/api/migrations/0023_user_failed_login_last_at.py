from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0022_user_login_lock_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="failed_login_last_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
