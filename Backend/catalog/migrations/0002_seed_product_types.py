from django.db import migrations


def seed_product_types(apps, schema_editor):
    ProductType = apps.get_model('catalog', 'ProductType')
    defaults = [
        {
            'name': 'Physical',
            'requires_shipping': True,
            'requires_stock': True,
            'description': 'Ships to the customer and tracked in stock, e.g. phones, laptops, accessories'
        },
        {
            'name': 'Digital',
            'requires_shipping': False,
            'requires_stock': False,
            'description': 'Delivered electronically, e.g. software license, e-book'
        },
        {
            'name': 'Service',
            'requires_shipping': False,
            'requires_stock': False,
            'description': 'A service rendered rather than a shipped item, e.g. installation, repair, warranty'
        },
    ]
    for item in defaults:
        ProductType.objects.get_or_create(name=item['name'], defaults=item)


def rollback_product_types(apps, schema_editor):
    ProductType = apps.get_model('catalog', 'ProductType')
    ProductType.objects.filter(name__in=['Physical', 'Digital', 'Service']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_product_types, rollback_product_types),
    ]
