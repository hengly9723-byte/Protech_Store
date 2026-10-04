from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from .models import Product

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'role', 'avatar_url', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_role(self, obj):
        return obj.roles.values_list('name', flat=True).first() or ('admin' if obj.is_staff or obj.is_superuser else 'user')



class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'full_name', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data.get('full_name', '')
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email', '').lower()
        password = data.get('password', '')

        try:
            user_obj = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password.")

        # Account exists but was created via Google OAuth — it has no password.
        # Direct the user to either use Google Sign-In or go to Sign Up to add a password.
        if not user_obj.has_usable_password():
            raise serializers.ValidationError(
                "This account was created with Google Sign-In and has no password. "
                "Please use the 'Sign in with Google' button, or go to Sign Up to add a password."
            )

        # Account exists but email is not yet verified
        if not user_obj.is_email_verified:
            raise serializers.ValidationError(
                "Please verify your email before logging in. "
                "Check your inbox for the verification link, or use 'Resend verification email'."
            )

        # Account disabled (e.g., by an admin)
        if not user_obj.is_active:
            raise serializers.ValidationError(
                "This account has been deactivated. Please contact support."
            )

        user = authenticate(request=self.context.get('request'), username=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid email or password.")

        return {'user': user}