import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getOrderDetailApi, requestOrderReturnApi } from "../../services/api";
import {
  formatMoney,
  formatDate,
  formatDateTime,
  formatStatusBadge,
  titleCase,
  orderStatusStyle,
  paymentStatusStyle,
  fulfillmentStatusStyle,
  shipmentStatusStyle,
  returnStatusStyle,
} from "../../utils/format";

const OrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnResolution, setReturnResolution] = useState("refund");
  const [returnItems, setReturnItems] = useState({});
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState(null);
  const [returnSuccess, setReturnSuccess] = useState(null);

  const loadOrder = useCallback(() => {
    setIsLoading(true);
    setError(null);
    getOrderDetailApi(id)
      .then((res) => setOrder(res.data))
      .catch(() => setError("Order not found or you don't have access to it."))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const isDelivered = order?.shipments?.some((s) => s.status === "delivered");
  const hasExistingReturn = order?.returns?.some(
    (r) => r.status === "requested" || r.status === "approved",
  );

  const openReturnModal = () => {
    const initial = {};
    order.items.forEach((item) => {
      initial[item.id] = { quantity: 1, condition: "unopened", note: "" };
    });
    setReturnItems(initial);
    setReturnReason("");
    setReturnResolution("refund");
    setReturnError(null);
    setReturnSuccess(null);
    setShowReturnModal(true);
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    setReturnError(null);
    setReturnSuccess(null);

    const selectedItems = Object.entries(returnItems).filter(
      ([, val]) => val.selected,
    );

    if (selectedItems.length === 0) {
      setReturnError("Please select at least one item to return.");
      return;
    }
    if (!returnReason.trim()) {
      setReturnError("Please provide a reason for the return.");
      return;
    }

    setIsSubmittingReturn(true);
    try {
      await requestOrderReturnApi(order.id, {
        reason: returnReason.trim(),
        resolution: returnResolution,
        items: selectedItems.map(([orderItemId, val]) => ({
          order_item_id: orderItemId,
          quantity: val.quantity,
          condition: val.condition,
          note: val.note,
        })),
      });
      setReturnSuccess("Return request submitted successfully!");
      setShowReturnModal(false);
      loadOrder();
    } catch (err) {
      setReturnError(
        err.response?.data?.error || "Failed to submit return request.",
      );
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">
          Loading order details...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-orange-50 text-primary rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
          <i className="bi bi-exclamation-octagon" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {error || "Order Not Found"}
        </h2>
        <Link
          to="/orders"
          className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-button hover:bg-button-hover text-white font-bold text-xs"
        >
          Back to Orders
        </Link>
      </div>
    );
  }

  const shipping = order.shipping_address_snapshot || {};
  const isPaid = order.payment_status === "paid";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <Link
            to="/orders"
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1.5 mb-2"
          >
            <i className="bi bi-arrow-left" />
            Back to Orders
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {order.order_number}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Placed {formatDateTime(order.created_at)} ·{" "}
            {order.items_count || order.items?.length} items
          </p>
        </div>

        {isDelivered && !hasExistingReturn && (
          <button
            onClick={openReturnModal}
            className="px-5 py-2.5 rounded-xl bg-button hover:bg-button-hover text-white text-xs font-bold shadow-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            <i className="bi bi-arrow-counterclockwise" />
            Request Return
          </button>
        )}
      </div>

      {returnSuccess && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <i className="bi bi-check-circle-fill text-emerald-500" />
          <span>{returnSuccess}</span>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl px-4 py-2 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Order
            </p>
            <p className="text-sm font-black text-gray-900 capitalize mt-0.5">
              {order.status}
            </p>
          </div>
          <span className={formatStatusBadge(order.status, orderStatusStyle)}>
            {order.status}
          </span>
        </div>
        <div className="bg-white rounded-2xl px-4 py-2 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Payment
            </p>
            <p className="text-sm font-black text-gray-900 capitalize mt-0.5">
              {titleCase(order.payment_status)}
            </p>
          </div>
          <span
            className={formatStatusBadge(
              order.payment_status,
              paymentStatusStyle,
            )}
          >
            {order.payment_status}
          </span>
        </div>
        <div className="bg-white rounded-2xl px-4 py-2 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Fulfillment
            </p>
            <p className="text-sm font-black text-gray-900 capitalize mt-0.5">
              {titleCase(order.fulfillment_status)}
            </p>
          </div>
          <span
            className={formatStatusBadge(
              order.fulfillment_status,
              fulfillmentStatusStyle,
            )}
          >
            {order.fulfillment_status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">
              Items Ordered
            </h3>
            <div className="divide-y divide-gray-100">
              {order.items?.map((item) => (
                <div
                  key={item.id}
                  className="py-4 flex items-center gap-4 first:pt-0 last:pb-0"
                >
                  <div className="w-16 h-16 shrink-0 bg-slate-50 rounded-2xl border border-gray-100 flex items-center justify-center text-gray-300">
                    <i className="bi bi-box text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 line-clamp-1">
                      {item.product_name_snapshot}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {item.sku_snapshot}
                      {item.variant_snapshot?.name &&
                        ` · ${item.variant_snapshot.name}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-gray-900">
                      {formatMoney(item.total, order.currency)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {formatMoney(item.unit_price, order.currency)} ×{" "}
                      {item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">
                  {formatMoney(order.subtotal, order.currency)}
                </span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex items-center justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-semibold">
                    -{formatMoney(order.discount, order.currency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-gray-600">
                <span>Shipping</span>
                <span className="font-semibold text-gray-900">
                  {formatMoney(order.shipping_cost, order.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Tax</span>
                <span className="font-semibold text-gray-900">
                  {formatMoney(order.tax, order.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-2.5">
                <span>Total</span>
                <span>{formatMoney(order.total, order.currency)}</span>
              </div>
            </div>
          </div>

          {/* Tracking */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <i className="bi bi-truck text-sky-500" />
              Tracking Information
            </h3>

            {order.shipments?.length > 0 ? (
              <div className="space-y-4">
                {order.shipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="p-4 rounded-2xl bg-slate-50/70 border border-gray-100"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                        {shipment.carrier || "Carrier"}
                      </span>
                      <span
                        className={formatStatusBadge(
                          shipment.status,
                          shipmentStatusStyle,
                        )}
                      >
                        {shipment.status}
                      </span>
                    </div>
                    {shipment.tracking_number && (
                      <p className="text-xs text-gray-600 font-mono">
                        Tracking #: {shipment.tracking_number}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[11px] text-gray-500">
                      {shipment.shipped_at && (
                        <span>
                          Shipped: {formatDateTime(shipment.shipped_at)}
                        </span>
                      )}
                      {shipment.delivered_at && (
                        <span>
                          Delivered: {formatDateTime(shipment.delivered_at)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <i className="bi bi-truck text-3xl text-gray-300 block mb-2" />
                <p className="text-xs text-gray-500">
                  {order.fulfillment_status === "fulfilled"
                    ? "Shipment details will appear once dispatched."
                    : "Your order hasn't shipped yet."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Address / Payments / Returns */}
        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <i className="bi bi-geo-alt text-sky-500" />
              Shipping Address
            </h3>
            <p className="text-sm font-bold text-gray-900">
              {shipping.recipient_name}
            </p>
            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
              {shipping.address_line_1 && <p>{shipping.address_line_1}</p>}
              {shipping.address_line_2 && <p>{shipping.address_line_2}</p>}
              <p>
                {shipping.city && `${shipping.city}, `}
                {shipping.state && `${shipping.state} `}
                {shipping.postal_code}
              </p>
              {shipping.country && <p>{shipping.country}</p>}
              {shipping.phone && (
                <p className="mt-1 text-gray-400">{shipping.phone}</p>
              )}
            </div>
          </div>

          {/* Payments */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <i className="bi bi-qr-code text-sky-500" />
              Payments
            </h3>
            {order.payments?.length > 0 ? (
              <div className="space-y-3">
                {order.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 border border-gray-100"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 capitalize">
                        {payment.gateway}
                      </p>
                      <p className="text-[11px] text-gray-500 font-mono truncate">
                        {payment.transaction_id}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-gray-900">
                        {formatMoney(payment.amount, payment.currency)}
                      </p>
                      <p className="text-[10px] text-gray-400 capitalize">
                        {payment.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                {isPaid ? "Payment recorded." : "No payment recorded yet."}
              </p>
            )}
            {!isPaid && (
              <Link
                to={`/checkout/payment?order=${order.id}`}
                className="mt-4 w-full py-2.5 rounded-2xl bg-button hover:bg-button-hover text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <i className="bi bi-qr-code-scan" />
                Pay Now
              </Link>
            )}
          </div>

          {/* Returns */}
          {order.returns?.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <i className="bi bi-arrow-counterclockwise text-sky-500" />
                Returns
              </h3>
              <div className="space-y-3">
                {order.returns.map((ret) => (
                  <div
                    key={ret.id}
                    className="p-3 rounded-2xl bg-slate-50/70 border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {ret.resolution}
                      </span>
                      <span
                        className={formatStatusBadge(
                          ret.status,
                          returnStatusStyle,
                        )}
                      >
                        {ret.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {ret.reason}
                    </p>
                    {ret.items?.length > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {ret.items
                          .map((it) => `${it.product_name} (×${it.quantity})`)
                          .join(", ")}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      Requested {formatDate(ret.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Return Request Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                Request a Return
              </h3>
              <button
                onClick={() => setShowReturnModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                  Items to Return
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {order.items?.map((item) => {
                    const val = returnItems[item.id] || {
                      quantity: 1,
                      condition: "unopened",
                      note: "",
                    };
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                          val.selected
                            ? "border-sky-500 bg-sky-50/40"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!val.selected}
                          onChange={(e) =>
                            setReturnItems({
                              ...returnItems,
                              [item.id]: { ...val, selected: e.target.checked },
                            })
                          }
                          className="accent-sky-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 line-clamp-1">
                            {item.product_name_snapshot}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Max {item.quantity} available
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={!val.selected || val.quantity <= 1}
                            onClick={() =>
                              setReturnItems({
                                ...returnItems,
                                [item.id]: {
                                  ...val,
                                  quantity: Math.max(1, val.quantity - 1),
                                },
                              })
                            }
                            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 cursor-pointer"
                          >
                            <i className="bi bi-dash text-xs" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-gray-900">
                            {val.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={
                              !val.selected || val.quantity >= item.quantity
                            }
                            onClick={() =>
                              setReturnItems({
                                ...returnItems,
                                [item.id]: {
                                  ...val,
                                  quantity: val.quantity + 1,
                                },
                              })
                            }
                            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 cursor-pointer"
                          >
                            <i className="bi bi-plus text-xs" />
                          </button>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={3}
                  placeholder="Tell us why you're returning this item..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                  Resolution
                </label>
                <select
                  value={returnResolution}
                  onChange={(e) => setReturnResolution(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="refund">Refund</option>
                  <option value="replacement">Replacement</option>
                  <option value="store_credit">Store Credit</option>
                </select>
              </div>

              {returnError && (
                <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-primary text-xs flex items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill text-primary" />
                  <span>{returnError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-5 py-2 rounded-xl bg-button hover:bg-button-hover text-white text-sm font-bold shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReturn
                    ? "Submitting..."
                    : "Submit Return Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailPage;
