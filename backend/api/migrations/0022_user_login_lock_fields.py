from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0021_savingchoicechangerequest"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="failed_login_attempts",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="user",
            name="locked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="locked_by_system",
            field=models.BooleanField(default=False),
        ),
    ]
