import React, { useState, useEffect, useRef } from "react";
import {
  useParams,
  useSearchParams,
  Link,
  useNavigate,
} from "react-router-dom";
import { getOrderDetailApi } from "../../services/api";
import {
  formatStatusBadge,
  orderStatusStyle,
  paymentStatusStyle,
} from "../../utils/format";
import ThermalReceipt from "../../components/checkout/ThermalReceipt";
import { downloadThermalReceiptPdf } from "../../utils/thermalReceiptPdf";

const OrderConfirmationPage = () => {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Supports both /orders/:id/success and /checkout/success?order=<id>
  const id = paramId || searchParams.get("order");
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Receipt state
  const receiptRef = useRef(null);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const [showShippingDetails, setShowShippingDetails] = useState(false);

  useEffect(() => {
    if (!id) {
      setError("No order specified.");
      setIsLoading(false);
      return;
    }
    getOrderDetailApi(id)
      .then((res) => setOrder(res.data))
      .catch(() => setError("Order not found."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleDownloadReceipt = async () => {
    if (!receiptRef.current || isDownloadingReceipt) return;

    try {
      setIsDownloadingReceipt(true);
      setDownloadNotice(null);
      const filename = await downloadThermalReceiptPdf(
        receiptRef.current,
        order.order_number || order.id,
      );
      setDownloadNotice({
        type: "success",
        text: `Receipt PDF downloaded as ${filename}`,
      });
      setTimeout(() => setDownloadNotice(null), 5000);
    } catch (err) {
      console.error("Direct receipt download failed:", err);
      setDownloadNotice({
        type: "error",
        text:
          err?.message || "Could not generate PDF receipt. Please try again.",
      });
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">
          Loading order receipt...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 bg-orange-50 text-primary rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
          <i className="bi bi-exclamation-octagon" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {error || "Order Not Found"}
        </h2>
        <Link
          to="/"
          className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-button hover:bg-button-hover text-white font-bold text-xs"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const isPaid = order.payment_status === "paid";
  const shipping = order.shipping_address_snapshot || {};

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md mx-auto">
        {/* Top Header Notice */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-primary text-xs font-bold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>{isPaid ? "Payment Completed" : "Order Placed"}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
            {isPaid ? "Official Payment Receipt" : "Order Confirmation"}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isPaid
              ? "Your transaction has been approved. Retain this digital receipt."
              : "Complete payment to finalize and process your order."}
          </p>
        </div>

        {/* Download notification banner */}
        {downloadNotice && (
          <div
            className={`mb-4 px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all ${
              downloadNotice.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-orange-50 text-primary border border-orange-200"
            }`}
          >
            <i
              className={`bi ${
                downloadNotice.type === "success"
                  ? "bi-check-circle-fill text-emerald-600"
                  : "bi-exclamation-octagon-fill text-primary"
              }`}
            />
            <span>{downloadNotice.text}</span>
          </div>
        )}

        {/* ================= ON-SCREEN THERMAL RECEIPT SLIP ================= */}
        {/* Rendered directly on screen so the user doesn't need to click any button to view it */}
        <div className="relative transform transition-all duration-300">
          <ThermalReceipt ref={receiptRef} order={order} preview={true} />
        </div>

        {/* ================= PRIMARY ACTIONS ================= */}
        <div className="mt-5 space-y-2.5">
          {!isPaid && (
            <Link
              to={`/checkout/payment?order=${order.id}`}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              <i className="bi bi-qr-code-scan" />
              Complete Payment Now
            </Link>
          )}

          {/* Direct 80mm PDF Download */}
          <button
            type="button"
            onClick={handleDownloadReceipt}
            disabled={isDownloadingReceipt}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gray-950 hover:bg-gray-800 disabled:opacity-60 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            title="Save 80mm POS slip directly as PDF"
          >
            {isDownloadingReceipt ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating 80mm PDF...</span>
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-arrow-down-fill text-orange-400 text-base" />
                <span>Download Receipt (.pdf)</span>
              </>
            )}
          </button>

          {/* Done / Continue Shopping (styled like the mobile receipt Done action) */}
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="w-full inline-flex items-center justify-center py-3 px-6 rounded-2xl bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 font-bold text-sm shadow-xs transition-colors cursor-pointer"
          >
            <span>Done</span>
          </button>

          {/* Secondary Links Row */}
          <div className="flex items-center justify-between pt-1 px-1 text-xs">
            <Link
              to={`/orders/${order.id}`}
              className="text-gray-600 hover:text-orange-600 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <i className="bi bi-box-seam" />
              <span>Full Order Details</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowShippingDetails(!showShippingDetails)}
              className="text-gray-600 hover:text-orange-600 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <i className="bi bi-geo-alt" />
              <span>
                {showShippingDetails ? "Hide Shipping" : "Shipping Info"}
              </span>
              <i
                className={`bi ${showShippingDetails ? "bi-chevron-up" : "bi-chevron-down"} text-[10px]`}
              />
            </button>
          </div>
        </div>

        {/* Collapsible Shipping Details */}
        {showShippingDetails && (
          <div className="mt-4 bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs text-xs animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2.5">
              <span className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
                Shipping & Delivery
              </span>
              <span
                className={formatStatusBadge(order.status, orderStatusStyle)}
              >
                {order.status}
              </span>
            </div>

            <div className="space-y-1 text-gray-700">
              <p className="font-bold text-gray-950 text-sm">
                {shipping.recipient_name || "Recipient"}
              </p>
              {shipping.address_line_1 && <p>{shipping.address_line_1}</p>}
              {shipping.address_line_2 && <p>{shipping.address_line_2}</p>}
              <p>
                {shipping.city && `${shipping.city}, `}
                {shipping.state && `${shipping.state} `}
                {shipping.postal_code}
              </p>
              {shipping.country && <p>{shipping.country}</p>}
              {shipping.phone && (
                <p className="text-gray-500 font-mono pt-1">
                  <i className="bi bi-telephone me-1" />
                  {shipping.phone}
                </p>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-gray-600">
              <span>Payment Status</span>
              <span
                className={formatStatusBadge(
                  order.payment_status,
                  paymentStatusStyle,
                )}
              >
                {order.payment_status}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
