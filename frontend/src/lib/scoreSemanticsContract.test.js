import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOpeningVerdictPresentation } from "./fitTrustModel.js";
import { buildOpeningFitScoreTransparency } from "./openingFitScoreTransparency.js";
import { buildReportSnapshot } from "./reportSnapshot.js";

const recommendation = {
  openingName: "Queen Pawn Game",
  openingSuitability: {
    version: "opening_suitability_v1", score: 58,
    rationale: "A deterministic repertoire estimate.",
    confidence: { version: "evidence_confidence_v1", level: "low", label: "Low", scope: "opening_suitability", sampleSize: 6 },
  },
  observedPerformance: {
    version: "observed_performance_v1", games: 6, wins: 1, draws: 1, losses: 4,
    winRate: 16.7, scoreRate: 25, role: "white", colour: "white",
  },
  evidenceConfidence: { version: "evidence_confidence_v1", level: "low", label: "Low", scope: "opening_decision", sampleSize: 6 },
  verdict: "repair",
};

const health = {
  version: "repertoire_health_v2", formulaVersion: "repertoire_health_v2", score: 60,
  meaning: "Overall repertoire condition, not one opening.",
  explanation: "Repertoire Health is held back mainly by evidence strength.",
  confidence: { version: "evidence_confidence_v1", level: "medium", label: "Medium", scope: "repertoire_health" },
  components: [{ key: "evidenceStrength", label: "Evidence strength", value: 60, score: 60, baseWeight: 25, effectiveWeight: 100, contribution: 60, available: true }],
};

test("one serialised report preserves four non-interchangeable score meanings", () => {
  const report = {
    username: "FixturePlayer", platform: "chess.com", gamesAnalysed: 6,
    openingFitScore: 60, repertoireHealth: health,
    reportDecision: { version: "report_decision_v5", primaryAction: recommendation, recommendations: [recommendation] },
  };
  const snapshot = buildReportSnapshot({ report, defaultGeneratedAt: false });
  const restored = JSON.parse(JSON.stringify(snapshot));
  const scoreView = buildOpeningFitScoreTransparency({ report });
  const openingView = buildOpeningVerdictPresentation(recommendation);

  assert.equal(restored.score_contract.version, "repertoire_health_v2");
  assert.equal(scoreView.currentScore, 60);
  assert.equal(scoreView.evidenceConfidence.scope, "repertoire_health");
  assert.equal(openingView.fit.displayName, "Opening Suitability");
  assert.equal(openingView.fit.score, 58);
  assert.equal(openingView.performance.score, 25);
  assert.equal(openingView.confidence.scope, "opening_decision");
  assert.notEqual(openingView.fit.score, openingView.performance.score);
});

test("current report UI has no filtered overall-score calculator", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /function buildFilteredOpeningFitScore/);
  assert.doesNotMatch(app, /weightedScore \* 0\.82/);
});
