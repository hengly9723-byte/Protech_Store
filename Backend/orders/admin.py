from django.contrib import admin
from .models import (
    Order,
    OrderItem,
    Payment,
    Refund,
    Shipment,
    Return,
    ReturnItem,
    ShippingConfig,
)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product_name_snapshot', 'sku_snapshot', 'unit_price', 'quantity', 'total')


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ('amount', 'status', 'gateway', 'transaction_id', 'paid_at')


class ShipmentInline(admin.TabularInline):
    model = Shipment
    extra = 0


class RefundInline(admin.TabularInline):
    model = Refund
    extra = 0


class ReturnItemInline(admin.TabularInline):
    model = ReturnItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'order_number',
        'user',
        'status',
        'payment_method',
        'payment_status',
        'fulfillment_status',
        'total',
        'created_at'
    )
    list_filter = ('status', 'payment_status', 'fulfillment_status', 'created_at')
    search_fields = ('order_number', 'user__email', 'guest_email')
    readonly_fields = ('order_number', 'created_at', 'updated_at')
    inlines = [OrderItemInline, PaymentInline, ShipmentInline, RefundInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'gateway', 'amount', 'currency', 'status', 'paid_at')
    list_filter = ('gateway', 'status', 'created_at')
    search_fields = ('order__order_number', 'transaction_id')


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'amount', 'status', 'processed_by', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('order__order_number', 'reason')


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'carrier', 'tracking_number', 'status', 'shipped_at')
    list_filter = ('carrier', 'status', 'shipped_at')
    search_fields = ('order__order_number', 'tracking_number')


@admin.register(Return)
class ReturnAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'user', 'status', 'resolution', 'created_at')
    list_filter = ('status', 'resolution', 'created_at')
    search_fields = ('order__order_number', 'user__email', 'reason')
    inlines = [ReturnItemInline]


@admin.register(ShippingConfig)
class ShippingConfigAdmin(admin.ModelAdmin):
    list_display = ('id', 'free_shipping_threshold', 'flat_rate', 'updated_at')
