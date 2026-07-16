import { useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { captureReferralCode, getStoredReferral } from "../lib/referrals";
import { logSupabaseSyncWarning } from "../services/supabaseSyncDebug";

export default function ReferralCodeEntry() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function applyCode(event) {
    event.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      setStatus("Referral validation is temporarily unavailable.");
      return;
    }
    setBusy(true);
    setStatus("Checking code…");
    const result = await captureReferralCode(code, {
      rpc: supabase.rpc.bind(supabase),
      onError: (error, stage) => logSupabaseSyncWarning("referrals", stage, error, { source: "manual-entry" }),
    });
    setBusy(false);

    if (result.success && result.reason === "first-touch-preserved") {
      setStatus(`A referral from ${result.referral.partnerName} is already applied and cannot be replaced.`);
    } else if (result.success) {
      setStatus(`Referral applied from ${result.referral.partnerName}.`);
      setCode("");
    } else if (result.reason === "validation-unavailable") {
      setStatus("We could not check that code. Please try again.");
    } else {
      setStatus("That referral code is not valid.");
    }
  }

  const existing = getStoredReferral();
  return (
    <details className="referralCodeEntry">
      <summary>Have a referral code?</summary>
      <form onSubmit={applyCode}>
        <label htmlFor="openingfit-referral-code">Referral code</label>
        <div>
          <input
            id="openingfit-referral-code"
            value={code}
            maxLength={50}
            autoComplete="off"
            onChange={(event) => setCode(event.target.value)}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !code.trim()}>{busy ? "Checking…" : "Apply"}</button>
        </div>
        {existing && !status ? <p>Referral applied from {existing.partnerName}.</p> : null}
        {status ? <p role="status" aria-live="polite">{status}</p> : null}
      </form>
    </details>
  );
}
