import React from "react";

export const Spinner = ({ label = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="w-10 h-10 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin" />
    <p className="text-gray-500 text-sm animate-pulse">{label}</p>
  </div>
);

export const EmptyState = ({ icon = "bi-inbox", title = "Nothing here yet", subtitle = "" }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center">
    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
      <i className={`bi ${icon} text-2xl`} />
    </div>
    <p className="text-gray-600 font-semibold">{title}</p>
    {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
  </div>
);

const defaultBadgeMap = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  archived: "bg-rose-50 text-rose-700 border-rose-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  refunded: "bg-rose-50 text-rose-700 border-rose-200",
  partially_refunded: "bg-orange-50 text-orange-700 border-orange-200",
  unfulfilled: "bg-gray-100 text-gray-600 border-gray-200",
  partially_fulfilled: "bg-indigo-50 text-indigo-700 border-indigo-200",
  fulfilled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  returned: "bg-rose-50 text-rose-700 border-rose-200",
  requested: "bg-amber-50 text-amber-700 border-amber-200",
  shipped: "bg-sky-50 text-sky-700 border-sky-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  true: "bg-emerald-50 text-emerald-700 border-emerald-200",
  false: "bg-gray-100 text-gray-600 border-gray-200",
};

export const Badge = ({ value, map, label }) => {
  const key = value === true ? "true" : value === false ? "false" : String(value || "").toLowerCase();
  const color = (map || defaultBadgeMap)[key] || "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${color}`}
    >
      {label ?? String(value ?? "—")}
    </span>
  );
};

export const Modal = ({ open, onClose, title, children, wide = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={`relative bg-white rounded-3xl shadow-2xl border border-gray-100 my-8 w-full ${
          wide ? "max-w-4xl" : "max-w-lg"
        } animate-in fade-in zoom-in-95 duration-150`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <i className="bi bi-x-lg text-sm" />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
    <div>
      <h1 className="text-2xl font-black text-gray-900">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export const Input = ({ label, error, hint, className = "", ...props }) => (
  <label className={`block ${className}`}>
    {label && <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</span>}
    <input
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-shadow ${
        error ? "border-red-300" : "border-gray-200"
      }`}
      {...props}
    />
    {error && <span className="block text-xs text-red-500 mt-1">{error}</span>}
    {hint && !error && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
  </label>
);

export const Select = ({ label, error, className = "", children, ...props }) => (
  <label className={`block ${className}`}>
    {label && <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</span>}
    <select
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-shadow ${
        error ? "border-red-300" : "border-gray-200"
      }`}
      {...props}
    >
      {children}
    </select>
    {error && <span className="block text-xs text-red-500 mt-1">{error}</span>}
  </label>
);

export const TextArea = ({ label, error, className = "", ...props }) => (
  <label className={`block ${className}`}>
    {label && <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</span>}
    <textarea
      rows={3}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-shadow resize-y ${
        error ? "border-red-300" : "border-gray-200"
      }`}
      {...props}
    />
    {error && <span className="block text-xs text-red-500 mt-1">{error}</span>}
  </label>
);

export const Checkbox = ({ label, className = "", ...props }) => (
  <label className={`flex items-center gap-2.5 cursor-pointer ${className}`}>
    <input
      type="checkbox"
      className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500/30 accent-sky-600"
      {...props}
    />
    <span className="text-sm text-gray-700">{label}</span>
  </label>
);

export const Button = ({ variant = "primary", className = "", children, ...props }) => {
  const styles = {
    primary:
      "text-white bg-button hover:bg-button-hover shadow-md hover:shadow-lg",
    secondary:
      "text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-xs",
    danger: "text-white bg-button hover:bg-button-hover shadow-md",
    ghost: "text-white bg-button hover:bg-button-hover",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const TableWrap = ({ children }) => (
  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="overflow-x-auto">
      {children}
    </div>
  </div>
);

export const TableHead = ({ cols }) => (
  <thead>
    <tr className="bg-gray-50 border-b border-gray-100">
      {cols.map((c, i) => (
        <th
          key={i}
          className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap"
        >
          {c}
        </th>
      ))}
    </tr>
  </thead>
);