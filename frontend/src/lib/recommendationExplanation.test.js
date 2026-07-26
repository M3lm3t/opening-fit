import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendationExplanation, MISSING_RECOMMENDATION_EVIDENCE } from "./recommendationExplanation.js";

test("complete evidence is reconciled and separates observation from interpretation", () => {
  const view = buildRecommendationExplanation({
    role: "played_as_black",
    sample: { games: 8, wins: 4, draws: 1, losses: 3, scoreRate: 99 },
    confidence: { level: "medium", sampleSize: 8 },
    recurringIssue: { description: "Development was delayed.", occurrences: 3, positionOrMoveSequence: "after 1.d4 d5 2.c4 e6" },
    trainingAction: { explanation: "Review this branch before your next games." },
  }, { totalGames: 20 });
  assert.deepEqual(view.rows.map((row) => row.key), ["games", "results", "score", "frequency", "colour", "issue", "confidence"]);
  assert.equal(view.rows.find((row) => row.key === "score").value, "56.3%");
  assert.equal(view.interpretation, "Review this branch before your next games.");
});

test("partial evidence displays only defensible fields", () => {
  const view = buildRecommendationExplanation({ games: 6, scoreRate: 52, role: "faced_as_white" });
  assert.deepEqual(view.rows.map((row) => row.key), ["games", "score", "colour"]);
  assert.equal(view.interpretation, "");
});

test("legacy evidence remains readable without treating fit score as chess score", () => {
  const view = buildRecommendationExplanation({ games_played: 7, fitScore: 88, opening_role: "played_as_white", confidence: "Low confidence" });
  assert.deepEqual(view.rows.map((row) => row.key), ["games", "colour", "confidence"]);
});

test("legacy confidence cannot exceed the evidence sample", () => {
  const view = buildRecommendationExplanation({ games: 1, confidence: "High confidence" });
  assert.equal(view.rows.find((row) => row.key === "confidence").value, "Low confidence");
});

test("missing evidence uses the exact safe fallback", () => {
  const view = buildRecommendationExplanation({ fitScore: 92, reason: "A model conclusion." });
  assert.equal(view.hasEvidence, false);
  assert.equal(view.fallback, MISSING_RECOMMENDATION_EVIDENCE);
  assert.equal(view.interpretation, "A model conclusion.");
});

test("unreconciled results are not displayed and a one-game sample is warned", () => {
  const view = buildRecommendationExplanation({ sample: { games: 1, wins: 3, draws: 0, losses: 0, scoreRate: 75 } });
  assert.deepEqual(view.rows.map((row) => row.key), ["games"]);
  assert.match(view.warning, /too small a sample/);
});

test("sample evidence is marked illustrative", () => {
  const view = buildRecommendationExplanation({ games: 5 }, { illustrative: true });
  assert.equal(view.illustrative, true);
});
