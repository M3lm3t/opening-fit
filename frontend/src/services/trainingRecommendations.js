import { mergeWeakLines } from "./weakLineDetection";

export const TRAINING_TARGET_THRESHOLDS = {
  weakLineMinGames: 3,
  secondaryMinGames: 6,
  meaningfulOpeningGames: 5,
  weakLossRate: 50,
  weakWinRate: 45,
  frequentVariationGames: 5,
};

function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normaliseKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function lineName(item = {}) {
  return item.variation || item.line || item.lineName || item.line_name || item.moveLine || item.move_line || "";
}

function moveLine(item = {}) {
  const target = item.trainingTarget || item.training_target || {};
  const trainingSet = item.trainingSet || item.training_set || target.trainingSet || target.training_set || {};
  const direct =
    item.moveLine ||
    item.move_line ||
    item.linePgn ||
    item.line_pgn ||
    target.moveLine ||
    target.move_line ||
    trainingSet.startingMoveSequence ||
    trainingSet.starting_move_sequence ||
    "";
  if (Array.isArray(direct)) return direct.join(" ");
  if (direct) return String(direct);
  const moves = item.moves || target.moves;
  return Array.isArray(moves) ? moves.join(" ") : "";
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

function inferPracticeSide(item = {}) {
  const target = item.trainingTarget || item.training_target || {};
  const trainingSet = item.trainingSet || item.training_set || target.trainingSet || target.training_set || {};
  const text = [
    item.practiceSide,
    item.side,
    item.colour,
    item.color,
    item.player_color,
    item.playerColor,
    item.context,
    item.contextLabel,
    item.repertoireContext,
    target.practiceSide,
    target.side,
    target.colour,
    target.color,
    trainingSet.side,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("black")) return "black";
  if (text.includes("white")) return "white";

  const name = openingName(item).toLowerCase();
  if (/\b(defen[cs]e|sicilian|french|caro|scandinavian|pirc|dutch|slav|king's indian)\b/.test(name)) {
    return "black";
  }

  return "white";
}

function collectOpenings(data = {}, fitData = null) {
  data = data || {};
  const source = [
    ...asArray(fitData?.scoredOpenings),
    ...asArray(data.best_openings),
    ...asArray(data.bestOpenings),
    ...asArray(data.top_openings),
    ...asArray(data.topOpenings),
    ...asArray(data.opening_stats),
    ...asArray(data.openingStats),
    ...asArray(data.preferred_white),
    ...asArray(data.preferred_black),
  ];
  const byName = new Map();

  source.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const name = openingName(item);
    const key = normaliseKey(name);
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

function confidenceLabel(item = {}) {
  const games = safeNumber(item.games ?? item.gamesPlayed ?? item.games_played, 0);
  const lossRate = safeNumber(item.lossRate ?? item.loss_rate, 0);
  if (games >= TRAINING_TARGET_THRESHOLDS.secondaryMinGames && lossRate >= TRAINING_TARGET_THRESHOLDS.weakLossRate) {
    return "High confidence";
  }
  if (games >= TRAINING_TARGET_THRESHOLDS.weakLineMinGames) return "Developing pattern";
  return "Limited evidence";
}

function hasRepeatableEvidence(item = {}) {
  const games = safeNumber(item.games ?? item.gamesPlayed ?? item.games_played, 0);
  if (games >= TRAINING_TARGET_THRESHOLDS.weakLineMinGames) return true;
  const evidenceLevel = String(item.evidenceLevel || item.evidence_level || "").toLowerCase();
  return games >= 2 && (evidenceLevel === "useful" || evidenceLevel === "actionable");
}

function targetReason(line = {}) {
  return (
    line.flagReason ||
    line.reason ||
    line.why ||
    line.evidenceSummary ||
    line.evidence_summary ||
    (safeNumber(line.lossRate ?? line.loss_rate, 0) >= TRAINING_TARGET_THRESHOLDS.weakLossRate
      ? "This repeated variation is producing the clearest difficult positions."
      : "This variation repeats often enough to be worth one focused practice session.")
  );
}

function buildTrainingTarget(line = {}) {
  const side = inferPracticeSide(line);
  const opening = openingName(line);
  const variation = lineName(line) || "Repeated variation";
  const exactStart = moveLine(line);
  const sourceTarget = line.trainingTarget || line.training_target || line;
  const trainingSet = sourceTarget.trainingSet || sourceTarget.training_set || {};
  const reason = targetReason(line);

  return {
    ...sourceTarget,
    opening,
    name: opening,
    variation,
    line: variation,
    moveLine: exactStart,
    move_line: exactStart,
    practiceSide: side,
    side,
    colour: side,
    color: side,
    selectedReason: reason,
    selected_reason: reason,
    flagReason: reason,
    reason,
    trainingSet: {
      ...trainingSet,
      openingName: opening,
      opening_name: opening,
      variationName: variation,
      variation_name: variation,
      lineName: variation,
      line_name: variation,
      side,
      startingMoveSequence: exactStart,
      starting_move_sequence: exactStart,
      shortExplanation: reason,
      short_explanation: reason,
      source: "targeted-training",
    },
    source: "targeted-training",
    weakLine: true,
  };
}

function asRecommendationFromWeakLine(line) {
  const games = safeNumber(line.games, 0);
  const winRate = safeNumber(line.winRate, 50);
  const lossRate = safeNumber(line.lossRate, 0);
  const side = inferPracticeSide(line);
  const target = buildTrainingTarget(line);
  const exactStart = target.moveLine || "";
  const repeatedMistakeScore = lossRate >= TRAINING_TARGET_THRESHOLDS.weakLossRate ? 180 : 80;
  const sampleScore = Math.min(120, games * 14);
  const frequencyScore = games >= TRAINING_TARGET_THRESHOLDS.frequentVariationGames ? 60 : 20;
  const resultScore = Math.max(0, TRAINING_TARGET_THRESHOLDS.weakWinRate - winRate) * 4 + Math.max(0, lossRate - 35) * 3;
  const recencyScore = safeNumber(line.evidenceRank, 0) > 0 ? Math.min(80, safeNumber(line.evidenceRank, 0) / 40) : 0;

  return {
    type: "weak-line",
    opening: target.opening,
    variation: target.variation,
    moveLine: exactStart,
    practiceSide: side,
    sideLabel: side === "black" ? "Train as Black" : "Train as White",
    startLabel: exactStart ? `after ${exactStart}` : "from the first repeated position saved in this line",
    games,
    winRate,
    lossRate,
    confidence: confidenceLabel(line),
    reason: "Why this was picked:",
    why: target.reason,
    estimatedTime: "3-5 minutes",
    trainingTarget: target,
    rankScore: 600 + repeatedMistakeScore + sampleScore + frequencyScore + resultScore + recencyScore,
  };
}

function asRecommendationFromOpening(opening, fallback = false) {
  const lowRate = opening.winRate && opening.winRate < 50;
  const side = inferPracticeSide(opening);
  const reason = lowRate
    ? "This opening has a meaningful sample and lower results, but no exact weak branch was isolated yet."
    : "Use this as a light fallback until a more precise weak variation appears.";

  return {
    type: fallback ? "fallback-opening" : "opening",
    opening: opening.opening,
    variation: opening.variation || "",
    moveLine: opening.moveLine || "",
    practiceSide: side,
    sideLabel: side === "black" ? "Train as Black" : "Train as White",
    startLabel: opening.moveLine ? `after ${opening.moveLine}` : "from the main starting moves",
    games: opening.games,
    winRate: opening.winRate || null,
    lossRate: opening.lossRate,
    confidence: opening.games >= 10 ? "Developing pattern" : "Limited evidence",
    reason: lowRate ? "Why this was picked:" : "Fallback target:",
    why: reason,
    estimatedTime: "3-5 minutes",
    trainingTarget: {
      opening: opening.opening,
      name: opening.opening,
      variation: opening.variation || "",
      moveLine: opening.moveLine || "",
      practiceSide: side,
      side,
      colour: side,
      color: side,
      trainingSet: {
        openingName: opening.opening,
        opening_name: opening.opening,
        variationName: opening.variation || "",
        variation_name: opening.variation || "",
        startingMoveSequence: opening.moveLine || "",
        starting_move_sequence: opening.moveLine || "",
        side,
        shortExplanation: reason,
        short_explanation: reason,
        source: "opening-fallback-training",
      },
    },
    rankScore: opening.games * 5 + Math.max(0, 55 - (opening.winRate || 55)) * 3,
  };
}

function onePrimaryPerOpening(recommendations = []) {
  const byOpening = new Map();
  recommendations.forEach((item) => {
    const key = normaliseKey(item.opening);
    if (!key) return;
    const current = byOpening.get(key);
    if (!current || item.rankScore > current.rankScore) byOpening.set(key, item);
  });
  return [...byOpening.values()].sort((a, b) => b.rankScore - a.rankScore);
}

export function buildTrainingRecommendations(data = null, fitData = null) {
  if (!data) {
    return {
      state: "no-data",
      primary: null,
      secondary: null,
      recommendations: [],
      message: "Import your games to unlock personalised training",
    };
  }

  const weakLines = mergeWeakLines(data)
    .filter(hasRepeatableEvidence)
    .map(asRecommendationFromWeakLine);
  const openings = collectOpenings(data, fitData);
  const openingRecs = openings
    .filter((opening) => opening.games >= TRAINING_TARGET_THRESHOLDS.meaningfulOpeningGames)
    .filter((opening) => opening.winRate < 50 || !weakLines.some((line) => normaliseKey(line.opening) === normaliseKey(opening.opening)))
    .map((opening) => asRecommendationFromOpening(opening));
  const ranked = onePrimaryPerOpening([...weakLines, ...openingRecs]);
  const primary = ranked[0] || null;
  const secondary = ranked.find((item) => {
    if (!primary || normaliseKey(item.opening) === normaliseKey(primary.opening)) return false;
    return item.type === "weak-line" && item.games >= TRAINING_TARGET_THRESHOLDS.secondaryMinGames;
  }) || null;
  const recommendations = [primary, secondary].filter(Boolean);

  if (recommendations.length) {
    return {
      state: weakLines.length ? "personalised" : "fallback",
      primary,
      secondary,
      recommendations,
      message: weakLines.length
        ? "OpeningFit found the most relevant variation to train next."
        : "No repeated weak variation is clear yet, so this is a light fallback target.",
    };
  }

  const mostPlayed = openings[0];
  if (mostPlayed || totalGames(data) > 0) {
    const fallback = mostPlayed ? asRecommendationFromOpening(mostPlayed, true) : null;
    return {
      state: "fallback",
      primary: fallback,
      secondary: null,
      recommendations: fallback ? [fallback] : [],
      message: "Build your first training plan from one opening, not every variation.",
    };
  }

  return {
    state: "no-data",
    primary: null,
    secondary: null,
    recommendations: [],
    message: "Import your games to unlock personalised training",
  };
}
