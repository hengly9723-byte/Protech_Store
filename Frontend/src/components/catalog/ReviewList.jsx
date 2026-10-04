import React from "react";
import StarRating from "./StarRating";

const ReviewList = ({ reviews = [], averageRating = 0, totalReviews = 0 }) => {
  if (reviews.length === 0) {
    return (
      <div className="bg-slate-50/60 rounded-3xl p-8 text-center border border-gray-100">
        <i className="bi bi-chat-square-quote text-3xl text-gray-300 mb-2 block" />
        <h4 className="text-sm font-bold text-gray-800">No Reviews Yet</h4>
        <p className="text-xs text-gray-500 mt-1">Be the first verified customer to review this product.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((rev) => (
        <div
          key={rev.id}
          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StarRating rating={rev.rating} size="text-xs" />
              {rev.title && (
                <span className="text-sm font-bold text-gray-900">{rev.title}</span>
              )}
            </div>
            <span className="text-[11px] text-gray-400">
              {new Date(rev.created_at).toLocaleDateString()}
            </span>
          </div>

          {rev.content && (
            <p className="text-xs text-gray-600 leading-relaxed">{rev.content}</p>
          )}

          <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-500">
            <span className="font-semibold text-gray-800">{rev.user_name}</span>
            {rev.is_verified_purchase && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                <i className="bi bi-patch-check-fill" />
                Verified Purchase
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReviewList;
