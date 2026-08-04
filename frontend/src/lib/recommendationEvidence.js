import { OPENING_EVIDENCE_THRESHOLDS } from "./fitTrustModel.js";
import { countNoun, formatResultCounts } from "./reportGameCounts.js";

export const RECOMMENDATION_EVIDENCE_THRESHOLDS = Object.freeze({
  minimum: OPENING_EVIDENCE_THRESHOLDS.minimum,
  medium: OPENING_EVIDENCE_THRESHOLDS.moderate,
  high: OPENING_EVIDENCE_THRESHOLDS.high,
});

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const numeric = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function roleFor(item = {}) {
  const explicit = clean(item?.perspective?.role || item.openingRole || item.opening_role || item.role).toLowerCase();
  if (["played_as_white", "played_as_black", "faced_as_white", "faced_as_black"].includes(explicit)) return explicit;
  const context = clean(item.context || item.repertoireContext || item.repertoire_context).toLowerCase();
  if (context === "played_as_white") return context;
  if (context.startsWith("black_")) return "played_as_black";
  if (["faced_as_white", "faced_as_black"].includes(context)) return context;
  return "unknown_mixed";
}

function slotFor(item, role) {
  if (role === "played_as_white") return "white";
  if (role !== "played_as_black") return null;
  return item.repertoireSlot || item.repertoire_slot || item.context || item.repertoireContext || "black_vs_other";
}

function repertoireRoleFor(item, role) {
  const explicit = clean(item.repertoireRole || item.repertoire_role || item.perspective?.repertoireRole).toLowerCase();
  if (["white", "black_vs_e4", "black_vs_d4", "unresolved"].includes(explicit)) return explicit;
  const slot = slotFor(item, role);
  return ["white", "black_vs_e4", "black_vs_d4"].includes(slot) ? slot : "unresolved";
}

export function confidenceForRecommendation(games, valid = true, traceable = true) {
  const count = Math.max(0, Math.round(numeric(games)));
  if (!valid) return { level: "context_uncertain", label: "Context uncertain" };
  if (count <= 3) return { level: "insufficient", label: "Insufficient sample" };
  if (count <= 9) return { level: "low", label: "Low confidence" };
  if (count < RECOMMENDATION_EVIDENCE_THRESHOLDS.high || !traceable) return { level: "moderate", label: "Moderate confidence" };
  return { level: "high_sample", label: "High sample confidence" };
}

export function validateRecommendationEvidence(entry = {}) {
  const sample = entry.sample && typeof entry.sample === "object" ? entry.sample : entry;
  const games = Math.max(0, Math.round(numeric(sample.games ?? entry.games)));
  const hasResults = ["wins", "draws", "losses"].some((key) => sample[key] !== undefined && sample[key] !== null);
  const wins = Math.max(0, Math.round(numeric(sample.wins ?? entry.wins)));
  const draws = Math.max(0, Math.round(numeric(sample.draws ?? entry.draws)));
  const losses = Math.max(0, Math.round(numeric(sample.losses ?? entry.losses)));
  const suppliedKnownResults = sample.knownResults ?? sample.known_results;
  const knownResults = Math.max(0, Math.round(numeric(suppliedKnownResults, wins + draws + losses)));
  const rawIds = sample.gameIds || sample.supportingGameIds || sample.supporting_game_ids || entry.supportingGameIds || entry.supporting_game_ids;
  const ids = Array.isArray(rawIds) ? [...new Set(rawIds.map(clean).filter(Boolean))] : [];
  const issues = [];
  if (hasResults && (wins + draws + losses !== knownResults || knownResults > games || (suppliedKnownResults === undefined && knownResults !== games))) issues.push("results_do_not_reconcile");
  if (ids.length && ids.length !== games) issues.push("supporting_games_do_not_reconcile");
  if (entry.confidence && typeof entry.confidence === "object" && entry.confidence.sampleSize !== undefined && numeric(entry.confidence.sampleSize) !== games) {
    issues.push("confidence_sample_does_not_reconcile");
  }
  const supplied = sample.scoreRate ?? entry.scoreRate ?? entry.score;
  const calculated = knownResults && hasResults ? Math.round(((wins + draws * 0.5) / knownResults) * 1000) / 10 : supplied !== undefined && supplied !== null ? numeric(supplied) : null;
  if (hasResults && supplied !== undefined && supplied !== null && calculated !== null && Math.abs(numeric(supplied) - calculated) > 0.11) {
    issues.push("score_rate_does_not_reconcile");
  }
  return {
    valid: issues.length === 0,
    issues,
    sample: { gameIds: ids, games, knownResults, wins, draws, losses, scoreRate: calculated },
  };
}

