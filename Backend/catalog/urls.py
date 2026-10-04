from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    BrandViewSet,
    ProductTypeViewSet,
    CategoryViewSet,
    ProductViewSet,
    ProductVariantViewSet,
    ProductImageViewSet,
    SpecificationDefinitionViewSet,
    SpecificationOptionViewSet,
    ProductSpecificationViewSet,
)

router = DefaultRouter()
router.register(r'brands', BrandViewSet, basename='brand')
router.register(r'product-types', ProductTypeViewSet, basename='product-type')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'variants', ProductVariantViewSet, basename='variant')
router.register(r'product-images', ProductImageViewSet, basename='product-image')
router.register(r'specification-definitions', SpecificationDefinitionViewSet, basename='specification-definition')
router.register(r'specification-options', SpecificationOptionViewSet, basename='specification-option')
router.register(r'product-specifications', ProductSpecificationViewSet, basename='product-specification')

urlpatterns = [
    path('', include(router.urls)),
]
