import uuid
from django.db import models
from django.db.models import Q, OuterRef, Subquery, F, DecimalField
from django.db.models.functions import Coalesce
from django.utils.text import slugify
from rest_framework import viewsets, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.response import Response


def is_valid_uuid(val):
    if not val:
        return False
    try:
        uuid.UUID(str(val).strip())
        return True
    except (ValueError, TypeError, AttributeError):
        return False


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
    generate_ean13_barcode,
)
from .serializers import (
    BrandSerializer,
    ProductTypeSerializer,
    CategorySerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    ProductVariantSerializer,
    CatalogVariantListSerializer,
    ProductImageSerializer,
    SpecificationDefinitionSerializer,
    SpecificationOptionSerializer,
    ProductSpecificationSerializer,
)
from .permissions import IsAdminOrReadOnly


class StandardCatalogPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = 'id'

    def get_queryset(self):
        qs = super().get_queryset()
        # Non-staff users only see active brands
        if not (self.request.user and (self.request.user.is_staff or self.request.user.is_superuser)):
            qs = qs.filter(is_active=True)
        return qs


class ProductTypeViewSet(viewsets.ModelViewSet):
    queryset = ProductType.objects.all()
    serializer_class = ProductTypeSerializer
    permission_classes = [IsAdminOrReadOnly]


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        # Non-staff users only see active categories
        if not (self.request.user and (self.request.user.is_staff or self.request.user.is_superuser)):
            qs = qs.filter(is_active=True)
        # By default for list, return top-level root categories (parents)
        if self.action == 'list' and self.request.query_params.get('all_flat') != 'true':
            qs = qs.filter(parent__isnull=True)
        return qs


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = StandardCatalogPagination
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.action == 'list':
            return ProductListSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        active_min_price = Subquery(
            ProductVariant.objects.filter(
                product=OuterRef('pk'),
                status='active'
            ).order_by('price').values('price')[:1]
        )
        any_min_price = Subquery(
            ProductVariant.objects.filter(
                product=OuterRef('pk')
            ).order_by('price').values('price')[:1]
        )
        active_sku = Subquery(
            ProductVariant.objects.filter(
                product=OuterRef('pk'),
                status='active'
            ).order_by('price').values('sku')[:1]
        )
        any_sku = Subquery(
            ProductVariant.objects.filter(
                product=OuterRef('pk')
            ).order_by('price').values('sku')[:1]
        )
        active_compare_price = Subquery(
            ProductVariant.objects.filter(
                product=OuterRef('pk'),
                status='active'
            ).order_by('price').values('compare_at_price')[:1]
        )
        any_compare_price = Subquery(
            ProductVariant.objects.filter(
                product=OuterRef('pk')
            ).order_by('price').values('compare_at_price')[:1]
        )

        qs = Product.objects.select_related('brand', 'category', 'type').prefetch_related(
            'images',
            'variants__images',
            'specifications__specification'
        ).annotate(
            effective_price=Coalesce(
                active_min_price,
                any_min_price,
                F('base_price'),
                output_field=DecimalField(max_digits=12, decimal_places=2)
            ),
            effective_compare_price=Coalesce(
                active_compare_price,
                any_compare_price,
                F('compare_at_price'),
                output_field=DecimalField(max_digits=12, decimal_places=2)
            ),
            effective_sku=Coalesce(
                active_sku,
                any_sku,
                F('sku'),
                output_field=models.CharField(max_length=100)
            )
        )

        user = self.request.user
        # Regular users only see active products
        if not (user and (user.is_staff or user.is_superuser)):
            qs = qs.filter(is_active=True, status='active')

        params = self.request.query_params

        # 1. Filter by category (ID, slug, or name)
        category_param = params.get('category')
        if category_param:
            category_param = category_param.strip()
            slug_variant = slugify(category_param)
            name_spaced = category_param.replace('-', ' ').replace('_', ' ')
            name_hyphen = category_param.replace(' ', '-').replace('_', '-')
            cat_q = (
                Q(category__slug__iexact=category_param) |
                Q(category__slug__iexact=slug_variant) |
                Q(category__slug__iexact=name_hyphen) |
                Q(category__name__iexact=category_param) |
                Q(category__name__iexact=name_spaced) |
                Q(category__parent__slug__iexact=category_param) |
                Q(category__parent__slug__iexact=slug_variant) |
                Q(category__parent__slug__iexact=name_hyphen) |
                Q(category__parent__name__iexact=category_param) |
                Q(category__parent__name__iexact=name_spaced)
            )
            if is_valid_uuid(category_param):
                cat_q |= Q(category_id=category_param) | Q(category__parent_id=category_param)
            qs = qs.filter(cat_q)

        # 2. Filter by brand (ID, slug, or name)
        brand_param = params.get('brand')
        if brand_param:
            brand_param = brand_param.strip()
            slug_variant = slugify(brand_param)
            name_spaced = brand_param.replace('-', ' ').replace('_', ' ')
            brand_q = (
                Q(brand__slug__iexact=brand_param) |
                Q(brand__slug__iexact=slug_variant) |
                Q(brand__name__iexact=brand_param) |
                Q(brand__name__iexact=name_spaced)
            )
            if is_valid_uuid(brand_param):
                brand_q |= Q(brand_id=brand_param)
            qs = qs.filter(brand_q)

        # 3. Filter by type (ID or name)
        type_param = params.get('type')
        if type_param:
            type_param = type_param.strip()
            name_spaced = type_param.replace('-', ' ')
            type_q = (
                Q(type__name__iexact=type_param) |
                Q(type__name__iexact=name_spaced)
            )
            if is_valid_uuid(type_param):
                type_q |= Q(type_id=type_param)
            qs = qs.filter(type_q)

        # 4. Search term (name, sku, description, or variant sku)
        search_param = params.get('search')
        if search_param:
            qs = qs.filter(
                Q(name__icontains=search_param) |
                Q(sku__icontains=search_param) |
                Q(effective_sku__icontains=search_param) |
                Q(variants__sku__icontains=search_param) |
                Q(description__icontains=search_param) |
                Q(short_description__icontains=search_param)
            ).distinct()

        # 5. Price range (evaluated on pure-variant effective price)
        min_price = params.get('min_price')
        if min_price:
            try:
                qs = qs.filter(effective_price__gte=float(min_price))
            except ValueError:
                pass

        max_price = params.get('max_price')
        if max_price:
            try:
                qs = qs.filter(effective_price__lte=float(max_price))
            except ValueError:
                pass

        # 6. Featured
        is_featured = params.get('is_featured')
        if is_featured in ('true', '1', 'True'):
            qs = qs.filter(is_featured=True)

        # 7. Status (for staff/admin)
        status_param = params.get('status')
        if status_param and user and (user.is_staff or user.is_superuser):
            qs = qs.filter(status=status_param)

        # 8. Ordering (price sorting uses effective variant price)
        ordering = params.get('ordering', '-created_at')
        if ordering == 'base_price':
            qs = qs.order_by('effective_price')
        elif ordering == '-base_price':
            qs = qs.order_by('-effective_price')
        elif ordering in ['created_at', '-created_at', 'name', '-name']:
            qs = qs.order_by(ordering)

        return qs


