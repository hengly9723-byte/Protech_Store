import React, { useEffect, useState, useCallback } from "react";
import {
  getSpecDefinitionsApi,
  getSpecOptionsApi,
  createSpecOptionApi,
  updateSpecOptionApi,
  deleteSpecOptionApi,
} from "../../services/api";
import {
  PageHeader,
  Button,
  Input,
  Spinner,
  EmptyState,
  Modal,
  TableWrap,
  TableHead,
} from "../../components/admin/ui";

const HW_ICON = {
  OS: "bi-windows",
  Processor: "bi-cpu",
  Graphics: "bi-gpu-card",
  RAM: "bi-memory",
  Storage: "bi-device-hdd",
  Display: "bi-display",
};

const emptyOption = { label: "", sort_order: 0 };

const SpecificationsPage = () => {
  const [definitions, setDefinitions] = useState([]);
  const [activeDef, setActiveDef] = useState(null);
  const [options, setOptions] = useState([]);
  const [loadingDefs, setLoadingDefs] = useState(true);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const loadDefinitions = useCallback(async () => {
    setLoadingDefs(true);
    try {
      const res = await getSpecDefinitionsApi();
      const defs = (res.data?.results ?? res.data ?? []).filter(
        (d) => ["OS", "Processor", "Graphics", "RAM", "Storage", "Display"].includes(d.name)
      );
      const order = ["OS", "Processor", "Graphics", "RAM", "Storage", "Display"];
      defs.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
      setDefinitions(defs);
      if (defs.length > 0 && !activeDef) setActiveDef(defs[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDefs(false);
    }
  }, [activeDef]);

  const loadOptions = useCallback(async (defId) => {
    if (!defId) return;
    setLoadingOpts(true);
    try {
      const res = await getSpecOptionsApi({ definition: defId });
      setOptions(res.data?.results ?? res.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOpts(false);
    }
  }, []);

  useEffect(() => {
    loadDefinitions();
  }, []);

  useEffect(() => {
    if (activeDef?.id) loadOptions(activeDef.id);
  }, [activeDef, loadOptions]);

  const openModal = (opt = null) =>
    setModal(opt ? { ...opt } : { ...emptyOption, definition: activeDef?.id });

  const saveOption = async () => {
    if (!modal?.label?.trim()) return alert("Label is required.");
    setSaving(true);
    try {
      const payload = {
        definition: activeDef.id,
        label: modal.label.trim(),
        sort_order: Number(modal.sort_order) || 0,
      };
      if (modal.id) await updateSpecOptionApi(modal.id, payload);
      else await createSpecOptionApi(payload);
      setModal(null);
      await loadOptions(activeDef.id);
    } catch (err) {
      alert(
        err.response?.data?.error ||
          Object.values(err.response?.data || {}).flat().join(", ") ||
          "Failed to save option."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async (opt) => {
    if (!window.confirm(`Delete "${opt.label}"?`)) return;
    setDeleting(opt.id);
    try {
      await deleteSpecOptionApi(opt.id);
      await loadOptions(activeDef.id);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete option.");
    } finally {
      setDeleting(null);
    }
  };

  if (loadingDefs) return <Spinner label="Loading specification categories..." />;

  return (
    <div>
      <PageHeader
        title="Specifications"
        subtitle="Manage pre-defined values for each hardware specification category"
        actions={
          activeDef && (
            <Button onClick={() => openModal()}>
              <i className="bi bi-plus-lg" /> Add Option
            </Button>
          )
        }
      />

      {definitions.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <EmptyState
            icon="bi-sliders"
            title="No specification categories found"
            subtitle='Run "python manage.py seed_hardware_specs" on the backend to seed the 6 core hardware categories.'
          />
        </div>
      ) : (
        /* Stacks vertically on mobile, side-by-side on desktop */
        <div className="flex flex-col md:flex-row gap-5">
          {/* ── Left panel: category list ─────────────────────────── */}
          <div className="w-full md:w-56 shrink-0 flex flex-col sm:flex-row md:flex-col gap-1 overflow-x-auto">
            {definitions.map((def) => {
              const isActive = activeDef?.id === def.id;
              return (
                <button
                  key={def.id}
                  onClick={() => setActiveDef(def)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-left transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-sky-500/10 to-indigo-500/10 text-sky-700 border border-sky-200/70 shadow-sm"
                      : "text-gray-600 hover:bg-white hover:shadow-sm border border-transparent"
                  }`}
                >
                  <i
                    className={`bi ${HW_ICON[def.name] || "bi-sliders"} text-base ${
                      isActive ? "text-sky-500" : "text-gray-400"
                    }`}
                  />
                  <span>{def.name}</span>
                  <span
                    className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-sky-100 text-sky-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {def.name === activeDef?.name ? options.length : "·"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Right panel: options for active category ──────────── */}
          <div className="flex-1 min-w-0">
            {/* Panel header (Stacks header text and button on mobile) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                  <i
                    className={`bi ${HW_ICON[activeDef?.name] || "bi-sliders"} text-sky-500 text-lg`}
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {activeDef?.name} Options
                  </h2>
                  <p className="text-xs text-gray-400">
                    {options.length} preset{options.length !== 1 ? "s" : ""} — shown as dropdown choices on product edit
                  </p>
                </div>
              </div>
              <Button onClick={() => openModal()} disabled={!activeDef} className="self-start sm:self-auto">
                <i className="bi bi-plus-lg" /> Add Option
              </Button>
            </div>

            {loadingOpts ? (
              <Spinner label={`Loading ${activeDef?.name} options...`} />
            ) : options.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100">
                <EmptyState
                  icon="bi-list-ul"
                  title={`No ${activeDef?.name} options yet`}
                  subtitle={'Click "Add Option" to create the first preset value for this category.'}
                />
              </div>
            ) : (
              <TableWrap>
                <table className="w-full text-left text-sm">
                  <TableHead cols={["Label / Value", "Sort Order", "Actions"]} />
                  <tbody>
                    {options.map((opt) => (
                      <tr
                        key={opt.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 group"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-gray-800">{opt.label}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">{opt.sort_order}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openModal(opt)}
                              className="p-2 rounded-lg text-sky-600 hover:bg-sky-50"
                              title="Edit"
                            >
                              <i className="bi bi-pencil-square" />
                            </button>
                            <button
                              onClick={() => deleteOption(opt)}
                              disabled={deleting === opt.id}
                              className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                              title="Delete"
                            >
                              {deleting === opt.id ? (
                                <i className="bi bi-arrow-clockwise animate-spin" />
                              ) : (
                                <i className="bi bi-trash" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? `Edit ${activeDef?.name} Option` : `Add ${activeDef?.name} Option`}
      >
        {modal && (
          <div className="space-y-4">
            <Input
              label="Label *"
              value={modal.label}
              placeholder={`e.g. ${
                activeDef?.name === "Graphics"
                  ? "NVIDIA GeForce RTX 5060 Ti"
                  : activeDef?.name === "Processor"
                  ? "Intel Core Ultra 9 290HX"
                  : activeDef?.name === "RAM"
                  ? "64 GB DDR5"
                  : activeDef?.name === "Storage"
                  ? "2 TB NVMe SSD"
                  : activeDef?.name === "Display"
                  ? '18" 4K OLED 120 Hz'
                  : activeDef?.name === "OS"
                  ? "Windows 11 Home"
                  : "Enter value..."
              }`}
              onChange={(e) => setModal({ ...modal, label: e.target.value })}
              autoFocus
            />
            <Input
              label="Sort Order"
              type="number"
              value={modal.sort_order}
              onChange={(e) => setModal({ ...modal, sort_order: e.target.value })}
              hint="Lower numbers appear first in the dropdown"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button onClick={saveOption} disabled={saving}>
                {saving ? "Saving..." : modal.id ? "Update Option" : "Add Option"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SpecificationsPage;