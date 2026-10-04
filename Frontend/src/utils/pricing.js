/**
 * Protech Promotional Pricing Calculation Utility
 *
 * Implements non-stacking baseline price rules for active promotions:
 * 1. Checks if a product belongs to an active promotion (active === true and startsAt <= now <= endsAt).
 * 2. Baseline Price Rule:
 *    - If product has a compareAtPrice (original MSRP/full price), uses compareAtPrice as baseline.
 *    - Otherwise, falls back to price as baseline.
 * 3. Discount Calculation:
 *    - If discountType === 'percentage': finalPrice = baselinePrice * (1 - discountValue / 100)
 *    - If discountType === 'fixed': finalPrice = Math.max(0, baselinePrice - discountValue)
 * 4. Returns:
 *    { finalPrice, displayOriginalPrice: baselinePrice, hasDiscount: boolean, discountBadge: string, promotion: object | null }
 */

/**
 * Checks if a promotion is currently active at given reference timestamp.
 *
 * @param {object} promo - Promotion object
 * @param {Date|number} [now=new Date()] - Reference timestamp
 * @returns {boolean}
 */
export const isPromotionActive = (promo, now = new Date()) => {
  if (!promo) return false;
  const isActive = promo.is_active ?? promo.active ?? true;
  if (!isActive) return false;

  const currentMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const startsAt = promo.starts_at || promo.startsAt;
  const endsAt = promo.ends_at || promo.endsAt;

  if (startsAt && new Date(startsAt).getTime() > currentMs) {
    return false;
  }
  if (endsAt && new Date(endsAt).getTime() < currentMs) {
    return false;
  }
  return true;
};

/**
 * Checks if a product belongs to a promotion (checking product_ids, products, and featuredProducts).
 *
 * @param {object} product - Product or ProductVariant
 * @param {object} promo - Promotion object
 * @returns {boolean}
 */
export const isProductInPromotion = (product, promo) => {
  if (!product || !promo) return false;
  const prodId = String(product.product_id || product.id || "");
  const variantId = String(product.id || "");

  // 1. Check promo.featuredProducts (e.g. activePromotion.featuredProducts.some(...))
  const featured = promo.featuredProducts || [];
  if (Array.isArray(featured) && featured.length > 0) {
    if (
      featured.some((p) => {
        const pid = String(typeof p === "object" ? p.id || p.product_id || "" : p);
        if (pid === prodId || pid === variantId) return true;
        if (typeof p === "object" && Array.isArray(p.variants)) {
          if (p.variants.some((v) => String(v.id) === variantId || String(v.id) === prodId)) return true;
        }
        return false;
      })
    ) {
      return true;
    }
  }

  // 2. Check promo.products
  const prods = promo.products || [];
  if (Array.isArray(prods) && prods.length > 0) {
    if (
      prods.some((p) => {
        const pid = String(typeof p === "object" ? p.id || p.product_id || "" : p);
        if (pid === prodId || pid === variantId) return true;
        if (typeof p === "object" && Array.isArray(p.variants)) {
          if (p.variants.some((v) => String(v.id) === variantId || String(v.id) === prodId)) return true;
        }
        return false;
      })
    ) {
      return true;
    }
  }

  // 3. Check promo.product_ids
  const idList = promo.product_ids || [];
  if (Array.isArray(idList) && idList.length > 0) {
    if (idList.some((id) => String(id) === prodId || String(id) === variantId)) {
      return true;
    }
  }

  return false;
};

/**
 * Finds the first active promotion that applies to the given product.
 *
 * @param {object} product - Product or ProductVariant
 * @param {Array<object>} promotions - List of promotions
 * @param {Date|number} [now=new Date()] - Reference timestamp
 * @returns {object|null}
 */
export const findActivePromotionForProduct = (product, promotions = [], now = new Date()) => {
  if (!product || !Array.isArray(promotions) || promotions.length === 0) {
    return null;
  }

  for (const promo of promotions) {
    if (isPromotionActive(promo, now) && isProductInPromotion(product, promo)) {
      return promo;
    }
  }

  return null;
};

/**
 * Calculates final promotional price according to baseline price rule.
 *
 * @param {object} product - Product or Variant object
 * @param {object|Array<object>|null} [promotionOrList=null] - Single promo or list of active promotions
 * @param {Date|number} [now=new Date()] - Reference timestamp
 * @returns {{
 *   finalPrice: number,
 *   displayOriginalPrice: number,
 *   hasDiscount: boolean,
 *   discountBadge: string,
 *   promotion: object|null
 * }}
 */
export const calculateProductPrice = (product, promotionOrList = null, now = new Date()) => {
  if (!product) {
    return {
      finalPrice: 0,
      displayOriginalPrice: 0,
      hasDiscount: false,
      discountBadge: "",
      promotion: null,
    };
  }

  // Extract raw prices
  const compareAt = Number(
    product.compareAtPrice ??
      product.compare_at_price ??
      product.effective_compare_at_price ??
      0
  );
  const regularPrice = Number(product.price ?? product.base_price ?? 0);

  // Baseline price rule: compareAtPrice if valid & > 0, else regular price
  const baselinePrice = compareAt > 0 ? compareAt : regularPrice;

  // Resolve matching active promotion
  let promo = null;
  if (Array.isArray(promotionOrList)) {
    promo = findActivePromotionForProduct(product, promotionOrList, now);
  } else if (promotionOrList && typeof promotionOrList === "object") {
    if (isPromotionActive(promotionOrList, now) && isProductInPromotion(product, promotionOrList)) {
      promo = promotionOrList;
    }
  }

  // If no active promotion applies, return standard regular prices without modification
  if (!promo) {
    const hasRegularDiscount = compareAt > regularPrice && regularPrice > 0;
    const discountPct = hasRegularDiscount
      ? Math.round(((compareAt - regularPrice) / compareAt) * 100)
      : 0;

    return {
      finalPrice: regularPrice,
      displayOriginalPrice: baselinePrice,
      hasDiscount: hasRegularDiscount,
      discountBadge: hasRegularDiscount ? `-${discountPct}%` : "",
      promotion: null,
    };
  }

  // Active promotion calculation
  const discountType = String(
    promo.discountType || promo.discount_type || "percentage"
  ).toLowerCase();
  const discountValue = Number(
    promo.discountValue ?? promo.discount_value ?? 0
  );

  let finalPrice = baselinePrice;
  let discountBadge = "";

  if (discountType === "percentage") {
    const discountFactor = Math.max(0, 1 - discountValue / 100);
    finalPrice = baselinePrice * discountFactor;
    discountBadge = `-${Math.round(discountValue)}% OFF`;
  } else {
    // Fixed amount discount
    finalPrice = Math.max(0, baselinePrice - discountValue);
    discountBadge = `-$${discountValue.toFixed(2)} OFF`;
  }

  // Round cleanly to 2 decimal places
  finalPrice = Math.round(finalPrice * 100) / 100;
  const hasDiscount = finalPrice < baselinePrice;

  return {
    finalPrice,
    displayOriginalPrice: baselinePrice,
    hasDiscount,
    discountBadge,
    promotion: promo,
  };
};

export default calculateProductPrice;
