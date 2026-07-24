import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { releaseExclusiveDialog, requestExclusiveDialog, subscribeExclusiveDialog, useAccessibleDialog } from "../lib/dialogAccessibility.js";
import "./FounderPassLoginUpgrade.css";

const DIALOG_ID = "openingfit-plus-upgrade";

export default function FounderPassLoginUpgrade({ accountUser, isPremium = false }) {
  const valueBullets = [
    "Save up to 50 reports",
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
  const [activeDialog, setActiveDialog] = useState(null);
  const [status, setStatus] = useState("");
  const dialogRef = useRef(null);
  const checkoutLoading = false;

  useEffect(() => {
    const handleFounderIntent = () => {
      if (isPremium) return;
      setStatus("");
      setOpen(true);
      requestExclusiveDialog(DIALOG_ID);
    };

    window.addEventListener("openingfit:founder-pass-intent", handleFounderIntent);

    return () => {
      window.removeEventListener("openingfit:founder-pass-intent", handleFounderIntent);
    };
  }, [isPremium]);

  useEffect(() => subscribeExclusiveDialog(setActiveDialog), []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    releaseExclusiveDialog(DIALOG_ID);
  }, []);

  useEffect(() => () => releaseExclusiveDialog(DIALOG_ID), []);
  useEffect(() => {
    if (isPremium && open) closeDialog();
  }, [closeDialog, isPremium, open]);

  const dialogOpen = open && activeDialog === DIALOG_ID && !isPremium;
  useAccessibleDialog(dialogRef, dialogOpen, closeDialog);

  const continueToAccountPayment = async () => {
    if (accountUser?.id) {
      closeDialog();
      window.location.assign("/premium");
      return;
    }

    setStatus("Please sign in or create an account before upgrading.");

    // Close this upgrade dialog first so the account/payment UI is not hidden behind it.
    closeDialog();

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


  if (!dialogOpen) return null;

  return (
    <div
      className="founderPassUpgradeBackdrop"
      role="presentation"
      onClick={closeDialog}
    >
      <section
        className="founderPassUpgradePanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="openingfit-plus-upgrade-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="founderPassUpgradeClose"
          type="button"
          onClick={closeDialog}
          aria-label="Close OpeningFit Plus panel"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="founderPassUpgradeHeader">
          <span>OpeningFit Plus</span>
          <strong>Subscriptions from £4.99 per month</strong>
        </div>

        <h2 id="openingfit-plus-upgrade-title">Save reports and track your opening progress.</h2>

        <p>
          The free report stays useful. OpeningFit Plus adds saved report history,
          progress comparisons, weak-line tracking, and a personal repertoire
          plan. Login first so your access can be linked to your account.
        </p>

        <div className="founderPassUpgradeValue" aria-label="OpeningFit Plus value">
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
          onClick={closeDialog}
        >
          Maybe later
        </button>
      </section>
    </div>
  );
}
