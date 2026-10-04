from rest_framework import serializers
from .models import (
    Order,
    OrderItem,
    Payment,
    Refund,
    Shipment,
    Return,
    ReturnItem,
)
from accounts.serializers import AddressSerializer


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            'id',
            'product',
            'variant',
            'product_name_snapshot',
            'sku_snapshot',
            'variant_snapshot',
            'unit_price',
            'quantity',
            'discount',
            'tax',
            'total',
        ]
        read_only_fields = ['id']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class RefundSerializer(serializers.ModelSerializer):
    processed_by_email = serializers.CharField(source='processed_by.email', read_only=True)

    class Meta:
        model = Refund
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'processed_at']


class ShipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shipment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='order_item.product_name_snapshot', read_only=True)
    sku = serializers.CharField(source='order_item.sku_snapshot', read_only=True)

    class Meta:
        model = ReturnItem
        fields = [
            'id',
            'order_item',
            'product_name',
            'sku',
            'quantity',
            'condition',
            'note',
        ]
        read_only_fields = ['id']


class ReturnSerializer(serializers.ModelSerializer):
    items = ReturnItemSerializer(many=True, read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Return
        fields = [
            'id',
            'order',
            'user',
            'user_email',
            'status',
            'reason',
            'resolution',
            'items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class OrderListSerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'status',
            'payment_method',
            'payment_status',
            'fulfillment_status',
            'currency',
            'subtotal',
            'discount',
            'shipping_cost',
            'tax',
            'total',
            'items_count',
            'customer_email',
            'created_at',
            'updated_at',
        ]

    def get_items_count(self, obj):
        return sum(item.quantity for item in obj.items.all())

    def get_customer_email(self, obj):
        return obj.user.email if obj.user else obj.guest_email


class OrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    refunds = RefundSerializer(many=True, read_only=True)
    shipments = ShipmentSerializer(many=True, read_only=True)
    returns = ReturnSerializer(many=True, read_only=True)
    customer_email = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'status',
            'payment_method',
            'payment_status',
            'fulfillment_status',
            'currency',
            'subtotal',
            'discount',
            'shipping_cost',
            'tax',
            'total',
            'shipping_address_snapshot',
            'billing_address_snapshot',
            'guest_email',
            'customer_email',
            'items',
            'payments',
            'refunds',
            'shipments',
            'returns',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']

    def get_customer_email(self, obj):
        return obj.user.email if obj.user else obj.guest_email


class CheckoutSerializer(serializers.Serializer):
    shipping_address_id = serializers.UUIDField(required=False, allow_null=True)
    shipping_address = serializers.DictField(required=False, allow_null=True)
    billing_address = serializers.DictField(required=False, allow_null=True)
    guest_email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    gateway = serializers.CharField(required=False, default='bakong_khqr')
    discount_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.STATUS_CHOICES, required=False)
    fulfillment_status = serializers.ChoiceField(choices=Order.FULFILLMENT_STATUS_CHOICES, required=False)
    payment_status = serializers.ChoiceField(choices=Order.PAYMENT_STATUS_CHOICES, required=False)


class CreateRefundSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=True)
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class CreateShipmentSerializer(serializers.Serializer):
    carrier = serializers.CharField(max_length=100, required=False, allow_blank=True, default='Standard Courier')
    tracking_number = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    status = serializers.ChoiceField(choices=Shipment.STATUS_CHOICES, default='shipped')


class CreateReturnItemInputSerializer(serializers.Serializer):
    order_item_id = serializers.UUIDField(required=True)
    quantity = serializers.IntegerField(default=1, min_value=1)
    condition = serializers.CharField(max_length=30, required=False, default='unopened')
    note = serializers.CharField(required=False, allow_blank=True, default='')


class CreateReturnSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True)
    resolution = serializers.ChoiceField(choices=Return.RESOLUTION_CHOICES, default='refund')
    items = CreateReturnItemInputSerializer(many=True, required=True)
