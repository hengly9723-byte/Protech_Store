from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StockListView,
    VariantStockView,
    StockAdjustView,
    LowStockAlertView,
    StockTransactionViewSet,
)

router = DefaultRouter()
router.register(r'transactions', StockTransactionViewSet, basename='stock-transaction')

urlpatterns = [
    # Low stock alerts (placed before <variant_id> to avoid route masking)
    path('low', LowStockAlertView.as_view(), name='stock-low-alert'),
    path('low/', LowStockAlertView.as_view(), name='stock-low-alert-slash'),

    # All stock levels (admin)
    path('', StockListView.as_view(), name='stock-list'),
    path('', StockListView.as_view(), name='stock-list-slash'),

    # Transaction audit history
    path('', include(router.urls)),

    # Stock adjustment endpoint (admin only)
    path('<uuid:variant_id>/adjust', StockAdjustView.as_view(), name='stock-adjust'),
    path('<uuid:variant_id>/adjust/', StockAdjustView.as_view(), name='stock-adjust-slash'),

    # Real-time stock detail by variant ID (public)
    path('<uuid:variant_id>', VariantStockView.as_view(), name='stock-detail'),
    path('<uuid:variant_id>/', VariantStockView.as_view(), name='stock-detail-slash'),
]
