"""
Bakong PayWay / KHQR integration helpers.

Ported from the MyPortfolio project (Express + bakong-khqr) into Django.

The KHQR payload is generated locally using the standard EMVCo / KHQR TLV
format plus CRC16 (exactly matching the `bakong-khqr` npm package), and the
md5 hash identifies the transaction with Bakong's `check_transaction_by_md5`
endpoint. The merchant Bakong API token is only ever held server-side.
"""

import base64
import binascii
import hashlib
import json
import logging
import time
import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# EMVCo / KHQR tag constants (mirrors src/constant/index.js -> emv)
TAG_PAYLOAD_FORMAT_INDICATOR = '00'
TAG_POINT_OF_INITIATION_METHOD = '01'
TAG_MERCHANT_ACCOUNT_INFORMATION_INDIVIDUAL = '29'
TAG_BAKONG_ACCOUNT_IDENTIFIER = '00'
TAG_MERCHANT_CATEGORY_CODE = '52'
TAG_TRANSACTION_CURRENCY = '53'
TAG_TRANSACTION_AMOUNT = '54'
TAG_COUNTRY_CODE = '58'
TAG_MERCHANT_NAME = '59'
TAG_MERCHANT_CITY = '60'
TAG_ADDITIONAL_DATA = '62'
TAG_CRC = '63'
TAG_TIMESTAMP = '99'
TAG_CREATION_TIMESTAMP = '00'
TAG_EXPIRATION_TIMESTAMP = '01'

DEFAULT_PAYLOAD_FORMAT_INDICATOR = '01'
DYNAMIC_QR = '12'
DEFAULT_MERCHANT_CATEGORY_CODE = '5999'
DEFAULT_COUNTRY_CODE = 'KH'
DEFAULT_MERCHANT_CITY = 'Phnom Penh'
CRC_LENGTH = '04'

CURRENCY_USD = 840
CURRENCY_KHR = 116

# How long a dynamic KHQR stays valid (matches MyPortfolio's 30 minutes).
QR_EXPIRY_SECONDS = 30 * 60

_MAX_BAKONG_ACCOUNT_LENGTH = 32
_MAX_MERCHANT_NAME_LENGTH = 25
_MAX_MERCHANT_CITY_LENGTH = 15
_MAX_MERCHANT_CATEGORY_CODE_LENGTH = 4


class BakongConfigError(Exception):
    pass


class BakongKHQRGenerationError(Exception):
    pass


class BakongAPIError(Exception):
    pass


class BakongTokenMissingError(BakongAPIError):
    """Raised when the merchant Bakong token is not configured server-side."""


class BakongTokenExpiredError(BakongTokenMissingError):
    """Raised when the configured merchant Bakong token has expired or is
    rejected by the Bakong gateway (HTTP 401 or errorCode 6). Subclasses the
    missing-token error so existing callers treat both as an authentication
    configuration problem rather than a payment status."""


class BakongTokenRenewalError(BakongTokenMissingError):
    """Raised when token renewal via /v1/renew_token fails (bad email, network
    error, etc.). Treated uniformly as AUTH_CONFIG_ERROR by callers."""


# Which Django setting / env var holds the token/email. Used ONLY in log
# messages so operators know exactly where to look. Values are never logged.
TOKEN_SOURCE = 'settings.BAKONG_TOKEN (env var BAKONG_TOKEN)'
EMAIL_SOURCE = 'settings.BAKONG_EMAIL (env var BAKONG_EMAIL)'
TOKEN_EXPIRY_WARNING_SECONDS = 7 * 24 * 60 * 60  # warn when < 7 days remain

# Bakong API error codes (from the Open API spec)
BAKONG_ERROR_NOT_FOUND = 1    # Transaction not found / pending
BAKONG_ERROR_FAILED = 3       # Transaction explicitly failed
BAKONG_ERROR_UNAUTHORIZED = 6 # Token invalid/expired → trigger renewal


