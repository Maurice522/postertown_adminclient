import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, Mail, Search, ShoppingCart, Star, UserCheck } from "lucide-react";
import { getCustomer, listCustomers, setCustomerStatus } from "../services/api.js";
import EmailComposer from "./EmailComposer.jsx";

// Customers: who signed up, what they bought, what's sitting in their cart, and every
// email the shop sent them. Emails go out from here one customer at a time.
const ABANDONED_AFTER_MS = 60 * 60 * 1000;

const isAbandoned = (user) =>
  user.cartCount > 0 &&
  user.cartUpdatedAt &&
  Date.now() - new Date(user.cartUpdatedAt).getTime() > ABANDONED_AFTER_MS &&
  !(user.lastOrderAt && new Date(user.lastOrderAt) > new Date(user.cartUpdatedAt));

const FILTERS = [
  { value: "all", label: "All", test: () => true },
  { value: "carts", label: "Abandoned carts", test: isAbandoned },
  { value: "buyers", label: "Buyers", test: (user) => user.orderCount > 0 },
  { value: "no-orders", label: "No orders yet", test: (user) => !user.orderCount },
  { value: "blocked", label: "Blocked", test: (user) => user.status === "blocked" }
];

const TEMPLATE_LABELS = {
  cart_reminder: "Cart reminder",
  coupon: "Coupon",
  delivery_details: "Delivery details",
  refund_update: "Refund update",
  review_request: "Review request",
  custom: "Custom"
};

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const day = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-";
const when = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "-";
const label = (status = "") => status.replaceAll("_", " ");

