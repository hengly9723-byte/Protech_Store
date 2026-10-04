import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings


class Cart(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('converted', 'Converted'),
        ('abandoned', 'Abandoned'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='carts',
        db_column='user_id'
    )
    session_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    currency = models.CharField(max_length=10, default='USD')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'carts'
        ordering = ['-updated_at']

    def __str__(self):
        owner = self.user.email if self.user else f"Guest ({self.session_id})"
        return f"Cart {self.id} for {owner} ({self.status})"

    @property
    def total_items(self):
        return sum(item.quantity for item in self.items.all())

    @property
    def subtotal(self):
        return sum(item.line_total for item in self.items.all())


class CartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items',
        db_column='cart_id'
    )
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.CASCADE,
        related_name='cart_items',
        db_column='variant_id'
    )
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cart_items'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.quantity}x {self.variant.sku} @ ${self.unit_price}"

    @property
    def line_total(self):
        return Decimal(str(self.unit_price)) * Decimal(self.quantity)


class Wishlist(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wishlists',
        db_column='user_id'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wishlists'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user'], name='wishlist_user_idx'),
        ]

    def __str__(self):
        return f"Wishlist of {self.user.email}"


class WishlistItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wishlist = models.ForeignKey(
        Wishlist,
        on_delete=models.CASCADE,
        related_name='items',
        db_column='wishlist_id'
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.CASCADE,
        related_name='wishlist_entries',
        db_column='product_id'
    )
    variant = models.ForeignKey(
        'catalog.ProductVariant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='wishlist_items',
        db_column='variant_id'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wishlist_items'
        unique_together = (('wishlist', 'product', 'variant'),)
        indexes = [
            models.Index(fields=['wishlist', 'product'], name='wishlist_item_lookup_idx'),
            models.Index(fields=['wishlist', 'variant'], name='wishlist_item_variant_idx'),
            models.Index(fields=['wishlist', '-created_at'], name='wishlist_item_created_idx'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        desc = f"{self.variant.sku} - " if self.variant else ""
        return f"{desc}{self.product.name} in {self.wishlist}"
