import { useMemo } from "react";
import { getOpeningContext, getOpeningSignal } from "./OpeningEvidence";
import { PREMIUM_DISPLAY_PRICE, premiumFeatureStructure } from "../lib/premiumExperience";

function getOpeningName(item) {
  return (
    item?.opening ||
    item?.name ||
    item?.ecoName ||
    item?.opening_name ||
    item?.label ||
    "Unknown opening"
  );
}

function getGames(item) {
  return Number(item?.games ?? item?.count ?? item?.total ?? 0);
}

function getWinRate(item) {
  const direct = item?.winRate ?? item?.win_rate ?? item?.score;

  if (typeof direct === "number") {
    return direct > 1 ? Math.round(direct) : Math.round(direct * 100);
  }

  const games = getGames(item);
  const wins = Number(item?.wins ?? item?.w ?? 0);
  const draws = Number(item?.draws ?? item?.d ?? 0);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function collectOpenings(data) {
  const possible =
    data?.openingStats ||
    data?.openings ||
    data?.topOpenings ||
    data?.verdicts ||
    data?.opening_win_rates ||
    data?.openingWinRates ||
    [];

  if (Array.isArray(possible)) return possible;

  if (possible && typeof possible === "object") {
    return Object.entries(possible).map(([name, value]) => ({
      name,
      ...(typeof value === "object" ? value : { games: value }),
    }));
  }

  return [];
}

function isUnknownOpening(name) {
  const normalised = String(name || "").trim().toLowerCase();

  return (
    !normalised ||
    normalised === "unknown" ||
    normalised === "unknown opening" ||
    normalised.includes("uncommon opening")
  );
}

function canUseAsRepertoire(item) {
  if (!item) return false;
  const context = getOpeningContext(item);
  const signal = getOpeningSignal(item);
  return context.canRecommend && signal.canBePrimary;
}

function openingContextTitle(item, fallback = "your strongest side-specific opening") {
  if (!item) return fallback;

  const name = item.displayName || getOpeningName(item);
  const context = getOpeningContext(item);

  if (context.type === "white") return `${name} as White`;
  if (context.type === "black") return `${name} as Black`;
  if (context.type === "faced") return `${name} you faced`;
  return `${name} (mixed signal)`;
}

function FeatureRow({ label, free, premium }) {
  const freeLabel = free === true ? "Included" : free || "Limited";
  const freeIncluded = !/not included/i.test(freeLabel);

  return (
    <div className="premiumCompareRow">
      <div className="premiumCompareFeature">{label}</div>
      <div className={freeIncluded ? "premiumCompareYes" : "premiumCompareNo"}>
        {freeLabel}
      </div>
      <div className="premiumCompareYes">{premium}</div>
    </div>
  );
}

function LockedPreview({ title, text, isPremium, isPreview = false }) {
  const visible = isPremium || isPreview;
  return (
    <div className={visible ? "premiumPreviewCard unlocked" : "premiumPreviewCard locked"}>
      <div className="premiumPreviewIcon">{visible ? "✓" : "🔒"}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {!visible ? <span>Founder Pass unlock</span> : <span>{isPremium ? "Unlocked" : "Preview"}</span>}
    </div>
  );
}

export default function PremiumPanel({
  data,
  isPremium,
  isPremiumPreview = false,
  onUnlockDemo,
  onResetDemo,
  onFounderPass,
  checkoutLoading = false,
  checkoutError = "",
}) {
  const handleFounderPass = (event) => {
    event.stopPropagation();
    onFounderPass?.("premium_page");
  };

  const founderValueBullets = [
    "Save every report",
    "Compare progress over time",
    "Track weak lines",
    "Get a personal repertoire plan",
    "Review weekly improvement",
  ];
  const founderTrustItems = [
    "Built for club players",
    "One-time early supporter access",
    "No theory overload",
  ];

  const premiumInsights = useMemo(() => {
    const openings = collectOpenings(data)
      .map((item) => ({
        ...item,
        displayName: getOpeningName(item),
        games: getGames(item),
        winRate: getWinRate(item),
      }))
      .filter((item) => !isUnknownOpening(item.displayName))
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        return b.winRate - a.winRate;
      });

    const reliable = openings.filter((item) => item.games >= 2);
    const repertoireReliable = reliable.filter(canUseAsRepertoire);
    const strong = reliable.filter((item) => item.winRate >= 55).sort((a, b) => b.winRate - a.winRate);
    const weak = reliable.filter((item) => item.winRate < 45).sort((a, b) => a.winRate - b.winRate);

    return {
      best: strong.find(canUseAsRepertoire) || repertoireReliable[0] || strong[0] || reliable[0] || openings[0],
      weak: weak.find(canUseAsRepertoire) || repertoireReliable[1] || weak[0] || reliable[1] || openings[1],
      totalOpenings: openings.length,
    };
  }, [data]);

  const featureStructure = premiumFeatureStructure();

  const bestOpening = openingContextTitle(premiumInsights.best, "your strongest side-specific opening");
  const weakOpening = openingContextTitle(premiumInsights.weak, "your weakest side-specific opening area");

  return (
    <section className="premiumUpgradeShell" id="premium-offer">
      <div className="premiumUpgradeHero">
        <div className="premiumUpgradeCopy">
          <div className="premiumUpgradeEyebrow">Founder Pass</div>

          <h2>Turn one report into a repertoire improvement loop.</h2>

          <p>
            Founder Pass helps you see which openings are improving, track weak
            lines over time, save every report, and turn your analysis into a
            personal repertoire plan.
          </p>

          <div className="premiumHeroBullets">
            {founderValueBullets.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          <div className="premiumUpgradeTrust" aria-label="Founder Pass principles">
            {founderTrustItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="premiumPriceCard">
          <div className="premiumPriceTag">One-time Founder Pass</div>
          <div className="premiumPrice">{PREMIUM_DISPLAY_PRICE}</div>
          <p>One-time early-supporter purchase for the currently listed features.</p>

          <div className="premiumPriceMiniStats">
            <span>Saved reports</span>
            <span>Progress comparisons</span>
            <span>Weak-line tracking</span>
          </div>

          <button
            type="button"
            className="premiumCheckoutBtn"
            data-founder-pass-direct="true"
            onClick={handleFounderPass}
            disabled={isPremium || checkoutLoading}
          >
            {isPremium
              ? "Founder Pass active"
              : checkoutLoading
                ? "Opening secure checkout..."
                : `Get Founder Pass for ${PREMIUM_DISPLAY_PRICE}`}
          </button>

          {checkoutError ? <p className="premiumCheckoutError" role="alert">{checkoutError}</p> : null}

          {import.meta.env.DEV ? <button type="button" className="premiumDemoBtn" onClick={onUnlockDemo}>Preview deeper report</button> : null}
          {import.meta.env.DEV ? <button type="button" className="premiumResetBtn" onClick={onResetDemo}>Exit Preview</button> : null}

          <small>
            {isPremium
              ? "Saved reports, progress comparisons, and deeper repertoire tools are active."
              : isPremiumPreview
              ? "Preview mode shows what Founder Pass adds. Real paid features stay locked until Stripe confirms access."
              : "Free gives the useful verdict. Founder Pass adds saved comparisons, weak-line tracking, and repertoire planning."}
          </small>
          <p>Requires an OpeningFit account. Stripe processes payment securely; OpeningFit does not receive your card details. Access is verified after you return.</p>
          <p>Questions or refund requests: <a href="mailto:support@openingfit.com">support@openingfit.com</a>.</p>
        </div>
      </div>

      <div className="premiumInsightStrip">
        <div>
          <span>Best opening to build around</span>
          <strong>{bestOpening}</strong>
        </div>

        <div>
          <span>Biggest opening leak</span>
          <strong>{weakOpening}</strong>
        </div>

        <div>
          <span>Openings detected</span>
          <strong>{premiumInsights.totalOpenings || "Analysing"}</strong>
        </div>
      </div>

      <div className="premiumPreviewGrid">
        <LockedPreview
          isPremium={isPremium}
          isPreview={isPremiumPreview}
          title="Progress over time"
          text="Save reports and compare whether your openings, weak lines, and repertoire score are improving."
        />

        <LockedPreview
          isPremium={isPremium}
          isPreview={isPremiumPreview}
          title="Deeper opening analysis"
          text="Use the full opening table to compare side, sample size, score, confidence, and recommendation labels."
        />

        <LockedPreview
          isPremium={isPremium}
          isPreview={isPremiumPreview}
          title="Weak line tracking"
          text="See repeated weak lines and turn them into focused training targets when the data is available."
        />

        <LockedPreview
          isPremium={isPremium}
          isPreview={isPremiumPreview}
          title="Personal repertoire plan"
          text={`Turn signals like ${bestOpening} and ${weakOpening} into an exportable study plan and clearer repertoire map.`}
        />
      </div>

      <div className="premiumComparisonCard">
        <div className="premiumComparisonHeader">
          <div>
            <span>Free vs Founder Pass</span>
            <h3>Free gives the first verdict. Founder Pass tracks whether the plan is working.</h3>
          </div>
        </div>

        <div className="premiumCompareTable">
          <div className="premiumCompareHead">
            <div>Feature</div>
            <div>Free</div>
            <div>Premium</div>
          </div>

          {featureStructure.premium.map((feature, index) => <FeatureRow key={feature} label={feature} free={featureStructure.free[index] || "Limited"} premium="Included" />)}
        </div>
      </div>

      <div className="premiumFinalCta">
        <div>
          <h3>Founder Pass turns a useful snapshot into progress you can compare.</h3>
          <p>
            Keep using the free verdict. Upgrade when you want saved reports,
            weak-line tracking, progress comparisons, and a personal repertoire plan.
          </p>
        </div>

        <button type="button" data-founder-pass-direct="true" onClick={handleFounderPass} disabled={isPremium || checkoutLoading}>
          {isPremium ? "Founder Pass active" : checkoutLoading ? "Opening checkout..." : `Get Founder Pass - ${PREMIUM_DISPLAY_PRICE}`}
        </button>
        {import.meta.env.DEV ? <button type="button" onClick={onUnlockDemo}>Preview deeper report</button> : null}
      </div>
    </section>
  );
}
