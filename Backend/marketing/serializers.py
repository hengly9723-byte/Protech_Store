import base64
import os
import uuid
from django.conf import settings
from rest_framework import serializers
from .models import (
    Review,
    DiscountCode,
    DiscountCodeProduct,
    DiscountCodeCategory,
    Promotion,
    PromotionProduct,
)
from catalog.serializers import ProductListSerializer
from catalog.models import Product, Category


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id',
            'product',
            'product_name',
            'user',
            'user_name',
            'rating',
            'title',
            'content',
            'is_verified_purchase',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'is_verified_purchase', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        if not obj.user:
            return "Anonymous"
        return obj.user.full_name or obj.user.email.split('@')[0]


class CreateReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['rating', 'title', 'content']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be an integer between 1 and 5.")
        return value


class ReviewStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['status']


class DiscountCodeSerializer(serializers.ModelSerializer):
    product_ids = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        many=True,
        required=False,
        write_only=True,
        source='products'
    )
    category_ids = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        many=True,
        required=False,
        write_only=True,
        source='categories'
    )

    class Meta:
        model = DiscountCode
        fields = [
            'id',
            'code',
            'type',
            'value',
            'minimum_order_value',
            'maximum_discount',
            'usage_limit',
            'usage_count',
            'per_customer_limit',
            'starts_at',
            'expires_at',
            'is_active',
            'product_ids',
            'category_ids',
            'created_at',
        ]
        read_only_fields = ['id', 'usage_count', 'created_at']


class ValidateDiscountCodeSerializer(serializers.Serializer):
    code = serializers.CharField(required=True)
    cart_total = serializers.DecimalField(max_digits=12, decimal_places=2, required=True)


class PromotionSerializer(serializers.ModelSerializer):
    product_ids = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        many=True,
        required=False,
        write_only=True,
        source='products'
    )
    products = ProductListSerializer(many=True, read_only=True)
    featuredProducts = ProductListSerializer(many=True, read_only=True, source='products')
    products_count = serializers.SerializerMethodField()
    banner_image_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    bannerImageUrl = serializers.CharField(source='banner_image_url', required=False, allow_blank=True, allow_null=True)
    discount_type = serializers.ChoiceField(choices=Promotion.DISCOUNT_TYPE_CHOICES, required=False, default='percentage')
    discountType = serializers.CharField(source='discount_type', required=False)
    discount_value = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)
    discountValue = serializers.DecimalField(source='discount_value', max_digits=12, decimal_places=2, required=False)

    class Meta:
        model = Promotion
        fields = [
            'id',
            'name',
            'description',
            'type',
            'banner_image_url',
            'bannerImageUrl',
            'discount_type',
            'discountType',
            'discount_value',
            'discountValue',
            'starts_at',
            'ends_at',
            'is_active',
            'product_ids',
            'products',
            'featuredProducts',
            'products_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        # Support both camelCase and snake_case for bannerImageUrl, discountType, and discountValue
        data = data.copy() if hasattr(data, 'copy') else dict(data)

        # Resolve banner image URL from either camelCase or snake_case
        raw_banner = data.get('bannerImageUrl') or data.get('banner_image_url')
        if raw_banner and isinstance(raw_banner, str) and raw_banner.startswith('data:image/'):
            # Convert base64 data to image file on disk in media/banners/
            try:
                header, encoded = raw_banner.split(';base64,', 1)
                mime = header.split('data:image/')[1].lower()
                ext = '.jpg' if mime in ['jpeg', 'jpg'] else f".{mime.split('+')[0]}"
                b64_bytes = base64.b64decode(encoded)
                filename = f"banner_{uuid.uuid4().hex[:12]}{ext}"
                banners_dir = os.path.join(settings.MEDIA_ROOT, 'banners')
                os.makedirs(banners_dir, exist_ok=True)
                with open(os.path.join(banners_dir, filename), 'wb') as f:
                    f.write(b64_bytes)
                saved_url = f"http://127.0.0.1:8000{settings.MEDIA_URL}banners/{filename}"
                data['banner_image_url'] = saved_url
                data['bannerImageUrl'] = saved_url
            except Exception as e:
                data['banner_image_url'] = raw_banner
                data['bannerImageUrl'] = raw_banner
        elif raw_banner is not None:
            data['banner_image_url'] = raw_banner
            data['bannerImageUrl'] = raw_banner

        # Ensure discountType and discount_type are synced
        d_type = data.get('discountType') or data.get('discount_type') or 'percentage'
        data['discount_type'] = d_type
        data['discountType'] = d_type

        # Ensure discountValue and discount_value are synced
        d_val = data.get('discountValue') if data.get('discountValue') is not None else data.get('discount_value', 0)
        data['discount_value'] = d_val
        data['discountValue'] = d_val

        return super().to_internal_value(data)

    def get_products_count(self, obj):
        return obj.products.count()
