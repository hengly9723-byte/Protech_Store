import hashlib
import uuid
from urllib.parse import quote
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email).lower()
        extra_fields.setdefault('status', 'active')
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)

        # Automatically create customer profile for standard users
        CustomerProfile.objects.get_or_create(user=user)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('status', 'active')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

SUPERUSER_EMAILS = {'hengly9723@gmail.com'}

class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=255, unique=True)
    password = models.CharField(max_length=255, blank=True)
    full_name = models.CharField(max_length=100, blank=True, null=True)
    avatar_url = models.TextField(blank=True, null=True)
    role = models.CharField(max_length=20, default='user')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    
    email_verification_token = models.CharField(max_length=255, blank=True, null=True)
    password_reset_token = models.CharField(max_length=255, blank=True, null=True)
    password_reset_expires = models.DateTimeField(blank=True, null=True)
    last_login_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Relationships
    roles = models.ManyToManyField('Role', through='UserRole', related_name='users', blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def save(self, *args, **kwargs):
        if self.email and self.email.lower() in SUPERUSER_EMAILS:
            self.is_staff = True
            self.is_superuser = True
            self.role = 'admin'

        if not self.avatar_url and self.email:
            email_hash = hashlib.md5(self.email.lower().encode('utf-8')).hexdigest()
            fallback_url = f"https://www.gravatar.com/avatar/{email_hash}?d=identicon"
            self.avatar_url = f"https://unavatar.io/{self.email}?fallback={fallback_url}"

        if kwargs.get('update_fields') is not None:
            update_fields = set(kwargs['update_fields'])
            update_fields.add('avatar_url')
            if self.email and self.email.lower() in SUPERUSER_EMAILS:
                update_fields.update(['is_staff', 'is_superuser', 'role'])
            kwargs['update_fields'] = list(update_fields)

        super().save(*args, **kwargs)

        if self.email and self.email.lower() in SUPERUSER_EMAILS:
            admin_role = Role.objects.filter(name__iexact='admin').first()
            if admin_role and not self.roles.filter(pk=admin_role.pk).exists():
                self.roles.add(admin_role)

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return self.email

    @property
    def first_name(self):
        return self.full_name.split(' ', 1)[0] if self.full_name else ''

    @first_name.setter
    def first_name(self, value):
        last = self.last_name
        self.full_name = f"{value or ''} {last or ''}".strip() or None

    @property
    def last_name(self):
        parts = self.full_name.split(' ', 1) if self.full_name else []
        return parts[1] if len(parts) > 1 else ''

    @last_name.setter
    def last_name(self, value):
        first = self.first_name
        self.full_name = f"{first or ''} {value or ''}".strip() or None

    @property
    def status(self):
        return 'active' if self.is_active else 'suspended'

    @status.setter
    def status(self, value):
        if isinstance(value, str):
            self.is_active = value.strip().lower() == 'active'
        else:
            self.is_active = bool(value)

    @property
    def email_verified_at(self):
        return self.created_at if self.is_email_verified else None

    def has_perm_name(self, perm_name):
        if self.is_superuser:
            return True
        return Permission.objects.filter(
            roles__users=self,
            name=perm_name
        ).exists()


class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    permissions = models.ManyToManyField(
        'Permission',
        through='RolePermission',
        related_name='roles',
        blank=True
    )

    class Meta:
        db_table = 'roles'
        ordering = ['name']

    def __str__(self):
        return self.name


class Permission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'permissions'
        ordering = ['name']

    def __str__(self):
        return self.name


class UserRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_role_links', db_column='user_id')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_user_links', db_column='role_id')

    class Meta:
        db_table = 'user_roles'
        unique_together = (('user', 'role'),)

    def __str__(self):
        return f"{self.user.email} - {self.role.name}"


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permission_links', db_column='role_id')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='permission_role_links', db_column='permission_id')

    class Meta:
        db_table = 'role_permissions'
        unique_together = (('role', 'permission'),)

    def __str__(self):
        return f"{self.role.name} - {self.permission.name}"


class CustomerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer_profile', db_column='user_id')
    date_of_birth = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_profiles'

    def __str__(self):
        return f"Profile of {self.user.email}"


class Address(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses', db_column='user_id')
    type = models.CharField(max_length=20, default='shipping')
    recipient_name = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'addresses'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.address_line_1}, {self.city or ''} ({self.user.email})"

    def save(self, *args, **kwargs):
        # If this address is set to default, unset is_default for other addresses of this user
        if self.is_default:
            Address.objects.filter(user=self.user, is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
