import React, { useEffect, useMemo, useState } from "react";
import { Eye, Send, X } from "lucide-react";
import { emailCustomer, getEmailOptions } from "../services/api.js";

// Writes one email to one customer, using the shop's email design. The admin picks
// the kind of email, edits the wording, previews it exactly as it will arrive, then
// sends. {name} in the text becomes the customer's first name.
let optionsCache = null;

export default function EmailComposer({ customer, initialTemplate = "custom", initialOrderId = "", onClose, onSent }) {
  const [options, setOptions] = useState(optionsCache);
  const [template, setTemplate] = useState(initialTemplate);
  const [orderId, setOrderId] = useState(initialOrderId);
  const [couponCode, setCouponCode] = useState("");
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (optionsCache) return;
    getEmailOptions()
      .then((data) => {
        optionsCache = data;
        setOptions(data);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const chosen = useMemo(() => options?.templates.find((item) => item.value === template), [options, template]);

  // Load the template's default wording whenever the email type changes.
  useEffect(() => {
    if (!chosen) return;
    setSubject(chosen.subject);
    setHeading(chosen.heading);
    setMessage(chosen.message);
    setPreview(null);
    if (chosen.needs === "order" && !orderId && customer.orders?.length) setOrderId(customer.orders[0].id);
  }, [chosen]); // eslint-disable-line react-hooks/exhaustive-deps

  const payload = { template, subject, heading, message, couponCode, orderId: orderId || undefined };

  const problem = (() => {
    if (!customer.email) return "This customer has no email address.";
    if (chosen?.needs === "order" && !orderId) return "Pick the order this email is about.";
    if (chosen?.needs === "cart" && !customer.cart?.length) return "This customer's cart is empty.";
    if (chosen?.needs === "coupon" && !couponCode) return "Pick a coupon to send.";
    if (!message.trim()) return "Write a message.";
    return "";
  })();

  const run = async (mode) => {
    setError("");
    if (mode === "send" && !window.confirm(`Send "${subject}" to ${customer.email}?`)) return;
    setBusy(mode);
    try {
      if (mode === "preview") {
        setPreview(await emailCustomer(customer.id, { ...payload, preview: true }));
      } else {
        const result = await emailCustomer(customer.id, payload);
        onSent?.(result);
      }
    } catch (runError) {
      setError(runError.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="composer-backdrop" role="dialog" aria-modal="true" aria-label={`Email ${customer.name}`}>
      <div className="composer">
        <div className="composer-head">
          <div>
            <p className="eyebrow">Email customer</p>
            <h3>
              {customer.name} <span className="muted-value">{customer.email}</span>
            </h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="composer-body">
          <div className="composer-form">
            <div className="composer-types">
              {(options?.templates || []).map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={template === item.value ? "active" : ""}
                  onClick={() => setTemplate(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {(chosen?.needs === "order" || (customer.orders?.length > 0 && template === "custom")) && (
              <label className="field">
                Order
                <select value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                  <option value="">{chosen?.needs === "order" ? "Pick an order" : "No order"}</option>
                  {(customer.orders || []).map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.id} · {order.status?.replaceAll("_", " ")} · ₹{order.total}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              Coupon {chosen?.needs === "coupon" ? "" : "(optional)"}
              <select value={couponCode} onChange={(event) => setCouponCode(event.target.value)}>
                <option value="">No coupon</option>
                {(options?.coupons || []).map((coupon) => (
                  <option key={coupon.code} value={coupon.code}>
                    {coupon.code} · {coupon.description}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Subject
              <input value={subject} maxLength={150} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label className="field">
              Heading in the email
              <input value={heading} maxLength={120} placeholder="Same as the subject" onChange={(event) => setHeading(event.target.value)} />
            </label>
            <label className="field">
              Message <small className="muted-value">{"{name}"} becomes their first name. Leave a blank line between paragraphs.</small>
              <textarea rows={9} value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>

            {template === "cart_reminder" && (
              <p className="muted-value">Their cart items and a "Complete your order" button are added below your message.</p>
            )}
            {template === "review_request" && (
              <p className="muted-value">Each poster in the order gets a "Write a review" link.</p>
            )}

            {(error || problem) && <div className="message error">{error || problem}</div>}

            <div className="composer-actions">
              <button type="button" className="secondary-button" disabled={Boolean(problem) || Boolean(busy)} onClick={() => run("preview")}>
                <Eye size={15} /> {busy === "preview" ? "Loading…" : "Preview"}
              </button>
              <button type="button" className="primary-button" disabled={Boolean(problem) || Boolean(busy)} onClick={() => run("send")}>
                <Send size={15} /> {busy === "send" ? "Sending…" : "Send email"}
              </button>
            </div>
          </div>

          <div className="composer-preview">
            {preview ? (
              <>
                <div className="composer-preview-subject">
                  <span>Subject</span> {preview.subject}
                </div>
                <iframe title="Email preview" srcDoc={preview.html} sandbox="" />
              </>
            ) : (
              <p className="empty">Click Preview to see the email exactly as {customer.name.split(" ")[0]} will get it.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
