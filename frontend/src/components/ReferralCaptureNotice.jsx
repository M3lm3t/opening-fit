import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { captureReferralFromUrl, REFERRAL_CAPTURED_EVENT } from "../lib/referrals";
import { logSupabaseSyncWarning } from "../services/supabaseSyncDebug";

let initialCapturePromise = null;

export default function ReferralCaptureNotice() {
  const [partnerName, setPartnerName] = useState("");

  useEffect(() => {
    const showCapture = (event) => setPartnerName(String(event?.detail?.partnerName || ""));
    window.addEventListener(REFERRAL_CAPTURED_EVENT, showCapture);

    if (isSupabaseConfigured && supabase) {
      initialCapturePromise ||= captureReferralFromUrl({
        rpc: supabase.rpc.bind(supabase),
        notify: false,
        onError: (error, stage) => logSupabaseSyncWarning(
          "referrals",
          stage,
          error,
          { source: "url-capture" }
        ),
      });
      initialCapturePromise.then((result) => {
        if (result?.success && !result?.preserved) setPartnerName(result.referral?.partnerName || "");
      });
    }

    return () => window.removeEventListener(REFERRAL_CAPTURED_EVENT, showCapture);
  }, []);

  if (!partnerName) return null;
  return (
    <div className="referralAppliedNotice" role="status" aria-live="polite">
      <span>Referral applied from {partnerName}.</span>
      <button type="button" onClick={() => setPartnerName("")} aria-label="Dismiss referral confirmation"><X size={18} aria-hidden="true" /></button>
    </div>
  );
}
