from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core import signing
from rest_framework_simplejwt.tokens import RefreshToken

import logging
from django.core.mail import send_mail
from django.utils import timezone

from .models import Product
from .serializers import (
    ProductSerializer,
    UserSerializer,
    RegisterSerializer,
    LoginSerializer
)

User = get_user_model()

logger = logging.getLogger(__name__)


class ProductViewSet(viewsets.ModelViewSet):
    """
    API endpoint for full CRUD operations on Products (GET, POST, PUT, DELETE).
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for listing/retrieving Users (read-only — accounts can only
    be created through the Google OAuth flow).
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VERIFY_SALT = 'protech-email-verify'


def _make_verify_token(user_id: str) -> str:
    """Return a URL-safe signed token encoding the user's UUID."""
    return signing.dumps(user_id, salt=VERIFY_SALT)


def _send_verification_email(user) -> None:
    """
    Generate a fresh signed token, store it, and send the verification email.
    Raises nothing — errors are logged and swallowed so registration never fails
    just because email is misconfigured.
    """
    token = _make_verify_token(str(user.id))
    user.email_verification_token = token
    user.save(update_fields=['email_verification_token', 'updated_at'])

    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    subject = "Verify your Protech account"
    message = (
        f"Hello {user.full_name or 'there'},\n\n"
        "Thanks for signing up for Protech!\n\n"
        f"Please verify your email address by clicking the link below:\n"
        f"{verify_url}\n\n"
        "This link expires in 24 hours. If you did not create this account, "
        "you can safely ignore this email.\n\n"
        "\u2014 The Protech Team"
    )
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.error(
            "Failed to send verification email to %s: %s",
            user.email, exc, exc_info=True,
        )


# ---------------------------------------------------------------------------
# Auth Views
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    # Email/password sign-up has been removed — Google OAuth is the only
    # authentication method. This endpoint is intentionally disabled.
    return Response(
        {"error": "Email/password sign-up is disabled. Please sign in with Google.",
         "code": "AUTH_METHOD_DISABLED"},
        status=status.HTTP_410_GONE
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email_view(request):
    # Email verification is no longer applicable — Google OAuth verifies email
    # automatically. This endpoint is intentionally disabled.
    return Response(
        {"error": "Email verification is disabled. Please sign in with Google.",
         "code": "AUTH_METHOD_DISABLED"},
        status=status.HTTP_410_GONE
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_verification_view(request):
    # Email verification is no longer applicable — Google OAuth verifies email
    # automatically. This endpoint is intentionally disabled.
    return Response(
        {"error": "Email verification is disabled. Please sign in with Google.",
         "code": "AUTH_METHOD_DISABLED"},
        status=status.HTTP_410_GONE
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    # Email/password sign-in has been removed — Google OAuth is the only
    # authentication method. This endpoint is intentionally disabled.
    return Response(
        {"error": "Email/password sign-in is disabled. Please sign in with Google.",
         "code": "AUTH_METHOD_DISABLED"},
        status=status.HTTP_410_GONE
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def google_login_view(request):
    """
    Endpoint to receive and verify Google ID Token from the React frontend,
    create or fetch the user, and return JWT authentication tokens.
    """
    import requests as http_requests
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    token = request.data.get('token') or request.data.get('id_token') or request.data.get('access_token')
    if not token:
        return Response({"error": "Google token is required."}, status=status.HTTP_400_BAD_REQUEST)

    id_info = None

    # 1. First attempt: Verify as Google ID Token (JWT)
    try:
        id_info = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10  # Tolerate minor clock drift between server and Google
        )
    except Exception:
        # 2. Second attempt: Verify as Google OAuth2 Access Token
        try:
            userinfo_res = http_requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {token}'},
                timeout=10
            )
            if userinfo_res.status_code == 200:
                id_info = userinfo_res.json()
            else:
                return Response({"error": "Invalid Google token or expired session."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Token verification failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    if not id_info:
        return Response({"error": "Failed to retrieve user profile from Google."}, status=status.HTTP_400_BAD_REQUEST)

    email = id_info.get('email')
    if not email:
        return Response({"error": "Email not provided by Google token."}, status=status.HTTP_400_BAD_REQUEST)
    
    email = email.lower()

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

        refresh = RefreshToken.for_user(user)
        role_name = user.role or user.roles.values_list('name', flat=True).first() or ('admin' if user.is_staff or user.is_superuser else 'user')

        return Response({
            "message": "Google authentication successful!",
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "avatar_url": user.avatar_url,
                "role": role_name
            }
        }, status=status.HTTP_200_OK)
    except Exception as exc:
        logger.exception("Error during Google OAuth sign-in processing: %s", exc)
        return Response({"error": f"Internal error during sign-in: {str(exc)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)