from django.utils.text import slugify
from rest_framework import serializers
from .models import (
    Brand,
    ProductType,
    Category,
    Product,
    ProductVariant,
    ProductImage,
    SpecificationDefinition,
    SpecificationOption,
    ProductSpecification,
)


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductType
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id',
            'parent',
            'name',
            'slug',
            'description',
            'image_url',
            'is_active',
            'sort_order',
            'children',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
        }

    def validate_slug(self, value):
        if value:
            return slugify(value)
        return value

    def validate(self, attrs):
        if not attrs.get('slug') and attrs.get('name'):
            attrs['slug'] = slugify(attrs['name'])
        elif attrs.get('slug'):
            attrs['slug'] = slugify(attrs['slug'])
        return attrs

    def get_children(self, obj):
        children = obj.children.filter(is_active=True)
        return CategorySerializer(children, many=True).data


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = [
            'id',
            'product',
            'variant',
            'image_url',
            'alt_text',
            'sort_order',
            'is_primary',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ProductVariantSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            'id',
            'product',
            'product_name',
            'product_slug',
            'sku',
            'barcode',
            'name',
            'price',
            'cost_price',
            'compare_at_price',
            'weight',
            'status',
            'specifications',
            'images',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CatalogVariantListSerializer(serializers.ModelSerializer):
    product_id = serializers.UUIDField(source='product.id', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    brand = BrandSerializer(source='product.brand', read_only=True)
    brand_name = serializers.CharField(source='product.brand.name', read_only=True)
    category = CategorySerializer(source='product.category', read_only=True)
    category_name = serializers.CharField(source='product.category.name', read_only=True)
    type_name = serializers.CharField(source='product.type.name', read_only=True)
    is_featured = serializers.BooleanField(source='product.is_featured', read_only=True)
    primary_image = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    effective_compare_at_price = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            'id',
            'product_id',
            'product_name',
            'product_slug',
            'sku',
            'barcode',
            'name',
            'price',
            'cost_price',
            'compare_at_price',
            'effective_compare_at_price',
            'weight',
            'status',
            'specifications',
            'brand',
            'brand_name',
            'category',
            'category_name',
            'type_name',
            'is_featured',
            'primary_image',
            'images',
            'created_at',
            'updated_at',
        ]

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or obj.images.first()
        if not img and obj.product:
            img = obj.product.images.filter(is_primary=True).first() or obj.product.images.first()
        return ProductImageSerializer(img).data if img else None

    def get_images(self, obj):
        imgs = list(obj.images.all())
        if not imgs and obj.product:
            imgs = list(obj.product.images.all())
        return ProductImageSerializer(imgs, many=True).data

    def get_effective_compare_at_price(self, obj):
        return obj.compare_at_price or (obj.product.compare_at_price if obj.product else None)



class SpecificationOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpecificationOption
        fields = ['id', 'definition', 'label', 'sort_order']
        read_only_fields = ['id']


class SpecificationDefinitionSerializer(serializers.ModelSerializer):
    options = SpecificationOptionSerializer(many=True, read_only=True)

    class Meta:
        model = SpecificationDefinition
        fields = '__all__'
        read_only_fields = ['id']


class ProductSpecificationSerializer(serializers.ModelSerializer):
    specification_name = serializers.CharField(source='specification.name', read_only=True)
    unit = serializers.CharField(source='specification.unit', read_only=True)
    data_type = serializers.CharField(source='specification.data_type', read_only=True)

    class Meta:
        model = ProductSpecification
        fields = [
            'id',
            'product',
            'specification',
            'specification_name',
            'unit',
            'data_type',
            'value_text',
            'value_number',
            'value_boolean',
        ]
        read_only_fields = ['id']


class ProductListSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    type_name = serializers.CharField(source='type.name', read_only=True)
    primary_image = serializers.SerializerMethodField()
    variants_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'slug',
            'sku',
            'short_description',
            'base_price',
            'compare_at_price',
            'currency',
            'status',
            'is_featured',
            'is_active',
            'brand',
            'brand_name',
            'category',
            'category_name',
            'type',
            'type_name',
            'primary_image',
            'variants_count',
            'created_at',
            'updated_at',
        ]

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or obj.images.first()
        return ProductImageSerializer(img).data if img else None

    def get_variants_count(self, obj):
        return obj.variants.count()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Pure-variant architecture: variant table is the single source of truth for pricing and SKU
        if hasattr(instance, 'effective_price') and instance.effective_price is not None:
            data['base_price'] = str(instance.effective_price)
        else:
            active_min = instance.variants.filter(status='active').order_by('price').first() or instance.variants.order_by('price').first()
            if active_min and active_min.price is not None:
                data['base_price'] = str(active_min.price)

        if hasattr(instance, 'effective_compare_price') and instance.effective_compare_price is not None:
            data['compare_at_price'] = str(instance.effective_compare_price)
        else:
            active_first = instance.variants.filter(status='active').order_by('price').first() or instance.variants.order_by('price').first()
            if active_first and active_first.compare_at_price is not None:
                data['compare_at_price'] = str(active_first.compare_at_price)

        if hasattr(instance, 'effective_sku') and instance.effective_sku:
            data['sku'] = instance.effective_sku
        elif not data.get('sku'):
            first_v = instance.variants.first()
            if first_v and first_v.sku:
                data['sku'] = first_v.sku

        return data


