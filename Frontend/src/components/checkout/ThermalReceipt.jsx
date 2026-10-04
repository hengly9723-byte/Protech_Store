import React, { forwardRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { formatMoney, formatDateTime } from "../../utils/format";
import logo from "../../assets/cpu-logo-black-bold2.png";

// Standard Code 39 Barcode Pattern Map
const CODE39_MAP = {
  "0": "000110100", "1": "100100001", "2": "001100001", "3": "101100000",
  "4": "000110001", "5": "100110000", "6": "001110000", "7": "000100101",
  "8": "100100100", "9": "001100100", "A": "100001001", "B": "001001001",
  "C": "101001000", "D": "000011001", "E": "100011000", "F": "001011000",
  "G": "000001101", "H": "100001100", "I": "001001100", "J": "000011100",
  "K": "100000011", "L": "001000011", "M": "101000010", "N": "000010011",
  "O": "100010010", "P": "001010010", "Q": "000000111", "R": "100000110",
  "S": "001000110", "T": "000010110", "U": "110000001", "V": "011000001",
  "W": "111000000", "X": "010010001", "Y": "110010000", "Z": "011010000",
  "-": "010000101", ".": "110000100", " ": "011000100", "*": "010010100",
  "$": "010101000", "/": "010100010", "+": "010001010", "%": "000101010",
};

/**
 * Realistic vector Code 39 Barcode renderer for thermal receipt.
 */
const ThermalBarcode = ({ value = "", height = 36 }) => {
  const clean =
    "*" +
    String(value || "RECEIPT")
      .toUpperCase()
      .replace(/[^0-9A-Z-. $/+%]/g, "") +
    "*";

  let x = 0;
  const bars = [];
  const narrow = 1.25;
  const wide = 3.1;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const pattern = CODE39_MAP[char] || CODE39_MAP["-"];
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const width = pattern[j] === "1" ? wide : narrow;
      if (isBar) {
        bars.push({ x: Number(x.toFixed(2)), width: Number(width.toFixed(2)) });
      }
      x += width;
    }
    x += narrow;
  }

  return (
    <div className="flex flex-col items-center justify-center w-full my-2">
      <svg
        viewBox={`0 0 ${x} ${height}`}
        className="w-full max-w-[260px] h-9"
        style={{ shapeRendering: "crispEdges" }}
        aria-hidden="true"
      >
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y="0"
            width={bar.width}
            height={height}
            fill="#111827"
          />
        ))}
      </svg>
      <div className="text-[9.5px] tracking-[0.2em] font-thermal text-gray-800 text-center mt-1 select-none font-bold">
        {clean}
      </div>
    </div>
  );
};

/**
 * Authentic saw-tooth / jagged paper tear edge for the bottom of the POS receipt roll.
 * Renders 24 pronounced sharp triangular paper cutter teeth protruding downwards.
 */
const BottomTearEdge = () => (
  <div className="w-full overflow-hidden leading-none block -mt-[1px]">
    <svg
      viewBox="0 0 360 14"
      className="w-full h-3.5 block fill-white"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0,0 L7.5,13 L15,0 L22.5,13 L30,0 L37.5,13 L45,0 L52.5,13 L60,0 L67.5,13 L75,0 L82.5,13 L90,0 L97.5,13 L105,0 L112.5,13 L120,0 L127.5,13 L135,0 L142.5,13 L150,0 L157.5,13 L165,0 L172.5,13 L180,0 L187.5,13 L195,0 L202.5,13 L210,0 L217.5,13 L225,0 L232.5,13 L240,0 L247.5,13 L255,0 L262.5,13 L270,0 L277.5,13 L285,0 L292.5,13 L300,0 L307.5,13 L315,0 L322.5,13 L330,0 L337.5,13 L345,0 L352.5,13 L360,0 Z"
        fill="#ffffff"
      />
    </svg>
  </div>
);

/**
 * Authentic Thermal / POS Transaction Receipt Slip.
 * Can be rendered directly on the success screen as the primary payment confirmation ticket,
 * as well as downloaded directly into a crisp 80mm PDF roll.
 */
