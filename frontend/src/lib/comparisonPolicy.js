import { compatibleEvidenceGeneration, decisionVersionStatus } from "./generationCompatibility.js";

export const COMPARISON_POLICY_VERSION = "report_comparison_v1";
export function reportBody(row = {}) {
  return row.normalized_snapshot || row.snapshot?.report || row.snapshot || row.report || row.last_report || row.analysis || row.data || row;
}
const text = value => String(value ?? "").trim().toLowerCase();
const platform = value => text(value).replace(/^chesscom$/, "chess.com");
const canonical = value => JSON.stringify(value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value ?? null);

export function comparisonEligibility(previousInput, currentInput) {
  const previous = reportBody(previousInput || {}), current = reportBody(currentInput || {}), reasons = [];
  if (!compatibleEvidenceGeneration(previous, current)) reasons.push("Calculation versions are missing, unsupported or different.");
  const decision = report => report.reportDecision || report.report_decision || {};
  if ([previous, current].some(report => decisionVersionStatus(decision(report)) !== "supported") || decision(previous).version !== decision(current).version) reasons.push("Decision policies are missing, unsupported or different.");
  for (const [label, read] of [
    ["player", report => text(report.source_username || report.username || report.playerName)],
    ["platform", report => platform(report.source_platform || report.platform || report.importPlatform)],
  ]) if (!read(previous) || !read(current) || read(previous) !== read(current)) reasons.push(`The ${label} identity is missing or different.`);
  const a = previous.comparisonCohort || previous.comparison_cohort || {}, b = current.comparisonCohort || current.comparison_cohort || {};
  if (a.version !== COMPARISON_POLICY_VERSION || b.version !== COMPARISON_POLICY_VERSION) reasons.push("Comparable cohort provenance is unavailable.");
  for (const key of ["windowMonths", "timeControlFilter", "selectionRule", "analysisLimit", "filterPolicyVersion", "classificationVersion"]) {
    if (a[key] === undefined || a[key] === null || a[key] === "" || b[key] === undefined || b[key] === null || b[key] === "" || canonical(a[key]) !== canonical(b[key])) reasons.push(`Cohort ${key} is missing or different.`);
  }
  for (const key of ["import_months", "filters"]) {
    const av = previous.analysis_metadata?.[key], bv = current.analysis_metadata?.[key];
    if ((av !== undefined || bv !== undefined) && canonical(av) !== canonical(bv)) reasons.push(`Reported ${key} differs.`);
  }
  const controls = cohort => Array.isArray(cohort.timeControls) ? [...new Set(cohort.timeControls.map(text))].sort() : [];
  if (!controls(a).length || controls(a).includes("unknown") || canonical(controls(a)) !== canonical(controls(b))) reasons.push("Observed time controls are missing or different.");
  const ids = cohort => new Set(Array.isArray(cohort.gameIds) ? cohort.gameIds.filter(Boolean).map(String) : []);
  const beforeIds = ids(a), afterIds = ids(b);
  if (beforeIds.size < 5 || afterIds.size < 5) reasons.push("At least five identified games are required in each report.");
  if (afterIds.size < beforeIds.size) reasons.push("The current report has reduced game exposure.");
  if (![...afterIds].some(id => !beforeIds.has(id))) reasons.push("No new identified games are available.");
  const date = report => Date.parse(report.generated_at || report.importedAt || report.imported_at || report.lastUpdated || "");
  if (!Number.isFinite(date(previous)) || !Number.isFinite(date(current)) || date(previous) >= date(current)) reasons.push("Report chronology is missing or invalid.");
  return { comparable: reasons.length === 0, reasons, policyVersion: COMPARISON_POLICY_VERSION };
}

export function openingContextIdentity(row = {}) {
  const context = row.canonicalContextId || row.canonical_context_id;
  const role = row.repertoireRole || row.repertoire_role;
  const colour = row.playerColour || row.colour || row.color;
  if (!context || !["white", "black_vs_e4", "black_vs_d4"].includes(role) || colour !== (role === "white" ? "white" : "black")) return null;
  return `${context}|${role}|${colour}`;
}

export function observedOpeningPerformance(row = {}) {
  const sample = row.sample || row;
  const values = [sample.wins, sample.draws, sample.losses];
  if (values.some(value => !Number.isInteger(value) || value < 0)) return null;
  const [wins, draws, losses] = values, knownResults = wins + draws + losses;
  const games = Number(sample.games ?? row.games);
  if (!knownResults || !Number.isFinite(games) || knownResults > games) return null;
  return { metric: "opening_score_rate", version: "observed_performance_v1", games, knownResults, winRate: 100 * wins / knownResults, scoreRate: 100 * (wins + .5 * draws) / knownResults };
}