class ProductDetailSerializer(serializers.ModelSerializer):
    brand = BrandSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    type = ProductTypeSerializer(read_only=True)
    variants = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True, read_only=True)
    specifications = ProductSpecificationSerializer(many=True, read_only=True)

    def get_variants(self, obj):
        qs = obj.variants.all()
        if not qs.exists():
            obj.ensure_default_variant()
            qs = obj.variants.all()
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not (user and (user.is_staff or user.is_superuser)):
            qs = qs.filter(status='active')
        return ProductVariantSerializer(qs, many=True).data

    # Optional so the admin UI can leave it blank and have it auto-generated
    # from the product name (with a uniqueness suffix when the slug collides).
    slug = serializers.SlugField(max_length=255, required=False, allow_blank=True)

    # Write-only ID fields for mutation
    brand_id = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(),
        source='brand',
        write_only=True,
        required=False,
        allow_null=True
    )
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True,
        required=False,
        allow_null=True
    )
    type_id = serializers.PrimaryKeyRelatedField(
        queryset=ProductType.objects.all(),
        source='type',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'slug',
            'sku',
            'short_description',
            'description',
            'cost_price',
            'base_price',
            'compare_at_price',
            'currency',
            'warranty_months',
            'status',
            'is_featured',
            'is_active',
            'weight',
            'brand',
            'brand_id',
            'category',
            'category_id',
            'type',
            'type_id',
            'variants',
            'images',
            'specifications',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'base_price': {'required': False, 'allow_null': True},
            'cost_price': {'required': False, 'allow_null': True},
            'compare_at_price': {'required': False, 'allow_null': True},
            'sku': {'required': False, 'allow_null': True, 'allow_blank': True},
            'weight': {'required': False, 'allow_null': True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Pure-variant architecture: fallback to variant table as single source of truth
        variants = list(instance.variants.all())
        active_vars = [v for v in variants if v.status == 'active']
        target_var = min(active_vars, key=lambda v: v.price) if active_vars else (min(variants, key=lambda v: v.price) if variants else None)
        if target_var:
            data['base_price'] = str(target_var.price)
            if target_var.compare_at_price is not None:
                data['compare_at_price'] = str(target_var.compare_at_price)
            if target_var.cost_price is not None:
                data['cost_price'] = str(target_var.cost_price)
            if target_var.weight is not None:
                data['weight'] = str(target_var.weight)
            if target_var.sku:
                data['sku'] = target_var.sku
        return data

    @staticmethod
    def _ensure_unique_slug(slug, name, exclude=None):
        base = (slug or slugify(name) or 'product')[:255]
        candidate = base
        qs = Product.objects.all()
        if exclude:
            qs = qs.exclude(pk=exclude.pk)
        n = 1
        while qs.filter(slug=candidate).exists():
            n += 1
            suffix = f'-{n}'
            candidate = f'{base[:255 - len(suffix)]}{suffix}'
        return candidate

    def create(self, validated_data):
        validated_data['slug'] = self._ensure_unique_slug(
            validated_data.get('slug'),
            validated_data.get('name', 'product')
        )
        product = super().create(validated_data)
        product.ensure_default_variant()
        return product

    def update(self, instance, validated_data):
        slug = validated_data.get('slug')
        if slug:
            validated_data['slug'] = self._ensure_unique_slug(slug, instance.name, exclude=instance)
        else:
            validated_data.pop('slug', None)
        return super().update(instance, validated_data)

