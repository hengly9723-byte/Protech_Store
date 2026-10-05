import React, { memo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { addToCartApi } from "../../services/api";
import { calculateProductPrice } from "../../utils/pricing";

const ProductCard = ({
  product,
  activePromotion = null,
  promotions = null,
  onWishlistChange = null,
}) => {
  const { isAuthenticated } = useAuth();
  const { isWishlisted: checkIsWishlisted, toggleWishlist } = useWishlist();
  const { refreshCart } = useCart();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // Determine IDs & URLs: cardId uniquely identifies this specific variant/product card
  const cardId = String(product.id);
  const parentProductId = product.product_id || product.id;
  const variantId = product.product_id ? product.id : null;
  const detailUrl = variantId
    ? `/products/${parentProductId}/variant/${variantId}`
    : `/products/${parentProductId}`;

  // Instant O(1) state resolution from global wishlist cache for THIS specific variant
  const wishlisted = checkIsWishlisted(cardId);

  const rawImage =
    product.primary_image?.image_url ||
    (typeof product.primary_image === "string" ? product.primary_image : null) ||
    product.images?.[0]?.image_url ||
    product.thumbnail_url ||
    "https://i.pinimg.com/736x/b1/81/86/b181860d02096d8c06fd949bb76bd79c.jpg";
  const primaryImage = rawImage;

  // Calculate promotional pricing using shared helper across Hero & Catalog
  const pricing = calculateProductPrice(
    product,
    activePromotion || promotions
  );
  const currentPrice = pricing.finalPrice;
  const comparePrice = pricing.displayOriginalPrice;
  const hasDiscount = pricing.hasDiscount;
  const discountBadge = pricing.discountBadge;

  const title = product.product_name || product.name;
  const variantName =
    product.product_name &&
    product.name &&
    product.name !== product.product_name
      ? product.name
      : null;

  // Extract quick spec summary values
  const specs = product.specifications || {};
  const cpu = specs.processor || specs.Processor || specs.cpu || specs.CPU;
  const gpu = specs.graphics || specs.Graphics || specs.gpu || specs.GPU;
  const ram = specs.ram || specs.RAM || specs.memory || specs.Memory;
  const storage = specs.storage || specs.Storage;
  const display = specs.display || specs.Display;

  // Collect active quick spec pills (max 3-4 to keep card neat)
  const quickSpecs = [];
  if (cpu) quickSpecs.push({ icon: "bi-cpu", label: cpu });
  if (gpu) quickSpecs.push({ icon: "bi-gpu-card", label: gpu });
  if (ram) quickSpecs.push({ icon: "bi-memory", label: ram });
  if (storage && quickSpecs.length < 3)
    quickSpecs.push({ icon: "bi-device-hdd", label: storage });
  if (display && quickSpecs.length < 3)
    quickSpecs.push({ icon: "bi-display", label: display });

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAddingToCart) return;

    // In CatalogVariantListView, product is a ProductVariant instance where product.id is variantId
    const targetVariantId = product.product_id
      ? product.id
      : (product.variants?.[0]?.id || product.id);

    setIsAddingToCart(true);
    try {
      await addToCartApi(targetVariantId, 1);
      await refreshCart();
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to add to cart from product card:", err);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 0ms Optimistic UI update via global context with abort controller
    toggleWishlist(product);
    if (onWishlistChange) onWishlistChange(cardId, !wishlisted);
  };

  return (
    <div className="group bg-white rounded-3xl border border-gray-100/80 shadow-xs hover:shadow-xl hover:border-bg-button transition-all duration-300 flex flex-col overflow-hidden relative">
      {/* Top Image Container */}
      <div className="relative aspect-square w-full bg-slate-50 overflow-hidden">
        <Link to={detailUrl} className="block w-full h-full">
          <img
            src={primaryImage}
            alt={title}
            className="w-full h-full object-contain p-3 sm:p-4 group-hover:scale-108 transition-transform duration-500"
            loading="lazy"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1 sm:gap-1.5 z-10 pointer-events-none">
          {hasDiscount && discountBadge && (
            <span
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm ${
                pricing.promotion ? "bg-red-600 ring-2 ring-red-400/40 animate-pulse" : "bg-red-600"
              }`}
            >
              {discountBadge}
            </span>
          )}
          {product.is_featured && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-xs">
              Featured
            </span>
          )}
        </div>

        {/* Wishlist Button: 0ms immediate responsive feedback */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute top-2 right-2 sm:top-3 sm:right-3 w-8 h-8 sm:w-9 sm:h-9 rounded-full backdrop-blur-xs border transition-all duration-200 flex items-center justify-center shadow-xs z-10 cursor-pointer hover:scale-110 active:scale-90 ${
            wishlisted
              ? "bg-white/90 text-orange-50 "
              : "bg-white/90 border-gray-100 text-gray-400 hover:text-primary hover:border-orange-50"
          }`}
        >
          <i
            className={`bi ${
              wishlisted ? "bi-heart-fill text-primary scale-105" : "bi-heart"
            } text-xs sm:text-sm transition-transform duration-150`}
          />
        </button>
      </div>

      {/* Product & Variant Content Details */}
      <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand, Category & SKU tags */}
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-gray-600 font-bold uppercase tracking-wider mb-1">
            <span className="text-sky-700 truncate">
              {product.brand_name || "Protech"}
            </span>
            <span className="text-gray-500 truncate">
              {product.category_name}
            </span>
          </div>

          {/* Title */}
          <Link
            to={detailUrl}
            className="block text-[13px] sm:text-sm font-bold text-gray-900 line-clamp-2 hover:text-sky-600 transition-colors leading-snug"
          >
            {title}
          </Link>

          {/* Variant Name & SKU */}
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {variantName && (
              <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg">
                {variantName}
              </span>
            )}
            {product.sku && (
              <span className="text-[10px] text-gray-400 font-mono">
                SKU: {product.sku}
              </span>
            )}
          </div>

          {/* Quick-Spec Summary Pills */}
          {quickSpecs.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {quickSpecs.map((qs, idx) => (
                <span
                  key={idx}
                  title={qs.label}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium truncate max-w-[140px]"
                >
                  <i
                    className={`bi ${qs.icon} text-[9px] text-sky-600 shrink-0`}
                  />
                  <span className="truncate">{qs.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Price & Action */}
        <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-black text-gray-900 tracking-tight">
                ${currentPrice.toFixed(2)}
              </span>
              {hasDiscount && (
                <span className="text-[10px] sm:text-xs text-gray-400 line-through truncate">
                  ${comparePrice.toFixed(2)}
                </span>
              )}
            </div>
            {product.variants_count > 1 && !product.product_id && (
              <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium mt-0.5 truncate">
                {product.variants_count} variants available
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAddingToCart}
              title="Add to cart"
              aria-label="Add to cart"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shadow-xs cursor-pointer ${
                addSuccess
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 hover:bg-button hover:text-white text-gray-700"
              }`}
            >
              {isAddingToCart ? (
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : addSuccess ? (
                <i className="bi bi-check-lg text-xs font-bold" />
              ) : (
                <i className="bi bi-cart-plus text-[11px] sm:text-xs" />
              )}
            </button>
            <Link
              to={detailUrl}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-button hover:bg-button-hover text-white flex items-center justify-center transition-colors shadow-xs"
              title="View product details"
              aria-label="View product details"
            >
              <i className="bi bi-arrow-right text-[10px] sm:text-xs" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ProductCard);
