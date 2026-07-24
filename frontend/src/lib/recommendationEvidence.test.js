import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFilteredReportDecision,
  confidenceForRecommendation,
  normaliseReportDecision,
  validateRecommendationEvidence,
} from "./recommendationEvidence.js";

test("filtered recommendation and action counts come from the filtered slice", () => {
    const decision = buildFilteredReportDecision([{
      opening: "French Defence",
      context: "faced_as_white",
      openingRole: "faced_as_white",
      games: 3,
      wins: 2,
      draws: 0,
      losses: 1,
    }], 3);

    assert.equal(decision.recommendations[0].sample.scoreRate, 66.7);
    assert.equal(decision.recommendations[0].verdict, "insufficient-data");
    assert.equal(decision.primaryProblem, null);
    assert.equal(decision.nextTrainingAction.type, "collect_more_games");
    assert.match(decision.nextTrainingAction.reason, /five correctly attributed games/);
});

test("owned and faced instances stay separate", () => {
    const decision = buildFilteredReportDecision([
      { opening: "French Defence", context: "black_vs_e4", openingRole: "played_as_black", games: 5, wins: 0, draws: 0, losses: 5 },
      { opening: "French Defence", context: "faced_as_white", openingRole: "faced_as_white", games: 10, wins: 10, draws: 0, losses: 0 },
    ], 15);

    assert.equal(decision.primaryProblem.role, "played_as_black");
    assert.equal(decision.recommendations.find((item) => item.role === "faced_as_white").repertoireOwned, false);
});

test("mismatched WDL and score are rejected", () => {
    const result = validateRecommendationEvidence({
      games: 5,
      wins: 3,
      draws: 1,
      losses: 0,
      scoreRate: 99,
      supportingGameIds: ["one"],
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.includes("results_do_not_reconcile"));
    assert.ok(result.issues.includes("score_rate_does_not_reconcile"));
});

test("confidence sample mismatch is rejected", () => {
    const result = validateRecommendationEvidence({
      games: 5, wins: 2, draws: 2, losses: 1, scoreRate: 60,
      confidence: { level: "high", sampleSize: 22 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.includes("confidence_sample_does_not_reconcile"));
});

test("confidence is capped by opening-specific sample size", () => {
    assert.equal(confidenceForRecommendation(4).level, "low");
    assert.equal(confidenceForRecommendation(10).level, "medium");
    assert.equal(confidenceForRecommendation(15).level, "high");
});

test("saved decisions are downgraded when target evidence is insufficient", () => {
    const decision = normaliseReportDecision({
      schemaVersion: 2,
      recommendations: [{ recommendationId: "french:played_as_black", opening: "French Defence", role: "played_as_black", verdict: "repair", sample: { games: 3, wins: 0, draws: 0, losses: 3, scoreRate: 0 } }],
      primaryProblem: { recommendationId: "french:played_as_black", opening: "French Defence", role: "played_as_black", verdict: "repair", sample: { games: 3, wins: 0, draws: 0, losses: 3, scoreRate: 0 } },
      nextTrainingAction: { type: "repair_repertoire", recommendationId: "french:played_as_black", opening: "French Defence" },
    });

    assert.equal(decision.primaryProblem, null);
    assert.equal(decision.nextTrainingAction.type, "collect_more_games");
});

test("a training action cannot retain a different opening", () => {
    const decision = normaliseReportDecision({
      recommendations: [{ recommendationId: "italian:played_as_white", opening: "Italian Game", role: "played_as_white", verdict: "repair", sample: { games: 5, wins: 1, draws: 0, losses: 4, scoreRate: 20 }, trainingAction: { title: "Repair Italian Game", explanation: "Review the Italian sample." } }],
      primaryProblem: { recommendationId: "italian:played_as_white", opening: "Italian Game", role: "played_as_white", verdict: "repair", sample: { games: 5, wins: 1, draws: 0, losses: 4, scoreRate: 20 } },
      nextTrainingAction: { type: "repair_repertoire", recommendationId: "italian:played_as_white", opening: "French Defence", label: "Repair French Defence", reason: "Based on 22 French games." },
    });
    assert.equal(decision.nextTrainingAction.opening, "Italian Game");
    assert.equal(decision.nextTrainingAction.label, "Repair Italian Game");
    assert.ok(decision.nextTrainingAction.validation.issues.includes("training_opening_does_not_reconcile"));
});
