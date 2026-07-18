import { useEffect, useMemo, useState } from "react";
import { loadBillingConfiguration } from "../accountApi.js";
import { annualEffectiveMonthly, DEFAULT_BILLING_CONFIGURATION, formatGbp, normaliseBillingConfiguration } from "../lib/premiumExperience.js";
import { trackProductEvent } from "../lib/productAnalytics.js";
import "./PremiumPanelSubscriptions.css";

const COMPARISON = [
  ["Opening report", "One useful report", "Ongoing reports"],
  ["OpeningFit Score and style", "Included", "Included"],
  ["Keep recommendations", "One", "Full evidence"],
  ["Repair recommendations", "One", "Full evidence"],
  ["Report refresh", "Limited", "Automatic or on demand, with fair-use limits"],
  ["Game history analysed", "Up to 3 months", "Up to 12 months"],
  ["Repertoire", "Report preview", "Living saved repertoire"],
  ["Weekly training", "One-task preview", "Personal plan from your games"],
  ["Progress", "—", "Report comparison and training outcomes"],
];

const FAQ = [
  ["Can I cancel?", "Yes. You can cancel through account settings, which opens Stripe’s secure subscription portal."],
  ["What happens after cancellation?", "Recurring billing stops and paid access continues until the end of the period you already paid for. Your saved data is retained, but paid workspaces become unavailable after that date unless you resubscribe."],
  ["Does this replace Chess.com analysis?", "No. OpeningFit is a focused opening-repertoire and training companion. It does not replace full-game engine analysis or Chess.com’s broader analysis tools."],
  ["Which platforms are supported?", "OpeningFit currently analyses public Chess.com and Lichess games."],
  ["What happens to lifetime access?", "Existing lifetime members keep lifetime access. A subscription launch does not convert or expire a lifetime entitlement."],
  ["How many games are analysed?", "The number depends on your public game activity and supported time controls. Free analyses up to 3 months of history; Plus analyses up to 12 months, subject to sensible service limits."],
  ["Is the Fit Score a chess rating?", "No. It is a personalised indicator combining supported opening results, familiarity, consistency and repertoire suitability. It is not an official chess rating."],
];

function BillingToggle({ value, onChange, monthlyAvailable, annualAvailable }) {
  return <fieldset className="subscriptionBillingToggle"><legend>Billing interval</legend><label className={value === "monthly" ? "isSelected" : ""}><input type="radio" name="billing-interval" value="monthly" checked={value === "monthly"} disabled={!monthlyAvailable} onChange={() => onChange("monthly")} /><span>Monthly</span></label><label className={value === "annual" ? "isSelected" : ""}><input type="radio" name="billing-interval" value="annual" checked={value === "annual"} disabled={!annualAvailable} onChange={() => onChange("annual")} /><span>Annual</span><strong>Best value</strong></label></fieldset>;
}

export default function PremiumPanel({ isPremium, entitlement, authenticated = false, onFounderPass, checkoutLoading = false, checkoutError = "" }) {
  const [interval, setInterval] = useState("annual");
  const [configuration, setConfiguration] = useState(DEFAULT_BILLING_CONFIGURATION);
  const [configurationState, setConfigurationState] = useState("loading");

  useEffect(() => {
    void trackProductEvent("pricing_viewed", { source: "pricing_page", authenticated }, { onceKey: "subscription_pricing" });
    let active = true;
    loadBillingConfiguration().then((value) => { if (!active) return; const next = normaliseBillingConfiguration(value); setConfiguration(next); setInterval(next.annual.available ? "annual" : "monthly"); setConfigurationState("ready"); }).catch(() => { if (active) setConfigurationState("error"); });
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

  return <section className="premiumUpgradeShell subscriptionPricing" id="premium-offer" aria-labelledby="pricing-title">
    <header className="subscriptionPricingHero"><span>OpeningFit Plus</span><h1 id="pricing-title">Keep improving after the first report.</h1><p>Maintain a living repertoire, train the recurring problems found in your games, and see what changes between reports.</p>{lifetime ? <strong className="subscriptionLifetimeNotice">Your lifetime access remains active.</strong> : null}</header>

    <div className="subscriptionPlanGrid">
      <article className="subscriptionPlanCard subscriptionPlanCard--free"><span>Free</span><h2>£0</h2><p>A useful starting report—not an empty teaser.</p><ul><li>Useful first report</li><li>Basic OpeningFit Score and style</li><li>One Keep recommendation</li><li>One Repair recommendation</li><li>Limited refreshes</li><li>Weekly training preview</li></ul><a className="secondaryBtn" href="/analyse">Analyse games</a></article>

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

    <section className="premiumComparisonCard" aria-labelledby="pricing-comparison-title"><header className="premiumComparisonHeader"><div><span>Concise comparison</span><h2 id="pricing-comparison-title">Free starts the loop. Plus keeps it living.</h2></div></header><div className="premiumCompareTable"><div className="premiumCompareHead"><div>Feature</div><div>Free</div><div>Plus</div></div>{COMPARISON.map(([feature, free, plus]) => <div className="premiumCompareRow" key={feature}><div className="premiumCompareFeature">{feature}</div><div>{free}</div><div className="premiumCompareYes">{plus}</div></div>)}</div></section>

    <section className="subscriptionBillingNotes"><h2>Clear subscription terms</h2><ul><li>Monthly and annual plans renew automatically until cancelled.</li><li>Cancellation is available through OpeningFit account settings.</li><li>Paid access remains available until the current paid period ends.</li><li>Existing lifetime members retain lifetime access.</li><li>Stripe processes payment details securely; OpeningFit does not receive card details.</li></ul></section>

    <section className="subscriptionFaq" aria-labelledby="subscription-faq-title"><span>FAQ</span><h2 id="subscription-faq-title">Before you subscribe</h2>{FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>
  </section>;
}
