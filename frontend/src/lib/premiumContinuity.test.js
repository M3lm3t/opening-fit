import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildPremiumTrainingHistory, buildPremiumWeeklyOverview, contextualPlusContinuation, repertoireIntentions, trainingResponsePlans } from "./premiumContinuity.js";

const tasks = Array.from({ length: 6 }, (_, index) => ({
  id: `task-${index + 1}`,
  order: index + 1,
  title: index ? `Supporting task ${index}` : "Review the Caro-Kann advance",
  openingName: "Caro-Kann Defense",
  estimatedMinutes: 5,
  status: index < 2 ? "completed" : "pending",
  sourceGameIds: index ? [] : ["game-1", "game-2"],
  startedAt: "2026-07-20T10:00:00Z",
  completedAt: index < 2 ? "2026-07-21T10:00:00Z" : null,
}));

const plan = {
  id: "plan-1",
  createdAt: "2026-07-20T09:00:00Z",
  weekEnd: "2026-07-26",
  estimatedMinutes: 30,
  trainingPriority: { evidenceCount: 7, confidenceStatus: "Usable sample" },
  tasks,
};

test("premium weekly overview makes one task primary and caps secondary work at four", () => {
  const overview = buildPremiumWeeklyOverview(plan);
  assert.equal(overview.primaryTask.id, "task-1");
  assert.deepEqual(overview.secondaryTasks.map((task) => task.id), ["task-2", "task-3", "task-4", "task-5"]);
  assert.equal(overview.total, 5);
  assert.equal(overview.completed, 2);
  assert.equal(overview.completionPercent, 40);
  assert.equal(overview.estimatedMinutes, 30);
});

test("weekly overview exposes evidence, confidence, generation and refresh rules", () => {
  const overview = buildPremiumWeeklyOverview(plan);
  assert.equal(overview.evidenceCount, 7);
  assert.equal(overview.confidence, "Usable sample");
  assert.equal(overview.generatedAt, plan.createdAt);
  assert.match(overview.refreshMessage, /remains current through 2026-07-26/i);
  assert.doesNotMatch(overview.refreshMessage, /next Monday|calendar week/i);
});

test("saved response plan is recovered for the primary task", () => {
  const overview = buildPremiumWeeklyOverview(plan, { "task-1": { responsePlan: "Meet ...c5 with c3 and steady development.", synced: true } });
  assert.match(overview.responsePlan, /steady development/);
  assert.equal(overview.responsePlanSource, "Synced across devices");
});

test("completed genuine tasks enter read-only training history", () => {
  const rows = buildPremiumTrainingHistory([plan], { "task-1": { responsePlan: "Play c3.", sourceType: "own game" } });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].reopenable, true);
  assert.equal(rows.find((row) => row.taskId === "task-1").sourceType, "own game");
  assert.equal(rows.find((row) => row.taskId === "task-1").responsePlan, "Play c3.");
});

test("fictional preview tasks never enter genuine training history", () => {
  const rows = buildPremiumTrainingHistory([{ ...plan, tasks: [tasks[0]] }], { "task-1": { fictional: true, sourceType: "fictional preview" } });
  assert.deepEqual(rows, []);
});

test("incomplete tasks never enter training history", () => {
  const rows = buildPremiumTrainingHistory([{ ...plan, tasks: [{ ...tasks[0], status: "pending" }] }]);
  assert.deepEqual(rows, []);
});

test("free continuation preview names only implemented continuity features", () => {
  const preview = contextualPlusContinuation({ openingName: "Caro-Kann Defense", role: "black_vs_e4" }, "Play ...c5 after e5.");
  assert.match(preview.title, /Black repertoire role/i);
  assert.match(preview.message, /response plan|weekly plan|future valid reports/i);
  assert.doesNotMatch(preview.message, /AI|engine|guaranteed|rating/i);
});

test("continuity preferences safely separate response plans and repertoire intentions", () => {
  const settings = { preferences: { trainingResponsePlans: { task: { responsePlan: "Play c3" } }, repertoireIntentions: { black_vs_e4: { intention: "Keep" } } } };
  assert.equal(trainingResponsePlans(settings).task.responsePlan, "Play c3");
  assert.equal(repertoireIntentions(settings).black_vs_e4.intention, "Keep");
  assert.deepEqual(trainingResponsePlans({ preferences: { trainingResponsePlans: [] } }), {});
});

test("weekly view has a distinct main focus, source type, continuation and remaining tasks", () => {
  const source = fs.readFileSync(fileURLToPath(new URL("../components/ThisWeekTrainingExperience.jsx", import.meta.url)), "utf8");
  assert.match(source, /Main focus/);
  assert.match(source, /Own-game evidence/);
  assert.match(source, /General opening setup/);
  assert.match(source, /Continue training/);
  assert.match(source, /Remaining tasks/);
});

test("repertoire UI keeps calculated evidence separate from the member's decision", () => {
  const source = fs.readFileSync(fileURLToPath(new URL("../components/MyRepertoire.jsx", import.meta.url)), "utf8");
  assert.match(source, /OpeningFit evidence/);
  assert.match(source, /Your decision/);
  assert.match(source, /Choose intention/);
  assert.match(source, /value=\{intention \|\| ""\}/);
  assert.match(source, /does not alter OpeningFit/);
  assert.match(source, /repertoireIntentions/);
  assert.doesNotMatch(source, /updateRepertoireMetrics\([^)]*intention/);
});

test("checkout confirmation offers an immediately useful premium action", () => {
  const source = fs.readFileSync(fileURLToPath(new URL("../components/CheckoutStatusNotice.jsx", import.meta.url)), "utf8");
  assert.match(source, /OpeningFit Plus is active/);
  assert.match(source, /Open this week’s plan/);
  assert.match(source, /entitlement === "confirmed"/);
});
