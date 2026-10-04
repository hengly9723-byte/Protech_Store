from django.urls import path
from .views import KhqrGenerateView, KhqrCheckStatusView, KhqrVerifyView, CheckPaymentStatusView

urlpatterns = [
    path('payments/khqr/generate/', KhqrGenerateView.as_view(), name='khqr-generate'),
    path('payments/khqr/check-status/', KhqrCheckStatusView.as_view(), name='khqr-check-status'),
    path('payments/verify/', KhqrVerifyView.as_view(), name='khqr-verify'),
    # Unified status endpoint: accepts order_id, payment_id, or md5 in the body.
    path('payments/check-status/', CheckPaymentStatusView.as_view(), name='payment-check-status'),
]
