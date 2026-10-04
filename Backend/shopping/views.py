import uuid
from django.db import transaction
from django.db.models import Prefetch
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import Cart, CartItem, Wishlist, WishlistItem
from .serializers import (
    CartSerializer,
    CartItemSerializer,
    AddToCartSerializer,
    UpdateCartItemSerializer,
    WishlistSerializer,
    WishlistItemSerializer,
    AddToWishlistSerializer,
    WishlistToggleSerializer,
)
from catalog.models import ProductVariant, Product
from marketing.pricing import calculate_variant_promotional_pricing


def get_cart_for_request(request) -> tuple[Cart, str]:
    """
    Resolves or auto-creates the active cart for either an authenticated user
    or a guest session using the 'X-Session-ID' header or session_id query param.
    Automatically merges guest cart items into the user's cart if transitioning from guest to logged in.
    """
    session_id = request.headers.get('X-Session-ID') or request.query_params.get('session_id')
    if not session_id:
        session_id = str(uuid.uuid4())

    if request.user and request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user, status='active')

        # If a guest session cart exists, merge its items into the user's authenticated cart
        if session_id:
            guest_cart = Cart.objects.filter(session_id=session_id, status='active').exclude(id=cart.id).first()
            if guest_cart:
                for item in guest_cart.items.all():
                    existing_item = cart.items.filter(variant=item.variant).first()
                    if existing_item:
                        existing_item.quantity += item.quantity
                        existing_item.save()
                    else:
                        item.cart = cart
                        item.save()
                guest_cart.status = 'converted'
                guest_cart.save()
    else:
        cart, _ = Cart.objects.get_or_create(session_id=session_id, user=None, status='active')

    return cart, session_id


class CartView(APIView):
    """
    GET /api/cart — Get (or auto-create) the active cart with all item details & subtotals.
    DELETE /api/cart — Clear all items from the current active cart.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        cart, session_id = get_cart_for_request(request)
        # Dynamically synchronize cart item prices with active promotion pricing
        for it in cart.items.select_related('variant', 'variant__product').all():
            pricing = calculate_variant_promotional_pricing(it.variant)
            if it.unit_price != pricing['final_price']:
                it.unit_price = pricing['final_price']
                it.save(update_fields=['unit_price', 'updated_at'])

        serializer = CartSerializer(cart)
        response = Response(serializer.data, status=status.HTTP_200_OK)
        response['X-Session-ID'] = session_id
        return response

    def delete(self, request):
        cart, session_id = get_cart_for_request(request)
        deleted_count, _ = cart.items.all().delete()
        serializer = CartSerializer(cart)
        response = Response({
            "message": f"Cart cleared ({deleted_count} items removed).",
            "cart": serializer.data
        }, status=status.HTTP_200_OK)
        response['X-Session-ID'] = session_id
        return response


class CartItemView(APIView):
    """
    POST /api/cart/items — Add a variant to cart with price snapshot and stock check.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        variant = serializer.validated_data['variant']
        quantity = serializer.validated_data['quantity']
        cart, session_id = get_cart_for_request(request)

        # Check existing quantity in cart
        existing_item = cart.items.filter(variant=variant).first()
        new_quantity = (existing_item.quantity + quantity) if existing_item else quantity

        # Verify stock availability for combined quantity
        stock = getattr(variant, 'stock', None)
        available = stock.quantity_available if stock else 0
        if available < new_quantity:
            return Response({
                "error": f"Cannot add {quantity} more. Maximum available stock for {variant.sku} is {available} (already have {existing_item.quantity if existing_item else 0} in cart)."
            }, status=status.HTTP_400_BAD_REQUEST)

        pricing = calculate_variant_promotional_pricing(variant)
        final_unit_price = pricing['final_price']

        with transaction.atomic():
            if existing_item:
                existing_item.quantity = new_quantity
                existing_item.unit_price = final_unit_price  # Promotional price snapshot
                existing_item.save()
                item = existing_item
            else:
                item = CartItem.objects.create(
                    cart=cart,
                    variant=variant,
                    quantity=quantity,
                    unit_price=final_unit_price  # Promotional price snapshot
                )

        response = Response({
            "message": f"Added {quantity}x {variant.sku} to cart.",
            "item": CartItemSerializer(item).data,
            "cart": CartSerializer(cart).data
        }, status=status.HTTP_201_CREATED if not existing_item else status.HTTP_200_OK)
        response['X-Session-ID'] = session_id
        return response


