import { findOpeningPracticePack } from "../data/openingPracticeLines";
import { mergeWeakLines } from "./weakLineDetection";

export const WEAKEST_LINE_TRAINING_EVENTS_KEY = "openingFit:weakestLineTrainingEvents";
export const WEAKEST_LINE_TRAINING_COMPLETED_EVENT = "openingfit:weakest-line-training-completed";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function openingName(item) {
  if (typeof item === "string") return item;
  return item?.opening || item?.name || item?.openingName || item?.opening_name || item?.trainingTarget || "";
}

function normaliseKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lineName(item) {
  if (!item || typeof item === "string") return "";
  return item.variation || item.line || item.moveLine || item.move_line || item.lineName || item.line_name || "";
}

function moveLine(item) {
  if (!item || typeof item === "string") return "";
  const direct = item.moveLine || item.move_line || item.movesText || item.moves_text || item.pgnPrefix || item.pgn_prefix || "";
  if (Array.isArray(direct)) return direct.join(" ");
  if (direct) return String(direct);
  if (Array.isArray(item.moves)) return item.moves.join(" ");
  return "";
}

function inferSide(item = {}) {
  const text = [
    item.side,
    item.colour,
    item.color,
    item.player_color,
    item.playerColor,
    item.context,
    item.contextLabel,
    item.slotKey,
    item.slotLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("black")) return "black";
  if (text.includes("white")) return "white";

  const name = openingName(item).toLowerCase();
  if (/\b(defen[cs]e|sicilian|french|caro|scandinavian|pirc|dutch|slav)\b/.test(name) || name.includes("king's indian")) {
    return "black";
  }

  return "";
}

function getRetentionMetrics(data = {}) {
  return data.retentionMetrics || data.retention_metrics || {};
}

function getWeakestTracking(data = {}) {
  const metrics = getRetentionMetrics(data);
  return data.weakestLineTracking || data.weakest_line_tracking || metrics.weakestLineTracking || metrics.weakest_line_tracking || {};
}

function getOneThingToFix(data = {}) {
  const metrics = getRetentionMetrics(data);
  return data.oneThingToFix || data.one_thing_to_fix || metrics.oneThingToFix || metrics.one_thing_to_fix || null;
}

function firstValidLine(data = {}) {
  const merged = mergeWeakLines(data, { minGames: 1 }).find((line) => openingName(line));
  if (merged) return merged;

  const tracking = getWeakestTracking(data);
  const current = tracking.currentWeakestLine || tracking.current_weakest_line;
  if (openingName(current)) return current;

  const fix = getOneThingToFix(data);
  if (openingName(fix)) return fix;

  return null;
}

function findMatchingPracticeLine(opening, focusLine, moves) {
  const pack = findOpeningPracticePack(opening);
  const lines = asArray(pack?.lines);
  if (!lines.length) return null;

  const query = [focusLine, moves].filter(Boolean).join(" ").toLowerCase();
  if (!query.trim()) return lines[0];

  return (
    lines.find((line) => {
      const haystack = [line.name, asArray(line.moves).join(" "), line.idea].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query) || query.includes(String(line.name || "").toLowerCase());
    }) || lines[0]
  );
}

function difficultyForLine(line = {}) {
  const games = numberValue(line.games, 0);
  const lossRate = numberValue(line.lossRate ?? line.loss_rate, 0);
  if (games >= 8 || lossRate >= 60) return "hard";
  if (games >= 4 || lossRate >= 45) return "medium";
  return "easy";
}

