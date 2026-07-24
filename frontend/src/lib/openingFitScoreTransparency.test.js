import test from "node:test";
import assert from "node:assert/strict";
import { buildOpeningFitScoreTransparency, OPENINGFIT_SCORE_FORMULA, OPENINGFIT_SCORE_MINIMUM_GAMES } from "./openingFitScoreTransparency.js";

const breakdown = { stability: 78, whitePerformance: 64, blackPerformance: 58, confidence: 82, weaknessControl: 70, recentConsistency: 72 };
const model = { header: { games: 30 }, health: { score: 68, confidence: "High confidence" } };

test("score exposes real weighted formula inputs and separate report coverage", () => {
  const view = buildOpeningFitScoreTransparency({ model, report: { openingFitScoreBreakdown: breakdown } });
  assert.equal(view.currentScore, 68);
  assert.equal(view.coverage, "Broad report coverage");
  assert.equal(view.provisional, false);
  assert.deepEqual(view.components.map((item) => item.key), OPENINGFIT_SCORE_FORMULA.map((item) => item.key));
  assert.equal(view.components.reduce((sum, item) => sum + item.weight, 0), 100);
  assert.match(view.meaning, /not your chess rating/i);
  assert.deepEqual(view.scale, { minimum: 0, maximum: 100 });
});

test("fewer than the minimum games visibly marks the score provisional", () => {
  const view = buildOpeningFitScoreTransparency({ model: { header: { games: 3 }, health: { score: 42, confidence: "Low confidence" } }, report: { openingFitScoreBreakdown: { ...breakdown, confidence: 20 } } });
  assert.equal(view.provisional, true);
  assert.equal(view.statusLabel, "Provisional score");
  assert.match(view.smallSamples, new RegExp(`Fewer than ${OPENINGFIT_SCORE_MINIMUM_GAMES}`));
});

test("missing component data does not invent a breakdown", () => {
  const view = buildOpeningFitScoreTransparency({ model, report: {} });
  assert.equal(view.hasComponentData, false);
  assert.deepEqual(view.components, []);
  assert.match(view.affects, /older report.*not a compatible component breakdown/i);
});

test("previous-score comparison identifies the largest weighted component change", () => {
  const view = buildOpeningFitScoreTransparency({
    model,
    report: { openingFitScoreBreakdown: breakdown },
    previousReport: { openingfit_score: 62, score_components: { ...breakdown, stability: 50, whitePerformance: 63 } },
  });
  assert.equal(view.previousScore, 62);
  assert.match(view.reasonForChange, /familiarity.*increased from 50 to 78/i);
});
