import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analysisCountMilestones, mapAnalysisJobProgress } from "./importJourney.js";
import { buildReportGameCounts, reportCountSentence } from "./reportGameCounts.js";

const canonicalReport = (reconciliation) => ({
  gameCounts: {
    contractVersion: 4,
    gamesFetched: 12,
    eligible: 8,
    gamesPgnAvailable: 8,
    gamesParsed: 7,
    gamesAttributed: 7,
    gamesClassified: 6,
    gamesUsedForOpeningStats: 6,
    gamesExcluded: 6,
    exclusionReasons: { outsideDateWindow: 2, unsupportedTimeControl: 2, parseFailure: 1, unclassifiedOpening: 1 },
    duplicateGamesRemoved: 2,
    gameReconciliation: reconciliation,
  },
});

test("canonical backend reconciliation drives found, analysed and excluded totals", () => {
  const report = canonicalReport({
    contractVersion: 1,
    total_imported: 14,
    analysed: 6,
    excluded_total: 8,
    exclusion_breakdown: { outsideDateWindow: 2, unsupportedTimeControl: 2, parseFailure: 1, unclassifiedOpening: 1, duplicate: 2 },
  });
  const counts = buildReportGameCounts(report);
  assert.deepEqual([counts.totalImported, counts.reconciliationAnalysed, counts.excludedTotal], [14, 6, 8]);
  assert.equal(counts.exclusionBreakdown.reduce((sum, row) => sum + row.count, 0), 8);
  assert.equal(reportCountSentence(report), "14 games found · 6 games analysed · 8 games excluded");
});

test("invalid reconciliation fails closed instead of deriving frontend totals", () => {
  const report = canonicalReport({
    contractVersion: 1,
    total_imported: 14,
    analysed: 6,
    excluded_total: 7,
    exclusion_breakdown: { duplicate: 2, other: 5 },
  });
  const counts = buildReportGameCounts(report);
  assert.equal(counts.reconciliationStatus, "invalid_current_contract");
  assert.equal(counts.totalImported, null);
  assert.deepEqual(counts.exclusionBreakdown, []);
  assert.match(reportCountSentence(report), /could not be reconciled safely/i);
});

test("canonical reconciliation exposes a mathematically complete role allocation", () => {
  const report = canonicalReport({
    contractVersion: 1,
    total_imported: 14,
    analysed: 6,
    excluded_total: 8,
    exclusion_breakdown: { outsideDateWindow: 2, unsupportedTimeControl: 2, parseFailure: 1, unclassifiedOpening: 1, duplicate: 2 },
    eligible_games: 7,
    white_role_games: 3,
    black_vs_e4_games: 2,
    black_vs_d4_games: 1,
    outside_core_role_games: 1,
    unresolved_role_games: 0,
    status: "trusted",
  });
  assert.deepEqual(buildReportGameCounts(report).roleAllocation, {
    eligible: 7, white: 3, blackVsE4: 2, blackVsD4: 1,
    unresolved: 0, outsideCore: 1, status: "trusted", diagnosticReference: null,
  });
});

test("loading milestones expose only real backend counts", () => {
  const progress = mapAnalysisJobProgress({
    stage: "filtering_eligible_games",
    counts: { archivesProcessed: 3, archivesTotal: 3, fetchedGames: 143, eligibleGames: 91 },
  });
  assert.deepEqual(analysisCountMilestones(progress), [
    "3 of 3 archives located",
    "143 games downloaded",
    "91 match selected time controls",
  ]);
  assert.deepEqual(analysisCountMilestones({ real: false, counts: { fetchedGames: 999 } }), []);
});

test("Evidence uses a compact canonical disclosure and treats exclusions as normal", async () => {
  const source = await readFile(new URL("../components/ReportGameCountSummary.jsx", import.meta.url), "utf8");
  const overlay = await readFile(new URL("../components/ImportLoadingOverlay.jsx", import.meta.url), "utf8");
  assert.match(source, /counts\.totalImported \?\? counts\.fetchedGames/);
  assert.match(source, /Why were games excluded\?/);
  assert.match(source, /normal filtering outcomes, not import errors/);
  assert.match(source, /counts\.reconciliationStatus === "canonical" \? counts\.exclusionBreakdown/);
  assert.match(overlay, /analysisCountMilestones\(progress\)/);
  assert.doesNotMatch(overlay, /setInterval|fake|simulated/i);
});
