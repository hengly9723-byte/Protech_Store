from rest_framework.permissions import BasePermission


class IsAdminOrSuperUser(BasePermission):
    """
    Allows access only to superusers or users with staff/admin role.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return request.user.roles.filter(name__iexact='admin').exists()


def HasPermission(permission_name: str):
    """
    Factory that returns a DRF BasePermission class checking if the authenticated
    user has a specific permission via their assigned roles.
    Superusers bypass all permission checks.
    """
    class _HasSpecificPermission(BasePermission):
        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            if request.user.is_superuser:
                return True
            return request.user.has_perm_name(permission_name)

    _HasSpecificPermission.__name__ = f"HasPermission_{permission_name}"
    return _HasSpecificPermission
