from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="member",
            name="membership_number",
            field=models.CharField(
                max_length=16,
                unique=True,
                validators=[
                    django.core.validators.RegexValidator(
                        message="Membership number must be exactly 16 digits.",
                        regex="^\\d{16}$",
                    )
                ],
            ),
        ),
    ]
