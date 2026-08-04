import { formatOpeningNameForDisplay } from "./openingNamePresentation.js";
import { canonicalResultAggregate } from "./reportResults.js";
import { resolveTrainingPriority, TRAINING_SUBJECT_TYPES } from "./trainingPriority.js";

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const unique = (value) => [...new Set(list(value).map(String).filter(Boolean))];

const CONFIDENCE_LABELS = Object.freeze({
  high: "High confidence",
  high_sample: "High confidence",
  trusted: "High confidence",
  medium: "Medium confidence",
  moderate: "Medium confidence",
  low: "Low confidence",
  very_early: "Very early signal",
  insufficient: "Insufficient evidence",
  insufficient_data: "Insufficient evidence",
  context_uncertain: "Context uncertain",
  sufficient: "Sufficient evidence",
});

export function canonicalConfidence(value, fallback = null) {
  const source = value && typeof value === "object" ? value : {};
  const raw = text(source.level || source.code || source.status || value || fallback).toLowerCase().replace(/[ -]+/g, "_");
  const code = raw || "unavailable";
  return { code, label: text(source.label) || CONFIDENCE_LABELS[code] || "Evidence unavailable" };
}

export function formatCanonicalScoreRate(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Unavailable";
  const rounded = Number(Number(value).toFixed(digits));
  return `${rounded}%`;
}

function perspective(source = {}) {
  const role = text(source.role || source.openingRole || source.opening_role).toLowerCase();
  const relationship = text(source.relationship || source.perspective?.relationship).toLowerCase();
  const playedByUser = source.repertoireOwned === true || source.playedByUser === true || role.startsWith("played_") || relationship === "played" || relationship === "played_by_user";
  return { role: role || "unknown", relationship: relationship || (playedByUser ? "played_by_user" : "unknown"), playedByUser };
}

function contextIdentity(source = {}, openingId, playerPerspective) {
  return text(source.contextId || source.context_id || source.canonicalContextId || source.canonical_context_id || source.recommendationId)
    || [openingId || "opening-unavailable", text(source.repertoireRole || source.repertoire_role || playerPerspective) || "role-unavailable", playerPerspective].join(":");
}

function diagnosisFor(decision = {}, source = {}) {
  const diagnoses = [decision.openingDiagnosis, decision.opening_diagnosis, ...list(decision.diagnoses), ...list(decision.displayedDiagnoses)].filter(Boolean);
  const ids = new Set([source.decisionId, source.decision_id, source.recommendationId, source.contextId, source.context_id].filter(Boolean).map(String));
  return diagnoses.find((item) => [item.canonicalDecisionId, item.canonical_decision_id, item.decisionId, item.decision_id, item.recommendationId, item.contextId].filter(Boolean).some((id) => ids.has(String(id)))) || null;
}

function canonicalCandidates(report = {}) {
  const decision = report.reportDecision || report.report_decision || {};
  const recommendations = list(decision.recommendations);
  if (recommendations.length) return recommendations;
  return [decision.establishedStrength, decision.established_strength, decision.primaryProblem, decision.primary_problem].filter(Boolean);
}

function presentationPriority(report = {}, decision = {}) {
  const action = decision.nextTrainingAction || decision.next_training_action || decision.primaryAction || decision.primary_action || {};
  const permitsRoleGap = /fill_repertoire_gap|repertoire_gap/.test(`${action.type || ""} ${action.findingType || action.finding_type || ""}`.toLowerCase());
  return resolveTrainingPriority(report, { allowFallback: permitsRoleGap });
}

