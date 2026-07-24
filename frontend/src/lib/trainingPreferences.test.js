import test from "node:test";
import assert from "node:assert/strict";
import { buildFoundationalWeeklyPlan } from "./thisWeekTraining.js";
import { buildWeeklyTrainingPlan } from "./weeklyTrainingPlan.js";
import { hasCompleteTrainingPreferences, normaliseTrainingPreferences, resolveTrainingPreferences, shouldStartPostReportOnboarding } from "./trainingPreferences.js";

const complete = (weeklyMinutes = 30) => ({ mainGoal: "improve_consistency", playFrequency: "weekly", weeklyMinutes, status: "completed" });

test("authenticated onboarding resolves preferences from existing settings", () => {
  const result = resolveTrainingPreferences({ authenticated: true, settings: { preferences: { trainingPreferences: complete(60) } }, localPreferences: complete(15) });
  assert.equal(result.weeklyMinutes, 60);
  assert.equal(result.mainGoal, "improve_consistency");
});

test("anonymous first-report onboarding uses local preferences", () => {
  const result = resolveTrainingPreferences({ authenticated: false, settings: {}, localPreferences: complete(15) });
  assert.equal(result.weeklyMinutes, 15);
  assert.equal(hasCompleteTrainingPreferences(result), true);
});

test("personalisation never opens automatically after a first report", () => {
  assert.equal(shouldStartPostReportOnboarding({ firstReport: true, reportVisible: true, hydrated: true, authenticated: false, profileLoading: false, preferences: {} }), false);
  assert.equal(shouldStartPostReportOnboarding({ firstReport: true, reportVisible: true, hydrated: true, authenticated: true, profileLoading: true, preferences: {} }), false);
  assert.equal(shouldStartPostReportOnboarding({ firstReport: true, reportVisible: true, hydrated: true, authenticated: true, profileLoading: false, preferences: {} }), false);
  assert.equal(shouldStartPostReportOnboarding({ firstReport: true, reportVisible: true, hydrated: true, authenticated: true, profileLoading: false, preferences: { status: "skipped" } }), false);
});

test("invalid or partial answers do not become complete preferences", () => {
  const result = normaliseTrainingPreferences({ mainGoal: "unknown", playFrequency: "weekly", weeklyMinutes: 17 });
  assert.equal(result.mainGoal, "");
  assert.equal(result.weeklyMinutes, null);
  assert.equal(hasCompleteTrainingPreferences(result), false);
});

test("training time changes foundational plan size and wording", () => {
  const short = buildFoundationalWeeklyPlan({ report: {}, preferences: complete(15) });
  const long = buildFoundationalWeeklyPlan({ report: {}, preferences: complete(60) });
  assert.equal(short.tasks.length, 3);
  assert.equal(short.estimatedMinutes, 15);
  assert.equal(long.tasks.length, 5);
  assert.equal(long.estimatedMinutes, 60);
  assert.match(long.primaryGoal, /consistent/i);
  assert.match(long.reason, /few games each week/i);
});

test("saved weekly plans are generated to the selected training budget", () => {
  const report = { total_games_analysed: 12, weaknesses: [{ title: "Delayed development", opening: "Vienna Game", games: 4 }] };
  const repertoire = [{ status: "active", slot: "white_primary", display_name: "Vienna Game", sample_size: 12 }];
  const short = buildWeeklyTrainingPlan({ userId: "user-1", report, repertoire, preferences: complete(15) });
  const long = buildWeeklyTrainingPlan({ userId: "user-1", report, repertoire, preferences: complete(60) });
  assert.equal(short.plan.tasks.length, 3);
  assert.equal(short.plan.estimatedMinutes, 15);
  assert.equal(long.plan.tasks.length, 5);
  assert.equal(long.plan.estimatedMinutes, 60);
});
