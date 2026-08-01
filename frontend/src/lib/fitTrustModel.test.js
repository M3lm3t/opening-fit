import test from "node:test";
import assert from "node:assert/strict";
import {
  OPENING_EVIDENCE_THRESHOLDS,
  analysisConfidence,
  buildOpeningVerdictPresentation,
  evidenceBasedReason,
  fitEvidence,
  saveRecommendationFeedback,
} from "./fitTrustModel.js";

test("strong fit and weak current performance remain separate", () => {
  const model = buildOpeningVerdictPresentation({ fitScore: 78, sample: { games: 12, wins: 3, draws: 2, losses: 7 }, verdict: "repair" });
  assert.equal(model.fit.label, "Strong");
  assert.equal(model.performance.label, "Struggling");
  assert.equal(model.confidence.label, "Moderate");
});

test("weak fit and strong results can coexist at low confidence", () => {
  const model = buildOpeningVerdictPresentation({ fit_score: 34, games: 6, wins: 5, draws: 0, losses: 1, verdict: "keep" });
  assert.equal(model.fit.label, "Weak");
  assert.equal(model.performance.label, "Strong");
  assert.equal(model.confidence.label, "Low");
});

test("low samples are insufficient without hiding the observed result", () => {
  const model = buildOpeningVerdictPresentation({ fitScore: 90, games: 2, wins: 2, draws: 0, losses: 0 });
  assert.equal(model.performance.label, "Strong");
  assert.equal(model.confidence.label, "Insufficient data");
  assert.match(model.confidence.detail, /not enough reliable evidence/);
});

test("missing fit data is unknown rather than borrowed from performance", () => {
  const model = buildOpeningVerdictPresentation({ games: 10, scoreRate: 62 });
  assert.equal(model.fit.label, "Unknown");
  assert.equal(model.performance.label, "Strong");
});

test("branch-level evidence repairs the branch without rejecting the opening", () => {
  const model = buildOpeningVerdictPresentation({
    opening: "Vienna Game",
    fitScore: 70,
    games: 10,
    wins: 4,
    draws: 2,
    losses: 4,
    verdict: "replace",
    issue: { positionOrMoveSequence: "4...Nf6" },
  });
  assert.equal(model.recommendation, "Keep Vienna Game, but repair the branch after 4...Nf6.");
});

test("legacy reports receive safe bands without treating result score as fit", () => {
  const model = buildOpeningVerdictPresentation({ games_played: 12, win_rate: 60, recommendation_label: "Keep" });
  assert.equal(model.fit.label, "Unknown");
  assert.equal(model.performance.label, "Strong");
  assert.equal(model.confidence.label, "Moderate");
  assert.equal(model.recommendation, "Keep");
});

test("high confidence requires the central threshold and traceable reconciled games", () => {
  const gameIds = Array.from({ length: OPENING_EVIDENCE_THRESHOLDS.high }, (_, index) => `game-${index}`);
  assert.equal(analysisConfidence({ sample: { games: 25, wins: 13, draws: 4, losses: 8, gameIds } }).level, "high");
  assert.equal(analysisConfidence({ games: 15, scoreRate: 60 }).level, "moderate");
});

test("only genuine explanation inputs are exposed", () => assert.deepEqual(fitEvidence({ games: 4, planClarityScore: 61 }).map(([name]) => name), ["Current performance", "Move-order consistency"]));
test("missing recommendation explanation fails safely", () => assert.match(evidenceBasedReason({}), /does not contain enough/));
test("feedback supports anonymous and authenticated analytics senders", async () => {
  assert.equal(await saveRecommendationFeedback(async () => true, { feedback: "helpful" }), true);
  assert.equal(await saveRecommendationFeedback(async () => false, { feedback: "helpful", authenticated: true }), false);
  assert.equal(await saveRecommendationFeedback(async () => { throw new Error("offline"); }, {}), false);
});