const ThermalReceipt = forwardRef(({ order }, ref) => {
  const [copiedKey, setCopiedKey] = useState(null);
  const [showFullDetails, setShowFullDetails] = useState(true);

  if (!order) return null;

  const isPaid = order.payment_status === "paid";
  const shipping = order.shipping_address_snapshot || {};
  const orderNum = order.order_number || (order.id ? `ORD-${order.id}` : "ORD-UNKNOWN");

  // Determine payment info and Bakong transaction info if present
  const latestPayment =
    order.payments && order.payments.length > 0
      ? order.payments[order.payments.length - 1]
      : null;

  const bakongRaw = latestPayment?.gateway_response?.bakong_response?.raw?.data;
  const transactionHash =
    bakongRaw?.hash ||
    latestPayment?.transaction_id ||
    latestPayment?.transaction_reference ||
    (order.id ? `TXN-${String(order.id).slice(-8).toUpperCase()}` : "TXN-APPROVED");

  const receivingAccount =
    bakongRaw?.toAccountId || "PROTECH (ly_sokheng1@bkrt)";
  const fromAccount =
    bakongRaw?.fromAccountId ||
    shipping.recipient_name ||
    order.customer_email ||
    "Customer Account";

  const paymentMethodName = (
    order.payment_method ||
    latestPayment?.payment_method ||
    "BAKONG KHQR"
  )
    .replace(/_/g, " ")
    .toUpperCase();

  const totalItemsCount =
    order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

  const verificationUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/orders/${order.id || ""}`
      : `https://protech.store/orders/${order.id || ""}`;

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div
      ref={ref}
      className="relative w-full max-w-[360px] text-gray-900 font-thermal text-[11px] leading-relaxed mx-auto select-none"
      style={{
        boxSizing: "border-box",
        color: "#111827",
        filter: "drop-shadow(0 14px 28px rgba(0, 0, 0, 0.08)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.04))",
      }}
    >
      {/* The Single Continuous White Receipt Paper Card */}
      <div className="bg-white rounded-t-3xl pt-6 pb-4">
        {/* Top Hero Payment Badge */}
        <div className="px-6 text-center">
          {/* Brand Logo */}
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-3">
            <img
              src={logo}
              alt="Protech Logo"
              className="w-12 h-12 object-contain"
            />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-950 tracking-tight font-thermal">
            {formatMoney(order.total, order.currency)}
          </div>
          <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mt-1">
            To {receivingAccount.includes("ly_sokheng1") ? "PROTECH" : "PROTECH OFFICIAL STORE"}
          </div>
          <div className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-gray-600 font-bold text-[9.5px] uppercase tracking-wider">
            {isPaid ? "Payment Approved / Confirmed" : "Order Placed / Pending"}
          </div>
        </div>

        {/* Dashed Separator */}
        <div className="my-4 border-b border-dashed border-gray-300 mx-5" />

        <div className="px-6 space-y-3">
          {/* ================= TRANSACTION METADATA ================= */}
          <div className="space-y-2 text-[10.5px]">
            {/* Transaction Hash */}
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500 font-medium shrink-0">Transaction Hash</span>
              <div className="flex items-center gap-1.5 min-w-0 text-right justify-end">
                <span className="font-mono text-gray-900 font-semibold break-all text-right">
                  {transactionHash ? `${transactionHash.slice(0, 10)}...` : "—"}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(transactionHash, "hash")}
                  className="pdf-hide text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer transition-colors shrink-0"
                  title="Copy Transaction Hash"
                >
                  {copiedKey === "hash" ? (
                    <span className="text-emerald-600 font-bold text-[9px]">COPIED</span>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Date and Time */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 font-medium shrink-0">Date And Time</span>
              <span className="text-gray-900 font-medium text-right shrink-0">
                {formatDateTime(order.created_at)}
              </span>
            </div>

            {/* Receiving Account */}
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500 font-medium shrink-0">Receiving Account</span>
              <div className="text-right min-w-0">
                <span className="text-gray-900 font-semibold block break-words">{receivingAccount}</span>
                <span className="text-[9.5px] text-gray-500 block">ABA Bank / Bakong KHQR</span>
              </div>
            </div>

            {/* From */}
            <div className="flex items-start justify-between gap-3">
              <span className="text-gray-500 font-medium shrink-0">From</span>
              <div className="text-right min-w-0">
                <span className="text-gray-900 font-semibold block break-words">
                  {shipping.recipient_name || order.customer_email || "Customer"}
                </span>
                <span className="text-[9.5px] text-gray-500 block break-words">
                  {fromAccount}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 font-medium shrink-0">Payment Method</span>
              <span className="text-gray-900 font-semibold uppercase shrink-0">{paymentMethodName}</span>
            </div>

            {/* Order Number */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 font-medium shrink-0">Order Number</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-gray-900">{orderNum}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(orderNum, "order")}
                  className="pdf-hide text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer transition-colors"
                  title="Copy Order Number"
                >
                  {copiedKey === "order" ? (
                    <span className="text-emerald-600 font-bold text-[9px]">COPIED</span>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-b border-dashed border-gray-300" />

          {/* Toggle Details Button (Hidden in downloaded PDF) */}
          <button
            type="button"
            onClick={() => setShowFullDetails(!showFullDetails)}
            className="pdf-hide w-full flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:text-gray-950 cursor-pointer select-none transition-colors"
          >
            <span>{showFullDetails ? "Collapse Items Breakdown" : "Show Full Items & Receipt"}</span>
            <i className={`bi ${showFullDetails ? "bi-chevron-up" : "bi-chevron-down"} text-xs`} />
          </button>

          {showFullDetails && (
            <div className="space-y-3 pt-1">
              {/* Store & Terminal Details */}
              <div className="text-center text-[9.5px] text-gray-600 space-y-0.5 border-b border-dashed border-gray-300 pb-2">
                <div className="font-bold uppercase tracking-widest text-gray-950 text-[11px]">
                  PROTECH TECH & ELECTRONICS
                </div>
                <p>Store #0104 - Flagship Central • Phnom Penh</p>
                <div className="flex justify-between text-gray-700 pt-1">
                  <span>TERM: POS-01</span>
                  <span>CASHIER: #042</span>
                  <span>TX: SALE</span>
                </div>
              </div>

              {/* ================= ITEMIZED PRODUCTS ================= */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-900 border-b border-dashed border-gray-300 pb-1 mb-2">
                  <span>ITEM / DESCRIPTION</span>
                  <span className="shrink-0 text-right">QTY & TOTAL</span>
                </div>

                <div className="space-y-2 text-[10px]">
                  {order.items?.map((item, index) => {
                    const unitPrice =
                      item.unit_price != null
                        ? item.unit_price
                        : item.total != null && item.quantity
                        ? item.total / item.quantity
                        : 0;
                    const variantName =
                      typeof item.variant_snapshot === "object" && item.variant_snapshot !== null
                        ? item.variant_snapshot.name
                        : typeof item.variant_snapshot === "string"
                        ? item.variant_snapshot
                        : null;
                    return (
                      <div key={item.id || index} className="space-y-0.5">
                        <div className="font-bold text-gray-950 uppercase tracking-tight break-words">
                          {item.product_name_snapshot || `Item #${index + 1}`}
                        </div>
                        {item.sku_snapshot && (
                          <div className="text-[9px] text-gray-500 font-mono">
                            SKU: {String(item.sku_snapshot)}
                          </div>
                        )}
                        {variantName && variantName !== item.product_name_snapshot && (
                          <div className="text-[9px] text-gray-500">
                            OPT: {String(variantName)}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-gray-800 text-[9.5px] gap-2">
                          <span className="text-gray-500">
                            {item.quantity} x {formatMoney(unitPrice, order.currency)}
                          </span>
                          <span className="font-semibold text-gray-950 shrink-0 text-right">
                            {formatMoney(item.total, order.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Separator */}
              <div className="border-b border-dashed border-gray-300" />

              {/* Financial Summary */}
              <div className="space-y-1 text-[10px] text-gray-800">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="shrink-0 text-right">{formatMoney(order.subtotal, order.currency)}</span>
                </div>

                {Number(order.discount) > 0 && (
                  <div className="flex items-center justify-between text-gray-900 font-medium">
                    <span>Discount</span>
                    <span className="shrink-0 text-right">-{formatMoney(order.discount, order.currency)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span>Shipping & Handling</span>
                  <span className="shrink-0 text-right">{formatMoney(order.shipping_cost, order.currency)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Estimated Tax (VAT 10%)</span>
                  <span className="shrink-0 text-right">{formatMoney(order.tax, order.currency)}</span>
                </div>

                <div className="my-1.5 border-t-2 border-dashed border-gray-900" />

                <div className="flex items-center justify-between text-[13px] font-bold text-gray-950 pt-0.5">
                  <span>TOTAL DUE</span>
                  <span className="font-thermal tracking-tight shrink-0 text-right">
                    {formatMoney(order.total, order.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-gray-500 uppercase tracking-wider">
                  <span>Total Items</span>
                  <span className="shrink-0 text-right">{totalItemsCount} {totalItemsCount === 1 ? "Item" : "Items"}</span>
                </div>

                <div className="my-1.5 border-b-2 border-dashed border-gray-900" />
              </div>

              {/* Vector Barcode & QR Code */}
              <div className="text-center my-2 space-y-2">
                <ThermalBarcode value={orderNum} height={36} />

                <div className="flex flex-col items-center justify-center pt-1">
                  <div className="p-1.5 bg-white border border-gray-300 rounded inline-block shadow-2xs">
                    <QRCodeCanvas
                      value={verificationUrl}
                      size={76}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#111827"
                    />
                  </div>
                  <p className="text-[8.5px] uppercase font-semibold text-gray-500 mt-1 tracking-wider">
                    Scan to Verify Digital Receipt
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Separator */}
          <div className="border-b border-dashed border-gray-300" />

          {/* Store Badge */}
          <div className="flex flex-col items-center justify-center pt-1 pb-2 text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
              Thank you for shopping at PROTECH!
            </p>
            <p className="text-[8px] text-gray-400">
              Warranty Valid 1 Year • Support: support@protech.com
            </p>
          </div>
        </div>
      </div>

      {/* Realistic Jagged Saw-Tooth Tear Edge */}
      <BottomTearEdge />
    </div>
  );
});

ThermalReceipt.displayName = "ThermalReceipt";

export default ThermalReceipt;
