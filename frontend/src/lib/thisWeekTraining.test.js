import test from "node:test";
import assert from "node:assert/strict";
import { buildFoundationalWeeklyPlan, buildThisWeekTrainingView, freeTrainingPreviewState, openingForWeeklyTask, weeklyTargetMetricLabel } from "./thisWeekTraining.js";

test("first-time users receive a lightweight structured foundation plan", () => {
  const plan = buildFoundationalWeeklyPlan({ report: {} });
  assert.equal(plan.foundation, true);
  assert.equal(plan.tasks.length, 3);
  assert.ok(plan.estimatedMinutes >= 20 && plan.estimatedMinutes <= 40);
  assert.ok(plan.tasks.every((task) => task.explanation && task.successCriteria));
});

test("low-data plans describe the sample without claiming improvement", () => {
  const plan = buildFoundationalWeeklyPlan({ report: { gamesImported: 311, gamesAnalysed: 280, topOpenings: [{ name: "French Defence", games: 2 }] } });
  assert.match(plan.reason, /2 relevant games support French Defen[cs]e overall/);
  assert.match(plan.reason, /not enough repeated examples of one French Defen[cs]e branch/);
  assert.doesNotMatch(plan.reason, /311|280/);
  assert.doesNotMatch(plan.reason, /improv/i);
});

test("free training uses the report priority without selecting a second opening", () => {
  const report = {
    analysisId: "analysis-caro",
    topOpenings: [{ name: "Vienna Game", games: 60 }],
    reportDecision: {
      nextTrainingAction: {
        type: "repair_repertoire",
        recommendationId: "caro:played_as_black",
        opening: "Caro-Kann Defence",
        role: "played_as_black",
        reason: "The Caro-Kann is the clearest supported repair priority.",
        sample: { games: 12, gameIds: ["caro-1"] },
      },
    },
  };
  const plan = buildFoundationalWeeklyPlan({ report });

  assert.equal(plan.foundation, false);
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].openingName, "Caro-Kann Defence");
  assert.equal(plan.tasks[0].estimatedMinutes, 10);
  assert.match(plan.primaryGoal, /Caro-Kann Defence.*10 minutes/);
  assert.doesNotMatch(JSON.stringify(plan), /Vienna/);
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

test("conflicting task and plan contexts fail closed", () => {
  const plan = buildFoundationalWeeklyPlan();
  plan.tasks[1].openingName = "Unrelated opening";
  const view = buildThisWeekTrainingView(plan);
  assert.equal(view.state, "unavailable");
  assert.equal(view.tasks.length, 0);
});

test("free training appears before the contextual Plus invitation", () => {
  const task = { id: "free-task", status: "pending" };
  assert.deepEqual(freeTrainingPreviewState(task), { state: "ready", started: false, completed: false, showPlusInvitation: false });
  assert.equal(freeTrainingPreviewState(task, "free-task").showPlusInvitation, true);
  assert.deepEqual(freeTrainingPreviewState({ ...task, status: "completed" }), { state: "completed", started: true, completed: true, showPlusInvitation: true });
});
