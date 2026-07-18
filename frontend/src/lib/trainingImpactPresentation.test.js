import test from "node:test";
import assert from "node:assert/strict";
import { buildTrainingImpactView, TRAINING_IMPACT_STATES } from "./trainingImpactPresentation.js";

const outcome = (status, overrides = {}) => ({
  trainingFocusId: overrides.trainingFocusId || `focus-${status}`,
  status,
  laterGameCount: 3,
  relevantPositionCount: 3,
  correctApplicationCount: status === "improved" ? 2 : 0,
  repeatedMistakeCount: status === "not_improved" ? 2 : 0,
  beforeMetric: null,
  afterMetric: { applicationPercent: status === "improved" ? 67 : null, consistencyPercent: status === "improved" ? 67 : null, openingResultPercent: null, openingResultGameCount: 0 },
  explanation: "Measured outcome",
  confidence: "medium",
  ...overrides,
});

const report = (outcomes, context = {}) => ({ training_outcomes: outcomes, training_outcome_context: context });

test("first use explains how future later-game evidence is created", () => {
  const view = buildTrainingImpactView({ report: {} });
  assert.equal(view.state, "first-use");
  assert.match(view.message, /complete a training focus/i);
  assert.equal(view.hasHistory, false);
});

test("completed training with no eligible later games has a neutral no-new-games state", () => {
  const view = buildTrainingImpactView({ report: report([outcome("not_encountered", { laterGameCount: 0, relevantPositionCount: 0 })]) });
  assert.equal(view.state, "no-new-games");
  assert.match(view.message, /no eligible later games/i);
  assert.doesNotMatch(view.message, /failed|declined/i);
});

test("meaningful application uses raw counts and separates completion, application and results", () => {
  const view = buildTrainingImpactView({ report: report([outcome("improved")], { "focus-improved": { openingName: "Vienna Game", title: "Development focus", completedAt: "2026-06-01T00:00:00Z" } }) });
  assert.equal(view.state, "ready");
  assert.match(view.outcomes[0].applicationText, /2 of 3 later games/i);
  assert.match(view.outcomes[0].completionText, /not proof of improvement/i);
  assert.match(view.outcomes[0].resultText, /not enough same-opening games/i);
  assert.match(view.outcomes[0].confidenceLabel, /medium confidence.*3 later games.*3 relevant positions/i);
});

test("repeated issue wording is conservative", () => {
  const view = buildTrainingImpactView({ report: report([outcome("not_improved")], { "focus-not_improved": { title: "Development issue" } }) });
  assert.match(view.outcomes[0].applicationText, /same development issue occurred in 2 later games/i);
  assert.doesNotMatch(view.outcomes[0].applicationText, /training caused|rating/i);
});

test("insufficient samples remain not enough evidence", () => {
  const view = buildTrainingImpactView({ report: report([outcome("insufficient_data", { laterGameCount: 1, relevantPositionCount: 1 })]) });
  assert.equal(view.state, "insufficient-data");
  assert.equal(view.outcomes[0].applicationText, "Not enough evidence yet.");
});

test("a position not encountered is not treated as failure", () => {
  const view = buildTrainingImpactView({ report: report([outcome("not_encountered", { laterGameCount: 4, relevantPositionCount: 0 })]) });
  assert.equal(view.outcomes[0].applicationText, "This position has not appeared again yet.");
});

test("broader opening percentages require five games and include the raw sample", () => {
  const small = buildTrainingImpactView({ report: report([outcome("improved", { afterMetric: { openingResultPercent: 75, openingResultGameCount: 4 } })]) });
  assert.doesNotMatch(small.outcomes[0].resultText, /75%/);
  const supported = buildTrainingImpactView({ report: report([outcome("improved", { afterMetric: { openingResultPercent: 60, openingResultGameCount: 5 } })]) });
  assert.match(supported.outcomes[0].resultText, /60%.*5 later games/i);
  assert.match(supported.outcomes[0].resultText, /not proof/i);
});

test("main surfaces receive no more than three highest-value outcomes", () => {
  const view = buildTrainingImpactView({ report: report([
    outcome("not_encountered"), outcome("insufficient_data"), outcome("partially_improved"), outcome("not_improved"), outcome("improved"),
  ]) });
  assert.equal(view.outcomes.length, 3);
  assert.deepEqual(view.outcomes.map((item) => item.status), ["improved", "not_improved", "partially_improved"]);
  assert.deepEqual(TRAINING_IMPACT_STATES, ["first-use", "no-new-games", "ready", "insufficient-data"]);
});

test("repertoire entries reuse their persisted structured outcomes", () => {
  const view = buildTrainingImpactView({ repertoireEntries: [{ display_name: "Vienna Game", current_training_focus: "Development", training_outcome: outcome("improved") }] });
  assert.equal(view.outcomes[0].openingName, "Vienna Game");
  assert.equal(view.hasHistory, true);
});
