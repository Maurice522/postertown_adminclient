import React, { useState } from "react";
import { AlertTriangle, Check, Copy, X } from "lucide-react";

export const RECEIVER_UPI_ID = "prathamgupta52043@okhdfcbank";

function formatUtr(utr = "") {
  return String(utr).replace(/(\d{4})(?=\d)/g, "$1 ");
}

// Everything needed to find this payment in the receiving UPI app, next to the
// two decisions. Shown while an order is waiting for payment verification.
export default function PaymentCheck({ order, orders, loading, onDecision }) {
  const [copied, setCopied] = useState("");
  const payment = order.payment || {};
  const utr = String(payment.transactionId || "");
  const total = Number(order.totals?.total || 0);
  const duplicates = utr
    ? orders.filter((other) => other.id !== order.id && String(other.payment?.transactionId || "") === utr)
    : [];

  async function copy(value, key) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  }

  function reject() {
    if (window.confirm(`Mark order ${order.id} as payment not received? The customer will be emailed.`)) {
      onDecision(order, "payment_not_verified");
    }
  }

  return (
    <section className="payment-check">
      <div className="payment-check-head">
        <div>
          <p className="eyebrow">Check payment</p>
          <p className="payment-check-hint">
            Open the UPI app for <strong>{payment.receiverUpiId || RECEIVER_UPI_ID}</strong> and look for a payment
            with this amount and UTR.
          </p>
        </div>
      </div>

      <div className="payment-check-grid">
        <div>
          <span>Amount</span>
          <strong>INR {total.toLocaleString("en-IN")}</strong>
        </div>
        <div>
          <span>UTR</span>
          <strong className="payment-utr">{utr ? formatUtr(utr) : "Not shared"}</strong>
          {utr && (
            <button type="button" className="text-button" onClick={() => copy(utr, "utr")}>
              <Copy size={13} /> {copied === "utr" ? "Copied" : "Copy"}
            </button>
          )}
        </div>
        <div>
          <span>Paid by</span>
          <strong>{payment.payerName || "-"}</strong>
        </div>
        <div>
          <span>Payment note</span>
          <strong>Poster Town {order.id}</strong>
        </div>
      </div>

      {utr && !/^\d{12}$/.test(utr) && (
        <p className="payment-check-warning">
          <AlertTriangle size={14} /> This UTR is not 12 digits. It may have been mistyped.
        </p>
      )}
      {duplicates.length > 0 && (
        <p className="payment-check-warning">
          <AlertTriangle size={14} /> Same UTR also used on {duplicates.map((other) => other.id).join(", ")}. One payment
          can only cover one order.
        </p>
      )}

      <div className="payment-check-actions">
        <button type="button" className="primary-button" disabled={loading} onClick={() => onDecision(order, "product_packing")}>
          <Check size={16} /> Payment received
        </button>
        <button type="button" className="secondary-button danger-button" disabled={loading} onClick={reject}>
          <X size={16} /> Not received
        </button>
      </div>
    </section>
  );
}
