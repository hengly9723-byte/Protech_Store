import React, { useEffect, useState, useCallback } from "react";
import {
  getAdminDiscountCodesApi,
  createDiscountCodeApi,
  updateDiscountCodeApi,
  deleteDiscountCodeApi,
  getProductsApi,
  getAdminCategoriesApi,
} from "../../services/api";
import { formatDateTime, titleCase } from "../../utils/format";
import { PageHeader, Badge, TableWrap, TableHead, Spinner, EmptyState, Button, Input, Select, Checkbox, Modal } from "../../components/admin/ui";

const toLocalInput = (iso) => (iso ? iso.slice(0, 16) : "");

const emptyCode = {
  code: "",
  type: "percentage",
  value: "",
  minimum_order_value: "",
  maximum_discount: "",
  usage_limit: "",
  per_customer_limit: "",
  starts_at: "",
  expires_at: "",
  is_active: true,
  product_ids: [],
  category_ids: [],
};

const DiscountCodesPage = () => {
  const [codes, setCodes] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        getProductsApi({ page_size: 100 }),
        getAdminCategoriesApi({ all_flat: true }),
      ]);
      setProducts(pRes.data.results || pRes.data);
      setCategories(cRes.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminDiscountCodesApi();
      setCodes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadMeta();
  }, [load, loadMeta]);

  const open = (c) =>
    setModal(
      c
        ? {
            ...emptyCode,
            ...c,
            value: c.value ?? "",
            minimum_order_value: c.minimum_order_value ?? "",
            maximum_discount: c.maximum_discount ?? "",
            usage_limit: c.usage_limit ?? "",
            per_customer_limit: c.per_customer_limit ?? "",
            starts_at: toLocalInput(c.starts_at),
            expires_at: toLocalInput(c.expires_at),
            product_ids: (c.products || []).map((p) => p.id),
          }
        : { ...emptyCode }
    );

  const save = async () => {
    setSaving(true);
    const payload = { ...modal };
    for (const key of ["value", "minimum_order_value", "maximum_discount", "usage_limit", "per_customer_limit"]) {
      if (payload[key] === "" || payload[key] === null) delete payload[key];
    }
    for (const key of ["starts_at", "expires_at"]) {
      if (!payload[key]) delete payload[key];
    }
    if (!payload.code) return alert("Code is required.");
    if (!payload.value) return alert("Value is required.");
    try {
      if (modal.id) await updateDiscountCodeApi(modal.id, payload);
      else await createDiscountCodeApi(payload);
      setModal(null);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || Object.values(err.response?.data || {}).flat().join(", ") || "Failed to save discount code.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete discount code "${c.code}"?`)) return;
    try {
      await deleteDiscountCodeApi(c.id);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete discount code.");
    }
  };

  const toggleId = (list, id) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div>
      <PageHeader
        title="Discount Codes"
        subtitle="Create and manage promotional discount codes"
        actions={<Button onClick={() => open(null)}><i className="bi bi-plus-lg" /> New Code</Button>}
      />

      {loading ? (
        <Spinner label="Loading discount codes..." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[800px] text-left text-sm">
            <TableHead cols={["Code", "Type", "Value", "Used", "Expires", "Active", "Actions"]} />
            <tbody>
              {codes.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center">
                    <EmptyState icon="bi-percent" title="No discount codes yet" />
                  </td>
                </tr>
              )}
              {codes.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-bold text-gray-900 font-mono whitespace-nowrap">{c.code}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{titleCase(c.type)}</td>
                  <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{c.type === "percentage" ? `${c.value}%` : `$${c.value}`}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{c.expires_at ? formatDateTime(c.expires_at) : "Never"}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge value={c.is_active} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button onClick={() => open(c)} className="p-2 rounded-lg text-sky-600 hover:bg-sky-50"><i className="bi bi-pencil-square" /></button>
                      <button onClick={() => handleDelete(c)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"><i className="bi bi-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Edit Discount Code" : "New Discount Code"} wide>
        {modal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Code *" value={modal.code} onChange={(e) => setModal({ ...modal, code: e.target.value.toUpperCase() })} />
              <Select label="Type" value={modal.type} onChange={(e) => setModal({ ...modal, type: e.target.value })}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </Select>
              <Input label={modal.type === "percentage" ? "Value (%) *" : "Value ($) *"} type="number" step="0.01" value={modal.value} onChange={(e) => setModal({ ...modal, value: e.target.value })} />
              <Input label="Minimum Order" type="number" step="0.01" value={modal.minimum_order_value} onChange={(e) => setModal({ ...modal, minimum_order_value: e.target.value })} />
              <Input label="Maximum Discount" type="number" step="0.01" value={modal.maximum_discount} onChange={(e) => setModal({ ...modal, maximum_discount: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Usage Limit" type="number" value={modal.usage_limit} onChange={(e) => setModal({ ...modal, usage_limit: e.target.value })} />
                <Input label="Per Customer" type="number" value={modal.per_customer_limit} onChange={(e) => setModal({ ...modal, per_customer_limit: e.target.value })} />
              </div>
              <Input label="Starts At" type="datetime-local" value={modal.starts_at} onChange={(e) => setModal({ ...modal, starts_at: e.target.value })} />
              <Input label="Expires At" type="datetime-local" value={modal.expires_at} onChange={(e) => setModal({ ...modal, expires_at: e.target.value })} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Restrict to Products</p>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                {products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="accent-sky-600" checked={modal.product_ids.includes(p.id)} onChange={() => setModal({ ...modal, product_ids: toggleId(modal.product_ids, p.id) })} />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Restrict to Categories</p>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="accent-sky-600" checked={modal.category_ids.includes(c.id)} onChange={() => setModal({ ...modal, category_ids: toggleId(modal.category_ids, c.id) })} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

            <Checkbox label="Active" checked={modal.is_active} onChange={(e) => setModal({ ...modal, is_active: e.target.checked })} />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DiscountCodesPage;