export default function UsersManager({ onOpenProduct }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await listCustomers());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const test = FILTERS.find((item) => item.value === filter)?.test || (() => true);
    const words = query.trim().toLowerCase();
    return users.filter(
      (user) => test(user) && (!words || `${user.name} ${user.email} ${user.phone} ${user.city}`.toLowerCase().includes(words))
    );
  }, [users, query, filter]);

  if (selected) {
    return (
      <CustomerDetail
        id={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
        onOpenProduct={onOpenProduct}
      />
    );
  }

  const stats = [
    ["Customers", users.length],
    ["Buyers", users.filter((user) => user.orderCount > 0).length],
    ["Abandoned carts", users.filter(isAbandoned).length],
    ["Revenue", money(users.reduce((sum, user) => sum + user.totalSpent, 0))]
  ];

  return (
    <section className="panel wide-panel users-admin">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Customers</p>
          <h3>{query || filter !== "all" ? `${shown.length} of ${users.length}` : users.length} Customers</h3>
        </div>
        <label className="product-search">
          <Search size={16} />
          <input type="search" placeholder="Search name, email, phone or city" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>

      <div className="admin-stats">
        {stats.map(([name, value]) => (
          <div key={name} className="admin-stat">
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="order-tabs">
        {FILTERS.map((item) => (
          <button type="button" key={item.value} className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)}>
            {item.label} <span>{users.filter(item.test).length}</span>
          </button>
        ))}
      </div>

      {filter === "carts" && (
        <p className="muted-value">
          Signed-in shoppers whose cart has sat for over an hour without an order. Guests' carts aren't saved, so they don't show here.
        </p>
      )}
      {error && <div className="message error">{error}</div>}
      {loading && <p className="empty">Loading customers…</p>}
      {!loading && !shown.length && <p className="empty">No customers here.</p>}

      {!loading && shown.length > 0 && (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Joined</th>
                <th>Orders</th>
                <th>Spent</th>
                <th>Cart</th>
                <th>Emails</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((user) => (
                <tr key={user.id} onClick={() => setSelected(user.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(user.id)}>
                  <td>
                    <strong>{user.name}</strong>
                    {user.status === "blocked" && <span className="user-badge danger">Blocked</span>}
                    <small>{user.email || "No email"}{user.phone ? ` · ${user.phone}` : ""}</small>
                  </td>
                  <td>
                    {day(user.createdAt)}
                    <small>{user.authProvider === "google" ? "Google" : "Email"}</small>
                  </td>
                  <td>
                    {user.orderCount}
                    {user.lastOrderStatus && <small>{label(user.lastOrderStatus)}</small>}
                  </td>
                  <td>{money(user.totalSpent)}</td>
                  <td>
                    {user.cartCount ? (
                      <>
                        <span className={isAbandoned(user) ? "user-badge warn" : ""}>
                          {user.cartCount} · {money(user.cartValue)}
                        </span>
                        <small>{when(user.cartUpdatedAt)}</small>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {user.emailsSent || "-"}
                    {user.lastEmailAt && <small>{when(user.lastEmailAt)}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CustomerDetail({ id, onBack, onOpenProduct }) {
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composer, setComposer] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError("");
    try {
      setCustomer(await getCustomer(id));
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBlock = async () => {
    const next = customer.status === "blocked" ? "active" : "blocked";
    if (next === "blocked" && !window.confirm(`Block ${customer.name}? They won't be able to sign in.`)) return;
    setBusy(true);
    try {
      await setCustomerStatus(customer.id, next);
      setCustomer((current) => ({ ...current, status: next }));
    } catch (blockError) {
      setError(blockError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!customer) {
    return (
      <section className="panel wide-panel">
        <button type="button" className="secondary-button" onClick={onBack}>
          <ArrowLeft size={15} /> All customers
        </button>
        {error ? <div className="message error">{error}</div> : <p className="empty">Loading customer…</p>}
      </section>
    );
  }

  const address = customer.addresses?.[0];
  const open = (template, orderId = "") => setComposer({ template, orderId });

  return (
    <section className="panel wide-panel users-admin">
      <div className="panel-heading">
        <div>
          <button type="button" className="text-button" onClick={onBack}>
            <ArrowLeft size={14} /> All customers
          </button>
          <h3>
            {customer.name} {customer.status === "blocked" && <span className="user-badge danger">Blocked</span>}
          </h3>
          <p className="muted-value">
            {customer.email || "No email"}
            {customer.phone ? ` · ${customer.phone}` : ""} · joined {day(customer.createdAt)} with{" "}
            {customer.authProvider === "google" ? "Google" : "email"}
            {customer.lastLoginAt ? ` · last sign-in ${when(customer.lastLoginAt)}` : ""}
          </p>
        </div>
        <div className="user-actions">
          <button type="button" className="primary-button" disabled={!customer.email} onClick={() => open("custom")}>
            <Mail size={15} /> Email customer
          </button>
          <button type="button" className="secondary-button" disabled={busy} onClick={toggleBlock}>
            {customer.status === "blocked" ? <UserCheck size={15} /> : <Ban size={15} />}
            {customer.status === "blocked" ? "Unblock" : "Block"}
          </button>
        </div>
      </div>

      {(notice || error) && <div className={`message ${error ? "error" : "success"}`}>{error || notice}</div>}

      <div className="admin-stats">
        <div className="admin-stat"><span>Orders</span><strong>{customer.orderCount}</strong></div>
        <div className="admin-stat"><span>Spent</span><strong>{money(customer.totalSpent)}</strong></div>
        <div className="admin-stat"><span>Reviews</span><strong>{customer.reviewCount}</strong></div>
        <div className="admin-stat"><span>Emails sent</span><strong>{customer.emailsSent}</strong></div>
      </div>

      <div className="user-detail-grid">
        <div className="user-card">
          <div className="user-card-head">
            <h4><ShoppingCart size={15} /> Cart</h4>
            {customer.cart.length > 0 && (
              <button type="button" className="secondary-button" onClick={() => open("cart_reminder")}>
                <Mail size={14} /> Send cart reminder
              </button>
            )}
          </div>
          {customer.cart.length ? (
            <>
              <ul className="user-items">
                {customer.cart.map((item) => (
                  <li key={item.id}>
                    {item.image && <img src={item.image} alt="" />}
                    <button type="button" className="link-button" onClick={() => onOpenProduct(item.productId)}>{item.name}</button>
                    <span>{item.size} × {item.amount}</span>
                    <strong>{money(item.price * item.amount)}</strong>
                  </li>
                ))}
              </ul>
              <small className="muted-value">Last changed {when(customer.cartUpdatedAt)}</small>
            </>
          ) : (
            <p className="muted-value">Empty (or they shop as a guest).</p>
          )}
        </div>

        <div className="user-card">
          <h4>Address</h4>
          {address ? (
            <p className="user-address">
              {address.fullName && <>{address.fullName}<br /></>}
              {address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ""}<br />
              {[address.city, address.state, address.pincode].filter(Boolean).join(", ")}
              {address.phone && <><br />{address.phone}</>}
            </p>
          ) : (
            <p className="muted-value">No saved address.</p>
          )}
          <small className="muted-value">Marketing emails: {customer.marketingEmails ? "opted in" : "not opted in"}</small>
        </div>
      </div>

      <div className="user-card">
        <h4>Orders</h4>
        {!customer.orders.length && <p className="muted-value">No orders yet.</p>}
        {customer.orders.map((order) => (
          <div key={order.id} className="user-order">
            <div className="user-order-top">
              <strong>{order.id}</strong>
              <span className={`user-badge status-${order.status}`}>{label(order.status)}</span>
              <span className="muted-value">{when(order.createdAt)}</span>
              <strong>{money(order.total)}</strong>
            </div>
            <small className="muted-value">
              {order.items.map((item) => `${item.name} (${item.size || "-"} × ${item.amount})`).join(", ")}
            </small>
            <div className="user-order-actions">
              <button type="button" className="secondary-button" onClick={() => open("delivery_details", order.id)}>Ask delivery details</button>
              <button type="button" className="secondary-button" onClick={() => open("refund_update", order.id)}>Refund update</button>
              <button type="button" className="secondary-button" onClick={() => open("review_request", order.id)}>
                <Star size={14} /> Ask for review
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="user-detail-grid">
        <div className="user-card">
          <h4>Reviews</h4>
          {!customer.reviews.length && <p className="muted-value">No reviews yet.</p>}
          {customer.reviews.map((review) => (
            <div key={review.id} className="user-review">
              <strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong>{" "}
              <button type="button" className="link-button" onClick={() => onOpenProduct(review.productId)}>{review.productName || review.productId}</button>
              <span className={`user-badge status-${review.status}`}>{review.status}</span>
              <p>{review.comment}</p>
            </div>
          ))}
        </div>

        <div className="user-card">
          <h4>Emails sent</h4>
          {!customer.contactLog.length && <p className="muted-value">None yet.</p>}
          <ul className="user-log">
            {customer.contactLog.map((entry, index) => (
              <li key={`${entry.sentAt}-${index}`}>
                <strong>{TEMPLATE_LABELS[entry.template] || entry.template}</strong> · {entry.subject}
                <small className="muted-value">
                  {when(entry.sentAt)}
                  {entry.orderId ? ` · ${entry.orderId}` : ""}
                  {entry.couponCode ? ` · coupon ${entry.couponCode}` : ""}
                </small>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {composer && (
        <EmailComposer
          customer={customer}
          initialTemplate={composer.template}
          initialOrderId={composer.orderId}
          onClose={() => setComposer(null)}
          onSent={(result) => {
            setComposer(null);
            setNotice(result.message);
            load();
          }}
        />
      )}
    </section>
  );
}
