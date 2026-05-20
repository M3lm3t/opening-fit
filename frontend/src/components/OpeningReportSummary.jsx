import { getPlayerLevelText } from "./playerLevelLogic";

function normaliseOpeningName(opening) {
  if (!opening) return "Unknown opening";

  if (typeof opening === "string") return opening;

  return (
    opening.name ||
    opening.opening ||
    opening.eco ||
    opening.label ||
    "Unknown opening"
  );
}

function getGames(opening) {
  return Number(
    opening?.games ??
      opening?.count ??
      opening?.total ??
      opening?.played ??
      0
  );
}

function getWinRate(opening) {
  const direct = opening?.winRate ?? opening?.win_rate ?? opening?.score ?? opening?.percentage;

  if (direct !== undefined && direct !== null && !Number.isNaN(Number(direct))) {
    const value = Number(direct);
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
  }

  const wins = Number(opening?.wins ?? opening?.won ?? 0);
  const draws = Number(opening?.draws ?? opening?.drawn ?? 0);
  const games = getGames(opening);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function getConfidenceLabel(opening) {
  return (
    opening?.confidenceLabel ||
    opening?.confidence_label ||
    opening?.confidence ||
    (getGames(opening) <= 2
      ? "Too little data"
      : getGames(opening) < 8
        ? "Low confidence"
        : "Medium confidence")
  );
}

function getComparisonText(opening, data) {
  if (opening?.comparisonText || opening?.comparison_text) {
    return opening.comparisonText || opening.comparison_text;
  }

  const average = Number(data?.averageOpeningScore ?? data?.average_opening_score);
  const winRate = getWinRate(opening);

  if (!average || !winRate) return "Average comparison unavailable.";

  const delta = Math.round((winRate - average) * 10) / 10;

  if (delta > 0) return `${delta} points above your imported-game average.`;
  if (delta < 0) return `${Math.abs(delta)} points below your imported-game average.`;
  return "Matches your imported-game average.";
}

function getReason(opening, data) {
  if (opening?.verdictReason || opening?.verdict_reason) {
    return opening.verdictReason || opening.verdict_reason;
  }

  const games = getGames(opening);
  const confidence = getConfidenceLabel(opening).toLowerCase();

  if (games <= 2) return "This opening appears only once or twice, so the result is too noisy to judge.";
  if (confidence.includes("low")) return "The sample is still modest, so treat this as a provisional pattern.";
  return getComparisonText(opening, data);
}

function collectOpenings(data) {
  const candidates = [
    data?.topOpenings,
    data?.top_openings,
    data?.openingStats,
    data?.opening_stats,
    data?.openings,
    data?.openingTable,
    data?.opening_table,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
    if (item && typeof item === "object") return Object.values(item);
  }

  return [];
}

function getPlayerTier(data) {
  const rating = Number(
    data?.rating ??
      data?.chesscomRating ??
      data?.chesscom_rating ??
      data?.lichessRating ??
      data?.lichess_rating ??
      data?.rapidRating ??
      data?.rapid_rating ??
      data?.blitzRating ??
      data?.blitz_rating ??
      data?.bulletRating ??
      data?.bullet_rating ??
      data?.player_level?.rating ??
      data?.playerLevel?.rating ??
      0
  );
  const level = getPlayerLevelText(data).toLowerCase();
  const title = String(
    data?.title ??
      data?.chessTitle ??
      data?.chess_title ??
      data?.fideTitle ??
      data?.fide_title ??
      data?.playerTitle ??
      data?.player_title ??
      data?.profile?.title ??
      ""
  )
    .trim()
    .toLowerCase();
  const titledPlayer = ["gm", "im", "fm", "cm", "wgm", "wim", "wfm", "wcm"].includes(title);

  if (rating >= 2500 || titledPlayer || level.includes("master") || level.includes("elite")) {
    return "elite";
  }

  if (rating >= 2200 || level.includes("expert")) return "strong";
  if (rating >= 1600 || level.includes("advanced")) return "club";
  return "developing";
}

function getSampleTier(games) {
  const count = Number(games || 0);
  if (count >= 20) return "large";
  if (count >= 8) return "medium";
  if (count >= 3) return "small";
  return "tiny";
}

function getVerdict(opening, data, index = 0) {
  const existing = opening?.fitVerdict || opening?.fit_verdict || opening?.verdict || opening?.recommendation || opening?.status;
  const tier = getPlayerTier(data);
  const games = getGames(opening);
  const winRate = getWinRate(opening);
  const sampleTier = getSampleTier(games);
  const mainOpening = index <= 2 && games >= 8;

  if (sampleTier === "tiny") return "Too little data";
  if (games <= 4) return "Emerging pattern";
  if (games < 8) return "Needs more games before judging";

  if (existing) {
    const lower = String(existing).toLowerCase();

    if (
      lower.includes("too little data") ||
      lower.includes("emerging pattern") ||
      lower.includes("needs more games")
    ) {
      return String(existing);
    }

    if (lower.includes("keep") || lower.includes("core weapon") || lower.includes("trusted weapon")) {
      return mainOpening ? "Main weapon" : "Reliable choice";
    }

    if (lower.includes("improve") || lower.includes("fine-tune")) return "Promising but unstable";
    if (lower.includes("avoid") || lower.includes("review")) return "Needs review";

    return String(existing);
  }

  if (tier === "elite") {
    if (mainOpening && winRate >= 45) return "Main weapon";
    if (mainOpening) return "Needs review";
    if (sampleTier === "large" && winRate < 25) return "Needs review";
    if (winRate < 45) return "Promising but unstable";
    return "Reliable choice";
  }

  if (tier === "strong") {
    if (mainOpening && winRate >= 45) return "Main weapon";
    if (mainOpening && winRate >= 35) return "Promising but unstable";
    if (winRate < 40) return "Needs review";
    return "Reliable choice";
  }

  if (winRate >= 58) return "Reliable choice";
  if (winRate >= 45) return "Promising but unstable";
  if (mainOpening && winRate >= 35) return "Promising but unstable";
  return "Needs review";
}

function isStrongProfile(data) {
  const tier = getPlayerTier(data);
  return tier === "elite" || tier === "strong";
}

function getVerdictClass(verdict) {
  const lower = verdict.toLowerCase();

  if (lower.includes("keep")) return "reportVerdictKeep";
  if (lower.includes("core") || lower.includes("trusted")) return "reportVerdictKeep";
  if (lower.includes("avoid")) return "reportVerdictAvoid";
  if (
    lower.includes("improve") ||
    lower.includes("review") ||
    lower.includes("fine") ||
    lower.includes("performance")
  ) {
    return "reportVerdictImprove";
  }

  return "reportVerdictWatch";
}

function getStyleLabel(data) {
  const label =
    data?.styleProfile?.label ||
    data?.style_profile?.label ||
    data?.styleLabel ||
    data?.style_label ||
    data?.playerStyle ||
    data?.player_style;

  if (label) return label;

  return "Practical attacker";
}

function getTotalGames(data, openings) {
  const direct =
    data?.gamesImported ??
    data?.games_imported ??
    data?.totalGames ??
    data?.total_games ??
    data?.games?.length;

  if (direct) return Number(direct);

  const openingTotal = openings.reduce((sum, opening) => sum + getGames(opening), 0);

  return openingTotal || 0;
}

function buildReportCards(openings, data) {
  const cleaned = openings
    .map((opening) => ({
      raw: opening,
      name: normaliseOpeningName(opening),
      games: getGames(opening),
      winRate: getWinRate(opening),
    }))
    .filter((opening) => {
      const name = opening.name.toLowerCase();
      return (
        opening.games > 0 &&
        !["unknown", "unknown opening", "uncommon opening"].includes(name)
      );
    })
    .sort((a, b) => b.games - a.games)
    .map((opening, index) => ({
      ...opening,
      verdict: getVerdict(opening.raw, data, index),
      confidenceLabel: getConfidenceLabel(opening.raw),
      comparisonText: getComparisonText(opening.raw, data),
      reason: getReason(opening.raw, data),
    }));

  const keep =
    cleaned
      .filter((opening) => opening.winRate >= 58 && opening.games >= 8)
      .sort((a, b) => b.winRate - a.winRate)[0] || cleaned[0];

  const improve =
    cleaned
      .filter((opening) => opening.winRate >= 42 && opening.winRate < 58 && opening.games >= 8)
      .sort((a, b) => b.games - a.games)[0] || cleaned[1];

  const avoid =
    cleaned
      .filter((opening) => opening.winRate < 42 && opening.games >= 8)
      .sort((a, b) => a.winRate - b.winRate)[0] || cleaned[2];

  return { keep, improve, avoid, cleaned };
}

export default function OpeningReportSummary({ data, username, platform }) {
  if (!data) return null;

  const openings = collectOpenings(data);
  const totalGames = getTotalGames(data, openings);
  const styleLabel = getStyleLabel(data);
  const { keep, improve, avoid, cleaned } = buildReportCards(openings, data);
  const strongProfile = isStrongProfile(data);

  const platformLabel =
    platform === "lichess"
      ? "Lichess"
      : platform === "chesscom"
        ? "Chess.com"
        : "Chess profile";

  const bestOpening = keep?.name || "your strongest repeated opening";
  const weakOpening = avoid?.name || "your lowest-scoring repeated opening";
  const focusOpening = improve?.name || bestOpening;

  return (
    <section className="openingReportShell">
      <div className="openingReportHero">
        <div>
          <p className="openingReportEyebrow">Opening report</p>
          <h2>Your personalised opening summary</h2>
          <p>
            {strongProfile
              ? `Based on ${totalGames || "your recent"} imported games${
                  username ? ` from ${platformLabel} user ${username}` : ""
                }, here is a repertoire audit of core openings and lines worth reviewing.`
              : `Based on ${totalGames || "your recent"} imported games${
                  username ? ` from ${platformLabel} user ${username}` : ""
                }, here is what looks strongest, what needs work, and what to avoid for now.`}
          </p>
        </div>

        <div className="openingReportScore">
          <span>{cleaned.length || "—"}</span>
          <small>tracked openings</small>
        </div>
      </div>

      <div className="openingInsightCard">
        <div className="openingInsightIcon">♟</div>
        <div>
          <h3>{styleLabel}</h3>
          <p>
            {strongProfile ? (
              <>
                Treat <strong>{bestOpening}</strong> as the stable reference point,
                then review <strong>{focusOpening}</strong> for recurring structures
                or move-order details before changing the repertoire.
              </>
            ) : (
              <>
                Your current profile suggests you should focus on openings that create
                clear plans quickly. Keep building around <strong>{bestOpening}</strong>,
                review <strong>{focusOpening}</strong>, and be careful with{" "}
                <strong>{weakOpening}</strong> until the results improve.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="openingReportGrid">
        <ReportCard
          title={keep?.verdict === "Keep" || keep?.verdict === "Reliable choice" || keep?.verdict === "Main weapon" ? "Keep playing" : "Track carefully"}
          opening={keep}
          fallbackTitle="Best repeated opening"
          fallbackText="Once more games are imported, this will show the opening that best fits your current results."
          type="keep"
        />

        <ReportCard
          title={improve?.verdict === "Improve" || improve?.verdict === "Promising but unstable" ? (strongProfile ? "Review next" : "Improve next") : "Build sample"}
          opening={improve}
          fallbackTitle={strongProfile ? "Main review target" : "Main study target"}
          fallbackText={
            strongProfile
              ? "This will highlight a core or recurring opening worth auditing for specific branches."
              : "This will highlight an opening with enough promise to keep, but enough weakness to study."
          }
          type="improve"
        />

        <ReportCard
          title={avoid?.verdict === "Avoid" || avoid?.verdict === "Needs review" ? (strongProfile ? "Check carefully" : "Needs review") : "Wait before judging"}
          opening={avoid}
          fallbackTitle={strongProfile ? "Trend to inspect" : "Risky opening"}
          fallbackText={
            strongProfile
              ? "This will flag openings where recent results deserve review before any repertoire decision."
              : "This will flag openings that are repeatedly costing you games or producing poor positions."
          }
          type="avoid"
        />
      </div>

      <div className="openingReportNextSteps">
        <div>
          <strong>Recommended next step</strong>
          <span>
            Study one opening at a time. Start with {focusOpening}, then compare
            your results after another batch of games.
          </span>
        </div>

        <div>
          <strong>Premium direction</strong>
          <span>
            A paid version should turn this into a deeper repertoire plan, with
            explanations, progress tracking, and study priorities.
          </span>
        </div>
      </div>
    </section>
  );
}

function ReportCard({ title, opening, fallbackTitle, fallbackText, type }) {
  const name = opening?.name || fallbackTitle;
  const games = opening?.games || 0;
  const winRate = opening?.winRate || 0;
  const verdict = opening?.verdict || title;
  const confidenceLabel = opening?.confidenceLabel || "Too little data";
  const comparisonText = opening?.comparisonText || "Average comparison unavailable.";
  const reason = opening?.reason || fallbackText;

  return (
    <article className={`openingReportCard openingReportCard-${type}`}>
      <div className="openingReportCardTop">
        <span>{title}</span>
        <em className={getVerdictClass(verdict)}>{verdict}</em>
      </div>

      <h3>{name}</h3>

      {opening ? (
        <>
          <div className="openingReportStats">
            <div>
              <strong>{games}</strong>
              <small>games</small>
            </div>

            <div>
              <strong>{winRate}%</strong>
              <small>score</small>
            </div>

            <div>
              <strong>{confidenceLabel}</strong>
              <small>confidence</small>
            </div>
          </div>

          <p>{reason}</p>
          <p className="openingReportEvidence">{comparisonText}</p>
        </>
      ) : (
        <p>{fallbackText}</p>
      )}
    </article>
  );
}
