from django.core.validators import RegexValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0018_loan_term_days"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="external_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="employee",
            name="external_full_name",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddField(
            model_name="employee",
            name="external_national_id",
            field=models.CharField(
                blank=True,
                default="",
                max_length=16,
                validators=[
                    RegexValidator(
                        message="External National ID must be exactly 16 digits.",
                        regex="^\\d{16}$",
                    )
                ],
            ),
        ),
        migrations.AddField(
            model_name="employee",
            name="external_phone",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
    ]
