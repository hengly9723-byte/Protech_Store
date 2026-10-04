import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { getCatalogVariantsApi, getActivePromotionsApi } from "../../services/api";
import FilterSidebar from "../../components/catalog/FilterSidebar";
import ProductGrid from "../../components/catalog/ProductGrid";
import PromotionHero from "../../components/catalog/PromotionHero";

const formatCategoryDisplay = (val) => {
  if (!val) return "";
  return String(val)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const ProductCatalogPage = () => {
  const { categorySlug, brandSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [activePromotions, setActivePromotions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    category: categorySlug || searchParams.get("category") || undefined,
    brand: brandSlug || searchParams.get("brand") || undefined,
    type: searchParams.get("type") || undefined,
    search: searchParams.get("search") || "",
    min_price: searchParams.get("min_price") || undefined,
    max_price: searchParams.get("max_price") || undefined,
    is_featured: searchParams.get("is_featured") || undefined,
    ordering: searchParams.get("ordering") || "-created_at",
    page: parseInt(searchParams.get("page") || "1", 10),
  });

  const [searchInput, setSearchInput] = useState(filters.search || "");

  // Sync state if URL route params or query params change
  useEffect(() => {
    const currentSearch = searchParams.get("search") || "";
    setFilters({
      category: categorySlug || searchParams.get("category") || undefined,
      brand: brandSlug || searchParams.get("brand") || undefined,
      type: searchParams.get("type") || undefined,
      search: currentSearch,
      min_price: searchParams.get("min_price") || undefined,
      max_price: searchParams.get("max_price") || undefined,
      is_featured: searchParams.get("is_featured") || undefined,
      ordering: searchParams.get("ordering") || "-created_at",
      page: parseInt(searchParams.get("page") || "1", 10),
    });
    setSearchInput(currentSearch);
  }, [categorySlug, brandSlug, searchParams]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        ...filters,
        page_size: 12,
      };
      // Clean undefined/empty keys
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      const res = await getCatalogVariantsApi(params);
      const data = res.data;
      const fetchedProducts = data.results || (Array.isArray(data) ? data : []);
      setProducts(fetchedProducts);
      setTotalCount(typeof data.count === "number" ? data.count : fetchedProducts.length);
      setTotalPages(Math.ceil((data.count || fetchedProducts.length || 1) / 12));
    } catch (err) {
      console.error("Failed to load catalog variants:", err);
      setProducts([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    let isMounted = true;
    getActivePromotionsApi()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setActivePromotions(list);
      })
      .catch((err) => {
        console.warn("Could not load active promotions for catalog:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFilterChange = (newFilters) => {
    const updated = { ...newFilters, page: 1 };
    setFilters(updated);

    if (categorySlug && updated.category !== categorySlug) {
      if (updated.category) {
        navigate(`/categories/${updated.category}`);
      } else {
        navigate("/products");
      }
      return;
    }

    if (brandSlug && updated.brand !== brandSlug) {
      if (updated.brand) {
        navigate(`/brands/${updated.brand}`);
      } else {
        navigate("/products");
      }
      return;
    }

    const nextParams = new URLSearchParams();
    if (updated.category && !categorySlug) nextParams.set("category", updated.category);
    if (updated.brand && !brandSlug) nextParams.set("brand", updated.brand);
    if (updated.type) nextParams.set("type", updated.type);
    if (updated.search) nextParams.set("search", updated.search);
    if (updated.min_price) nextParams.set("min_price", updated.min_price);
    if (updated.max_price) nextParams.set("max_price", updated.max_price);
    if (updated.is_featured) nextParams.set("is_featured", updated.is_featured);
    if (updated.ordering && updated.ordering !== "-created_at") nextParams.set("ordering", updated.ordering);
    if (updated.page && updated.page > 1) nextParams.set("page", String(updated.page));
    setSearchParams(nextParams, { replace: true });
  };

  const handleResetFilters = () => {
    setFilters({
      category: undefined,
      brand: undefined,
      type: undefined,
      search: "",
      min_price: undefined,
      max_price: undefined,
      is_featured: undefined,
      ordering: "-created_at",
      page: 1,
    });
    setSearchInput("");
    if (categorySlug || brandSlug) {
      navigate("/products");
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    handleFilterChange({ ...filters, search: searchInput });
  };

  return (
    <div className="w-full">
      {/* Dynamic Storefront Promotion Hero Banner */}
      <div className="pt-6">
        <PromotionHero
          promotions={activePromotions}
          promotion={activePromotions[0] || null}
        />
      </div>

      <div id="catalog-products" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Banner / Breadcrumb Header */}
        <div className="mb-8 w-full">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {filters.category
                ? `Category: ${formatCategoryDisplay(filters.category)}`
                : filters.brand
                ? `Brand: ${formatCategoryDisplay(filters.brand)}`
                : "Explore Products"}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Showing {products.length} {products.length === 1 ? "item" : "items"} matching your selection
            </p>
          </div>

          {/* Search Bar and Mobile Filter Toggle */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-72">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                <i className="bi bi-search text-xs" />
              </span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products, sku..."
                className="w-full pl-8 pr-4 py-2 bg-white rounded-xl border border-gray-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-zinc-800/20 focus:border-zinc-800 shadow-2xs"
              />
            </form>

            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <i className="bi bi-sliders" />
              <span>Filters</span>
            </button>

            {/* Ordering selector */}
            <select
              value={filters.ordering}
              onChange={(e) => setFilters({ ...filters, ordering: e.target.value, page: 1 })}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-zinc-800/20 focus:border-zinc-800 shadow-2xs cursor-pointer"
            >
              <option value="-created_at">Newest First</option>
              <option value="created_at">Oldest First</option>
              <option value="base_price">Price: Low to High</option>
              <option value="-base_price">Price: High to Low</option>
              <option value="name">Name: A to Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout: Sidebar + Grid */}
      <div className="flex items-start gap-8 w-full">
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          isOpen={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
        />

        <div className="flex-1 min-w-0 w-full">
          <ProductGrid
            products={products}
            isLoading={isLoading}
            activePromotion={activePromotions[0] || null}
            promotions={activePromotions}
            page={filters.page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
          />
        </div>
      </div>
    </div>
  </div>
  );
};

export default ProductCatalogPage;
