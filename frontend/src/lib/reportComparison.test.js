import assert from "node:assert/strict";
import test from "node:test";

import { compareReportSnapshots, REPORT_COMPARISON_RULES } from "./reportComparison.js";
import { comparisonFixtures } from "./fixtures/reportComparisonFixtures.js";

test("first-ever report returns the complete empty comparison shape", () => {
  const result = compareReportSnapshots(comparisonFixtures.firstEver.previous, comparisonFixtures.firstEver.current);
  assert.equal(result.hasPreviousReport, false);
  assert.equal(result.newGamesCount, null);
  assert.deepEqual(result.openingChanges, []);
  assert.deepEqual(result.summaryHighlights, []);
});

test("reports score increases and decreases deterministically", () => {
  const increase = compareReportSnapshots(comparisonFixtures.scoreIncrease.previous, comparisonFixtures.scoreIncrease.current);
  const decrease = compareReportSnapshots(comparisonFixtures.scoreDecrease.previous, comparisonFixtures.scoreDecrease.current);
  assert.equal(increase.scoreChange, 8);
  assert.equal(increase.scoreStatus, "improved");
  assert.equal(increase.newGamesCount, 8);
  assert.equal(increase.summaryHighlights[0].status, "improved");
  assert.equal(decrease.scoreChange, -7);
  assert.equal(decrease.scoreStatus, "declined");
  assert.equal(decrease.summaryHighlights[0].status, "declined");
});

test("changes inside the explicit margins remain stable", () => {
  const result = compareReportSnapshots(comparisonFixtures.noMeaningfulChange.previous, comparisonFixtures.noMeaningfulChange.current);
  assert.equal(result.summaryHighlights.some((item) => item.type === "score"), false);
  assert.equal(result.openingChanges.every((item) => item.status === "stable"), true);
});

test("existing opening aliases are compared under one canonical opening", () => {
  const result = compareReportSnapshots(comparisonFixtures.renamedOpening.previous, comparisonFixtures.renamedOpening.current);
  const italian = result.openingChanges.find((item) => item.opening === "Italian Game");
  assert.ok(italian);
  assert.equal(italian.previousDisplayName, "Italian Game");
  assert.equal(italian.currentDisplayName, "Giuoco Piano");
  assert.equal(italian.side, "white");
  assert.equal(italian.status, "improved");
});

test("tiny opening samples never produce an improvement claim", () => {
  const result = compareReportSnapshots(comparisonFixtures.smallSample.previous, comparisonFixtures.smallSample.current);
  assert.equal(result.openingChanges[0].status, "insufficient evidence");
  assert.equal(result.openingChanges[0].scoreChange, null);
  assert.equal(result.confidenceWarnings[0].code, "small_opening_sample");
  assert.equal(REPORT_COMPARISON_RULES.minimumOpeningGames, 5);
});

test("tiny overall samples never produce a score improvement claim", () => {
  const previous = { ...comparisonFixtures.scoreIncrease.previous, total_games_analysed: 2 };
  const current = { ...comparisonFixtures.scoreIncrease.current, total_games_analysed: 3, openingfit_score: 95 };
  const result = compareReportSnapshots(previous, current);
  assert.equal(result.scoreChange, null);
  assert.equal(result.scoreStatus, "insufficient evidence");
  assert.equal(result.summaryHighlights.some((item) => item.type === "score"), false);
  assert.ok(result.confidenceWarnings.some((warning) => warning.code === "small_report_sample"));
});

test("changed platforms disable direct performance comparison", () => {
  const result = compareReportSnapshots(comparisonFixtures.changedPlatform.previous, comparisonFixtures.changedPlatform.current);
  assert.equal(result.scoreChange, null);
  assert.equal(result.openingChanges.every((item) => item.status === "insufficient evidence"), true);
  assert.equal(result.confidenceWarnings[0].code, "platform_changed");
});

