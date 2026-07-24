import test from "node:test";
import assert from "node:assert/strict";
import { buildPrimaryReportSummary, primaryComparisonState } from "./primaryReportSummary.js";

const completeModel = {
  header: { games: 24 },
  health: { score: 68, confidence: "High confidence", games: 24 },
  verdict: { paragraph: "Italian Game is the clearest area to keep; Sicilian Defence is the most important repair target.", strongest: "Italian Game", weakness: "Sicilian Defence" },
  repertoire: [
    { key: "white", opening: "Italian Game", confidence: "High confidence", games: 10 },
    { key: "black_e4", opening: "Caro-Kann Defence", confidence: "Medium confidence", games: 8 },
    { key: "black_d4", opening: "Slav Defence", confidence: "Medium confidence", games: 6 },
  ],
  training: { opening: "Sicilian Defence", objective: "Review the recurring development issue.", source: { name: "Sicilian Defence" } },
};

test("free and premium first reports share the same analysis hierarchy", () => {
  const free = buildPrimaryReportSummary(completeModel, { isPremium: false });
  const premium = buildPrimaryReportSummary(completeModel, { isPremium: true });
  assert.deepEqual(free, premium);
  assert.equal(free.score, 68);
  assert.equal(free.slots.length, 3);
  assert.equal(free.training.cta, "Start this week’s training");
});

test("returning premium users continue an in-progress weekly plan", () => {
  const view = buildPrimaryReportSummary(completeModel, { isPremium: true, weeklyTrainingPlan: { completionPercent: 50 } });
  assert.equal(view.training.cta, "Continue training");
});

test("no previous report hides comparison while a failed comparison remains visible", () => {
  assert.equal(primaryComparisonState({ authenticated: true }), "hidden");
  assert.equal(primaryComparisonState({ authenticated: true, error: "Unavailable" }), "error");
  assert.equal(primaryComparisonState({ authenticated: true, loading: true }), "loading");
  assert.equal(primaryComparisonState({ authenticated: false, previousReport: {} }), "hidden");
});

test("incomplete repertoire keeps all three required slots without invented openings", () => {
  const view = buildPrimaryReportSummary({ ...completeModel, repertoire: completeModel.repertoire.slice(0, 1) });
  assert.equal(view.incompleteRepertoire, true);
  assert.deepEqual(view.slots.map((slot) => slot.label), ["White", "Black against 1.e4", "Black against 1.d4"]);
  assert.equal(view.slots[1].opening, "Not enough evidence yet");
});

test("low data produces a calm prominent confidence warning", () => {
  const view = buildPrimaryReportSummary({ ...completeModel, health: { score: null, confidence: "Low confidence", games: 2 }, verdict: { paragraph: "The current game sample is too small for a confident repertoire verdict." } });
  assert.equal(view.score, null);
  assert.match(view.confidenceWarning, /recommendations are provisional/i);
  assert.doesNotMatch(view.confidenceWarning, /bad|failed|unreliable/i);
});

test("coach verdict is exactly one sentence", () => {
  const view = buildPrimaryReportSummary(completeModel);
  assert.equal((view.verdict.match(/[.!?]/g) || []).length, 1);
});
