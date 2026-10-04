from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet, UserViewSet,
    register_view, verify_email_view, resend_verification_view,
    login_view, google_login_view,
)

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('register/', register_view, name='register'),
    path('verify-email/', verify_email_view, name='verify_email'),
    path('resend-verification/', resend_verification_view, name='resend_verification'),
    path('login/', login_view, name='login'),
    path('auth/google/', google_login_view, name='google_login'),
    path('', include(router.urls)),
]