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
  return (
    <div className="premiumCompareRow">
      <div className="premiumCompareFeature">{label}</div>
      <div className={free ? "premiumCompareYes" : "premiumCompareNo"}>
        {free ? "Included" : "Limited"}
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
      {!isPremium ? <span>Premium feature</span> : <span>Unlocked</span>}
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

          <h2>Support early development and unlock deeper reports.</h2>

          <p>
            Founder Pass is early lifetime access to the deeper Opening Fit report:
            longer history, saved reports, full opening tables, and future premium tools.
          </p>

          <div className="premiumHeroBullets">
            <span>✓ Deeper White and Black repertoire view</span>
            <span>✓ More history behind each verdict</span>
            <span>✓ Saved reports and future premium features</span>
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
            Get Founder Pass
          </button>

          <button type="button" className="premiumDemoBtn" onClick={onUnlockDemo}>
            Preview deeper report
          </button>

          <button type="button" className="premiumResetBtn" onClick={onResetDemo}>
            Exit Preview
          </button>

          <small>
            {isPremium
              ? "Premium tools are available in this report."
              : "Opening Fit is still improving. Founder Pass helps fund development and gives you early access to premium features."}
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
          title="Deeper repertoire plan"
          text={`Use side-specific signals like ${bestOpening} to shape a more practical White and Black repertoire.`}
        />

        <LockedPreview
          isPremium={isPremium}
          title="Opening weakness report"
          text={`See where your results drop, starting with ${weakOpening}, and turn that into a specific review target.`}
        />

        <LockedPreview
          isPremium={isPremium}
          title="Weekly training plan"
          text="Get a narrow study plan using your real games, so the next review has a clear target."
        />

        <LockedPreview
          isPremium={isPremium}
          title="Progress tracking"
          text="Save your profile, re-import later, and see whether your opening results are actually improving."
        />
      </div>

      <div className="premiumComparisonCard">
        <div className="premiumComparisonHeader">
          <div>
            <span>Free vs Premium</span>
            <h3>Keep the free report useful. Make Founder Pass meaningfully deeper.</h3>
          </div>
        </div>

        <div className="premiumCompareTable">
          <div className="premiumCompareHead">
            <div>Feature</div>
            <div>Free</div>
            <div>Premium</div>
          </div>

          <FeatureRow label="Import Chess.com / Lichess games" free premium="Included" />
          <FeatureRow label="Basic style profile" free premium="Included" />
          <FeatureRow label="Opening win-rate chart" free premium="Included" />
          <FeatureRow label="Keep / Improve / Avoid verdicts" free premium="Deeper verdicts" />
          <FeatureRow label="Deeper repertoire plan" free={false} premium="Unlocked" />
          <FeatureRow label="Opening weakness detection" free={false} premium="Unlocked" />
          <FeatureRow label="Weekly training plan" free={false} premium="Unlocked" />
          <FeatureRow label="Saved progress history" free={false} premium="Coming soon" />
        </div>
      </div>

      <div className="premiumFinalCta">
        <div>
          <h3>Founder Pass adds depth after the free report has shown value.</h3>
          <p>
            It is for deeper history, saved reports, fuller opening tables, and
            future tools as Opening Fit develops.
          </p>
        </div>

        <button type="button" onClick={onUnlockDemo}>
          Preview deeper report
        </button>
      </div>
    </section>
  );
}
