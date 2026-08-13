from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_loan_request_origin_tracking"),
    ]

    operations = [
        migrations.RenameField(
            model_name="member",
            old_name="membership_number",
            new_name="national_id",
        ),
        migrations.AlterField(
            model_name="member",
            name="national_id",
            field=models.CharField(
                max_length=16,
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
