import React, { useEffect, useState, useCallback } from "react";
import {
  getStockApi,
  getLowStockApi,
  getStockTransactionsApi,
  adjustStockApi,
} from "../../services/api";
import { formatDateTime, titleCase } from "../../utils/format";
import { PageHeader, Badge, TableWrap, TableHead, Spinner, EmptyState, Button, Input, Select, Modal, TextArea } from "../../components/admin/ui";

const ADJUST_TYPES = [
  { value: "restock", label: "Restock" },
  { value: "adjustment", label: "Adjustment" },
  { value: "damaged", label: "Damaged" },
  { value: "return", label: "Return" },
  { value: "sale", label: "Sale" },
];

const StockPage = () => {
  const [tab, setTab] = useState("levels");
  const [stock, setStock] = useState([]);
  const [lowCount, setLowCount] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adjustModal, setAdjustModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadLevels = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRes, lowRes] = await Promise.all([
        getStockApi({ page_size: 100, search }),
        getLowStockApi({ page_size: 100 }),
      ]);
      setStock(stockRes.data.results || []);
      setLowCount((lowRes.data.results || []).length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await getStockTransactionsApi({ page_size: 50 });
      setTransactions(res.data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLevels();
  }, [loadLevels]);

  useEffect(() => {
    if (tab === "transactions") loadTransactions();
  }, [tab, loadTransactions]);

  const handleAdjust = async () => {
    setSaving(true);
    try {
      await adjustStockApi(adjustModal.variant, {
        quantity: Number(adjustModal.quantity),
        type: adjustModal.type,
        note: adjustModal.note,
      });
      setAdjustModal(null);
      await loadLevels();
    } catch (err) {
      alert(err.response?.data?.error || Object.values(err.response?.data || {}).flat().join(", ") || "Failed to adjust stock.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Stock & Inventory"
        subtitle="Monitor levels, adjust quantities, and review the audit trail"
      />

      <div className="flex gap-1 mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 w-fit">
        {[
          { key: "levels", label: `Stock Levels` },
          { key: "transactions", label: "Transactions" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              tab === t.key ? "bg-button hover:bg-button-hover text-white shadow-md" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
            {t.key === "levels" && lowCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">{lowCount} low</span>
            )}
          </button>
        ))}
      </div>

      {tab === "levels" && (
        <div>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6">
            <Input
              placeholder="Search product or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <Spinner label="Loading stock levels..." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[900px] text-left text-sm">
                <TableHead cols={["Product", "SKU", "Available", "Reserved", "Damaged", "Reorder Level", "Status", "Actions"]} />
                <tbody>
                  {stock.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center">
                        <EmptyState icon="bi-boxes" title="No stock records" subtitle="Add variants and stock records will appear here." />
                      </td>
                    </tr>
                  )}
                  {stock.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{s.product_name}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.variant_sku}</td>
                      <td className="px-4 py-3 font-black text-gray-900 whitespace-nowrap">{s.quantity_available}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.quantity_reserved}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.quantity_damaged}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.reorder_level}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge value={s.is_low_stock ? "low" : "ok"} map={{ low: "bg-amber-50 text-amber-700 border-amber-200", ok: "bg-emerald-50 text-emerald-700 border-emerald-200" }} label={s.is_low_stock ? "Low" : "OK"} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Button variant="ghost" onClick={() => setAdjustModal({ variant: s.variant, sku: s.variant_sku, quantity: "", type: "adjustment", note: "" })}>
                          <i className="bi bi-sliders2" /> Adjust
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      )}

      {tab === "transactions" && (
        txLoading ? (
          <Spinner label="Loading transactions..." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[800px] text-left text-sm">
              <TableHead cols={["Date", "Type", "Variant", "SKU", "Qty", "By", "Note"]} />
              <tbody>
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center">
                      <EmptyState icon="bi-clock-history" title="No transactions yet" subtitle="Stock movements will be logged here automatically." />
                    </td>
                  </tr>
                )}
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge value={t.type} label={titleCase(t.type)} /></td>
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{t.variant_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.variant_sku}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`font-black ${Number(t.quantity) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {Number(t.quantity) >= 0 ? `+${t.quantity}` : t.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.created_by_email || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[220px] truncate whitespace-nowrap">{t.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )
      )}

      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title={`Adjust Stock — ${adjustModal?.sku || ""}`}>
        {adjustModal && (
          <div className="space-y-4">
            <Select label="Transaction Type" value={adjustModal.type} onChange={(e) => setAdjustModal({ ...adjustModal, type: e.target.value })}>
              {ADJUST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Input label="Quantity Delta *" type="number" value={adjustModal.quantity} onChange={(e) => setAdjustModal({ ...adjustModal, quantity: e.target.value })}
              hint="Positive for restock/returns; negative for sales/damage" />
            <TextArea label="Note" value={adjustModal.note} onChange={(e) => setAdjustModal({ ...adjustModal, note: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAdjustModal(null)}>Cancel</Button>
              <Button onClick={handleAdjust} disabled={saving}>{saving ? "Saving..." : "Apply Adjustment"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StockPage;