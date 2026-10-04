from decimal import Decimal
from rest_framework import serializers
from .models import Cart, CartItem, Wishlist, WishlistItem
from catalog.models import ProductVariant, Product, ProductImage
from stock.models import Stock


class CartItemSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    product_id = serializers.UUIDField(source='variant.product.id', read_only=True)
    product_name = serializers.CharField(source='variant.product.name', read_only=True)
    product_slug = serializers.CharField(source='variant.product.slug', read_only=True)
    product_image = serializers.SerializerMethodField()
    available_stock = serializers.SerializerMethodField()
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    original_price = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()
    discount_badge = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            'id',
            'variant',
            'variant_sku',
            'variant_name',
            'product_id',
            'product_name',
            'product_slug',
            'product_image',
            'unit_price',
            'original_price',
            'has_discount',
            'discount_badge',
            'quantity',
            'line_total',
            'available_stock',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'unit_price', 'created_at', 'updated_at']

    def get_product_image(self, obj):
        img = obj.variant.images.first() or obj.variant.product.images.filter(is_primary=True).first() or obj.variant.product.images.first()
        return img.image_url if img else None

    def get_available_stock(self, obj):
        stock = getattr(obj.variant, 'stock', None)
        return stock.quantity_available if stock else 0

    def get_original_price(self, obj):
        variant = obj.variant
        raw_compare = variant.compare_at_price or (variant.product.compare_at_price if getattr(variant, 'product', None) else None)
        baseline = raw_compare if (raw_compare and Decimal(str(raw_compare)) > 0) else variant.price
        return str(baseline)

    def get_has_discount(self, obj):
        orig = Decimal(self.get_original_price(obj))
        return obj.unit_price < orig

    def get_discount_badge(self, obj):
        orig = Decimal(self.get_original_price(obj))
        if orig > obj.unit_price and orig > 0:
            pct = round(((orig - obj.unit_price) / orig) * 100)
            return f"-{pct}% OFF"
        return ""


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_items = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Cart
        fields = [
            'id',
            'user',
            'session_id',
            'status',
            'currency',
            'total_items',
            'subtotal',
            'items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'session_id', 'created_at', 'updated_at']


class AddToCartSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField(required=True)
    quantity = serializers.IntegerField(default=1, min_value=1)

    def validate(self, attrs):
        variant_id = attrs.get('variant_id')
        quantity = attrs.get('quantity', 1)

        try:
            variant = ProductVariant.objects.select_related('product', 'stock').get(id=variant_id)
        except ProductVariant.DoesNotExist:
            raise serializers.ValidationError({"variant_id": "Product variant not found."})

        if not variant.product.is_active or variant.status != 'active':
            raise serializers.ValidationError({"variant_id": "This product variant is currently unavailable."})

        stock = getattr(variant, 'stock', None)
        available = stock.quantity_available if stock else 0
        if available < quantity:
            raise serializers.ValidationError({
                "quantity": f"Insufficient stock. Only {available} items available for {variant.sku}."
            })

        attrs['variant'] = variant
        return attrs


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(required=True, min_value=1)


class WishlistItemSerializer(serializers.ModelSerializer):
    variant_id = serializers.UUIDField(source='variant.id', read_only=True, allow_null=True)
    variant_sku = serializers.CharField(source='variant.sku', read_only=True, allow_null=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True, allow_null=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    base_price = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = WishlistItem
        fields = [
            'id',
            'product',
            'product_name',
            'product_slug',
            'variant',
            'variant_id',
            'variant_sku',
            'variant_name',
            'base_price',
            'primary_image',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_base_price(self, obj):
        if obj.variant and obj.variant.price is not None:
            return obj.variant.price
        if obj.product:
            min_v = obj.product.variants.filter(status='active').order_by('price').first() or obj.product.variants.order_by('price').first()
            if min_v and min_v.price is not None:
                return min_v.price
            return obj.product.base_price
        return None

    def get_primary_image(self, obj):
        # 1. Prefer variant image if available
        if obj.variant:
            images = list(obj.variant.images.all()) if hasattr(obj.variant, 'images') else []
            primary = next((img for img in images if getattr(img, 'is_primary', False)), None)
            img = primary or (images[0] if images else None)
            if img:
                return img.image_url

        # 2. Fall back to parent product image
        if obj.product:
            images = list(obj.product.images.all()) if hasattr(obj.product, 'images') else []
            primary = next((img for img in images if getattr(img, 'is_primary', False)), None)
            img = primary or (images[0] if images else None)
            if img:
                return img.image_url

        return None


class WishlistSerializer(serializers.ModelSerializer):
    items = WishlistItemSerializer(many=True, read_only=True)
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = Wishlist
        fields = [
            'id',
            'user',
            'total_items',
            'items',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'created_at']

    def get_total_items(self, obj):
        # Leverage prefetched cache to avoid COUNT(*) query if items are already loaded
        if hasattr(obj, '_prefetched_objects_cache') and 'items' in obj._prefetched_objects_cache:
            return len(obj.items.all())
        return obj.items.count()


class AddToWishlistSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=False, allow_null=True)
    variant_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        product_id = attrs.get('product_id')
        variant_id = attrs.get('variant_id')

        if not product_id and not variant_id:
            raise serializers.ValidationError("Either product_id or variant_id must be provided.")

        target_variant = None
        target_product = None

        if variant_id:
            target_variant = ProductVariant.objects.select_related('product').filter(id=variant_id, status='active').first()
            if not target_variant:
                raise serializers.ValidationError({"variant_id": "Product variant not found or inactive."})
            target_product = target_variant.product
        elif product_id:
            target_variant = ProductVariant.objects.select_related('product').filter(id=product_id, status='active').first()
            if target_variant:
                target_product = target_variant.product
            else:
                target_product = Product.objects.filter(id=product_id, is_active=True).first()
                if not target_product:
                    raise serializers.ValidationError({"product_id": "Product not found or inactive."})

        attrs['resolved_product'] = target_product
        attrs['resolved_variant'] = target_variant
        return attrs


class WishlistToggleSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=False, allow_null=True)
    variant_id = serializers.UUIDField(required=False, allow_null=True)
    desired_state = serializers.BooleanField(required=False, allow_null=True, default=None)

    def validate(self, attrs):
        product_id = attrs.get('product_id')
        variant_id = attrs.get('variant_id')

        if not product_id and not variant_id:
            raise serializers.ValidationError("Either product_id or variant_id must be provided.")

        target_variant = None
        target_product = None

        if variant_id:
            target_variant = ProductVariant.objects.select_related('product').filter(id=variant_id, status='active').first()
            if not target_variant:
                raise serializers.ValidationError({"variant_id": "Product variant not found or inactive."})
            target_product = target_variant.product
        elif product_id:
            target_variant = ProductVariant.objects.select_related('product').filter(id=product_id, status='active').first()
            if target_variant:
                target_product = target_variant.product
            else:
                target_product = Product.objects.filter(id=product_id, is_active=True).first()
                if not target_product:
                    raise serializers.ValidationError({"product_id": "Product not found or inactive."})

        attrs['resolved_product'] = target_product
        attrs['resolved_variant'] = target_variant
        return attrs
