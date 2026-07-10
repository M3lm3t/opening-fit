const XP_PER_LEVEL = 1000;
const MAX_HISTORY = 40;

function safeNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(safeNumber(value, 0))));
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

function openingScore(item) {
  const direct = item?.fitScore ?? item?.winRate ?? item?.win_rate ?? item?.score ?? item?.scoreRate;
  if (direct !== undefined && direct !== null && direct !== "") {
    const score = safeNumber(direct, 0);
    return clampScore(score <= 1 ? score * 100 : score);
  }

  const games = openingGames(item);
  const wins = safeNumber(item?.wins ?? item?.w, 0);
  const draws = safeNumber(item?.draws ?? item?.d, 0);
  if (!games) return 0;
  return clampScore(((wins + draws * 0.5) / games) * 100);
}

function isUnknown(name) {
  const clean = String(name || "").trim().toLowerCase();
  return !clean || clean === "unknown" || clean.includes("unknown opening");
}

function collectOpenings(data = {}, fitData = null) {
  data = data || {};
  const source = [
    ...(Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []),
    ...(Array.isArray(data.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data.bestOpenings) ? data.bestOpenings : []),
    ...(Array.isArray(data.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data.topOpenings) ? data.topOpenings : []),
    ...(Array.isArray(data.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data.openingStats) ? data.openingStats : []),
  ];
  const byName = new Map();

  source.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const name = openingName(item);
    if (isUnknown(name)) return;
    const key = name.toLowerCase();
    const row = {
      name,
      games: openingGames(item),
      score: openingScore(item),
      weak: /avoid|improve|review/i.test(String(item.fitVerdict || item.verdict || item.fitCategory || "")),
    };
    const current = byName.get(key);
    if (!current || row.games > current.games) byName.set(key, row);
  });

  return [...byName.values()].sort((a, b) => b.games - a.games).slice(0, 16);
}

function totalGames(data = {}, openings = []) {
  return (
    safeNumber(
      data.gamesImported ??
        data.games_imported ??
        data.totalGames ??
        data.total_games ??
        data.gamesAnalysed ??
        data.games_analyzed,
      0
    ) || openings.reduce((sum, item) => sum + item.games, 0)
  );
}

function reportKey(data = {}, openings = []) {
  return [
    data.platform || data.importPlatform || "chess",
    data.username || data.playerName || data.player_name || "player",
    data.lastUpdated || data.importedAt || data.imported_at || "",
    totalGames(data, openings),
    openings.slice(0, 8).map((item) => `${item.name}:${item.games}:${item.score}`).join("|"),
  ].join("::");
}

function levelFromXp(xp) {
  const total = Math.max(0, Math.round(safeNumber(xp, 0)));
  return {
    level: Math.floor(total / XP_PER_LEVEL) + 1,
    xp: total,
    currentLevelXp: total % XP_PER_LEVEL,
    nextLevelXp: XP_PER_LEVEL,
  };
}

function uniqueDates(dates = []) {
  return [...new Set(dates.map((value) => String(value || "").slice(0, 10)).filter(Boolean))].sort();
}

function streakLength(dates = []) {
  const days = uniqueDates(dates);
  if (!days.length) return 0;
  let count = 1;
  let cursor = new Date(`${days[days.length - 1]}T00:00:00`);

  for (let index = days.length - 2; index >= 0; index -= 1) {
    const previous = new Date(`${days[index]}T00:00:00`);
    const diff = Math.round((cursor - previous) / 86400000);
    if (diff !== 1) break;
    count += 1;
    cursor = previous;
  }

  return count;
}

function achievementRows({ openings, games, weakLinesFixed, reportCount }) {
  return [
    {
      key: "first_analysis",
      title: "First Analysis",
      description: "Create your first OpeningFit report.",
      unlocked: reportCount >= 1,
    },
    {
      key: "hundred_games",
      title: "100 Games Analysed",
      description: "Analyse at least 100 games in one opening sample.",
      unlocked: games >= 100,
    },
    {
      key: "ten_openings",
      title: "10 Openings Discovered",
      description: "Build a map with 10 tracked openings.",
      unlocked: openings.length >= 10,
    },
    {
      key: "weak_line_fixed",
      title: "Weak Line Fixed",
      description: "Improve a previously weak line or opening by 8+ points.",
      unlocked: weakLinesFixed,
    },
  ];
}

export function buildOpeningGamificationSnapshot(data = {}, fitData = null, previous = {}) {
  const openings = collectOpenings(data, fitData);
  const key = reportKey(data, openings);
  const processed = Array.isArray(previous.processedReportKeys) ? previous.processedReportKeys : [];
  const alreadyProcessed = processed.includes(key);
  const previousRows = new Map((previous.openingXp || []).map((item) => [String(item.name).toLowerCase(), item]));
  const now = new Date().toISOString();
  const meaningfulDates = alreadyProcessed
    ? uniqueDates(previous.meaningfulActionDates || [])
    : uniqueDates([...(previous.meaningfulActionDates || []), now]);
  const improvementDates = [...(previous.improvementDates || [])];
  let weakLinesFixed = Boolean(previous.achievements?.find((item) => item.key === "weak_line_fixed" && item.unlocked));

  const openingXp = openings.map((opening) => {
    const previousRow = previousRows.get(opening.name.toLowerCase()) || {};
    const gameDelta = Math.max(0, opening.games - safeNumber(previousRow.games, 0));
    const scoreDelta = opening.score - safeNumber(previousRow.score, opening.score);
    const improvementXp = Math.max(0, scoreDelta) * 18;
    const earned = alreadyProcessed
      ? 0
      : 70 + gameDelta * 12 + (opening.weak ? 30 : 0) + improvementXp;
    const nextXp = safeNumber(previousRow.xp, 0) + earned;

    if (!alreadyProcessed && scoreDelta >= 8) {
      weakLinesFixed = true;
      improvementDates.push(now);
    }

    return {
      ...levelFromXp(nextXp),
      name: opening.name,
      games: opening.games,
      score: opening.score,
      earnedThisReport: Math.round(earned),
      scoreDelta: Math.round(scoreDelta),
    };
  });
  const games = totalGames(data, openings);
  const achievements = achievementRows({
    openings,
    games,
    weakLinesFixed,
    reportCount: alreadyProcessed ? processed.length : processed.length + 1,
  });

  return {
    createdAt: now,
    reportKey: key,
    openingXp,
    totalXp: openingXp.reduce((sum, item) => sum + item.xp, 0),
    meaningfulActionDates: meaningfulDates,
    improvementDates: uniqueDates(improvementDates),
    processedReportKeys: alreadyProcessed ? processed : [key, ...processed].slice(0, MAX_HISTORY),
    streaks: {
      training: {
        label: "7-Day Training Streak",
        current: streakLength(meaningfulDates),
        target: 7,
      },
      improvement: {
        label: "14-Day Improvement Streak",
        current: streakLength(improvementDates),
        target: 14,
      },
    },
    achievements,
  };
}
