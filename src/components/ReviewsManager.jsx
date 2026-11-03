import React, { useEffect, useState } from "react";
import { Check, Star, Trash2, X } from "lucide-react";
import { deleteReview, listReviews, setReviewStatus } from "../services/api.js";

// Customer reviews from the storefront. They stay hidden until approved here;
// approving also uploads the customer's wall photo and updates the poster's rating.
const TABS = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" }
];

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export default function ReviewsManager({ onOpenProduct }) {
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setReviews(await listReviews());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (review, action) => {
    if (action === "delete" && !window.confirm(`Delete ${review.name}'s review for good?`)) return;
    setBusyId(review.id);
    setError("");
    try {
      if (action === "delete") {
        await deleteReview(review.id);
        setReviews((current) => current.filter((item) => item.id !== review.id));
      } else {
        const updated = await setReviewStatus(review.id, action);
        setReviews((current) => current.map((item) => (item.id === review.id ? updated : item)));
      }
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  };

  const visible = reviews.filter((review) => review.status === tab);

  return (
    <section className="panel wide-panel reviews-admin">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Reviews</p>
          <h3>Customer Reviews</h3>
        </div>
      </div>

      <div className="order-tabs">
        {TABS.map((item) => (
          <button type="button" key={item.value} className={tab === item.value ? "active" : ""} onClick={() => setTab(item.value)}>
            {item.label} <span>{reviews.filter((review) => review.status === item.value).length}</span>
          </button>
        ))}
      </div>

      {error && <div className="message error">{error}</div>}
      {loading && <p className="empty">Loading reviews…</p>}
      {!loading && !visible.length && (
        <p className="empty">{tab === "pending" ? "No reviews waiting for approval." : "None here yet."}</p>
      )}

      <div className="review-admin-list">
        {visible.map((review) => {
          const photo = review.photoUrl || review.photoDataUrl;
          return (
            <article key={review.id} className="review-admin-card">
              {photo && (
                <a href={photo} target="_blank" rel="noreferrer" className="review-admin-photo">
                  <img src={photo} alt={`${review.name}'s photo`} />
                </a>
              )}
              <div className="review-admin-body">
                <div className="review-admin-top">
                  <strong>{review.name}</strong>
                  <span className="review-admin-stars" aria-label={`${review.rating} stars`}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star key={value} size={14} className={value <= review.rating ? "filled" : ""} />
                    ))}
                  </span>
                </div>
                <button type="button" className="link-button" onClick={() => onOpenProduct(review.productId)}>
                  {review.productName || review.productId}
                </button>
                <p>{review.comment}</p>
                <small>
                  {formatDate(review.createdAt)}
                  {review.orderId ? ` · Order ${review.orderId}` : ""}
                  {review.email ? ` · ${review.email}` : ""}
                </small>
                {review.hiddenReason === "order_returned" && (
                  <small className="review-admin-note">Hidden automatically: the order was returned or cancelled.</small>
                )}
                <div className="review-admin-actions">
                  {review.status !== "approved" && (
                    <button type="button" className="primary" disabled={busyId === review.id} onClick={() => act(review, "approved")}>
                      <Check size={15} /> Approve
                    </button>
                  )}
                  {review.status !== "rejected" && (
                    <button type="button" disabled={busyId === review.id} onClick={() => act(review, "rejected")}>
                      <X size={15} /> {review.status === "approved" ? "Hide" : "Reject"}
                    </button>
                  )}
                  <button type="button" className="danger" disabled={busyId === review.id} onClick={() => act(review, "delete")}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
