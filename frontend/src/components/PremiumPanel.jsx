import { useMemo } from "react";
import { getOpeningContext, getOpeningSignal } from "./OpeningEvidence";

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
  const freeIncluded = freeLabel === "Included";

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

function LockedPreview({ title, text, isPremium }) {
  return (
    <div className={isPremium ? "premiumPreviewCard unlocked" : "premiumPreviewCard locked"}>
      <div className="premiumPreviewIcon">{isPremium ? "✓" : "🔒"}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {!isPremium ? <span>Founder Pass unlock</span> : <span>Unlocked</span>}
    </div>
  );
}

export default function PremiumPanel({ data, isPremium, onUnlockDemo, onResetDemo, onFounderPass }) {
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

  if (!data) return null;

  const bestOpening = openingContextTitle(premiumInsights.best, "your strongest side-specific opening");
  const weakOpening = openingContextTitle(premiumInsights.weak, "your weakest side-specific opening area");

  return (
    <section className="premiumUpgradeShell" id="premium-offer">
      <div className="premiumUpgradeHero">
        <div className="premiumUpgradeCopy">
          <div className="premiumUpgradeEyebrow">Founder Pass</div>

          <h2>Unlock your full repertoire audit.</h2>

          <p>
            Turn your recent games into a practical opening plan. Founder Pass
            shows which openings to keep, improve, or drop with colour-split
            verdicts and confidence scoring.
          </p>

          <div className="premiumHeroBullets">
            <span>✓ Full White / Black repertoire audit</span>
            <span>✓ Keep / Improve / Avoid verdicts with confidence</span>
            <span>✓ Weak spot diagnosis and 7-day training plan</span>
          </div>
        </div>

        <div className="premiumPriceCard">
          <div className="premiumPriceTag">Early lifetime access</div>
          <div className="premiumPrice">£8</div>
          <p>Support Opening Fit while it is still early.</p>

          <button
            type="button"
            className="premiumCheckoutBtn"
            onClick={onFounderPass}
          >
            Unlock Founder Pass
          </button>

          <button type="button" className="premiumDemoBtn" onClick={onUnlockDemo}>
            Preview deeper report
          </button>

          <button type="button" className="premiumResetBtn" onClick={onResetDemo}>
            Exit Preview
          </button>

          <small>
            {isPremium
              ? "Your full repertoire audit is unlocked for this report."
              : "Free shows the snapshot. Founder Pass unlocks the decision layer: what to keep, what to improve, and what to drop."}
          </small>
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
          title="Full repertoire audit"
          text={`Use side-specific signals like ${bestOpening} to decide what belongs in your White and Black repertoire.`}
        />

        <LockedPreview
          isPremium={isPremium}
          title="Weak spot diagnosis"
          text={`See where your results drop, starting with ${weakOpening}, and turn that into a specific review target.`}
        />

        <LockedPreview
          isPremium={isPremium}
          title="7-day training plan"
          text="Turn your recent games into a practical opening plan with one target, one metric, and seven clear actions."
        />

        <LockedPreview
          isPremium={isPremium}
          title="Saved report history"
          text="Save your profile, re-import later, and see whether your opening decisions are improving."
        />
      </div>

      <div className="premiumComparisonCard">
        <div className="premiumComparisonHeader">
          <div>
            <span>Free vs Founder Pass</span>
            <h3>Free shows the snapshot. Founder Pass unlocks better decisions.</h3>
          </div>
        </div>

        <div className="premiumCompareTable">
          <div className="premiumCompareHead">
            <div>Feature</div>
            <div>Free</div>
            <div>Premium</div>
          </div>

          <FeatureRow label="Quick opening snapshot" free="Included" premium="Included" />
          <FeatureRow label="Recent game import" free="Limited" premium="12 months" />
          <FeatureRow label="Basic top openings" free="Included" premium="Full context" />
          <FeatureRow label="Basic recommendation" free="Included" premium="Decision-ready plan" />
          <FeatureRow label="White / Black split" free="Limited" premium="Full audit" />
          <FeatureRow label="Keep / Improve / Avoid verdicts" free="Limited" premium="Confidence-scored" />
          <FeatureRow label="Weak spot diagnosis" free="Limited" premium="Unlocked" />
          <FeatureRow label="7-day training plan" free="Limited" premium="Unlocked" />
          <FeatureRow label="Saved report history" free="Limited" premium="Unlocked" />
          <FeatureRow label="Future deeper analysis features" free="Limited" premium="Included" />
        </div>
      </div>

      <div className="premiumFinalCta">
        <div>
          <h3>Founder Pass turns the snapshot into a repertoire audit.</h3>
          <p>
            Unlock your full repertoire audit, see which openings to keep,
            improve, or drop, and turn your recent games into a practical
            opening plan.
          </p>
        </div>

        <button type="button" onClick={onUnlockDemo}>
          Preview deeper report
        </button>
      </div>
    </section>
  );
}
