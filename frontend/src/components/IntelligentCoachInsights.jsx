import {
  buildLevelAwareRecommendation,
  collectOpenings,
  collectRatings,
  displayOpeningName,
  getBackendDataQuality,
  getBackendOpeningClassification,
  getOpeningGames,
  getOpeningScore,
  getSmartLevelAwareRecommendation,
  getSmartPlayerLevelProfile,
  safeNumber,
} from "./playerLevelLogic";

function getGameCount(data, openings) {
  const backendQuality = getBackendDataQuality(data);

  return (
    safeNumber(backendQuality?.games_checked, null) ??
    safeNumber(backendQuality?.gamesChecked, null) ??
    safeNumber(data?.gamesImported, null) ??
    safeNumber(data?.games_imported, null) ??
    safeNumber(data?.totalGames, null) ??
    safeNumber(data?.total_games, null) ??
    safeNumber(data?.gameCount, null) ??
    safeNumber(data?.game_count, null) ??
    openings.reduce((sum, item) => sum + getOpeningGames(item), 0)
  );
}

function normaliseConfidence(value) {
  if (!value) return null;

  const lower = String(value).toLowerCase();

  if (lower.includes("high")) return "High confidence";
  if (lower.includes("low")) return "Low confidence";
  if (lower.includes("medium")) return "Medium confidence";

  return String(value);
}

function analyseProfile(data) {
  const openings = collectOpenings(data, { includeUnknown: true });
  const knownOpenings = openings.filter((item) => !item.isUnknownOpening);
  const unknownOpenings = openings.filter((item) => item.isUnknownOpening);

  const rating = collectRatings(data);
  const band = getSmartPlayerLevelProfile(data);
  const levelAware = getSmartLevelAwareRecommendation(data);
  const backendQuality = getBackendDataQuality(data);
  const backendClassification = getBackendOpeningClassification(data);

  const gameCount = getGameCount(data, openings);

  const sortedByScore = [...knownOpenings].sort((a, b) => {
    const aScore = getOpeningScore(a) ?? -1;
    const bScore = getOpeningScore(b) ?? -1;

    if (bScore !== aScore) return bScore - aScore;
    return getOpeningGames(b) - getOpeningGames(a);
  });

  const sortedWeak = [...knownOpenings]
    .filter((item) => getOpeningGames(item) >= 2 && getOpeningScore(item) !== null)
    .sort((a, b) => (getOpeningScore(a) ?? 100) - (getOpeningScore(b) ?? 100));

  const best = sortedByScore[0] || null;
  const weak = sortedWeak[0] || null;

  const repeatOpenings =
    safeNumber(backendQuality?.repeat_openings, null) ??
    safeNumber(backendQuality?.repeatOpenings, null) ??
    knownOpenings.filter((item) => getOpeningGames(item) >= 3).length;

  const highVariety = knownOpenings.length >= 12 && repeatOpenings < knownOpenings.length * 0.45;
  const lowSample = gameCount < 30;
  const bestScore = getOpeningScore(best);
  const weakScore = getOpeningScore(weak);
  const auditTone = ["elite", "advanced", "strong"].includes(band.level);

  const confidence =
    normaliseConfidence(backendQuality?.confidence) ||
    (lowSample
      ? "Low confidence"
      : gameCount >= 80 && repeatOpenings >= 4
        ? "High confidence"
        : "Medium confidence");

  const backendUnknownCount =
    safeNumber(backendClassification?.unclassified_openings, null) ??
    safeNumber(backendClassification?.unclassifiedOpenings, null);

  const backendUnknownGames =
    safeNumber(backendClassification?.unclassified_games, null) ??
    safeNumber(backendClassification?.unclassifiedGames, null);

  const insights = [
    {
      title: levelAware.title,
      text: levelAware.summary,
    },
  ];

  const hasUnknown =
    (backendUnknownCount ?? unknownOpenings.length) > 0;

  if (hasUnknown) {
    insights.push({
      title: `${backendClassification?.display_label || backendClassification?.displayLabel || band.openingUnknownLabel} detected`,
      text:
        backendClassification?.explanation ||
        band.unknownExplanation,
    });
  }

  if (highVariety && band.level !== "elite" && band.level !== "advanced") {
    insights.push({
      title: "Too much opening variety",
      text:
        "The player appears to be switching openings often. That makes improvement harder because they keep reaching different middlegames. Recommend narrowing the repertoire.",
    });
  }

  if (lowSample) {
    insights.push({
      title: "Small sample warning",
      text:
        "There are not enough games to make strong claims yet. Present this as an early read, not a final verdict.",
    });
  }

  if (best && bestScore !== null) {
    insights.push({
      title: `Best current signal: ${displayOpeningName(best, data)}`,
      text:
        bestScore >= 65
          ? "This opening is performing well enough to treat as a real strength. Build the next study block around it."
          : "This is the best available signal, but the score is not dominant. It may be the best of a mixed set rather than a clear main weapon.",
    });
  }

  if (weak && weakScore !== null) {
    insights.push({
      title: auditTone
        ? `Review signal: ${displayOpeningName(weak, data)}`
        : `Weakest useful signal: ${displayOpeningName(weak, data)}`,
      text:
        auditTone
          ? "For a strong profile, treat this as a branch-level review target. Look for recurring loss structures, opponent pools, or recent trend changes before replacing the opening."
          : weakScore <= 40
            ? "This opening is costing points. The player should either simplify the line, study the first recurring mistake, or pause it for now."
            : "This is not disastrous, but it is the clearest place to look for improvement next.",
    });
  }

  return {
    rating: band.rating ?? rating,
    band,
    openings,
    knownOpenings,
    unknownOpenings,
    backendUnknownCount,
    backendUnknownGames,
    gameCount,
    repeatOpenings,
    highVariety,
    confidence,
    best,
    weak,
    bestScore,
    weakScore,
    insights: insights.slice(0, 5),
    nextAction: levelAware.primaryAction,
    source: levelAware.source,
  };
}

