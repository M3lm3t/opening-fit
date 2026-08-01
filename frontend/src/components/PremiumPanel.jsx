import { useEffect, useMemo, useState } from "react";
import { loadBillingConfiguration } from "../accountApi.js";
import { annualEffectiveMonthly, annualSavings, BILLING_INTERVAL_STORAGE_KEY, checkoutUnavailableMessage, DEFAULT_BILLING_CONFIGURATION, formatGbp, normaliseBillingConfiguration, normaliseBillingInterval } from "../lib/premiumExperience.js";
import { trackProductEvent } from "../lib/productAnalytics.js";
import { DEFAULT_PUBLIC_ANALYSIS_CONTRACT, loadPublicAnalysisContract, publicFeatureComparison } from "../lib/productTransparency.js";
import { OPENINGFIT_FEATURES } from "../lib/premiumEntitlement.js";
import FeatureAccessPreview from "./FeatureAccessPreview.jsx";
import "./PremiumPanelSubscriptions.css";

const FAQ = [
  ["Can I cancel?", "Yes. You can cancel through account settings, which opens Stripe’s secure subscription portal."],
  ["What happens after cancellation?", "Recurring billing stops and paid access continues until the end of the period you already paid for. Your saved data is retained, but paid workspaces become unavailable after that date unless you resubscribe."],
  ["Does this replace Chess.com analysis?", "No. OpeningFit is a focused opening-repertoire and training companion. It does not replace full-game engine analysis or Chess.com’s broader analysis tools."],
  ["Which platforms are supported?", "OpeningFit currently analyses public Chess.com and Lichess games."],
  ["What happens to lifetime access?", "Existing lifetime members keep lifetime access. A subscription launch does not convert or expire a lifetime entitlement."],
  ["How many games are analysed?", "The number depends on public game activity, filters and usable opening records. Each import classifies at most 300 structurally usable games, selected newest first. Free can request up to 3 months of history; Plus can request up to 12 months."],
  ["Is Repertoire Health a chess rating?", "No. Repertoire Health describes role completeness, concentration, evidence strength and unresolved recurring problems. Individual-opening results and suitability are shown separately."],
];

function BillingToggle({ value, onChange, monthlyAmount, annualAmount, saving }) {
  return <fieldset className="subscriptionBillingToggle"><legend>Billing interval</legend><label className={value === "monthly" ? "isSelected" : ""}><input type="radio" name="billing-interval" value="monthly" checked={value === "monthly"} onChange={() => onChange("monthly")} /><span>Monthly · {formatGbp(monthlyAmount)} billed monthly</span></label><label className={value === "annual" ? "isSelected" : ""}><input type="radio" name="billing-interval" value="annual" checked={value === "annual"} onChange={() => onChange("annual")} /><span>Annual · {formatGbp(annualAmount)} billed annually</span><strong>Save {formatGbp(saving)}</strong></label></fieldset>;
}

function savedBillingInterval() {
  try {
    return normaliseBillingInterval(window.localStorage.getItem(BILLING_INTERVAL_STORAGE_KEY));
  } catch {
    return "monthly";
  }
}

