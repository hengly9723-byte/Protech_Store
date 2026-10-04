import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getOrdersApi } from "../../services/api";
import {
  formatMoney,
  formatDateTime,
  formatStatusBadge,
  orderStatusStyle,
  paymentStatusStyle,
  fulfillmentStatusStyle,
} from "../../utils/format";

const OrderHistoryPage = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getOrdersApi()
      .then((res) => {
        const list = res.data?.results || res.data || [];
        setOrders(list);
      })
      .catch(() => setError("Failed to load your orders."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Order History
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {orders.length > 0
              ? `${orders.length} order${orders.length === 1 ? "" : "s"} placed`
              : "Track and manage your past orders"}
          </p>
        </div>
        <Link
          to="/products"
          className="px-4 py-2 text-xs font-bold text-sky-600 hover:bg-sky-50 rounded-xl border border-sky-200 transition-colors flex items-center gap-2"
        >
          <i className="bi bi-box-seam" />
          Shop More
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-primary text-sm flex items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill text-primary" />
          <span>{error}</span>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-14 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 mx-auto rounded-full bg-orange-50 flex items-center justify-center mb-5">
            <i className="bi bi-box-seam text-4xl text-primary" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No orders yet</h2>
          <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
            When you place an order it will show up here with live status and tracking.
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
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="block bg-white px-4 py-2 border rounded-2xl border-gray-100 shadow-sm hover:shadow-lg transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-black text-gray-900">{order.order_number}</span>
                    <span className="text-[11px] text-gray-400">
                      {formatDateTime(order.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {order.items_count} item{order.items_count === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={formatStatusBadge(order.status, orderStatusStyle)}>
                    {order.status}
                  </span>
                  <span className={formatStatusBadge(order.payment_status, paymentStatusStyle)}>
                    {order.payment_status}
                  </span>
                  <span className={formatStatusBadge(order.fulfillment_status, fulfillmentStatusStyle)}>
                    {order.fulfillment_status}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-base font-black text-gray-900 tracking-tight">
                      {formatMoney(order.total, order.currency)}
                    </p>
                    {Number(order.discount) > 0 && (
                      <p className="text-[11px] text-emerald-600 font-semibold">
                        Saved {formatMoney(order.discount, order.currency)}
                      </p>
                    )}
                  </div>
                  <i className="bi bi-chevron-right text-gray-300" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistoryPage;