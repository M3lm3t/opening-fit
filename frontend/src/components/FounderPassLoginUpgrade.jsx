import { useEffect, useState } from "react";
import "./FounderPassLoginUpgrade.css";

export default function FounderPassLoginUpgrade({ accountUser }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleFounderIntent = () => {
      setOpen(true);
    };

    window.addEventListener("openingfit:founder-pass-intent", handleFounderIntent);

    return () => {
      window.removeEventListener("openingfit:founder-pass-intent", handleFounderIntent);
    };
  }, []);

  const continueToAccountPayment = () => {
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
          <strong>£8 lifetime</strong>
        </div>

        <h2>Unlock OpeningFit Premium while it is still early.</h2>

        <p>
          Get lifetime access to the Founder Pass price before premium features expand.
          Login first so your purchase can be linked to your account.
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
            <p>Pay once and keep access as the product grows.</p>
          </div>

          <div>
            <span>3</span>
            <strong>Restore anytime</strong>
            <p>Use your account to restore access on another device later.</p>
          </div>
        </div>

        <div className="founderPassUpgradeTrust">
          <span>Lifetime early supporter price</span>
          <span>One-off payment</span>
          <span>Future premium upgrades included</span>
        </div>

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
