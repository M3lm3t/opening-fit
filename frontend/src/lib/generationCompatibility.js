// Stage 6A generation boundary only; historical comparison policies stay intact.
export function reportHealthVersion(report = {}) {
  const decision = report.reportDecision || report.report_decision || {};
  const contract = decision.repertoireHealth || report.repertoireHealth || report.repertoire_health
    || report.repertoireCoverageScore || report.repertoire_coverage_score
    || report.openingFitScoreContract || report.opening_fit_score_contract || report.score_contract || {};
  return contract.version || contract.formulaVersion || contract.formula_version || null;
}

export function compatibleEvidenceGeneration(previous, current) {
  const before = reportHealthVersion(previous), after = reportHealthVersion(current);
  return ![before, after].includes("repertoire_health_v4") || before === after;
}
