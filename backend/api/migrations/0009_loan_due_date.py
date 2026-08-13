from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0008_notification"),
    ]

    operations = [
        migrations.AddField(
            model_name="loan",
            name="due_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
