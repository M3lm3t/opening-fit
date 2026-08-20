import { Chess } from "chess.js";

export const PERSONAL_TRAINING_VERSION = 1;
export const PERSONAL_TRAINING_STORAGE_KEY = "openingFit:personalOpeningTraining:v1";
export const TRAINING_MODES = Object.freeze(["learn", "recall", "continue", "review_mistake", "retest"]);
export const COACHING_SESSION_STEPS = Object.freeze(["recall", "decision", "reveal", "rehearse", "commit"]);

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const text = (value) => String(value ?? "").trim();
const cleanSan = (value) => text(value).replace(/[!?+#]+$/g, "").replaceAll("0-0-0", "O-O-O").replaceAll("0-0", "O-O");
const normalFen = (value) => text(value).split(/\s+/).slice(0, 4).join(" ");
const iso = (value = new Date()) => new Date(value).toISOString();

function moveAt(fen, candidate) {
  try {
    const chess = new Chess(fen);
    const move = chess.move(candidate);
    return move ? { san: cleanSan(move.san), uci: `${move.from}${move.to}${move.promotion || ""}`, fen: chess.fen() } : null;
  } catch { return null; }
}

function colourForRole(role) {
  return text(role).toLowerCase() === "white" || text(role).toLowerCase() === "white_repertoire" ? "white"
    : text(role).toLowerCase().startsWith("black") ? "black" : null;
}

function diagnosisSources(report = {}) {
  const decision = report.reportDecision || report.report_decision || {};
  const priority = decision.trainingPriority || decision.training_priority || report.trainingPriority || report.training_priority || {};
  const primary = priority.openingDiagnosis || priority.opening_diagnosis || decision.openingDiagnosis || decision.opening_diagnosis;
  const habits = list(report.recurringOpeningHabits || report.recurring_opening_habits)
    .filter((row) => row.habitType !== "GOOD_HABIT")
    .map((row) => ({
      ...row,
      diagnosisId: row.diagnosisId || row.habitId,
      positionFen: row.positionFen || row.position_fen || row.positionIdentity || row.position_identity,
      repertoireRole: row.repertoireRole || row.role,
      opening: row.opening || row.openingName,
      canonicalOpeningId: row.canonicalOpeningId || row.openingId,
      recommendedMoves: [row.recommendedMove, ...list(row.recommendedMoves || row.recommended_moves), ...list(row.acceptedMoves)],
      originalMove: row.playedMove,
      supportingGameIds: row.gameReferences || row.supportingGameIds || row.supporting_game_ids,
      confidence: row.confidence,
      explanation: row.explanation || `${row.playedMove} was repeated in this position.`,
      occurrenceCount: row.occurrenceCount,
      source: "recurring_opening_habit",
    }));
  return [primary ? { ...primary, priority, source: "canonical_opening_diagnosis" } : null, ...habits].filter(Boolean);
}

function recommendationMoves(source = {}) {
  const authoritative = source.authoritativeContinuation || source.authoritative_continuation;
  return [
    authoritative?.move,
    ...list(source.recommendedMoves || source.recommended_moves),
    ...list(source.expectedMoves || source.expected_moves),
    ...list(source.priority?.expectedMoves || source.priority?.expected_moves),
  ].map(cleanSan).filter(Boolean);
}

export function validatePersonalTrainingSource(source = {}) {
  const reasons = [];
  const fen = text(source.positionFen || source.position_fen);
  let chess = null;
  try { chess = new Chess(fen); } catch { reasons.push("illegal_position"); }
  const role = text(source.repertoireRole || source.repertoire_role || source.role);
  const expectedColour = colourForRole(role);
  const explicitColour = text(source.playerColour || source.player_colour || source.playerToMove || source.player_to_move).toLowerCase();
  const playerColour = explicitColour || expectedColour;
  const turn = chess ? (chess.turn() === "w" ? "white" : "black") : null;
  if (!role || !expectedColour) reasons.push("untrusted_role");
  if (!playerColour || (expectedColour && playerColour !== expectedColour) || (turn && playerColour !== turn)) reasons.push("wrong_colour");
  const candidates = recommendationMoves(source);
  const legal = chess ? candidates.map((move) => moveAt(fen, move)).filter(Boolean) : [];
  if (!candidates.length || !legal.length) reasons.push("missing_valid_expected_move");
  if (candidates.length > 1 && legal.length > 1 && source.contradictory === true) reasons.push("contradictory_recommendations");
  if (source.superseded === true || source.stale === true) reasons.push("superseded_diagnosis");
  if (!text(source.diagnosisId || source.diagnosis_id)) reasons.push("missing_canonical_diagnosis");
  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], legalMoves: legal, playerColour, role, fen };
}

