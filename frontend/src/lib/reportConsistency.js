import { canonicalReportAction } from "./reportViews.js";

const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? "").trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

function contextKey(row = {}) {
  return [row.openingId || row.opening_id || row.openingName || row.opening, row.repertoireRole || row.repertoire_role, row.role, row.relationship, row.playerColour || row.player_colour].map(text).join("::");
}

function confidenceDimensions(row = {}) {
  return [
    ["sample-size", row.sampleSizeConfidence || row.evidenceConfidence],
    ["classification", row.classificationConfidence],
    ["role-attribution", row.roleAttributionConfidence],
    ["recommendation", row.recommendationConfidence],
  ];
}

const ACTION_SUPPORT = Object.freeze({
  open_evidence: "evidence",
  open_diagnosed_problem: "problems",
  open_repertoire_priority: "repertoire",
  open_training_priority: "train",
});

export function validateReportConsistency(report = {}) {
  const decision = report.reportDecision || report.report_decision || {};
  const recommendations = list(decision.recommendations);
  const enforceable = Number(decision.schemaVersion || decision.schema_version || 0) >= 5;
  const violations = [];
  const verdictById = new Map();
  const contexts = new Set();

  for (const row of recommendations) {
    const decisionId = text(row.decisionId || row.recommendationId);
    const verdict = text(row.verdict).toLowerCase();
    if (decisionId && verdictById.has(decisionId) && verdictById.get(decisionId) !== verdict) violations.push(`conflicting_verdict:${decisionId}`);
    if (decisionId) verdictById.set(decisionId, verdict);

    const ids = list(row.sample?.gameIds || row.sample?.game_ids).map(text).filter(Boolean);
    if (ids.length !== new Set(ids).size) violations.push(`duplicate_game_in_aggregate:${decisionId || contextKey(row)}`);

    const key = contextKey(row);
    if (contexts.has(key)) violations.push(`duplicate_opening_context:${key}`);
    contexts.add(key);

    const colour = text(row.playerColour || row.player_colour).toLowerCase();
    const role = text(row.repertoireRole || row.repertoire_role).toLowerCase();
    if (colour === "white" && role.startsWith("black_")) violations.push(`white_candidate_in_black_role:${decisionId || key}`);

    if (enforceable) {
      for (const [dimension, confidence] of confidenceDimensions(row)) {
        const label = text(confidence?.label || confidence?.scope);
        if (!confidence || !label) violations.push(`missing_${dimension}_confidence:${decisionId || key}`);
      }
    }
  }

  for (const role of list(decision.repertoireRoles || decision.roleDecisions)) {
    const current = number(role.supportingGameCount ?? role.evidenceCount ?? role.sampleSize);
    const threshold = number(role.requiredGameCount ?? role.sampleThreshold ?? role.evidenceRequirement?.threshold);
    const stated = number(role.evidenceRequirement?.additionalRelevantGamesRequired ?? role.evidenceFunnel?.additionalRequired ?? role.gamesNeeded);
    if (current !== null && threshold !== null && stated !== null && stated !== Math.max(0, threshold - current)) violations.push(`games_needed_mismatch:${text(role.repertoireRole || role.key)}`);
    const action = decision.primaryAction || decision.nextTrainingAction || {};
    if (text(action.repertoireRole) === text(role.repertoireRole) && action.completionTarget?.type === "new_games" && stated !== null && number(action.completionTarget.count) !== stated) violations.push(`games_needed_cta_mismatch:${text(role.repertoireRole)}`);
  }

  const diagnoses = list(report.displayedDiagnoses || decision.displayedDiagnoses);
  const diagnosisIds = diagnoses.map((item) => text(item?.diagnosisId || item?.diagnosis_id)).filter(Boolean);
  if (diagnosisIds.length !== new Set(diagnosisIds).size) violations.push("duplicate_diagnosis_id");
  if (diagnoses.some((item) => !text(item?.diagnosisId || item?.diagnosis_id))) violations.push("missing_diagnosis_id");

  for (const rawAction of list(report.reportActions)) {
    const action = canonicalReportAction(rawAction);
    if (!action.destinationRoute || !action.destinationSection) violations.push(`unknown_action_destination:${action.actionType}`);
    const supportedSection = ACTION_SUPPORT[action.actionType];
    if (supportedSection && action.destinationSection !== supportedSection) violations.push(`unsupported_action_destination:${action.actionType}`);
    if (action.actionType === "start_training" && !/^\/train(?:\?|$)/.test(action.destinationRoute)) violations.push("unsupported_action_destination:start_training");
  }

  const quality = report.importQuality || report.gameImportQuality || {};
  const complete = quality.reportCompleteness?.complete;
  const category = text(quality.category).toLowerCase();
  if (/strong|excellent/.test(category) && complete !== true) violations.push("quality_exceeds_report_completeness");

  const componentClaims = new Map();
  for (const component of list(decision.repertoireHealth?.components || report.repertoireHealth?.components)) {
    const target = text(component.targetDecisionId || component.targetDiagnosisId);
    const source = text(component.evidenceSource || component.source);
    if (!target || !source) continue;
    const claim = `${text(component.status)} ${text(component.explanation)}`.toLowerCase();
    const polarity = /drag|hurt|negative|weak/.test(claim) ? "negative" : /help|strength|positive|support/.test(claim) ? "positive" : "neutral";
    const key = `${target}::${source}`;
    if (componentClaims.has(key) && componentClaims.get(key) !== polarity && ![componentClaims.get(key), polarity].includes("neutral")) violations.push(`contradictory_health_component:${key}`);
    componentClaims.set(key, polarity);
  }

  return { valid: violations.length === 0, enforceable, violations };
}

export function assertGeneratedReportConsistency(report = {}) {
  const result = validateReportConsistency(report);
  if (result.enforceable && !result.valid) throw new Error(`report_consistency: ${result.violations.join(", ")}`);
  return result;
}
