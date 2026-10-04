from django.contrib import admin
from .models import (
    Brand,
    ProductType,
    Category,
    Product,
    ProductVariant,
    ProductImage,
    SpecificationDefinition,
    ProductSpecification,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1


class ProductSpecificationInline(admin.TabularInline):
    model = ProductSpecification
    extra = 1


class SpecificationDefinitionInline(admin.TabularInline):
    model = SpecificationDefinition
    extra = 1


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(ProductType)
class ProductTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'requires_shipping', 'requires_stock', 'created_at')
    list_filter = ('requires_shipping', 'requires_stock')
    search_fields = ('name', 'description')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'parent', 'is_active', 'sort_order', 'created_at')
    list_filter = ('is_active', 'parent')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [SpecificationDefinitionInline]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'display_sku',
        'category',
        'brand',
        'type',
        'display_price',
        'status',
        'is_featured',
        'is_active',
        'created_at'
    )
    list_filter = ('status', 'is_featured', 'is_active', 'category', 'brand', 'type')
    search_fields = ('name', 'sku', 'variants__sku', 'description', 'short_description')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductVariantInline, ProductImageInline, ProductSpecificationInline]

    @admin.display(description='SKU')
    def display_sku(self, obj):
        if obj.sku:
            return obj.sku
        v = obj.variants.first()
        return v.sku if v else '—'

    @admin.display(description='Base Price')
    def display_price(self, obj):
        v = obj.variants.filter(status='active').order_by('price').first() or obj.variants.order_by('price').first()
        if v and v.price is not None:
            return f"${v.price}"
        return f"${obj.base_price}" if obj.base_price is not None else '—'


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ('sku', 'product', 'name', 'price', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('sku', 'barcode', 'name', 'product__name')


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ('product', 'variant', 'is_primary', 'sort_order', 'created_at')
    list_filter = ('is_primary',)
    search_fields = ('product__name', 'alt_text')


@admin.register(SpecificationDefinition)
class SpecificationDefinitionAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'data_type', 'unit', 'is_filterable', 'is_required')
    list_filter = ('data_type', 'is_filterable', 'is_required', 'category')
    search_fields = ('name', 'category__name')


@admin.register(ProductSpecification)
class ProductSpecificationAdmin(admin.ModelAdmin):
    list_display = ('product', 'specification', 'value_text', 'value_number', 'value_boolean')
    list_filter = ('specification__category', 'specification')
    search_fields = ('product__name', 'specification__name')
