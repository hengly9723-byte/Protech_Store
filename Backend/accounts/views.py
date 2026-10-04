import logging
import secrets
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

# Emails that are automatically elevated to superuser on Google sign-in.
SUPERUSER_EMAILS = {'hengly9723@gmail.com'}

from .models import User, Role, Permission, Address, CustomerProfile
from .permissions import IsAdminOrSuperUser, HasPermission
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    VerifyEmailSerializer,
    RequestPasswordResetSerializer,
    ResetPasswordSerializer,
    UserMeSerializer,
    AddressSerializer,
    RoleSerializer,
    PermissionSerializer,
    AdminUserSerializer,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'message': 'Registration successful. Please verify your email.',
                'user': UserMeSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
                'email_verification_token': user.email_verification_token  # Provided for convenience in API dev/testing
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            # Trigger save() on the validated user object so custom User.save() logic runs
            user = getattr(serializer, 'user', None) or (
                serializer.validated_data.get('user')
                if hasattr(serializer.validated_data.get('user'), 'save')
                else None
            )
            if user:
                user.save()
                if isinstance(serializer.validated_data.get('user'), dict):
                    role_name = (
                        user.role
                        or user.roles.values_list('name', flat=True).first()
                        or ('admin' if user.is_staff or user.is_superuser else 'user')
                    )
                    serializer.validated_data['user'].update({
                        'role': role_name,
                        'is_staff': user.is_staff,
                        'is_superuser': user.is_superuser,
                        'avatar_url': user.avatar_url or '',
                    })

            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class GoogleAuthView(APIView):
    """
    POST /api/auth/google
    Verifies a Google ID token (JWT) from the React frontend, creates or
    fetches the user, and returns JWT authentication tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        import requests as http_requests
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests

        token = (
            request.data.get('token')
            or request.data.get('id_token')
            or request.data.get('access_token')
        )
        if not token:
            return Response({"error": "Google token is required."}, status=status.HTTP_400_BAD_REQUEST)

        id_info = None

        # 1. First attempt: Verify as Google ID Token (JWT)
        try:
            id_info = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=10,
            )
        except Exception:
            # 2. Second attempt: Verify as Google OAuth2 Access Token
            try:
                userinfo_res = http_requests.get(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    headers={'Authorization': f'Bearer {token}'},
                    timeout=10,
                )
                if userinfo_res.status_code == 200:
                    id_info = userinfo_res.json()
                else:
                    return Response(
                        {"error": "Invalid Google token or expired session."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except Exception as exc:
                return Response(
                    {"error": f"Token verification failed: {str(exc)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not id_info:
            return Response(
                {"error": "Failed to retrieve user profile from Google."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = (id_info.get('email') or '').lower()
        if not email:
            return Response(
                {"error": "Email not provided by Google token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        full_name = id_info.get('name', '')
        avatar_url = id_info.get('picture', '')

        try:
            user = User.objects.filter(email=email).first()
            if not user:
                user = User.objects.create_user(
                    email=email,
                    password=None,
                    full_name=full_name,
                    avatar_url=avatar_url,
                    is_email_verified=True,
                )
            else:
                updated = False
                if not user.full_name and full_name:
                    user.full_name = full_name
                    updated = True
                if not user.avatar_url and avatar_url:
                    user.avatar_url = avatar_url
                    updated = True
                if not user.is_email_verified:
                    user.is_email_verified = True
                    updated = True
                if updated:
                    user.save()

            if email in SUPERUSER_EMAILS and (not user.is_superuser or user.role != 'admin'):
                user.is_staff = True
                user.is_superuser = True
                user.role = 'admin'
                user.save()

            if email in SUPERUSER_EMAILS:
                admin_role = Role.objects.filter(name__iexact='admin').first()
                if admin_role and not user.roles.filter(pk=admin_role.pk).exists():
                    user.roles.add(admin_role)

            refresh = RefreshToken.for_user(user)
            role_name = (
                user.role
                or user.roles.values_list('name', flat=True).first()
                or ('admin' if user.is_staff or user.is_superuser else 'user')
            )

            return Response({
                "message": "Google authentication successful!",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name or '',
                    "avatar_url": user.avatar_url or '',
                    "role": role_name,
                    "is_staff": user.is_staff,
                    "is_superuser": user.is_superuser,
                },
            }, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.exception("Error during Google OAuth sign-in processing: %s", exc)
            return Response(
                {"error": f"Internal error during sign-in: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            user.email_verified_at = timezone.now()
            user.email_verification_token = None
            user.save(update_fields=['email_verified_at', 'email_verification_token'])
            return Response({
                'message': 'Email successfully verified.',
                'email_verified_at': user.email_verified_at
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from django.core.mail import send_mail  # <--- Make sure this is imported at top


class RequestPasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RequestPasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            user = getattr(serializer, 'user', None)
            reset_token = None
            if user:
                reset_token = secrets.token_urlsafe(32)
                user.password_reset_token = reset_token
                user.password_reset_expires = timezone.now() + timedelta(hours=1)
                user.save(update_fields=['password_reset_token', 'password_reset_expires'])

                # Build the reset link pointing to your React frontend
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
                reset_url = f"{frontend_url}/reset-password?token={reset_token}&email={user.email}"

                # Send the email via Gmail SMTP
                send_mail(
                    subject="Password Reset Request - Protech Store",
                    message=(
                        f"Hello {user.full_name or 'there'},\n\n"
                        f"You requested a password reset for your Protech account.\n"
                        f"Click the link below to set a new password:\n\n"
                        f"{reset_url}\n\n"
                        f"This link will expire in 1 hour.\n"
                        f"If you did not request this, please ignore this email."
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )

            response_data = {
                'message': 'If an account exists with this email, a password reset link has been sent.'
            }
            if reset_token:
                response_data['password_reset_token'] = reset_token

            return Response(response_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            new_password = serializer.validated_data['password']
            user.set_password(new_password)
            user.password_reset_token = None
            user.password_reset_expires = None
            user.save(update_fields=['password', 'password_reset_token', 'password_reset_expires'])

            return Response({
                'message': 'Password has been reset successfully. You may now log in with your new password.'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserMeSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserMeSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminUserViewSet(viewsets.ModelViewSet):
    """
    Admin-only users management endpoint.
    GET /api/users — List all users.
    GET /api/users/<id> — Retrieve a user.
    PATCH /api/users/<id> — Update roles / staff / superuser flags.
    """
    queryset = User.objects.prefetch_related('roles').all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminOrSuperUser]
    lookup_field = 'id'
    http_method_names = ['get', 'patch', 'put', 'options', 'head']


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdminOrSuperUser]


class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAdminOrSuperUser]