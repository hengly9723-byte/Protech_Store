from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    LoginView,
    GoogleAuthView,
    VerifyEmailView,
    RequestPasswordResetView,
    ResetPasswordView,
    UserMeView,
    AdminUserViewSet,
    AddressViewSet,
    RoleViewSet,
    PermissionViewSet,
)

router = DefaultRouter()
router.register(r'addresses', AddressViewSet, basename='address')
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'permissions', PermissionViewSet, basename='permission')

urlpatterns = [
    # Auth Endpoints
    path('auth/register', RegisterView.as_view(), name='auth-register'),
    path('auth/register/', RegisterView.as_view(), name='auth-register-slash'),
    path('auth/login', LoginView.as_view(), name='auth-login'),
    path('auth/login/', LoginView.as_view(), name='auth-login-slash'),
    path('auth/google', GoogleAuthView.as_view(), name='auth-google'),
    path('auth/google/', GoogleAuthView.as_view(), name='auth-google-slash'),
    path('auth/refresh', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh-slash'),
    path('auth/verify-email', VerifyEmailView.as_view(), name='auth-verify-email'),
    path('auth/verify-email/', VerifyEmailView.as_view(), name='auth-verify-email-slash'),
    path('auth/request-password-reset', RequestPasswordResetView.as_view(), name='auth-request-password-reset'),
    path('auth/request-password-reset/', RequestPasswordResetView.as_view(), name='auth-request-password-reset-slash'),
    path('auth/reset-password', ResetPasswordView.as_view(), name='auth-reset-password'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='auth-reset-password-slash'),

    # User Profile Endpoints
    path('users/me', UserMeView.as_view(), name='user-me'),
    path('users/me/', UserMeView.as_view(), name='user-me-slash'),

    # Admin User Management (list + role assignment)
    path('users', AdminUserViewSet.as_view({'get': 'list'}), name='admin-user-list'),
    path('users/', AdminUserViewSet.as_view({'get': 'list'}), name='admin-user-list-slash'),
    path('users/<uuid:id>', AdminUserViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'put': 'update',
    }), name='admin-user-detail'),
    path('users/<uuid:id>/', AdminUserViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'put': 'update',
    }), name='admin-user-detail-slash'),

    # ViewSet Routers (addresses, roles, permissions)
    path('', include(router.urls)),
]
