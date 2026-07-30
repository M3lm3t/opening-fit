import { normaliseOpeningKey } from "../data/openings.ts";
import { analysisConfidence, buildOpeningVerdictPresentation, openingFitScore } from "./fitTrustModel.js";
import { formatOpeningNameForDisplay } from "./openingNamePresentation.js";
import { normaliseRepertoireRoleEvidence, repertoireRoleEvidenceCopy } from "./repertoireEvidence.js";
import { resolveTrainingPriority } from "./trainingPriority.js";

export const CORE_REPERTOIRE_ROLES = Object.freeze([
  { key: "white", role: "white", label: "White", contextKey: "white" },
  { key: "black_e4", role: "black_vs_e4", label: "Black against 1.e4", contextKey: "black_e4" },
  { key: "black_d4", role: "black_vs_d4", label: "Black against 1.d4", contextKey: "black_d4" },
]);

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const openingName = (value = {}) => {
  const source = value && typeof value === "object" ? value : {};
  return formatOpeningNameForDisplay(source.openingName || source.opening_name || source.opening || source.displayName || source.display_name || source.name);
};
const openingKey = (value) => normaliseOpeningKey(openingName(typeof value === "object" ? value : { name: value }));

function contextKey(candidate = {}) {
  const repertoireRole = text(candidate.repertoireRole || candidate.repertoire_role || candidate.perspective?.repertoireRole).toLowerCase();
  if (repertoireRole === "white") return "white";
  if (repertoireRole === "black_vs_e4") return "black_e4";
  if (repertoireRole === "black_vs_d4") return "black_d4";
  const role = text(candidate.role || candidate.openingRole || candidate.opening_role).toLowerCase();
  const slot = text(candidate.repertoireSlot || candidate.repertoire_slot || candidate.contextKey || candidate.context_key || candidate.context).toLowerCase();
  if (role === "played_as_white" || ["white", "white_repertoire", "white_primary"].includes(slot)) return "white";
  if (["black_e4", "black_vs_e4"].includes(slot)) return "black_e4";
  if (["black_d4", "black_vs_d4"].includes(slot)) return "black_d4";
  return null;
}

function verdictValue(source = {}) {
  return text(source.verdict || source.fitVerdict || source.fit_verdict || source.recommendation || source.status).toLowerCase();
}

export function normaliseRoleVerdict(value, { established = false, relevantGames = 0 } = {}) {
  const raw = text(value).toLowerCase();
  if (/keep|strong|reliable|main weapon/.test(raw)) return "keep";
  if (/repair|improve|fix|weak|struggling/.test(raw)) return "improve";
  if (/watch|explore|review|track|mixed/.test(raw)) return "watch";
  if (/insufficient|not enough|missing|unresolved/.test(raw)) return "insufficient_evidence";
  if (!established && relevantGames < 5) return "insufficient_evidence";
  return "watch";
}

export function roleVerdictLabel(value) {
  return ({ keep: "Keep", improve: "Improve", watch: "Watch", insufficient_evidence: "Insufficient evidence" })[value] || "Watch";
}

function candidateFor(role, base, candidates) {
  const eligible = list(candidates).filter((candidate) => contextKey(candidate) === role.contextKey);
  const target = openingKey(base?.opening || base?.openingName || base?.opening_name);
  if (target) return eligible.find((candidate) => openingKey(candidate) === target) || null;
  return eligible.sort((left, right) => Number(right.sample?.games ?? right.games ?? 0) - Number(left.sample?.games ?? left.games ?? 0))[0] || null;
}

function recommendationReason(candidate, evidence) {
  return text(candidate?.trainingAction?.explanation || candidate?.training_action?.explanation || candidate?.recommendationReason || candidate?.recommendation_reason || candidate?.reason)
    || evidence.explanation;
}

/**
 * Presentation precedence is intentionally fixed:
 * 1. current structured role counts/status and the matching structured recommendation;
 * 2. matching calculated opening statistics supplied by the current report;
 * 3. compatible named legacy role/recommendation fields;
 * 4. a conservative unresolved fallback with no invented score or confidence.
 *
 * This selector resolves existing evidence. It does not recalculate backend decisions.
 */
