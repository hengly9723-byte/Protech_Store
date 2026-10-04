from django.urls import path
from .views import (
    CheckoutView,
    OrderViewSet,
    OrderPayView,
    OrderStatusUpdateView,
    OrderRefundView,
    OrderShipView,
    OrderReturnView,
    ReturnStatusUpdateView,
    ShippingConfigView,
)

urlpatterns = [
    # Shipping rules (admin-configurable) — exposed for frontend estimates
    path('shipping/config', ShippingConfigView.as_view(), name='shipping-config'),
    path('shipping/config/', ShippingConfigView.as_view(), name='shipping-config-slash'),

    # Checkout endpoint
    path('checkout', CheckoutView.as_view(), name='checkout-root'),
    path('checkout/', CheckoutView.as_view(), name='checkout-root-slash'),

    # Returns admin status update (placed before <uuid:id> to prevent masking)
    path('orders/returns/<uuid:id>', ReturnStatusUpdateView.as_view(), name='order-return-status-update'),
    path('orders/returns/<uuid:id>/', ReturnStatusUpdateView.as_view(), name='order-return-status-update-slash'),

    # Order action endpoints
    path('orders/<uuid:id>/pay', OrderPayView.as_view(), name='order-pay'),
    path('orders/<uuid:id>/pay/', OrderPayView.as_view(), name='order-pay-slash'),
    path('orders/<uuid:id>/status', OrderStatusUpdateView.as_view(), name='order-status-update'),
    path('orders/<uuid:id>/status/', OrderStatusUpdateView.as_view(), name='order-status-update-slash'),
    path('orders/<uuid:id>/refund', OrderRefundView.as_view(), name='order-refund'),
    path('orders/<uuid:id>/refund/', OrderRefundView.as_view(), name='order-refund-slash'),
    path('orders/<uuid:id>/ship', OrderShipView.as_view(), name='order-ship'),
    path('orders/<uuid:id>/ship/', OrderShipView.as_view(), name='order-ship-slash'),
    path('orders/<uuid:id>/return', OrderReturnView.as_view(), name='order-return-request'),
    path('orders/<uuid:id>/return/', OrderReturnView.as_view(), name='order-return-request-slash'),

    # Order list and detail
    path('orders', OrderViewSet.as_view({'get': 'list'}), name='order-list'),
    path('orders/', OrderViewSet.as_view({'get': 'list'}), name='order-list-slash'),
    path('orders/<uuid:id>', OrderViewSet.as_view({'get': 'retrieve'}), name='order-detail'),
    path('orders/<uuid:id>/', OrderViewSet.as_view({'get': 'retrieve'}), name='order-detail-slash'),
]
