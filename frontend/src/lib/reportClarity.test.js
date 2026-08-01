import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildReportGameCounts, countNoun, reportCountSentence, reportSaveState } from "./reportGameCounts.js";
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

test("v3 counts use explicit structural, classified and aggregate totals", () => {
  const counts = buildReportGameCounts({ gameCounts: {
    contractVersion: 3,
    gamesFetched: 314,
    gamesStructurallyUsable: 281,
    gamesClassified: 280,
    gamesUsedForOpeningStats: 279,
    gamesUnclassified: 1,
    gamesExcluded: 33,
    exclusionReasons: { beyondMaximumGameCap: 14, incompleteGame: 19 },
    analysisSelectionRule: "newest_first",
  } });
  assert.deepEqual(
    [counts.fetchedGames, counts.structurallyUsableGames, counts.classifiedGames, counts.usedForOpeningStats, counts.unclassifiedGames, counts.excludedGames],
    [314, 281, 280, 279, 1, 33],
  );
  assert.equal(counts.classified, 280);
  assert.equal(counts.exclusionReasons.reduce((sum, row) => sum + row.count, 0), 33);
});

test("v4 canonical counts take precedence and expose one complete funnel", () => {
  const counts = buildReportGameCounts({
    gamesImported: 30, gamesAnalysed: 30,
    gameCounts: {
      contractVersion: 4, gamesFetched: 24, eligible: 24, gamesPgnAvailable: 24,
      gamesParsed: 24, gamesAttributed: 24, gamesClassified: 24,
      gamesUsedForOpeningStats: 24, gamesExcluded: 0, exclusionReasons: {},
      duplicateGamesRemoved: 0,
    },
  });
  assert.deepEqual([
    counts.fetchedGames, counts.eligibleGames, counts.pgnAvailableGames, counts.parsedGames,
    counts.attributedGames, counts.classifiedGames, counts.usedForOpeningStats, counts.excludedGames,
  ], [24, 24, 24, 24, 24, 24, 24, 0]);
  assert.equal(counts.countStatus, "canonical");
  assert.equal(reportCountSentence({ gameCounts: {
    contractVersion: 4, gamesFetched: 24, eligible: 24, gamesPgnAvailable: 24,
    gamesParsed: 24, gamesAttributed: 24, gamesClassified: 24,
    gamesUsedForOpeningStats: 24, gamesExcluded: 0, exclusionReasons: {},
  } }), "24 games found · 24 games used · 0 games excluded");
});

test("legacy reports preserve unknown stages instead of manufacturing zero", () => {
  const counts = buildReportGameCounts({ gamesImported: 24 });
  assert.equal(counts.fetchedGames, 24);
  assert.equal(counts.analysedGames, null);
  assert.equal(counts.excludedGames, null);
  assert.equal(counts.countStatus, "legacy_incomplete");
  assert.equal(reportCountSentence({ gamesImported: 24 }), "Exact import breakdown unavailable for this older report.");
});

test("invalid current contracts fail safe rather than displaying contradictory totals", () => {
  const counts = buildReportGameCounts({ gameCounts: {
    contractVersion: 4, gamesFetched: 24, eligible: 24, gamesPgnAvailable: 24,
    gamesParsed: 24, gamesAttributed: 24, gamesClassified: 24,
    gamesUsedForOpeningStats: 30, gamesExcluded: 0, exclusionReasons: {},
  } });
  assert.equal(counts.countStatus, "invalid_current_contract");
  assert.equal(counts.fetchedGames, null);
  assert.equal(counts.usedForOpeningStats, null);
});

test("excluded categories are concise and duplicate categories merge", () => {
  const counts = buildReportGameCounts({ gamesFound: 8, gamesAnalysed: 5, skippedGameReasons: [
    { key: "veryShort", count: 1 }, { key: "tooFewLegalMoves", count: 2 },
  ] });
  assert.deepEqual(counts.exclusionReasons.map((row) => [row.label, row.count]), [["Insufficient opening plies", 3]]);
});