export function buildAuthoritativeRoleViewModels({ baseRoles = [], candidates = [], userIntentions = {} } = {}) {
  const roles = new Map(list(baseRoles).map((item) => [text(item.key), item]));
  return CORE_REPERTOIRE_ROLES.map((role) => {
    const base = roles.get(role.key) || {};
    const candidate = candidateFor(role, base, candidates);
    const rawCount = finite(base.evidenceCount ?? base.evidence_count ?? base.games)
      ? Number(base.evidenceCount ?? base.evidence_count ?? base.games)
      : finite(candidate?.sample?.games ?? candidate?.games) ? Number(candidate.sample?.games ?? candidate.games) : null;
    const threshold = Number(base.evidenceRequirement?.threshold ?? base.evidence_requirement?.threshold ?? 5);
    // Older saved reports often stored the role count but no status. Preserve their
    // established role only when that recorded count meets the same shared threshold.
    const compatibleStatus = !base.status && rawCount !== null && rawCount >= threshold ? "supported" : base.status === "established" ? "supported" : base.status === "building" ? "tentative" : base.status;
    const evidenceInput = { ...base, status: compatibleStatus, games: rawCount, key: role.key, label: role.label };
    const normalized = normaliseRepertoireRoleEvidence(evidenceInput);
    const evidence = repertoireRoleEvidenceCopy(evidenceInput);
    const count = finite(normalized.leading) ? Number(normalized.leading) : rawCount;
    const candidateCount = finite(candidate?.sample?.games ?? candidate?.games) ? Number(candidate.sample?.games ?? candidate.games) : null;
    const candidateEvidenceValid = candidate?.validation?.valid !== false && !(count !== null && candidateCount !== null && count !== candidateCount);
    const validEstablished = normalized.valid && normalized.established;
    const canonicalStatus = text(base.status).toLowerCase();
    const status = validEstablished
      ? "established"
      : canonicalStatus === "insufficient" ? "insufficient"
      : canonicalStatus === "unresolved" ? "unresolved"
      : count > 0 ? "building" : "insufficient";
    const mergedMetricSource = candidate ? { ...candidate, sample: { ...(candidate.sample || {}), games: count ?? candidate.sample?.games ?? candidate.games } } : count !== null ? { games: count } : {};
    const presentation = buildOpeningVerdictPresentation(mergedMetricSource, { verdict: verdictValue(candidate || base) || "Watch" });
    const confidence = analysisConfidence(mergedMetricSource);
    const verdict = candidateEvidenceValid
      ? normaliseRoleVerdict(verdictValue(candidate || base), { established: status === "established", relevantGames: count || 0 })
      : "insufficient_evidence";
    const displayName = openingName(base) || openingName(candidate) || "Not established yet";
    const fitScore = candidate && candidateEvidenceValid ? openingFitScore(candidate) : null;
    const performanceScore = candidate ? presentation.performance.score : null;
    const sourceTier = candidate && base?.status ? "structured_role_and_recommendation" : candidate ? "calculated_opening_statistics" : displayName !== "Not established yet" ? "legacy_role_fallback" : "conservative_fallback";
    const alternative = base.compatibleAlternative || base.compatible_alternative || null;
    const alternativeRole = text(base.alternativeRole || base.alternative_role || alternative?.repertoireRole || alternative?.repertoire_role).toLowerCase();
    const alternativeSupporting = finite(alternative?.supportingGameCount ?? alternative?.supporting_game_count ?? alternative?.evidenceCounts?.supportingGames ?? alternative?.sample?.games)
      ? Number(alternative.supportingGameCount ?? alternative.supporting_game_count ?? alternative.evidenceCounts?.supportingGames ?? alternative.sample?.games) : null;
    const alternativeRequired = finite(alternative?.requiredGameCount ?? alternative?.required_game_count ?? alternative?.evidenceCounts?.requiredGames)
      ? Number(alternative.requiredGameCount ?? alternative.required_game_count ?? alternative.evidenceCounts?.requiredGames) : threshold;
    const compatibleAlternative = alternative
      && alternativeRole === role.role
      && alternative?.validation?.valid !== false
      && alternativeSupporting !== null
      && alternativeSupporting >= alternativeRequired
      ? alternative
      : null;
    const counts = candidate?.evidenceCounts || candidate?.evidence_counts || {};
    const supporting = finite(base.supportingGameCount ?? base.supporting_game_count ?? counts.supportingGames ?? count)
      ? Number(base.supportingGameCount ?? base.supporting_game_count ?? counts.supportingGames ?? count) : null;
    const raw = finite(base.rawGameCount ?? base.raw_game_count ?? counts.classifiedOpeningGames)
      ? Number(base.rawGameCount ?? base.raw_game_count ?? counts.classifiedOpeningGames) : null;
    const required = finite(base.requiredGameCount ?? base.required_game_count ?? candidate?.requiredGameCount ?? threshold)
      ? Number(base.requiredGameCount ?? base.required_game_count ?? candidate?.requiredGameCount ?? threshold) : threshold;
    const recordedConfidenceExplanation = text(candidate?.confidenceExplanation || candidate?.confidence_explanation || base.confidenceExplanation || base.confidence_explanation || evidence.explanation);
    const confidenceExplanation = raw !== null && supporting !== null && raw !== supporting
      ? `${raw} games were identified in this opening family. ${supporting} consistently reached a position that supports this decision.${recordedConfidenceExplanation ? ` ${recordedConfidenceExplanation}` : ""}`
      : recordedConfidenceExplanation;
    const contextualAction = status === "established" && displayName !== "Not established yet"
      ? { type: "practice", label: "Practise this role" }
      : supporting > 0
        ? { type: "analyse", label: `Play ${Math.max(1, required - supporting)} more relevant game${Math.max(1, required - supporting) === 1 ? "" : "s"}` }
        : compatibleAlternative
          ? { type: "options", label: "See suitable options" }
          : { type: "analyse", label: "Play more games" };
    return {
      key: role.key,
      role: role.role,
      label: role.label,
      openingKey: openingKey(displayName) || null,
      displayName,
      opening: displayName,
      status,
      statusLabel: ({ established: "Established", building: "Building", insufficient: "Not enough evidence", unresolved: "Unresolved" })[status],
      verdict,
      verdictLabel: roleVerdictLabel(verdict),
      fitScore,
      fitLabel: fitScore === null ? "Fit not calculated for this saved report." : presentation.fit.label,
      performanceScore,
      performanceLabel: performanceScore === null ? "Performance not available for this saved report." : presentation.performance.label,
      confidence: { level: confidence.level, label: confidence.label, detail: confidence.explanation, games: count },
      relevantGames: count,
      supportingGames: supporting,
      rawGames: raw,
      requiredGames: required,
      games: count,
      evidenceReason: evidence.explanation,
      evidenceReasonCode: text(base.evidenceReasonCode || base.evidence_reason_code) || evidence.reasonCode,
      reasonCodes: list(base.reasonCodes || base.reason_codes),
      evidenceRequirementCopy: evidence.requirement,
      evidenceFilters: evidence.filters,
      evidenceFunnelRows: evidence.funnelRows,
      gamesNeeded: status === "established" ? 0 : normalized.gamesNeeded,
      recommendationReason: recommendationReason(candidate, evidence),
      userIntention: userIntentions[role.role]?.intention || userIntentions[role.key]?.intention || null,
      isLegacyFallback: sourceTier === "legacy_role_fallback",
      dataQuality: normalized.valid && candidateEvidenceValid ? sourceTier : "inconsistent_evidence",
      complete: status === "established",
      tentative: status === "building",
      evidenceRequirement: base.evidenceRequirement || base.evidence_requirement || null,
      evidenceFunnel: evidence.funnel,
      evidenceDiagnostics: normalized.diagnostics,
      source: candidate || base.source || null,
      nextAction: recommendationReason(candidate, evidence),
      contextualAction,
      compatibleAlternative,
      confidenceExplanation,
      confidenceCounts: {
        imported: finite(counts.importedGames) ? Number(counts.importedGames) : null,
        eligible: finite(counts.eligibleGames) ? Number(counts.eligibleGames) : null,
        relevant: raw,
        supporting,
        required,
        excluded: finite(counts.excludedGames) ? Number(counts.excludedGames) : null,
      },
      presentation,
    };
  });
}

