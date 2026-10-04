import uuid
from django.db import models
from django.conf import settings


class Stock(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.OneToOneField(
        'catalog.ProductVariant',
        on_delete=models.CASCADE,
        related_name='stock',
        db_column='variant_id'
    )
    quantity_available = models.IntegerField(default=0)
    quantity_reserved = models.IntegerField(default=0)
    quantity_damaged = models.IntegerField(default=0)
    reorder_level = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stock'
        ordering = ['quantity_available']

    def __str__(self):
        return f"Stock for {self.variant.sku}: {self.quantity_available} available"

    @property
    def is_low_stock(self):
        return self.quantity_available <= self.reorder_level

    @property
    def in_stock(self):
        return self.quantity_available > 0


class StockTransaction(models.Model):
    TYPE_CHOICES = (
        ('restock', 'Restock'),
        ('sale', 'Sale'),
        ('damaged', 'Damaged'),
        ('adjustment', 'Adjustment'),
        ('return', 'Return'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.CASCADE,
        related_name='stock_transactions',
        db_column='variant_id'
    )
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    quantity = models.IntegerField(help_text="Delta quantity (+ for restock/returns, - for sales/damaged)")
    reference_type = models.CharField(max_length=50, blank=True, null=True)
    reference_id = models.UUIDField(blank=True, null=True)
    note = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_transactions',
        db_column='created_by'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.type.upper()} ({self.quantity:+d}) for {self.variant.sku} at {self.created_at.strftime('%Y-%m-%d %H:%M')}"
