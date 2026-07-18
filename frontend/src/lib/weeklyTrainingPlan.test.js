import assert from "node:assert/strict";
import test from "node:test";

import {
  WEEKLY_TRAINING_PLAN_SCHEMA_VERSION,
  adaptLegacyTrainingPlan,
  buildWeeklyTrainingPlan,
  completeWeeklyTask,
  isReusableWeeklyPlan,
  weeklyPlanWindow,
} from "./weeklyTrainingPlan.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const REPORT_ID = "00000000-0000-4000-8000-000000000010";
const NOW = new Date("2026-07-18T12:00:00Z");
const repertoire = [{ id: "rep-1", status: "active", slot: "white_primary", canonical_opening_id: "vienna-game", canonical_name: "Vienna Game", display_name: "Vienna Game", sample_size: 14, key_weakness: "Early queen pressure" }];
const report = {
  report_id: REPORT_ID,
  source_platform: "chesscom",
  source_username: "Player",
  total_games_analysed: 24,
  weaknesses: [{ issue_id: "issue-1", title: "Early queen pressure", opening: "Vienna Game", frequency: 4, source_game_ids: ["game-1", "game-2"], move_line: ["e4", "e5", "Nc3"] }],
  training_plan: ["Review early queen pressure in the Vienna Game.", "Study an unrelated Black opening."],
};

test("creates a versioned 3-5 task weekly plan around one main weakness", () => {
  const result = buildWeeklyTrainingPlan({ userId: USER_ID, report, repertoire, reportId: REPORT_ID, now: NOW });
  assert.equal(result.state, "created");
  assert.equal(result.plan.schemaVersion, WEEKLY_TRAINING_PLAN_SCHEMA_VERSION);
  assert.equal(result.plan.tasks.length >= 3 && result.plan.tasks.length <= 5, true);
  assert.equal(result.plan.estimatedMinutes >= 20 && result.plan.estimatedMinutes <= 40, true);
  assert.equal(result.plan.tasks.every((task) => task.explanation && task.successCriteria), true);
  assert.equal(result.plan.tasks.every((task) => !task.openingId || task.openingId === "vienna-game"), true);
  assert.match(result.plan.primaryGoal, /early queen pressure/i);
});

test("reuses an active plan in the same week and report", () => {
  const plan = buildWeeklyTrainingPlan({ userId: USER_ID, report, repertoire, reportId: REPORT_ID, now: NOW }).plan;
  assert.equal(isReusableWeeklyPlan(plan, { ...weeklyPlanWindow(NOW), reportId: REPORT_ID }), true);
  assert.equal(isReusableWeeklyPlan(plan, { ...weeklyPlanWindow(NOW), reportId: "00000000-0000-4000-8000-000000000011" }), false);
});

test("stores task completion and completes the plan at 100 percent", () => {
  let plan = buildWeeklyTrainingPlan({ userId: USER_ID, report, repertoire, reportId: REPORT_ID, now: NOW }).plan;
  plan.tasks.forEach((task) => { plan = completeWeeklyTask(plan, task.id); });
  assert.equal(plan.completionPercent, 100);
  assert.equal(plan.status, "completed");
  assert.ok(plan.completedAt);
});

test("missing repertoire prevents plan creation", () => {
  assert.equal(buildWeeklyTrainingPlan({ userId: USER_ID, report, repertoire: [], reportId: REPORT_ID, now: NOW }).state, "missing-repertoire");
});

test("insufficient games never invents a training plan", () => {
  const sparse = { ...report, total_games_analysed: 3 };
  assert.equal(buildWeeklyTrainingPlan({ userId: USER_ID, report: sparse, repertoire, reportId: REPORT_ID, now: NOW }).state, "insufficient-games");
});

test("old text plans adapt without losing their displayed wording", () => {
  const adapted = adaptLegacyTrainingPlan(["Replay the Vienna line.", "Review one recent game."]);
  assert.equal(adapted.length, 2);
  assert.equal(adapted[0].title, "Replay the Vienna line.");
  assert.equal(adapted[0].explanation, "Replay the Vienna line.");
  assert.equal(adapted.every((task) => task.type === "concept_review"), true);
});
