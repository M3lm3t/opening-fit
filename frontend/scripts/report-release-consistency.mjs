import { MELMET_REGRESSION_FIXTURE } from "../src/lib/fixtures/melmetRegressionFixture.js";
import { buildReportDecisionModel } from "../src/lib/reportDecisionModel.js";
import { buildReportGameCounts } from "../src/lib/reportGameCounts.js";
import { persistReport, readPersistedReport } from "../src/lib/reportPersistence.js";
import { canonicalResultAggregate } from "../src/lib/reportResults.js";

const report = structuredClone(MELMET_REGRESSION_FIXTURE);
const model = buildReportDecisionModel(report);
const labels = { keep: "Keep", repair: "Repair", explore: "Watch", "insufficient-data": "Insufficient evidence" };
const diagnosis = report.reportDecision.openingDiagnosis;
const rows = report.reportDecision.recommendations
  .filter((row) => row.sample.games > 0)
  .map((recommendation) => {
    const results = canonicalResultAggregate(recommendation);
    const role = model.repertoire.find((item) => item.role === recommendation.repertoireRole && item.openingKey === recommendation.openingId);
    const summary = labels[recommendation.verdict] || recommendation.verdict;
    const repertoire = role?.verdictLabel || summary;
    const evidence = labels[recommendation.verdict] || recommendation.verdict;
    return {
      context: `${recommendation.openingName} · ${recommendation.role} · ${recommendation.repertoireRole}`,
      games: results.games,
      WDL: `${results.wins}/${results.draws}/${results.losses}`,
      scoreRate: `${results.scoreRate}%`,
      Summary: summary,
      Repertoire: repertoire,
      Evidence: evidence,
      diagnosisAffected: diagnosis.canonicalDecisionId === recommendation.decisionId ? diagnosis.affectedGameCount : 0,
      trainingTarget: report.reportDecision.primaryAction.recommendationId === recommendation.recommendationId ? report.reportDecision.primaryAction.opening : "—",
    };
  });

if (rows.some((row) => row.Summary !== row.Repertoire || row.Summary !== row.Evidence)) {
  throw new Error("release_consistency: report verdict columns disagree");
}

console.table(rows);
console.log("COUNT_ADAPTER", JSON.stringify(buildReportGameCounts(report)));

const values = new Map();
const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
const saved = persistReport(storage, "release-report", { username: report.username, analysis: report });
const restored = readPersistedReport(storage, "release-report");
console.log("PERSISTENCE_RELOAD", JSON.stringify({ saved: saved.ok, restored: restored.ok, decisionId: restored.analysis?.reportDecision?.decisionId }));
if (!saved.ok || !restored.ok || restored.analysis.reportDecision.decisionId !== report.reportDecision.decisionId) {
  throw new Error("release_consistency: persistence reload failed");
}
