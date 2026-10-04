import React from "react";
import ProductCard from "./ProductCard";

const ProductGrid = ({
  products = [],
  isLoading = false,
  activePromotion = null,
  promotions = [],
  page = 1,
  totalPages = 1,
  totalCount = 0,
  onPageChange = null,
}) => {
  if (isLoading) {
    return (
      <div className="w-full grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-3xl p-4 border border-gray-100 shadow-xs animate-pulse flex flex-col gap-4"
          >
            <div className="aspect-square w-full bg-gray-100 rounded-2xl" />
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-1/3" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-5 bg-gray-100 rounded w-1/4 pt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="w-full bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-xs">
        <div className="w-16 h-16 bg-orange-50 text-primary rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
          <i className="bi bi-inbox" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">No Products Found</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          We couldn't find any products matching your selected filters. Try broadening your criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            activePromotion={activePromotion}
            promotions={promotions}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200/60 pt-6">
          <p className="text-xs text-gray-500">
            Showing Page <span className="font-bold text-gray-900">{page}</span> of{" "}
            <span className="font-bold text-gray-900">{totalPages}</span> ({totalCount} total items)
          </p>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
            >
              <i className="bi bi-chevron-left" />
              <span>Previous</span>
            </button>

            <div className="hidden sm:flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Show first, last, and current neighbors
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= page - 1 && pageNum <= page + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        page === pageNum
                          ? "bg-button text-white shadow-sm hover:bg-button-hover"
                          : "bg-white border border-gray-200 text-gray-700 hover:bg-button-hover hover:text-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (pageNum === page - 2 || pageNum === page + 2) {
                  return (
                    <span key={pageNum} className="px-1 text-gray-400 text-xs">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductGrid;
