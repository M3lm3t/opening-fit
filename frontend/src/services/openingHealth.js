function clampScore(value, fallback = 0) {
  const number = Number(String(value ?? "").replace("%", ""));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number <= 1 ? number * 100 : number)));
}

function getOpeningName(item) {
  if (typeof item === "string") return item;
  return (
    item?.name ||
    item?.opening ||
    item?.openingName ||
    item?.opening_name ||
    item?.ecoName ||
    item?.eco_name ||
    item?.label ||
    "Unknown opening"
  );
}

function isUnknownOpening(name) {
  const clean = String(name || "").trim().toLowerCase();
  return !clean || clean === "unknown" || clean === "unknown opening" || clean.includes("uncommon opening");
}

function getGames(item) {
  if (typeof item === "string") return 0;
  return Math.max(0, Number(item?.games ?? item?.count ?? item?.total ?? item?.game_count ?? 0) || 0);
}

function getWinRate(item) {
  if (!item || typeof item === "string") return 0;
  const direct = item.winRate ?? item.win_rate ?? item.score ?? item.scoreRate ?? item.score_rate;
  if (direct !== undefined && direct !== null && direct !== "") return clampScore(direct);

  const games = getGames(item);
  const wins = Number(item.wins ?? item.w ?? 0) || 0;
  const draws = Number(item.draws ?? item.d ?? 0) || 0;
  if (!games) return 0;
  return clampScore(((wins + draws * 0.5) / games) * 100);
}

function getTrend(item) {
  return clampScore(
    item?.recentWinRate ??
      item?.recent_win_rate ??
      item?.trendScore ??
      item?.trend_score ??
      item?.last30WinRate ??
      item?.last_30_win_rate,
    getWinRate(item)
  );
}

function getContext(item) {
  const raw = String(
    item?.context ||
      item?.bucket ||
      item?.side ||
      item?.colour ||
      item?.color ||
      item?.repertoireSide ||
      item?.repertoire_side ||
      item?.responseTo ||
      item?.response_to ||
      ""
  ).toLowerCase();
  const name = String(getOpeningName(item)).toLowerCase();

  if (raw.includes("white") || name.includes(" white ")) return "white";
  if (raw.includes("e4") || raw.includes("king pawn") || raw.includes("king's pawn")) return "blackVsE4";
  if (raw.includes("d4") || raw.includes("queen pawn") || raw.includes("queen's pawn")) return "blackVsD4";
  if (raw.includes("black")) return "blackVsE4";
  return "overall";
}

function collectSourceOpenings(data = {}, fitData = null) {
  const sources = [
    ...(Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []),
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.bestOpenings) ? data.bestOpenings : []),
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.topOpenings) ? data.topOpenings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openingStats) ? data.openingStats : []),
    ...(Array.isArray(data?.preferred_white) ? data.preferred_white.map((item) => ({ ...item, context: "white" })) : []),
    ...(Array.isArray(data?.preferredWhite) ? data.preferredWhite.map((item) => ({ ...item, context: "white" })) : []),
    ...(Array.isArray(data?.preferred_black) ? data.preferred_black.map((item) => ({ ...item, context: "black" })) : []),
    ...(Array.isArray(data?.preferredBlack) ? data.preferredBlack.map((item) => ({ ...item, context: "black" })) : []),
  ];
  const openingRates = data?.opening_win_rates || data?.openingWinRates || {};

  if (openingRates && typeof openingRates === "object" && !Array.isArray(openingRates)) {
    Object.entries(openingRates).forEach(([name, value]) => {
      sources.push({
        name,
        ...(value && typeof value === "object" ? value : { games: Number(value) || 0 }),
      });
    });
  }

  const merged = new Map();
  sources.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const name = getOpeningName(item);
    if (isUnknownOpening(name)) return;
    const context = getContext(item);
    const key = `${name.toLowerCase()}::${context}`;
    const games = getGames(item);
    const rating = clampScore(
      item.fitScore ??
        item.openingRating ??
        item.opening_rating ??
        item.healthScore ??
        item.score ??
        getWinRate(item)
    );
    const row = {
      name,
      context,
      games,
      winRate: getWinRate(item),
      trend: getTrend(item),
      consistency: clampScore(item.consistency ?? item.consistencyScore ?? item.consistency_score, games >= 8 ? 76 : games >= 3 ? 64 : 48),
      rating,
    };
    const current = merged.get(key);
    if (!current || row.games >= current.games) merged.set(key, row);
  });

  return [...merged.values()].sort((a, b) => b.games - a.games || b.rating - a.rating);
}

function weightedAverage(items, field, fallback = 0) {
  const usable = items.filter((item) => item.games > 0 || Number.isFinite(Number(item[field])));
  const games = usable.reduce((sum, item) => sum + Math.max(1, item.games || 0), 0);
  if (!usable.length || !games) return fallback;
  return clampScore(usable.reduce((sum, item) => sum + clampScore(item[field]) * Math.max(1, item.games || 0), 0) / games);
}

