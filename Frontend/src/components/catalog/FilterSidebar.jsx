import React, { useState, useEffect } from "react";
import { getCategoriesApi, getBrandsApi, getProductTypesApi } from "../../services/api";

const FilterSidebar = ({
  filters = {},
  onFilterChange,
  onResetFilters,
  isOpen = false,
  onClose = null,
}) => {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [priceRange, setPriceRange] = useState({
    min: filters.min_price || "",
    max: filters.max_price || "",
  });

  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [catsRes, brandsRes, typesRes] = await Promise.all([
          getCategoriesApi({ all_flat: "true" }).catch(() => ({ data: [] })),
          getBrandsApi().catch(() => ({ data: [] })),
          getProductTypesApi().catch(() => ({ data: [] })),
        ]);
        setCategories(catsRes.data?.results || catsRes.data || []);
        setBrands(brandsRes.data?.results || brandsRes.data || []);
        setProductTypes(typesRes.data?.results || typesRes.data || []);
      } catch (err) {
        console.error("Failed to load catalog filter data:", err);
      }
    };
    loadFilterData();
  }, []);

  const handlePriceApply = (e) => {
    e.preventDefault();
    onFilterChange({
      ...filters,
      min_price: priceRange.min || undefined,
      max_price: priceRange.max || undefined,
    });
  };

  const normalize = (val) =>
    String(val || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-");

  const isCategorySelected = (cat) => {
    if (!filters.category) return false;
    const filterNorm = normalize(filters.category);
    const filterRaw = String(filters.category).trim().toLowerCase();
    const catSlugNorm = normalize(cat.slug);
    const catNameNorm = normalize(cat.name);
    const catNameRaw = String(cat.name || "").trim().toLowerCase();
    const catId = String(cat.id || "").toLowerCase();

    return (
      filterRaw === catId ||
      filterRaw === catNameRaw ||
      filterNorm === catSlugNorm ||
      filterNorm === catNameNorm
    );
  };

  const isBrandSelected = (b) => {
    if (!filters.brand) return false;
    const filterNorm = normalize(filters.brand);
    const filterRaw = String(filters.brand).trim().toLowerCase();
    const bSlugNorm = normalize(b.slug);
    const bNameNorm = normalize(b.name);
    const bNameRaw = String(b.name || "").trim().toLowerCase();
    const bId = String(b.id || "").toLowerCase();

    return (
      filterRaw === bId ||
      filterRaw === bNameRaw ||
      filterNorm === bSlugNorm ||
      filterNorm === bNameNorm
    );
  };

  const isTypeSelected = (t) => {
    if (!filters.type) return false;
    const filterNorm = normalize(filters.type);
    const typeNorm = normalize(t.name);
    const typeId = String(t.id || "").toLowerCase();
    return (
      filterNorm === typeNorm ||
      String(filters.type).toLowerCase() === typeId
    );
  };


  const content = (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
          <i className="bi bi-sliders text-black" />
          <span>Filters</span>
        </h3>
        <button
          onClick={onResetFilters}
          className="text-xs font-semibold text-black hover:text-zinc-800 transition-colors cursor-pointer"
        >
          Reset All
        </button>
      </div>

      {/* Categories Filter */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
          Category
        </h4>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          <button
            onClick={() => onFilterChange({ ...filters, category: undefined })}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              !filters.category
                ? "bg-button text-white font-bold hover:bg-button-hover"
                : "bg-gray-50 text-gray-600 hover:bg-button-hover hover:text-white"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => {
            const isSelected = isCategorySelected(cat);
            return (
              <button
                key={cat.id}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    category: isSelected ? undefined : (cat.slug || cat.id),
                  })
                }
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? "bg-button text-white font-bold hover:bg-button-hover"
                    : "bg-gray-50 text-gray-600 hover:bg-button-hover hover:text-white"
                }`}
              >
                <span>{cat.name}</span>
                {cat.parent && <span className="text-[10px] text-gray-400">Sub</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brands Filter */}
      <div className="pt-4 border-t border-gray-100">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
          Brand
        </h4>
        <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
          <button
            onClick={() => onFilterChange({ ...filters, brand: undefined })}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              !filters.brand
                ? "bg-button text-white font-bold hover:bg-button-hover"
                : "bg-gray-50 text-gray-600 hover:bg-button-hover hover:text-white"
            }`}
          >
            All Brands
          </button>
          {brands.map((b) => {
            const isSelected = isBrandSelected(b);
            return (
              <button
                key={b.id}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    brand: isSelected ? undefined : (b.slug || b.id),
                  })
                }
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-button text-white font-bold hover:bg-button-hover"
                    : "bg-gray-50 text-gray-600 hover:bg-button-hover hover:text-white"
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Type Filter */}
      {productTypes.length > 0 && (
        <div className="pt-4 border-t border-gray-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Product Type
          </h4>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onFilterChange({ ...filters, type: undefined })}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                !filters.type
                  ? "bg-button text-white shadow-xs hover:bg-button-hover"
                  : "bg-gray-100 text-gray-600 hover:bg-button-hover hover:text-white"
              }`}
            >
              All
            </button>
            {productTypes.map((t) => {
              const isSelected = isTypeSelected(t);
              return (
                <button
                  key={t.id}
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      type: isSelected ? undefined : t.name,
                    })
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-button text-white shadow-xs hover:bg-button-hover"
                      : "bg-gray-100 text-gray-600 hover:bg-button-hover hover:text-white"
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Price Range Filter */}
      <div className="pt-4 border-t border-gray-100">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
          Price Range ($)
        </h4>
        <form onSubmit={handlePriceApply} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min"
              min="0"
              value={priceRange.min}
              onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-black focus:border-zinc-800 focus:outline-hidden"
            />
            <input
              type="number"
              placeholder="Max"
              min="0"
              value={priceRange.max}
              onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-black focus:border-zinc-800 focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-button hover:bg-button-hover text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer">
            Apply Price
          </button>
        </form>
      </div>

      {/* Featured Toggle */}
      <div className="pt-4 border-t border-gray-100">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.is_featured === "true" || filters.is_featured === true}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                is_featured: e.target.checked ? "true" : undefined,
              })
            }
            className="w-4 h-4 text-black rounded focus:ring-black"
          />
          <span className="text-xs font-semibold text-gray-700">
            Featured Items Only
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white rounded-3xl p-6 border border-gray-100 shadow-xs h-fit sticky top-24">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative ml-auto w-full max-w-xs bg-white h-full p-6 shadow-2xl overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-base">Filters</h3>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-900 cursor-pointer"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
              {content}
            </div>

            <button
              onClick={onClose}
              className="mt-6 w-full py-3 bg-button hover:bg-button-hover text-white font-bold text-sm rounded-lg shadow-md"
            >
              Show Results
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FilterSidebar;