def _jwt_expiry(token):
    """
    Extract the ``exp`` claim from a Bakong JWT without verifying its
    signature (we do not hold Bakong's signing secret). Returns a unix
    timestamp, or None when the token is not a decodable JWT. Only used for
    expiry diagnostics/logging.
    """
    if not token or not isinstance(token, str):
        return None
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + '==').decode('utf-8'))
        exp = payload.get('exp')
        return int(exp) if exp else None
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError, binascii.Error):
        return None


def _expiry_diagnostics(token):
    """
    Return (expiry_timestamp_or_None, message_or_None) describing the token's
    expiry state for logging. Never returns the token itself.
    """
    exp = _jwt_expiry(token)
    if not exp:
        return None, None
    remaining = exp - time.time()
    if remaining <= 0:
        expired_at = datetime.utcfromtimestamp(exp).isoformat() + 'Z'
        return exp, (
            f'BAKONG_TOKEN has EXPIRED (exp={expired_at}). Generate a new token '
            f'from the NBC developer portal and update {TOKEN_SOURCE}.'
        )
    if remaining < TOKEN_EXPIRY_WARNING_SECONDS:
        days = int(remaining // 86400)
        return exp, (
            f'BAKONG_TOKEN will expire in ~{days} day(s). Renew it from the NBC '
            f'developer portal before it lapses or payment verification will break.'
        )
    return exp, None


def masked_token(token):
    """
    Return a masked representation of the Bakong JWT for log messages: the
    first and last 4 characters separated by ellipses. The full token value is
    never logged or exposed. Returns '<unset>' when no token is configured.
    """
    if not token:
        return '<unset>'
    return f'{token[:4]}...{token[-4:]}'


# The last token read from settings, used only for masked diagnostics in logs.
_last_token = ''


def current_token():
    """Return the Bakong token most recently read from settings (diagnostics)."""
    return _last_token


# A stable device identifier sent with every Bakong API call. Bakong's gateway
# expects an X-Device-Id / X-Request-Id pair on requests even though only
# Authorization + Content-Type are documented as mandatory.
_DEVICE_ID = 'protech-django-payments'


def merchant_config():
    """Return the Bakong merchant credentials/config from Django settings."""
    global _last_token
    cfg = {
        'bakong_account_id': getattr(settings, 'BAKONG_MERCHANT_ID', '') or 'ly_sokheng1@bkrt',
        'merchant_name': getattr(settings, 'BAKONG_MERCHANT_NAME', '') or 'SOKHENG LY',
        'merchant_city': getattr(settings, 'BAKONG_MERCHANT_CITY', '') or 'PHNOM PENH',
        'base_url': getattr(settings, 'BAKONG_BASE_URL', '') or 'https://api-bakong.nbc.gov.kh',
        'token': getattr(settings, 'BAKONG_TOKEN', '') or '',
        'email': getattr(settings, 'BAKONG_EMAIL', '') or '',
    }

    token = cfg['token']
    _last_token = token
    if token:
        _, message = _expiry_diagnostics(token)
        if message:
            if 'EXPIRED' in message:
                logger.error('Bakong auth config error: %s', message)
            else:
                logger.warning('Bakong auth config warning: %s', message)
    else:
        logger.error(
            'Bakong auth config error: token is missing. Expected %s to be set '
            'in the deployment environment (e.g. Vercel project env vars or '
            'Backend/.env). Payment status checks will fail until it is configured.',
            TOKEN_SOURCE,
        )

    return cfg


def _build_crc16_table():
    """Generate the CRC-CCITT (0x1021) lookup table used by bakong-khqr."""
    table = []
    for i in range(256):
        crc = i << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
        table.append(crc)
    return table


_CRC_TABLE = _build_crc16_table()


def crc16(data):
    """
    Compute the 4-hex-char uppercase CRC16 of a string (port of
    src/helper/crc16.js in bakong-khqr).
    """
    crc = 0xFFFF
    for byte in data.encode('utf-8'):
        index = (byte ^ (crc >> 8)) & 0xFF
        crc = (_CRC_TABLE[index] ^ (crc << 8)) & 0xFFFF
    return format(crc & 0xFFFF, '04X')


def _tlv(tag, value):
    """Tag-Length-Value encoding (mirrors tagLengthString.js)."""
    value = str(value)
    length = len(value)
    length_str = f'{length:02d}' if length < 10 else str(length)
    return f'{tag}{length_str}{value}'


def _validate_account_id(bakong_account_id):
    if not bakong_account_id:
        raise BakongKHQRGenerationError('BAKONG_ACCOUNT_ID_REQUIRED')
    if len(bakong_account_id) > _MAX_BAKONG_ACCOUNT_LENGTH:
        raise BakongKHQRGenerationError('BAKONG_ACCOUNT_ID_LENGTH_INVALID')
    if '@' not in bakong_account_id:
        raise BakongKHQRGenerationError('BAKONG_ACCOUNT_ID_INVALID')


def _build_khqr(bakong_account_id, merchant_name, merchant_city, amount, currency, bill_number=None, store_label=None):
    """
    Generate a dynamic individual KHQR payload string (port of
    controller/generateKHQR.js + model/information.js for IndividualInfo).
    """
    _validate_account_id(bakong_account_id)

    merchant_name = merchant_name.upper()[: _MAX_MERCHANT_NAME_LENGTH]
    merchant_city = merchant_city.upper()[: _MAX_MERCHANT_CITY_LENGTH]

    currency_code = CURRENCY_KHR if currency == 'KHR' else CURRENCY_USD
    if amount and amount > 0:
        if currency == 'KHR':
            if amount != amount.to_integral_value():
                raise BakongKHQRGenerationError('TRANSACTION_AMOUNT_INVALID')
            amount_value = str(int(amount.to_integral_value()))
        else:
            rounded = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if rounded == rounded.to_integral_value():
                amount_value = str(int(rounded))
            else:
                amount_value = f'{rounded:.2f}'
    else:
        amount_value = None

    tags = [
        _tlv(TAG_PAYLOAD_FORMAT_INDICATOR, DEFAULT_PAYLOAD_FORMAT_INDICATOR),
        _tlv(TAG_POINT_OF_INITIATION_METHOD, DYNAMIC_QR),
        # Merchant Account Information (29) -> Bakong Account Identifier (00)
        _tlv(TAG_MERCHANT_ACCOUNT_INFORMATION_INDIVIDUAL,
             _tlv(TAG_BAKONG_ACCOUNT_IDENTIFIER, bakong_account_id)),
        _tlv(TAG_MERCHANT_CATEGORY_CODE, DEFAULT_MERCHANT_CATEGORY_CODE),
        _tlv(TAG_TRANSACTION_CURRENCY, currency_code),
    ]

    if amount_value:
        tags.append(_tlv(TAG_TRANSACTION_AMOUNT, amount_value))

    tags.append(_tlv(TAG_COUNTRY_CODE, DEFAULT_COUNTRY_CODE))
    tags.append(_tlv(TAG_MERCHANT_NAME, merchant_name))
    tags.append(_tlv(TAG_MERCHANT_CITY, merchant_city))

    if bill_number or store_label:
        additional_data = ''
        if bill_number:
            additional_data += _tlv('01', bill_number[:25])
        if store_label:
            additional_data += _tlv('03', store_label[:25])
        tags.append(_tlv(TAG_ADDITIONAL_DATA, additional_data))

    now_ms = int(time.time() * 1000)
    expiration_ms = now_ms + QR_EXPIRY_SECONDS * 1000
    tags.append(_tlv(TAG_TIMESTAMP,
                     _tlv(TAG_CREATION_TIMESTAMP, now_ms)
                     + _tlv(TAG_EXPIRATION_TIMESTAMP, expiration_ms)))

    khqr_no_crc = ''.join(tags)
    khqr = khqr_no_crc + TAG_CRC + CRC_LENGTH
    khqr += crc16(khqr)
    return khqr


def generate_khqr(order_number, amount, currency='USD'):
    """
    Generate a Bakong KHQR for the given amount and return the payload string
    plus its md5 hash (the transaction hash used for status polling).
    """
    cfg = merchant_config()

    try:
        amount_decimal = amount if isinstance(amount, Decimal) else Decimal(str(amount))
    except Exception:
        amount_decimal = Decimal('0')

    try:
        payload = _build_khqr(
            bakong_account_id=cfg['bakong_account_id'],
            merchant_name=cfg['merchant_name'],
            merchant_city=cfg['merchant_city'],
            amount=amount_decimal,
            currency=currency,
            bill_number=order_number,
            store_label=cfg['merchant_name'],
        )
    except BakongKHQRGenerationError as exc:
        raise BakongKHQRGenerationError(f'KHQR generation failed: {exc}') from exc

    md5_hash = hashlib.md5(payload.encode('utf-8')).hexdigest()
    return {
        'qr': payload,
        'md5': md5_hash,
        'expires_at': time.time() + QR_EXPIRY_SECONDS,
    }


def _auth_headers(token):
    """Headers required by the Bakong Open API for authenticated requests."""
    return {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}',
        'X-Device-Id': _DEVICE_ID,
        'X-Request-Id': str(uuid.uuid4()),
    }


