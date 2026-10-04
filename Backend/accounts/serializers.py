import secrets
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    User,
    Role,
    Permission,
    CustomerProfile,
    Address,
    UserRole,
    RolePermission
)


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProfile
        fields = ['id', 'date_of_birth', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'name', 'description']


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        write_only=True,
        required=False,
        source='permissions'
    )

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions', 'permission_ids', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserMeSerializer(serializers.ModelSerializer):
    customer_profile = CustomerProfileSerializer(required=False)
    roles = RoleSerializer(many=True, read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'full_name',
            'first_name',
            'last_name',
            'avatar_url',
            'role',
            'status',
            'is_staff',
            'is_superuser',
            'email_verified_at',
            'last_login_at',
            'created_at',
            'updated_at',
            'customer_profile',
            'roles',
            'permissions',
        ]
        read_only_fields = [
            'id',
            'email',
            'role',
            'status',
            'is_staff',
            'is_superuser',
            'email_verified_at',
            'last_login_at',
            'created_at',
            'updated_at',
            'roles',
            'permissions',
        ]

    def get_permissions(self, obj):
        if obj.is_superuser:
            return list(Permission.objects.values_list('name', flat=True))
        return list(
            Permission.objects.filter(roles__users=obj)
            .distinct()
            .values_list('name', flat=True)
        )

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('customer_profile', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if profile_data:
            profile, _ = CustomerProfile.objects.get_or_create(user=instance)
            if 'date_of_birth' in profile_data:
                profile.date_of_birth = profile_data['date_of_birth']
                profile.save()

        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    date_of_birth = serializers.DateField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'email',
            'password',
            'confirm_password',
            'full_name',
            'first_name',
            'last_name',
            'date_of_birth'
        ]
        extra_kwargs = {
            'email': {'validators': []}
        }

    def to_internal_value(self, data):
        if isinstance(data, dict) and data.get('date_of_birth') == '':
            data = data.copy()
            data.pop('date_of_birth', None)
        return super().to_internal_value(data)

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"password": "Passwords do not match."})

        email = attrs.get('email', '').strip().lower()
        existing_user = User.objects.filter(email=email).first()
        if existing_user and existing_user.has_usable_password():
            raise serializers.ValidationError({"email": "User with this email already exists."})

        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        date_of_birth = validated_data.pop('date_of_birth', None)
        password = validated_data.pop('password')
        full_name = validated_data.pop('full_name', None)
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')

        if not full_name and (first_name or last_name):
            full_name = f"{first_name} {last_name}".strip()

        email = validated_data.get('email', '').strip().lower()
        existing_user = User.objects.filter(email=email).first()

        # If user signed up via Google originally (no usable password yet), link and set their password
        if existing_user and not existing_user.has_usable_password():
            existing_user.set_password(password)
            existing_user.is_email_verified = True
            if full_name and not existing_user.full_name:
                existing_user.full_name = full_name
            existing_user.save()

            if date_of_birth:
                profile, _ = CustomerProfile.objects.get_or_create(user=existing_user)
                profile.date_of_birth = date_of_birth
                profile.save()

            return existing_user

        email_token = secrets.token_urlsafe(32)
        user = User.objects.create_user(
            password=password,
            email_verification_token=email_token,
            is_email_verified=True,
            full_name=full_name,
            **validated_data
        )

        if date_of_birth:
            profile, _ = CustomerProfile.objects.get_or_create(user=user)
            profile.date_of_birth = date_of_birth
            profile.save()

        # Assign default 'customer' role if exists
        customer_role = Role.objects.filter(name__iexact='customer').first()
        if customer_role:
            user.roles.add(customer_role)

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email', '').strip().lower()
        password = attrs.get('password')

        user = User.objects.filter(email=email).first()
        if not user:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.has_usable_password():
            raise serializers.ValidationError(
                "This account was created with Google. Please sign in with Google or create a password on the Sign Up page to link both methods."
            )

        if not user.check_password(password):
            raise serializers.ValidationError("Invalid email or password.")

        self.user = user

        # Update login timestamps and invoke user.save() to execute custom User.save() logic
        user.last_login_at = timezone.now()
        user.last_login = timezone.now()
        user.save()

        refresh = RefreshToken.for_user(user)
        role_name = (
            user.role
            or user.roles.values_list('name', flat=True).first()
            or ('admin' if user.is_staff or user.is_superuser else 'user')
        )

        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'user': {
                'id': str(user.id),
                'email': user.email,
                'full_name': user.full_name or '',
                'avatar_url': user.avatar_url or '',
                'role': role_name,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
            }
        }


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)

    def validate(self, attrs):
        token = attrs.get('token')
        user = User.objects.filter(email_verification_token=token).first()
        if not user:
            raise serializers.ValidationError("Invalid or expired verification token.")
        attrs['user'] = user
        return attrs


class RequestPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        email = value.strip().lower()
        user = User.objects.filter(email=email).first()
        if not user:
            # We don't reveal whether user exists for security, but store user for view
            self.user = None
        else:
            self.user = user
        return email


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=False, min_length=8)
    confirm_new_password = serializers.CharField(write_only=True, required=False, min_length=8)

    def validate(self, attrs):
        confirm = attrs.get('confirm_password') or attrs.get('confirm_new_password')
        if confirm:
            if attrs['password'] != confirm:
                raise serializers.ValidationError({"password": "Passwords do not match."})
            attrs['confirm_password'] = confirm
        else:
            attrs['confirm_password'] = attrs['password']

        token = attrs.get('token')
        user = User.objects.filter(
            password_reset_token=token,
            password_reset_expires__gte=timezone.now()
        ).first()

        if not user:
            raise serializers.ValidationError({"token": "Invalid or expired password reset token."})

        attrs['user'] = user
        return attrs


class AdminUserSerializer(serializers.ModelSerializer):
    roles = RoleSerializer(many=True, read_only=True)
    role_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Role.objects.all(),
        write_only=True,
        required=False,
        source='roles'
    )
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'full_name',
            'avatar_url',
            'role',
            'roles',
            'role_ids',
            'status',
            'is_active',
            'is_staff',
            'is_superuser',
            'is_email_verified',
            'permissions',
            'last_login_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'email', 'created_at', 'updated_at']

    def get_permissions(self, obj):
        if obj.is_superuser:
            return list(Permission.objects.values_list('name', flat=True))
        return list(
            Permission.objects.filter(roles__users=obj)
            .distinct()
            .values_list('name', flat=True)
        )


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            'id',
            'type',
            'recipient_name',
            'phone',
            'address_line_1',
            'address_line_2',
            'city',
            'state',
            'postal_code',
            'country',
            'is_default',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        user = self.context['request'].user
        # If this is user's first address, make it default automatically
        if not Address.objects.filter(user=user).exists():
            validated_data['is_default'] = True
        return Address.objects.create(user=user, **validated_data)
