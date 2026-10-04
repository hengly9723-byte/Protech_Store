import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import (
    Order,
    OrderItem,
    Payment,
    Refund,
    Shipment,
    Return,
    ReturnItem,
    ShippingConfig,
)
from .serializers import (
    OrderListSerializer,
    OrderDetailSerializer,
    CheckoutSerializer,
    OrderStatusUpdateSerializer,
    CreateRefundSerializer,
    CreateShipmentSerializer,
    CreateReturnSerializer,
    ReturnSerializer,
    RefundSerializer,
    ShipmentSerializer,
)
from marketing.pricing import calculate_variant_promotional_pricing
from shopping.views import get_cart_for_request
from accounts.models import Address
from stock.models import Stock, StockTransaction
from accounts.permissions import IsAdminOrSuperUser, HasPermission
from payments import bakong


class ShippingConfigView(APIView):
    """
    GET/PUT /api/shipping/config/
    GET  — returns the admin-configurable shipping rules (free-shipping
           threshold + flat rate) so the frontend can show accurate estimates.
    PUT  — updates those rules. Only admins may update.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        config = ShippingConfig.get_config()
        return Response({
            'free_shipping_threshold': str(config.free_shipping_threshold),
            'flat_rate': str(config.flat_rate),
        }, status=status.HTTP_200_OK)

    def put(self, request):
        user = request.user
        if not (user and user.is_authenticated and (user.is_staff or user.is_superuser)):
            return Response({'error': 'Admin privileges required.'}, status=status.HTTP_403_FORBIDDEN)

        config = ShippingConfig.get_config()

        flat_rate = request.data.get('flat_rate', request.data.get('shipping_fee'))
        threshold = request.data.get('free_shipping_threshold', request.data.get('shipping_threshold'))

        if flat_rate is None or threshold is None:
            return Response(
                {'error': 'Both flat_rate and free_shipping_threshold are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            flat_rate = Decimal(str(flat_rate)).quantize(Decimal('0.01'))
            threshold = Decimal(str(threshold)).quantize(Decimal('0.01'))
        except Exception:
            return Response(
                {'error': 'flat_rate and free_shipping_threshold must be valid amounts.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if flat_rate < 0 or threshold < 0:
            return Response(
                {'error': 'Shipping values cannot be negative.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        config.flat_rate = flat_rate
        config.free_shipping_threshold = threshold
        config.save()

        return Response({
            'message': 'Shipping settings updated successfully.',
            'free_shipping_threshold': str(config.free_shipping_threshold),
            'flat_rate': str(config.flat_rate),
        }, status=status.HTTP_200_OK)


class CheckoutView(APIView):
    """
    POST /api/checkout
    Converts the active cart into an Order:
    - Atomically snapshots items and prices
    - Decrements available stock & logs stock_transactions
    - Clears the cart
    - Wrapped entirely in a single atomic database transaction
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        cart, session_id = get_cart_for_request(request)
        cart_items = list(cart.items.select_related('variant', 'variant__product').all())

        if not cart_items:
            return Response({"error": "Your cart is empty. Cannot proceed with checkout."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user and request.user.is_authenticated else None
        guest_email = serializer.validated_data.get('guest_email')

        if not user and not guest_email:
            return Response({"error": "Please provide a guest_email or log in to checkout."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Resolve Shipping Address Snapshot
        shipping_addr_id = serializer.validated_data.get('shipping_address_id')
        shipping_addr_payload = serializer.validated_data.get('shipping_address')

        if shipping_addr_id and user:
            addr = Address.objects.filter(id=shipping_addr_id, user=user).first()
            if not addr:
                return Response({"error": "Selected shipping address not found."}, status=status.HTTP_400_BAD_REQUEST)
            shipping_snapshot = {
                'recipient_name': addr.recipient_name or user.full_name,
                'phone': addr.phone,
                'address_line_1': addr.address_line_1,
                'address_line_2': addr.address_line_2,
                'city': addr.city,
                'state': addr.state,
                'postal_code': addr.postal_code,
                'country': addr.country,
            }
        elif shipping_addr_payload:
            shipping_snapshot = shipping_addr_payload
        elif user:
            default_addr = Address.objects.filter(user=user, is_default=True).first() or Address.objects.filter(user=user).first()
            if default_addr:
                shipping_snapshot = {
                    'recipient_name': default_addr.recipient_name or user.full_name,
                    'phone': default_addr.phone,
                    'address_line_1': default_addr.address_line_1,
                    'address_line_2': default_addr.address_line_2,
                    'city': default_addr.city,
                    'state': default_addr.state,
                    'postal_code': default_addr.postal_code,
                    'country': default_addr.country,
                }
            else:
                shipping_snapshot = {'recipient_name': user.full_name, 'address_line_1': 'Default Address'}
        else:
            shipping_snapshot = {'address_line_1': 'Standard Guest Shipping'}

        billing_snapshot = serializer.validated_data.get('billing_address') or shipping_snapshot

        # 2. Atomic Order Creation & Stock Deduction
        with transaction.atomic():
            # Validate and lock stock for each cart item, and apply active promotional pricing
            for item in cart_items:
                stock = Stock.objects.select_for_update().filter(variant=item.variant).first()
                available = stock.quantity_available if stock else 0
                if available < item.quantity:
                    return Response({
                        "error": f"Insufficient stock for '{item.variant.product.name} ({item.variant.sku})'. Required: {item.quantity}, Available: {available}."
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Ensure promotional finalPrice is automatically applied to unit_price
                pricing = calculate_variant_promotional_pricing(item.variant)
                if item.unit_price != pricing['final_price']:
                    item.unit_price = pricing['final_price']
                    item.save(update_fields=['unit_price', 'updated_at'])

            # Calculate Order Financials using promotional unit prices
            subtotal = sum(Decimal(str(item.unit_price)) * item.quantity for item in cart_items)
            discount = Decimal('0.00')

            # Optional Discount Code Application
            discount_code_str = serializer.validated_data.get('discount_code')
            discount_obj = None
            if discount_code_str:
                from marketing.models import DiscountCode
                now = timezone.now()
                discount_obj = DiscountCode.objects.select_for_update().filter(code__iexact=discount_code_str.strip()).first()
                if discount_obj and discount_obj.is_active:
                    is_valid_dates = (not discount_obj.starts_at or now >= discount_obj.starts_at) and (not discount_obj.expires_at or now <= discount_obj.expires_at)
                    is_valid_limit = not discount_obj.usage_limit or discount_obj.usage_count < discount_obj.usage_limit
                    is_valid_min = not discount_obj.minimum_order_value or subtotal >= discount_obj.minimum_order_value
                    if is_valid_dates and is_valid_limit and is_valid_min:
                        discount = discount_obj.calculate_discount(subtotal)
                        discount_obj.usage_count += 1
                        discount_obj.save()

            shipping_cost = ShippingConfig.get_config().calculate_shipping(subtotal)
            tax = ((subtotal - discount) * Decimal('0.08')).quantize(Decimal('0.01')) if subtotal > discount else Decimal('0.00')
            total = max(Decimal('0.00'), subtotal + shipping_cost + tax - discount)

            order_num = f"ORD-{timezone.now().strftime('%Y%m%d%H%M')}-{uuid.uuid4().hex[:6].upper()}"

            order = Order.objects.create(
                user=user,
                guest_email=guest_email if not user else None,
                order_number=order_num,
                status='pending',
                payment_method='bakong_khqr',
                payment_status='unpaid',
                fulfillment_status='unfulfilled',
                currency=cart.currency,
                subtotal=subtotal,
                discount=discount,
                shipping_cost=shipping_cost,
                tax=tax,
                total=total,
                shipping_address_snapshot=shipping_snapshot,
                billing_address_snapshot=billing_snapshot,
            )

            # Create OrderItems & Deduct Stock
            for item in cart_items:
                variant = item.variant
                product = variant.product

                OrderItem.objects.create(
                    order=order,
                    product=product,
                    variant=variant,
                    product_name_snapshot=product.name,
                    sku_snapshot=variant.sku,
                    variant_snapshot={
                        'name': variant.name,
                        'weight': str(variant.weight) if variant.weight else None,
                        'barcode': variant.barcode,
                    },
                    unit_price=item.unit_price,
                    quantity=item.quantity,
                    discount=Decimal('0.00'),
                    tax=Decimal('0.00'),
                    total=Decimal(str(item.unit_price)) * item.quantity,
                )

                # Deduct stock
                stock = Stock.objects.get(variant=variant)
                stock.quantity_available -= item.quantity
                stock.save()

                # Log stock transaction audit record
                StockTransaction.objects.create(
                    variant=variant,
                    type='sale',
                    quantity=-item.quantity,
                    reference_type='order',
                    reference_id=order.id,
                    note=f"Order checkout #{order.order_number}",
                    created_by=user
                )

            # Clear cart items and mark cart converted
            cart.items.all().delete()
            cart.status = 'converted'
            cart.save()

        return Response({
            "message": "Order created successfully!",
            "order": OrderDetailSerializer(order).data
        }, status=status.HTTP_201_CREATED)


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/orders — List orders (customer sees own orders, admin sees all).
    GET /api/orders/<id> — Get detailed order with items, payment, shipment status.
    """
    permission_classes = [AllowAny]
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.action == 'list':
            return OrderListSerializer
        return OrderDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.prefetch_related(
            'items',
            'payments',
            'shipments',
            'refunds',
            'returns__items'
        )

        if user and user.is_authenticated:
            if user.is_staff or user.is_superuser:
                return qs.all()
            return qs.filter(user=user)
        
        # Guest lookup by session/guest email or order_number
        guest_email = self.request.query_params.get('guest_email')
        if guest_email:
            return qs.filter(guest_email=guest_email)
        return qs.none()


class OrderPayView(APIView):
    """
    POST /api/orders/<id>/pay

    DEPRECATED. This endpoint previously mocked a successful gateway payment and
    instantly set order.payment_status='paid' / payment.status='paid'.

    That behavior is removed: no code path may mark an order paid without a live
    Bakong confirmation. A payment is only confirmed when the frontend polls
    GET /api/payments/khqr/check-status/ and Bakong's check_transaction_by_md5
    returns responseCode == 0 (see payments.bakong.check_transaction_status).

    Use the Bakong KHQR flow instead:
      POST /api/payments/khqr/generate/   -> returns qr + md5
      GET  /api/payments/khqr/check-status/?md5=<md5> -> polls Bakong
    """
    permission_classes = [AllowAny]

    def post(self, request, id):
        try:
            order = Order.objects.get(id=id)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "error": (
                "Direct/mock payments are disabled. Complete the payment via the "
                "Bakong KHQR flow: generate a QR and the payment page verifies it "
                "against Bakong before the order is marked paid."
            ),
            "order": OrderDetailSerializer(order).data,
        }, status=status.HTTP_400_BAD_REQUEST)


class OrderStatusUpdateView(APIView):
    """
    PATCH /api/orders/<id>/status
    Admin-only endpoint to update order status or fulfillment status.
    """
    permission_classes = [IsAdminOrSuperUser]

    def patch(self, request, id):
        try:
            order = Order.objects.get(id=id)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = OrderStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        for field, val in serializer.validated_data.items():
            setattr(order, field, val)
        order.save()

        return Response({
            "message": f"Order #{order.order_number} status updated.",
            "order": OrderDetailSerializer(order).data
        }, status=status.HTTP_200_OK)


class OrderRefundView(APIView):
    """
    POST /api/orders/<id>/refund
    Admin-only endpoint to issue an order refund.
    """
    permission_classes = [IsAdminOrSuperUser]

    def post(self, request, id):
        try:
            order = Order.objects.get(id=id)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        payment = order.payments.filter(status='paid').first()
        if not payment:
            return Response({"error": "No paid payment record found to refund for this order."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CreateRefundSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data['amount']
        reason = serializer.validated_data.get('reason', '')

        with transaction.atomic():
            refund = Refund.objects.create(
                payment=payment,
                order=order,
                amount=amount,
                reason=reason,
                status='completed',
                processed_by=request.user if request.user.is_authenticated else None,
                processed_at=timezone.now(),
            )

            order.payment_status = 'refunded' if amount >= order.total else 'partially_refunded'
            order.save()

        return Response({
            "message": f"Refund of ${amount} processed successfully.",
            "refund": RefundSerializer(refund).data,
            "order": OrderDetailSerializer(order).data
        }, status=status.HTTP_201_CREATED)


class OrderShipView(APIView):
    """
    POST /api/orders/<id>/ship
    Admin-only endpoint to dispatch a shipment with tracking info.
    """
    permission_classes = [IsAdminOrSuperUser]

    def post(self, request, id):
        try:
            order = Order.objects.get(id=id)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateShipmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        carrier = serializer.validated_data.get('carrier') or 'Standard Courier'
        tracking_num = serializer.validated_data.get('tracking_number')
        if not tracking_num:
            clean_carrier = ''.join(c for c in carrier.upper() if c.isalnum())[:4] or "TRK"
            tracking_num = f"{clean_carrier}-{timezone.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        shipment_status = serializer.validated_data.get('status', 'shipped')

        with transaction.atomic():
            shipment = Shipment.objects.create(
                order=order,
                carrier=carrier,
                tracking_number=tracking_num,
                status=shipment_status,
                shipped_at=timezone.now(),
            )

            order.fulfillment_status = 'fulfilled'
            order.save()

        return Response({
            "message": f"Shipment #{tracking_num} created via {carrier}.",
            "shipment": ShipmentSerializer(shipment).data,
            "order": OrderDetailSerializer(order).data
        }, status=status.HTTP_201_CREATED)


class OrderReturnView(APIView):
    """
    POST /api/orders/<id>/return
    Customer endpoint to submit a return request for items in an order.
    """
    permission_classes = [AllowAny]

    def post(self, request, id):
        try:
            order = Order.objects.get(id=id)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateReturnSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reason = serializer.validated_data['reason']
        resolution = serializer.validated_data.get('resolution', 'refund')
        items_data = serializer.validated_data['items']

        user = request.user if request.user and request.user.is_authenticated else None

        with transaction.atomic():
            return_req = Return.objects.create(
                order=order,
                user=user,
                status='requested',
                reason=reason,
                resolution=resolution,
            )

            for item_input in items_data:
                order_item_id = item_input['order_item_id']
                try:
                    order_item = order.items.get(id=order_item_id)
                except OrderItem.DoesNotExist:
                    return Response({"error": f"Order item {order_item_id} not found in this order."}, status=status.HTTP_400_BAD_REQUEST)

                ReturnItem.objects.create(
                    return_request=return_req,
                    order_item=order_item,
                    quantity=item_input.get('quantity', 1),
                    condition=item_input.get('condition', 'unopened'),
                    note=item_input.get('note', '')
                )

        return Response({
            "message": "Return request submitted successfully. Awaiting approval.",
            "return": ReturnSerializer(return_req).data
        }, status=status.HTTP_201_CREATED)


class ReturnStatusUpdateView(APIView):
    """
    PATCH /api/orders/returns/<id>
    Admin-only endpoint to approve or reject a return request.
    """
    permission_classes = [IsAdminOrSuperUser]

    def patch(self, request, id):
        try:
            return_req = Return.objects.get(id=id)
        except Return.DoesNotExist:
            return Response({"error": "Return request not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if new_status not in ('approved', 'rejected', 'completed'):
            return Response({"error": "Status must be 'approved', 'rejected', or 'completed'."}, status=status.HTTP_400_BAD_REQUEST)

        return_req.status = new_status
        return_req.save()

        return Response({
            "message": f"Return request status updated to {new_status}.",
            "return": ReturnSerializer(return_req).data
        }, status=status.HTTP_200_OK)
