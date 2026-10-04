import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getAdminOrdersApi,
  getLowStockApi,
  getAdminReviewsApi,
} from "../../services/api";
import { formatMoney, formatDateTime, titleCase } from "../../utils/format";
import { PageHeader, Badge, TableWrap, TableHead, Spinner, EmptyState } from "../../components/admin/ui";

const StatCard = ({ icon, label, value, to, tone = "sky" }) => {
  const tones = {
    sky: "bg-black",
  };
  return (
    <Link
      to={to}
      className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${tones[tone]} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
          <i className={`bi ${icon} text-xl`} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</p>
          <p className="text-2xl font-black text-gray-900">{value}</p>
        </div>
      </div>
    </Link>
  );
};

const DashboardPage = () => {
  const [orders, setOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, lowRes, reviewRes] = await Promise.all([
        getAdminOrdersApi(),
        getLowStockApi(),
        getAdminReviewsApi({ status: "pending" }),
      ]);
      const ordersData = Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data?.results || [];
      setOrders(ordersData);
      const lowData = Array.isArray(lowRes.data) ? lowRes.data : lowRes.data?.results || [];
      setLowStock(lowData);
      const revData = Array.isArray(reviewRes.data) ? reviewRes.data : reviewRes.data?.results || [];
      setPendingReviews(revData);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Loading dashboard..." />;

  const paidRevenue = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const recentOrders = orders.slice(0, 6);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Store overview and health at a glance" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard to="/admin/orders" icon="bi-cart-check" label="Total Orders" value={orders.length} tone="sky" />
        <StatCard to="/admin/orders" icon="bi-currency-dollar" label="Paid Revenue" value={formatMoney(paidRevenue)} tone="sky" />
        <StatCard to="/admin/stock" icon="bi-exclamation-triangle" label="Low Stock Alerts" value={lowStock.length} tone="sky" />
        <StatCard to="/admin/reviews" icon="bi-star-half" label="Pending Reviews" value={pendingReviews.length} tone="sky" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock alerts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-gray-500">Low Stock Alerts</h2>
            <Link to="/admin/stock" className="text-xs font-semibold text-sky-600 hover:underline">
              Manage Stock
            </Link>
          </div>
          <TableWrap>
            <table className="w-full min-w-[550px] text-left text-sm">
              <TableHead cols={["Product", "SKU", "Available", "Reorder Level"]} />
              <tbody>
                {lowStock.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center">
                      <EmptyState icon="bi-check-circle" title="All stocked up" subtitle="No variants below their reorder level." />
                    </td>
                  </tr>
                )}
                {lowStock.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{s.product_name || s.variant_name}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.variant_sku}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge value={s.quantity_available <= 0 ? "out" : s.quantity_available} map={{ out: "bg-rose-50 text-rose-700 border-rose-200" }} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.reorder_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>

        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-gray-500">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-sky-600 hover:underline">
              View All
            </Link>
          </div>
          <TableWrap>
            <table className="w-full min-w-[650px] text-left text-sm">
              <TableHead cols={["Order", "Customer", "Total", "Payment", "Created"]} />
              <tbody>
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center">
                      <EmptyState icon="bi-cart3" title="No orders yet" subtitle="Orders placed on the storefront will appear here." />
                    </td>
                  </tr>
                )}
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-bold text-sky-600 whitespace-nowrap">
                      <Link to={`/admin/orders`} className="hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{o.customer_email}</td>
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{formatMoney(o.total, o.currency)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge value={o.payment_status} label={titleCase(o.payment_status)} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;