function bucketScore(items, fallback) {
  if (!items.length) return fallback;
  return weightedAverage(items, "rating", fallback);
}

function getGameCount(data = {}, openings = []) {
  data = data || {};
  return (
    Number(
      data.gamesAnalysed ??
        data.gamesAnalyzed ??
        data.games_analyzed ??
        data.gamesImported ??
        data.games_imported ??
        data.totalGames ??
        data.total_games ??
        data.game_count ??
        0
    ) || openings.reduce((sum, item) => sum + item.games, 0)
  );
}

function getPreviousHealthSnapshots(history = []) {
  const rows = Array.isArray(history) ? history : [];
  return rows
    .map((row) => row?.openingHealth || row?.opening_health || row?.coach_progress?.openingHealth || row?.summary?.openingHealth || row?.summary?.opening_health || row)
    .filter((item) => item?.score || item?.overallScore || item?.openingRatings)
    .sort((a, b) => Date.parse(a.reportDate || a.createdAt || "") - Date.parse(b.reportDate || b.createdAt || ""));
}

function findPreviousOpeningRating(history, name) {
  const clean = String(name || "").toLowerCase();
  const previous = [...getPreviousHealthSnapshots(history)].reverse().find((snapshot) =>
    (snapshot.openingRatings || snapshot.opening_ratings || []).some(
      (item) => String(item.name || "").toLowerCase() === clean
    )
  );
  return (previous?.openingRatings || previous?.opening_ratings || []).find(
    (item) => String(item.name || "").toLowerCase() === clean
  )?.rating ?? null;
}

export function buildOpeningHealthSnapshot(data = {}, fitData = null, history = []) {
  const openings = collectSourceOpenings(data, fitData);
  const gamesAnalysed = getGameCount(data, openings);
  const winRate = weightedAverage(openings, "winRate", clampScore(data.winRate ?? data.win_rate, 50));
  const consistency = weightedAverage(openings, "consistency", openings.length >= 3 ? 68 : 50);
  const diversity = clampScore(openings.length >= 7 ? 78 : openings.length >= 4 ? 70 : openings.length >= 2 ? 58 : 42);
  const performanceTrend = weightedAverage(openings, "trend", winRate);
  const volume = clampScore(gamesAnalysed >= 80 ? 92 : gamesAnalysed >= 40 ? 82 : gamesAnalysed >= 20 ? 70 : gamesAnalysed >= 10 ? 58 : 42);

  const whiteOpenings = openings.filter((item) => item.context === "white");
  const blackVsE4Openings = openings.filter((item) => item.context === "blackVsE4");
  const blackVsD4Openings = openings.filter((item) => item.context === "blackVsD4");
  const fallback = weightedAverage(openings, "rating", fitData?.overallScore ?? data.openingHealthScore ?? data.opening_health_score ?? 60);
  const breakdown = {
    whiteRepertoire: bucketScore(whiteOpenings, fallback),
    blackVsE4: bucketScore(blackVsE4Openings, fallback),
    blackVsD4: bucketScore(blackVsD4Openings, Math.max(0, fallback - 5)),
    recentForm: performanceTrend,
  };
  const score = clampScore(
    winRate * 0.3 +
      consistency * 0.22 +
      diversity * 0.16 +
      performanceTrend * 0.2 +
      volume * 0.12
  );
  const previousSnapshots = getPreviousHealthSnapshots(history);
  const previous = previousSnapshots[previousSnapshots.length - 1] || null;
  const previousScore = clampScore(previous?.score ?? previous?.overallScore, null);
  const monthlyChange = previousScore === null ? null : score - previousScore;
  const openingRatings = openings.slice(0, 10).map((opening) => {
    const previousRating = findPreviousOpeningRating(history, opening.name);
    return {
      name: opening.name,
      rating: opening.rating,
      games: opening.games,
      winRate: opening.winRate,
      context: opening.context,
      monthlyChange: previousRating === null ? null : opening.rating - previousRating,
    };
  });
  const historyPoints = [
    ...previousSnapshots.slice(-7).map((snapshot) => ({
      date: snapshot.reportDate || snapshot.createdAt || snapshot.lastAnalysisDate || "",
      score: clampScore(snapshot.score ?? snapshot.overallScore),
    })),
    { date: new Date().toISOString(), score },
  ].filter((point, index, list) => point.score !== null && list.findIndex((item) => item.date === point.date && item.score === point.score) === index);

  return {
    reportDate: new Date().toISOString(),
    score,
    factors: { winRate, consistency, diversity, performanceTrend, volume, gamesAnalysed },
    breakdown,
    openingRatings,
    monthlyChange,
    historyPoints,
  };
}

export function formatOpeningHealthDelta(delta) {
  if (delta === null || delta === undefined || !Number.isFinite(Number(delta))) return "New";
  const value = Math.round(Number(delta));
  if (value === 0) return "No change this month";
  return `${value > 0 ? "+" : ""}${value} this month`;
}
