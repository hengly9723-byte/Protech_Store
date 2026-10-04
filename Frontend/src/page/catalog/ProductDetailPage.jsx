import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getProductDetailApi,
  getVariantStockApi,
  addToCartApi,
  getProductReviewsApi,
  getActivePromotionsApi,
} from "../../services/api";
import { calculateProductPrice } from "../../utils/pricing";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import VariantSelector from "../../components/catalog/VariantSelector";
import ReviewList from "../../components/catalog/ReviewList";
import ReviewForm from "../../components/catalog/ReviewForm";
import StarRating from "../../components/catalog/StarRating";

const SPEC_META = {
  os: { label: "Operating System", icon: "bi-windows" },
  processor: { label: "Processor (CPU)", icon: "bi-cpu" },
  graphics: { label: "Graphics (GPU)", icon: "bi-gpu-card" },
  ram: { label: "Memory (RAM)", icon: "bi-memory" },
  storage: { label: "Storage", icon: "bi-device-hdd" },
  display: { label: "Display", icon: "bi-display" },
  battery: { label: "Battery Life", icon: "bi-battery-charging" },
  connectivity: { label: "Connectivity", icon: "bi-wifi" },
  sensor: { label: "Sensor", icon: "bi-activity" },
  driver: { label: "Audio Driver", icon: "bi-speaker" },
  anc: { label: "Noise Cancellation", icon: "bi-soundwave" },
  bluetooth: { label: "Bluetooth", icon: "bi-bluetooth" },
  codecs: { label: "Audio Codecs", icon: "bi-music-note-beamed" },
  key_switches: { label: "Key Switches", icon: "bi-keyboard" },
  backlight: { label: "Backlighting", icon: "bi-lightbulb" },
};

