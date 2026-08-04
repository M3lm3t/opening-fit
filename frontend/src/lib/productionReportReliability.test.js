import test from "node:test";
import assert from "node:assert/strict";
import { MELMET_REGRESSION_FIXTURE } from "./fixtures/melmetRegressionFixture.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { buildReportGameCounts } from "./reportGameCounts.js";
import { readPersistedReport, persistReport } from "./reportPersistence.js";
import { canonicalResultAggregate, percentValue } from "./reportResults.js";
import { reportActionUrl } from "./reportViews.js";

const clone = () => structuredClone(MELMET_REGRESSION_FIXTURE);
const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test("canonical result aggregation keeps one percentage unit and ignores unknown results", () => {
  const vienna = clone().reportDecision.recommendations.find((row) => row.recommendationId === "vienna:white");
  assert.deepEqual(canonicalResultAggregate(vienna), { games: 30, knownResults: 30, wins: 17, draws: 0, losses: 13, scoreRate: 56.7 });
  assert.equal(canonicalResultAggregate({ sample: { games: 4, knownResults: 3, wins: 1, draws: 1, losses: 1 } }).scoreRate, 50);
  assert.equal(Math.round(percentValue(0.567) * 10) / 10, 56.7);
  assert.equal(percentValue(56.7), 56.7);
});

test("canonical decisions drive Summary, Repertoire and Evidence without legacy fit overrides", () => {
  const report = clone();
  report.opening_recommendations = { white: [{ name: "Vienna Game", games: 30, verdict: "Improve", fitScore: 99 }], black_vs_e4: [{ name: "Scandinavian Defence", games: 43, verdict: "Insufficient evidence" }] };
  const model = buildReportDecisionModel(report);
  const vienna = model.authoritative.recommendations.find((row) => row.recommendationId === "vienna:white");
  const scandi = model.authoritative.recommendations.find((row) => row.recommendationId === "scandi:black");
  const whiteRole = model.repertoire.find((row) => row.role === "white");
  const blackE4Role = model.repertoire.find((row) => row.role === "black_vs_e4");
  assert.deepEqual([vienna.verdict, whiteRole.verdict], ["keep", "keep"]);
  assert.deepEqual([scandi.verdict, blackE4Role.verdict], ["repair", "repair"]);
  assert.equal(model.issues[0].affectedGames, 43);
  assert.equal(model.issues[0].lostGames, 20);
  assert.doesNotMatch(model.issues[0].explanation, /^This position recurs/);
  assert.equal(new Set(model.issues[0].supportingGameIds).size, 43);
});

test("current count terminology exposes the used opening-stat total as analysed", () => {
  const counts = buildReportGameCounts(clone());
  assert.deepEqual(
    [counts.fetchedGames, counts.eligibleGames, counts.parsedGames, counts.attributedGames, counts.classifiedGames, counts.usedForOpeningStats, counts.analysedGames, counts.excludedGames],
    [164, 156, 156, 139, 139, 139, 139, 25],
  );
  assert.deepEqual(counts.exclusionReasons.map((row) => [row.label, row.count]), [["Requested player could not be attributed to one side", 17], ["Reason unavailable", 8]]);
});

test("local report save verifies the write and survives direct report/hash reload", () => {
  const storage = memoryStorage();
  const report = clone();
  const saved = persistReport(storage, "report", { username: "melmet", savedAt: "2026-08-04T12:00:00Z", analysis: report });
  assert.equal(saved.ok, true);
  const direct = readPersistedReport(storage, "report");
  assert.equal(direct.ok, true);
  assert.equal(direct.analysis.reportDecision.decisionId, report.reportDecision.decisionId);
  assert.match(reportActionUrl(report.reportActions[0], { pathname: "/report", search: "" }), /#report-evidence$/);

  const stale = readPersistedReport(memoryStorage({ report: JSON.stringify({ analysis: report }) }), "report");
  assert.equal(stale.ok, true);
  assert.equal(stale.migrated, true);
  assert.equal(readPersistedReport(memoryStorage({ report: "{" }), "report").reason, "corrupt");
  const blocked = { getItem: () => null, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(persistReport(blocked, "report", { analysis: report }), { ok: false, reason: "write_failed" });
});
