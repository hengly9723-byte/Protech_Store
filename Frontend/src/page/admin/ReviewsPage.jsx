import React, { useEffect, useState, useCallback } from "react";
import { getAdminReviewsApi, updateReviewStatusApi } from "../../services/api";
import { formatDateTime, titleCase } from "../../utils/format";
import { PageHeader, Badge, TableWrap, TableHead, Spinner, EmptyState, Button, Select } from "../../components/admin/ui";

const ReviewsPage = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      const res = await getAdminReviewsApi(params);
      setReviews(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (review, newStatus) => {
    setBusy(review.id);
    try {
      await updateReviewStatusApi(review.id, newStatus);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update review.");
    } finally {
      setBusy(null);
    }
  };

  const counts = { pending: 0, approved: 0, rejected: 0 };
  reviews.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status] += 1; });

  return (
    <div>
      <PageHeader title="Review Moderation" subtitle="Approve or reject customer reviews" />

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-52">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <p className="text-sm text-gray-500">
          Showing <span className="font-bold text-gray-800">{reviews.length}</span> review(s)
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading reviews..." />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[900px] text-left text-sm">
            <TableHead cols={["Product", "Customer", "Rating", "Title", "Status", "Verified", "Created", "Actions"]} />
            <tbody>
              {reviews.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center">
                    <EmptyState icon="bi-star" title="No reviews found" subtitle="No reviews match the current filter." />
                  </td>
                </tr>
              )}
              {reviews.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 align-top">
                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{r.product_name}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.user_name}</td>
                  <td className="px-4 py-3 text-amber-500 font-bold whitespace-nowrap">
                    <span className="text-gray-400 text-xs">{"★".repeat(r.rating)}<span className="text-gray-200">{"★".repeat(5 - r.rating)}</span></span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[240px] whitespace-nowrap">
                    <p className="font-bold text-gray-800">{r.title || "—"}</p>
                    <p className="text-xs text-gray-500 truncate">{r.content}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge value={r.status} label={titleCase(r.status)} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.is_verified_purchase ? <Badge value="Yes" map={{ Yes: "bg-emerald-50 text-emerald-700 border-emerald-200" }} /> : "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.status === "pending" && (
                      <div className="flex gap-1.5">
                        <Button variant="ghost" onClick={() => moderate(r, "approved")} disabled={busy === r.id} className="!bg-button !text-white hover:!bg-button-hover">
                          <i className="bi bi-check-lg" /> Approve
                        </Button>
                        <Button variant="ghost" onClick={() => moderate(r, "rejected")} disabled={busy === r.id} className="!bg-button !text-white hover:!bg-button-hover">
                          <i className="bi bi-x-lg" /> Reject
                        </Button>
                      </div>
                    )}
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

export default ReviewsPage;