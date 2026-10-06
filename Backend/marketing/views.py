import os
import uuid
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import (
    Review,
    DiscountCode,
    Promotion,
)
from .serializers import (
    ReviewSerializer,
    CreateReviewSerializer,
    ReviewStatusUpdateSerializer,
    DiscountCodeSerializer,
    ValidateDiscountCodeSerializer,
    PromotionSerializer,
)
from catalog.models import Product
from orders.models import OrderItem, Order
from accounts.permissions import IsAdminOrSuperUser


class ProductReviewsView(APIView):
    """
    GET /api/products/<id>/reviews — Public list of approved reviews for a product.
    POST /api/products/<id>/reviews — Logged-in user creates a review if they have purchased the product.
    """
    permission_classes = [AllowAny]

    def get(self, request, product_id):
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        qs = Review.objects.filter(product=product)

        # Non-staff users see approved reviews + their own pending reviews
        user = request.user
        if not (user and (user.is_staff or user.is_superuser)):
            if user and user.is_authenticated:
                qs = qs.filter(Q(status='approved') | Q(user=user))
            else:
                qs = qs.filter(status='approved')

        serializer = ReviewSerializer(qs, many=True)
        return Response({
            "product_id": str(product.id),
            "product_name": product.name,
            "reviews_count": qs.count(),
            "reviews": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request, product_id):
        if not request.user or not request.user.is_authenticated:
            return Response({"error": "Authentication required to submit a review."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Verify whether the customer purchased and received this product
        order_item = OrderItem.objects.filter(
            order__user=request.user,
            product=product,
            order__payment_status='paid'
        ).first()

        if not order_item:
            return Response({
                "error": "You can only review products you have purchased. No qualifying order found."
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if user already reviewed this product
        existing_review = Review.objects.filter(product=product, user=request.user).first()
        if existing_review:
            # Update existing review
            existing_review.rating = serializer.validated_data['rating']
            existing_review.title = serializer.validated_data.get('title', existing_review.title)
            existing_review.content = serializer.validated_data.get('content', existing_review.content)
            existing_review.is_verified_purchase = True
            existing_review.order_item = order_item
            existing_review.status = 'approved'
            existing_review.save()
            return Response({
                "message": "Your review has been updated.",
                "review": ReviewSerializer(existing_review).data
            }, status=status.HTTP_200_OK)

        review = Review.objects.create(
            product=product,
            user=request.user,
            order_item=order_item,
            rating=serializer.validated_data['rating'],
            title=serializer.validated_data.get('title', ''),
            content=serializer.validated_data.get('content', ''),
            is_verified_purchase=True,
            status='approved'  # Verified purchases are automatically approved
        )

        return Response({
            "message": "Review submitted successfully!",
            "review": ReviewSerializer(review).data
        }, status=status.HTTP_201_CREATED)


class ReviewAdminStatusView(APIView):
    """
    PATCH /api/reviews/<id>
    Admin-only endpoint to approve or reject a product review.
    """
    permission_classes = [IsAdminOrSuperUser]

    def patch(self, request, id):
        try:
            review = Review.objects.get(id=id)
        except Review.DoesNotExist:
            return Response({"error": "Review not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReviewStatusUpdateSerializer(review, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response({
            "message": f"Review status updated to {review.status}.",
            "review": ReviewSerializer(review).data
        }, status=status.HTTP_200_OK)


class AdminReviewListView(APIView):
    """
    GET /api/reviews — Admin-only list of all reviews for moderation.
    Query params: ?status=pending|approved|rejected
    """
    permission_classes = [IsAdminOrSuperUser]

    def get(self, request):
        qs = Review.objects.select_related('product', 'user').all()

        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        serializer = ReviewSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ValidateDiscountCodeView(APIView):
    """
    POST /api/discount-codes/validate
    Body: { "code": "SUMMER20", "cart_total": 100.00 }
    Validates discount code eligibility, expiration, usage limits, and calculates savings.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ValidateDiscountCodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        code_str = serializer.validated_data['code'].strip().upper()
        cart_total = serializer.validated_data['cart_total']
        now = timezone.now()

        discount = DiscountCode.objects.filter(code__iexact=code_str).first()
        if not discount:
            return Response({"valid": False, "error": "Invalid discount code."}, status=status.HTTP_400_BAD_REQUEST)

        if not discount.is_active:
            return Response({"valid": False, "error": "This discount code is no longer active."}, status=status.HTTP_400_BAD_REQUEST)

        if discount.starts_at and now < discount.starts_at:
            return Response({"valid": False, "error": "This discount code is not yet valid."}, status=status.HTTP_400_BAD_REQUEST)

        if discount.expires_at and now > discount.expires_at:
            return Response({"valid": False, "error": "This discount code has expired."}, status=status.HTTP_400_BAD_REQUEST)

        if discount.usage_limit and discount.usage_count >= discount.usage_limit:
            return Response({"valid": False, "error": "This discount code has reached its maximum usage limit."}, status=status.HTTP_400_BAD_REQUEST)

        if discount.minimum_order_value and cart_total < discount.minimum_order_value:
            return Response({
                "valid": False,
                "error": f"Minimum order amount of ${discount.minimum_order_value} required to use this code (current subtotal: ${cart_total})."
            }, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user and request.user.is_authenticated else None
        if discount.per_customer_limit and user:
            # Check user usage count
            user_used_count = Order.objects.filter(user=user, discount__gt=0).count()
            if user_used_count >= discount.per_customer_limit:
                return Response({
                    "valid": False,
                    "error": "You have already reached the maximum usage limit for this discount code."
                }, status=status.HTTP_400_BAD_REQUEST)

        discount_amount = discount.calculate_discount(cart_total)

        return Response({
            "valid": True,
            "code": discount.code,
            "type": discount.type,
            "value": str(discount.value),
            "discount_amount": str(discount_amount),
            "new_subtotal": str(max(Decimal('0.00'), cart_total - discount_amount)),
            "message": f"Discount code '{discount.code}' applied successfully!"
        }, status=status.HTTP_200_OK)


class DiscountCodeViewSet(viewsets.ModelViewSet):
    """
    CRUD /api/discount-codes/
    Admin-only CRUD operations on promotional discount codes.
    """
    queryset = DiscountCode.objects.prefetch_related('products', 'categories').all()
    serializer_class = DiscountCodeSerializer
    permission_classes = [IsAdminOrSuperUser]
    lookup_field = 'id'


class PromotionViewSet(viewsets.ModelViewSet):
    """
    CRUD /api/promotions/
    Admin CRUD + Public Active promotions list.
    """
    queryset = Promotion.objects.prefetch_related(
        'products__images',
        'products__brand',
        'products__category',
        'products__type',
        'products__variants'
    ).all()
    serializer_class = PromotionSerializer
    permission_classes = [IsAdminOrSuperUser]
    lookup_field = 'id'

    def get_permissions(self):
        if self.action in ('list_active', 'retrieve'):
            return [AllowAny()]
        return [IsAdminOrSuperUser()]

    @action(detail=False, methods=['get'], url_path='active', permission_classes=[AllowAny])
    def list_active(self, request):
        now = timezone.now()
        active_promos = Promotion.objects.filter(
            is_active=True
        ).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now)
        ).filter(
            Q(ends_at__isnull=True) | Q(ends_at__gte=now)
        ).prefetch_related(
            'products__images',
            'products__brand',
            'products__category',
            'products__type',
            'products__variants'
        )

        serializer = PromotionSerializer(active_promos, many=True, context={'request': request})
        response = Response(serializer.data, status=status.HTTP_200_OK)
        response['Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=600'
        return response

    @action(
        detail=False,
        methods=['post'],
        url_path='upload-banner',
        parser_classes=[MultiPartParser, FormParser, JSONParser],
        permission_classes=[IsAdminOrSuperUser]
    )
    def upload_banner(self, request):
        file = request.FILES.get('banner') or request.FILES.get('file') or request.FILES.get('image')
        if not file:
            return Response({'error': 'No image file was uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate file size (max 25MB)
        if file.size > 25 * 1024 * 1024:
            return Response({'error': 'Image file exceeds 25MB size limit.'}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(file.name)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']:
            ext = '.jpg'

        filename = f"banner_{uuid.uuid4().hex[:12]}{ext}"
        banners_dir = os.path.join(settings.MEDIA_ROOT, 'banners')
        os.makedirs(banners_dir, exist_ok=True)

        file_path = os.path.join(banners_dir, filename)
        with open(file_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        banner_url = request.build_absolute_uri(f"{settings.MEDIA_URL}banners/{filename}")
        return Response({
            'banner_image_url': banner_url,
            'bannerImageUrl': banner_url
        }, status=status.HTTP_200_OK)