const ProductDetailPage = () => {
  const { id, variantId } = useParams();
  const { isAuthenticated } = useAuth();
  const { refreshCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [stockInfo, setStockInfo] = useState(null);
  const [reviewsData, setReviewsData] = useState({
    reviews: [],
    reviews_count: 0,
  });
  const [activeImage, setActiveImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [promotions, setPromotions] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getActivePromotionsApi()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setPromotions(list);
      })
      .catch((err) => {
        console.warn("Could not load promotions for product detail:", err);
      });
  }, []);

  const loadProduct = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prodRes, revRes] = await Promise.all([
        getProductDetailApi(id),
        getProductReviewsApi(id).catch(() => ({
          data: { reviews: [], reviews_count: 0 },
        })),
      ]);

      const prod = prodRes.data;
      setProduct(prod);
      setReviewsData(revRes.data);

      const allVariants = prod.variants || [];
      // Pick variant matching URL param variantId or default to first
      const targetVariant =
        allVariants.find((v) => String(v.id) === String(variantId)) ||
        allVariants[0] ||
        null;
      setSelectedVariant(targetVariant);

      const variantImg = targetVariant?.images?.[0]?.image_url;
      const defaultImg =
        variantImg ||
        prod.images?.find((img) => img.is_primary)?.image_url ||
        prod.images?.[0]?.image_url ||
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80";
      setActiveImage(defaultImg);

      if (targetVariant) {
        loadStock(targetVariant.id);
      }
    } catch (err) {
      console.error("Failed to load product detail:", err);
      setError("Product not found or unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStock = async (vId) => {
    try {
      const stockRes = await getVariantStockApi(vId);
      setStockInfo(stockRes.data);
    } catch (err) {
      setStockInfo(null);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [id, variantId]);

  const handleVariantSelect = (variant) => {
    setSelectedVariant(variant);
    loadStock(variant.id);

    // If variant has specific image, switch to it
    const variantImg = variant.images?.[0]?.image_url;
    if (variantImg) {
      setActiveImage(variantImg);
    }

    // Update browser URL silently without reloading
    if (variant?.id && id) {
      window.history.replaceState(
        null,
        "",
        `/products/${id}/variant/${variant.id}`,
      );
    }
  };

  const handleAddToCart = async () => {
    const variantId =
      selectedVariant?.id ||
      selectedVariant?.variant_id ||
      product?.variants?.[0]?.id;

    if (!variantId) {
      console.error(
        "No variant selected or variant ID is missing!",
        selectedVariant,
      );
      alert("Please select a valid variant before adding to cart.");
      return;
    }

    setIsAddingToCart(true);
    try {
      const payload = {
        product_id: product.id,
        variant_id: variantId,
        quantity: Number(quantity) || 1,
      };
      console.log("Cart Payload:", payload);
      console.log("Selected Variant State:", selectedVariant);
      await addToCartApi(payload.variant_id, payload.quantity);
      await refreshCart();
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 3500);
    } catch (err) {
      console.error(
        "Add to cart failed:",
        err.response?.status,
        err.response?.data,
      );
      console.error("DRF Error Detail:", err.response?.data?.variant_id);
      const data = err.response?.data || {};
      const msg =
        (data.error && typeof data.error === "string" && data.error) ||
        (typeof data.variant_id === "string" && data.variant_id) ||
        (typeof data.quantity === "string" && data.quantity) ||
        "Failed to add item to cart.";
      alert(msg);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const currentTarget = selectedVariant || product;
  const currentTargetId = currentTarget ? String(currentTarget.id) : null;
  const wishlisted = currentTargetId ? isWishlisted(currentTargetId) : false;

  const handleWishlistToggle = () => {
    if (!currentTarget) return;
    toggleWishlist({
      ...currentTarget,
      id: currentTarget.id,
      product_id: product?.id,
      name: currentTarget.sku
        ? `${product?.name || "Product"} (${currentTarget.sku})`
        : product?.name,
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">
          Loading Product Details...
        </p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-orange-50 text-primary rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
          <i className="bi bi-exclamation-octagon" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {error || "Product Not Found"}
        </h2>
        <Link
          to="/products"
          className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-button hover:bg-button-hover text-white font-bold text-xs"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const targetForPricing = selectedVariant
    ? {
        ...selectedVariant,
        product_id: product?.id,
        compare_at_price:
          selectedVariant.compare_at_price || product?.compare_at_price,
      }
    : product;

  const promoPricing = calculateProductPrice(targetForPricing, promotions);
  const currentPrice = promoPricing.finalPrice;
  const comparePrice = promoPricing.displayOriginalPrice;
  const hasDiscount = promoPricing.hasDiscount;
  const discountBadge = promoPricing.discountBadge;
  const isOutOfStock = stockInfo && stockInfo.quantity_available <= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-8 overflow-x-auto">
        <Link to="/" className="hover:text-gray-900">
          Home
        </Link>
        <span>/</span>
        <Link to="/products" className="hover:text-gray-900">
          Catalog
        </Link>
        {product.category && (
          <>
            <span>/</span>
            <Link
              to={`/categories/${product.category.slug || product.category.id}`}
              className="hover:text-gray-900"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="font-semibold text-gray-800 truncate">
          {product.name}
        </span>
      </nav>

      {/* Main Product Hero Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mb-16">
        {/* Left Column: Image Gallery */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm aspect-square flex items-center justify-center overflow-hidden relative">
            <img
              src={activeImage}
              alt={product.name}
              className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-300"
            />
          </div>

          {/* Thumbnails strip */}
          {product.images?.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {product.images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(img.image_url)}
                  className={`w-20 h-20 rounded-2xl bg-white p-2 border transition-all shrink-0 cursor-pointer ${
                    activeImage === img.image_url
                      ? "border-sky-500 ring-2 ring-sky-500/20 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 opacity-75 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img.image_url}
                    alt={img.alt_text || "Thumbnail"}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Product Info & Actions */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {product.brand && (
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider">
                  {product.brand.name}
                </span>
              )}
              {product.type && (
                <span className="px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold">
                  {product.type.name}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* Rating Stars & Reviews Count */}
            <div className="flex items-center gap-3 mt-3">
              <StarRating rating={5} size="text-sm" />
              <span className="text-xs text-gray-500">
                ({reviewsData.reviews_count} customer reviews)
              </span>
            </div>
          </div>

          {/* Pricing Block */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-gray-100 flex items-center gap-3 flex-wrap">
            <span className="text-3xl font-black text-gray-900 tracking-tight">
              ${Number(currentPrice).toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-base text-gray-400 line-through">
                ${Number(comparePrice).toFixed(2)}
              </span>
            )}
            {hasDiscount && discountBadge && (
              <span className="px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-wider shadow-sm animate-pulse">
                {discountBadge}
              </span>
            )}
            <span className="text-xs text-gray-500 font-medium ml-auto">
              Currency: {product.currency || "USD"}
            </span>
          </div>

          {/* Short Description */}
          {product.short_description && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {product.short_description}
            </p>
          )}

          {/* Variant Selector */}
          <VariantSelector
            variants={product.variants}
            selectedVariant={selectedVariant}
            onSelectVariant={handleVariantSelect}
            stockInfo={stockInfo}
          />

          {/* Quantity & CTA Buttons */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4">
              {/* Quantity Counter */}
              <div className="flex items-center border border-gray-200 rounded-2xl bg-white p-1">
                <button
                  type="button"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                >
                  <i className="bi bi-dash-lg text-sm" />
                </button>
                <span className="w-10 text-center text-sm font-bold text-gray-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={
                    stockInfo && quantity >= stockInfo.quantity_available
                  }
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                >
                  <i className="bi bi-plus-lg text-sm" />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                disabled={isAddingToCart || isOutOfStock}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-button hover:bg-button-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <i className="bi bi-bag-plus text-base" />
                <span>
                  {isAddingToCart
                    ? "Adding to Cart..."
                    : isOutOfStock
                      ? "Out of Stock"
                      : "Add to Cart"}
                </span>
              </button>

              {/* Wishlist Button: 0ms Optimistic UI Toggle */}
              <button
                type="button"
                onClick={handleWishlistToggle}
                className={`h-10 w-10 rounded-full border transition-all duration-200 shadow-xs cursor-pointer hover:scale-105 active:scale-95 ${
                  wishlisted
                    ? "border-orange-50 text-primary"
                    : "border-gray-200 hover:text-primary text-gray-500 hover:text-"
                }`}
                title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                aria-label={
                  wishlisted ? "Remove from Wishlist" : "Add to Wishlist"
                }
              >
                <i
                  className={`bi ${
                    wishlisted ? "bi-heart-fill scale-105" : "bi-heart"
                  } text-base transition-transform`}
                />
              </button>
            </div>

            {/* Action Feedback Alerts */}
            {cartSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <i className="bi bi-check-circle-fill text-emerald-500" />
                <span>Item added to your shopping cart successfully!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Specifications & Long Description Tab Section */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm mb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Technical Specifications
            </h2>
            {selectedVariant && (
              <p className="text-xs text-gray-500 mt-0.5">
                Displaying specs for{" "}
                <span className="font-semibold text-sky-700">
                  {selectedVariant.name || selectedVariant.sku}
                </span>
              </p>
            )}
          </div>
          {selectedVariant?.sku && (
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full font-mono text-xs font-semibold">
              SKU: {selectedVariant.sku}
            </span>
          )}
        </div>

        {selectedVariant?.specifications &&
        Object.keys(selectedVariant.specifications).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(selectedVariant.specifications).map(
              ([key, val]) => {
                if (!val) return null;
                const meta = SPEC_META[key.toLowerCase()] || {
                  label: key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase()),
                  icon: "bi-sliders",
                };
                return (
                  <div
                    key={key}
                    className="p-4 rounded-2xl bg-slate-50/70 border border-gray-100 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white border border-gray-200/80 flex items-center justify-center text-sky-600 text-sm shrink-0">
                        <i className={`bi ${meta.icon}`} />
                      </div>
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider truncate">
                        {meta.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-900 font-mono text-right truncate max-w-[55%]">
                      {String(val)}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        ) : product.specifications?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {product.specifications.map((spec) => (
              <div
                key={spec.id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-gray-100 flex items-center justify-between"
              >
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {spec.specification_name}
                </span>
                <span className="text-xs font-bold text-gray-900 font-mono">
                  {spec.value_text ||
                    spec.value_number ||
                    (spec.value_boolean ? "Yes" : "No")}
                  {spec.unit ? ` ${spec.unit}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-gray-100 text-gray-400 text-xs">
            Standard specifications apply for this item.
          </div>
        )}

        {product.description && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
              Product Overview
            </h3>
            <div className="text-sm text-gray-700 leading-relaxed space-y-2 whitespace-pre-line">
              {product.description}
            </div>
          </div>
        )}
      </div>

      {/* Reviews Section */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              Customer Reviews
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Verified feedback from real customers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <ReviewList reviews={reviewsData.reviews} />
          </div>
          <div>
            <ReviewForm
              productId={product.id}
              onReviewSubmitted={loadProduct}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
