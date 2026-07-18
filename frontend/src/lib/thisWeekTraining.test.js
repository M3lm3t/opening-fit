import test from "node:test";
import assert from "node:assert/strict";
import { buildFoundationalWeeklyPlan, buildThisWeekTrainingView, openingForWeeklyTask, weeklyTargetMetricLabel } from "./thisWeekTraining.js";

test("first-time users receive a lightweight structured foundation plan", () => {
  const plan = buildFoundationalWeeklyPlan({ report: {} });
  assert.equal(plan.foundation, true);
  assert.equal(plan.tasks.length, 3);
  assert.ok(plan.estimatedMinutes >= 20 && plan.estimatedMinutes <= 40);
  assert.ok(plan.tasks.every((task) => task.explanation && task.successCriteria));
});

test("low-data plans describe the sample without claiming improvement", () => {
  const plan = buildFoundationalWeeklyPlan({ report: { gamesImported: 2, topOpenings: [{ name: "French Defence" }] } });
  assert.match(plan.reason, /Only 2 recent games/);
  assert.doesNotMatch(plan.reason, /improv/i);
});

test("the view selects exactly one next action and collapsible completed tasks", () => {
  const plan = buildFoundationalWeeklyPlan();
  plan.tasks[0].status = "completed";
  const view = buildThisWeekTrainingView(plan);
  assert.equal(view.nextTask.id, plan.tasks[1].id);
  assert.equal(view.completedTasks.length, 1);
  assert.equal(view.completionPercent, 33);
});

test("weekly completion includes future-game and reassessment guidance", () => {
  const plan = buildFoundationalWeeklyPlan();
  plan.status = "completed";
  plan.tasks = plan.tasks.map((task) => ({ ...task, status: "completed" }));
  const view = buildThisWeekTrainingView(plan);
  assert.equal(view.state, "completed");
  assert.match(view.futureCue, /next games/i);
  assert.match(view.reassessment, /new valid report|next week/i);
});

test("task opening metadata keeps Black training oriented as Black", () => {
  assert.equal(openingForWeeklyTask({ openingId: "french-defense", trainingSide: "black" }).side, "black");
  assert.match(weeklyTargetMetricLabel({ type: "task_completion" }, 4), /4 focused tasks/);
});
