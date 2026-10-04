import React, { useState } from "react";
import { Link } from "react-router-dom";
import { submitProductReviewApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import StarRating from "./StarRating";

const ReviewForm = ({ productId, onReviewSubmitted }) => {
  const { isAuthenticated } = useAuth();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="bg-sky-50/60 rounded-3xl p-6 border border-sky-100 text-center">
        <i className="bi bi-person-lock text-3xl text-sky-500 mb-2 block" />
        <h4 className="text-sm font-bold text-gray-900">Have You Purchased This Item?</h4>
        <p className="text-xs text-gray-600 mt-1 mb-4">
          Please sign in to submit a verified customer review.
        </p>
        <Link
          to="/login"
          className="inline-flex px-5 py-2 rounded-xl bg-button hover:bg-button-hover text-white font-bold text-xs shadow-xs transition-colors"
        >
          Sign In to Review
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await submitProductReviewApi(productId, { rating, title, content });
      setSuccess(true);
      setTitle("");
      setContent("");
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to submit review. Note: You can only review products you have purchased."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
      <h3 className="font-bold text-gray-900 text-base mb-4">Write a Verified Review</h3>

      {success && (
        <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <i className="bi bi-check-circle-fill text-base text-emerald-500 shrink-0" />
          <span>Thank you! Your review has been recorded.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <i className="bi bi-exclamation-triangle-fill text-base text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
            Your Overall Rating
          </label>
          <StarRating rating={rating} size="text-xl" onChange={setRating} />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
            Review Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Excellent battery life and sleek design"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
            Detailed Review
          </label>
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share what you liked, performance, build quality..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-xl bg-button hover:bg-button-hover text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </button>
      </form>
    </div>
  );
};

export default ReviewForm;
