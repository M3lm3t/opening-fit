import { useEffect, useRef, useState } from "react";
import "./CheckoutStatusNotice.css";

export default function CheckoutStatusNotice({ onRestoreAccess, onClose }) {
  const [status, setStatus] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState("");
  const restoredAfterSuccessRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const payment = params.get("payment");
    const stripeSuccess = params.get("success");
    const stripeCancelled = params.get("cancelled");
    const sessionId = params.get("session_id");

    if (checkout === "success" || payment === "success" || stripeSuccess === "true" || sessionId) {
      setStatus("success");
      setCheckoutSessionId(sessionId || "");
      return;
    }

    if (checkout === "cancelled" || payment === "cancelled" || stripeCancelled === "true") {
      setStatus("cancelled");
    }
  }, []);

  useEffect(() => {
    if (status !== "success" || restoredAfterSuccessRef.current) return;

    restoredAfterSuccessRef.current = true;
    onRestoreAccess?.(checkoutSessionId);
  }, [checkoutSessionId, onRestoreAccess, status]);

  const clearCheckoutUrl = () => {
    const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, "", cleanUrl);
  };

  const closeNotice = () => {
    clearCheckoutUrl();
    setStatus(null);
    if (onClose) onClose();
  };

  if (!status) return null;

  const isSuccess = status === "success";

  return (
    <div className="checkoutNoticeBackdrop">
      <section className={`checkoutNotice checkoutNotice--${status}`}>
        <button
          className="checkoutNoticeClose"
          type="button"
          onClick={closeNotice}
          aria-label="Close checkout message"
        >
          ×
        </button>

        <div className="checkoutNoticeIcon">
          {isSuccess ? "✓" : "↩"}
        </div>

        <p className="checkoutNoticeEyebrow">
          {isSuccess ? "Founder Pass" : "Checkout cancelled"}
        </p>

        <h2>
          {isSuccess
            ? "Thanks for supporting OpeningFit."
            : "No worries — your free report is still available."}
        </h2>

        <p>
          {isSuccess
            ? "Your payment was completed through Stripe. If premium does not appear instantly, use restore access from your login menu."
            : "You can keep using the free report and come back to the Founder Pass later."}
        </p>

        <div className="checkoutNoticeActions">
          {isSuccess ? (
            <button
              className="checkoutNoticePrimary"
              type="button"
              onClick={() => {
                if (onRestoreAccess) onRestoreAccess(checkoutSessionId);
                closeNotice();
              }}
            >
              Restore / check access
            </button>
          ) : null}

          <button
            className={isSuccess ? "checkoutNoticeSecondary" : "checkoutNoticePrimary"}
            type="button"
            onClick={closeNotice}
          >
            Continue to OpeningFit
          </button>
        </div>
      </section>
    </div>
  );
}
