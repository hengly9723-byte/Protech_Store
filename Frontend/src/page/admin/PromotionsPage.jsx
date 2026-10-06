import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  getAdminPromotionsApi,
  createPromotionApi,
  updatePromotionApi,
  deletePromotionApi,
  uploadPromotionBannerApi,
  getProductsApi,
} from "../../services/api";
import { formatDateTime, titleCase } from "../../utils/format";
import { PageHeader, Badge, TableWrap, TableHead, Spinner, EmptyState, Button, Input, Select, TextArea, Checkbox, Modal } from "../../components/admin/ui";

const toLocalInput = (iso) => (iso ? iso.slice(0, 16) : "");

const resolveBannerUrl = (url) => {
  if (!url) return "";
  return url;
};

const emptyPromo = {
  name: "",
  description: "",
  type: "sale",
  bannerImageUrl: "",
  discountType: "percentage",
  discountValue: 0,
  starts_at: "",
  ends_at: "",
  is_active: true,
  product_ids: [],
};

const SAMPLE_PRESET_BANNERS = [
  {
    label: "Cyberpunk Hardware",
    url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Minimalist Workspace",
    url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1920&q=80",
  },
  {
    label: "Gaming Battle Station",
    url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1920&q=80",
  },
];

const PromotionsPage = () => {
  const [promos, setPromos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [promoRes, prodRes] = await Promise.all([
        getAdminPromotionsApi(),
        getProductsApi({ page_size: 100 }),
      ]);
      setPromos(promoRes.data);
      setProducts(prodRes.data.results || prodRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (p) => {
    setUploadError("");
    setUploadingFile(false);
    setModal(
      p
        ? {
            ...emptyPromo,
            ...p,
            bannerImageUrl: p.bannerImageUrl || p.banner_image_url || "",
            discountType: p.discountType || p.discount_type || "percentage",
            discountValue:
              p.discountValue !== undefined
                ? p.discountValue
                : p.discount_value !== undefined
                ? p.discount_value
                : 0,
            starts_at: toLocalInput(p.starts_at),
            ends_at: toLocalInput(p.ends_at),
            product_ids: (p.products || []).map((x) => x.id),
          }
        : { ...emptyPromo }
    );
  };

  const convertImageToWebP = (file) => {
    return new Promise((resolve) => {
      if (file.type === "image/webp") {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const webpFile = new File(
                  [blob],
                  file.name.replace(/\.[^.]+$/, "") + ".webp",
                  { type: "image/webp" }
                );
                resolve(webpFile);
              } else {
                resolve(file);
              }
            },
            "image/webp",
            0.88
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    // Validate size (max 25MB)
    if (rawFile.size > 25 * 1024 * 1024) {
      setUploadError("Image exceeds 25MB size limit. Please upload a smaller image.");
      return;
    }

    setUploadError("");

    // Convert to modern WebP format for fast delivery
    const file = await convertImageToWebP(rawFile);

    // Instant local preview for immediate visual feedback
    const localPreview = URL.createObjectURL(file);
    setModal((prev) => ({
      ...prev,
      bannerImageUrl: localPreview,
      banner_image_url: localPreview,
    }));

    // Upload directly to server media storage
    setUploadingFile(true);
    try {
      const res = await uploadPromotionBannerApi(file);
      const serverUrl = res.data.banner_image_url || res.data.bannerImageUrl;
      setModal((prev) => ({
        ...prev,
        bannerImageUrl: serverUrl,
        banner_image_url: serverUrl,
      }));
    } catch (err) {
      console.warn("Direct banner upload failed, using DataURL fallback:", err);
      // Fallback to FileReader base64 DataURL (backend will decode and save)
      const reader = new FileReader();
      reader.onloadend = () => {
        setModal((prev) => ({
          ...prev,
          bannerImageUrl: reader.result,
          banner_image_url: reader.result,
        }));
      };
      reader.onerror = () => {
        setUploadError("Failed to read image file.");
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingFile(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const payload = { ...modal };
    for (const key of ["starts_at", "ends_at"]) {
      if (!payload[key]) delete payload[key];
    }
    if (!payload.name) {
      setSaving(false);
      return alert("Name is required.");
    }

    // Clean up read-only / nested structures
    delete payload.products;
    delete payload.featuredProducts;
    delete payload.products_count;
    delete payload.created_at;
    delete payload.updated_at;

    // Ensure both bannerImageUrl and banner_image_url are synchronized
    payload.bannerImageUrl = modal.bannerImageUrl || "";
    payload.banner_image_url = modal.bannerImageUrl || "";
    payload.discountType = modal.discountType || "percentage";
    payload.discount_type = modal.discountType || "percentage";
    payload.discountValue = parseFloat(modal.discountValue) || 0;
    payload.discount_value = parseFloat(modal.discountValue) || 0;
    payload.product_ids = modal.product_ids || [];

    try {
      if (modal.id) await updatePromotionApi(modal.id, payload);
      else await createPromotionApi(payload);
      setModal(null);
      await load();
    } catch (err) {
      console.error("Save promotion failed:", err.response?.data);
      const errorMsg =
        err.response?.data?.error ||
        Object.entries(err.response?.data || {})
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join(" | ") ||
        "Failed to save promotion.";
      alert(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete promotion "${p.name}"?`)) return;
    try {
      await deletePromotionApi(p.id);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete promotion.");
    }
  };

  const toggleId = (list, id) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div>
      <PageHeader
        title="Promotions"
        subtitle="Manage hero campaign banners, seasonal sales, and featured product shelves"
        actions={
          <Button onClick={() => open(null)}>
            <i className="bi bi-plus-lg" /> New Promotion
          </Button>
        }
      />

      {loading ? (
        <Spinner label="Loading promotions..." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[900px] text-left text-sm">
            <TableHead
              cols={[
                "Banner",
                "Name",
                "Type",
                "Discount",
                "Products",
                "Starts",
                "Ends",
                "Active",
                "Actions",
              ]}
            />
            <tbody>
              {promos.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center">
                    <EmptyState icon="bi-megaphone" title="No promotions yet" />
                  </td>
                </tr>
              )}
              {promos.map((p) => {
                const bannerSrc = p.bannerImageUrl || p.banner_image_url;
                const dType = p.discountType || p.discount_type || "percentage";
                const dVal = Number(p.discountValue ?? p.discount_value ?? 0);
                const discountText =
                  dVal > 0
                    ? dType === "percentage"
                      ? `${dVal}% OFF`
                      : `$${dVal.toFixed(2)} OFF`
                    : "No discount";

                return (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {bannerSrc ? (
                        <div className="relative group/thumb w-24 h-10 rounded-lg overflow-hidden border border-gray-200 shadow-2xs bg-gray-900">
                          <img
                            src={resolveBannerUrl(bannerSrc)}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-10 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] font-semibold text-gray-400">
                          <i className="bi bi-image mr-1 text-xs" /> Gradient
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {titleCase(p.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black tracking-wide ${
                          dVal > 0
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {discountText}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">
                        {p.products_count}
                      </span>{" "}
                      items
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {p.starts_at ? formatDateTime(p.starts_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {p.ends_at ? formatDateTime(p.ends_at) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge value={p.is_active} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button
                          onClick={() => open(p)}
                          className="p-2 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors"
                          title="Edit promotion"
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Delete promotion"
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

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Edit Promotion" : "New Promotion"}
        wide
      >
        {modal && (
          <div className="space-y-5">
            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Promotion Campaign Name *"
                  placeholder="e.g., Summer Supercharged Hardware Fest"
                  value={modal.name}
                  onChange={(e) =>
                    setModal({ ...modal, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Select
                  label="Campaign Type"
                  value={modal.type}
                  onChange={(e) =>
                    setModal({ ...modal, type: e.target.value })
                  }
                >
                  <option value="sale">Sale</option>
                  <option value="bundle">Bundle</option>
                  <option value="seasonal">Seasonal</option>
                  <option value="clearance">Clearance</option>
                  <option value="campaign">Campaign</option>
                </Select>
              </div>
            </div>

            {/* Promotional Discount Configuration */}
            <div className="bg-orange-50/60 rounded-2xl p-4 border border-orange-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <i className="bi bi-tag-fill text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  Promotional Pricing Rule (Non-Stacking Baseline)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <Select
                    label="Discount Type *"
                    value={modal.discountType || "percentage"}
                    onChange={(e) =>
                      setModal({ ...modal, discountType: e.target.value })
                    }
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </Select>
                </div>
                <div>
                  <Input
                    label={`Discount Value (${
                      modal.discountType === "fixed" ? "$" : "%"
                    }) *`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={
                      modal.discountType === "fixed" ? "e.g., 50.00" : "e.g., 20"
                    }
                    value={modal.discountValue}
                    onChange={(e) =>
                      setModal({ ...modal, discountValue: e.target.value })
                    }
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                During the active campaign window, featured products will automatically
                be discounted using their baseline price (compareAtPrice or price).
              </p>
            </div>

            {/* Banner Image Uploader & URL Input with Live Preview */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-gray-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Hero Banner Image
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Recommended size:{" "}
                    <span className="font-semibold text-primary">1920x600px</span>
                    . Max 5MB. Formats: JPG, PNG, WebP.
                  </p>
                </div>
                {modal.bannerImageUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setModal({ ...modal, bannerImageUrl: "" })
                    }
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <i className="bi bi-x-circle" /> Clear Banner
                  </button>
                )}
              </div>

              {/* URL input and File upload triggers */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                    <i className="bi bi-link-45deg text-base" />
                  </span>
                  <input
                    type="url"
                    placeholder="Paste banner image URL (e.g., https://...)"
                    value={modal.bannerImageUrl || ""}
                    onChange={(e) =>
                      setModal({ ...modal, bannerImageUrl: e.target.value })
                    }
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={uploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs py-2 whitespace-nowrap cursor-pointer"
                  >
                    {uploadingFile ? (
                      <span className="flex items-center gap-1.5 text-primary">
                        <i className="bi bi-arrow-repeat animate-spin" /> Uploading...
                      </span>
                    ) : (
                      <>
                        <i className="bi bi-cloud-arrow-up" /> Upload File
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {uploadError && (
                <p className="text-xs text-rose-600 font-medium">{uploadError}</p>
              )}

              {/* Preset quick picks */}
              <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-600">Sample Presets:</span>
                {SAMPLE_PRESET_BANNERS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setModal({ ...modal, bannerImageUrl: preset.url })
                    }
                    className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:border-primary hover:text-primary transition-colors cursor-pointer text-xs"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Image Preview Window */}
              <div className="relative w-full aspect-[16/5] min-h-[140px] max-h-[220px] rounded-xl overflow-hidden border border-gray-200 bg-zinc-900 flex items-center justify-center">
                {modal.bannerImageUrl ? (
                  <>
                    <img
                      src={resolveBannerUrl(modal.bannerImageUrl)}
                      alt="Banner Preview"
                      className="w-full h-full object-cover object-center"
                      onError={() =>
                        setUploadError(
                          "Failed to load image preview from the provided URL. Please verify the link."
                        )
                      }
                      onLoad={() => setUploadError("")}
                    />
                    {/* Simulated Storefront Overlay Preview */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent p-4 flex flex-col justify-end pointer-events-none">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary text-white w-max mb-1 shadow-xs">
                        {modal.type || "Sale"} Campaign
                      </span>
                      <h4 className="text-white font-black text-base sm:text-lg drop-shadow-md truncate">
                        {modal.name || "Preview Promotion Title"}
                      </h4>
                      <p className="text-gray-200 text-xs line-clamp-1 drop-shadow-sm max-w-md">
                        {modal.description || "Banner visual preview overlay"}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 text-gray-400 flex items-center justify-center mb-2">
                      <i className="bi bi-image text-lg" />
                    </div>
                    <p className="text-xs font-semibold text-gray-300">
                      No custom banner image selected
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Storefront will automatically display a sleek styled tech gradient fallback.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Campaign Scheduling Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Campaign Starts At"
                type="datetime-local"
                value={modal.starts_at}
                onChange={(e) =>
                  setModal({ ...modal, starts_at: e.target.value })
                }
              />
              <Input
                label="Campaign Ends At"
                type="datetime-local"
                value={modal.ends_at}
                onChange={(e) =>
                  setModal({ ...modal, ends_at: e.target.value })
                }
              />
            </div>

            <TextArea
              label="Description / Marketing Hook"
              placeholder="Highlight exclusive discounts, bundled bonuses, and key campaign details..."
              value={modal.description}
              onChange={(e) =>
                setModal({ ...modal, description: e.target.value })
              }
            />

            {/* Featured Products Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Featured Products in Campaign (
                  {modal.product_ids.length} selected)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setModal({
                        ...modal,
                        product_ids: products.slice(0, 8).map((p) => p.id),
                      })
                    }
                    className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                  >
                    Select Top 8
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    type="button"
                    onClick={() => setModal({ ...modal, product_ids: [] })}
                    className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2 divide-y divide-gray-100 bg-white">
                {products.map((p) => {
                  const isChecked = modal.product_ids.includes(p.id);
                  const thumb =
                    p.primary_image?.image_url || p.images?.[0]?.image_url;
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm text-gray-700 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary w-4 h-4 rounded"
                        checked={isChecked}
                        onChange={() =>
                          setModal({
                            ...modal,
                            product_ids: toggleId(modal.product_ids, p.id),
                          })
                        }
                      />
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={p.name}
                          className="w-8 h-8 rounded object-contain bg-gray-50 border border-gray-100 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                          <i className="bi bi-box text-xs" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-gray-900 block truncate">
                          {p.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          ${p.base_price || 0}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Checked products appear directly in the storefront hero banner shelf.
              </p>
            </div>

            <Checkbox
              label="Campaign is Active (published to storefront hero section)"
              checked={modal.is_active}
              onChange={(e) =>
                setModal({ ...modal, is_active: e.target.checked })
              }
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save Promotion"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PromotionsPage;