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
}) {
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

          <h2>Go deeper when the free snapshot gives you a direction.</h2>

          <p>
            The free report gives the main verdict and first actions. Founder
            Pass adds the depth and convenience for players who want to track,
            filter, export, and refine a repertoire over time.
          </p>

          <div className="premiumHeroBullets">
            <span>✓ 12-month import and deeper history</span>
            <span>✓ Full opening table, advanced filters, and saved progress</span>
            <span>✓ Exportable study plan and full repertoire tools</span>
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
            Pricing
          </button>

          <button type="button" className="premiumDemoBtn" onClick={onUnlockDemo}>
            Preview deeper report
          </button>

          <button type="button" className="premiumResetBtn" onClick={onResetDemo}>
            Exit Preview
          </button>

          <small>
            {isPremium
              ? "Depth tools are unlocked for this report."
              : isPremiumPreview
              ? "Preview mode shows what Founder Pass adds. Real paid features stay locked until Stripe confirms access."
              : "Free gives the useful verdict. Founder Pass adds history, filtering, exports, and repertoire workflow."}
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
          isPreview={isPremiumPreview}
          title="Deeper history"
          text="Import up to 12 months so one recent streak does not distort the whole repertoire decision."
        />

        <LockedPreview
          isPremium={isPremium}
          isPreview={isPremiumPreview}
          title="Full filters and table"
          text="Use the full opening table and advanced filters to compare side, sample size, score, and confidence."
        />

        <LockedPreview
          isPremium={isPremium}
          isPreview={isPremiumPreview}
          title="Saved progress"
          text="Save reports, compare imports, and track whether your opening decisions are actually improving."
        />

        <LockedPreview
          isPremium={isPremium}
          isPreview={isPremiumPreview}
          title="Full repertoire tools"
          text={`Turn signals like ${bestOpening} and ${weakOpening} into an exportable study plan and clearer repertoire map.`}
        />
      </div>

      <div className="premiumComparisonCard">
        <div className="premiumComparisonHeader">
          <div>
            <span>Free vs Founder Pass</span>
            <h3>Free gives the wow moment. Founder Pass adds depth and workflow.</h3>
          </div>
        </div>

        <div className="premiumCompareTable">
          <div className="premiumCompareHead">
            <div>Feature</div>
            <div>Free</div>
            <div>Premium</div>
          </div>

          <FeatureRow label="Basic import" free="Included" premium="12 months" />
          <FeatureRow label="Main verdict" free="Included" premium="Deeper context" />
          <FeatureRow label="Top 3 actions" free="Included" premium="Full study plan" />
          <FeatureRow label="Opening recommendations" free="A few" premium="Full repertoire tools" />
          <FeatureRow label="Repertoire map" free="Basic map" premium="Full map and builder tools" />
          <FeatureRow label="Opening table" free="Limited" premium="Full table" />
          <FeatureRow label="Filters" free="Basic" premium="Advanced" />
          <FeatureRow label="Progress tracking" free="Preview" premium="Saved history" />
          <FeatureRow label="Exportable study plan" free="Not included" premium="Included" />
          <FeatureRow label="Later premium tools" free="Not included" premium="Stockfish, line mistakes, drills, PDF" />
        </div>
      </div>

      <div className="premiumFinalCta">
        <div>
          <h3>Founder Pass turns a useful snapshot into a long-term repertoire workflow.</h3>
          <p>
            Keep using the free verdict. Upgrade when you want deeper history,
            better filters, saved progress, and exportable study plans.
          </p>
        </div>

        <button type="button" onClick={onUnlockDemo}>
          Preview deeper report
        </button>
      </div>
    </section>
  );
}
