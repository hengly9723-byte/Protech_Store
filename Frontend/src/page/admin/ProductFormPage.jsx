import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getProductDetailApi,
  createProductApi,
  updateProductApi,
  getAdminCategoriesApi,
  getAdminBrandsApi,
  getProductTypesApi,
  createVariantApi,
  updateVariantApi,
  deleteVariantApi,
  createProductImageApi,
  updateProductImageApi,
  deleteProductImageApi,
  createProductSpecApi,
  updateProductSpecApi,
  deleteProductSpecApi,
  getSpecDefinitionsApi,
  getSpecOptionsApi,
  generateBarcodeApi,
} from "../../services/api";
import { formatMoney, titleCase } from "../../utils/format";
import { generateEAN13Barcode } from "../../utils/barcode";
import BarcodeSvg from "../../components/common/BarcodeSvg";
import {
  PageHeader,
  Button,
  Input,
  Select,
  TextArea,
  Checkbox,
  Modal,
  Badge,
  TableWrap,
  TableHead,
  Spinner,
  EmptyState,
} from "../../components/admin/ui";

const TABS = [
  { key: "details", label: "Details" },
  { key: "variants", label: "Variants" },
  { key: "images", label: "Images" },
  { key: "specs", label: "Specifications" },
];

const emptyProduct = {
  name: "",
  slug: "",
  short_description: "",
  description: "",
  currency: "USD",
  warranty_months: "",
  status: "draft",
  is_featured: false,
  is_active: true,
  brand_id: "",
  category_id: "",
  type_id: "",
  reorder_level: 0,
  reorderLevel: 0,
};

const HW_SPEC_KEYS = [
  "OS",
  "Processor",
  "Graphics",
  "RAM",
  "Storage",
  "Display",
];

const emptyHwSpecs = () => Object.fromEntries(HW_SPEC_KEYS.map((k) => [k, ""]));

const emptyVariant = {
  sku: "",
  barcode: "",
  name: "",
  price: "",
  cost_price: "",
  compare_at_price: "",
  weight: "",
  status: "active",
  reorder_level: 0,
  reorderLevel: 0,
  specifications: emptyHwSpecs(), 
};

const emptyImage = {
  image_url: "",
  alt_text: "",
  sort_order: 0,
  is_primary: false,
  variant: "",
};

const normalizeVariantSpecs = (rawSpecs = {}) => {
  const map = emptyHwSpecs();
  if (!rawSpecs || typeof rawSpecs !== "object") return map;
  for (const [key, val] of Object.entries(rawSpecs)) {
    const matchedKey =
      HW_SPEC_KEYS.find((k) => k.toLowerCase() === key.toLowerCase()) || key;
    map[matchedKey] = val || "";
  }
  return map;
};

