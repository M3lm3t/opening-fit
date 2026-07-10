import { findOpeningPracticePack } from "../data/openingPracticeLines.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function openingName(item, fallback = "recommended opening") {
  if (typeof item === "string") return item;
  return cleanText(
    item?.name ||
      item?.opening ||
      item?.openingName ||
      item?.opening_name ||
      item?.ecoName ||
      item?.eco_name ||
      item?.lineName ||
      item?.line_name,
    fallback
  );
}

function openingScore(item) {
  if (!item || typeof item === "string") return null;
  const direct =
    item.fitScore ??
    item.fit_score ??
    item.openingFitScore ??
    item.score ??
    item.winRate ??
    item.win_rate;
  if (direct === undefined || direct === null || direct === "") return null;
  const parsed = Number(String(direct).replace("%", ""));
  if (!Number.isFinite(parsed)) return null;
  return parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
}

function getGames(item) {
  if (!item || typeof item === "string") return 0;
  return numberValue(item.games ?? item.count ?? item.total ?? item.games_played ?? item.gamesPlayed, 0);
}

function getSide(item = {}) {
  const text = [
    item.practiceSide,
    item.side,
    item.colour,
    item.color,
    item.slotKey,
    item.slotLabel,
    item.context,
    item.contextLabel,
    item.repertoireContext,
    item.responseTo,
    item.response_to,
    openingName(item, ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\bblack\b|black_vs|vs 1\.?e4|vs 1\.?d4|sicilian|french|caro|scandinavian|pirc|dutch|king'?s indian|slav|nimzo|grunfeld|gruenfeld/.test(text)) {
    return "black";
  }
  if (/\bwhite\b|white_repertoire/.test(text)) return "white";
  return "white";
}

function splitMoveText(value) {
  return cleanText(value)
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ")
    .split(/\s+/)
    .map((move) => move.trim())
    .filter((move) => move && !move.startsWith("$"))
    .slice(0, 12);
}

function getMoves(item = {}) {
  const arrays = [item.moves, item.sanMoves, item.san_moves, item.lineMoves, item.line_moves, item.moveSequence, item.move_sequence]
    .find((value) => Array.isArray(value) && value.length);
  if (arrays) return arrays.map(String).filter(Boolean).slice(0, 12);

  const text = [
    item.moveLine,
    item.move_line,
    item.movesText,
    item.moves_text,
    item.line,
    item.sequence,
    item.recommendedCorrectContinuation,
    item.recommended_correct_continuation,
  ].find(Boolean);
  return splitMoveText(text);
}

function getRecentGames(data = {}) {
  return [
    ...asArray(data.recent_games),
    ...asArray(data.recentGames),
    ...asArray(data.opening_games),
    ...asArray(data.openingGames),
  ];
}

function getWeakLineCandidates(data = {}) {
  const insights = data.openingCoachInsights || data.opening_coach_insights || {};
  return [
    ...asArray(data.weakLines),
    ...asArray(data.weak_lines),
    ...asArray(data.recurringWeakLines),
    ...asArray(data.recurring_weak_lines),
    ...asArray(data.recurringOpeningHabits),
    ...asArray(data.recurring_opening_habits),
    ...asArray(insights.weakLines),
    ...asArray(insights.weak_lines),
    insights.biggestLeak,
    insights.biggest_leak,
    insights.focusMission,
    insights.focus_mission,
  ].filter(Boolean);
}

function getTrainingCandidates(data = {}) {
  data = data || {};
  return [
    ...asArray(data.training_plan),
    ...asArray(data.trainingPlan),
    ...asArray(data.personalTrainingPlan),
    ...asArray(data.personal_training_plan),
  ].filter(Boolean);
}

function allOpenings(data = {}) {
  data = data || {};
  return [
    ...asArray(data.best_openings),
    ...asArray(data.bestOpenings),
    ...asArray(data.top_openings),
    ...asArray(data.topOpenings),
    ...asArray(data.opening_stats),
    ...asArray(data.openingStats),
    ...asArray(data.preferred_white),
    ...asArray(data.preferredWhite),
    ...asArray(data.preferred_black),
    ...asArray(data.preferredBlack),
  ].filter(Boolean);
}

function skillForTarget(item = {}, fallback = "move order") {
  const text = [
    item.skill,
    item.skillType,
    item.skill_type,
    item.reason,
    item.shortReason,
    item.short_reason,
    item.issue,
    item.pattern,
    item.label,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/trap|tactic|blunder|queen|king safety|unsafe/.test(text)) return "tactical safety";
  if (/develop|piece|castle/.test(text)) return "development";
  if (/pawn|structure|centre|center|break/.test(text)) return "pawn structure";
  if (/response|reply|branch|against/.test(text)) return "response to a specific move";
  if (/trap/.test(text)) return "common trap avoidance";
  return fallback;
}

function buildTarget({ item, data, source, fallbackName = "" }) {
  const name = openingName(item, fallbackName);
  const moves = getMoves(item);
  const practiceSide = getSide(item);
  const pack = findOpeningPracticePack(name);
  const relatedGame = getRecentGames(data).find((game) =>
    cleanText(game?.opening || game?.name || "").toLowerCase().includes(name.toLowerCase())
  );
  const skill = skillForTarget(item);

  return {
    ...(typeof item === "object" ? item : { name }),
    name,
    opening: name,
    source: "mistake-based",
    practiceSource: source,
    weakLine: source === "recurring-mistake",
    practiceSide,
    side: practiceSide,
    color: practiceSide,
    moves,
    moveLine: moves.join(" "),
    line: cleanText(item?.lineName || item?.line_name || item?.variation || item?.line || moves.join(" "), ""),
    trainingSet: {
      source: "mistake-based",
      lineName: cleanText(item?.lineName || item?.line_name || item?.variation || `${name} practice position`),
      shortExplanation:
        cleanText(item?.shortExplanation || item?.short_explanation || item?.reason || item?.shortReason || item?.short_reason) ||
        `You often lose comfort early in ${name}. Practise the main idea from this type of position.`,
      recommendedCorrectContinuation: moves.join(" "),
      difficulty: moves.length ? "targeted" : "starter",
    },
    practiceMeta: {
      title: `Practice your ${name} ${skill}`,
      explanation:
        cleanText(item?.practiceExplanation || item?.practice_explanation || item?.reason || item?.shortReason || item?.short_reason) ||
        (moves.length
          ? "Play the next practical continuation from a position similar to your recent games."
          : "OpeningFit found the opening to work on. Practise the closest safe starter line while more exact positions are collected."),
      skill,
      estimatedMinutes: 5,
      source,
      relatedGame,
      hasExactMoves: moves.length >= 2,
      fallbackLoaded: !moves.length && Boolean(pack),
      takeaway:
        cleanText(item?.takeaway || item?.nextAction || item?.next_action) ||
        "Remember the opening idea before expanding your theory.",
    },
  };
}

export function buildMistakePracticeTarget({ data = {}, opening = null } = {}) {
  if (opening) {
    const target = buildTarget({ item: opening, data, source: "selected-opening", fallbackName: openingName(opening) });
    return target.name && findOpeningPracticePack(target.name) ? target : target;
  }

  const weak = getWeakLineCandidates(data).find((item) => openingName(item, "") && (getMoves(item).length >= 2 || findOpeningPracticePack(openingName(item, ""))));
  if (weak) return buildTarget({ item: weak, data, source: "recurring-mistake" });

  const weakOpening =
    allOpenings(data)
      .filter((item) => openingName(item, "") && getGames(item) >= 2)
      .sort((a, b) => (openingScore(a) ?? 100) - (openingScore(b) ?? 100))[0] || null;
  if (weakOpening) return buildTarget({ item: weakOpening, data, source: "weak-opening" });

  const training = getTrainingCandidates(data).find((item) => openingName(item, "") || typeof item === "string");
  if (training) return buildTarget({ item: training, data, source: "training-plan", fallbackName: cleanText(training, "recommended opening") });

  return null;
}

export function hasUsableMistakePracticeData(target) {
  if (!target) return false;
  return Boolean(target.practiceMeta?.hasExactMoves || findOpeningPracticePack(target.name));
}
