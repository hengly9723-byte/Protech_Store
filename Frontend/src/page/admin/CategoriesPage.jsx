import React, { useEffect, useState, useCallback } from "react";
import {
  getAdminCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  deleteCategoryApi,
} from "../../services/api";
import { PageHeader, Badge, TableWrap, TableHead, Spinner, EmptyState, Button, Input, Select, TextArea, Checkbox, Modal } from "../../components/admin/ui";

const emptyCategory = { name: "", slug: "", parent: "", description: "", image_url: "", is_active: true, sort_order: 0 };

const toSlug = (text) =>
  (text || "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");

const extractErrorMessage = (err) => {
  const data = err.response?.data;
  if (!data) return err.message || "Failed to save category.";
  if (data.errors && typeof data.errors === "object") {
    const details = Object.entries(data.errors)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
      .join("\n");
    return `${data.message || "Validation Error"}\n\n${details}`;
  }
  if (data.message) return data.message;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  return "Failed to save category.";
};

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all"); // 'all' | 'root' | 'sub'
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminCategoriesApi({ all_flat: true });
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openRoot = () => {
    setModal({ ...emptyCategory, parent: "", mode: "root" });
  };

  const openSub = (parentCategory = null) => {
    setModal({
      ...emptyCategory,
      parent: parentCategory ? parentCategory.id : (categories[0]?.id || ""),
      mode: "sub",
    });
  };

  const open = (c) => {
    setModal(
      c
        ? { ...c, parent: c.parent || "", mode: c.parent ? "sub" : "root", is_active: c.is_active }
        : { ...emptyCategory, mode: "all" }
    );
  };

  const handleNameChange = (val) => {
    setModal((prev) => {
      const shouldUpdateSlug = !prev.id && (!prev.slug || prev.slug === toSlug(prev.name));
      return {
        ...prev,
        name: val,
        slug: shouldUpdateSlug ? toSlug(val) : prev.slug,
      };
    });
  };

  const save = async () => {
    setSaving(true);
    const cleanSlug = modal.slug ? toSlug(modal.slug) : toSlug(modal.name);
    const payload = {
      ...modal,
      slug: cleanSlug,
      parent: modal.parent ? modal.parent : null,
    };
    if (!payload.name) {
      setSaving(false);
      return alert("Name is required.");
    }
    delete payload.mode;

    try {
      if (modal.id) await updateCategoryApi(modal.id, payload);
      else await createCategoryApi(payload);
      setModal(null);
      await load();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    try {
      await deleteCategoryApi(c.id);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete category.");
    }
  };

  const parentName = (id) => categories.find((c) => String(c.id) === String(id))?.name || "—";

  const rootCount = categories.filter((c) => !c.parent).length;
  const subCount = categories.filter((c) => !!c.parent).length;

  const filtered = categories.filter((c) => {
    if (filter === "root" && c.parent) return false;
    if (filter === "sub" && !c.parent) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = (c.name || "").toLowerCase().includes(q);
      const matchSlug = (c.slug || "").toLowerCase().includes(q);
      if (!matchName && !matchSlug) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organise your catalog into root categories and subcategories"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openRoot}>
              <i className="bi bi-folder-plus" /> Add Root Category
            </Button>
            <Button variant="secondary" onClick={() => openSub()}>
              <i className="bi bi-diagram-3" /> Add Subcategory
            </Button>
          </div>
        }
      />

      {/* Filter tabs and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("root")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === "root" ? "bg-white text-sky-700 shadow-xs font-bold" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <i className="bi bi-folder-fill text-sky-500 text-[10px]" />
            Root Categories ({rootCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("sub")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === "sub" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <i className="bi bi-diagram-3 text-gray-400 text-[11px]" />
            Subcategories ({subCount})
          </button>
        </div>

        <div className="relative sm:w-64">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading categories..." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[700px] text-left text-sm">
            <TableHead cols={["Name", "Slug", "Level / Parent", "Sort", "Active", "Actions"]} />
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <EmptyState
                      icon="bi-tags"
                      title={search || filter !== "all" ? "No matching categories" : "No categories yet"}
                      subtitle={search || filter !== "all" ? "Try adjusting your search or filter" : "Get started by adding your first root category"}
                    />
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const isRoot = !c.parent;
                return (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <i className={`bi ${isRoot ? "bi-folder-fill text-sky-500" : "bi-arrow-return-right text-gray-400 pl-2"} text-sm`} />
                        <span>{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.slug}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isRoot ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200/70">
                          <i className="bi bi-folder-fill text-[10px]" /> ROOT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-gray-700 text-xs">
                          <span className="text-gray-400">Under:</span>
                          <span className="font-semibold text-gray-800">{parentName(c.parent)}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.sort_order}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge value={c.is_active} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openSub(c)}
                          title={`Add subcategory under ${c.name}`}
                          className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                        >
                          <i className="bi bi-folder-plus" />
                        </button>
                        <button
                          type="button"
                          onClick={() => open(c)}
                          title="Edit category"
                          className="p-2 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          title="Delete category"
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={
          modal?.id
            ? "Edit Category"
            : modal?.mode === "root"
            ? "New Root Category"
            : modal?.mode === "sub"
            ? "New Subcategory"
            : "New Category"
        }
      >
        {modal && (
          <div className="space-y-4">
            {/* Context Notice for Root Category */}
            {modal.mode === "root" && !modal.id && (
              <div className="rounded-xl bg-sky-50 border border-sky-200/70 p-3 text-xs text-sky-800 flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <i className="bi bi-folder-check text-sky-600 text-sm" />
                  Creating a top-level <strong>Root Category</strong> (no parent)
                </span>
                <button
                  type="button"
                  onClick={() => setModal({ ...modal, mode: "sub", parent: categories[0]?.id || "" })}
                  className="text-sky-700 underline hover:text-sky-900 font-semibold cursor-pointer"
                >
                  Make subcategory
                </button>
              </div>
            )}

            <Input
              label="Name *"
              value={modal.name}
              placeholder="e.g. Computing, Audio, Accessories"
              onChange={(e) => handleNameChange(e.target.value)}
            />

            <Input
              label="Slug"
              value={modal.slug}
              placeholder="e.g. gaming-laptops"
              onChange={(e) => setModal({ ...modal, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
              hint="Leave blank to auto-generate from name"
            />

            {/* Parent Category selector (shown unless explicitly locked to root) */}
            {modal.mode !== "root" && (
              <Select
                label="Parent Category"
                value={modal.parent}
                onChange={(e) => setModal({ ...modal, parent: e.target.value })}
              >
                <option value="">— None (Root Category) —</option>
                {categories
                  .filter((c) => c.id !== modal.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent ? `↳ ${c.name}` : `📁 ${c.name} (Root)`}
                    </option>
                  ))}
              </Select>
            )}

            {modal.mode === "root" && (
              <div className="text-xs text-gray-500 flex items-center justify-between">
                <span>Parent: <strong>None (Root Level)</strong></span>
                <button
                  type="button"
                  onClick={() => setModal({ ...modal, mode: "sub", parent: categories[0]?.id || "" })}
                  className="text-xs text-sky-600 hover:underline cursor-pointer"
                >
                  Change to child category
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Sort Order"
                type="number"
                value={modal.sort_order}
                onChange={(e) => setModal({ ...modal, sort_order: Number(e.target.value) })}
              />
              <Checkbox
                label="Active"
                checked={modal.is_active}
                onChange={(e) => setModal({ ...modal, is_active: e.target.checked })}
                className="items-end pb-1"
              />
            </div>

            <Input
              label="Image URL"
              value={modal.image_url}
              placeholder="https://..."
              onChange={(e) => setModal({ ...modal, image_url: e.target.value })}
            />

            <TextArea
              label="Description"
              value={modal.description}
              placeholder="Category overview or highlights..."
              onChange={(e) => setModal({ ...modal, description: e.target.value })}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Category"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CategoriesPage;