export function buildPersonalTrainingItems({ report = {}, ownerId, now = new Date() } = {}) {
  const reportId = text(report.analysisId || report.analysis_id || report.reportId || report.report_id || report.id);
  const reportVersion = text(report.reportDecision?.version || report.report_decision?.version || report.schemaVersion || report.schema_version);
  const diagnostics = [];
  const seenPositions = new Map();
  const items = [];
  for (const source of diagnosisSources(report)) {
    const validation = validatePersonalTrainingSource(source);
    const diagnosisId = text(source.diagnosisId || source.diagnosis_id);
    if (!validation.valid || !reportId || !ownerId) {
      diagnostics.push({ diagnosisId: diagnosisId || null, reasons: [...validation.reasons, ...(!reportId ? ["missing_source_report"] : []), ...(!ownerId ? ["missing_owner"] : [])], recoveryAction: "Reanalyse complete games with trusted opening attribution." });
      continue;
    }
    const positionId = normalFen(validation.fen);
    const moves = validation.legalMoves;
    const prior = seenPositions.get(positionId);
    if (prior && prior.expectedUci !== moves[0].uci) {
      items.splice(items.findIndex((item) => item.itemId === prior.itemId), 1);
      diagnostics.push({ diagnosisId, reasons: ["contradictory_recommendations"], recoveryAction: "Review the conflicting canonical diagnoses before training this position." });
      continue;
    }
    const openingId = text(source.canonicalOpeningId || source.canonical_opening_id || source.openingId || source.opening_id || source.priority?.openingKey);
    const trainingSubjectId = text(source.trainingSubjectId || source.training_subject_id || source.priority?.taskId || `position:${diagnosisId}`);
    const itemId = `personal-training:${ownerId}:${reportId}:${diagnosisId}:${moves[0].uci}`;
    const item = {
      version: PERSONAL_TRAINING_VERSION, itemId, ownerId: text(ownerId), sourceReportId: reportId, sourceReportVersion: reportVersion || null,
      diagnosisId, decisionId: text(source.priority?.decisionId) || null, trainingSubjectId,
      openingId: openingId || null, openingName: text(source.opening || source.openingName || source.priority?.openingName) || "Opening position",
      positionId, repertoireRole: validation.role, playerColour: validation.playerColour,
      sourceGameIds: list(source.supportingGameIds || source.supporting_game_ids).map(text), sourceGameId: text(list(source.supportingGameIds || source.supporting_game_ids)[0]) || null,
      startingFen: validation.fen, expectedMove: moves[0].san, expectedMoveUci: moves[0].uci,
      acceptedMoves: moves.map((move) => move.san), acceptedMoveUcis: moves.map((move) => move.uci),
      continuation: list(source.continuation || source.shortContinuation || source.short_continuation).slice(0, 5),
      originalMove: cleanSan(source.originalMove || source.repeatedContinuation?.move || source.repeated_continuation?.move) || null,
      explanation: text(source.explanation || source.userFacingDiagnosis || source.user_facing_diagnosis || source.priority?.rationale),
      evidence: { confidence: text(source.confidence?.level || source.confidence || source.priority?.confidenceStatus) || "unknown", occurrences: Number(source.occurrenceCount || source.supportingGameCount || source.supporting_game_ids?.length || source.supportingGameIds?.length || 0), source: source.source },
      state: { mode: "learn", attempts: 0, correct: 0, failures: 0, assistanceUsed: false, completedReviews: 0 },
      reviewSchedule: { dueAt: iso(now), intervalDays: 0, reason: "New canonical diagnosis", priority: Number(source.priority?.evidenceCount || source.occurrenceCount || 1) },
      createdAt: iso(now), updatedAt: iso(now),
    };
    seenPositions.set(positionId, { itemId, expectedUci: item.expectedMoveUci });
    items.push(item);
  }
  items.sort((a, b) => b.reviewSchedule.priority - a.reviewSchedule.priority || a.itemId.localeCompare(b.itemId));
  return { items, diagnostics };
}

