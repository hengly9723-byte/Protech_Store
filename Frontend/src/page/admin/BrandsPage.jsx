import React, { useEffect, useState, useCallback } from "react";
import {
  getAdminBrandsApi,
  createBrandApi,
  updateBrandApi,
  deleteBrandApi,
} from "../../services/api";
import { PageHeader, Badge, TableWrap, TableHead, Spinner, EmptyState, Button, Input, TextArea, Checkbox, Modal } from "../../components/admin/ui";

const emptyBrand = { name: "", slug: "", description: "", logo_url: "", website_url: "", is_active: true };

const BrandsPage = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminBrandsApi();
      setBrands(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (b) => setModal(b ? { ...b, is_active: b.is_active } : { ...emptyBrand });

  const save = async () => {
    setSaving(true);
    const payload = { ...modal };
    if (!payload.name) return alert("Name is required.");
    if (!payload.slug) delete payload.slug;
    try {
      if (modal.id) await updateBrandApi(modal.id, payload);
      else await createBrandApi(payload);
      setModal(null);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || Object.values(err.response?.data || {}).flat().join(", ") || "Failed to save brand.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete brand "${b.name}"?`)) return;
    try {
      await deleteBrandApi(b.id);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete brand.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Manage the brands featured in your store"
        actions={<Button onClick={() => open(null)}><i className="bi bi-plus-lg" /> New Brand</Button>}
      />

      {loading ? (
        <Spinner label="Loading brands..." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[650px] text-left text-sm">
            <TableHead cols={["Brand", "Slug", "Website", "Active", "Actions"]} />
            <tbody>
              {brands.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center">
                    <EmptyState icon="bi-bookmark-star" title="No brands yet" />
                  </td>
                </tr>
              )}
              {brands.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                          <i className="bi bi-bookmark" />
                        </div>
                      )}
                      <span className="font-bold text-gray-900">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{b.slug}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {b.website_url ? (
                      <a href={b.website_url} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
                        {b.website_url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge value={b.is_active} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button onClick={() => open(b)} className="p-2 rounded-lg text-sky-600 hover:bg-sky-50"><i className="bi bi-pencil-square" /></button>
                      <button onClick={() => handleDelete(b)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"><i className="bi bi-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Edit Brand" : "New Brand"}>
        {modal && (
          <div className="space-y-4">
            <Input label="Name *" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
            <Input label="Slug" value={modal.slug} onChange={(e) => setModal({ ...modal, slug: e.target.value })} hint="Leave blank to auto-generate" />
            <Input label="Logo URL" value={modal.logo_url} onChange={(e) => setModal({ ...modal, logo_url: e.target.value })} />
            <Input label="Website URL" value={modal.website_url} onChange={(e) => setModal({ ...modal, website_url: e.target.value })} />
            <TextArea label="Description" value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} />
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

export default BrandsPage;