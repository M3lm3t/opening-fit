import { Chess } from "chess.js";
import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";

export const TRAINING_OUTCOME_THRESHOLDS = Object.freeze({
  minimumLaterOpeningGames: 3,
  minimumRelevantPositions: 2,
  minimumCorrectApplicationsForImproved: 2,
  minimumRepeatedMistakesForNotImproved: 2,
  improvedApplicationRate: 2 / 3,
  minimumOpeningResultGames: 5,
});

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const text = (value) => String(value ?? "").trim();
const cleanSan = (value) => text(value).replace(/[!?+#]+$/g, "").replaceAll("0-0-0", "O-O-O").replaceAll("0-0", "O-O");
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

function timestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (/^\d+(?:\.\d+)?$/.test(text(value))) {
    const numeric = Number(value);
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function gameDate(game = {}) {
  return timestamp(game.played_at || game.playedAt || game.played_date || game.playedDate || game.end_time || game.endTime || game.date || game.created_at);
}

function canonicalOpening(value) {
  const raw = typeof value === "object" ? value?.openingId || value?.opening_id || value?.canonical_opening_id || value?.opening || value?.opening_name || value?.name : value;
  const known = findOpeningLine(text(raw));
  return text(known?.id || normaliseOpeningKey(known?.name || raw));
}

function gameOpening(game = {}) {
  return canonicalOpening(game.openingId || game.opening_id || game.canonical_opening_id || game.opening || game.opening_name || game.eco_name || game.analysis?.opening);
}

function normalFen(value) {
  const fields = text(value).split(/\s+/);
  return fields.length >= 4 ? fields.slice(0, 4).join(" ") : "";
}

function rawGame(row = {}) {
  return row.game && typeof row.game === "object" ? { ...row.game, analysis: row.analysis || row.game.analysis } : row;
}

function pgnText(game = {}) {
  return text(game.pgn || game.rawPgn || game.raw_pgn || game.analysis?.pgn);
}

function positionObservation(game, focus) {
  const wantedFen = normalFen(focus.positionFen || focus.position_fen);
  if (!wantedFen) return null;
  try {
    const chess = new Chess();
    chess.loadPgn(pgnText(game));
    const history = chess.history({ verbose: true });
    chess.reset();
    for (const move of history) {
      if (normalFen(chess.fen()) === wantedFen) {
        const played = chess.move(move);
        return played ? cleanSan(played.san) : null;
      }
      chess.move(move);
    }
  } catch {
    return null;
  }
  return null;
}

function issueObservations(game = {}) {
  const analysis = game.analysis && typeof game.analysis === "object" ? game.analysis : {};
  return [game.moveAnalysis, game.move_analysis, game.openingMoveAnalysis, game.opening_move_analysis, analysis.moveAnalysis, analysis.move_analysis]
    .find((rows) => Array.isArray(rows)) || [];
}

function resultScore(game = {}) {
  const raw = text(game.user_result || game.userResult || game.result || game.analysis?.result).toLowerCase();
  if (["win", "won", "1", "1-0"].includes(raw)) return 1;
  if (["draw", "drawn", "1/2-1/2", "0.5"].includes(raw)) return 0.5;
  if (["loss", "lost", "0", "0-1"].includes(raw)) return 0;
  return null;
}

function metric(value) {
  if (value && typeof value === "object") return value;
  return finite(value);
}

function confidence(status, relevant, later) {
  if (status === "not_encountered") return later >= TRAINING_OUTCOME_THRESHOLDS.minimumLaterOpeningGames ? "medium" : "low";
  if (relevant >= 5) return "high";
  if (relevant >= TRAINING_OUTCOME_THRESHOLDS.minimumRelevantPositions) return "medium";
  return "low";
}

function explanationFor(status, correct, repeated) {
  if (status === "not_encountered") return "The position has not appeared again yet.";
  if (status === "insufficient_data") return "There is not enough evidence to judge this.";
  if (status === "improved") return `You applied this successfully in ${correct === 2 ? "two" : correct} later games.`;
  if (status === "partially_improved") return "You applied this in a later game, but more consistent evidence is needed.";
  return `The same issue occurred again in ${repeated === 3 ? "three" : repeated} games.`;
}

export function completedTrainingFocuses(plans = []) {
  return list(plans).flatMap((plan) => list(plan.tasks).filter((task) => task.status === "completed").flatMap((task) => {
    const completedAt = task.completedAt || task.completed_at || plan.completedAt || plan.completed_at;
    const openingId = canonicalOpening(task.openingId || task.opening_id || plan.targetMetric?.openingId || plan.target_metric?.openingId);
    if (!task.id || !completedAt || !openingId) return [];
    return [{
      ...task,
      trainingFocusId: task.id,
      completedAt,
      openingId,
      issueType: task.issueType || task.issue_type || plan.targetMetric?.issueType || plan.target_metric?.issueType || null,
      beforeMetric: task.beforeMetric ?? task.before_metric ?? plan.targetMetric?.beforeMetric ?? plan.target_metric?.beforeMetric ?? null,
    }];
  }));
}

export function evaluateTrainingOutcome(focus = {}, gameRows = []) {
  const completedAt = timestamp(focus.completedAt || focus.completed_at);
  const openingId = canonicalOpening(focus.openingId || focus.opening_id);
  const eligible = list(gameRows).map(rawGame).filter((game) => {
    const playedAt = gameDate(game);
    return completedAt !== null && playedAt !== null && playedAt > completedAt && openingId && gameOpening(game) === openingId;
  });
  const laterGames = [...new Map(eligible.map((game, index) => [text(game.game_id || game.gameId || game.id || game.url) || pgnText(game) || `game-${index}`, game])).values()];
  const accepted = new Set(list(focus.acceptedMoves || focus.accepted_moves || focus.expectedMoves || focus.expected_moves).slice(0, 1).concat(focus.recommendedMove || focus.recommended_move || []).map(cleanSan).filter(Boolean));
  const baselineMistake = cleanSan(focus.playedMove || focus.played_move);
  let relevantPositionCount = 0;
  let correctApplicationCount = 0;
  let repeatedMistakeCount = 0;

  laterGames.forEach((game) => {
    const played = positionObservation(game, focus);
    if (played) {
      relevantPositionCount += 1;
      if (accepted.has(played)) correctApplicationCount += 1;
      if (baselineMistake && played === baselineMistake) repeatedMistakeCount += 1;
      return;
    }
    const matchingIssue = issueObservations(game).find((row) => text(row.issueType || row.issue_type) === text(focus.issueType));
    if (matchingIssue && focus.issueType) {
      relevantPositionCount += 1;
      repeatedMistakeCount += 1;
    }
  });

  const resultValues = laterGames.map(resultScore).filter((value) => value !== null);
  const resultScorePercent = resultValues.length >= TRAINING_OUTCOME_THRESHOLDS.minimumOpeningResultGames
    ? Math.round(resultValues.reduce((sum, value) => sum + value, 0) * 100 / resultValues.length)
    : null;
  const applicationRate = relevantPositionCount >= TRAINING_OUTCOME_THRESHOLDS.minimumRelevantPositions
    ? Math.round(correctApplicationCount * 100 / relevantPositionCount)
    : null;
  let status;
  if (relevantPositionCount === 0) status = "not_encountered";
  else if (relevantPositionCount < TRAINING_OUTCOME_THRESHOLDS.minimumRelevantPositions || laterGames.length < TRAINING_OUTCOME_THRESHOLDS.minimumLaterOpeningGames) status = "insufficient_data";
  else if (correctApplicationCount >= TRAINING_OUTCOME_THRESHOLDS.minimumCorrectApplicationsForImproved && correctApplicationCount / relevantPositionCount >= TRAINING_OUTCOME_THRESHOLDS.improvedApplicationRate && repeatedMistakeCount <= 1) status = "improved";
  else if (repeatedMistakeCount >= TRAINING_OUTCOME_THRESHOLDS.minimumRepeatedMistakesForNotImproved && correctApplicationCount / relevantPositionCount < 0.5) status = "not_improved";
  else if (correctApplicationCount > repeatedMistakeCount && correctApplicationCount > 0) status = "partially_improved";
  else status = "insufficient_data";

  return {
    trainingFocusId: text(focus.trainingFocusId || focus.id),
    status,
    laterGameCount: laterGames.length,
    relevantPositionCount,
    correctApplicationCount,
    repeatedMistakeCount,
    beforeMetric: metric(focus.beforeMetric ?? focus.before_metric),
    afterMetric: {
      applicationPercent: applicationRate,
      consistencyPercent: applicationRate,
      repeatedMistakePercent: relevantPositionCount >= TRAINING_OUTCOME_THRESHOLDS.minimumRelevantPositions ? Math.round(repeatedMistakeCount * 100 / relevantPositionCount) : null,
      openingResultPercent: resultScorePercent,
      openingResultGameCount: resultScorePercent === null ? 0 : resultValues.length,
    },
    explanation: explanationFor(status, correctApplicationCount, repeatedMistakeCount),
    confidence: confidence(status, relevantPositionCount, laterGames.length),
  };
}

export function evaluateTrainingOutcomes(focuses = [], games = []) {
  return list(focuses).map((focus) => evaluateTrainingOutcome(focus, games));
}
