import { useMemo } from "react";

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
      {!isPremium ? <span>Premium preview</span> : <span>Unlocked</span>}
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
    const strong = reliable.filter((item) => item.winRate >= 55).sort((a, b) => b.winRate - a.winRate);
    const weak = reliable.filter((item) => item.winRate < 45).sort((a, b) => a.winRate - b.winRate);

    return {
      best: strong[0] || reliable[0] || openings[0],
      weak: weak[0] || reliable[1] || openings[1],
      totalOpenings: openings.length,
    };
  }, [data]);

  if (!data) return null;

  const bestOpening = premiumInsights.best?.displayName || "your strongest opening";
  const weakOpening = premiumInsights.weak?.displayName || "your weakest opening area";

  return (
    <section className="premiumUpgradeShell" id="premium">
      <div className="premiumUpgradeHero">
        <div className="premiumUpgradeCopy">
          <div className="premiumUpgradeEyebrow">OpeningFit Premium</div>

          <h2>Stop guessing what openings to study.</h2>

          <p>
            Premium turns your imported games into a clear opening repertoire, weakness report
            and weekly training plan — built around how you actually play.
          </p>

          <div className="premiumHeroBullets">
            <span>✓ Full White and Black repertoire</span>
            <span>✓ Weakness detection from your own games</span>
            <span>✓ Weekly opening training plan</span>
          </div>
        </div>

        <div className="premiumPriceCard">
          <div className="premiumPriceTag">Early access</div>
          <div className="premiumPrice">£8</div>
          <p>One-time lifetime unlock while OpeningFit is still improving.</p>

          <button
            type="button"
            className="premiumCheckoutBtn"
            onClick={onFounderPass}
          >
            Unlock Premium
          </button>

          <button type="button" className="premiumDemoBtn" onClick={onUnlockDemo}>
            Unlock Premium Demo
          </button>

          <button type="button" className="premiumResetBtn" onClick={onResetDemo}>
            Reset Free Preview
          </button>

          <small>
            {isPremium ? "Premium demo is currently unlocked." : "Login first, then continue to secure Stripe checkout."}
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
          title="Full repertoire builder"
          text={`Build a practical White and Black repertoire around ${bestOpening}, instead of jumping between random openings.`}
        />

        <LockedPreview
          isPremium={isPremium}
          title="Opening weakness report"
          text={`Find where your results drop, starting with ${weakOpening}, then get a clear fix instead of just another chart.`}
        />

        <LockedPreview
          isPremium={isPremium}
          title="Weekly training plan"
          text="Get a narrow 5-day study plan using your real games, so you know exactly what to review next."
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
            <h3>Keep the free version useful. Make Premium genuinely actionable.</h3>
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
          <FeatureRow label="Full repertoire builder" free={false} premium="Unlocked" />
          <FeatureRow label="Opening weakness detection" free={false} premium="Unlocked" />
          <FeatureRow label="Weekly training plan" free={false} premium="Unlocked" />
          <FeatureRow label="Saved progress history" free={false} premium="Coming soon" />
        </div>
      </div>

      <div className="premiumFinalCta">
        <div>
          <h3>Premium should feel like a coach, not just more stats.</h3>
          <p>
            This is the version to test with users before connecting Stripe. If people say
            “I would pay for that”, then payments are worth adding.
          </p>
        </div>

        <button type="button" onClick={onUnlockDemo}>
          Test Premium Demo
        </button>
      </div>
    </section>
  );
}