export default function IntelligentCoachInsights({ data }) {
  if (!data) return null;

  const profile = analyseProfile(data);

  return (
    <section className="intelligentCoachShell">
      <div className="intelligentCoachHeader">
        <div>
          <div className="intelligentCoachEyebrow">
            {profile.source === "backend" ? "Backend coach logic" : "Smarter coach logic"}
          </div>
          <h2>Player-specific diagnosis</h2>
          <p>
            This section adapts the advice based on rating level, sample size,
            opening variety, and whether unclassified openings look like messy
            setups, rare lines, or transpositions.
          </p>
        </div>

        <div className="coachConfidenceBadge">
          <strong>{profile.confidence}</strong>
          <span>
            {profile.rating ? `Estimated rating: ${profile.rating}` : "Rating not detected"}
          </span>
        </div>
      </div>

      <div className="coachProfileGrid">
        <article>
          <span>Player level</span>
          <strong>{profile.band.label}</strong>
          <p>{profile.band.headline}</p>
        </article>

        <article>
          <span>Games checked</span>
          <strong>{profile.gameCount || "Unknown"}</strong>
          <p>
            {profile.gameCount >= 80
              ? "Enough games for a stronger pattern read."
              : "More games will make the recommendation sharper."}
          </p>
        </article>

        <article>
          <span>Opening spread</span>
          <strong>
            {profile.knownOpenings.length} known
          </strong>
          <p>
            {(profile.backendUnknownCount ?? profile.unknownOpenings.length)
              ? `${profile.backendUnknownCount ?? profile.unknownOpenings.length} ${profile.band.openingUnknownLabel.toLowerCase()} item${(profile.backendUnknownCount ?? profile.unknownOpenings.length) === 1 ? "" : "s"} found.`
              : `${profile.repeatOpenings} openings appear repeatedly enough to study.`}
          </p>
        </article>
      </div>

      <div className="coachInsightList">
        {profile.insights.map((item) => (
          <article key={item.title} className="coachInsightCard">
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>

      <div className="coachNextAction">
        <span>Recommended next action</span>
        <strong>{profile.nextAction}</strong>
      </div>
    </section>
  );
}
