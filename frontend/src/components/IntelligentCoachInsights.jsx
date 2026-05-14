import {
  buildLevelAwareRecommendation,
  collectOpenings,
  collectRatings,
  displayOpeningName,
  getOpeningGames,
  getOpeningName,
  getOpeningScore,
  getPlayerLevelProfile,
  isUnknownOpeningName,
  safeNumber,
} from "./playerLevelLogic";

function getGameCount(data, openings) {
  return (
    safeNumber(data?.gamesImported, null) ??
    safeNumber(data?.games_imported, null) ??
    safeNumber(data?.totalGames, null) ??
    safeNumber(data?.total_games, null) ??
    safeNumber(data?.gameCount, null) ??
    safeNumber(data?.game_count, null) ??
    openings.reduce((sum, item) => sum + getOpeningGames(item), 0)
  );
}

function analyseProfile(data) {
  const openings = collectOpenings(data, { includeUnknown: true });
  const knownOpenings = openings.filter((item) => !item.isUnknownOpening);
  const unknownOpenings = openings.filter((item) => item.isUnknownOpening);

  const rating = collectRatings(data);
  const band = getPlayerLevelProfile(data);
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

  const repeatOpenings = knownOpenings.filter((item) => getOpeningGames(item) >= 3).length;
  const highVariety = knownOpenings.length >= 12 && repeatOpenings < knownOpenings.length * 0.45;
  const lowSample = gameCount < 30;
  const goodSample = gameCount >= 80;
  const bestScore = getOpeningScore(best);
  const weakScore = getOpeningScore(weak);

  let confidence = "Medium confidence";

  if (lowSample) confidence = "Low confidence";
  if (goodSample && repeatOpenings >= 4) confidence = "High confidence";
  if (band.level === "elite" && gameCount >= 100) confidence = "High confidence, advanced audit needed";

  const levelAware = buildLevelAwareRecommendation(data);

  const insights = [
    {
      title: levelAware.title,
      text: levelAware.summary,
    },
  ];

  if (unknownOpenings.length) {
    insights.push({
      title: `${band.openingUnknownLabel} detected`,
      text: band.unknownExplanation,
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
      title: `Weakest useful signal: ${displayOpeningName(weak, data)}`,
      text:
        weakScore <= 40
          ? "This opening is costing points. The player should either simplify the line, study the first recurring mistake, or pause it for now."
          : "This is not disastrous, but it is the clearest place to look for improvement next.",
    });
  }

  return {
    rating,
    band,
    openings,
    knownOpenings,
    unknownOpenings,
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
  };
}

export default function IntelligentCoachInsights({ data }) {
  if (!data) return null;

  const profile = analyseProfile(data);

  return (
    <section className="intelligentCoachShell">
      <div className="intelligentCoachHeader">
        <div>
          <div className="intelligentCoachEyebrow">Smarter coach logic</div>
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
          <strong>{profile.knownOpenings.length} known</strong>
          <p>
            {profile.unknownOpenings.length
              ? `${profile.unknownOpenings.length} ${profile.band.openingUnknownLabel.toLowerCase()} item${profile.unknownOpenings.length === 1 ? "" : "s"} found.`
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
