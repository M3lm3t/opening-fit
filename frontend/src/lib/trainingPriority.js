import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";
import { countNoun } from "./reportGameCounts.js";

export const TRAINING_PRIORITY_SCHEMA_VERSION = 1;

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const integer = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
};

function slug(value) {
  const normalized = normaliseOpeningKey(value);
  return text(normalized || value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
}

function reportDecision(report = {}, supplied = null) {
  return supplied || report.reportDecision || report.report_decision || {};
}

function prioritySource(report = {}, decision = {}) {
  const explicit = report.trainingPriority || report.training_priority || decision.trainingPriority || decision.training_priority;
  if (explicit && typeof explicit === "object") return explicit;
  const action = decision.nextTrainingAction || decision.next_training_action || report.nextTrainingAction || report.next_training_action;
  if (action && typeof action === "object" && text(action.type || action.actionType || action.action_type).toLowerCase() !== "collect_more_games") return action;
  const legacy = list(report.nextTrainingActions || report.next_training_actions || report.trainingPlan || report.training_plan)[0];
  return legacy && typeof legacy === "object" ? legacy : null;
}

function targetFor(source, decision = {}) {
  const recommendationId = text(source?.recommendationId || source?.recommendation_id);
  return list(decision.recommendations).find((item) => text(item?.recommendationId || item?.recommendation_id) === recommendationId) || null;
}

function colourFor(source = {}, target = {}) {
  const explicit = text(source.playerColour || source.player_colour || source.colour || source.color || target?.playerColour || target?.player_colour).toLowerCase();
  if (["white", "black"].includes(explicit)) return explicit;
  const role = text(source.role || target?.role).toLowerCase();
  return role.endsWith("_black") ? "black" : role.endsWith("_white") ? "white" : null;
}

function taskTypeFor(source = {}) {
  const explicit = text(source.taskType || source.task_type);
  if (explicit) return explicit;
  const type = text(source.type).toLowerCase();
  if (source.lineOrPosition || source.line_or_position || source.positionFen || source.position_fen) return "position_drill";
  if (type === "collect_more_games") return "concept_review";
  if (["repair_repertoire", "prepare_against", "consolidate_strength", "repair", "keep"].includes(type)) return "game_review";
  return "concept_review";
}

function canonicalPriority(source, report, decision) {
  if (!source || typeof source !== "object") return null;
  const target = targetFor(source, decision);
  const sample = source.sample && typeof source.sample === "object" ? source.sample : target?.sample || {};
  const openingName = text(target?.openingName || target?.opening || source.openingName || source.opening_name || source.opening) || null;
  const actionType = text(source.type || source.actionType || source.action_type || "review");
  const recommendationId = text(source.recommendationId || source.recommendation_id || target?.recommendationId);
  const openingKey = text(source.openingKey || source.opening_key || source.openingId || source.opening_id || target?.openingId) || (openingName ? slug(openingName) : null);
  const priorityId = text(source.priorityId || source.priority_id || source.taskId || source.task_id) || `training-${recommendationId || `${actionType}:${openingKey || "report"}`}`;
  const completion = source.completionTarget && typeof source.completionTarget === "object" ? source.completionTarget : {};
  const duration = Math.max(1, integer(source.estimatedDurationMinutes ?? source.estimated_duration_minutes ?? source.estimatedMinutes ?? source.estimated_minutes, 10));
  const fallback = source.fallback === true || source.isFallback === true || source.is_fallback === true;
  const title = text(source.trainingTitle || source.training_title || source.title) || (openingName ? `Practise ${openingName}` : text(source.label)) || "Review your current opening evidence";
  return {
    schemaVersion: TRAINING_PRIORITY_SCHEMA_VERSION,
    priorityId,
    taskId: text(source.taskId || source.task_id) || priorityId,
    recommendationId: recommendationId || null,
    openingName,
    openingKey,
    role: text(source.role || target?.role) || null,
    playerColour: colourFor(source, target),
    taskType: taskTypeFor(source),
    actionType,
    title,
    rationale: text(source.rationale || source.reason || source.explanation) || "Review the available report evidence before your next games.",
    evidenceCount: integer(source.evidenceCount ?? source.evidence_count ?? sample.games ?? source.games),
    evidenceGameIds: list(source.evidenceGameIds || source.evidence_game_ids || sample.gameIds || sample.game_ids || source.sourceGameIds || source.source_game_ids).map(text).filter(Boolean),
    estimatedDurationMinutes: duration,
    successCheck: text(source.successCheck || source.success_check || source.successCriteria || source.success_criteria || completion.label) || "Complete the practice and record one practical takeaway.",
    confidenceStatus: text(source.confidenceStatus || source.confidence_status || target?.confidence?.level || source.confidence?.level || source.confidence) || "unknown",
    sourceReportId: text(source.sourceReportId || source.source_report_id || report.analysisId || report.analysis_id || report.report_id || report.id) || null,
    lineOrPosition: text(source.lineOrPosition || source.line_or_position || source.line || source.moveLine || source.move_line) || null,
    positionFen: text(source.positionFen || source.position_fen) || null,
    expectedMoves: list(source.expectedMoves || source.expected_moves).map(text).filter(Boolean),
    fallback,
    fallbackReason: text(source.fallbackReason || source.fallback_reason) || null,
  };
}

function fallbackOpening(report = {}, decision = {}) {
  const strength = decision.establishedStrength || decision.established_strength;
  const candidates = [strength, ...list(report.topOpenings || report.top_openings || report.bestOpenings || report.best_openings || report.openings)];
  const source = candidates.find((item) => text(item?.opening || item?.openingName || item?.name)) || {};
  const rawName = text(source.opening || source.openingName || source.name) || "opening fundamentals";
  const known = findOpeningLine(rawName);
  return {
    name: known?.name || rawName,
    key: text(source.openingId || source.opening_id) || known?.id || slug(rawName),
    games: integer(source.sample?.games ?? source.games),
    colour: colourFor(source),
  };
}

function fallbackPriority(report, decision) {
  const opening = fallbackOpening(report, decision);
  const hasNamedOpening = opening.name !== "opening fundamentals";
  const evidence = opening.games > 0 ? `${countNoun(opening.games, "relevant game")} ${opening.games === 1 ? "supports" : "support"} ${opening.name} overall, but ` : "";
  const reason = hasNamedOpening
    ? `${evidence}not enough repeated examples of one ${opening.name} branch are available to recommend a narrower drill confidently.`
    : "The report does not contain enough repeated examples of one opening-specific branch to recommend a narrower drill confidently.";
  const priorityId = `training-fallback:${opening.key}`;
  return {
    schemaVersion: TRAINING_PRIORITY_SCHEMA_VERSION,
    priorityId,
    taskId: priorityId,
    openingName: hasNamedOpening ? opening.name : null,
    openingKey: hasNamedOpening ? opening.key : null,
    role: null,
    playerColour: opening.colour,
    taskType: "concept_review",
    actionType: "fallback",
    title: hasNamedOpening ? `Review one familiar ${opening.name} setup` : "Review one familiar opening setup",
    rationale: reason,
    evidenceCount: opening.games,
    evidenceGameIds: [],
    estimatedDurationMinutes: 10,
    successCheck: "Name one development cue and one practical response for your next game.",
    confidenceStatus: "insufficient_branch_evidence",
    sourceReportId: text(report.analysisId || report.analysis_id || report.report_id || report.id) || null,
    lineOrPosition: null,
    positionFen: null,
    expectedMoves: [],
    fallback: true,
    fallbackReason: reason,
  };
}

export function resolveTrainingPriority(report = {}, { decision: suppliedDecision = null, allowFallback = true } = {}) {
  const decision = reportDecision(report, suppliedDecision);
  const resolved = canonicalPriority(prioritySource(report, decision), report, decision);
  if (resolved) return resolved;
  return allowFallback ? fallbackPriority(report, decision) : null;
}

export function formatTrainingPriorityTitle(priority, { prefix = true } = {}) {
  const duration = integer(priority?.estimatedDurationMinutes, 10);
  const focus = priority?.openingName ? `practise ${priority.openingName}` : text(priority?.title).replace(/[.!]+$/, "").toLowerCase();
  const sentence = `${focus || "review one recent opening game"} for approximately ${duration} minutes`;
  return `${prefix ? "This week: " : ""}${sentence}.`;
}

export function trainingTaskFromPriority(priority, order = 1) {
  if (!priority) return null;
  return {
    id: priority.taskId || priority.priorityId,
    type: priority.taskType,
    title: formatTrainingPriorityTitle(priority, { prefix: false }).replace(/\.$/, ""),
    explanation: priority.rationale,
    openingId: priority.openingKey,
    openingName: priority.openingName,
    trainingSide: priority.playerColour,
    sourceGameIds: priority.evidenceGameIds,
    positionFen: priority.positionFen,
    expectedMoves: priority.expectedMoves,
    successCriteria: priority.successCheck,
    estimatedMinutes: priority.estimatedDurationMinutes,
    order,
    status: "pending",
    trainingPriorityId: priority.priorityId,
    fallback: priority.fallback,
    fallbackReason: priority.fallbackReason,
    fixedDuration: true,
  };
}

export function trainingPlanMatchesPriority(plan, priority) {
  if (!plan || !priority) return false;
  const planPriorityId = text(plan.trainingPriorityId || plan.training_priority_id || plan.trainingPriority?.priorityId || plan.targetMetric?.trainingPriorityId || plan.target_metric?.trainingPriorityId);
  return Boolean(planPriorityId && planPriorityId === priority.priorityId);
}
