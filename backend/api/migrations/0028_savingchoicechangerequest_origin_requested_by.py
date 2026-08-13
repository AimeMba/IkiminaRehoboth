from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0027_memberprofitrequest_requested_by"),
    ]

    operations = [
        migrations.AddField(
            model_name="savingchoicechangerequest",
            name="request_origin",
            field=models.CharField(
                choices=[("SELF", "Self Requested"), ("ON_BEHALF", "Requested On Behalf")],
                default="SELF",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="savingchoicechangerequest",
            name="requested_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="created_saving_choice_change_requests",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