export function normaliseCanonicalRecommendation(entry) {
  if (!entry) return null;
  const role = roleFor(entry);
  const relationship = role.startsWith("played_") ? "played" : role.startsWith("faced_") ? "faced" : "unknown";
  const checked = validateRecommendationEvidence(entry);
  const calculatedConfidence = confidenceForRecommendation(checked.sample.games, checked.valid && relationship !== "unknown", checked.sample.gameIds.length === checked.sample.games);
  const confidenceLevel = clean(entry.confidenceLevel || entry.confidence_level || entry.confidence?.level) || calculatedConfidence.level;
  const confidence = {
    ...calculatedConfidence,
    ...(typeof entry.confidence === "object" ? entry.confidence : {}),
    level: confidenceLevel,
    label: clean(entry.confidence?.label) || calculatedConfidence.label,
    reasons: Array.isArray(entry.confidenceReasons) ? entry.confidenceReasons : Array.isArray(entry.confidence?.reasons) ? entry.confidence.reasons : [],
  };
  const evidenceStatus = clean(entry.evidenceStatus || entry.evidence_status).toLowerCase();
  const supported = checked.valid && relationship !== "unknown" && (evidenceStatus === "sufficient" || (!evidenceStatus && checked.sample.games >= RECOMMENDATION_EVIDENCE_THRESHOLDS.minimum));
  const originalVerdict = clean(entry.verdict).toLowerCase();
  const verdict = supported ? originalVerdict : "insufficient-data";
  return {
    ...entry,
    opening: clean(entry.openingName || entry.opening || entry.name),
    openingName: clean(entry.openingName || entry.opening || entry.name),
    role,
    relationship,
    repertoireOwned: relationship === "played",
    repertoireSlot: slotFor(entry, role),
    repertoireRole: repertoireRoleFor(entry, role),
    sample: checked.sample,
    games: checked.sample.games,
    score: checked.sample.scoreRate,
    scoreRate: checked.sample.scoreRate,
    verdict,
    sampleSize: checked.sample.games,
    sampleThreshold: numeric(entry.sampleThreshold || entry.sample_threshold, RECOMMENDATION_EVIDENCE_THRESHOLDS.minimum),
    evidenceStatus: evidenceStatus || (supported ? "sufficient" : checked.sample.games >= 4 ? "very_early" : "insufficient"),
    sampleSizeStatus: supported ? "sufficient" : "insufficient_data",
    confidenceLevel,
    confidenceReasons: confidence.reasons,
    confidence: { ...confidence, sampleSize: checked.sample.games },
    performanceScore: entry.performanceScore ?? entry.performance_score ?? checked.sample.scoreRate,
    fitScore: entry.fitScore ?? entry.fit_score ?? null,
    verdictReasons: Array.isArray(entry.verdictReasons) ? entry.verdictReasons : [],
    recommendedAction: entry.recommendedAction || entry.trainingAction || null,
    alternativeOpening: entry.alternativeOpening || null,
    alternativeReason: entry.alternativeReason || null,
    validation: { valid: checked.valid, issues: checked.issues },
  };
}

