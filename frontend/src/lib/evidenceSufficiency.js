const list = (value) => Array.isArray(value) ? value : [];

export function buildEvidenceSufficiency(report = {}) {
  const decision = report.reportDecision || report.report_decision || {};
  const hierarchy = decision.evidenceHierarchy || decision.evidence_hierarchy || report.evidenceHierarchy || report.evidence_hierarchy || {};
  const accounting = report.roleEvidenceAccounting || report.role_evidence_accounting || {};
  const counts = report.gameCounts || report.game_counts || {};
  const roles = list(hierarchy.repertoireRole).map((row) => ({
    identity: row.identity,
    games: Number(row.games || 0),
    state: row.confidence?.state || "limited",
    label: row.confidence?.stateLabel || "Limited evidence",
    weightedGames: Number(row.confidence?.weightedGameEquivalent || row.games || 0),
    additionalForDeveloping: Number(row.confidence?.additionalRelevantGamesForDeveloping || 0),
    additionalForStrong: Number(row.confidence?.additionalRelevantGamesForStrong || 0),
    recommendationStrength: row.confidence?.recommendationStrength || "none",
  }));
  const imported = Number(accounting.importedGames ?? counts.fetchedGames ?? counts.gamesFetched ?? 0);
  const usable = Number(counts.gamesUsedForOpeningStats ?? counts.analysedGames ?? 0);
  const systemicFailure = hierarchy.analysisFailure?.failed === true || accounting.valid === false;
  const warning = imported >= 200 && usable < Math.max(15, Math.floor(imported * 0.1));
  return {
    roles,
    imported,
    usable,
    warning,
    systemicFailure,
    diagnosticReference: hierarchy.analysisFailure?.diagnosticReference || accounting.diagnosticReference || null,
    exclusionReasons: counts.exclusionReasons || accounting.exclusionReasons || {},
  };
}
