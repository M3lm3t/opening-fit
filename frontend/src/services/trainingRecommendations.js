import { mergeWeakLines } from "./weakLineDetection";

const MIN_WEAK_LINE_GAMES = 5;

function safeNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function openingName(item) {
  return (
    item?.name ||
    item?.opening ||
    item?.openingName ||
    item?.opening_name ||
    item?.ecoName ||
    item?.eco_name ||
    "Unknown opening"
  );
}

function openingGames(item) {
  return Math.max(0, safeNumber(item?.games ?? item?.count ?? item?.total, 0));
}

function openingWinRate(item) {
  const direct = item?.winRate ?? item?.win_rate ?? item?.score ?? item?.scoreRate ?? item?.fitScore;
  if (direct !== undefined && direct !== null && direct !== "") {
    const value = safeNumber(direct, 0);
    return Math.round(value <= 1 ? value * 100 : value);
  }

  const games = openingGames(item);
  const wins = safeNumber(item?.wins ?? item?.w, 0);
  const draws = safeNumber(item?.draws ?? item?.d, 0);
  if (!games) return 0;
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function collectOpenings(data = {}, fitData = null) {
  const source = [
    ...(Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []),
    ...(Array.isArray(data.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data.bestOpenings) ? data.bestOpenings : []),
    ...(Array.isArray(data.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data.topOpenings) ? data.topOpenings : []),
    ...(Array.isArray(data.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data.openingStats) ? data.openingStats : []),
    ...(Array.isArray(data.preferred_white) ? data.preferred_white : []),
    ...(Array.isArray(data.preferred_black) ? data.preferred_black : []),
  ];
  const byName = new Map();

  source.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const name = openingName(item);
    const key = name.toLowerCase();
    if (!name || key.includes("unknown")) return;
    const row = {
      opening: name,
      variation: item.variation || item.variationName || item.openingVariation || "",
      games: openingGames(item),
      winRate: openingWinRate(item),
      lossRate: safeNumber(item.lossRate ?? item.loss_rate, null),
      moveLine: item.moveLine || item.move_line || item.line || "",
      reason: item.fitExplanation || item.reason || item.fitConfidenceReason || "",
      source: "opening",
    };
    const current = byName.get(key);
    if (!current || row.games > current.games) byName.set(key, row);
  });

  return [...byName.values()].sort((a, b) => b.games - a.games);
}

function totalGames(data = {}) {
  return safeNumber(
    data.gamesImported ??
      data.games_imported ??
      data.totalGames ??
      data.total_games ??
      data.gamesAnalysed ??
      data.games_analyzed,
    0
  );
}

function asRecommendationFromWeakLine(line) {
  return {
    type: "weak-line",
    opening: line.opening,
    variation: line.variation || line.line || "Repeated variation",
    moveLine: line.moveLine,
    games: line.games,
    winRate: line.winRate,
    lossRate: line.lossRate,
    reason: "Low win rate across enough games",
    why: line.flagReason || "This is your most common weak line.",
    estimatedTime: "3-5 minutes",
    trainingTarget: line.trainingTarget || line.opening,
    rankScore: 500 + line.games * 4 + Math.max(0, 55 - line.winRate) * 5 + line.lossRate,
  };
}

function asRecommendationFromOpening(opening, fallback = false) {
  const lowRate = opening.winRate && opening.winRate < 50;
  return {
    type: fallback ? "fallback-opening" : "opening",
    opening: opening.opening,
    variation: opening.variation || "",
    moveLine: opening.moveLine || "",
    games: opening.games,
    winRate: opening.winRate || null,
    lossRate: opening.lossRate,
    reason: lowRate ? "Low win rate in a frequently played opening" : "This is one of your most played openings",
    why: lowRate
      ? "It has enough games to be worth a focused repair session."
      : "Training your most common opening gives the next import a cleaner signal.",
    estimatedTime: "3-5 minutes",
    trainingTarget: opening.opening,
    rankScore: opening.games * 5 + Math.max(0, 55 - (opening.winRate || 55)) * 3,
  };
}

export function buildTrainingRecommendations(data = null, fitData = null) {
  if (!data) {
    return {
      state: "no-data",
      primary: null,
      recommendations: [],
      message: "Import your games to unlock personalised training",
    };
  }

  const weakLines = mergeWeakLines(data)
    .filter((line) => safeNumber(line.games, 0) >= MIN_WEAK_LINE_GAMES)
    .map(asRecommendationFromWeakLine);
  const openings = collectOpenings(data, fitData);
  const openingRecs = openings
    .filter((opening) => opening.games >= 3)
    .map((opening) => asRecommendationFromOpening(opening));
  const recommendations = [...weakLines, ...openingRecs]
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 6);

  if (recommendations.length) {
    return {
      state: weakLines.length ? "personalised" : "fallback",
      primary: recommendations[0],
      recommendations,
      message: weakLines.length
        ? "Based on your recent games, this is the best thing to work on next."
        : "Build your first training plan from the openings you play most.",
    };
  }

  const mostPlayed = openings[0];
  if (mostPlayed || totalGames(data) > 0) {
    const fallback = mostPlayed ? asRecommendationFromOpening(mostPlayed, true) : null;
    return {
      state: "fallback",
      primary: fallback,
      recommendations: fallback ? [fallback] : [],
      message: "Build your first training plan",
    };
  }

  return {
    state: "no-data",
    primary: null,
    recommendations: [],
    message: "Import your games to unlock personalised training",
  };
}