export function buildCoachingSessionContent({ item = null, report = {} } = {}) {
  if (item) {
    const provenance = item.sourceGameId ? "verified_source_position" : item.continuation?.length ? "recognised_opening_pack_line" : "verified_position";
    return {
      available: true, provenance, item, interactive: true, orientation: item.playerColour,
      prompt: `What is your plan in this ${item.openingName} position?`,
      choices: list(item.acceptedMoves).slice(0, 3),
      reveal: item.explanation || `Use ${item.expectedMove} as the supported response in this position.`,
      draft: item.explanation ? `${item.expectedMove}: ${item.explanation}` : `In this position, respond with ${item.expectedMove}.`,
    };
  }
  const decision = report.reportDecision || report.report_decision || {};
  const priority = decision.trainingPriority || decision.training_priority || report.trainingPriority || report.training_priority || null;
  const role = text(priority?.repertoireRole || priority?.repertoire_role);
  const openingName = text(priority?.openingName || priority?.opening_name);
  const diagnosisId = text(priority?.diagnosisId || priority?.diagnosis_id || priority?.priorityId || priority?.priority_id);
  const explanation = text(priority?.rationale || priority?.explanation || priority?.nextAction || priority?.next_action);
  if (role && openingName && diagnosisId && explanation) return {
    available: true, provenance: "general_setup", interactive: false, orientation: colourForRole(role) || "white",
    prompt: `What is your practical plan in the ${openingName}?`, choices: [], reveal: explanation,
    draft: explanation, item: { itemId: text(priority.taskId || priority.task_id || `general:${diagnosisId}`), sourceReportId: text(report.analysisId || report.analysis_id || report.reportId || report.report_id) || null, diagnosisId, decisionId: text(priority.decisionId || priority.decision_id) || null, trainingSubjectId: text(priority.taskId || priority.task_id) || null, openingId: text(priority.openingId || priority.opening_id || priority.canonicalOpeningId || priority.canonical_opening_id) || null, openingName, repertoireRole: role, playerColour: colourForRole(role), evidence: { confidence: text(priority.confidenceStatus || priority.confidence_status || "unknown"), occurrences: Number(priority.evidenceCount || priority.evidence_count || 0), source: "canonical_training_priority" }, state: { sessionStep: "recall" } },
  };
  return { available: false, provenance: "none", recoveryAction: report?.analysisId || report?.analysis_id ? "Review the source games in your report or analyse new games to build a safe task." : "Import games to build a supported coaching task." };
}

export function reviewTrainingItem(item, { correct, assistanceUsed = false, now = new Date() } = {}) {
  const previous = item.state || {};
  const failures = Number(previous.failures || 0) + (correct ? 0 : 1);
  const completedReviews = Number(previous.completedReviews || 0) + 1;
  const days = !correct ? 0 : assistanceUsed ? 1 : failures >= 2 ? 1 : Math.min(14, [1, 3, 7, 14][Math.min(3, completedReviews - 1)]);
  const due = new Date(now); due.setUTCDate(due.getUTCDate() + days);
  return {
    ...item,
    state: { ...previous, mode: correct && !assistanceUsed ? "continue" : "retest", attempts: Number(previous.attempts || 0) + 1, correct: Number(previous.correct || 0) + (correct ? 1 : 0), failures, assistanceUsed: Boolean(previous.assistanceUsed || assistanceUsed), completedReviews, lastResult: correct ? (assistanceUsed ? "correct_with_help" : "correct") : "incorrect", lastReviewedAt: iso(now) },
    reviewSchedule: { dueAt: iso(due), intervalDays: days, priority: item.reviewSchedule?.priority || 1, reason: !correct ? "Incorrect answer; retest now" : assistanceUsed ? "Correct with help; review tomorrow" : `Correct without help; interval extended to ${days} day${days === 1 ? "" : "s"}` },
    updatedAt: iso(now),
  };
}

export function dueTrainingSession(items = [], { now = new Date(), limit = 5 } = {}) {
  const at = new Date(now).getTime();
  const due = list(items).filter((item) => Date.parse(item.reviewSchedule?.dueAt || 0) <= at)
    .sort((a, b) => Date.parse(a.reviewSchedule.dueAt) - Date.parse(b.reviewSchedule.dueAt) || (b.reviewSchedule.priority || 0) - (a.reviewSchedule.priority || 0) || a.itemId.localeCompare(b.itemId));
  return { items: due.slice(0, limit), dueCount: due.length, estimatedMinutes: Math.max(1, Math.min(5, due.slice(0, limit).length)) };
}

