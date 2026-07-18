import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { confirmEntitlementWithRetry } from "../lib/premiumExperience";
import "./CheckoutStatusNotice.css";

export default function CheckoutStatusNotice({ onRestoreAccess, onClose, onAnalytics }) {
  const [status, setStatus] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [entitlement, setEntitlement] = useState("idle");
  const started = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search); const checkout = params.get("checkout"); const id = params.get("session_id") || "";
    if (checkout === "success" || params.get("payment") === "success" || params.get("success") === "true" || id) { setStatus("success"); setSessionId(id); }
    else if (checkout === "cancelled" || params.get("payment") === "cancelled" || params.get("cancelled") === "true") { setStatus("cancelled"); void onAnalytics?.("checkout_cancelled", {}); }
  }, [onAnalytics]);
  const verify = useCallback(async () => {
    setEntitlement("processing");
    const result = await confirmEntitlementWithRetry(() => onRestoreAccess?.(sessionId), { delay: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)) });
    setEntitlement(result.confirmed ? "confirmed" : "delayed");
    void onAnalytics?.(result.confirmed ? "premium_entitlement_confirmed" : "premium_entitlement_delayed", { attempts: result.attempts });
  }, [onAnalytics, onRestoreAccess, sessionId]);
  useEffect(() => { if (status !== "success" || started.current) return; started.current = true; void onAnalytics?.("checkout_completed", { hasSessionContext: Boolean(sessionId) }); void verify(); }, [onAnalytics, sessionId, status, verify]);
  const close = () => { window.history.replaceState({}, "", `${window.location.origin}${window.location.pathname}${window.location.hash || ""}`); setStatus(null); onClose?.(); };
  if (!status) return null;
  const success = status === "success";
  const message = entitlement === "confirmed" ? "Founder Pass is confirmed on this account." : entitlement === "delayed" ? "Payment was received, but access is still processing. Do not purchase again. Retry below or contact support@openingfit.com." : "Stripe completed payment. OpeningFit is confirming access now; this can take a moment.";
  return <div className="checkoutNoticeBackdrop"><section className={`checkoutNotice checkoutNotice--${status}`} role="dialog" aria-modal="true" aria-labelledby="checkout-status-title"><button className="checkoutNoticeClose" type="button" onClick={close} aria-label="Close checkout message"><X size={18} aria-hidden="true" /></button><div className="checkoutNoticeIcon">{success ? "✓" : "↩"}</div><p className="checkoutNoticeEyebrow">{success ? "Founder Pass" : "Checkout cancelled"}</p><h2 id="checkout-status-title">{success ? "Thanks for supporting OpeningFit." : "No payment was taken."}</h2><p>{success ? message : "Your free report remains available. You can return to pricing whenever it is useful."}</p><div className="checkoutNoticeActions">{success && entitlement !== "confirmed" ? <button className="checkoutNoticePrimary" type="button" onClick={verify} disabled={entitlement === "processing"}>{entitlement === "processing" ? "Checking access…" : "Retry access check"}</button> : null}<button className={success ? "checkoutNoticeSecondary" : "checkoutNoticePrimary"} type="button" onClick={close}>Continue to OpeningFit</button></div></section></div>;
}