# ---------------------------------------------------------------------------
# Token renewal  (POST /v1/renew_token)
# ---------------------------------------------------------------------------

def renew_bakong_token(timeout=10):
    """
    Attempt to renew the Bakong API token via the official renew endpoint.

    Endpoint: POST {BAKONG_BASE_URL}/v1/renew_token
    Payload:  {"email": BAKONG_EMAIL}
    Response: {"errorCode": 0, "data": {"token": "<new_jwt>"}}

    On success:
      - Updates ``settings.BAKONG_TOKEN`` in-process (takes effect immediately
        for the retry in the same request; persists until the process restarts).
      - Returns the new token string.

    On failure:
      - Raises ``BakongTokenRenewalError`` (subclass of BakongTokenMissingError
        so callers handle it uniformly as AUTH_CONFIG_ERROR).

    Requirements:
      - ``BAKONG_EMAIL`` must be set in the environment / settings.
      - The email must match the registered NBC developer account.
    """
    cfg = merchant_config()
    email = cfg.get('email') or ''
    if not email:
        raise BakongTokenRenewalError(
            f'Cannot renew BAKONG_TOKEN: BAKONG_EMAIL is not configured. '
            f'Set {EMAIL_SOURCE} to the email registered on the NBC developer '
            f'portal so the backend can auto-renew expired tokens.'
        )

    base_url = cfg['base_url'].rstrip('/')
    url = f'{base_url}/v1/renew_token'
    logger.info('Bakong token renewal: requesting new token for email %s', email)

    try:
        response = requests.post(
            url,
            json={'email': email},
            headers={'Content-Type': 'application/json', 'X-Device-Id': _DEVICE_ID},
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        raise BakongTokenRenewalError(
            f'Bakong token renewal network error: {exc}'
        ) from exc
    except ValueError as exc:
        raise BakongTokenRenewalError(
            'Bakong token renewal: unreadable response from /v1/renew_token'
        ) from exc

    error_code = data.get('errorCode')
    if error_code not in (0, None):
        raise BakongTokenRenewalError(
            f'Bakong token renewal failed (errorCode={error_code}): '
            f'{data.get("errorMessage", data.get("responseMessage", ""))}'
        )

    new_token = (data.get('data') or {}).get('token') or ''
    if not new_token:
        raise BakongTokenRenewalError(
            'Bakong token renewal: /v1/renew_token returned errorCode 0 but '
            'data.token is absent. Check the Bakong API response structure.'
        )

    # Persist in-process so the immediate retry picks up the fresh token.
    settings.BAKONG_TOKEN = new_token
    global _last_token
    _last_token = new_token
    logger.info(
        'Bakong token renewed successfully (new token: %s)',
        masked_token(new_token),
    )
    return new_token


def generate_deep_link(qr_payload, timeout=10):
    """
    Ask Bakong to shorten the QR into a deep link so the customer can open the
    Bakong app directly. Returns the short link or None (non-fatal on failure).
    """
    cfg = merchant_config()
    if not cfg['token']:
        logger.debug(
            'generate_deep_link skipped: no Bakong token configured '
            '(expected %s). Deep link will be absent but QR still works.',
            TOKEN_SOURCE,
        )
        return None

    url = f"{cfg['base_url'].rstrip('/')}/v1/generate_deeplink_by_qr"
    try:
        response = requests.post(
            url,
            json={'qr': qr_payload},
            headers=_auth_headers(cfg['token']),
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()
        if data.get('errorCode') in (4, 5):
            return None
        return data.get('data', {}).get('shortLink')
    except requests.RequestException:
        return None


def _do_check_transaction(md5_hash, token, base_url, timeout=10):
    """
    Internal: single POST to /v1/check_transaction_by_md5. Returns parsed JSON.
    Raises BakongTokenExpiredError on HTTP 401 or errorCode 6 (UNAUTHORIZED).
    Raises BakongAPIError on other network/HTTP errors.
    """
    url = f"{base_url.rstrip('/')}/v1/check_transaction_by_md5"
    clean_md5 = str(md5_hash).strip().lower()
    try:
        response = requests.post(
            url,
            json={'md5': clean_md5},
            headers=_auth_headers(token),
            timeout=timeout,
        )
    except requests.RequestException as exc:
        raise BakongAPIError(f'Bakong status check failed: {exc}') from exc

    if response.status_code == 401:
        logger.error(
            'Bakong auth config error: Bakong rejected the Authorization token '
            '(HTTP 401). Expected a valid token at %s. Response: %s',
            TOKEN_SOURCE, response.text[:200],
        )
        raise BakongTokenExpiredError(
            'Bakong rejected the configured BAKONG_TOKEN (HTTP 401). '
            'The backend will attempt to renew it automatically if BAKONG_EMAIL is configured.'
        )

    if response.status_code >= 400:
        raise BakongAPIError(
            f'Bakong rejected the request (HTTP {response.status_code}): '
            f'{response.text[:200]}'
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise BakongAPIError('Bakong returned an unreadable response.') from exc

    # errorCode 6 = UNAUTHORIZED at the application layer (token rejected)
    response_code, error_code, _ = _classify_response(data)
    if error_code == BAKONG_ERROR_UNAUTHORIZED or response_code == BAKONG_ERROR_UNAUTHORIZED:
        raise BakongTokenExpiredError(
            f'Bakong returned errorCode {BAKONG_ERROR_UNAUTHORIZED} (UNAUTHORIZED). '
            'The backend will attempt to renew the token automatically if BAKONG_EMAIL is configured.'
        )

    return data


def check_transaction_status(md5_hash, timeout=10):
    """
    Poll Bakong's ``check_transaction_by_md5`` endpoint for a transaction.

    Returns a dict with:
      - paid: bool — True when Bakong confirms a completed transaction
      - not_found: bool — True when Bakong has no record of the md5 yet
      - failed: bool — True when Bakong explicitly reports a failed transaction
      - error_code / error_message: Bakong's raw response code and message
      - raw: the upstream JSON response

    Raises BakongTokenMissingError / BakongTokenExpiredError when the auth
    token is missing, expired, or rejected (a server configuration problem)
    and BakongAPIError for transport/upstream failures. Callers should surface
    the token errors as AUTH_CONFIG_ERROR and only treat transport failures as
    "still pending".

    Auto-renewal: when the token is rejected (HTTP 401 or errorCode 6), one
    renewal attempt is made via ``renew_bakong_token()`` and the request is
    retried with the fresh token. Requires ``BAKONG_EMAIL`` to be configured.

    A payment is only ever confirmed when a live ``check_transaction_by_md5``
    call returns responseCode == 0 (with non-null data). There is no mock or
    auto-completion path in this codebase: ``paid`` can never become True
    without a real Bakong API response.
    """
    # Only validate the token before polling Bakong.
    cfg = merchant_config()
    token = cfg['token']
    if not token:
        raise BakongTokenMissingError(
            f'BAKONG_TOKEN is missing/empty (expected {TOKEN_SOURCE}). '
            'Set it in the deployment environment before polling Bakong.'
        )

    exp, exp_message = _expiry_diagnostics(token)
    if exp and exp <= time.time():
        # Token demonstrably expired by JWT exp — try renewal before giving up.
        logger.warning('BAKONG_TOKEN is locally expired; attempting auto-renewal.')
        try:
            token = renew_bakong_token()
        except BakongTokenRenewalError:
            raise BakongTokenExpiredError(exp_message)

    # First attempt.
    try:
        data = _do_check_transaction(md5_hash, token, cfg['base_url'], timeout)
    except BakongTokenExpiredError:
        # Token rejected by Bakong (HTTP 401 or errorCode 6). Attempt renewal
        # once and retry if BAKONG_EMAIL is configured.
        logger.warning(
            'Bakong token rejected during status check; attempting auto-renewal '
            '[token=%s; expected %s]',
            masked_token(token), TOKEN_SOURCE,
        )
        try:
            token = renew_bakong_token()
        except BakongTokenRenewalError as renewal_exc:
            raise BakongTokenExpiredError(
                f'Bakong token rejected and auto-renewal failed: {renewal_exc}'
            ) from renewal_exc
        # Retry once with the fresh token.
        data = _do_check_transaction(md5_hash, token, cfg['base_url'], timeout)

    response_code, error_code, message = _classify_response(data)

    # Per Bakong spec:
    #   responseCode == 0                     → transaction found and PAID
    #   responseCode == 1, errorCode == 1     → transaction not found yet
    #   responseCode == 1, errorCode == 3     → transaction explicitly failed
    paid = (response_code == 0)
    not_found = (error_code == BAKONG_ERROR_NOT_FOUND)
    failed = (error_code == BAKONG_ERROR_FAILED)
    return {
        'paid': paid,
        'not_found': not_found,
        'failed': failed,
        'response_code': response_code,
        'error_code': error_code,
        'error_message': message,
        'raw': data,
    }


def _classify_response(data):
    """
    Parse the Bakong API response per the official Open API spec.

    Bakong's top-level structure is always:
      {
        "responseCode": 0 | 1,   # 0 = success, 1 = failure
        "responseMessage": "...",
        "errorCode": 0|1|3|5|6|9, # detail code (0 = success, 1 = not found, etc.)
        "data": { ... } | null
      }

    Returns (response_code, error_code, message) where:
      - response_code: top-level responseCode (0 = paid/success, 1 = failure)
      - error_code: top-level errorCode (the detail; 1=not found, 3=failed, 6=unauthorized)
      - message: human-readable responseMessage
    """
    if not isinstance(data, dict):
        return None, None, ''
    response_code = data.get('responseCode')
    error_code = data.get('errorCode')
    message = data.get('responseMessage') or data.get('errorMessage') or ''
    return response_code, error_code, message


# ---------------------------------------------------------------------------
# High-level service: verify_bakong_payment()
# ---------------------------------------------------------------------------

def verify_bakong_payment(payment_instance):
    """
    Verify a Bakong KHQR payment for the given ``Payment`` model instance.

    This is the primary service function called by views that need to check
    whether a customer has completed a Bakong KHQR payment.

    Business logic (Bakong Open API response codes)
    -----------------------------------------------
    - responseCode == 0  → Payment confirmed. Mark Payment.status='paid',
                           set Payment.paid_at, set Order.payment_status='paid'
                           and Order.status='processing'.
    - errorCode == 1     → Transaction not found yet (keep status='pending').
    - errorCode == 3     → Transaction explicitly failed → mark status='failed'.
    - errorCode == 6     → Unauthorized → auto-renew token and retry (handled
                           inside check_transaction_status — transparent to
                           this function).
    - BakongTokenMissingError / BakongTokenExpiredError → AUTH_CONFIG_ERROR.
    - BakongAPIError (network/transport) → treat as transient PENDING.

    Parameters
    ----------
    payment_instance : orders.models.Payment
        Must have ``.transaction_id`` (md5 hash) and ``.order`` populated.

    Returns
    -------
    dict:
      - paid (bool)
      - status (str): 'SUCCESS' | 'PENDING' | 'FAILED' | 'AUTH_CONFIG_ERROR'
      - error (str | None)
      - error_code (str | None)
      - response_code (int | None): Bakong's raw responseCode
      - response_message (str): Bakong's raw responseMessage
    """
    from django.utils import timezone as _tz  # local import to avoid circular

    payment = payment_instance
    order = payment.order
    md5_hash = payment.transaction_id

    if not md5_hash:
        return {
            'paid': False,
            'status': 'PENDING',
            'error': 'Payment has no transaction hash (md5). Re-generate the KHQR.',
            'error_code': 'TRANSACTION_NOT_FOUND',
            'response_code': None,
            'response_message': 'No md5 hash recorded for this payment.',
        }

    # Already confirmed — short-circuit without hitting Bakong again.
    if payment.status == 'paid':
        return {
            'paid': True,
            'status': 'SUCCESS',
            'error': None,
            'error_code': None,
            'response_code': 0,
            'response_message': 'Payment already confirmed.',
        }

    try:
        result = check_transaction_status(md5_hash)
    except BakongTokenMissingError as exc:
        logger.exception(
            'Bakong auth config error in verify_bakong_payment for payment %s '
            '(md5=%s): %s [token=%s; expected %s]',
            payment.id, md5_hash, exc, masked_token(current_token()), TOKEN_SOURCE,
        )
        return {
            'paid': False,
            'status': 'AUTH_CONFIG_ERROR',
            'error': str(exc),
            'error_code': 'AUTH_CONFIG_ERROR',
            'response_code': None,
            'response_message': 'Payment status cannot be verified automatically.',
        }
    except BakongAPIError as exc:
        logger.exception(
            'Bakong API error in verify_bakong_payment for payment %s (md5=%s): %s',
            payment.id, md5_hash, exc,
        )
        return {
            'paid': False,
            'status': 'PENDING',
            'error': str(exc),
            'error_code': 'BAKONG_API_ERROR',
            'response_code': None,
            'response_message': 'Bakong is unreachable; status will be retried.',
        }

    raw = result.get('raw') or {}
    raw_code = raw.get('responseCode') if isinstance(raw, dict) else None
    raw_message = (raw.get('responseMessage') or '') if isinstance(raw, dict) else ''

    # Transaction explicitly failed (errorCode 3)
    if result.get('failed'):
        payment.status = 'failed'
        payment.gateway_response = {**(payment.gateway_response or {}), 'bakong_response': raw}
        payment.save()
        return {
            'paid': False,
            'status': 'FAILED',
            'error': result.get('error_message') or 'Transaction failed.',
            'error_code': 'TRANSACTION_FAILED',
            'response_code': raw_code,
            'response_message': raw_message or 'Transaction failed.',
        }

    # Not found yet — customer has not completed payment
    if result.get('not_found'):
        return {
            'paid': False,
            'status': 'PENDING',
            'error': 'Bakong has no record of this transaction yet.',
            'error_code': 'TRANSACTION_NOT_FOUND',
            'response_code': raw_code,
            'response_message': raw_message or 'Bakong has no record of this transaction yet.',
        }

    # Payment confirmed (responseCode 0 + data present)
    if result['paid']:
        if payment.status != 'paid':
            payment.status = 'paid'
            payment.paid_at = _tz.now()
            payment.gateway_response = {**(payment.gateway_response or {}), 'bakong_response': raw}
            payment.save()

            order.payment_status = 'paid'
            order.status = 'processing'
            order.save(update_fields=['payment_status', 'status', 'updated_at'])

            logger.info(
                'Payment %s (md5=%s) confirmed PAID. Order %s moved to processing.',
                payment.id, md5_hash, order.id,
            )

        return {
            'paid': True,
            'status': 'SUCCESS',
            'error': None,
            'error_code': None,
            'response_code': raw_code,
            'response_message': raw_message or 'Payment received.',
        }

    # Non-zero responseCode, but not specifically not_found/failed — still pending.
    return {
        'paid': False,
        'status': 'PENDING',
        'error': result.get('error_message') or 'Payment not yet received.',
        'error_code': None,
        'response_code': raw_code,
        'response_message': raw_message or 'Payment not yet received.',
    }