export function buildWeakestLineTrainingTargetFromLine(line = {}) {
  const sourceLine = line || {};
  const opening = openingName(sourceLine);

  if (!opening || /^unknown/i.test(opening)) {
    return {
      available: false,
      message: "Analyse more games to unlock weakest-line training.",
      target: null,
    };
  }

  const variation = lineName(sourceLine);
  const moveSequence = moveLine(sourceLine);
  const matchingLine = findMatchingPracticeLine(opening, variation || moveSequence, moveSequence);
  const recommendedContinuation =
    sourceLine.recommendedCorrectContinuation ||
    sourceLine.recommended_correct_continuation ||
    sourceLine.commonContinuations?.[0]?.move ||
    matchingLine?.moves?.slice(-1)?.[0] ||
    "";
  const explanation =
    sourceLine.flagReason ||
    sourceLine.whyItMatters ||
    sourceLine.why_it_matters ||
    sourceLine.exactIssue ||
    sourceLine.exact_issue ||
    matchingLine?.idea ||
    "This is the repeated opening line most worth cleaning up before adding new theory.";
  const side = inferSide(sourceLine);
  const trainingSet = {
    openingName: opening,
    opening_name: opening,
    variationName: variation,
    variation_name: variation,
    lineName: variation || moveSequence,
    line_name: variation || moveSequence,
    side,
    startingMoveSequence: moveSequence || asArray(matchingLine?.moves).join(" "),
    starting_move_sequence: moveSequence || asArray(matchingLine?.moves).join(" "),
    startingFen: sourceLine.fen || sourceLine.startingFen || sourceLine.starting_fen || "",
    starting_fen: sourceLine.fen || sourceLine.startingFen || sourceLine.starting_fen || "",
    recommendedCorrectContinuation: recommendedContinuation,
    recommended_correct_continuation: recommendedContinuation,
    shortExplanation: explanation,
    short_explanation: explanation,
    difficulty: difficultyForLine(sourceLine),
    source: "weakest-line",
  };

  return {
    available: true,
    message: "",
    target: {
      ...sourceLine,
      name: opening,
      opening,
      variation,
      line: variation || sourceLine.line || moveSequence,
      moveLine: moveSequence,
      side,
      practiceSide: side || undefined,
      trainingTarget: opening,
      trainingSet,
      source: "weakest-line",
    },
  };
}

export function buildWeakestLineTrainingTarget(data = {}) {
  return buildWeakestLineTrainingTargetFromLine(firstValidLine(data));
}

export function buildWeakestLineTrainingCompletionEvent(opening = {}, selectedLine = {}) {
  const trainingSet = opening?.trainingSet || opening?.training_set || {};
  const now = new Date().toISOString();
  const event = {
    created_at: now,
    opening: openingName(opening) || trainingSet.openingName || trainingSet.opening_name || "",
    variation:
      selectedLine?.name ||
      opening?.variation ||
      opening?.line ||
      trainingSet.variationName ||
      trainingSet.variation_name ||
      trainingSet.lineName ||
      trainingSet.line_name ||
      "",
    training_type: "weakest-line",
    completed: true,
    source: "weakest-line",
  };

  return {
    ...event,
    key: [normaliseKey(event.opening), normaliseKey(event.variation), now].filter(Boolean).join(":"),
  };
}

export function readWeakestLineTrainingEvents() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(WEAKEST_LINE_TRAINING_EVENTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveWeakestLineTrainingEvent(event) {
  if (!event || typeof window === "undefined") return [];

  const nextEvents = [event, ...readWeakestLineTrainingEvents()]
    .filter(Boolean)
    .slice(0, 50);

  try {
    window.localStorage.setItem(WEAKEST_LINE_TRAINING_EVENTS_KEY, JSON.stringify(nextEvents));
  } catch {
    // Local feedback is useful, not required.
  }

  window.dispatchEvent(
    new CustomEvent(WEAKEST_LINE_TRAINING_COMPLETED_EVENT, {
      detail: { event, events: nextEvents },
    })
  );

  return nextEvents;
}

export function countWeakestLineCompletionsForOpening(opening, events = []) {
  const key = normaliseKey(opening);
  if (!key) return 0;
  return asArray(events).filter((event) => normaliseKey(event?.opening) === key && event?.completed).length;
}