test("missing old fields stay safe and do not create invented changes", () => {
  const result = compareReportSnapshots(comparisonFixtures.missingOldFields.previous, comparisonFixtures.missingOldFields.current);
  assert.equal(result.hasPreviousReport, true);
  assert.equal(result.scoreChange, null);
  assert.deepEqual(result.openingChanges, []);
});

test("new repertoire recommendations are identified by slot", () => {
  const result = compareReportSnapshots(comparisonFixtures.newRecommendation.previous, comparisonFixtures.newRecommendation.current);
  const change = result.repertoireChanges.find((item) => item.type === "recommendation changed" && item.slot === "white");
  assert.ok(change);
  assert.equal(change.previousOpening, "Italian Game");
  assert.equal(change.currentOpening, "Queen's Gambit");
});

test("repertoire membership and recommendation-confidence changes are explicit", () => {
  const previous = {
    ...comparisonFixtures.newRecommendation.previous,
    recommendation_confidence: { white: { label: "Low confidence" } },
  };
  const current = {
    ...previous,
    active_repertoire: { items: [{ name: "Italian Game", colour: "white" }, { name: "Slav Defense", colour: "black" }] },
    recommendation_confidence: { white: { label: "High confidence" } },
  };
  const result = compareReportSnapshots(previous, current);
  assert.ok(result.repertoireChanges.some((item) => item.type === "opening retained"));
  assert.ok(result.repertoireChanges.some((item) => item.type === "opening added"));
  assert.ok(result.repertoireChanges.some((item) => item.type === "opening removed"));
  assert.ok(result.repertoireChanges.some((item) => item.type === "recommendation confidence increased"));
});

test("structured weakness IDs survive renamed copy and training wording avoids causation", () => {
  const previous = {
    ...comparisonFixtures.renamedOpening.previous,
    weaknesses: [{ issue_id: "issue-1", title: "Old wording", opening: "Italian Game", frequency: 4, confidence: "Medium" }],
    training_priorities: [{ issue_id: "issue-1", title: "Review Italian", opening: "Italian Game" }],
  };
  const current = {
    ...comparisonFixtures.renamedOpening.current,
    weaknesses: [{ issue_id: "issue-1", title: "New wording", opening: "Giuoco Piano", frequency: 1, confidence: "Medium" }],
  };
  const result = compareReportSnapshots(previous, current);
  assert.equal(result.resolvedWeaknesses[0].issueId, "issue-1");
  assert.match(result.trainingProgress[0].message, /after this became a training focus/i);
  assert.doesNotMatch(result.trainingProgress[0].message, /caused/i);
});

test("White and Black opening results remain separate", () => {
  const result = compareReportSnapshots(comparisonFixtures.renamedOpening.previous, comparisonFixtures.renamedOpening.current);
  assert.deepEqual([...new Set(result.openingChanges.map((item) => item.side))].sort(), ["black", "white"]);
});

test("measured training outcomes replace inferred training claims", () => {
  const previous = comparisonFixtures.scoreIncrease.previous;
  const current = {
    ...comparisonFixtures.scoreIncrease.current,
    training_outcomes: [{
      trainingFocusId: "focus-1",
      status: "not_encountered",
      laterGameCount: 4,
      relevantPositionCount: 0,
      correctApplicationCount: 0,
      repeatedMistakeCount: 0,
      beforeMetric: null,
      afterMetric: { applicationPercent: null, openingResultPercent: null },
      explanation: "The position has not appeared again yet.",
      confidence: "medium",
    }],
    training_outcome_context: { "focus-1": { openingName: "Vienna Game" } },
  };
  const result = compareReportSnapshots(previous, current);
  assert.equal(result.trainingProgress.length, 1);
  assert.equal(result.trainingProgress[0].status, "not_encountered");
  assert.match(result.trainingProgress[0].message, /not appeared again/i);
  assert.doesNotMatch(result.trainingProgress[0].message, /caused|rating improvement/i);
});
