from django.contrib import admin
from .models import Stock, StockTransaction


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = (
        'variant',
        'quantity_available',
        'quantity_reserved',
        'quantity_damaged',
        'reorder_level',
        'is_low_stock',
        'updated_at'
    )
    list_filter = ('reorder_level', 'updated_at')
    search_fields = ('variant__sku', 'variant__name', 'variant__product__name')
    readonly_fields = ('updated_at',)


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'variant',
        'type',
        'quantity',
        'reference_type',
        'created_by',
        'created_at'
    )
    list_filter = ('type', 'created_at')
    search_fields = ('variant__sku', 'reference_type', 'note', 'created_by__email')
    readonly_fields = ('created_at',)
