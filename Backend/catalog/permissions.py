from rest_framework.permissions import BasePermission, SAFE_METHODS
from accounts.permissions import IsAdminOrSuperUser


class IsAdminOrReadOnly(BasePermission):
    """
    Custom permission to allow public read-only access (GET, HEAD, OPTIONS)
    while requiring admin or staff privileges for write operations.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return request.user.has_perm_name('manage_catalog') or request.user.has_perm_name('manage_products')
