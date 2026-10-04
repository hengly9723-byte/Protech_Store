export const formatMoney = (value, currency = "USD") => {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
};

export const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const orderStatusStyle = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

export const paymentStatusStyle = {
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  refunded: "bg-rose-50 text-rose-700 border-rose-200",
  partially_refunded: "bg-orange-50 text-orange-700 border-orange-200",
};

export const fulfillmentStatusStyle = {
  unfulfilled: "bg-gray-100 text-gray-600 border-gray-200",
  partially_fulfilled: "bg-indigo-50 text-indigo-700 border-indigo-200",
  fulfilled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  returned: "bg-rose-50 text-rose-700 border-rose-200",
};

export const shipmentStatusStyle = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  shipped: "bg-sky-50 text-sky-700 border-sky-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  returned: "bg-rose-50 text-rose-700 border-rose-200",
};

export const returnStatusStyle = {
  requested: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-sky-50 text-sky-700 border-sky-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const titleCase = (str = "") =>
  str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const formatStatusBadge = (status, styleMap) => {
  const base =
    "px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border";
  const color = styleMap[status] || "bg-gray-100 text-gray-600 border-gray-200";
  return `${base} ${color}`;
};

export const fallbackImage =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80";
