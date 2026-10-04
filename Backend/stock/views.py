from django.db import transaction
from django.db.models import F, Q
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination

from .models import Stock, StockTransaction
from .serializers import StockSerializer, StockAdjustSerializer, StockTransactionSerializer
from catalog.models import ProductVariant
from accounts.permissions import IsAdminOrSuperUser, HasPermission


class StockPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class StockListView(APIView):
    """
    GET /api/stock/ — Admin-only list of all stock levels with variant info.
    Query params: ?search=..., ?product=<uuid>, ?page_size=...
    """
    permission_classes = [IsAdminOrSuperUser]

    def get(self, request):
        qs = Stock.objects.select_related('variant', 'variant__product')

        product_id = request.query_params.get('product')
        if product_id:
            qs = qs.filter(variant__product_id=product_id)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(variant__sku__icontains=search) |
                Q(variant__name__icontains=search) |
                Q(variant__product__name__icontains=search)
            )

        paginator = StockPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = StockSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class VariantStockView(APIView):
    """
    GET /api/stock/<variant_id>
    Public endpoint to check the real-time stock availability for a specific variant.
    """
    permission_classes = [AllowAny]

    def get(self, request, variant_id):
        try:
            variant = ProductVariant.objects.get(id=variant_id)
        except (ProductVariant.DoesNotExist, ValueError):
            return Response({"error": "Product variant not found."}, status=status.HTTP_404_NOT_FOUND)

        stock, _ = Stock.objects.get_or_create(variant=variant)
        serializer = StockSerializer(stock)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StockAdjustView(APIView):
    """
    POST /api/stock/<variant_id>/adjust
    Admin-only endpoint to perform atomic stock adjustments and log audit transactions.
    """
    permission_classes = [IsAdminOrSuperUser]

    def post(self, request, variant_id):
        try:
            variant = ProductVariant.objects.get(id=variant_id)
        except (ProductVariant.DoesNotExist, ValueError):
            return Response({"error": "Product variant not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StockAdjustSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        qty_delta = serializer.validated_data['quantity']
        tx_type = serializer.validated_data.get('type', 'adjustment')
        note = serializer.validated_data.get('note', '')
        ref_type = serializer.validated_data.get('reference_type')
        ref_id = serializer.validated_data.get('reference_id')

        # Atomic transaction: Update stock & insert stock_transaction record
        with transaction.atomic():
            stock, _ = Stock.objects.select_for_update().get_or_create(variant=variant)

            # Calculate updated quantities based on transaction type
            if tx_type in ('restock', 'return'):
                stock.quantity_available += qty_delta
            elif tx_type == 'damaged':
                # Positive delta means moving to damaged
                stock.quantity_damaged += abs(qty_delta)
                stock.quantity_available -= abs(qty_delta)
            elif tx_type == 'sale':
                stock.quantity_available -= abs(qty_delta)
            else:  # General adjustment
                stock.quantity_available += qty_delta

            if stock.quantity_available < 0:
                return Response(
                    {"error": f"Insufficient stock. Available quantity cannot drop below 0 (current: {stock.quantity_available + qty_delta})."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            stock.save()

            # Record audit transaction
            stock_tx = StockTransaction.objects.create(
                variant=variant,
                type=tx_type,
                quantity=qty_delta,
                reference_type=ref_type,
                reference_id=ref_id,
                note=note,
                created_by=request.user if request.user.is_authenticated else None
            )

        return Response({
            "message": f"Stock for {variant.sku} adjusted successfully ({qty_delta:+d}).",
            "stock": StockSerializer(stock).data,
            "transaction": StockTransactionSerializer(stock_tx).data
        }, status=status.HTTP_200_OK)


class LowStockAlertView(APIView):
    """
    GET /api/stock/low
    Admin-only endpoint returning all variants where quantity_available <= reorder_level.
    """
    permission_classes = [IsAdminOrSuperUser]
    pagination_class = StockPagination

    def get(self, request):
        low_stock_qs = Stock.objects.filter(
            quantity_available__lte=F('reorder_level')
        ).select_related('variant', 'variant__product')

        paginator = StockPagination()
        page = paginator.paginate_queryset(low_stock_qs, request)
        serializer = StockSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class StockTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/stock/transactions/
    Admin-only viewset to query the chronological audit history of stock adjustments.
    """
    queryset = StockTransaction.objects.select_related('variant', 'variant__product', 'created_by')
    serializer_class = StockTransactionSerializer
    permission_classes = [IsAdminOrSuperUser]
    pagination_class = StockPagination

    def get_queryset(self):
        qs = super().get_queryset()
        variant_id = self.request.query_params.get('variant') or self.request.query_params.get('variant_id')
        if variant_id:
            qs = qs.filter(variant_id=variant_id)
        tx_type = self.request.query_params.get('type')
        if tx_type:
            qs = qs.filter(type=tx_type)
        return qs
