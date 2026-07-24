import { useEffect, useMemo, useState } from "react";
import { loadBillingConfiguration } from "../accountApi.js";
import { annualEffectiveMonthly, DEFAULT_BILLING_CONFIGURATION, formatGbp, normaliseBillingConfiguration } from "../lib/premiumExperience.js";
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
  ["How many games are analysed?", "The number depends on public game activity, filters and valid opening records. Each import considers at most 300 eligible games. Free can request up to 3 months of history; Plus can request up to 12 months."],
  ["Is the Fit Score a chess rating?", "No. It is a personalised indicator combining supported opening results, familiarity, consistency and repertoire suitability. It is not an official chess rating."],
];

function BillingToggle({ value, onChange, monthlyAvailable, annualAvailable }) {
  return <fieldset className="subscriptionBillingToggle"><legend>Billing interval</legend><label className={value === "monthly" ? "isSelected" : ""}><input type="radio" name="billing-interval" value="monthly" checked={value === "monthly"} disabled={!monthlyAvailable} onChange={() => onChange("monthly")} /><span>Monthly</span></label><label className={value === "annual" ? "isSelected" : ""}><input type="radio" name="billing-interval" value="annual" checked={value === "annual"} disabled={!annualAvailable} onChange={() => onChange("annual")} /><span>Annual</span><strong>Best value</strong></label></fieldset>;
}

