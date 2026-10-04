import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import {
  updateCartItemApi,
  removeCartItemApi,
  clearCartApi,
  validateDiscountCodeApi,
} from "../../services/api";
import {
  formatMoney,
  fallbackImage,
} from "../../utils/format";
import useShippingConfig from "../../hooks/useShippingConfig";

const CartPage = () => {
  const navigate = useNavigate();
  const { cart, cartLoading, refreshCart, discountCode, discountInfo, applyDiscount, clearDiscount } = useCart();
  const { freeShippingThreshold, flatRate } = useShippingConfig();

  const [codeInput, setCodeInput] = useState("");
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [codeError, setCodeError] = useState(null);
  const [codeSuccess, setCodeSuccess] = useState(null);
  const [itemError, setItemError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    setCodeInput(discountCode || "");
  }, [discountCode]);

  const items = cart?.items || [];
  const subtotal = Number(cart?.subtotal || 0);
  const currency = cart?.currency || "USD";

  const discountAmount = discountInfo ? Number(discountInfo.discount_amount || 0) : 0;
  const shippingEstimate = subtotal >= freeShippingThreshold ? 0 : flatRate;
  const taxEstimate =
    subtotal > discountAmount
      ? Math.round((subtotal - discountAmount) * 0.08 * 100) / 100
      : 0;
  const estimatedTotal = Math.max(
    0,
    subtotal + shippingEstimate + taxEstimate - discountAmount
  );

  const handleQuantityChange = async (item, newQty) => {
    if (newQty < 1 || newQty > item.available_stock) return;

    setUpdatingId(item.id);
    setItemError(null);
    try {
      await updateCartItemApi(item.id, newQty);
      await refreshCart();
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.quantity ||
        "Failed to update quantity.";
      setItemError({ itemId: item.id, message: msg });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveItem = async (item) => {
    setItemError(null);
    try {
      await removeCartItemApi(item.id);
      await refreshCart();
} catch (err) {
      setItemError({ itemId: item.id, message: err.response?.data?.error || "Failed to remove item." });
    }
  };

  const handleClearCart = async () => {
    if (!confirm("Are you sure you want to remove all items from your cart?")) return;
    setIsClearing(true);
    try {
      await clearCartApi();
      clearDiscount();
      await refreshCart();
    } catch (err) {
      console.warn("Failed to clear cart:", err);
      setItemError({ itemId: null, message: "Failed to clear the cart." });
    } finally {
      setIsClearing(false);
    }
  };

  const handleApplyCode = async (e) => {
    e.preventDefault();
    const trimmed = codeInput.trim();
    if (!trimmed) return;

    setIsApplyingCode(true);
    setCodeError(null);
    setCodeSuccess(null);
    try {
      const res = await validateDiscountCodeApi(trimmed, subtotal);
      if (res.data.valid) {
        applyDiscount(res.data.code, res.data);
        setCodeSuccess(res.data.message || "Discount code applied!");
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.response?.data?.code && err.response.data.code[0]) ||
        "Invalid discount code.";
      setCodeError(msg);
      clearDiscount();
    } finally {
      setIsApplyingCode(false);
    }
  };

  const handleRemoveCode = () => {
    setCodeInput("");
    clearDiscount();
    setCodeError(null);
    setCodeSuccess(null);
  };

  if (cartLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">Loading your cart...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Shopping Cart
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {items.length > 0
              ? `${cart.total_items} item${cart.total_items === 1 ? "" : "s"} in your cart`
              : "Your cart is waiting for you"}
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleClearCart}
            disabled={isClearing}
            className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <i className="bi bi-trash" />
            {isClearing ? "Clearing..." : "Clear Cart"}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-background rounded-3xl p-14 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 mx-auto rounded-full bg-orange-50 flex items-center justify-center mb-5">
            <i className="bi bi-cart-x text-4xl text-primary" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
            Looks like you haven't added anything yet. Browse the catalog and find
            something you love.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-button hover:bg-button-hover text-white font-bold text-sm shadow-md transition-all"
          >
            <i className="bi bi-box-seam" />
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Cart Items */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-4">
            {itemError && itemError.itemId === null && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill text-rose-500" />
                <span>{itemError.message}</span>
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm flex flex-col gap-3 sm:flex-row sm:gap-5"
              >
                {/* Product Image */}
                <Link
                  to={`/products/${item.product_id}`}
                  className="w-full h-36 sm:w-28 sm:h-28 shrink-0 bg-slate-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden"
                >
                  <img
                    src={item.product_image || fallbackImage}
                    alt={item.product_name}
                    className="w-full h-full object-contain p-2"
                  />
                </Link>

                {/* Product Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/products/${item.product_id}`}
                        className="text-sm font-bold text-gray-900 hover:text-sky-600 transition-colors line-clamp-2"
                      >
                        {item.product_name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.variant_name || item.variant_sku}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item)}
                      disabled={updatingId === item.id}
                      title="Remove item"
                      className="p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                    >
                      <i className="bi bi-x-lg text-sm" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    {/* Quantity Stepper */}
                    <div className="flex items-center border border-gray-200 rounded-xl bg-white">
                      <button
                        type="button"
                        disabled={updatingId === item.id || item.quantity <= 1}
                        onClick={() => handleQuantityChange(item, item.quantity - 1)}
                        className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                      >
                        <i className="bi bi-dash text-sm" />
                      </button>
                      <span className="w-10 text-center text-sm font-bold text-gray-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={
                          updatingId === item.id ||
                          item.quantity >= item.available_stock
                        }
                        onClick={() => handleQuantityChange(item, item.quantity + 1)}
                        className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                      >
                        <i className="bi bi-plus text-sm" />
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-black text-gray-900">
                        {formatMoney(item.line_total, currency)}
                      </p>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5 flex-wrap">
                        {item.has_discount && item.original_price && (
                          <span className="text-[11px] text-gray-400 line-through">
                            {formatMoney(item.original_price, currency)}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-500 font-medium">
                          {formatMoney(item.unit_price, currency)} each
                        </span>
                        {item.has_discount && item.discount_badge && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider">
                            {item.discount_badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stock & error feedback */}
                  {item.quantity >= item.available_stock && (
                    <p className="mt-2 text-[11px] font-semibold text-amber-600 flex items-center gap-1.5">
                      <i className="bi bi-exclamation-triangle-fill" />
                      Only {item.available_stock} left in stock — no more can be added.
                    </p>
                  )}
                  {itemError && itemError.itemId === item.id && (
                    <p className="mt-2 text-[11px] font-semibold text-rose-600 flex items-center gap-1.5">
                      <i className="bi bi-exclamation-triangle-fill" />
                      {itemError.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:sticky lg:top-24 space-y-4">
            {/* Discount Code */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                <i className="bi bi-ticket-perforated text-sky-500 mr-2" />
                Discount Code
              </h3>

              {discountInfo ? (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                      {discountInfo.code}
                    </p>
                    <p className="text-[11px] text-emerald-600">
                      You saved {formatMoney(discountAmount, currency)}
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveCode}
                    className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                    title="Remove discount code"
                  >
                    <i className="bi bi-x-lg text-xs" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCode} className="flex gap-2">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => {
                      setCodeInput(e.target.value.toUpperCase());
                      setCodeError(null);
                    }}
                    placeholder="Enter code (e.g. SUMMER20)"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 text-sm uppercase tracking-wider focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={isApplyingCode || !codeInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-button hover:bg-button-hover text-white text-xs font-bold shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isApplyingCode ? "Checking..." : "Apply"}
                  </button>
                </form>
              )}

              {codeError && (
                <p className="mt-2 text-[11px] font-semibold text-rose-600 flex items-center gap-1.5">
                  <i className="bi bi-exclamation-triangle-fill" />
                  {codeError}
                </p>
              )}
              {codeSuccess && !discountInfo && (
                <p className="mt-2 text-[11px] font-semibold text-emerald-600 flex items-center gap-1.5">
                  <i className="bi bi-check-circle-fill" />
                  {codeSuccess}
                </p>
              )}
            </div>

            {/* Totals */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Order Summary</h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    {formatMoney(subtotal, currency)}
                  </span>
                </div>

                {discountInfo && (
                  <div className="flex items-center justify-between text-emerald-600">
                    <span>Discount ({discountInfo.code})</span>
                    <span className="font-semibold">
                      -{formatMoney(discountAmount, currency)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="font-semibold text-gray-900">
                    {shippingEstimate === 0 ? (
                      <span className="text-emerald-600">Free</span>
                    ) : (
                      formatMoney(shippingEstimate, currency)
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-gray-600">
                  <span>Estimated Tax (8%)</span>
                  <span className="font-semibold text-gray-900">
                    {formatMoney(taxEstimate, currency)}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Estimated Total</span>
                <span className="text-xl font-black text-gray-900 tracking-tight">
                  {formatMoney(estimatedTotal, currency)}
                </span>
              </div>

              <p className="text-[11px] text-gray-400 mt-2">
                Shipping & tax finalized at checkout.
              </p>

              <button
                onClick={() => navigate("/checkout")}
                className="mt-4 w-full py-3.5 rounded-2xl bg-button hover:bg-button-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="bi bi-lock-fill" />
                Proceed to Checkout
              </button>

              <Link
                to="/products"
                className="mt-3 w-full py-2.5 rounded-2xl border border-gray-200 hover:border-sky-300 hover:bg-sky-50 text-gray-600 hover:text-sky-700 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <i className="bi bi-arrow-left" />
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
