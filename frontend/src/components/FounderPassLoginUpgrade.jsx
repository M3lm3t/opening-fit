import { useEffect, useState } from "react";
import { startPremiumCheckout } from "../accountApi";
import "./FounderPassLoginUpgrade.css";

export default function FounderPassLoginUpgrade({ accountUser }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const handleFounderIntent = () => {
      setStatus("");
      setOpen(true);
    };

    const handleUnlockClick = (event) => {
      const trigger = event.target?.closest?.("button, a, [role='button']");
      if (!trigger) return;
      if (trigger.closest(".founderPassUpgradePanel")) return;
      if (trigger.closest(".accountPanel")) return;

      const label = [
        trigger.textContent,
        trigger.getAttribute("aria-label"),
        trigger.getAttribute("title"),
        trigger.className,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const looksLikeUnlock =
        label.includes("founder pass") ||
        label.includes("unlock founder") ||
        label.includes("unlock full") ||
        label.includes("full repertoire") ||
        label.includes("full report") ||
        label.includes("unlock export") ||
        label.includes("saved history");

      const isNonUpgradeAction =
        label.includes("preview") ||
        label.includes("maybe later") ||
        label.includes("exit preview") ||
        label.includes("continue with free");

      if (looksLikeUnlock && !isNonUpgradeAction) {
        setStatus("");
        setOpen(true);
      }
    };

    window.addEventListener("openingfit:founder-pass-intent", handleFounderIntent);
    document.addEventListener("click", handleUnlockClick);

    return () => {
      window.removeEventListener("openingfit:founder-pass-intent", handleFounderIntent);
      document.removeEventListener("click", handleUnlockClick);
    };
  }, []);

  const continueToAccountPayment = async () => {
    if (accountUser?.id) {
      try {
        setStatus("Opening secure Stripe checkout...");
        await startPremiumCheckout(accountUser);
      } catch (error) {
        console.error("Founder Pass checkout failed", error);
        setStatus(error?.message || "Could not start Stripe checkout.");
      }
      return;
    }

    // Close this Founder Pass modal first so the account/payment UI is not hidden behind it.
    setOpen(false);

    // Put the user on the account area.
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${window.location.search}#account`
    );

    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("openingfit:open-account-payment", {
          detail: {
            source: "founder-pass-modal",
            plan: "founder_pass",
          },
        })
      );

      const accountTarget =
        document.getElementById("account") ||
        document.getElementById("login") ||
        document.querySelector(".accountPanel") ||
        document.querySelector(".account-panel") ||
        document.querySelector("[data-section='account']");

      if (accountTarget?.scrollIntoView) {
        accountTarget.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 180);
  };


  if (!open) return null;

  return (
    <div className="founderPassUpgradeBackdrop" role="presentation">
      <section className="founderPassUpgradePanel" role="dialog" aria-modal="true">
        <button
          className="founderPassUpgradeClose"
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close Founder Pass panel"
        >
          ×
        </button>

        <div className="founderPassUpgradeHeader">
          <span>Founder Pass</span>
          <strong>£8 early lifetime access</strong>
        </div>

        <h2>Unlock deeper history and saved repertoire tools.</h2>

        <p>
          The free report stays useful. Founder Pass adds 12-month imports,
          saved progress, full tables, advanced filters, and exportable study
          plans. Login first so your access can be linked to your account.
        </p>

        <div className="founderPassUpgradeSteps">
          <div>
            <span>1</span>
            <strong>{accountUser ? "Account detected" : "Login or create account"}</strong>
            <p>
              {accountUser
                ? "You are ready to continue to payment."
                : "This keeps your Founder Pass linked to you."}
            </p>
          </div>

          <div>
            <span>2</span>
            <strong>Secure Stripe checkout</strong>
            <p>Pay once for early lifetime access.</p>
          </div>

          <div>
            <span>3</span>
            <strong>Restore anytime</strong>
            <p>Use your account to restore access on another device later.</p>
          </div>
        </div>

        <div className="founderPassUpgradeTrust">
          <span>Early lifetime access</span>
          <span>One-off payment</span>
          <span>Depth tools included</span>
        </div>

        <p className="founderPassUpgradeNote">
          Opening Fit is still improving. Founder Pass helps fund development and
          includes later premium tools like engine diagnosis, line mistakes, PDF
          export, and practice drills as they are added.
        </p>

        {status ? <p className="founderPassUpgradeNote">{status}</p> : null}

        <button
          className="founderPassUpgradePrimary"
          type="button"
          onClick={continueToAccountPayment}
        >
          {accountUser ? "Continue to secure payment" : "Login to continue"}
        </button>

        <button
          className="founderPassUpgradeSecondary"
          type="button"
          onClick={() => setOpen(false)}
        >
          Maybe later
        </button>
      </section>
    </div>
  );
}
