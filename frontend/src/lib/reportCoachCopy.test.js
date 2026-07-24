import test from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_COACH_TEMPLATES,
  analysedGameSentence,
  formatChessScore,
  formatRecommendationConfidence,
  missingSlotCopy,
  recommendationCopy,
  trainingActionCopy,
} from "./reportCoachCopy.js";

const frenchThree = { opening: "French Defence", role: "faced_as_white", sampleSizeStatus: "insufficient_data", sample: { games: 3, wins: 2, draws: 0, losses: 1, scoreRate: 66.7 }, confidence: { level: "low" } };

test("confidence labels always explain their opening-specific sample", () => {
  assert.match(formatRecommendationConfidence({ sample: { games: 15 }, confidence: { level: "high", recency: new Date().toISOString() } }), /^High confidence — based on 15 recent games\.$/);
  assert.match(formatRecommendationConfidence(frenchThree), /only 3 relevant games/);
  assert.match(formatRecommendationConfidence({ sample: { games: 15 }, confidence: { level: "high", recency: "2020-01-01" } }), /15 older games.*may not reflect your current play/);
});

test("small positive samples remain early signals and never definite weaknesses", () => {
  const copy = recommendationCopy(frenchThree, "repair");
  assert.match(copy, /Early signal/);
  assert.match(copy, /not an established weakness/);
  assert.doesNotMatch(copy, /most worth fixing|definite weakness/i);
});

test("counts and chess score come only from the canonical sample", () => {
  assert.match(recommendationCopy({ ...frenchThree, games: 22 }, "repair"), /only 3 French Defence games/);
  assert.equal(formatChessScore(frenchThree), "Score: 66.7% — wins count as 1 point and draws as half a point.");
  assert.doesNotMatch(formatChessScore(frenchThree), /win rate/i);
});

test("training copy cannot invent an absent variation or move sequence", () => {
  const broad = trainingActionCopy({ title: "Review the Caro-Kann", variationName: "Invented Variation", lineOrPosition: "1.e4 c6" }, { opening: "Caro-Kann Defence", role: "played_as_black", sample: { games: 11 } });
  assert.doesNotMatch(broad.explanation, /Advance Variation|1\.e4 c6/);
  assert.doesNotMatch(broad.explanation, /Invented Variation/);
  assert.match(broad.explanation, /Review three recent Caro-Kann Defence losses/);
  const specific = trainingActionCopy({ title: "Fix development", exercise: "Practise the position five times.", completionTarget: { label: "Finish five correct repetitions." } }, { opening: "Caro-Kann Defence", variationName: "Advance Variation", sample: { games: 11 }, issue: { occurrences: 4, positionOrMoveSequence: "1.e4 c6 2.d4 d5 3.e5", description: "Learn the ...Bf5, ...e6 and ...c5 plan." } });
  assert.match(specific.explanation, /Advance Variation/);
  assert.match(specific.explanation, /five correct repetitions/);
});

test("missing states are useful and never render undefined", () => {
  [missingSlotCopy("white"), missingSlotCopy("black_e4"), missingSlotCopy("black_d4"), ...Object.values(REPORT_COACH_TEMPLATES), analysedGameSentence(1)].forEach((copy) => {
    assert.ok(copy.length > 15);
    assert.doesNotMatch(copy, /undefined|usable opening signals/i);
  });
});