class ProductVariantViewSet(viewsets.ModelViewSet):
    queryset = ProductVariant.objects.all()
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = StandardCatalogPagination
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.action == 'list':
            return CatalogVariantListSerializer
        return ProductVariantSerializer

    @action(detail=False, methods=['get'], url_path='generate-barcode')
    def generate_barcode(self, request):
        for _ in range(50):
            candidate = generate_ean13_barcode()
            if not ProductVariant.objects.filter(barcode=candidate).exists():
                return Response({'barcode': candidate})
        return Response({'barcode': generate_ean13_barcode()})

    def get_queryset(self):
        qs = ProductVariant.objects.select_related(
            'product',
            'product__brand',
            'product__category',
            'product__type'
        ).prefetch_related(
            'images',
            'product__images'
        )

        user = self.request.user
        # Regular users only see active variants with active products
        if not (user and (user.is_staff or user.is_superuser)):
            qs = qs.filter(
                status='active',
                product__is_active=True,
                product__status='active'
            )

        params = self.request.query_params

        # 1. Filter by parent product ID or slug
        product_id = params.get('product') or params.get('product_id')
        if product_id:
            product_id = product_id.strip()
            if is_valid_uuid(product_id):
                qs = qs.filter(product_id=product_id)
            else:
                qs = qs.filter(
                    Q(product__slug__iexact=product_id) |
                    Q(product__slug__iexact=slugify(product_id))
                )

        # 2. Filter by category (ID, slug, or name)
        category_param = params.get('category')
        if category_param:
            category_param = category_param.strip()
            slug_variant = slugify(category_param)
            name_spaced = category_param.replace('-', ' ').replace('_', ' ')
            name_hyphen = category_param.replace(' ', '-').replace('_', '-')
            cat_q = (
                Q(product__category__slug__iexact=category_param) |
                Q(product__category__slug__iexact=slug_variant) |
                Q(product__category__slug__iexact=name_hyphen) |
                Q(product__category__name__iexact=category_param) |
                Q(product__category__name__iexact=name_spaced) |
                Q(product__category__parent__slug__iexact=category_param) |
                Q(product__category__parent__slug__iexact=slug_variant) |
                Q(product__category__parent__slug__iexact=name_hyphen) |
                Q(product__category__parent__name__iexact=category_param) |
                Q(product__category__parent__name__iexact=name_spaced)
            )
            if is_valid_uuid(category_param):
                cat_q |= Q(product__category_id=category_param) | Q(product__category__parent_id=category_param)
            qs = qs.filter(cat_q)

        # 3. Filter by brand (ID, slug, or name)
        brand_param = params.get('brand')
        if brand_param:
            brand_param = brand_param.strip()
            slug_variant = slugify(brand_param)
            name_spaced = brand_param.replace('-', ' ').replace('_', ' ')
            brand_q = (
                Q(product__brand__slug__iexact=brand_param) |
                Q(product__brand__slug__iexact=slug_variant) |
                Q(product__brand__name__iexact=brand_param) |
                Q(product__brand__name__iexact=name_spaced)
            )
            if is_valid_uuid(brand_param):
                brand_q |= Q(product__brand_id=brand_param)
            qs = qs.filter(brand_q)

        # 4. Filter by type (ID or name)
        type_param = params.get('type')
        if type_param:
            type_param = type_param.strip()
            name_spaced = type_param.replace('-', ' ')
            type_q = (
                Q(product__type__name__iexact=type_param) |
                Q(product__type__name__iexact=name_spaced)
            )
            if is_valid_uuid(type_param):
                type_q |= Q(product__type_id=type_param)
            qs = qs.filter(type_q)

        # 5. Search term (variant name, sku, product name/sku/description)
        search_param = params.get('search')
        if search_param:
            qs = qs.filter(
                Q(name__icontains=search_param) |
                Q(sku__icontains=search_param) |
                Q(barcode__icontains=search_param) |
                Q(product__name__icontains=search_param) |
                Q(product__sku__icontains=search_param) |
                Q(product__description__icontains=search_param) |
                Q(product__short_description__icontains=search_param)
            )

        # 6. Price range
        min_price = params.get('min_price')
        if min_price:
            try:
                qs = qs.filter(price__gte=float(min_price))
            except ValueError:
                pass

        max_price = params.get('max_price')
        if max_price:
            try:
                qs = qs.filter(price__lte=float(max_price))
            except ValueError:
                pass

        # 7. Featured (inherits from product)
        is_featured = params.get('is_featured')
        if is_featured in ('true', '1', 'True'):
            qs = qs.filter(product__is_featured=True)

        # 8. Status (for staff/admin)
        status_param = params.get('status')
        if status_param and user and (user.is_staff or user.is_superuser):
            qs = qs.filter(status=status_param)

        # 9. Ordering
        ordering = params.get('ordering', '-created_at')
        valid_orderings = [
            'price', '-price',
            'created_at', '-created_at',
            'name', '-name',
            'product__name', '-product__name'
        ]
        if ordering in valid_orderings:
            qs = qs.order_by(ordering)

        return qs



class ProductImageViewSet(viewsets.ModelViewSet):
    queryset = ProductImage.objects.all()
    serializer_class = ProductImageSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        product_id = self.request.query_params.get('product') or self.request.query_params.get('product_id')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs


class SpecificationDefinitionViewSet(viewsets.ModelViewSet):
    queryset = SpecificationDefinition.objects.all()
    serializer_class = SpecificationDefinitionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        category_id = self.request.query_params.get('category') or self.request.query_params.get('category_id')
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs


class SpecificationOptionViewSet(viewsets.ModelViewSet):
    """CRUD for pre-defined dropdown values per SpecificationDefinition."""
    queryset = SpecificationOption.objects.select_related('definition').all()
    serializer_class = SpecificationOptionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        definition_id = (
            self.request.query_params.get('definition')
            or self.request.query_params.get('definition_id')
        )
        if definition_id:
            qs = qs.filter(definition_id=definition_id)
        return qs


class ProductSpecificationViewSet(viewsets.ModelViewSet):
    queryset = ProductSpecification.objects.all()
    serializer_class = ProductSpecificationSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        product_id = self.request.query_params.get('product') or self.request.query_params.get('product_id')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs
