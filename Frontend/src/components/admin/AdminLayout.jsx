import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import UserAvatar from "../UserAvatar";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: "bi-speedometer2", end: true },
  { to: "/admin/products", label: "Products", icon: "bi-box-seam" },
  { to: "/admin/categories", label: "Categories", icon: "bi-tags" },
  { to: "/admin/brands", label: "Brands", icon: "bi-bookmark-star" },
  { to: "/admin/specifications", label: "Specifications", icon: "bi-sliders" },
  { to: "/admin/orders", label: "Orders", icon: "bi-cart-check" },
  { to: "/admin/stock", label: "Stock", icon: "bi-boxes" },
  { to: "/admin/discount-codes", label: "Discount Codes", icon: "bi-percent" },
  { to: "/admin/promotions", label: "Promotions", icon: "bi-megaphone" },
  { to: "/admin/shipping", label: "Shipping", icon: "bi-truck" },
  { to: "/admin/reviews", label: "Reviews", icon: "bi-star" },
  { to: "/admin/users", label: "Users", icon: "bi-people" },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: "bi-journal-text" },
];

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
      isActive
        ? "bg-gray-100/80 text-black border border-l-2 border-l-black border-gray-200"
        : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 border border-transparent"
    }`;

  return (
    <div className="h-full flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white border-r border-gray-200 h-full">
        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar
              src={user?.avatar_url}
              name={user?.full_name}
              email={user?.email}
              size="w-8 h-8"
            />
            <div className="text-left leading-tight min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate max-w-[105px]">
                {user?.full_name || user?.email?.split("@")[0]}
              </p>
              <p className="text-[10px] text-gray-400 capitalize truncate">
                {user?.is_superuser ? "Super Admin" : (user?.role || "Administrator")}
              </p>
            </div>
          </div>
          <NavLink
            to="/"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
            title="Return to Storefront"
          >
            Storefront
          </NavLink>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkClass}
            >
              <i className={`bi ${item.icon} text-base text-gray-400`} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 space-y-1 shrink-0">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100/80 transition-colors"
          >
            <i className="bi bi-shop text-base text-gray-400" />
            View Store
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <i className="bi bi-box-arrow-right text-base text-red-400" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="shrink-0 bg-white/95 backdrop-blur-md border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 h-14">
            <div className="flex-1 flex gap-1 overflow-x-auto py-2 -mx-2 items-center">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      isActive ? "bg-sky-50 text-sky-700" : "text-gray-500 hover:text-gray-900"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <NavLink
              to="/"
              className="ml-2 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-600 hover:text-black shrink-0"
            >
              Store
            </NavLink>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
