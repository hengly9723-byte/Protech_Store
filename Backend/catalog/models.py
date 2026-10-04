import uuid
import random
from django.db import models
from django.utils.text import slugify


class Brand(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)
    logo_url = models.CharField(max_length=500, blank=True, null=True)
    website_url = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'brands'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class ProductType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    requires_shipping = models.BooleanField(default=True)
    requires_stock = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_types'
        ordering = ['name']

    def __str__(self):
        return self.name


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        db_column='parent_id'
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)
    image_url = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'categories'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Product(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('archived', 'Archived'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brand = models.ForeignKey(
        Brand,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        db_column='brand_id'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        db_column='category_id'
    )
    type = models.ForeignKey(
        ProductType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        db_column='type_id'
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    sku = models.CharField(max_length=100, unique=True, null=True, blank=True)
    short_description = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    base_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    compare_at_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    CURRENCY_CHOICES = (
        ('USD', 'USD'),
        ('KHR', 'KHR'),
    )
    currency = models.CharField(max_length=10, choices=CURRENCY_CHOICES, default='USD')
    warranty_months = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    weight = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def ensure_default_variant(self):
        """
        Pure-variant architecture: ensure at least one default variant exists
        to hold transactional pricing, SKU, and physical specs.
        """
        if not self.variants.exists():
            from decimal import Decimal
            sku_candidate = self.sku
            variant_model = self.variants.model
            if not sku_candidate or variant_model.objects.filter(sku=sku_candidate).exists():
                prefix = slugify(self.name)[:20].upper().replace('-', '') or 'PROD'
                sku_candidate = f"{prefix}-DEF-{uuid.uuid4().hex[:6].upper()}"

            variant_price = self.base_price if self.base_price is not None else Decimal('0.00')
            return variant_model.objects.create(
                product=self,
                sku=sku_candidate,
                name="Default",
                price=variant_price,
                cost_price=self.cost_price,
                compare_at_price=self.compare_at_price,
                weight=self.weight,
                status='active'
            )
        return None


def generate_ean13_barcode():
    """
    Generate a valid 13-digit EAN-13 barcode with internal store prefix (200)
    and standard GS1 modulo-10 check digit.
    """
    prefix = "200"
    middle = f"{random.randint(100000000, 999999999)}"
    base12 = f"{prefix}{middle}"
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(base12))
    check = (10 - (total % 10)) % 10
    return f"{base12}{check}"


class ProductVariant(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('archived', 'Archived'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='variants',
        db_column='product_id'
    )
    sku = models.CharField(max_length=100, unique=True)
    barcode = models.CharField(max_length=100, blank=True, null=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    compare_at_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    weight = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    specifications = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_variants'
        ordering = ['name', 'price']

    def __str__(self):
        return f"{self.product.name} - {self.name or self.sku}"

    def save(self, *args, **kwargs):
        if not self.barcode or not str(self.barcode).strip():
            for _ in range(50):
                candidate = generate_ean13_barcode()
                if not ProductVariant.objects.filter(barcode=candidate).exclude(pk=self.pk).exists():
                    self.barcode = candidate
                    break
        else:
            self.barcode = str(self.barcode).strip()
        super().save(*args, **kwargs)


class ProductImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='images',
        db_column='product_id'
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='images',
        db_column='variant_id'
    )
    image_url = models.CharField(max_length=500)
    alt_text = models.CharField(max_length=255, blank=True, null=True)
    sort_order = models.IntegerField(default=0)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_images'
        ordering = ['sort_order', 'created_at']

    def __str__(self):
        return f"Image for {self.product.name} ({self.id})"

    def save(self, *args, **kwargs):
        if self.is_primary:
            ProductImage.objects.filter(product=self.product, is_primary=True).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)


class SpecificationDefinition(models.Model):
    DATA_TYPE_CHOICES = (
        ('text', 'Text'),
        ('number', 'Number'),
        ('boolean', 'Boolean'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='specification_definitions',
        db_column='category_id'
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150)
    data_type = models.CharField(max_length=20, choices=DATA_TYPE_CHOICES, default='text')
    unit = models.CharField(max_length=30, blank=True, null=True)
    is_filterable = models.BooleanField(default=False)
    is_required = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'specification_definitions'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.name} ({self.category.name})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class SpecificationOption(models.Model):
    """A pre-defined selectable value for a SpecificationDefinition.

    E.g. definition='Graphics', label='NVIDIA GeForce RTX 5060 Ti'.
    Admins curate these in the Specifications management page and they
    populate the dropdown on the product-edit form.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    definition = models.ForeignKey(
        SpecificationDefinition,
        on_delete=models.CASCADE,
        related_name='options',
        db_column='definition_id'
    )
    label = models.CharField(max_length=200)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'specification_options'
        ordering = ['sort_order', 'label']

    def __str__(self):
        return f"{self.definition.name}: {self.label}"


class ProductSpecification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='specifications',
        db_column='product_id'
    )
    specification = models.ForeignKey(
        SpecificationDefinition,
        on_delete=models.CASCADE,
        related_name='product_values',
        db_column='specification_id'
    )
    value_text = models.TextField(blank=True, null=True)
    value_number = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    value_boolean = models.BooleanField(null=True, blank=True)

    class Meta:
        db_table = 'product_specifications'

    def __str__(self):
        val = self.value_text or self.value_number or self.value_boolean or ''
        return f"{self.product.name} - {self.specification.name}: {val}"


from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=Product)
def auto_generate_default_product_variant(sender, instance, created, **kwargs):
    if created and not instance.variants.exists():
        instance.ensure_default_variant()