function recommendationFromAggregate(item = {}) {
  const role = roleFor(item);
  const relationship = role.startsWith("played_") ? "played" : role.startsWith("faced_") ? "faced" : "unknown";
  const games = Math.max(0, Math.round(numeric(item.games)));
  const wins = Math.max(0, Math.round(numeric(item.wins)));
  const draws = Math.max(0, Math.round(numeric(item.draws)));
  const losses = Math.max(0, Math.round(numeric(item.losses)));
  const scoreRate = games ? Math.round(((wins + draws * 0.5) / games) * 1000) / 10 : null;
  const supported = games >= RECOMMENDATION_EVIDENCE_THRESHOLDS.minimum && relationship !== "unknown";
  const verdict = !supported ? "insufficient-data" : relationship === "faced" ? "explore" : scoreRate < 45 ? "repair" : scoreRate >= 55 ? "keep" : "explore";
  return normaliseCanonicalRecommendation({
    recommendationId: `${clean(item.opening || item.name).toLowerCase()}:${role}`,
    opening: item.opening || item.name,
    openingName: item.opening || item.name,
    role,
    relationship,
    repertoireOwned: relationship === "played",
    repertoireSlot: slotFor(item, role),
    verdict,
    sample: { games, wins, draws, losses, scoreRate, gameIds: Array.isArray(item.gameIds) ? item.gameIds : [] },
    evidence: [`${countNoun(games, "game")}: ${formatResultCounts({ wins, draws, losses })}.`, `Chess score: ${scoreRate}%.`],
  });
}

export function buildFilteredReportDecision(openings = [], totalGames = 0) {
  const recommendations = openings.map(recommendationFromAggregate);
  const owned = recommendations.filter((item) => item.repertoireOwned && item.sampleSizeStatus === "sufficient");
  const strength = owned.filter((item) => item.verdict === "keep").sort((a, b) => b.sample.games - a.sample.games || b.scoreRate - a.scoreRate || a.opening.localeCompare(b.opening))[0] || null;
  const problem = owned.filter((item) => item.verdict === "repair").sort((a, b) => a.scoreRate - b.scoreRate || b.sample.games - a.sample.games || a.opening.localeCompare(b.opening))[0] || null;
  const faced = recommendations.filter((item) => item.relationship === "faced" && item.sampleSizeStatus === "sufficient").sort((a, b) => b.sample.games - a.sample.games || a.opening.localeCompare(b.opening))[0] || null;
  const target = problem || faced || strength;
  const type = problem ? "repair_repertoire" : faced ? "prepare_against" : strength ? "consolidate_strength" : "collect_more_games";
  const label = problem ? `Repair ${problem.opening}` : faced ? `Prepare against the ${faced.opening}` : strength ? `Keep playing ${strength.opening}` : "Collect more games before changing your repertoire";
  const reason = target
    ? `${target.sample.games} filtered ${target.opening} game${target.sample.games === 1 ? "" : "s"} produce a ${target.scoreRate}% chess score.`
    : "No opening in this filtered view has five correctly attributed games, so no repertoire weakness is claimed.";
  return {
    schemaVersion: 2,
    recommendations,
    establishedStrength: strength,
    primaryProblem: problem,
    nextTrainingAction: { type, opening: target?.opening || null, role: target?.role || null, label, reason, recommendationId: target?.recommendationId || null, sample: target?.sample || null },
    supportingEvidence: target ? [...target.evidence, reason] : [reason],
    reportCoverage: { level: totalGames >= 50 ? "broad" : totalGames >= 20 ? "moderate" : totalGames >= 5 ? "limited" : "insufficient", gamesAnalysed: totalGames },
    confidence: { status: strength || problem || faced ? "sufficient" : "insufficient_data", gamesAnalysed: totalGames, minimumOpeningGames: RECOMMENDATION_EVIDENCE_THRESHOLDS.minimum },
    baseline: { status: "filtered_view", hasComparablePrevious: false, comparisonClaimsAllowed: false },
  };
}

