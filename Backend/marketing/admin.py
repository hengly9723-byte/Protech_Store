from django.contrib import admin
from .models import (
    Review,
    DiscountCode,
    DiscountCodeProduct,
    DiscountCodeCategory,
    Promotion,
    PromotionProduct,
)


class DiscountCodeProductInline(admin.TabularInline):
    model = DiscountCodeProduct
    extra = 1


class DiscountCodeCategoryInline(admin.TabularInline):
    model = DiscountCodeCategory
    extra = 1


class PromotionProductInline(admin.TabularInline):
    model = PromotionProduct
    extra = 1


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'rating', 'title', 'is_verified_purchase', 'status', 'created_at')
    list_filter = ('rating', 'status', 'is_verified_purchase', 'created_at')
    search_fields = ('product__name', 'user__email', 'title', 'content')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(DiscountCode)
class DiscountCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'type', 'value', 'usage_count', 'usage_limit', 'is_active', 'expires_at')
    list_filter = ('type', 'is_active', 'created_at')
    search_fields = ('code',)
    inlines = [DiscountCodeProductInline, DiscountCodeCategoryInline]


@admin.register(Promotion)
class PromotionAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'is_active', 'starts_at', 'ends_at', 'created_at')
    list_filter = ('type', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    inlines = [PromotionProductInline]