function toContext(report, source, decision, priority) {
  const openingName = formatOpeningNameForDisplay(source.openingName || source.opening_name || source.opening || source.name);
  const openingId = text(source.openingId || source.opening_id || source.canonicalOpeningId || source.canonical_opening_id) || null;
  const view = perspective(source);
  const contextId = contextIdentity(source, openingId, view.role);
  const aggregate = canonicalResultAggregate(source, { precision: 2 });
  const sample = source.sample || {};
  const gameIds = unique(sample.gameIds || sample.game_ids || source.gameIds || source.game_ids || source.evidenceGameIds || source.evidence_game_ids);
  const confidence = canonicalConfidence(source.evidenceConfidence || source.evidence_confidence || source.sampleSizeConfidence || source.sample_size_confidence || source.confidence || source.confidenceLevel || source.confidence_level, decision.confidence?.status);
  const diagnosis = diagnosisFor(decision, source);
  const verdict = text(source.verdict || source.recommendation).toLowerCase().replace(/_/g, "-") || "evidence-unavailable";
  const evidenceDestination = { section: diagnosis ? "problems" : "evidence", contextId, decisionId: text(source.decisionId || source.decision_id) || null, diagnosisId: text(diagnosis?.diagnosisId || diagnosis?.diagnosis_id) || null };
  const ownsPriority = priority && [priority.decisionId, priority.recommendationId, priority.openingId, priority.openingKey].filter(Boolean).map(String).some((id) => [source.decisionId, source.recommendationId, openingId].filter(Boolean).map(String).includes(id));
  return Object.freeze({
    contextId,
    decisionId: text(source.decisionId || source.decision_id || decision.decisionId || decision.decision_id) || null,
    openingId,
    openingName: openingName || null,
    role: text(source.repertoireRole || source.repertoire_role) || view.role,
    playerPerspective: view.role,
    playedByUser: view.playedByUser,
    relationship: view.relationship,
    gameIds,
    gameCount: aggregate.games,
    wins: aggregate.wins,
    draws: aggregate.draws,
    losses: aggregate.losses,
    scoreRate: aggregate.scoreRate,
    confidenceCode: confidence.code,
    confidenceLabel: confidence.label,
    verdict,
    diagnosisId: evidenceDestination.diagnosisId,
    diagnosisType: text(diagnosis?.diagnosisType || diagnosis?.diagnosis_type || diagnosis?.diagnosisScope || diagnosis?.diagnosis_scope) || null,
    trainingSubjectType: ownsPriority ? priority.subjectType || (priority.openingName ? TRAINING_SUBJECT_TYPES.OPENING : null) : null,
    trainingTaskId: ownsPriority ? priority.taskId || priority.trainingTaskId || null : null,
    evidenceDestination,
    source,
  });
}

function mergeDuplicateContexts(contexts) {
  const merged = new Map();
  for (const current of contexts) {
    const key = `${current.contextId}|${current.playerPerspective}`;
    const previous = merged.get(key);
    if (!previous) { merged.set(key, current); continue; }
    const richer = current.gameIds.length > previous.gameIds.length || current.gameCount > previous.gameCount ? current : previous;
    merged.set(key, Object.freeze({ ...richer, gameIds: unique([...previous.gameIds, ...current.gameIds]) }));
  }
  return [...merged.values()];
}

export function buildCanonicalContextPresentation(report = {}) {
  const decision = report.reportDecision || report.report_decision || {};
  const priority = presentationPriority(report, decision);
  return Object.freeze(mergeDuplicateContexts(canonicalCandidates(report).map((source) => toContext(report, source, decision, priority))));
}

function reportIdentity(report = {}) {
  return text(report.analysisId || report.analysis_id || report.reportId || report.report_id || report.id) || null;
}

export function buildCanonicalReportPresentation(report = {}) {
  const decision = report.reportDecision || report.report_decision || {};
  const contexts = buildCanonicalContextPresentation(report);
  const priority = presentationPriority(report, decision);
  const health = decision.repertoireHealth || decision.repertoire_health || report.repertoireHealth || report.repertoire_health || report.repertoireCoverageScore || report.repertoire_coverage_score || null;
  const reportConfidence = canonicalConfidence(decision.confidence || health?.confidence || null);
  const owned = contexts.filter((item) => item.playedByUser);
  return Object.freeze({
    reportId: reportIdentity(report),
    contexts,
    healthScore: Number.isFinite(Number(health?.score)) ? Math.round(Number(health.score)) : null,
    reportConfidenceCode: reportConfidence.code,
    reportConfidenceLabel: reportConfidence.label,
    strength: owned.find((item) => item.verdict === "keep") || null,
    weakness: owned.find((item) => item.verdict === "repair") || null,
    trainingPriority: priority || null,
  });
}
