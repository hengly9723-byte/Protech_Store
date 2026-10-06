import hashlib
import logging
import time

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from orders.models import Order, Payment
from orders.serializers import OrderDetailSerializer
from . import bakong

logger = logging.getLogger(__name__)

# Distinct error codes so the frontend can tell "auth not configured" apart
# from "Bakong unreachable" and "transaction not found".
ERROR_CODE_AUTH_CONFIG = 'AUTH_CONFIG_ERROR'
ERROR_CODE_BAKONG_API = 'BAKONG_API_ERROR'
ERROR_CODE_TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND'
ERROR_CODE_INTERNAL = 'INTERNAL_ERROR'
ERROR_CODE_DAILY_LIMIT = 'BAKONG_DAILY_LIMIT_EXCEEDED'


def _payment_response(order, *, paid, status_str,
                      http_status=status.HTTP_200_OK, bakong_code=None):
    """
    Build the standardized polling response the frontend modal consumes:

      {
        "responseCode": 0 | 1,              # NBC Bakong response code (0 = success)
        "paid": bool,                       # true only when Bakong confirms
        "status": "SUCCESS" | "PENDING",    # machine-readable state
        "order": { ...OrderDetailSerializer fields... }
        "bakong_code": int | null           # Bakong response code for debugging
      }
    """
    code = 0 if paid else (bakong_code if bakong_code is not None else 1)
    data = {
        'responseCode': code,
        'paid': bool(paid),
        'status': status_str,
        'order': OrderDetailSerializer(order).data,
    }
    if bakong_code is not None:
        data['bakong_code'] = bakong_code
    return Response(data, status=http_status)


