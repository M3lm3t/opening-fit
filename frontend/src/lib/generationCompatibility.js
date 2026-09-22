export const SUPPORTED_HEALTH_VERSIONS = Object.freeze(["openingfit_score_v1", "repertoire_coverage_v2", "repertoire_coverage_v3", "repertoire_health_v2", "repertoire_health_v3", "repertoire_health_v4"]);
export const SUPPORTED_DECISION_VERSIONS = Object.freeze(["legacy_compatibility_v1", ...Array.from({ length: 7 }, (_, index) => `report_decision_v${index + 1}`)]);
export function decisionVersionStatus(decision = {}) {
  if (!decision?.version) return "missing";
  return SUPPORTED_DECISION_VERSIONS.includes(decision.version) ? "supported" : "unsupported";
}
export function reportHealthVersion(report = {}) {
  const decision = report?.reportDecision || report?.report_decision || {};
  if (!report) return null;
  const contract = decision.repertoireHealth || report.repertoireHealth || report.repertoire_health
    || report.repertoireCoverageScore || report.repertoire_coverage_score
    || report.openingFitScoreContract || report.opening_fit_score_contract || report.score_contract || {};
  return contract.version || contract.formulaVersion || contract.formula_version || null;
}

export function compatibleEvidenceGeneration(previous, current) {
  const before = reportHealthVersion(previous), after = reportHealthVersion(current);
  return SUPPORTED_HEALTH_VERSIONS.includes(before) && before === after
    && [previous, current].every(report => decisionVersionStatus(report?.reportDecision || report?.report_decision) !== "unsupported");
}