const ProductFormPage = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [tab, setTab] = useState("details");
  const [lockedNotice, setLockedNotice] = useState("");
  const [form, setForm] = useState(emptyProduct);
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [images, setImages] = useState([]);
  const [specDefs, setSpecDefs] = useState([]); // all SpecificationDefinition records
  const [specOptionsByDef, setSpecOptionsByDef] = useState({}); // definition_id -> preset options
  const [selectedVariantIdForSpecs, setSelectedVariantIdForSpecs] =
    useState("");
  const [variantSpecsForm, setVariantSpecsForm] = useState(emptyHwSpecs());
  const [savingVariantSpecs, setSavingVariantSpecs] = useState(false);
  const [variantSpecsSuccess, setVariantSpecsSuccess] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [variantModal, setVariantModal] = useState(null);
  const [savingVariant, setSavingVariant] = useState(false);
  const [imageModal, setImageModal] = useState(null);
  const [savingImage, setSavingImage] = useState(false);

  const loadMeta = useCallback(async () => {
    const [catRes, brandRes, typeRes, specRes, optRes] = await Promise.all([
      getAdminCategoriesApi({ all_flat: true }),
      getAdminBrandsApi(),
      getProductTypesApi(),
      getSpecDefinitionsApi(),
      getSpecOptionsApi(),
    ]);
    setCategories(catRes.data);
    setBrands(brandRes.data);
    setTypes(typeRes.data);
    const defs = specRes.data?.results ?? specRes.data ?? [];
    setSpecDefs(defs);
    // Group preset options by their definition id for the dropdowns
    const rawOptions = optRes.data?.results ?? optRes.data ?? [];
    const grouped = {};
    for (const opt of rawOptions) {
      const defId = opt.definition;
      if (!defId) continue;
      (grouped[defId] = grouped[defId] || []).push(opt);
    }
    setSpecOptionsByDef(grouped);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await loadMeta();
        if (isEdit) {
          const res = await getProductDetailApi(id);
          const p = res.data;
          setProduct(p);
          setForm({
            name: p.name || "",
            slug: p.slug || "",
            short_description: p.short_description || "",
            description: p.description || "",
            currency: p.currency || "USD",
            warranty_months: p.warranty_months ?? "",
            status: p.status || "draft",
            is_featured: p.is_featured,
            is_active: p.is_active,
            brand_id: p.brand?.id || "",
            category_id: p.category?.id || "",
            type_id: p.type?.id || "",
          });
          const vars = p.variants || [];
          setVariants(vars);
          setImages(p.images || []);
          if (vars.length > 0) {
            setSelectedVariantIdForSpecs(vars[0].id);
            setVariantSpecsForm(normalizeVariantSpecs(vars[0].specifications));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isEdit, loadMeta]);

  const set = (key) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Preset options saved globally for one of the 6 hardware categories
  const optionsForSpecKey = (key) => {
    const def = specDefs.find(
      (d) => d.name.toLowerCase() === key.toLowerCase(),
    );
    return def ? specOptionsByDef[def.id] || [] : [];
  };

  const handleSelectSpecVariant = (vId) => {
    setSelectedVariantIdForSpecs(vId);
    const found = variants.find((v) => String(v.id) === String(vId));
    setVariantSpecsForm(normalizeVariantSpecs(found?.specifications));
    setVariantSpecsSuccess(false);
  };

  // Sub-resource tabs (variants / images / specs) require an existing product id,
  // so they are locked until the product is created and we land on the edit screen.
  const isLockedTab = (key) => key !== "details" && !isEdit;

  const handleTabClick = (key) => {
    if (isLockedTab(key)) {
      setLockedNotice(
        "Save the product details first — you'll be redirected to the edit screen where Variants, Images and Specifications become available.",
      );
      return;
    }
    setLockedNotice("");
    setTab(key);
  };

  const handleSaveProduct = async () => {
    if (!form.name?.trim()) {
      alert("Product name is required.");
      return;
    }
    setSaving(true);
    const payload = { ...form };
    for (const key of ["warranty_months"]) {
      if (payload[key] === "" || payload[key] === null) delete payload[key];
    }
    for (const key of ["brand_id", "category_id", "type_id"]) {
      if (!payload[key]) delete payload[key];
    }
    delete payload.sku;
    delete payload.base_price;
    delete payload.compare_at_price;
    delete payload.cost_price;
    delete payload.weight;
    try {
      let res;
      if (isEdit) {
        res = await updateProductApi(id, payload);
      } else {
        res = await createProductApi(payload);
      }
      alert(isEdit ? "Product updated." : "Product created.");
      if (!isEdit)
        navigate(`/admin/products/${res.data.id}/edit`, { replace: true });
      else {
        setProduct(res.data);
        const freshVariants = res.data.variants || [];
        setVariants(freshVariants);
        setImages(res.data.images || []);
        if (!selectedVariantIdForSpecs && freshVariants.length > 0) {
          setSelectedVariantIdForSpecs(freshVariants[0].id);
          setVariantSpecsForm(
            normalizeVariantSpecs(freshVariants[0].specifications),
          );
        }
      }
    } catch (err) {
      const data = err.response?.data || {};
      const msg =
        data.error ||
        Object.values(data).flat().join(", ") ||
        "Failed to save product.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  // Variant CRUD
  const [generatingBarcode, setGeneratingBarcode] = useState(false);

  const handleGenerateBarcode = async () => {
    setGeneratingBarcode(true);
    try {
      const res = await generateBarcodeApi();
      if (res.data?.barcode) {
        setVariantModal((prev) => ({ ...prev, barcode: res.data.barcode }));
      } else {
        setVariantModal((prev) => ({ ...prev, barcode: generateEAN13Barcode() }));
      }
    } catch {
      setVariantModal((prev) => ({ ...prev, barcode: generateEAN13Barcode() }));
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const openVariant = (v) =>
    setVariantModal(
      v
        ? {
            ...v,
            price: v.price ?? "",
            cost_price: v.cost_price ?? "",
            compare_at_price: v.compare_at_price ?? "",
            weight: v.weight ?? "",
            specifications: normalizeVariantSpecs(v.specifications),
          }
        : {
            ...emptyVariant,
            barcode: generateEAN13Barcode(),
            specifications: emptyHwSpecs(),
          },
    );

  const saveVariant = async () => {
    const v = variantModal;
    if (!v.sku) return alert("SKU is required.");
    setSavingVariant(true);
    const cleanSpecs = {};
    for (const key of HW_SPEC_KEYS) {
      const val = v.specifications?.[key]?.trim();
      if (val) cleanSpecs[key.toLowerCase()] = val;
    }
    const payload = {
      ...v,
      product: isEdit ? id : product?.id,
      specifications: cleanSpecs,
    };
    try {
      if (v.id) await updateVariantApi(v.id, payload);
      else await createVariantApi(payload);
      const res = await getProductDetailApi(isEdit ? id : product.id);
      const freshVars = res.data.variants || [];
      setVariants(freshVars);
      if (freshVars.length > 0) {
        const targetId = v.id || freshVars[freshVars.length - 1]?.id;
        setSelectedVariantIdForSpecs(targetId);
        const targetVar =
          freshVars.find((item) => item.id === targetId) || freshVars[0];
        setVariantSpecsForm(normalizeVariantSpecs(targetVar?.specifications));
      }
      setVariantModal(null);
    } catch (err) {
      alert(
        err.response?.data?.error ||
          Object.values(err.response?.data || {})
            .flat()
            .join(", ") ||
          "Failed to save variant.",
      );
    } finally {
      setSavingVariant(false);
    }
  };

  const deleteVariant = async (v) => {
    if (!window.confirm(`Delete variant "${v.name || v.sku}"?`)) return;
    try {
      await deleteVariantApi(v.id);
      const res = await getProductDetailApi(isEdit ? id : product.id);
      const freshVars = res.data.variants || [];
      setVariants(freshVars);
      if (selectedVariantIdForSpecs === v.id) {
        const nextVar = freshVars[0] || null;
        setSelectedVariantIdForSpecs(nextVar?.id || "");
        setVariantSpecsForm(normalizeVariantSpecs(nextVar?.specifications));
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete variant.");
    }
  };

  const saveVariantSpecsForSelectedVariant = async () => {
    if (!selectedVariantIdForSpecs)
      return alert("Please select a variant to save specifications.");
    setSavingVariantSpecs(true);
    try {
      const cleanSpecs = {};
      for (const key of HW_SPEC_KEYS) {
        const val = variantSpecsForm[key]?.trim();
        if (val) cleanSpecs[key.toLowerCase()] = val;
      }
      await updateVariantApi(selectedVariantIdForSpecs, {
        specifications: cleanSpecs,
      });
      const res = await getProductDetailApi(isEdit ? id : product.id);
      const freshVars = res.data.variants || [];
      setVariants(freshVars);
      const activeVar = freshVars.find(
        (v) => v.id === selectedVariantIdForSpecs,
      );
      setVariantSpecsForm(normalizeVariantSpecs(activeVar?.specifications));
      setVariantSpecsSuccess(true);
      setTimeout(() => setVariantSpecsSuccess(false), 3500);
    } catch (err) {
      alert(
        err.response?.data?.error ||
          Object.values(err.response?.data || {})
            .flat()
            .join(", ") ||
          "Failed to save variant specifications.",
      );
    } finally {
      setSavingVariantSpecs(false);
    }
  };

  // Image CRUD
  const openImage = (img) =>
    setImageModal(
      img
        ? {
            ...img,
            sort_order: img.sort_order ?? 0,
            variant: img.variant || "",
          }
        : { ...emptyImage },
    );
  const saveImage = async () => {
    const img = imageModal;
    if (!img.image_url) return alert("Image URL is required.");
    setSavingImage(true);
    const payload = {
      ...img,
      product: isEdit ? id : product?.id,
      variant: img.variant || null,
      is_primary: !!img.is_primary,
    };
    try {
      if (img.id) await updateProductImageApi(img.id, payload);
      else await createProductImageApi(payload);
      const res = await getProductDetailApi(isEdit ? id : product.id);
      setImages(res.data.images || []);
      setImageModal(null);
    } catch (err) {
      alert(
        err.response?.data?.error ||
          Object.values(err.response?.data || {})
            .flat()
            .join(", ") ||
          "Failed to save image.",
      );
    } finally {
      setSavingImage(false);
    }
  };
  const deleteImage = async (img) => {
    if (!window.confirm("Delete this image?")) return;
    try {
      await deleteProductImageApi(img.id);
      const res = await getProductDetailApi(isEdit ? id : product.id);
      setImages(res.data.images || []);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete image.");
    }
  };

  if (loading)
    return (
      <Spinner label={isEdit ? "Loading product..." : "Preparing form..."} />
    );

  // specDefById kept for future use; spec modal removed
  // const specDefById = (specId) => specDefs.find((d) => String(d.id) === String(specId));

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit Product: ${product?.name}` : "New Product"}
        subtitle={
          isEdit
            ? "Use the tabs to manage variants, images and specifications"
            : "Enter the basic details and save — then continue with variants, images & specifications on the edit screen"
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate("/admin/products")}
            >
              Back
            </Button>
            <Button onClick={handleSaveProduct} disabled={saving}>
              <i className="bi bi-check-lg" />{" "}
              {saving ? "Saving..." : "Save Product"}
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 w-fit">
        {TABS.map((t) => {
          const locked = isLockedTab(t.key);
          return (
            <button
              key={t.key}
              onClick={() => handleTabClick(t.key)}
              title={
                locked ? "Save the product first to unlock this tab" : undefined
              }
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "bg-button hover:bg-button-hover text-white shadow-md"
                  : locked
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100 cursor-pointer"
              }`}
            >
              {locked && <i className="bi bi-lock-fill mr-1 text-[10px]" />}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* New-product notice: sub-resources require saving the product first */}
      {!isEdit && (
        <div className="mb-6 flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 text-sm text-sky-800">
          <i className="bi bi-info-circle-fill text-sky-500 mt-0.5" />
          <span>
            <b>Save the product first.</b> Variants, Images, and Specifications
            are locked until you create the product. Click <b>Save Product</b>{" "}
            and you'll be redirected to the edit screen to finish configuring
            them.
          </span>
        </div>
      )}

      {/* Indicator shown when a locked tab is clicked */}
      {lockedNotice && (
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
          <i className="bi bi-lock-fill text-amber-500 mt-0.5" />
          <span>{lockedNotice}</span>
        </div>
      )}

      {/* Details */}
      {tab === "details" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <div className="mb-5 flex items-start gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs text-slate-600">
            <i className="bi bi-info-circle-fill text-sky-500 mt-0.5 text-sm shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Pure-Variant Architecture</p>
              <p className="mt-0.5 text-slate-500">
                All pricing, SKUs, barcodes, cost prices, weights, and hardware specifications are managed strictly at the variant level in the <b>Variants</b> and <b>Specifications</b> tabs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name *" value={form.name} onChange={set("name")} />
            <Input
              label="Slug"
              value={form.slug}
              onChange={set("slug")}
              hint="Leave blank to auto-generate from name"
            />
            <Select
              label="Brand"
              value={form.brand_id}
              onChange={set("brand_id")}
            >
              <option value="">— None —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select
              label="Category"
              value={form.category_id}
              onChange={set("category_id")}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              label="Product Type"
              value={form.type_id}
              onChange={set("type_id")}
            >
              <option value="">— None —</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select
              label="Currency"
              value={form.currency}
              onChange={set("currency")}
            >
              <option value="USD">USD ($)</option>
              <option value="KHR">KHR (៛)</option>
            </Select>
            <Input
              label="Warranty (months)"
              type="number"
              value={form.warranty_months}
              onChange={set("warranty_months")}
            />
            <Select label="Status" value={form.status} onChange={set("status")}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4">
            <TextArea
              label="Short Description"
              value={form.short_description}
              onChange={set("short_description")}
            />
            <TextArea
              label="Full Description"
              rows={6}
              value={form.description}
              onChange={set("description")}
            />
          </div>
          <div className="mt-4 flex gap-6">
            <Checkbox
              label="Featured"
              checked={form.is_featured}
              onChange={set("is_featured")}
            />
            <Checkbox
              label="Active"
              checked={form.is_active}
              onChange={set("is_active")}
            />
          </div>
        </div>
      )}

      {/* Variants */}
      {tab === "variants" && (
        <div>
          <div className="flex justify-end mb-3">
            <Button
              onClick={() => openVariant(null)}
              disabled={!isEdit && !product}
            >
              <i className="bi bi-plus-lg" /> Add Variant
            </Button>
          </div>
          <TableWrap>
            <table className="w-full min-w-[750px] text-left text-sm">
              <TableHead
                cols={[
                  "SKU",
                  "Name",
                  "Barcode",
                  "Price",
                  "Cost",
                  "Status",
                  "Actions",
                ]}
              />
              <tbody>
                {variants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center">
                      <EmptyState
                        icon="bi-box"
                        title="No variants"
                        subtitle="Variants let customers pick sizes, colors, etc."
                      />
                    </td>
                  </tr>
                )}
                {variants.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                      {v.sku}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {v.name || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {v.barcode ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100/90 text-gray-700 font-mono text-xs border border-gray-200"
                          title="Barcode"
                        >
                          <i className="bi bi-upc-scan text-gray-400 text-[11px]" />
                          {v.barcode}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      {formatMoney(v.price, form.currency || product?.currency || "USD")}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatMoney(v.cost_price, form.currency || product?.currency || "USD")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge value={v.status} label={titleCase(v.status)} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openVariant(v)}
                          className="p-2 rounded-lg text-sky-600 hover:bg-sky-50"
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          onClick={() => deleteVariant(v)}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}

      {/* Images */}
      {tab === "images" && (
        <div>
          <div className="flex justify-end mb-3">
            <Button
              onClick={() => openImage(null)}
              disabled={!isEdit && !product}
            >
              <i className="bi bi-plus-lg" /> Add Image
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  icon="bi-images"
                  title="No images"
                  subtitle="Add product photos to display on the storefront."
                />
              </div>
            )}
            {images.map((img) => (
              <div
                key={img.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <img
                  src={img.image_url}
                  alt={img.alt_text || "product"}
                  className="w-full h-36 object-cover"
                />
                <div className="p-3 flex items-center justify-between">
                  <div>
                    {img.is_primary && (
                      <Badge
                        value="primary"
                        map={{
                          primary: "bg-sky-50 text-sky-700 border-sky-200",
                        }}
                      />
                    )}
                    <p className="text-xs text-gray-400 truncate mt-1">
                      {img.alt_text || "No alt text"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openImage(img)}
                      className="p-2 rounded-lg text-sky-600 hover:bg-sky-50"
                    >
                      <i className="bi bi-pencil-square" />
                    </button>
                    <button
                      onClick={() => deleteImage(img)}
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specifications — managed per variant */}
      {tab === "specs" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-800">
                Hardware Specifications
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Hardware specifications are attached to individual product
                variants. Select a variant below to configure its
                specifications.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => navigate("/admin/specifications")}
            >
              <i className="bi bi-sliders" /> Manage Presets
            </Button>
          </div>

          {variants.length === 0 ? (
            <EmptyState
              icon="bi-box"
              title="No variants found"
              subtitle="Add at least one product variant in the Variants tab before configuring hardware specifications."
            />
          ) : (
            <div>
              {/* Variant Selector */}
              <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-gray-200/80">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Select Variant to Configure Hardware Specs
                </label>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const isSelected = selectedVariantIdForSpecs === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectSpecVariant(v.id)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? "bg-button text-white shadow-md ring-2 ring-button/20"
                            : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300 shadow-2xs"
                        }`}
                      >
                        <span>{v.name || v.sku}</span>
                        <span
                          className={`text-[10px] font-mono ${
                            isSelected ? "text-white/80" : "text-gray-400"
                          }`}
                        >
                          ({v.sku})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hardware Spec Fields for Selected Variant */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HW_SPEC_KEYS.map((key) => {
                  const opts = optionsForSpecKey(key);
                  const current = variantSpecsForm[key] || "";
                  const hasLegacyValue =
                    current && !opts.some((o) => o.label === current);
                  return (
                    <div key={key} className="space-y-1">
                      <Select
                        label={key}
                        value={current}
                        onChange={(e) =>
                          setVariantSpecsForm((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      >
                        <option value="">
                          — Preset: Not specified / Custom —
                        </option>
                        {hasLegacyValue && (
                          <option value={current}>{current} (saved)</option>
                        )}
                        {opts.map((o) => (
                          <option key={o.id} value={o.label}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <input
                        type="text"
                        placeholder={`Custom ${key} text...`}
                        value={current}
                        onChange={(e) =>
                          setVariantSpecsForm((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-button/20 focus:border-button focus:outline-hidden"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Save Variant Specifications Bar */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  {variantSpecsSuccess ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
                      <i className="bi bi-check-circle-fill text-emerald-500 text-sm" />{" "}
                      Specifications updated successfully!
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      Saving writes directly to the selected variant.
                    </span>
                  )}
                </div>
                <Button
                  onClick={saveVariantSpecsForSelectedVariant}
                  disabled={savingVariantSpecs || !selectedVariantIdForSpecs}
                >
                  <i className="bi bi-check-lg" />
                  {savingVariantSpecs
                    ? "Saving Specs..."
                    : "Save Variant Specifications"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Variant Modal */}
      <Modal
        open={!!variantModal}
        onClose={() => setVariantModal(null)}
        title={variantModal?.id ? "Edit Variant" : "Add Variant"}
      >
        {variantModal && (
          <div className="space-y-4">
            <Input
              label="SKU *"
              value={variantModal.sku}
              onChange={(e) =>
                setVariantModal({ ...variantModal, sku: e.target.value })
              }
            />
            <Input
              label="Name"
              value={variantModal.name}
              onChange={(e) =>
                setVariantModal({ ...variantModal, name: e.target.value })
              }
            />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <i className="bi bi-upc-scan text-sky-600" />
                  <span>Barcode (EAN-13 / Code-128)</span>
                </label>
                <div className="flex items-center gap-2">
                  {variantModal.barcode && (
                    <button
                      type="button"
                      onClick={() =>
                        setVariantModal((prev) => ({ ...prev, barcode: "" }))
                      }
                      className="text-[11px] font-semibold text-gray-400 hover:text-rose-500 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    disabled={generatingBarcode}
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <i
                      className={`bi ${generatingBarcode ? "bi-arrow-clockwise animate-spin" : "bi-magic"}`}
                    />
                    {generatingBarcode ? "Generating..." : "Generate Barcode"}
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={variantModal.barcode || ""}
                onChange={(e) =>
                  setVariantModal({
                    ...variantModal,
                    barcode: e.target.value,
                  })
                }
                placeholder="Auto-generated on save if empty (e.g. 200...)"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
              />
              <p className="text-[11px] text-gray-400">
                Standard 13-digit EAN-13 code. Automatically generated on save if left empty.
              </p>

              {variantModal.barcode && (
                <div className="mt-2.5 p-3 rounded-2xl bg-gray-50/80 border border-gray-200/80 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">
                    Live Barcode Preview
                  </span>
                  <BarcodeSvg
                    value={variantModal.barcode}
                    height={50}
                    showCopy={true}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={`Price (${form.currency || product?.currency || "USD"}) *`}
                type="number"
                step={form.currency === "KHR" ? "100" : "0.01"}
                value={variantModal.price}
                onChange={(e) =>
                  setVariantModal({ ...variantModal, price: e.target.value })
                }
              />
              <Input
                label={`Cost Price (${form.currency || product?.currency || "USD"})`}
                type="number"
                step={form.currency === "KHR" ? "100" : "0.01"}
                value={variantModal.cost_price}
                onChange={(e) =>
                  setVariantModal({
                    ...variantModal,
                    cost_price: e.target.value,
                  })
                }
              />
              <Input
                label={`Compare-at (${form.currency || product?.currency || "USD"})`}
                type="number"
                step={form.currency === "KHR" ? "100" : "0.01"}
                value={variantModal.compare_at_price}
                onChange={(e) =>
                  setVariantModal({
                    ...variantModal,
                    compare_at_price: e.target.value,
                  })
                }
              />
              <Input
                label="Weight"
                type="number"
                step="0.001"
                value={variantModal.weight}
                onChange={(e) =>
                  setVariantModal({ ...variantModal, weight: e.target.value })
                }
              />
            </div>
            <Select
              label="Status"
              value={variantModal.status}
              onChange={(e) =>
                setVariantModal({ ...variantModal, status: e.target.value })
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </Select>

            {/* Hardware Specifications in Variant Modal */}
            <div className="pt-3 border-t border-gray-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                <i className="bi bi-cpu text-sky-600" />
                <span>Hardware Specifications</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {HW_SPEC_KEYS.map((key) => {
                  const opts = optionsForSpecKey(key);
                  const currentVal = variantModal.specifications?.[key] || "";
                  const hasLegacy =
                    currentVal && !opts.some((o) => o.label === currentVal);
                  return (
                    <div key={key} className="space-y-1">
                      <Select
                        label={key}
                        value={currentVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariantModal((prev) => ({
                            ...prev,
                            specifications: {
                              ...prev.specifications,
                              [key]: val,
                            },
                          }));
                        }}
                      >
                        <option value="">— Preset: None / Custom —</option>
                        {hasLegacy && (
                          <option value={currentVal}>
                            {currentVal} (saved)
                          </option>
                        )}
                        {opts.map((o) => (
                          <option key={o.id} value={o.label}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <input
                        type="text"
                        placeholder={`Custom ${key}...`}
                        value={currentVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariantModal((prev) => ({
                            ...prev,
                            specifications: {
                              ...prev.specifications,
                              [key]: val,
                            },
                          }));
                        }}
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setVariantModal(null)}>
                Cancel
              </Button>
              <Button onClick={saveVariant} disabled={savingVariant}>
                {savingVariant ? "Saving..." : "Save Variant"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Image Modal */}
      <Modal
        open={!!imageModal}
        onClose={() => setImageModal(null)}
        title={imageModal?.id ? "Edit Image" : "Add Image"}
      >
        {imageModal && (
          <div className="space-y-4">
            <Input
              label="Image URL *"
              value={imageModal.image_url}
              onChange={(e) =>
                setImageModal({ ...imageModal, image_url: e.target.value })
              }
            />
            <Input
              label="Alt Text"
              value={imageModal.alt_text}
              onChange={(e) =>
                setImageModal({ ...imageModal, alt_text: e.target.value })
              }
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Sort Order"
                type="number"
                value={imageModal.sort_order}
                onChange={(e) =>
                  setImageModal({
                    ...imageModal,
                    sort_order: Number(e.target.value),
                  })
                }
              />
              <Select
                label="Variant (optional)"
                value={imageModal.variant}
                onChange={(e) =>
                  setImageModal({ ...imageModal, variant: e.target.value })
                }
              >
                <option value="">— Product level —</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name || v.sku}
                  </option>
                ))}
              </Select>
            </div>
            <Checkbox
              label="Set as primary image"
              checked={imageModal.is_primary}
              onChange={(e) =>
                setImageModal({ ...imageModal, is_primary: e.target.checked })
              }
            />
            {imageModal.image_url && (
              <img
                src={imageModal.image_url}
                alt="preview"
                className="w-40 h-32 object-cover rounded-xl border border-gray-200"
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setImageModal(null)}>
                Cancel
              </Button>
              <Button onClick={saveImage} disabled={savingImage}>
                {savingImage ? "Saving..." : "Save Image"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Spec Modal removed — replaced by fixed hardware specs form in the Specifications tab */}
    </div>
  );
};

export default ProductFormPage;