function priorityType(priority = {}, decision = {}) {
  const finding = text(priority.findingType || priority.finding_type).toLowerCase();
  if (finding) return finding;
  const action = text(priority.actionType || decision?.nextTrainingAction?.type || decision?.next_training_action?.type).toLowerCase();
  const role = text(priority.role).toLowerCase();
  if (/collect|fallback|insufficient/.test(action)) return "insufficient_evidence";
  if (/missing_role/.test(action)) return "missing_role";
  if (/repair|weak|fix/.test(action)) return "reliable_weakness";
  if (/prepare|explore/.test(action) || role.startsWith("faced_")) return "preparation_opportunity";
  return "preparation_opportunity";
}

export function selectAuthoritativeCoachingPriority(report = {}, { decision = null, allowFallback = true } = {}) {
  const priority = resolveTrainingPriority(report, { decision, allowFallback });
  if (!priority) return null;
  const displayName = formatOpeningNameForDisplay(priority.openingName) || null;
  return {
    ...priority,
    type: priorityType(priority, decision || {}),
    actionType: priority.actionType,
    openingName: displayName,
    displayName,
    openingKey: priority.openingKey || (displayName ? normaliseOpeningKey(displayName) : null),
    reason: priority.rationale,
    relevantGames: priority.evidenceCount,
    confidence: priority.confidenceStatus,
    fallbackReason: priority.fallbackReason || null,
  };
}