test("excluded games keep recorded reasons and use an honest fallback", () => {
  const recorded = buildReportGameCounts({ gameCounts: { contractVersion: 2, fetchedGames: 10, analysedGames: 7, exclusionReasons: { duplicate: 2 } } });
  assert.deepEqual(recorded.exclusionReasons.map((reason) => [reason.label, reason.count]), [["Duplicate", 2], ["Reason unavailable", 1]]);
  const unavailable = buildReportGameCounts({ gamesImported: 10, gamesAnalysed: 7, gamesExcluded: 3 });
  assert.deepEqual(unavailable.exclusionReasons.map((reason) => [reason.label, reason.count]), [["Reason unavailable", 3]]);
});

test("logged-out reports clearly identify the local-save state", () => {
  assert.deepEqual(reportSaveState("local", false), { label: "Saved locally", detail: "This report stays in this browser. Log in to sync it across devices." });
  assert.equal(reportSaveState("saved", true).label, "Saved to cloud");
  assert.deepEqual(reportSaveState("local", false, true), { label: "Example only · Not saved", detail: "Fictional example data is not stored locally or synced to an account." });
});

test("count sentence handles singular and plural grammar", () => {
  assert.equal(countNoun(1, "game"), "1 game");
  assert.equal(countNoun(2, "game"), "2 games");
  assert.equal(reportCountSentence({ gameCounts: { contractVersion: 2, fetchedGames: 1, dateRangeEligibleGames: 1, timeControlEligibleGames: 1, analysisCandidateGames: 1, analysedGames: 1, usableOpeningSignals: 1, excludedGames: 0, exclusionReasons: {} } }), "1 public game found. 1 game contained enough opening information to analyse. 0 games not analysed.");
});

test("large compact evidence never replaces canonical analysis totals", () => {
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
  assert.equal(reportCountSentence({ gameCounts: { ...counts, exclusionReasons: { analysisLimit: 7, missingOpeningSignal: 20 } } }), "307 public games found. 280 games contained enough opening information to analyse. 27 games not analysed.");
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

test("current reports explain the maximum-game cap and imported date-window scope", () => {
  const summarySource = fs.readFileSync(fileURLToPath(new URL("../components/ReportGameCountSummary.jsx", import.meta.url)), "utf8");
  const appSource = fs.readFileSync(fileURLToPath(new URL("../App.jsx", import.meta.url)), "utf8");
  assert.match(summarySource, /Maximum-game cap/);
  assert.match(summarySource, /selected newest first; capped games are not invalid/i);
  assert.match(appSource, /All imported games/);
  assert.match(appSource, /not the player’s all-time public history/i);
});

test("all count surfaces use the same adapter and mobile compact counts wrap", () => {
  const component = fs.readFileSync(fileURLToPath(new URL("../components/ReportGameCountSummary.jsx", import.meta.url)), "utf8");
  const styles = fs.readFileSync(fileURLToPath(new URL("../components/PrimaryReportSummary.css", import.meta.url)), "utf8");
  assert.match(component, /buildReportGameCounts/);
  assert.match(component, /counts\.fetchedGames/);
  assert.match(component, /counts\.usedForOpeningStats/);
  assert.match(component, /counts\.excludedGames/);
  assert.match(styles, /\.reportGameCountCompact\s*\{[^}]*flex-wrap:\s*wrap/s);
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
  assert.equal(summary.decisions.filter((decision) => decision.primary).length, 1);
  const component = fs.readFileSync(fileURLToPath(new URL("../components/PrimaryReportSummary.jsx", import.meta.url)), "utf8");
  assert.equal((component.match(/className="primaryReportTraining"/g) || []).length, 0);
  assert.equal((component.match(/className="primaryBtn"/g) || []).length, 1);
});

test("canonical primary problem uses its own evidence rather than the strength evidence", () => {
  const model = buildReportDecisionModel(SAMPLE_REPORT);
  const summary = buildPrimaryReportSummary(model, SAMPLE_REPORT);
  assert.equal(summary.problem.title, "Queen's Gambit Declined");
  assert.match(summary.problem.evidence, /12 games/);
  assert.doesNotMatch(summary.problem.evidence, /Vienna Game/);
});
