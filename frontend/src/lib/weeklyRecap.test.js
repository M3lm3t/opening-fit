import test from "node:test";
import assert from "node:assert/strict";
import { comparisonFixtures } from "./fixtures/reportComparisonFixtures.js";
import { buildWeeklyRecap, mergeWeeklyRecapRecord, shouldAutoShowWeeklyRecap, weeklyRecapRecords } from "./weeklyRecap.js";

const plan = (overrides = {}) => ({ status: "active", completionPercent: 50, primaryGoal: "Repair development in the Vienna Game", ...overrides });

test("weekly recap uses stored comparison and training values without filler", () => {
  const recap = buildWeeklyRecap({ currentSnapshot: comparisonFixtures.scoreIncrease.current, previousSnapshot: comparisonFixtures.scoreIncrease.previous, plan: plan(), now: new Date("2026-07-15T12:00:00Z") });
  assert.equal(recap.newGames, 8);
  assert.equal(recap.score.previous, 60);
  assert.equal(recap.score.current, 68);
  assert.equal(recap.trainingCompletion, 50);
  assert.equal(recap.nextFocus, plan().primaryGoal);
});

test("no meaningful new data produces no recap", () => {
  assert.equal(buildWeeklyRecap({ currentSnapshot: comparisonFixtures.firstEver.current, previousSnapshot: null, plan: null }), null);
});

test("no new games produces only an active-plan reminder", () => {
  const reminder = buildWeeklyRecap({ currentSnapshot: comparisonFixtures.noMeaningfulChange.current, previousSnapshot: comparisonFixtures.noMeaningfulChange.current, plan: plan({ completionPercent: 25 }) });
  assert.equal(reminder.type, "training_reminder");
  assert.equal(reminder.trainingCompletion, 25);
  assert.equal(buildWeeklyRecap({ currentSnapshot: comparisonFixtures.noMeaningfulChange.current, previousSnapshot: comparisonFixtures.noMeaningfulChange.current, plan: plan({ status: "completed", completionPercent: 100 }) }), null);
});

test("a recap auto-shows only once in its week unless explicitly opened", () => {
  const recap = { weekStart: "2026-07-13" };
  assert.equal(shouldAutoShowWeeklyRecap(recap, {}), true);
  assert.equal(shouldAutoShowWeeklyRecap(recap, { shownAt: "2026-07-14" }), false);
  assert.equal(shouldAutoShowWeeklyRecap(recap, { dismissedAt: "2026-07-14" }), false);
});

test("weekly records merge cloud and local state and retain bounded history", () => {
  const merged = weeklyRecapRecords({ settings: { preferences: { weeklyRecaps: { "2026-07-13": { shownAt: "cloud" } } } }, localRecords: { "2026-07-06": { shownAt: "local" } } });
  assert.equal(Object.keys(merged).length, 2);
  let records = {};
  for (let index = 0; index < 15; index += 1) records = mergeWeeklyRecapRecord(records, `2026-${String(index + 1).padStart(2, "0")}-01`, { shownAt: "now" });
  assert.equal(Object.keys(records).length, 12);
});
