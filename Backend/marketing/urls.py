from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductReviewsView,
    ReviewAdminStatusView,
    AdminReviewListView,
    ValidateDiscountCodeView,
    DiscountCodeViewSet,
    PromotionViewSet,
)

router = DefaultRouter()
router.register(r'discount-codes', DiscountCodeViewSet, basename='discount-code')
router.register(r'promotions', PromotionViewSet, basename='promotion')

urlpatterns = [
    # Discount code validation (placed before router to prevent masking)
    path('discount-codes/validate', ValidateDiscountCodeView.as_view(), name='discount-code-validate'),
    path('discount-codes/validate/', ValidateDiscountCodeView.as_view(), name='discount-code-validate-slash'),

    # Product Reviews
    path('products/<uuid:product_id>/reviews', ProductReviewsView.as_view(), name='product-reviews'),
    path('products/<uuid:product_id>/reviews/', ProductReviewsView.as_view(), name='product-reviews-slash'),

    # Admin Review Status Moderation
    path('reviews', AdminReviewListView.as_view(), name='review-admin-list'),
    path('reviews/', AdminReviewListView.as_view(), name='review-admin-list-slash'),
    path('reviews/<uuid:id>', ReviewAdminStatusView.as_view(), name='review-admin-status'),
    path('reviews/<uuid:id>/', ReviewAdminStatusView.as_view(), name='review-admin-status-slash'),

    # Router (discount codes & promotions)
    path('', include(router.urls)),
]
