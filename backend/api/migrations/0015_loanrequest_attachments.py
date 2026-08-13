from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0014_fine_waiver_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanrequest",
            name="application_form",
            field=models.FileField(blank=True, null=True, upload_to="loan_requests/forms/"),
        ),
        migrations.AddField(
            model_name="loanrequest",
            name="guarantee_cheque",
            field=models.FileField(blank=True, null=True, upload_to="loan_requests/guarantee_cheques/"),
        ),
        migrations.AddField(
            model_name="loanrequest",
            name="id_copy",
            field=models.FileField(blank=True, null=True, upload_to="loan_requests/id_copies/"),
        ),
    ]