class CartItemDetailView(APIView):
    """
    PATCH /api/cart/items/<id> — Update item quantity (with stock check).
    DELETE /api/cart/items/<id> — Remove item from cart.
    """
    permission_classes = [AllowAny]

    def patch(self, request, id):
        cart, session_id = get_cart_for_request(request)
        try:
            item = cart.items.get(id=id)
        except CartItem.DoesNotExist:
            return Response({"error": "Cart item not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateCartItemSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_qty = serializer.validated_data['quantity']
        stock = getattr(item.variant, 'stock', None)
        available = stock.quantity_available if stock else 0

        if available < new_qty:
            return Response({
                "error": f"Insufficient stock. Only {available} items available for {item.variant.sku}."
            }, status=status.HTTP_400_BAD_REQUEST)

        pricing = calculate_variant_promotional_pricing(item.variant)
        item.unit_price = pricing['final_price']
        item.quantity = new_qty
        item.save()

        response = Response({
            "message": f"Updated quantity to {new_qty}.",
            "item": CartItemSerializer(item).data,
            "cart": CartSerializer(cart).data
        }, status=status.HTTP_200_OK)
        response['X-Session-ID'] = session_id
        return response

    def delete(self, request, id):
        cart, session_id = get_cart_for_request(request)
        try:
            item = cart.items.get(id=id)
        except CartItem.DoesNotExist:
            return Response({"error": "Cart item not found."}, status=status.HTTP_404_NOT_FOUND)

        item_name = item.variant.sku
        item.delete()

        response = Response({
            "message": f"Removed {item_name} from cart.",
            "cart": CartSerializer(cart).data
        }, status=status.HTTP_200_OK)
        response['X-Session-ID'] = session_id
        return response


class WishlistToggleView(APIView):
    """
    POST /api/wishlist/toggle — Atomic, low-latency toggle for wishlist state (supports both variants and products).
    Accepts: { product_id: UUID | null, variant_id: UUID | null, desired_state: bool | null }
    Returns: { success: bool, wishlisted: bool, item_id: UUID, product_id: UUID, variant_id: UUID | null, total_items: int, message: str }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WishlistToggleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        product = serializer.validated_data['resolved_product']
        variant = serializer.validated_data.get('resolved_variant')
        desired_state = serializer.validated_data.get('desired_state')

        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)

        with transaction.atomic():
            if variant:
                existing_item = wishlist.items.filter(variant=variant).first()
            else:
                existing_item = wishlist.items.filter(product=product, variant__isnull=True).first()

            if desired_state is True or (desired_state is None and not existing_item):
                if not existing_item:
                    existing_item = WishlistItem.objects.create(
                        wishlist=wishlist,
                        product=product,
                        variant=variant
                    )
                wishlisted = True
                name = variant.sku if variant else product.name
                message = f"{name} added to wishlist."
            else:
                if existing_item:
                    existing_item.delete()
                wishlisted = False
                name = variant.sku if variant else product.name
                message = f"{name} removed from wishlist."

            total_items = wishlist.items.count()

        item_id = str(variant.id if variant else product.id)
        return Response({
            "success": True,
            "wishlisted": wishlisted,
            "item_id": item_id,
            "product_id": str(product.id),
            "variant_id": str(variant.id) if variant else None,
            "total_items": total_items,
            "message": message,
        }, status=status.HTTP_200_OK)


class WishlistView(APIView):
    """
    GET /api/wishlist — Get the current authenticated user's wishlist (optimized with Prefetch).
    POST /api/wishlist — Add a product/variant to the user's wishlist.
    DELETE /api/wishlist — Remove a product/variant by ?variant_id=<id> or ?product_id=<id>.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Optimized with prefetch_related and select_related to eliminate N+1 queries
        wishlist = (
            Wishlist.objects.filter(user=request.user)
            .prefetch_related(
                Prefetch(
                    'items',
                    queryset=WishlistItem.objects.select_related(
                        'product', 'variant'
                    ).prefetch_related('product__images', 'variant__images')
                )
            )
            .first()
        )
        if not wishlist:
            wishlist, _ = Wishlist.objects.get_or_create(user=request.user)

        serializer = WishlistSerializer(wishlist)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AddToWishlistSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        product = serializer.validated_data['resolved_product']
        variant = serializer.validated_data.get('resolved_variant')
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)

        if variant:
            item, created = WishlistItem.objects.get_or_create(
                wishlist=wishlist,
                variant=variant,
                defaults={'product': product}
            )
        else:
            item, created = WishlistItem.objects.get_or_create(
                wishlist=wishlist,
                product=product,
                variant=None
            )

        total_items = wishlist.items.count()
        item_id = str(variant.id if variant else product.id)
        name = variant.sku if variant else product.name

        return Response({
            "success": True,
            "wishlisted": True,
            "message": f"{name} added to wishlist." if created else f"{name} already in wishlist.",
            "item_id": item_id,
            "item": WishlistItemSerializer(item).data,
            "total_items": total_items,
            "wishlist": {
                "id": str(wishlist.id),
                "total_items": total_items,
            }
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request):
        item_id = (
            request.query_params.get('variant_id') or
            request.query_params.get('product_id') or
            request.data.get('variant_id') or
            request.data.get('product_id')
        )
        if not item_id:
            return Response({"error": "variant_id or product_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)

        # Check by variant first, then by product
        deleted_count, _ = wishlist.items.filter(variant_id=item_id).delete()
        if deleted_count == 0:
            deleted_count, _ = wishlist.items.filter(product_id=item_id).delete()

        if deleted_count == 0:
            return Response({"error": "Item not found in wishlist."}, status=status.HTTP_404_NOT_FOUND)

        total_items = wishlist.items.count()
        return Response({
            "success": True,
            "wishlisted": False,
            "item_id": str(item_id),
            "total_items": total_items,
            "message": "Item removed from wishlist.",
            "wishlist": {
                "id": str(wishlist.id),
                "total_items": total_items,
            }
        }, status=status.HTTP_200_OK)


class WishlistItemDetailView(APIView):
    """
    DELETE /api/wishlist/items/<id> — Remove a specific wishlist entry by entry UUID.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, id):
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        try:
            item = wishlist.items.get(id=id)
        except WishlistItem.DoesNotExist:
            return Response({"error": "Wishlist entry not found."}, status=status.HTTP_404_NOT_FOUND)

        item.delete()
        total_items = wishlist.items.count()
        return Response({
            "success": True,
            "wishlisted": False,
            "id": str(id),
            "total_items": total_items,
            "message": "Item removed from wishlist.",
            "wishlist": {
                "id": str(wishlist.id),
                "total_items": total_items,
            }
        }, status=status.HTTP_200_OK)
