import React, { useEffect, useState, useCallback } from "react";
import {
  getAdminOrdersApi,
  getOrderDetailApi,
  updateOrderStatusApi,
  refundOrderApi,
  shipOrderApi,
  updateReturnStatusApi,
} from "../../services/api";
import { formatMoney, formatDateTime, titleCase } from "../../utils/format";
import { PageHeader, Badge, TableWrap, TableHead, Spinner, EmptyState, Button, Select, Input, Modal, TextArea } from "../../components/admin/ui";

const ORDER_STATUSES = ["pending", "processing", "completed", "cancelled"];
const FULFILLMENT_STATUSES = ["unfulfilled", "partially_fulfilled", "fulfilled", "returned"];

export const generateTrackingNumber = (carrier = "J&T Express") => {
  const clean = (carrier || "TRK").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  let prefix = "TRK";
  if (clean.includes("JT") || clean.includes("JTE")) prefix = "JT";
  else if (clean.includes("VET")) prefix = "VET";
  else if (clean.includes("FEDEX") || clean.includes("FDX")) prefix = "FDX";
  else if (clean.includes("DHL")) prefix = "DHL";
  else if (clean.includes("GRAB")) prefix = "GRAB";
  else if (clean.length >= 2) prefix = clean.slice(0, 4);

  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
};

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [search, setSearch] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refundModal, setRefundModal] = useState(null);
  const [shipModal, setShipModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (payment) params.payment_status = payment;
      const res = await getAdminOrdersApi(params);
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [status, payment]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = orders.filter(
    (o) =>
      !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_email || "").toLowerCase().includes(search.toLowerCase())
  );

  const openDetail = async (o) => {
    setDetailLoading(true);
    setDetail(o);
    try {
      const res = await getOrderDetailApi(o.id);
      setDetail(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (order, field, value) => {
    try {
      await updateOrderStatusApi(order.id, { [field]: value });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, [field]: value } : o)));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update order.");
    }
  };

  const handleRefund = async () => {
    setSaving(true);
    try {
      await refundOrderApi(refundModal.id, { amount: refundModal.amount, reason: refundModal.reason });
      setRefundModal(null);
      await load();
      if (detail?.id === refundModal.id) openDetail(detail);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to process refund.");
    } finally {
      setSaving(false);
    }
  };

  const openShipModal = (order) => {
    const defaultCarrier = "J&T Express";
    setShipModal({
      id: order.id,
      number: order.order_number,
      carrier: defaultCarrier,
      tracking_number: generateTrackingNumber(defaultCarrier),
      status: "shipped",
    });
  };

  const handleShip = async () => {
    setSaving(true);
    try {
      const trackingNumber =
        shipModal.tracking_number?.trim() || generateTrackingNumber(shipModal.carrier);
      await shipOrderApi(shipModal.id, {
        carrier: shipModal.carrier?.trim() || "Standard Courier",
        tracking_number: trackingNumber,
        status: shipModal.status,
      });
      setShipModal(null);
      await load();
      if (detail?.id === shipModal.id) openDetail(detail);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create shipment.");
    } finally {
      setSaving(false);
    }
  };

  const handleReturnStatus = async (returnId, newStatus) => {
    try {
      await updateReturnStatusApi(returnId, newStatus);
      const res = await getOrderDetailApi(detail.id);
      setDetail(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update return.");
    }
  };

  return (
    <div>
      <PageHeader title="Orders" subtitle="Review, update and fulfil customer orders" />

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <Input placeholder="Search order # or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40">
          <option value="">All Status</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="sm:w-44">
          <option value="">All Payment</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
          <option value="partially_refunded">Partially Refunded</option>
        </Select>
      </div>

      {loading ? (
        <Spinner label="Loading orders..." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[950px] text-left text-sm">
            <TableHead cols={["Order", "Customer", "Total", "Status", "Payment", "Fulfilment", "Created", "Actions"]} />
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center">
                    <EmptyState icon="bi-cart3" title="No orders found" />
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{o.order_number}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{o.customer_email || "—"}</td>
                  <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{formatMoney(o.total, o.currency)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={o.status}
                      onChange={(e) => handleStatusChange(o, "status", e.target.value)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    >
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge value={o.payment_status} label={titleCase(o.payment_status)} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={o.fulfillment_status}
                      onChange={(e) => handleStatusChange(o, "fulfillment_status", e.target.value)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    >
                      {FULFILLMENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDetail(o)} className="p-2 rounded-lg text-sky-600 hover:bg-sky-50" title="View"><i className="bi bi-eye" /></button>
                      <button onClick={() => setRefundModal({ id: o.id, number: o.order_number, amount: o.total, reason: "" })} disabled={o.payment_status !== "paid"} className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-30" title="Refund"><i className="bi bi-arrow-counterclockwise" /></button>
                      <button onClick={() => openShipModal(o)} disabled={o.fulfillment_status === "fulfilled"} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-30" title="Ship"><i className="bi bi-truck" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Order ${detail.order_number}` : ""} wide>
        {detailLoading ? (
          <Spinner label="Loading order detail..." />
        ) : detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs font-bold uppercase text-gray-400 mb-1">Customer</p>
                <p className="font-semibold text-gray-800">{detail.customer_email || detail.guest_email || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-gray-400 mb-1">Total</p>
                <p className="font-black text-gray-900">{formatMoney(detail.total, detail.currency)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-gray-400 mb-1">Payment</p>
                <Badge value={detail.payment_status} label={titleCase(detail.payment_status)} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-gray-400 mb-1">Fulfilment</p>
                <div className="flex items-center gap-2">
                  <Badge value={detail.fulfillment_status} label={titleCase(detail.fulfillment_status)} />
                  {detail.fulfillment_status !== "fulfilled" && (
                    <button
                      onClick={() => openShipModal(detail)}
                      className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                      title="Create shipment"
                    >
                      <i className="bi bi-truck mr-1" />
                      Ship
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase text-gray-400 mb-2">Items</p>
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                {detail.items?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-semibold text-gray-800">
                      {item.product_name_snapshot} <span className="text-gray-400 font-normal">× {item.quantity}</span>
                    </span>
                    <span className="font-bold text-gray-900">{formatMoney(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {detail.shipments?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400 mb-2">Shipments</p>
                  <div className="space-y-2">
                    {detail.shipments.map((s) => (
                      <div key={s.id} className="border border-gray-100 rounded-xl p-3 text-sm">
                        <p className="font-semibold text-gray-800">{s.carrier} — {s.tracking_number}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDateTime(s.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail.refunds?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400 mb-2">Refunds</p>
                  <div className="space-y-2">
                    {detail.refunds.map((r) => (
                      <div key={r.id} className="border border-gray-100 rounded-xl p-3 text-sm">
                        <p className="font-semibold text-gray-800">{formatMoney(r.amount)}</p>
                        <p className="text-xs text-gray-400 mt-1">{r.reason || "No reason"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail.returns?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400 mb-2">Returns</p>
                  <div className="space-y-2">
                    {detail.returns.map((r) => (
                      <div key={r.id} className="border border-gray-100 rounded-xl p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <Badge value={r.status} label={titleCase(r.status)} />
                          {r.status === "requested" && (
                            <div className="flex gap-1">
                              <button onClick={() => handleReturnStatus(r.id, "approved")} className="px-2 py-1 rounded-lg bg-button text-white text-xs font-bold hover:bg-button-hover">Approve</button>
                              <button onClick={() => handleReturnStatus(r.id, "rejected")} className="px-2 py-1 rounded-lg bg-button text-white text-xs font-bold hover:bg-button-hover">Reject</button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{r.reason} · {titleCase(r.resolution)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Refund modal */}
      <Modal open={!!refundModal} onClose={() => setRefundModal(null)} title={`Refund ${refundModal?.number || ""}`}>
        {refundModal && (
          <div className="space-y-4">
            <Input label="Amount *" type="number" step="0.01" value={refundModal.amount} onChange={(e) => setRefundModal({ ...refundModal, amount: e.target.value })} />
            <TextArea label="Reason" value={refundModal.reason} onChange={(e) => setRefundModal({ ...refundModal, reason: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRefundModal(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleRefund} disabled={saving}>{saving ? "Processing..." : "Process Refund"}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ship modal */}
      <Modal open={!!shipModal} onClose={() => setShipModal(null)} title={`Ship Order ${shipModal?.number || ""}`}>
        {shipModal && (
          <div className="space-y-4">
            <div>
              <Input
                label="Carrier *"
                placeholder="e.g. J&T Express, VET, FedEx, Grab"
                value={shipModal.carrier}
                onChange={(e) => {
                  const val = e.target.value;
                  setShipModal((prev) => ({ ...prev, carrier: val }));
                }}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["J&T Express", "VET Express", "FedEx", "DHL", "Grab Express"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setShipModal((prev) => ({
                        ...prev,
                        carrier: c,
                        tracking_number: generateTrackingNumber(c),
                      }));
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      shipModal.carrier === c
                        ? "bg-sky-50 border-sky-400 text-sky-700 font-semibold shadow-xs"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Tracking Number *
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setShipModal((prev) => ({
                      ...prev,
                      tracking_number: generateTrackingNumber(prev.carrier),
                    }))
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
                >
                  <i className="bi bi-arrow-repeat" /> Generate New
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 pr-28 text-sm bg-white font-mono text-gray-800 tracking-wider focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-shadow"
                  placeholder="e.g. JT-261004-9B3X8A"
                  value={shipModal.tracking_number}
                  onChange={(e) => setShipModal({ ...shipModal, tracking_number: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() =>
                    setShipModal((prev) => ({
                      ...prev,
                      tracking_number: generateTrackingNumber(prev.carrier),
                    }))
                  }
                  title="Generate tracking number"
                  className="absolute right-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200/60 transition-all flex items-center gap-1"
                >
                  <i className="bi bi-magic" />
                  Generate
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Auto-generated tracking code or enter a courier tracking number.
              </p>
            </div>

            <Select label="Status" value={shipModal.status} onChange={(e) => setShipModal({ ...shipModal, status: e.target.value })}>
              <option value="shipped">Shipped</option>
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
            </Select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShipModal(null)}>Cancel</Button>
              <Button onClick={handleShip} disabled={saving}>{saving ? "Saving..." : "Create Shipment"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrdersPage;