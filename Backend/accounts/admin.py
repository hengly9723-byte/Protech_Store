from django.contrib import admin
from .models import User, Role, Permission, UserRole, RolePermission, CustomerProfile, Address


class CustomerProfileInline(admin.StackedInline):
    model = CustomerProfile
    can_delete = False
    extra = 0


class UserRoleInline(admin.TabularInline):
    model = UserRole
    extra = 1


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 1


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'role', 'is_active', 'is_staff', 'is_superuser', 'created_at')
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser', 'created_at')
    search_fields = ('email', 'full_name')
    ordering = ('-created_at',)
    inlines = [CustomerProfileInline, UserRoleInline]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'created_at')
    search_fields = ('name', 'description')
    inlines = [RolePermissionInline]


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name', 'description')


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'recipient_name', 'city', 'country', 'is_default')
    list_filter = ('type', 'is_default', 'country')
    search_fields = ('user__email', 'recipient_name', 'address_line_1', 'city')


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'date_of_birth', 'created_at')
    search_fields = ('user__email',)
