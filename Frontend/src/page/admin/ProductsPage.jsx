import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getProductsApi,
  deleteProductApi,
  getAdminCategoriesApi,
} from "../../services/api";
import { formatMoney, titleCase } from "../../utils/format";
import { PageHeader, Badge, TableWrap, TableHead, Spinner, EmptyState, Button, Input, Select } from "../../components/admin/ui";

const ProductsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page_size: 100, search, status };
      if (category) params.category = category;
      const [prodRes, catRes] = await Promise.all([
        getProductsApi(params),
        getAdminCategoriesApi({ all_flat: true }),
      ]);
      setProducts(prodRes.data.results || prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setLoading(false);
    }
  }, [search, status, category]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await deleteProductApi(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete product.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your catalog, variants, images and specifications"
        actions={
          <Button onClick={() => navigate("/admin/products/new")}>
            <i className="bi bi-plus-lg" /> New Product
          </Button>
        }
      />

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search name / SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-52">
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner label="Loading products..." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[1000px] text-left text-sm">
            <TableHead cols={["Product", "SKU", "Price", "Brand", "Category", "Status", "Featured", "Variants", "Actions"]} />
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center">
                    <EmptyState icon="bi-box" title="No products found" subtitle="Try adjusting your filters or create a new product." />
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {p.primary_image?.image_url ? (
                        <img src={p.primary_image.image_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                          <i className="bi bi-image" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.sku || "—"}</td>
                  <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{formatMoney(p.base_price, p.currency)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.brand_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.category_name || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge value={p.status} label={titleCase(p.status)} />
                  </td>
                  <td className="px-4 py-3 text-center text-sky-600 whitespace-nowrap">
                    {p.is_featured ? <i className="bi bi-star-fill" /> : <i className="bi bi-star text-gray-300" />}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.variants_count}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/admin/products/${p.id}/edit`)}
                        className="p-2 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors"
                        title="Edit"
                      >
                        <i className="bi bi-pencil-square" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                        title="Delete"
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
      )}
    </div>
  );
};

export default ProductsPage;