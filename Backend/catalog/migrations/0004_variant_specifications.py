from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0003_specificationoption'),
    ]

    operations = [
        migrations.AddField(
            model_name='productvariant',
            name='specifications',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
