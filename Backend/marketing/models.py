import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Review(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.CASCADE,
        related_name='reviews',
        db_column='product_id'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviews',
        db_column='user_id'
    )
    order_item = models.ForeignKey(
        'orders.OrderItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviews',
        db_column='order_item_id'
    )
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    title = models.CharField(max_length=255, blank=True, null=True)
    content = models.TextField(blank=True, null=True)
    is_verified_purchase = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reviews'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.rating}★ Review for {self.product.name} by {self.user.email if self.user else 'Anonymous'}"


class DiscountCode(models.Model):
    TYPE_CHOICES = (
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    value = models.DecimalField(max_digits=12, decimal_places=2)
    minimum_order_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    maximum_discount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    usage_limit = models.IntegerField(null=True, blank=True)
    usage_count = models.IntegerField(default=0)
    per_customer_limit = models.IntegerField(null=True, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    products = models.ManyToManyField(
        'catalog.Product',
        through='DiscountCodeProduct',
        related_name='discount_codes',
        blank=True
    )
    categories = models.ManyToManyField(
        'catalog.Category',
        through='DiscountCodeCategory',
        related_name='discount_codes',
        blank=True
    )

    class Meta:
        db_table = 'discount_codes'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} ({self.type}: {self.value})"

    def calculate_discount(self, order_amount: Decimal) -> Decimal:
        """
        Calculates discount deduction against the given cart/order amount.
        """
        if self.type == 'percentage':
            discount = (order_amount * (self.value / Decimal('100.00'))).quantize(Decimal('0.01'))
            if self.maximum_discount:
                discount = min(discount, self.maximum_discount)
        else:  # fixed
            discount = min(self.value, order_amount)
        return max(Decimal('0.00'), discount)


class DiscountCodeProduct(models.Model):
    discount_code = models.ForeignKey(
        DiscountCode,
        on_delete=models.CASCADE,
        db_column='discount_code_id'
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.CASCADE,
        db_column='product_id'
    )

    class Meta:
        db_table = 'discount_code_products'
        unique_together = (('discount_code', 'product'),)


class DiscountCodeCategory(models.Model):
    discount_code = models.ForeignKey(
        DiscountCode,
        on_delete=models.CASCADE,
        db_column='discount_code_id'
    )
    category = models.ForeignKey(
        'catalog.Category',
        on_delete=models.CASCADE,
        db_column='category_id'
    )

    class Meta:
        db_table = 'discount_code_categories'
        unique_together = (('discount_code', 'category'),)


class Promotion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    type = models.CharField(max_length=30)
    banner_image_url = models.TextField(blank=True, null=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    products = models.ManyToManyField(
        'catalog.Product',
        through='PromotionProduct',
        related_name='promotions',
        blank=True
    )

    DISCOUNT_TYPE_CHOICES = (
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    )
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, default='percentage')
    discount_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    @property
    def bannerImageUrl(self):
        return self.banner_image_url

    @bannerImageUrl.setter
    def bannerImageUrl(self, value):
        self.banner_image_url = value

    @property
    def discountType(self):
        return self.discount_type

    @discountType.setter
    def discountType(self, value):
        self.discount_type = value

    @property
    def discountValue(self):
        return self.discount_value

    @discountValue.setter
    def discountValue(self, value):
        self.discount_value = value

    def calculate_promotional_price(self, price, compare_at_price=None):
        """
        Calculates promotional price using non-stacking baseline rule:
        - If compare_at_price exists and > 0, use it as baseline.
        - Otherwise, use price as baseline.
        - If discount_type == 'percentage': baseline * (1 - discount_value / 100)
        - If discount_type == 'fixed': max(0, baseline - discount_value)
        """
        raw_baseline = compare_at_price if (compare_at_price and Decimal(str(compare_at_price)) > 0) else price
        if raw_baseline is None:
            return Decimal('0.00')
        baseline = Decimal(str(raw_baseline))
        val = Decimal(str(self.discount_value or 0))

        if self.discount_type == 'percentage':
            discounted = baseline * (Decimal('1.00') - (val / Decimal('100.00')))
        else: # fixed
            discounted = max(Decimal('0.00'), baseline - val)

        return max(Decimal('0.00'), discounted.quantize(Decimal('0.01')))

    class Meta:
        db_table = 'promotions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.type})"


class PromotionProduct(models.Model):
    promotion = models.ForeignKey(
        Promotion,
        on_delete=models.CASCADE,
        db_column='promotion_id'
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.CASCADE,
        db_column='product_id'
    )

    class Meta:
        db_table = 'promotion_products'
        unique_together = (('promotion', 'product'),)
