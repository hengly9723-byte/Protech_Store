from rest_framework import serializers
from .models import Stock, StockTransaction
from catalog.models import ProductVariant


class StockSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    product_name = serializers.CharField(source='variant.product.name', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    in_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Stock
        fields = [
            'id',
            'variant',
            'variant_sku',
            'variant_name',
            'product_name',
            'quantity_available',
            'quantity_reserved',
            'quantity_damaged',
            'reorder_level',
            'is_low_stock',
            'in_stock',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']


class StockAdjustSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(
        required=True,
        help_text="Quantity delta to add/subtract (e.g. +50 for restock, -5 for damage/sale) or absolute value depending on type"
    )
    type = serializers.ChoiceField(
        choices=StockTransaction.TYPE_CHOICES,
        default='adjustment'
    )
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )
    reference_type = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )
    reference_id = serializers.UUIDField(
        required=False,
        allow_null=True
    )


class StockTransactionSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)

    class Meta:
        model = StockTransaction
        fields = [
            'id',
            'variant',
            'variant_sku',
            'variant_name',
            'type',
            'quantity',
            'reference_type',
            'reference_id',
            'note',
            'created_by',
            'created_by_email',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
