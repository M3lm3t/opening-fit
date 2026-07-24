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
    gameCounts: { imported: 20, eligible: 18, classified: 14, excluded: 6 },
    skippedGameReasons: [
      { key: "bullet", count: 2 },
      { key: "missingOpening", count: 3 },
      { key: "veryShort", count: 1 },
    ],
  });
  assert.deepEqual([counts.imported, counts.eligible, counts.classified, counts.excluded], [20, 18, 14, 6]);
  assert.equal(counts.imported, counts.classified + counts.excluded);
});

test("excluded categories are concise and duplicate categories merge", () => {
  const counts = buildReportGameCounts({ gamesFound: 8, gamesAnalysed: 5, skippedGameReasons: [
    { key: "veryShort", count: 1 }, { key: "tooFewLegalMoves", count: 2 },
  ] });
  assert.deepEqual(counts.exclusionReasons.map((row) => [row.label, row.count]), [["Insufficient opening moves", 3]]);
});

test("count sentence handles singular and plural grammar", () => {
  assert.equal(countNoun(1, "game"), "1 game");
  assert.equal(countNoun(2, "game"), "2 games");
  assert.equal(reportCountSentence({ gameCounts: { imported: 1, eligible: 1, classified: 1, excluded: 0 } }), "We imported 1 game. Your selected time-control and date filters left 1 eligible game. We found 1 usable opening signal.");
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
