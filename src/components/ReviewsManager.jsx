import React, { useEffect, useMemo, useState } from "react";
import { Check, Mail, Search, Star, Trash2, X } from "lucide-react";
import { deleteReview, getCustomer, listReviews, setReviewStatus } from "../services/api.js";
import EmailComposer from "./EmailComposer.jsx";

// Customer reviews from the storefront. They stay hidden until approved here;
// approving also uploads the customer's wall photo and updates the poster's rating.
const TABS = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" }
];

const SORTS = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  lowest: (a, b) => a.rating - b.rating,
  highest: (a, b) => b.rating - a.rating
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

function Stars({ rating, size = 14 }) {
  return (
    <span className="review-admin-stars" aria-label={`${rating} stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={size} className={value <= Math.round(rating) ? "filled" : ""} />
      ))}
    </span>
  );
}

export default function ReviewsManager({ onOpenProduct }) {
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState("pending");
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState("any");
  const [photosOnly, setPhotosOnly] = useState(false);
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composer, setComposer] = useState(null);

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

  const update = (review, action) =>
    action === "delete"
      ? deleteReview(review.id).then(() => setReviews((current) => current.filter((item) => item.id !== review.id)))
      : setReviewStatus(review.id, action).then((updated) =>
          setReviews((current) => current.map((item) => (item.id === review.id ? updated : item)))
        );

  const act = async (review, action) => {
    if (action === "delete" && !window.confirm(`Delete ${review.name}'s review for good?`)) return;
    setBusyId(review.id);
    setError("");
    try {
      await update(review, action);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  };

  const emailReviewer = async (review) => {
    setError("");
    setBusyId(review.id);
    try {
      const customer = await getCustomer(review.userId);
      setComposer({ customer, orderId: review.orderId });
    } catch (loadError) {
      setError(`Couldn't open this customer: ${loadError.message}`);
    } finally {
      setBusyId("");
    }
  };

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase();
    return reviews
      .filter((review) => tab === "all" || review.status === tab)
      .filter((review) => rating === "any" || String(review.rating) === rating)
      .filter((review) => !photosOnly || review.photoUrl || review.photoDataUrl)
      .filter(
        (review) =>
          !words ||
          `${review.name} ${review.email} ${review.productName} ${review.comment} ${review.orderId}`.toLowerCase().includes(words)
      )
      .sort(SORTS[sort]);
  }, [reviews, tab, rating, photosOnly, query, sort]);

  const approved = reviews.filter((review) => review.status === "approved");
  const average = approved.length ? approved.reduce((sum, review) => sum + review.rating, 0) / approved.length : 0;
  const waiting = reviews.filter((review) => review.status === "pending");

  const approveAllShown = async () => {
    const targets = visible.filter((review) => review.status === "pending");
    if (!targets.length || !window.confirm(`Approve ${targets.length} waiting review${targets.length === 1 ? "" : "s"}?`)) return;
    setBusyId("bulk");
    setError("");
    try {
      for (const review of targets) await update(review, "approved");
      setNotice(`Approved ${targets.length} review${targets.length === 1 ? "" : "s"}.`);
    } catch (bulkError) {
      setError(bulkError.message);
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="panel wide-panel reviews-admin">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Reviews</p>
          <h3>Customer Reviews</h3>
        </div>
        <label className="product-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search name, poster, words or order"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="admin-stats">
        <div className="admin-stat">
          <span>Waiting for you</span>
          <strong>{waiting.length}</strong>
        </div>
        <div className="admin-stat">
          <span>Live on the site</span>
          <strong>{approved.length}</strong>
        </div>
        <div className="admin-stat">
          <span>Average rating</span>
          <strong>
            {average ? average.toFixed(1) : "-"} {average > 0 && <Stars rating={average} size={13} />}
          </strong>
        </div>
        <div className="admin-stat">
          <span>With wall photos</span>
          <strong>{reviews.filter((review) => review.photoUrl || review.photoDataUrl).length}</strong>
        </div>
      </div>

      <div className="order-tabs">
        {TABS.map((item) => (
          <button type="button" key={item.value} className={tab === item.value ? "active" : ""} onClick={() => setTab(item.value)}>
            {item.label}{" "}
            <span>{item.value === "all" ? reviews.length : reviews.filter((review) => review.status === item.value).length}</span>
          </button>
        ))}
      </div>

      <div className="review-filters">
        <label className="field">
          Stars
          <select value={rating} onChange={(event) => setRating(event.target.value)}>
            <option value="any">Any rating</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={String(value)}>
                {value} star{value === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="lowest">Lowest rating first</option>
            <option value="highest">Highest rating first</option>
          </select>
        </label>
        <label className="review-photo-toggle">
          <input type="checkbox" checked={photosOnly} onChange={(event) => setPhotosOnly(event.target.checked)} /> With photos only
        </label>
        {visible.some((review) => review.status === "pending") && (
          <button type="button" className="secondary-button" disabled={busyId === "bulk"} onClick={approveAllShown}>
            <Check size={15} /> Approve all shown
          </button>
        )}
      </div>

      {(notice || error) && <div className={`message ${error ? "error" : "success"}`}>{error || notice}</div>}
      {loading && <p className="empty">Loading reviews…</p>}
      {!loading && !visible.length && (
        <p className="empty">{tab === "pending" && !query ? "No reviews waiting for approval." : "No reviews match."}</p>
      )}

      <div className="review-admin-list">
        {visible.map((review) => {
          const photo = review.photoUrl || review.photoDataUrl;
          const busy = busyId === review.id || busyId === "bulk";
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
                  <Stars rating={review.rating} />
                  {tab === "all" && <span className={`user-badge status-${review.status}`}>{review.status}</span>}
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
                    <button type="button" className="primary" disabled={busy} onClick={() => act(review, "approved")}>
                      <Check size={15} /> Approve
                    </button>
                  )}
                  {review.status !== "rejected" && (
                    <button type="button" disabled={busy} onClick={() => act(review, "rejected")}>
                      <X size={15} /> {review.status === "approved" ? "Hide" : "Reject"}
                    </button>
                  )}
                  {review.userId && (
                    <button type="button" disabled={busy} onClick={() => emailReviewer(review)}>
                      <Mail size={15} /> Email customer
                    </button>
                  )}
                  <button type="button" className="danger" disabled={busy} onClick={() => act(review, "delete")}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {composer && (
        <EmailComposer
          customer={composer.customer}
          initialTemplate="custom"
          initialOrderId={composer.orderId}
          onClose={() => setComposer(null)}
          onSent={(result) => {
            setComposer(null);
            setNotice(result.message);
          }}
        />
      )}
    </section>
  );
}