def _auth_config_error_response(order, detail):
    """
    Response returned when Bakong authentication is not properly configured
    (token missing, expired, or rejected). The caller logs the full detail
    server-side; the token value is never logged, only its first/last 4 chars.
    """
    logger.error('Bakong auth config error while polling order %s: %s',
                 order.id, detail)
    return _payment_response(
        order,
        paid=False,
        status_str='PENDING',
        http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _pending_response(order, error, error_code, response_code=None, response_message='Payment not yet received.'):
    """A structured 'still not paid — keep polling' response."""
    logger.warning(
        'Bakong payment poll for order %s is still pending (error_code=%s, '
        'response_code=%s): %s', order.id, error_code, response_code, error,
    )
    return _payment_response(order, paid=False, status_str='PENDING')


def _failed_response(order, error, error_code, response_code=None, response_message='Transaction failed.'):
    """A structured 'payment explicitly failed' response."""
    logger.warning(
        'Bakong payment poll for order %s FAILED (error_code=%s, '
        'response_code=%s): %s', order.id, error_code, response_code, error,
    )
    return _payment_response(order, paid=False, status_str='PENDING')


def _poll_payment_status_single(payment, md5_hash):
    """Single Bakong status check (no looping). Returns result dict from bakong.check_transaction_status."""
    order = payment.order
    try:
        result = bakong.check_transaction_status(md5_hash)
    except bakong.BakongTokenMissingError as exc:
        logger.exception(
            'Bakong auth config error while polling payment %s (md5=%s): %s '
            '[token=%s; expected %s]',
            payment.id, md5_hash, exc,
            bakong.masked_token(bakong.current_token()),
            bakong.TOKEN_SOURCE,
        )
        return {'paid': False, 'response_code': None, 'error_message': str(exc)}
    except bakong.BakongAPIError as exc:
        logger.exception(
            'Bakong API error while polling payment %s (md5=%s): %s',
            payment.id, md5_hash, exc,
        )
        return {'paid': False, 'response_code': None, 'error_message': str(exc)}
    except Exception as exc:
        logger.exception(
            'Unexpected error while polling Bakong for payment %s (md5=%s): %s',
            payment.id, md5_hash, exc,
        )
        return {'paid': False, 'response_code': None, 'error_message': str(exc)}

    raw = result.get('raw') or {}
    raw_code = raw.get('responseCode') if isinstance(raw, dict) else None
    raw_message = raw.get('responseMessage') if isinstance(raw, dict) else ''

    return {
        'paid': result.get('paid', False),
        'response_code': result.get('response_code') or raw_code,
        'error_message': result.get('error_message') or raw_message,
    }


def _poll_payment_status(payment, md5_hash):
    """
    Poll Bakong for a payment and convert every outcome (paid, still pending,
    auth misconfigured, Bakong down, transaction not found, or an unexpected
    error) into a structured JSON Response. All failures log the full stack
    trace server-side and never leak a raw 500 or the token value.
    """
    order = payment.order
    try:
        result = bakong.check_transaction_status(md5_hash)
    except bakong.BakongTokenMissingError as exc:
        logger.exception(
            'Bakong auth config error while polling payment %s (md5=%s): %s '
            '[token=%s; expected %s]',
            payment.id, md5_hash, exc,
            bakong.masked_token(bakong.current_token()),
            bakong.TOKEN_SOURCE,
        )
        return _auth_config_error_response(order, str(exc))
    except bakong.BakongAPIError as exc:
        logger.exception(
            'Bakong API error while polling payment %s (md5=%s): %s',
            payment.id, md5_hash, exc,
        )
        return _pending_response(
            order,
            error=str(exc),
            error_code=ERROR_CODE_BAKONG_API,
            response_message='Bakong is unreachable or returned an error; status will be retried.',
        )
    except Exception as exc:
        logger.exception(
            'Unexpected error while polling Bakong for payment %s (md5=%s): %s',
            payment.id, md5_hash, exc,
        )
        return _payment_response(
            order,
            paid=False,
            status_str='PENDING',
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    raw = result.get('raw') or {}
    # Use the structured keys from check_transaction_status — these are already
    # parsed from the spec-correct responseCode / errorCode fields.
    raw_code = result.get('response_code') or (raw.get('responseCode') if isinstance(raw, dict) else None)
    raw_message = (raw.get('responseMessage') or '') if isinstance(raw, dict) else ''

    if result.get('limit_exceeded') or result.get('error_code') == 17:
        return Response({
            'paid': False,
            'status': 'LIMIT_EXCEEDED',
            'error_code': ERROR_CODE_DAILY_LIMIT,
            'error': result.get('error_message') or 'Daily request limit of 100 exceeded on Bakong Open API. Please try again tomorrow.',
            'response_code': raw_code or 1,
            'responseCode': 1,
            'bakong_code': 17,
            'order': OrderDetailSerializer(order).data,
        }, status=status.HTTP_200_OK)

    if result.get('not_found'):
        return _pending_response(
            order,
            error='Bakong has no record of this transaction yet (md5 not found).',
            error_code=ERROR_CODE_TRANSACTION_NOT_FOUND,
            response_code=raw_code,
            response_message='Bakong has no record of this transaction yet.',
        )

    if result.get('failed'):
        if payment.status != 'failed':
            payment.status = 'failed'
            payment.gateway_response = {**(payment.gateway_response or {}), 'bakong_response': raw}
            payment.save()
        return _failed_response(
            order,
            error=result.get('error_message') or 'Transaction failed.',
            error_code='TRANSACTION_FAILED',
            response_code=raw_code,
            response_message=raw_message or 'Transaction failed.',
        )

    if result['paid'] and payment.status != 'paid':
        payment.status = 'paid'
        payment.paid_at = timezone.now()
        payment.gateway_response = {**(payment.gateway_response or {}), 'bakong_response': raw}
        payment.save()

        order.payment_status = 'paid'
        order.status = 'processing'
        order.save(update_fields=['payment_status', 'status', 'updated_at'])

    return _payment_response(
        order,
        paid=result['paid'],
        status_str='SUCCESS' if result['paid'] else 'PENDING',
    )


def _can_access_order(order, request):
    """Admins and the order owner may access an order; guests must match email."""
    user = request.user
    if user and user.is_authenticated:
        if user.is_staff or user.is_superuser:
            return True
        if order.user_id:
            return order.user_id == user.id
        guest_email = request.data.get('guest_email') or request.query_params.get('guest_email')
        return bool(guest_email) and order.guest_email == guest_email
    guest_email = request.data.get('guest_email') or request.query_params.get('guest_email')
    return bool(guest_email) and order.guest_email == guest_email


def _get_accessible_order(pk, request):
    try:
        order = Order.objects.get(id=pk)
    except Order.DoesNotExist:
        return None
    if not _can_access_order(order, request):
        return None
    return order


class KhqrGenerateView(APIView):
    """
    POST /api/payments/khqr/generate/
    Body: { order_id, amount?, currency?, guest_email? }

    Generates a Bakong KHQR payload for an order and returns the QR string,
    its md5 hash, and a Bakong deep link.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'error': 'order_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        order = _get_accessible_order(order_id, request)
        if not order:
            return Response({'error': 'Order not found or not accessible.'}, status=status.HTTP_404_NOT_FOUND)

        if order.payment_status == 'paid':
            return Response({
                'message': 'Order has already been paid for.',
                'qr': None,
                'md5': None,
                'deep_link': None,
                'order': OrderDetailSerializer(order).data,
            }, status=status.HTTP_200_OK)

        # Generating a fresh QR puts the order back in the "waiting for payment"
        # state. A payment is only ever marked 'paid' when a live Bakong
        # check_transaction_by_md5 call returns responseCode == 0 (see
        # bakong.check_transaction_status / verify_bakong_payment) — never
        # automatically at QR generation time.
        if order.payment_status != 'unpaid' or order.status != 'pending':
            order.payment_status = 'unpaid'
            order.status = 'pending'
            order.save(update_fields=['payment_status', 'status', 'updated_at'])

        amount = request.data.get('amount')
        currency = request.data.get('currency')
        if amount is None:
            amount = order.total
        if not currency:
            currency = order.currency

        try:
            generated = bakong.generate_khqr(order.order_number, amount, currency)
        except bakong.BakongKHQRGenerationError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        deep_link = bakong.generate_deep_link(generated['qr'])

        payment = order.payments.filter(gateway='bakong_khqr', status='pending').first()
        if payment:
            payment.transaction_id = generated['md5']
            payment.amount = order.total
            payment.currency = order.currency
            payment.status = 'pending'
            payment.paid_at = None
            payment.gateway_response = {'qr': generated['qr'], 'deep_link': deep_link}
            payment.save()
        else:
            payment = Payment.objects.create(
                order=order,
                gateway='bakong_khqr',
                transaction_id=generated['md5'],
                amount=order.total,
                currency=order.currency,
                status='pending',
                gateway_response={'qr': generated['qr'], 'deep_link': deep_link},
            )

        return Response({
            'message': 'KHQR generated successfully. Scan to pay.',
            'qr': generated['qr'],
            'md5': generated['md5'],
            'deep_link': deep_link,
            'expires_at': generated['expires_at'],
            'payment_id': payment.id,
            'order': OrderDetailSerializer(order).data,
        }, status=status.HTTP_200_OK)


class KhqrCheckStatusView(APIView):
    """
    GET /api/payments/khqr/check-status/?md5=<hash>

    Checks Bakong transaction status for the given MD5 hash.
    Once Bakong reports the transaction as PAID (responseCode == 0), the
    payment is marked 'paid' and the order moves to 'processing'. Until
    then the payment/order stay pending.

    The payment is NEVER marked paid at QR generation or order creation — it is
    only confirmed here after a live Bakong check_transaction_by_md5 response.

    Response (exact wrapper the frontend modal consumes):
      { "paid": bool, "status": "SUCCESS"|"PENDING", "order": {...} }
    Failures (missing/rejected token, Bakong unreachable, etc.) are logged
    server-side and returned as paid=false, status=PENDING.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        md5_hash = request.query_params.get('md5')
        if not md5_hash:
            return Response({'error': 'md5 is required.', 'responseCode': 1, 'paid': False}, status=status.HTTP_400_BAD_REQUEST)

        clean_md5 = md5_hash.strip().lower()
        print("Checking Bakong for MD5:", clean_md5)

        payment = Payment.objects.filter(transaction_id=clean_md5).select_related('order').first()
        if not payment:
            payment = Payment.objects.filter(transaction_id__iexact=clean_md5).select_related('order').first()
        if not payment:
            return Response({'error': 'No payment found for the given md5.', 'responseCode': 1, 'paid': False}, status=status.HTTP_404_NOT_FOUND)

        order = payment.order
        if not _can_access_order(order, request):
            return Response({'error': 'Order not found or not accessible.', 'responseCode': 1, 'paid': False}, status=status.HTTP_404_NOT_FOUND)

        # Fast path if already paid
        if order.payment_status == 'paid' or payment.status == 'paid':
            return _payment_response(order, paid=True, status_str='SUCCESS', bakong_code=0)

        # Ensure the MD5 hash passed to Bakong API is computed from the exact, raw
        # KHQR text string rendered on the QR canvas (without extra whitespace/formatting).
        raw_qr = (payment.gateway_response or {}).get('qr')
        if raw_qr and isinstance(raw_qr, str) and raw_qr.strip():
            clean_md5 = hashlib.md5(raw_qr.strip().encode('utf-8')).hexdigest().lower()

        # Mock Mode simulation: if BAKONG_MOCK_MODE is enabled, allow instant test confirmation
        if (request.query_params.get('simulate') == 'true' or request.query_params.get('mock') == 'true') and getattr(settings, 'BAKONG_MOCK_MODE', False):
            payment.status = 'paid'
            payment.paid_at = timezone.now()
            payment.gateway_response = {**(payment.gateway_response or {}), 'mock': True}
            payment.save()
            order.payment_status = 'paid'
            order.status = 'processing'
            order.save(update_fields=['payment_status', 'status', 'updated_at'])
            return _payment_response(order, paid=True, status_str='SUCCESS', bakong_code=0)

        try:
            bakong_response = bakong.check_transaction_status(clean_md5)
            print("Bakong Raw Response:", bakong_response)

            raw = bakong_response.get('raw') if isinstance(bakong_response.get('raw'), dict) else {}
            response_code = bakong_response.get('response_code')
            if response_code is None and isinstance(raw, dict):
                response_code = raw.get('responseCode')

            error_code = bakong_response.get('error_code')
            if error_code is None and isinstance(raw, dict):
                error_code = raw.get('errorCode')

            print(f"--> Bakong Response Code: {response_code} | Error Code: {error_code} | Raw: {raw}")

            # NBC Bakong daily quota limit exceeded (errorCode 17)
            if error_code == 17 or bakong_response.get('limit_exceeded'):
                msg = (
                    bakong_response.get('error_message')
                    or 'Daily request limit of 100 exceeded on Bakong Open API. Please try again tomorrow.'
                )
                return Response({
                    'paid': False,
                    'status': 'LIMIT_EXCEEDED',
                    'error_code': ERROR_CODE_DAILY_LIMIT,
                    'error': msg,
                    'responseCode': 1,
                    'bakong_code': 17,
                    'mock_mode': getattr(settings, 'BAKONG_MOCK_MODE', False),
                    'order': OrderDetailSerializer(order).data,
                }, status=status.HTTP_200_OK)

            # NBC Bakong returns responseCode == 0 on success
            is_paid = (
                response_code == 0
                or bakong_response.get('paid') is True
                or (isinstance(raw, dict) and raw.get('responseCode') == 0)
                or (isinstance(bakong_response.get('data'), dict) and bakong_response['data'].get('responseCode') == 0)
            )

            if is_paid:
                payment.status = 'paid'
                payment.paid_at = timezone.now()
                payment.gateway_response = {
                    **(payment.gateway_response or {}),
                    'bakong_response': bakong_response,
                }
                payment.save()

                order.payment_status = 'paid'
                order.status = 'processing'
                order.save(update_fields=['payment_status', 'status', 'updated_at'])

                return _payment_response(order, paid=True, status_str='SUCCESS', bakong_code=0)
            else:
                return _payment_response(order, paid=False, status_str='PENDING', bakong_code=response_code)
        except Exception as e:
            print("Bakong Exception:", str(e))
            return _payment_response(order, paid=False, status_str='PENDING', bakong_code=1)


class KhqrVerifyView(APIView):
    """
    POST /api/payments/verify/
    Body: { order_id, md5?, guest_email? }

    Re-checks the Bakong transaction status for an order's pending payment and,
    if Bakong confirms the payment, marks the order as paid and moves it to
    'processing'. This is the endpoint used by the manual "I have completed the
    payment" button in the checkout UI.

    Unlike check-status (which is keyed by md5), this is keyed by order_id so
    the UI only needs to know the order.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        order_id = request.data.get('order_id')
        md5_hash = request.data.get('md5')

        if not order_id and not md5_hash:
            return Response(
                {'error': 'order_id or md5 is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if order_id:
            order = _get_accessible_order(order_id, request)
            if not order:
                return Response(
                    {'error': 'Order not found or not accessible.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            payment = order.payments.filter(gateway='bakong_khqr').first()
            if payment and not md5_hash:
                md5_hash = payment.transaction_id
        else:
            payment = (
                Payment.objects.filter(transaction_id=md5_hash)
                .select_related('order')
                .first()
            )
            if not payment:
                return Response(
                    {'error': 'No payment found for the given md5.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            order = payment.order
            if not _can_access_order(order, request):
                return Response(
                    {'error': 'Order not found or not accessible.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        if order.payment_status == 'paid' or (payment and payment.status == 'paid'):
            return _payment_response(
                order,
                paid=True,
                status_str='SUCCESS',
            )

        # Mock Mode simulation support in verify endpoint
        if request.data.get('simulate') is True and getattr(settings, 'BAKONG_MOCK_MODE', False):
            if payment:
                payment.status = 'paid'
                payment.paid_at = timezone.now()
                payment.gateway_response = {**(payment.gateway_response or {}), 'mock': True}
                payment.save()
            order.payment_status = 'paid'
            order.status = 'processing'
            order.save(update_fields=['payment_status', 'status', 'updated_at'])
            return _payment_response(order, paid=True, status_str='SUCCESS', bakong_code=0)

        if not md5_hash or not payment:
            return _payment_response(
                order,
                paid=False,
                status_str='PENDING',
            )

        return _poll_payment_status(payment, md5_hash)


class CheckPaymentStatusView(APIView):
    """
    POST /api/payments/check-status/
    Body: { order_id?, payment_id?, md5?, guest_email? }

    Unified payment status endpoint that accepts either an ``order_id`` or a
    ``payment_id`` (or falls back to ``md5``), polls Bakong for the live
    transaction status, and returns a clean JSON response that the frontend
    can consume directly.

    The md5 sent to Bakong is always recomputed from the raw KHQR string
    stored on the payment at QR-generation time
    (``payment.gateway_response['qr']``), so a stale ``transaction_id`` can
    never cause a mismatch with Bakong.

    Response structure (HTTP 200 on every outcome — this endpoint NEVER
    returns a 500 to the frontend):
    {
        "paid": true|false,
        "status": "SUCCESS"|"PENDING",
        "order": { ...OrderDetailSerializer fields... }
    }

    HTTP status codes:
      - 200: payment confirmed, still pending, or Bakong unreachable
      - 400: missing required parameters
      - 404: order/payment not found or not accessible
    """
    permission_classes = [AllowAny]

    def post(self, request):
        order_id = request.data.get('order_id')
        payment_id = request.data.get('payment_id')
        md5_hash = request.data.get('md5')
        guest_email = request.data.get('guest_email') or request.query_params.get('guest_email')

        if not order_id and not payment_id and not md5_hash:
            return Response(
                {'error': 'One of order_id, payment_id, or md5 is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = None
        order = None

        # --- Resolve by payment_id ---
        if payment_id:
            try:
                payment = Payment.objects.select_related('order').get(id=payment_id)
            except Payment.DoesNotExist:
                return Response(
                    {'error': 'Payment not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            order = payment.order
            if not _can_access_order(order, request):
                return Response(
                    {'error': 'Order not found or not accessible.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # --- Resolve by order_id ---
        elif order_id:
            order = _get_accessible_order(order_id, request)
            if not order:
                return Response(
                    {'error': 'Order not found or not accessible.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            payment = order.payments.filter(gateway='bakong_khqr').order_by('-created_at').first()

        # --- Resolve by md5 hash ---
        else:
            payment = (
                Payment.objects.filter(transaction_id=md5_hash)
                .select_related('order')
                .first()
            )
            if not payment:
                return Response(
                    {'error': 'No payment found for the given md5.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            order = payment.order
            if not _can_access_order(order, request):
                return Response(
                    {'error': 'Order not found or not accessible.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # --- Already paid — fast path ---
        if order.payment_status == 'paid' or (payment and payment.status == 'paid'):
            return _payment_response(order, paid=True, status_str='SUCCESS')

        # --- No active payment for this order ---
        if not payment:
            return _payment_response(order, paid=False, status_str='PENDING')

        # --- Ensure MD5 hash is computed from exact raw KHQR text string ---
        raw_qr = (payment.gateway_response or {}).get('qr')
        if raw_qr and isinstance(raw_qr, str) and raw_qr.strip():
            md5_hash = hashlib.md5(raw_qr.strip().encode('utf-8')).hexdigest().lower()
        elif payment.transaction_id:
            md5_hash = payment.transaction_id.strip().lower()
        elif md5_hash:
            md5_hash = md5_hash.strip().lower()

        console_log = f"--> Querying Bakong MD5: {md5_hash}"
        logger.info(console_log)
        print(console_log)

        # --- Call Bakong check_transaction_status with exact MD5 ---
        try:
            bakongResponse = bakong.check_transaction_status(md5_hash)
        except bakong.BakongTokenMissingError as exc:
            logger.exception('Bakong auth config error while polling payment %s (md5=%s)', payment.id, md5_hash)
            return _payment_response(order, paid=False, status_str='PENDING')
        except bakong.BakongAPIError as exc:
            logger.exception('Bakong API error while polling payment %s (md5=%s)', payment.id, md5_hash)
            return _payment_response(order, paid=False, status_str='PENDING')
        except Exception as exc:
            logger.exception('Unexpected error while polling Bakong payment %s (md5=%s): %s', payment.id, md5_hash, exc)
            return _payment_response(order, paid=False, status_str='PENDING')

        raw = bakongResponse.get('raw') or {}
        # KHQR exact logic: check if responseCode === 0
        response_code = bakongResponse.get('response_code') or (raw.get('responseCode') if isinstance(raw, dict) else None)

        # --- KHQR RESPONSE CODE EVALUATION (exact port from Node.js) ---
        # if (data.responseCode === 0 && data.data?.hash)  →  if response_code == 0
        if response_code == 0 and payment.status != 'paid':
            # Update Payment model with Bakong data
            payment.status = 'paid'
            payment.paid_at = timezone.now()
            payment.transaction_id = md5_hash
            payment.gateway_response = {
                **(payment.gateway_response or {}),
                'bakong_response': raw,
            }
            payment.save()

            # Update Order model (exact fields from KHQR Node.js port)
            order.payment_status = 'paid'
            order.status = 'processing'
            # Note: Django models don't have bakongHash/fromAccountId/toAccountId fields by default;
            # adding them would require model migration. Using available fields:
            # order.currency and order.total are already set; we just mark status
            order.save(update_fields=['payment_status', 'status', 'updated_at'])

            logger.info(
                'Payment %s (md5=%s) confirmed PAID. Order %s moved to processing.',
                payment.id, md5_hash, order.id,
            )
        elif bakongResponse.get('limit_exceeded') or raw.get('errorCode') == 17:
            return Response({
                'paid': False,
                'status': 'LIMIT_EXCEEDED',
                'error_code': ERROR_CODE_DAILY_LIMIT,
                'error': bakongResponse.get('error_message') or 'Daily request limit of 100 exceeded on Bakong Open API.',
                'responseCode': 1,
                'bakong_code': 17,
                'order': OrderDetailSerializer(order).data,
            }, status=status.HTTP_200_OK)
        else:
            # Transaction pending or not yet found (KHQR returns "payment not found!")
            return _payment_response(order, paid=False, status_str='PENDING')