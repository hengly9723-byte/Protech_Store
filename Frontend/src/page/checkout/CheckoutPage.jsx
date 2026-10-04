import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import {
  getAddressesApi,
  checkoutApi,
  validateDiscountCodeApi,
  setGuestEmail as persistGuestEmail,
} from "../../services/api";
import { formatMoney, fallbackImage } from "../../utils/format";
import useShippingConfig from "../../hooks/useShippingConfig";

const EMPTY_ADDRESS = {
  recipient_name: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "United States",
};

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { cart, cartLoading, refreshCart, discountCode, discountInfo, applyDiscount, clearDiscount } = useCart();
  const { freeShippingThreshold, flatRate } = useShippingConfig();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [guestEmail, setGuestEmail] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [codeError, setCodeError] = useState(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCodeInput(discountCode || "");
  }, [discountCode, isAuthenticated, clearDiscount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getAddressesApi()
      .then((res) => {
        const list = res.data?.results || res.data || [];
        setAddresses(list);
        const def = list.find((a) => a.is_default) || list[0];
        if (def) setSelectedAddressId(def.id);
      })
      .catch(() => setAddresses([]));
  }, [isAuthenticated]);

  const items = cart?.items || [];
  const subtotal = Number(cart?.subtotal || 0);
  const currency = cart?.currency || "USD";

  const discountAmount = discountInfo ? Number(discountInfo.discount_amount || 0) : 0;
  const shippingCost = subtotal >= freeShippingThreshold ? 0 : flatRate;
  const tax =
    subtotal > discountAmount ? Math.round((subtotal - discountAmount) * 0.08 * 100) / 100 : 0;
  const total = Math.max(0, subtotal + shippingCost + tax - discountAmount);

  const handleApplyCode = async (e) => {
    e.preventDefault();
    const trimmed = codeInput.trim();
    if (!trimmed) return;

    setIsApplyingCode(true);
    setCodeError(null);
    try {
      const res = await validateDiscountCodeApi(trimmed, subtotal);
      if (res.data.valid) {
        applyDiscount(res.data.code, res.data);
      }
    } catch (err) {
      setCodeError(
        err.response?.data?.error ||
          (err.response?.data?.code && err.response.data.code[0]) ||
          "Invalid discount code."
      );
      clearDiscount();
    } finally {
      setIsApplyingCode(false);
    }
  };

  const buildShippingPayload = () => {
    if (isAuthenticated && !useNewAddress && selectedAddressId) {
      return { shipping_address_id: selectedAddressId };
    }
    return {
      shipping_address: {
        recipient_name: newAddress.recipient_name,
        phone: newAddress.phone,
        address_line_1: newAddress.address_line_1,
        address_line_2: newAddress.address_line_2,
        city: newAddress.city,
        state: newAddress.state,
        postal_code: newAddress.postal_code,
        country: newAddress.country,
      },
    };
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError(null);
    setIsPlacing(true);

    const payload = {
      ...buildShippingPayload(),
      discount_code: discountCode || null,
    };
    if (!isAuthenticated) {
      payload.guest_email = guestEmail.trim();
    }

    try {
      const res = await checkoutApi(payload);
      const order = res.data.order;
      if (!isAuthenticated) {
        persistGuestEmail(guestEmail.trim());
      }
      clearDiscount();
      refreshCart();
      navigate(`/checkout/payment?order=${order.id}`);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Checkout failed. Please review your details and try again.";
      setError(msg);
      refreshCart();
    } finally {
      setIsPlacing(false);
    }
  };

  if (cartLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">Loading checkout...</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-sky-50 text-sky-500 rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
          <i className="bi bi-cart-x" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-sm text-gray-500 mb-6">Add some items before heading to checkout.</p>
        <Link
          to="/products"
          className="inline-block px-6 py-3 rounded-2xl bg-button text-white font-bold text-sm shadow-md hover:bg-button-hover transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8 text-xs font-bold">
        <span className="flex items-center gap-1.5 text-sky-600">
          <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center">1</span>
          Shipping
        </span>
        <i className="bi bi-chevron-right text-gray-300" />
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">2</span>
          Payment
        </span>
        <i className="bi bi-chevron-right text-gray-300" />
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">3</span>
          Confirm
        </span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-8">
        Checkout
      </h1>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left: Shipping Address */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-primary text-sm flex items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill text-primary" />
              <span>{error}</span>
            </div>
          )}

          {/* Shipping Address Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <i className="bi bi-geo-alt text-sky-500" />
              Shipping Address
            </h2>

            {isAuthenticated ? (
              <>
                {addresses.length > 0 && !useNewAddress ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {addresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                            selectedAddressId === addr.id
                              ? "border-sky-500 ring-2 ring-sky-500/10 bg-sky-50/40"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="mt-0.5 accent-sky-500"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">
                                {addr.recipient_name}
                              </p>
                              {addr.is_default && (
                                <span className="text-[10px] font-bold uppercase text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">{addr.address_line_1}</p>
                            {addr.address_line_2 && (
                              <p className="text-xs text-gray-600">{addr.address_line_2}</p>
                            )}
                            <p className="text-xs text-gray-600">
                              {addr.city}, {addr.state} {addr.postal_code}
                            </p>
                            <p className="text-xs text-gray-600">{addr.country}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseNewAddress(true)}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="bi bi-plus-circle" />
                      Use a different address
                    </button>
                  </div>
                ) : addresses.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUseNewAddress(false);
                      const def = addresses.find((a) => a.is_default) || addresses[0];
                      setSelectedAddressId(def.id);
                    }}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1.5 mb-4 cursor-pointer"
                  >
                    <i className="bi bi-arrow-left-circle" />
                    Back to saved addresses
                  </button>
                ) : null}
              </>
            ) : (
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Guest Email <span className="text-primary">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Your order confirmation and tracking will be sent here.
                </p>
              </div>
            )}

            {(useNewAddress || !isAuthenticated || addresses.length === 0) && (
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                      Recipient Name <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddress.recipient_name}
                      onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                    Street Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newAddress.address_line_1}
                    onChange={(e) => setNewAddress({ ...newAddress, address_line_1: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                    Apt / Suite (optional)
                  </label>
                  <input
                    type="text"
                    value={newAddress.address_line_2}
                    onChange={(e) => setNewAddress({ ...newAddress, address_line_2: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                      ZIP / Postal <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddress.postal_code}
                      onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={newAddress.country}
                      onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Summary */}
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
                    {formatMoney(discountAmount, currency)} off
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearDiscount();
                    setCodeInput("");
                  }}
                  className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
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
                  placeholder="Discount code"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 text-sm uppercase tracking-wider focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handleApplyCode}
                  disabled={isApplyingCode || !codeInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-button hover:bg-button-hover text-white text-xs font-bold shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isApplyingCode ? "..." : "Apply"}
                </button>
              </form>
            )}
            {codeError && (
              <p className="mt-2 text-[11px] font-semibold text-rose-600 flex items-center gap-1.5">
                <i className="bi bi-exclamation-triangle-fill" />
                {codeError}
              </p>
            )}
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Order Summary</h3>

            <div className="max-h-64 overflow-y-auto space-y-3 pr-1 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-14 h-14 shrink-0 bg-slate-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={item.product_image || fallbackImage}
                      alt={item.product_name}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 line-clamp-1">
                      {item.product_name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {item.variant_name || item.variant_sku} × {item.quantity}
                    </p>
                    {item.has_discount && item.discount_badge && (
                      <span className="inline-block px-1.5 py-0.2 rounded bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-wider">
                        {item.discount_badge}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-900 block">
                      {formatMoney(item.line_total, currency)}
                    </span>
                    {item.has_discount && item.original_price && (
                      <span className="text-[10px] text-gray-400 line-through block">
                        {formatMoney(Number(item.original_price) * item.quantity, currency)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 text-sm border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{formatMoney(subtotal, currency)}</span>
              </div>
              {discountInfo && (
                <div className="flex items-center justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-semibold">-{formatMoney(discountAmount, currency)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-gray-600">
                <span>Shipping</span>
                <span className="font-semibold text-gray-900">
                  {shippingCost === 0 ? (
                    <span className="text-emerald-600">Free</span>
                  ) : (
                    formatMoney(shippingCost, currency)
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Tax (8%)</span>
                <span className="font-semibold text-gray-900">{formatMoney(tax, currency)}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">Total</span>
              <span className="text-xl font-black text-gray-900 tracking-tight">
                {formatMoney(total, currency)}
              </span>
            </div>

            <button
              type="submit"
              disabled={isPlacing}
              className="mt-5 w-full py-3.5 rounded-2xl bg-button hover:bg-button-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <i className="bi bi-lock-fill" />
              {isPlacing ? "Placing Order..." : "Place Order"}
            </button>

            <Link
              to="/cart"
              className="mt-3 w-full py-2.5 rounded-2xl border border-gray-200 hover:border-sky-300 hover:bg-sky-50 text-gray-600 hover:text-sky-700 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <i className="bi bi-arrow-left" />
              Back to Cart
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CheckoutPage;
