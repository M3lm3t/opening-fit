import { useEffect, useState } from "react";
import "./FounderPassLoginUpgrade.css";

export default function FounderPassLoginUpgrade({ accountUser }) {
  const valueBullets = [
    "Save every report",
    "Compare progress over time",
    "Track weak lines",
    "Personal repertoire plan",
    "Weekly review tracking",
  ];
  const trustItems = [
    "Built for club players",
    "Monthly or annual billing",
    "No theory overload",
  ];

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const checkoutLoading = false;

  useEffect(() => {
    const handleFounderIntent = () => {
      setStatus("");
      setOpen(true);
    };

    const handleUnlockClick = (event) => {
      const trigger = event.target?.closest?.("button, a, [role='button']");
      if (!trigger) return;
      if (trigger.closest("[data-founder-pass-direct='true']")) return;
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

  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  const continueToAccountPayment = async () => {
    if (accountUser?.id) {
      setOpen(false);
      window.location.assign("/premium");
      return;
    }

    setStatus("Please sign in or create an account before upgrading.");

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
    <div
      className="founderPassUpgradeBackdrop"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <section
        className="founderPassUpgradePanel"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="founderPassUpgradeClose"
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close Founder Pass panel"
        >
          ×
        </button>

        <div className="founderPassUpgradeHeader">
          <span>OpeningFit Plus</span>
          <strong>Subscriptions from £4.99 per month</strong>
        </div>

        <h2>Save reports and track your opening progress.</h2>

        <p>
          The free report stays useful. OpeningFit Plus adds saved report history,
          progress comparisons, weak-line tracking, and a personal repertoire
          plan. Login first so your access can be linked to your account.
        </p>

        <div className="founderPassUpgradeValue" aria-label="Founder Pass value">
          {valueBullets.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="founderPassUpgradeSteps">
          <div>
            <span>1</span>
            <strong>{accountUser ? "Account detected" : "Login or create account"}</strong>
            <p>
              {accountUser
                ? "You are ready to continue to payment."
                : "This keeps your subscription linked to you."}
            </p>
          </div>

          <div>
            <span>2</span>
            <strong>Secure Stripe checkout</strong>
            <p>Choose monthly or annual recurring billing.</p>
          </div>

          <div>
            <span>3</span>
            <strong>Restore anytime</strong>
            <p>Use your account to restore access on another device later.</p>
          </div>
        </div>

        <div className="founderPassUpgradeTrust">
          {trustItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <p className="founderPassUpgradeNote">
          OpeningFit Plus supports the living repertoire, weekly training, progress comparisons, and own-game drills already available in the product.
        </p>

        {status ? <p className="founderPassUpgradeNote">{status}</p> : null}

        <button
          className="founderPassUpgradePrimary"
          type="button"
          onClick={continueToAccountPayment}
          disabled={checkoutLoading}
        >
          {checkoutLoading
            ? "Opening checkout..."
            : accountUser
              ? "View monthly and annual plans"
              : "Login to continue"}
        </button>
        <small className="premiumActionMicrocopy">
          Recurring billing. Cancel through account settings; access continues to the end of the paid period. Existing lifetime access remains lifetime.
        </small>

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
