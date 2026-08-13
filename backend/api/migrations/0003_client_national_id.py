from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0002_alter_member_membership_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="national_id",
            field=models.CharField(
                blank=True,
                max_length=16,
                null=True,
                unique=True,
                validators=[
                    django.core.validators.RegexValidator(
                        message="National ID must be exactly 16 digits.",
                        regex="^\\d{16}$",
                    )
                ],
            ),
        ),
    ]
