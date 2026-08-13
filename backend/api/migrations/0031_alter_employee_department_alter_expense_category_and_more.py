from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0030_staffaccountholderhistory"),
    ]

    operations = [
        migrations.AlterField(
            model_name="employee",
            name="department",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="api.department"),
        ),
        migrations.AlterField(
            model_name="expense",
            name="category",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="api.expensecategory"),
        ),
        migrations.AlterField(
            model_name="income",
            name="category",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="api.incomecategory"),
        ),
        migrations.AlterField(
            model_name="membersavingchoice",
            name="category",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="member_choices",
                to="api.savingcategory",
            ),
        ),
        migrations.AlterField(
            model_name="monthlysaving",
            name="saving_choice",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="monthly_savings",
                to="api.membersavingchoice",
            ),
        ),
        migrations.AlterField(
            model_name="salarypayment",
            name="employee",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="api.employee"),
        ),
    ]