export function normaliseReportDecision(decision = {}, report = null) {
  if (!decision || typeof decision !== "object") {
    if (!report || typeof report !== "object") return null;
    const action = {
      decisionId: `legacy:${clean(report.analysisId || report.analysis_id || report.reportId || "report")}:collect_more_games`,
      actionId: `legacy:${clean(report.analysisId || report.analysis_id || report.reportId || "report")}:collect_more_games`,
      type: "collect_more_games", verdict: "collect_more_data", opening: null, role: null,
      repertoireRole: "unresolved", targetType: "repertoire_gap",
      label: "Collect more games before changing your repertoire",
      reason: "This older report does not contain one traceable canonical priority, so OpeningFit will not invent a repair target.",
      conciseReason: "This older report lacks traceable canonical decision evidence.",
      nextAction: "Keep the current repertoire stable, collect five relevant games, then run a new report.",
      trainingDuration: { minutes: 10 },
      completionTarget: { type: "new_games", count: 5, label: "Add five relevant games before reassessing." },
      successCheck: "Add five relevant games before reassessing.",
      confidenceLevel: "insufficient", evidenceGameIds: [], recommendationId: null,
      source: "legacy_compatibility_adapter", fallback: true,
    };
    return {
      schemaVersion: 1, version: "legacy_compatibility_v1", sourceReportId: report.analysisId || report.analysis_id || null,
      decisionId: action.decisionId,
      evidenceStatus: "insufficient", overallSummary: action.reason,
      recommendations: [], findings: [], keep: null, repair: null, experiment: null,
      establishedStrength: null, primaryProblem: null, primaryAction: action, nextTrainingAction: action,
      trainingPriority: null, rejectedCandidates: [], fallbackUsed: true, fallbackReason: action.reason,
      roleDecisions: [], repertoireRoles: [], supportingEvidence: [action.reason],
      confidence: { status: "insufficient_data", gamesAnalysed: null, minimumOpeningGames: RECOMMENDATION_EVIDENCE_THRESHOLDS.minimum },
      baseline: { status: "baseline", hasComparablePrevious: false, comparisonClaimsAllowed: false },
    };
  }
  const recommendations = Array.isArray(decision.recommendations) ? decision.recommendations.map(normaliseCanonicalRecommendation).filter(Boolean) : [];
  const byId = (entry) => {
    const normalized = normaliseCanonicalRecommendation(entry);
    if (!normalized || normalized.sampleSizeStatus !== "sufficient") return null;
    return recommendations.find((item) => item.recommendationId && item.recommendationId === normalized.recommendationId) || normalized;
  };
  const establishedStrength = byId(decision.establishedStrength);
  const primaryProblem = byId(decision.primaryProblem);
  const experiment = decision.experiment && typeof decision.experiment === "object" ? decision.experiment : null;
  let nextTrainingAction = decision.primaryAction || decision.primary_action || decision.nextTrainingAction || null;
  const target = recommendations.find((item) => item.recommendationId === nextTrainingAction?.recommendationId && item.sampleSizeStatus === "sufficient");
  const matchesExperiment = Boolean(
    nextTrainingAction?.verdict === "experiment"
    && experiment?.recommendationId
    && experiment.recommendationId === nextTrainingAction.recommendationId
  );
  if (nextTrainingAction && target) {
    const openingMismatch = nextTrainingAction.opening && clean(nextTrainingAction.opening).toLowerCase() !== target.opening.toLowerCase();
    nextTrainingAction = {
      ...nextTrainingAction,
      opening: target.opening,
      role: target.role,
      sample: target.sample,
      label: openingMismatch ? target.trainingAction?.title || `Review ${target.opening}` : nextTrainingAction.label,
      reason: openingMismatch ? target.trainingAction?.explanation || `${target.sample.games} opening-specific games support this action.` : nextTrainingAction.reason,
      validation: openingMismatch ? { valid: false, issues: ["training_opening_does_not_reconcile"] } : nextTrainingAction.validation,
    };
  }
  if (!nextTrainingAction || (nextTrainingAction.recommendationId && !target && !matchesExperiment)) {
    const recoveryId = `${decision.decisionId || decision.decision_id || "saved-report"}:collect_more_data`;
    nextTrainingAction = { decisionId: recoveryId, actionId: recoveryId, type: "collect_more_games", verdict: "collect_more_data", opening: null, role: null, label: "Collect more games before changing your repertoire", reason: "The saved recommendation evidence does not reconcile, so no repertoire change is recommended.", recommendationId: null, sample: null };
  }
  const roleDecisions = Array.isArray(decision.roleDecisions || decision.role_decisions || decision.repertoireRoles || decision.repertoire_roles)
    ? (decision.roleDecisions || decision.role_decisions || decision.repertoireRoles || decision.repertoire_roles)
    : [];
  return {
    ...decision,
    schemaVersion: decision.schemaVersion || 1,
    recommendations,
    establishedStrength,
    primaryProblem,
    experiment,
    primaryAction: nextTrainingAction,
    nextTrainingAction,
    roleDecisions,
    repertoireRoles: roleDecisions,
    findings: Array.isArray(decision.findings) ? decision.findings : [],
  };
}
