import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings


class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('unpaid', 'Unpaid'),
        ('paid', 'Paid'),
        ('refunded', 'Refunded'),
        ('partially_refunded', 'Partially Refunded'),
    )

    PAYMENT_METHOD_CHOICES = (
        ('bakong_khqr', 'Bakong KHQR'),
    )

    FULFILLMENT_STATUS_CHOICES = (
        ('unfulfilled', 'Unfulfilled'),
        ('partially_fulfilled', 'Partially Fulfilled'),
        ('fulfilled', 'Fulfilled'),
        ('returned', 'Returned'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        db_column='user_id'
    )
    order_number = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_method = models.CharField(max_length=50, choices=PAYMENT_METHOD_CHOICES, default='bakong_khqr')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid')
    fulfillment_status = models.CharField(max_length=20, choices=FULFILLMENT_STATUS_CHOICES, default='unfulfilled')
    currency = models.CharField(max_length=10, default='USD')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_address_snapshot = models.JSONField(null=True, blank=True)
    billing_address_snapshot = models.JSONField(null=True, blank=True)
    guest_email = models.EmailField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']

    def __str__(self):
        return f"Order #{self.order_number} (${self.total}) - {self.status}"


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
        db_column='order_id'
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_items',
        db_column='product_id'
    )
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_items',
        db_column='variant_id'
    )
    product_name_snapshot = models.CharField(max_length=255)
    sku_snapshot = models.CharField(max_length=100, null=True, blank=True)
    variant_snapshot = models.JSONField(null=True, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.IntegerField()
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'order_items'
        ordering = ['product_name_snapshot']

    def __str__(self):
        return f"{self.quantity}x {self.product_name_snapshot} ({self.sku_snapshot})"


class Payment(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='payments',
        db_column='order_id'
    )
    gateway = models.CharField(max_length=50)
    transaction_id = models.CharField(max_length=255, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    gateway_response = models.JSONField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment {self.id} for Order #{self.order.order_number}: ${self.amount} ({self.status})"


class Refund(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='refunds',
        db_column='payment_id'
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='refunds',
        db_column='order_id'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_refunds',
        db_column='processed_by'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'refunds'
        ordering = ['-created_at']

    def __str__(self):
        return f"Refund ${self.amount} for Order #{self.order.order_number} ({self.status})"


class Shipment(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('returned', 'Returned'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='shipments',
        db_column='order_id'
    )
    carrier = models.CharField(max_length=100, null=True, blank=True)
    tracking_number = models.CharField(max_length=150, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shipments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Shipment #{self.tracking_number or self.id} ({self.status}) - {self.carrier or 'Courier'}"


class Return(models.Model):
    STATUS_CHOICES = (
        ('requested', 'Requested'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    )

    RESOLUTION_CHOICES = (
        ('refund', 'Refund'),
        ('replacement', 'Replacement'),
        ('store_credit', 'Store Credit'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='returns',
        db_column='order_id'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='returns',
        db_column='user_id'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    reason = models.TextField(null=True, blank=True)
    resolution = models.CharField(max_length=50, choices=RESOLUTION_CHOICES, default='refund')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'returns'
        ordering = ['-created_at']

    def __str__(self):
        return f"Return for Order #{self.order.order_number} ({self.status})"


class ReturnItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    return_request = models.ForeignKey(
        Return,
        on_delete=models.CASCADE,
        related_name='items',
        db_column='return_id'
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        related_name='return_items',
        db_column='order_item_id'
    )
    quantity = models.IntegerField()
    condition = models.CharField(max_length=30, null=True, blank=True)
    note = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'return_items'

    def __str__(self):
        return f"{self.quantity}x return of {self.order_item.product_name_snapshot}"


class ShippingConfig(models.Model):
    """
    Store-level shipping rules, editable from the Django admin panel.

    A single row (pk=1) holds the free-shipping threshold and the flat rate.
    """
    free_shipping_threshold = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('50.00'),
        help_text="Orders with a subtotal at or above this amount ship free.",
    )
    flat_rate = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('5.00'),
        help_text="Flat shipping rate charged on orders below the free-shipping threshold.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Shipping settings"
        verbose_name_plural = "Shipping settings"
        db_table = 'shipping_config'

    def __str__(self):
        return (
            f"Free shipping over {self.free_shipping_threshold} · "
            f"Flat rate {self.flat_rate}"
        )

    @classmethod
    def get_config(cls):
        """Return the singleton shipping config (creating the default row if needed)."""
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    def calculate_shipping(self, subtotal):
        """Return the shipping cost for a given subtotal."""
        if subtotal >= self.free_shipping_threshold:
            return Decimal('0.00')
        return self.flat_rate
