# Generated migration for Product model update

from django.db import migrations, models
import django.core.validators
from decimal import Decimal


def migrate_product_data(apps, schema_editor):
    """Migrate data from old fields to new fields"""
    Product = apps.get_model('supplements', 'Product')
    for product in Product.objects.all():
        # Migrate name to product_name
        if hasattr(product, 'name') and product.name:
            product.product_name = product.name
        # Migrate category to product_type
        if hasattr(product, 'category') and product.category:
            product.product_type = product.category
        product.save()


class Migration(migrations.Migration):

    dependencies = [
        ('supplements', '0002_supplier_webpage'),
    ]

    operations = [
        # Add new fields as nullable first
        migrations.AddField(
            model_name='product',
            name='product_type',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='product',
            name='product_name',
            field=models.CharField(max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='product',
            name='url',
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name='product',
            name='amount_per_serving',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='product',
            name='serving_size',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='product',
            name='units_per_container',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal('0'))]
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='weight_g',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal('0'))]
            ),
        ),
        # Migrate data from old fields to new fields
        migrations.RunPython(migrate_product_data, migrations.RunPython.noop),
        # Make product_name non-nullable
        migrations.AlterField(
            model_name='product',
            name='product_name',
            field=models.CharField(max_length=200),
        ),
        # Remove old fields
        migrations.RemoveField(
            model_name='product',
            name='name',
        ),
        migrations.RemoveField(
            model_name='product',
            name='sku',
        ),
        migrations.RemoveField(
            model_name='product',
            name='category',
        ),
        # Update Meta ordering
        migrations.AlterModelOptions(
            name='product',
            options={'ordering': ['product_name']},
        ),
        # Update related model ordering
        migrations.AlterModelOptions(
            name='purchaseitem',
            options={'ordering': ['product__product_name']},
        ),
        migrations.AlterModelOptions(
            name='saleitem',
            options={'ordering': ['product__product_name']},
        ),
    ]
