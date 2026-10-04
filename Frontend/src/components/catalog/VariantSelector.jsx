import React from "react";

const VariantSelector = ({
  variants = [],
  selectedVariant,
  onSelectVariant,
  stockInfo = null,
}) => {
  if (!variants || variants.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
          Select Option / Variant
        </label>
        {selectedVariant && (
          <span className="text-xs font-medium text-gray-500">
            SKU: <span className="font-mono text-gray-800">{selectedVariant.sku}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {variants.map((v) => {
          const isSelected = selectedVariant?.id === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelectVariant(v)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 relative ${
                isSelected
                  ? "border-button bg-button ring-2 ring-button/20 shadow-xs"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-gray-900"}`}>
                  {v.name || v.sku}
                </span>
                {isSelected && (
                  <i className="bi bi-check-circle-fill text-white text-xs" />
                )}
              </div>

              <div className={`text-xs font-black ${isSelected ? "text-white" : "text-gray-900"}`}>
                ${Number(v.price).toFixed(2)}
              </div>

              {v.weight && (
                <span className="text-[10px] text-gray-400">
                  {Number(v.weight).toFixed(2)} kg
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stock Availability Indicator */}
      {stockInfo && (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium">
          {stockInfo.quantity_available > 10 ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
              <i className="bi bi-check-circle-fill" />
              <span>In Stock ({stockInfo.quantity_available} units available)</span>
            </span>
          ) : stockInfo.quantity_available > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
              <i className="bi bi-exclamation-triangle-fill" />
              <span>Only {stockInfo.quantity_available} left in stock - order soon</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200/60">
              <i className="bi bi-x-circle-fill" />
              <span>Out of Stock</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default VariantSelector;
