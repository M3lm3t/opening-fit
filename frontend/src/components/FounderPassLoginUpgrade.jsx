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
    setOpen(false);

    setTimeout(() => {
      const accountTarget =
        document.getElementById("account") ||
        document.getElementById("login") ||
        document.querySelector(".accountPanel") ||
        document.querySelector(".account-panel") ||
        document.querySelector("[data-section='account']");

      if (accountTarget?.scrollIntoView) {
        accountTarget.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      const accountButtons = Array.from(
        document.querySelectorAll("button, a, [role='button']")
      );

      const paymentButton = accountButtons.find((el) => {
        const text = String(
          el.innerText || el.textContent || el.getAttribute("aria-label") || ""
        ).toLowerCase();

        const className = String(el.className || "").toLowerCase();

        if (className.includes("founderpassupgrade")) return false;

        return (
          text.includes("checkout") ||
          text.includes("stripe") ||
          text.includes("founder") ||
          text.includes("upgrade") ||
          text.includes("premium") ||
          text.includes("buy") ||
          text.includes("£8") ||
          text.includes("lifetime")
        );
      });

      if (paymentButton) {
        if (paymentButton.tagName === "A" && paymentButton.href) {
          window.location.href = paymentButton.href;
          return;
        }

        paymentButton.click();
        return;
      }

      const loginButton = accountButtons.find((el) => {
        const text = String(
          el.innerText || el.textContent || el.getAttribute("aria-label") || ""
        ).toLowerCase();

        return (
          text.includes("login") ||
          text.includes("log in") ||
          text.includes("sign in") ||
          text.includes("account")
        );
      });

      if (loginButton) loginButton.click();
    }, 120);
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
