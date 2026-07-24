import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildReportGameCounts, countNoun, reportCountSentence } from "./reportGameCounts.js";
import { reportMetricAvailability } from "./reportMetricDefinitions.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { SAMPLE_REPORT } from "../fixtures/sampleReport.js";

test("canonical counts reconcile and keep precise stable meanings", () => {
  const counts = buildReportGameCounts({
    gameCounts: {
      contractVersion: 2, fetchedGames: 20, dateRangeEligibleGames: 20,
      timeControlEligibleGames: 18, analysisCandidateGames: 18, analysedGames: 14,
      usableOpeningSignals: 14, excludedGames: 6, analysisLimit: 300,
      exclusionReasons: { unsupportedTimeControl: 2, missingOpeningSignal: 4 },
    },
  });
  assert.deepEqual([counts.fetchedGames, counts.timeControlEligibleGames, counts.analysedGames, counts.excludedGames], [20, 18, 14, 6]);
  assert.equal(counts.fetchedGames, counts.analysedGames + counts.excludedGames);
  assert.equal(counts.exclusionReasons.reduce((sum, row) => sum + row.count, 0), 6);
});

test("excluded categories are concise and duplicate categories merge", () => {
  const counts = buildReportGameCounts({ gamesFound: 8, gamesAnalysed: 5, skippedGameReasons: [
    { key: "veryShort", count: 1 }, { key: "tooFewLegalMoves", count: 2 },
  ] });
  assert.deepEqual(counts.exclusionReasons.map((row) => [row.label, row.count]), [["Did not contain enough opening information", 3]]);
});

test("count sentence handles singular and plural grammar", () => {
  assert.equal(countNoun(1, "game"), "1 game");
  assert.equal(countNoun(2, "game"), "2 games");
  assert.equal(reportCountSentence({ gameCounts: { contractVersion: 2, fetchedGames: 1, dateRangeEligibleGames: 1, timeControlEligibleGames: 1, analysisCandidateGames: 1, analysedGames: 1, usableOpeningSignals: 1, excludedGames: 0, exclusionReasons: {} } }), "1 public game found. 1 game with enough opening information analysed. 0 games not analysed.");
});

test("melmet-shaped compact evidence never replaces canonical analysis totals", () => {
  const counts = buildReportGameCounts({
    gameCounts: {
      contractVersion: 2, fetchedGames: 307, dateRangeEligibleGames: 307,
      timeControlEligibleGames: 307, analysisCandidateGames: 300, analysedGames: 280,
      usableOpeningSignals: 280, excludedGames: 27, analysisLimit: 300,
      exclusionReasons: { analysisLimit: 7, missingOpeningSignal: 20 },
    },
    opening_games: Array.from({ length: 48 }, (_, index) => ({ url: `g-${index}` })),
  });
  assert.deepEqual([counts.fetchedGames, counts.analysedGames, counts.excludedGames], [307, 280, 27]);
  assert.equal(reportCountSentence({ gameCounts: { ...counts, exclusionReasons: { analysisLimit: 7, missingOpeningSignal: 20 } } }), "307 public games found. 280 games with enough opening information analysed. 27 games not analysed.");
});

test("legacy reports keep proven totals and mark stage breakdown unavailable", () => {
  const counts = buildReportGameCounts({ gamesFound: 131, gamesAnalysed: 117, opening_games: Array(48).fill({}) });
  assert.deepEqual([counts.fetchedGames, counts.analysedGames, counts.excludedGames], [131, 117, 14]);
  assert.equal(counts.breakdownAvailable, false);
  assert.equal(counts.dateRangeEligibleGames, null);
});

test("headline, history and export count surfaces consume the shared adapter", () => {
  for (const relative of [
    "../components/ReportGameCountSummary.jsx",
    "../components/ReportCommandBar.jsx",
    "../components/CleanReportHeader.jsx",
    "../components/ReportHistoryVault.jsx",
    "../components/ShareReport.jsx",
  ]) {
    const source = fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
    assert.match(source, /buildReportGameCounts/);
    assert.doesNotMatch(source, /usable opening signal/i);
  }
});

test("baseline makes comparison-only secondary metrics unavailable", () => {
  const metrics = reportMetricAvailability({ score: 64, comparisonClaimsAllowed: false });
  assert.equal(metrics.openingFitScore.available, true);
  for (const key of ["repertoireHealth", "openingJourney", "studyConsistency", "xp"]) {
    assert.equal(metrics[key].available, false);
    assert.match(metrics[key].status, /baseline report/i);
  }
  assert.equal(reportMetricAvailability({ score: null }).openingFitScore.available, false);
});

test("a genuine comparable report enables progress details", () => {
  const report = { username: "player", platform: "chess.com", gamesAnalysed: 12, importedAt: "2026-07-20T12:00:00Z", openingFitScore: 64 };
  const history = [{ source_username: "player", source_platform: "chess.com", total_games_analysed: 10, generated_at: "2026-06-20T12:00:00Z", openingfit_score: 58 }];
  const decision = buildReportDecisionModel(report, {}, history);
  const metrics = reportMetricAvailability({ score: decision.health.score, comparisonClaimsAllowed: decision.baseline.comparisonClaimsAllowed });
  assert.equal(decision.baseline.comparisonClaimsAllowed, true);
  assert.equal(metrics.repertoireHealth.available, true);
  assert.equal(decision.health.trend, 6);
});

test("main report model and component expose exactly one primary training action", () => {
  const model = buildReportDecisionModel({ gamesAnalysed: 8, reportDecision: {
    establishedStrength: null,
    primaryProblem: null,
    nextTrainingAction: { type: "collect_more_games", label: "Collect more games", reason: "Evidence is still limited." },
    supportingEvidence: ["8 classified games"],
    confidence: { status: "insufficient_data", gamesAnalysed: 8 },
    baseline: { comparisonClaimsAllowed: false },
  } });
  const summary = buildPrimaryReportSummary(model, {});
  assert.equal(summary.training.title, "Collect more games");
  assert.equal(Object.hasOwn(summary, "training"), true);
  const component = fs.readFileSync(fileURLToPath(new URL("../components/PrimaryReportSummary.jsx", import.meta.url)), "utf8");
  assert.equal((component.match(/className="primaryReportTraining"/g) || []).length, 1);
});

test("canonical primary problem uses its own evidence rather than the strength evidence", () => {
  const model = buildReportDecisionModel(SAMPLE_REPORT);
  const summary = buildPrimaryReportSummary(model, SAMPLE_REPORT);
  assert.equal(summary.problem.title, "Queen's Gambit Declined");
  assert.match(summary.problem.evidence, /12 games/);
  assert.doesNotMatch(summary.problem.evidence, /Vienna Game/);
});