export function evaluatePersonalTrainingMove(item, attempted) {
  const played = moveAt(item.startingFen, attempted);
  if (!played) return { accepted: false, trustworthy: true, reason: "illegal_move" };
  const accepted = list(item.acceptedMoveUcis).includes(played.uci);
  return { accepted, trustworthy: true, san: played.san, alternative: accepted && played.uci !== item.expectedMoveUci, resultingFen: played.fen };
}

export function compareTrainedPosition(item, game = {}) {
  const pgn = text(game.pgn || game.rawPgn || game.raw_pgn || game.analysis?.pgn);
  if (!pgn || !item?.startingFen) return { outcome: "untrusted", trustworthy: false };
  try {
    const parsed = new Chess(); parsed.loadPgn(pgn); const moves = parsed.history({ verbose: true }); const replay = new Chess();
    for (const move of moves) {
      if (normalFen(replay.fen()) === normalFen(item.startingFen)) {
        if ((replay.turn() === "w" ? "white" : "black") !== item.playerColour) return { outcome: "untrusted", trustworthy: false };
        const played = replay.move(move); const uci = `${played.from}${played.to}${played.promotion || ""}`;
        if (list(item.acceptedMoveUcis).includes(uci)) return { outcome: uci === item.expectedMoveUci ? "trained_move" : "acceptable_alternative", trustworthy: true, playedMove: played.san };
        if (item.originalMove && cleanSan(played.san) === cleanSan(item.originalMove)) return { outcome: "repeated_original_mistake", trustworthy: true, playedMove: played.san };
        return { outcome: "other_move", trustworthy: true, playedMove: played.san };
      }
      replay.move(move);
    }
    return { outcome: "left_known_position", trustworthy: true };
  } catch { return { outcome: "untrusted", trustworthy: false }; }
}

export function evaluatePersonalTrainingOutcomes(items = [], games = []) {
  return list(items).map((item) => {
    const completedAt = Date.parse(item.state?.lastReviewedAt || item.updatedAt || item.createdAt || 0);
    const laterGames = list(games).filter((game) => {
      const value = game.playedAt || game.played_at || game.endTime || game.end_time || game.date;
      const parsed = typeof value === "number" ? (value < 1e12 ? value * 1000 : value) : Date.parse(value || 0);
      return Number.isFinite(completedAt) && Number.isFinite(parsed) && parsed > completedAt;
    });
    const observations = laterGames.map((game) => ({ gameId: text(game.id || game.gameId || game.game_id || game.url) || null, ...compareTrainedPosition(item, game) }));
    const trustworthy = observations.filter((row) => row.trustworthy && row.outcome !== "left_known_position");
    const accepted = trustworthy.filter((row) => ["trained_move", "acceptable_alternative"].includes(row.outcome));
    const repeated = trustworthy.filter((row) => row.outcome === "repeated_original_mistake");
    const status = trustworthy.length < 2 ? "insufficient_data"
      : accepted.length >= 2 && repeated.length === 0 ? "improved"
        : repeated.length >= 2 ? "not_improved" : "partially_improved";
    return {
      trainingFocusId: item.trainingSubjectId, itemId: item.itemId, diagnosisId: item.diagnosisId, openingId: item.openingId, opening: item.openingName,
      status, relevantPositionCount: trustworthy.length, correctApplicationCount: accepted.length, repeatedMistakeCount: repeated.length,
      observations, confidence: trustworthy.length >= 3 ? "high" : trustworthy.length >= 2 ? "medium" : "low",
      message: status === "improved" ? `The trained or accepted move was played in ${accepted.length} trustworthy later games.`
        : status === "not_improved" ? `The original mistake repeated in ${repeated.length} trustworthy later games.`
          : "More trustworthy later-game encounters are needed before claiming improvement.",
    };
  });
}

export function mergeTrainingState(generated = [], stored = [], ownerId) {
  const saved = new Map(list(stored).filter((item) => item.ownerId === ownerId).map((item) => [item.itemId, item]));
  return generated.map((item) => {
    const prior = saved.get(item.itemId);
    return prior ? { ...item, state: prior.state, reviewSchedule: prior.reviewSchedule, createdAt: prior.createdAt, updatedAt: prior.updatedAt } : item;
  });
}