export default function PremiumPanel({ isPremium, entitlement, authenticated = false, onFounderPass, checkoutLoading = false, checkoutError = "" }) {
  const [interval, setInterval] = useState(savedBillingInterval);
  const [configuration, setConfiguration] = useState(DEFAULT_BILLING_CONFIGURATION);
  const [configurationState, setConfigurationState] = useState("loading");
  const [analysisContract, setAnalysisContract] = useState(DEFAULT_PUBLIC_ANALYSIS_CONTRACT);

  useEffect(() => {
    void trackProductEvent("pricing_viewed", { source: "pricing_page", authenticated }, { onceKey: "subscription_pricing" });
    let active = true;
    loadBillingConfiguration().then((value) => { if (!active) return; setConfiguration(normaliseBillingConfiguration(value)); setConfigurationState("ready"); }).catch(() => { if (active) setConfigurationState("error"); });
    loadPublicAnalysisContract().then((value) => { if (active) setAnalysisContract(value); }).catch(() => {});
    return () => { active = false; };
  }, [authenticated]);

  const effectiveMonthly = annualEffectiveMonthly(configuration);
  const saving = annualSavings(configuration);
  const founding = configuration.foundingOffer.enabled;
  const selected = configuration[interval];
  const selectedAmount = interval === "annual" && founding ? configuration.foundingOffer.firstYearAmount : selected.amount;
  const checkoutAvailable = configurationState === "ready" && configuration.checkoutReady && selected.available;
  const lifetime = entitlement?.accessType === "lifetime" && entitlement?.hasPremiumAccess;
  const priceSummary = useMemo(() => interval === "monthly"
    ? `${formatGbp(selectedAmount)} per month`
    : founding ? `${formatGbp(selectedAmount)} for the first year` : `${formatGbp(selectedAmount)} per year`, [founding, interval, selectedAmount]);

  const changeInterval = (next) => {
    const selectedInterval = normaliseBillingInterval(next);
    setInterval(selectedInterval);
    try {
      window.localStorage.setItem(BILLING_INTERVAL_STORAGE_KEY, selectedInterval);
    } catch {
      // Plan comparison remains usable when browser storage is unavailable.
    }
    void trackProductEvent("billing_interval_changed", { source: "pricing_page", authenticated, billingInterval: selectedInterval });
  };

  const checkout = () => onFounderPass?.("pricing_page", interval);
  const comparison = publicFeatureComparison(analysisContract);

  return <section className="premiumUpgradeShell subscriptionPricing" id="premium-offer" aria-labelledby="pricing-title">
    <header className="subscriptionPricingHero"><span>OpeningFit Plus</span><h1 id="pricing-title">Turn each report into useful weekly training.</h1><p>Maintain a living three-role repertoire, review the evidence behind each supported task, and check honestly whether trained positions recur or improve.</p>{lifetime ? <strong className="subscriptionLifetimeNotice">Your lifetime access remains active.</strong> : null}</header>

    <div className="subscriptionPlanGrid">
      <article className="subscriptionPlanCard subscriptionPlanCard--free"><span>Free</span><h2>£0</h2><p>A useful starting report—not an empty teaser.</p><ul><li>First report included</li><li>Basic repertoire coverage and style</li><li>Keep and repair verdicts when supported by your evidence</li><li>One next training action</li><li>Refresh on demand, at least {analysisContract.freeRefreshMinutes} minutes apart</li><li>{analysisContract.freeWeeklyTasks}-task weekly training preview</li></ul><a className="secondaryBtn" href="/analyse">Analyse games</a></article>

      <article className="subscriptionPlanCard subscriptionPlanCard--plus"><header><div><span>OpeningFit Plus</span><h2>{priceSummary}</h2></div>{interval === "annual" ? <strong>Best value</strong> : null}</header>
        <BillingToggle value={interval} onChange={changeInterval} monthlyAmount={configuration.monthly.amount} annualAmount={configuration.annual.amount} saving={saving} />
        {interval === "annual" ? <p className="subscriptionEffectivePrice" aria-live="polite">{formatGbp(configuration.annual.amount)} billed annually · equivalent to {formatGbp(effectiveMonthly)}/month.</p> : <p className="subscriptionEffectivePrice" aria-live="polite">{formatGbp(configuration.monthly.amount)} billed monthly.</p>}
        {interval === "annual" && founding ? <aside className="subscriptionFoundingOffer"><strong>Founding launch price</strong><p>{formatGbp(configuration.foundingOffer.firstYearAmount)} for the first year, then {formatGbp(configuration.foundingOffer.renewsAtAmount)} per year unless cancelled.</p></aside> : null}
        <ul><li>Maintain a living three-role repertoire</li><li>Receive up to {analysisContract.plusWeeklyTasks} evidence-backed weekly tasks—only when supported</li><li>Review the most relevant recoverable games behind each task</li><li>Save editable response plans for recurring positions</li><li>Practise clearly labelled general setups when no source position is recoverable</li><li>See whether trained problems recur or improve in genuinely comparable reports</li><li>Keep report and completed-training history</li><li>Inspect full recommendation evidence where available</li></ul>
        <button type="button" className="premiumCheckoutBtn" onClick={checkout} disabled={isPremium || checkoutLoading || !checkoutAvailable}>{isPremium ? lifetime ? "Lifetime access active" : "OpeningFit Plus active" : checkoutLoading ? "Opening secure checkout…" : configurationState === "loading" ? "Checking secure checkout…" : !checkoutAvailable ? "Subscription checkout unavailable" : !authenticated ? "Sign in to subscribe" : `Continue with ${interval} billing`}</button>
        {!isPremium && !checkoutAvailable ? <p className="premiumCheckoutAvailability" role={configurationState === "error" ? "alert" : "status"}>{checkoutUnavailableMessage(configuration, configurationState)}</p> : null}
        {checkoutError ? <p className="premiumCheckoutError" role="alert">{checkoutError}</p> : null}
        <small>Recurring billing. Cancel through account settings. Access continues until the end of the paid period after cancellation.</small>
      </article>
    </div>

    <section className="premiumComparisonCard" aria-labelledby="pricing-comparison-title"><header className="premiumComparisonHeader"><div><span>Concise comparison</span><h2 id="pricing-comparison-title">Free starts the loop. Plus keeps it living.</h2></div></header><div className="premiumCompareTable"><div className="premiumCompareHead"><div>Feature</div><div>Free</div><div>Plus</div></div>{comparison.map(([feature, free, plus]) => <div className="premiumCompareRow" key={feature}><div className="premiumCompareFeature">{feature}</div><div>{free}</div><div className="premiumCompareYes">{plus}</div></div>)}</div></section>

    <section className="premiumComparisonCard" aria-labelledby="paid-preview-title"><header className="premiumComparisonHeader"><div><span>Illustrative example · Read-only</span><h2 id="paid-preview-title">Preview one complete weekly loop</h2><p>Fictional example-report data. It does not create or save a report, belong to the visitor, or enter training history.</p></div></header><div className="subscriptionPlanGrid"><FeatureAccessPreview feature={OPENINGFIT_FEATURES.WEEKLY_PLAN} eyebrow="Example main focus" title="Prepare against the Caro-Kann as White"><article><strong>Source review: ExamplePlayer vs PracticeOpponent</strong><small>Fictional Chess.com game · review available in the example only</small><p><strong>Saved plan:</strong> Complete development, support the centre and castle before choosing a structure-specific break.</p></article></FeatureAccessPreview><FeatureAccessPreview feature={OPENINGFIT_FEATURES.REPORT_COMPARISON} eyebrow="Example progress check" title="Not encountered again"><article><strong>No improvement claim</strong><small>The trained opening did not appear in the later comparable report, so the saved plan remains ready for the next occurrence.</small></article></FeatureAccessPreview></div></section>

    <section className="subscriptionBillingNotes"><h2>Clear subscription terms</h2><ul><li>Monthly and annual plans renew automatically until cancelled.</li><li>Cancellation is available through OpeningFit account settings.</li><li>Paid access remains available until the current paid period ends.</li><li>Existing lifetime members retain lifetime access.</li><li>Stripe processes payment details securely; OpeningFit does not receive card details.</li></ul></section>

    <section className="subscriptionFaq" aria-labelledby="subscription-faq-title"><span>FAQ</span><h2 id="subscription-faq-title">Before you subscribe</h2>{FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}<p><a href="/how-it-works">Read the analysis methodology, limits and confidence rules</a></p></section>
  </section>;
}