export default function PremiumPanel({ isPremium, entitlement, authenticated = false, onFounderPass, checkoutLoading = false, checkoutError = "" }) {
  const [interval, setInterval] = useState("annual");
  const [configuration, setConfiguration] = useState(DEFAULT_BILLING_CONFIGURATION);
  const [configurationState, setConfigurationState] = useState("loading");
  const [analysisContract, setAnalysisContract] = useState(DEFAULT_PUBLIC_ANALYSIS_CONTRACT);

  useEffect(() => {
    void trackProductEvent("pricing_viewed", { source: "pricing_page", authenticated }, { onceKey: "subscription_pricing" });
    let active = true;
    loadBillingConfiguration().then((value) => { if (!active) return; const next = normaliseBillingConfiguration(value); setConfiguration(next); setInterval(next.annual.available ? "annual" : "monthly"); setConfigurationState("ready"); }).catch(() => { if (active) setConfigurationState("error"); });
    loadPublicAnalysisContract().then((value) => { if (active) setAnalysisContract(value); }).catch(() => {});
    return () => { active = false; };
  }, [authenticated]);

  const effectiveMonthly = annualEffectiveMonthly(configuration);
  const founding = configuration.foundingOffer.enabled;
  const selected = configuration[interval];
  const selectedAmount = interval === "annual" && founding ? configuration.foundingOffer.firstYearAmount : selected.amount;
  const checkoutAvailable = configurationState === "ready" && selected.available;
  const lifetime = entitlement?.accessType === "lifetime" && entitlement?.hasPremiumAccess;
  const priceSummary = useMemo(() => interval === "monthly"
    ? `${formatGbp(selectedAmount)} per month`
    : founding ? `${formatGbp(selectedAmount)} for the first year` : `${formatGbp(selectedAmount)} per year`, [founding, interval, selectedAmount]);

  const changeInterval = (next) => {
    setInterval(next);
    void trackProductEvent("billing_interval_changed", { source: "pricing_page", authenticated, billingInterval: next });
  };

  const checkout = () => onFounderPass?.("pricing_page", interval);
  const comparison = publicFeatureComparison(analysisContract);

  return <section className="premiumUpgradeShell subscriptionPricing" id="premium-offer" aria-labelledby="pricing-title">
    <header className="subscriptionPricingHero"><span>OpeningFit Plus</span><h1 id="pricing-title">Keep improving after the first report.</h1><p>Maintain a living repertoire, train the recurring problems found in your games, and see what changes between reports.</p>{lifetime ? <strong className="subscriptionLifetimeNotice">Your lifetime access remains active.</strong> : null}</header>

    <div className="subscriptionPlanGrid">
      <article className="subscriptionPlanCard subscriptionPlanCard--free"><span>Free</span><h2>£0</h2><p>A useful starting report—not an empty teaser.</p><ul><li>First report included</li><li>Basic OpeningFit Score and style</li><li>One Keep recommendation</li><li>One Repair recommendation</li><li>Refresh on demand, at least {analysisContract.freeRefreshMinutes} minutes apart</li><li>{analysisContract.freeWeeklyTasks}-task weekly training preview</li></ul><a className="secondaryBtn" href="/analyse">Analyse games</a></article>

      <article className="subscriptionPlanCard subscriptionPlanCard--plus"><header><div><span>OpeningFit Plus</span><h2>{priceSummary}</h2></div>{interval === "annual" ? <strong>Best value</strong> : null}</header>
        <BillingToggle value={interval} onChange={changeInterval} monthlyAvailable={configuration.monthly.available || configurationState !== "ready"} annualAvailable={configuration.annual.available || configurationState !== "ready"} />
        {interval === "annual" ? <p className="subscriptionEffectivePrice">Standard annual price {formatGbp(configuration.annual.amount)} · equivalent to {formatGbp(effectiveMonthly)} per month.</p> : <p className="subscriptionEffectivePrice">Flexible monthly billing at {formatGbp(configuration.monthly.amount)} per month.</p>}
        {interval === "annual" && founding ? <aside className="subscriptionFoundingOffer"><strong>Founding launch price</strong><p>{formatGbp(configuration.foundingOffer.firstYearAmount)} for the first year, then {formatGbp(configuration.foundingOffer.renewsAtAmount)} per year unless cancelled.</p></aside> : null}
        <ul><li>Living White and Black repertoire</li><li>Weekly personalised training from your games</li><li>Own-game opening drills</li><li>Progress between reports</li><li>Evidence of whether trained weaknesses recur</li><li>Saved reports and full recommendation evidence</li></ul>
        <button type="button" className="premiumCheckoutBtn" onClick={checkout} disabled={isPremium || checkoutLoading || !checkoutAvailable}>{isPremium ? lifetime ? "Lifetime access active" : "OpeningFit Plus active" : checkoutLoading ? "Opening secure checkout…" : configurationState === "loading" ? "Loading secure pricing…" : !checkoutAvailable ? "Checkout temporarily unavailable" : `Choose ${interval} billing`}</button>
        {configurationState === "error" ? <p className="premiumCheckoutError" role="alert">Secure pricing could not be loaded. No checkout was started.</p> : null}{checkoutError ? <p className="premiumCheckoutError" role="alert">{checkoutError}</p> : null}
        <small>Recurring billing. Cancel through account settings. Access continues until the end of the paid period after cancellation.</small>
      </article>
    </div>

    <section className="premiumComparisonCard" aria-labelledby="pricing-comparison-title"><header className="premiumComparisonHeader"><div><span>Concise comparison</span><h2 id="pricing-comparison-title">Free starts the loop. Plus keeps it living.</h2></div></header><div className="premiumCompareTable"><div className="premiumCompareHead"><div>Feature</div><div>Free</div><div>Plus</div></div>{comparison.map(([feature, free, plus]) => <div className="premiumCompareRow" key={feature}><div className="premiumCompareFeature">{feature}</div><div>{free}</div><div className="premiumCompareYes">{plus}</div></div>)}</div></section>

    <section className="premiumComparisonCard" aria-labelledby="paid-preview-title"><header className="premiumComparisonHeader"><div><span>Example data · Read-only</span><h2 id="paid-preview-title">Preview the paid workspace</h2><p>These are interface previews based on the fictional sample report. Viewing them does not create or save a report.</p></div></header><div className="subscriptionPlanGrid"><FeatureAccessPreview feature={OPENINGFIT_FEATURES.WEEKLY_PLAN} eyebrow="Example weekly plan" title="Repair one recurring French Defence branch"><article><strong>Replay the position after 1.e4 e6 2.d4 d5</strong><small>Example task · about 8 minutes · completion not saved</small></article></FeatureAccessPreview><FeatureAccessPreview feature={OPENINGFIT_FEATURES.REPORT_COMPARISON} eyebrow="Example comparison" title="Progress requires two comparable reports"><article><strong>Baseline shown—no improvement claim yet</strong><small>A dated earlier report for the same username, platform and filters is required.</small></article></FeatureAccessPreview></div></section>

    <section className="subscriptionBillingNotes"><h2>Clear subscription terms</h2><ul><li>Monthly and annual plans renew automatically until cancelled.</li><li>Cancellation is available through OpeningFit account settings.</li><li>Paid access remains available until the current paid period ends.</li><li>Existing lifetime members retain lifetime access.</li><li>Stripe processes payment details securely; OpeningFit does not receive card details.</li></ul></section>

    <section className="subscriptionFaq" aria-labelledby="subscription-faq-title"><span>FAQ</span><h2 id="subscription-faq-title">Before you subscribe</h2>{FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}<p><a href="/how-it-works">Read the analysis methodology, limits and confidence rules</a></p></section>
  </section>;
}
