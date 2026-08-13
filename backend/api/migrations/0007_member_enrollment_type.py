from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_membercertificateapproval"),
    ]

    operations = [
        migrations.AddField(
            model_name="member",
            name="enrollment_type",
            field=models.CharField(
                choices=[("NEW", "New"), ("FOUNDER", "Founder")],
                default="NEW",
                max_length=10,
            ),
        ),
    ]
