from decimal import Decimal
from django.utils import timezone
from django.db.models import Q
from .models import Promotion


def get_active_promotion_for_product(product):
    """
    Finds the active promotion applying to the given product.
    Checks:
    - is_active is True
    - starts_at is null or starts_at <= now
    - ends_at is null or ends_at >= now
    """
    if not product:
        return None
    now = timezone.now()
    return Promotion.objects.filter(
        products=product,
        is_active=True
    ).filter(
        Q(starts_at__isnull=True) | Q(starts_at__lte=now)
    ).filter(
        Q(ends_at__isnull=True) | Q(ends_at__gte=now)
    ).order_by('-created_at').first()


def calculate_variant_promotional_pricing(variant):
    """
    Calculates promotional pricing for a product variant according to baseline rules:
    - Baseline: compare_at_price (if > 0) else price
    - If active promotion exists:
      - percentage: baseline * (1 - discount_value / 100)
      - fixed: max(0, baseline - discount_value)
    Returns:
    {
      'final_price': Decimal,
      'baseline_price': Decimal,
      'has_discount': bool,
      'discount_badge': str,
      'promotion': Promotion | None
    }
    """
    regular_price = Decimal(str(variant.price or 0))
    raw_compare = variant.compare_at_price or (variant.product.compare_at_price if getattr(variant, 'product', None) else None)
    baseline_price = Decimal(str(raw_compare)) if (raw_compare and Decimal(str(raw_compare)) > 0) else regular_price

    product = getattr(variant, 'product', None)
    promo = get_active_promotion_for_product(product)

    if not promo:
        has_regular_disc = baseline_price > regular_price and baseline_price > 0
        disc_pct = round(((baseline_price - regular_price) / baseline_price) * 100) if has_regular_disc else 0
        return {
            'final_price': regular_price,
            'baseline_price': baseline_price,
            'has_discount': has_regular_disc,
            'discount_badge': f"-{disc_pct}%" if has_regular_disc else "",
            'promotion': None,
        }

    val = Decimal(str(promo.discount_value or 0))
    if promo.discount_type == 'percentage':
        final_price = baseline_price * (Decimal('1.00') - (val / Decimal('100.00')))
        badge = f"-{int(val)}% OFF"
    else:  # fixed
        final_price = max(Decimal('0.00'), baseline_price - val)
        badge = f"-${val:.2f} OFF"

    final_price = max(Decimal('0.00'), final_price.quantize(Decimal('0.01')))

    return {
        'final_price': final_price,
        'baseline_price': baseline_price,
        'has_discount': True,
        'discount_badge': badge,
        'promotion': promo,
    }
