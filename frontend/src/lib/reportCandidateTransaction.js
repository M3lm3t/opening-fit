import { buildCanonicalReportPresentation } from "./canonicalReportPresentation.js";
import { normaliseReportDecision } from "./recommendationEvidence.js";
import { enforceReportRoleContract, validateReportConsistency } from "./reportConsistency.js";
import { persistReport } from "./reportPersistence.js";
import { validateTrainingSubject } from "./trainingPriority.js";

export const REPORT_CANDIDATE_RESULTS = Object.freeze({
  ACCEPTED: "accepted",
  CONTRACT_REJECTED: "candidate_contract_rejected",
  CONSISTENCY_REJECTED: "candidate_consistency_rejected",
  SERIALISATION_FAILED: "local_serialisation_failed",
  WRITE_FAILED: "local_write_failed",
  READBACK_FAILED: "local_readback_failed",
  CLOUD_SYNC_FAILED: "cloud_sync_failed",
  BACKEND_IMPORT_FAILED: "backend_import_failed",
});

const text = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

function diagnosticReference(code = "candidate_rejected") {
  let hash = 2166136261;
  for (const character of String(code)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `OF-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

function safeDiagnostic(report, invariantCode, presentation = null) {
  const decision = report?.reportDecision || report?.report_decision || {};
  const priority = presentation?.trainingPriority || decision.trainingPriority || decision.nextTrainingAction || {};
  const missingFields = [];
  if (!text(report?.analysisId || report?.analysis_id || report?.reportId || report?.report_id || report?.id)) missingFields.push("reportIdentity");
  if (!text(decision.schemaVersion || decision.schema_version)) missingFields.push("decisionSchemaVersion");
  return Object.freeze({
    referenceCode: diagnosticReference(invariantCode),
    invariantCode,
    decisionId: text(decision.decisionId || decision.decision_id) || null,
    contextIds: list(presentation?.contexts).map((item) => item.contextId).filter(Boolean).slice(0, 8),
    subjectType: text(priority.subjectType || priority.findingType || priority.finding_type) || null,
    subjectRole: text(priority.subjectRole || priority.repertoireRole || priority.repertoire_role || priority.role) || null,
    games: Number(report?.normalizedGameCounts?.usedForOpeningStats ?? report?.gameCounts?.gamesUsedForOpeningStats ?? report?.gamesAnalysed ?? report?.games_analyzed ?? 0) || 0,
    contextCount: list(presentation?.contexts).length,
    missingFields,
    contractVersion: report?.gameCounts?.contractVersion ?? report?.game_counts?.contractVersion ?? null,
    decisionSchemaVersion: decision.schemaVersion ?? decision.schema_version ?? null,
  });
}

function rejected(type, report, violations, presentation = null) {
  const unique = [...new Set(list(violations).map(text).filter(Boolean))];
  const invariantCode = unique[0] || "candidate_contract_invalid";
  return { ok: false, type, candidate: null, presentation, violations: unique, diagnostic: safeDiagnostic(report, invariantCode, presentation) };
}

function trainingSubjectViolations(report = {}) {
  const decision = report.reportDecision || report.report_decision || {};
  const sources = [
    decision.trainingPriority || decision.training_priority,
    decision.primaryAction || decision.primary_action || decision.nextTrainingAction || decision.next_training_action,
    report.trainingPriority || report.training_priority,
  ].filter((source, index, values) => source && typeof source === "object" && values.indexOf(source) === index);
  const explicit = sources.filter((source) => text(source.subjectType || source.subject_type));
  const violations = explicit.flatMap((source) => {
    const validation = validateTrainingSubject(source);
    return validation.valid ? [] : [`invalid_training_subject:${validation.reason || "invalid"}`];
  });
  const identities = new Set(explicit.map((source) => [
    text(source.subjectType || source.subject_type),
    text(source.subjectRole || source.repertoireRole || source.repertoire_role || source.playerRole),
    text(source.openingKey || source.openingId || source.openingName),
    text(source.diagnosisId || source.diagnosis_id),
  ].join("::")));
  if (identities.size > 1) violations.push("mixed_training_subjects");
  return violations;
}

export function evaluateReportCandidate(report = {}) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return rejected(REPORT_CANDIDATE_RESULTS.CONTRACT_REJECTED, report, ["invalid_report"]);
  }

  const roleContract = enforceReportRoleContract(report);
  const sourceDecision = report.reportDecision || report.report_decision || {};
  if (Number(sourceDecision.schemaVersion || sourceDecision.schema_version || 0) >= 5 && !roleContract.valid) {
    return rejected(REPORT_CANDIDATE_RESULTS.CONTRACT_REJECTED, roleContract.report, roleContract.violations);
  }
  const subjectViolations = trainingSubjectViolations(roleContract.report);
  if (subjectViolations.length) {
    return rejected(REPORT_CANDIDATE_RESULTS.CONTRACT_REJECTED, roleContract.report, subjectViolations);
  }

  const decision = normaliseReportDecision(
    roleContract.report?.reportDecision || roleContract.report?.report_decision || null,
    roleContract.report,
  );
  const candidate = { ...roleContract.report, reportDecision: decision, report_decision: decision };
  const presentation = buildCanonicalReportPresentation(candidate);
  if (!presentation.reportId) {
    return rejected(REPORT_CANDIDATE_RESULTS.CONTRACT_REJECTED, candidate, ["invalid_report_identity"], presentation);
  }

  const consistency = validateReportConsistency(candidate);
  if (consistency.enforceable && !consistency.valid) {
    return rejected(REPORT_CANDIDATE_RESULTS.CONSISTENCY_REJECTED, candidate, consistency.violations, presentation);
  }
  return { ok: true, type: REPORT_CANDIDATE_RESULTS.ACCEPTED, candidate, presentation, violations: [], diagnostic: null };
}

export function commitReportCandidate({ storage, key, report, payload = {} } = {}) {
  const evaluated = evaluateReportCandidate(report);
  if (!evaluated.ok) return evaluated;
  const persisted = persistReport(storage, key, { ...payload, analysis: evaluated.candidate });
  if (!persisted.ok) {
    const type = Object.values(REPORT_CANDIDATE_RESULTS).includes(persisted.reason)
      ? persisted.reason
      : REPORT_CANDIDATE_RESULTS.WRITE_FAILED;
    return {
      ok: false,
      type,
      candidate: null,
      presentation: evaluated.presentation,
      violations: [],
      diagnostic: safeDiagnostic(evaluated.candidate, type, evaluated.presentation),
      rollbackFailed: persisted.rollbackFailed === true,
    };
  }
  return { ...evaluated, payload: persisted.payload, serialized: persisted.serialized };
}

export function candidateFailureMessage(result, { hadPreviousReport = false } = {}) {
  if ([REPORT_CANDIDATE_RESULTS.CONTRACT_REJECTED, REPORT_CANDIDATE_RESULTS.CONSISTENCY_REJECTED].includes(result?.type)) {
    return {
      title: "Report was not replaced",
      message: "We analysed the games but could not safely build the report. Your previous report was not replaced.",
      category: result.type,
      referenceCode: result.diagnostic?.referenceCode || diagnosticReference(result?.type),
      recoveryActions: ["retry", ...(hadPreviousReport ? ["last_report"] : [])],
    };
  }
  return {
    title: "Report was not replaced",
    message: hadPreviousReport
      ? "The report was built, but this browser could not verify the local save. Your previous successful report was restored."
      : "The report was built, but this browser could not verify the local save. No completed report was stored.",
    category: result?.type || REPORT_CANDIDATE_RESULTS.WRITE_FAILED,
    referenceCode: result?.diagnostic?.referenceCode || diagnosticReference(result?.type),
    recoveryActions: ["retry", ...(hadPreviousReport ? ["last_report"] : [])],
  };
}
