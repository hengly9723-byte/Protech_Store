import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { addToCartApi, getProductDetailApi } from "../../services/api";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { formatMoney, fallbackImage } from "../../utils/format";

const WishlistPage = () => {
  const { refreshCart } = useCart();
  const {
    wishlistItems: items,
    isLoading,
    refreshWishlist,
    toggleWishlist,
  } = useWishlist();
  const [movingId, setMovingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const handleRemove = async (item) => {
    setRemovingId(item.id);
    setError(null);
    const target = {
      id: item.variant || item.variant_id || item.product,
      name: item.variant_sku
        ? `${item.product_name} (${item.variant_sku})`
        : item.product_name,
      product_id: item.product,
    };
    try {
      await toggleWishlist(target);
    } catch {
      setError(`Could not remove ${item.product_name} from wishlist.`);
    } finally {
      setRemovingId(null);
    }
  };

  const handleMoveToCart = async (item) => {
    setMovingId(item.id);
    setError(null);
    setNotice(null);
    try {
      let variantId = item.variant || item.variant_id;
      if (!variantId) {
        const prodRes = await getProductDetailApi(item.product);
        const variant =
          prodRes.data.variants?.find((v) => v.status === "active") ||
          prodRes.data.variants?.[0];
        variantId = variant?.id;
      }

      if (!variantId) {
        setError(`${item.product_name} has no available variants to add.`);
        return;
      }

      await addToCartApi(variantId, 1);
      const target = {
        id: item.variant || item.variant_id || item.product,
        product_id: item.product,
      };
      await toggleWishlist(target);
      await refreshCart();
      setNotice(`${item.product_name} was moved to your cart.`);
      setTimeout(() => setNotice(null), 3500);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.quantity?.[0] ||
        "Could not move this item to your cart.";
      setError(msg);
    } finally {
      setMovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">
          Loading your wishlist...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            My Wishlist
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {items.length > 0
              ? `${items.length} saved item${items.length === 1 ? "" : "s"}`
              : "Save products you love for later"}
          </p>
        </div>
        <Link
          to="/products"
          className="px-4 py-2 text-xs font-bold text-sky-600 hover:bg-sky-50 rounded-xl border border-sky-200 transition-colors flex items-center gap-2"
        >
          <i className="bi bi-box-seam" />
          Browse Catalog
        </Link>
      </div>

      {notice && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <i className="bi bi-check-circle-fill text-emerald-500" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-primary text-sm flex items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill text-primary" />
          <span>{error}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-3xl p-14 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 mx-auto rounded-full bg-orange-50 flex items-center justify-center mb-5">
            <i className="bi bi-heart text-4xl text-primary" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Your wishlist is empty
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
            Tap the heart icon on any product to save it here for later.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-button hover:bg-button-hover text-white font-bold text-sm shadow-md transition-all"
          >
            <i className="bi bi-box-seam" />
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const detailUrl = item.variant
              ? `/products/${item.product}/variant/${item.variant}`
              : `/products/${item.product}`;

            return (
              <div
                key={item.id}
                className="group bg-white rounded-3xl border border-gray-100/80 shadow-xs hover:shadow-xl hover:border-bg-button transition-all duration-300 flex flex-col overflow-hidden relative"
              >
                {/* Top Image Container */}
                <div className="relative aspect-square w-full bg-slate-50 overflow-hidden">
                  <Link to={detailUrl} className="block w-full h-full">
                    <img
                      src={item.primary_image || fallbackImage}
                      alt={item.product_name}
                      className="w-full h-full object-contain p-3 sm:p-4 group-hover:scale-108 transition-transform duration-500"
                      loading="lazy"
                    />
                  </Link>

                  {/* Remove Wishlist Button: Top right matching ProductCard heart button */}
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    disabled={removingId === item.id}
                    title="Remove from wishlist"
                    aria-label="Remove from wishlist"
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 backdrop-blur-xs border border-gray-100 text-primary hover:bg-orange-50 hover:border-rose-200 transition-all duration-200 flex items-center justify-center shadow-xs z-10 cursor-pointer hover:scale-110 active:scale-90 disabled:opacity-50"
                  >
                    <i
                      className={`bi ${
                        removingId === item.id
                          ? "bi-arrow-clockwise animate-spin"
                          : "bi-trash"
                      } text-xs sm:text-sm`}
                    />
                  </button>
                </div>

                {/* Content Details */}
                <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Category / Variant name */}
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-gray-600 font-bold uppercase tracking-wider mb-1">
                      <span className="text-sky-700 truncate">Saved Item</span>
                      {item.variant_name && (
                        <span className="text-gray-500 truncate">
                          {item.variant_name}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <Link
                      to={detailUrl}
                      className="block text-[13px] sm:text-sm font-bold text-gray-900 line-clamp-2 hover:text-sky-600 transition-colors leading-snug"
                    >
                      {item.product_name}
                    </Link>

                    {/* Variant SKU */}
                    {item.variant_sku && (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 font-mono">
                          SKU: {item.variant_sku}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Price & Action Footer */}
                  <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm sm:text-base font-black text-gray-900 tracking-tight">
                        {formatMoney(item.base_price, item.currency || "USD")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveToCart(item)}
                        disabled={movingId === item.id}
                        title="Move to cart"
                        aria-label="Move to cart"
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-button hover:text-white text-gray-700 flex items-center justify-center transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {movingId === item.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
          })}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
