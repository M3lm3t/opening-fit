import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFreeTrainingExercise } from "./freeTrainingExercise.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { adaptReportHistoryRow, buildReportSnapshot } from "./reportSnapshot.js";
import { buildFoundationalWeeklyPlan } from "./thisWeekTraining.js";
import { resolveTrainingPriority, trainingPlanMatchesPriority } from "./trainingPriority.js";

const fabioImport = {
  analysisId: "fabio-one-month-2026-08",
  analysisCompleted: true,
  username: "FabioWaintraub",
  platform: "chesscom",
  gamesAnalysed: 20,
  importedAt: "2026-08-04T12:00:00Z",
  topOpenings: [{ name: "Vienna Game", games: 8, context: "white" }],
  reportDecision: {
    schemaVersion: 6,
    decisionId: "fabio-decision-2026-08",
    establishedStrength: { recommendationId: "vienna:white", opening: "Vienna Game", repertoireRole: "white", role: "played_as_white", sample: { games: 8, gameIds: ["white-1"] }, verdict: "keep" },
    recommendations: [{ recommendationId: "vienna:white", openingName: "Vienna Game", openingId: "vienna-game", repertoireRole: "white", role: "played_as_white", relationship: "played_by_user", sample: { games: 8, gameIds: ["white-1"] }, verdict: "keep" }],
    repertoireRoles: [
      { repertoireRole: "white", status: "established", openingName: "Vienna Game", supportingGameCount: 8, evidenceCount: 8 },
      { repertoireRole: "black_vs_e4", status: "insufficient", openingName: null, supportingGameCount: 0, evidenceCount: 0, decisionId: "unresolved-black-e4" },
      { repertoireRole: "black_vs_d4", status: "insufficient", openingName: null, supportingGameCount: 0, evidenceCount: 0, decisionId: "unresolved-black-d4" },
    ],
    nextTrainingAction: { type: "collect_more_games", repertoireRole: "black_vs_e4", decisionId: "unresolved-black-e4", label: "Establish a Black against 1.e4 choice", reason: "No correctly attributed opening is established for this role yet." },
    trainingPriority: { type: "collect_more_games", repertoireRole: "black_vs_e4", decisionId: "unresolved-black-e4", openingId: null, openingName: null, evidenceGameIds: [], supportingGameIds: [] },
  },
};

test("Fabio raw import keeps one role-gap identity through Summary, Train and /train", () => {
  const snapshot = buildReportSnapshot({ report: fabioImport, reportId: "fabio-report-row", defaultGeneratedAt: false });
  const report = adaptReportHistoryRow({ id: "fabio-report-row", normalized_snapshot: snapshot });
  const model = buildReportDecisionModel(report);
  const summary = buildPrimaryReportSummary(model, report);
  const priority = resolveTrainingPriority(report, { allowFallback: false });
  const plan = buildFoundationalWeeklyPlan({ report, now: new Date("2026-08-04T12:00:00Z") });
  const task = plan.tasks[0];
  const exercise = buildFreeTrainingExercise(report, priority);
  const layers = [model.coachingPriority, summary.trainingPriority, priority, plan.trainingPriority, task];

  for (const layer of layers) {
    assert.equal(layer.subjectType, "role_gap");
    assert.equal(layer.subjectRole, "black_vs_e4");
    assert.ok(layer.openingName == null);
    assert.ok((layer.openingKey ?? layer.openingId) == null);
    assert.equal(layer.taskId ?? layer.id, priority.taskId);
  }
  assert.equal(priority.decisionId, "unresolved-black-e4");
  assert.equal(summary.trainNext.priorityId, priority.priorityId);
  assert.equal(summary.trainNext.action.target.taskId, priority.taskId);
  assert.equal(summary.trainNext.title, "This week: establish a Black against 1.e4 choice for approximately 10 minutes.");
  assert.equal(plan.primaryGoal, "Build your Black response to 1.e4");
  assert.equal(task.title, "Establish a Black against 1.e4 choice");
  assert.equal(task.evidenceSourceLabel, "General repertoire guidance; no personal source game is claimed.");
  assert.equal(exercise.kind, "role_gap_guidance");
  assert.equal(exercise.opportunity.opportunityId, `role-gap:${priority.taskId}`);
  assert.equal(exercise.sourceGameId, null);
  assert.doesNotMatch(JSON.stringify({ summary: summary.trainNext, priority, plan, exercise }), /Vienna|null line|recognised line|verified .*source game|source-game review/i);
});

test("completion identity rejects Vienna, retains the same gap task, and renderers omit review-only copy", () => {
  const report = structuredClone(fabioImport);
  const gap = resolveTrainingPriority(report);
  const plan = buildFoundationalWeeklyPlan({ report, now: new Date("2026-08-04T12:00:00Z") });
  const reloadedGap = resolveTrainingPriority(structuredClone(report));
  const viennaPlan = { trainingPriorityId: gap.priorityId, trainingPriority: { subjectType: "opening", subjectRole: "white", openingKey: "vienna-game" }, tasks: [{ subjectType: "opening", subjectRole: "white", openingId: "vienna-game" }] };

  assert.equal(trainingPlanMatchesPriority(viennaPlan, gap), false);
  assert.equal(trainingPlanMatchesPriority(structuredClone(plan), reloadedGap), true);

  const reportRenderer = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const pageRenderer = readFileSync(new URL("../components/TrainingGameReviewSession.jsx", import.meta.url), "utf8");
  const experienceRenderer = readFileSync(new URL("../components/ThisWeekTrainingExperience.jsx", import.meta.url), "utf8");
  assert.match(reportRenderer, /finiteTrainingSession--roleGap/);
  assert.match(reportRenderer, /General repertoire guidance; no personal source game is claimed\./);
  assert.match(pageRenderer, /STEPS\.filter\(\(step\) => !roleGap \|\| step\.id !== "review"\)/);
  assert.match(experienceRenderer, /Choose one repertoire response and save the practical plan/);
  assert.doesNotMatch(`${pageRenderer}\n${experienceRenderer}`, /turns this this opening action/);
  assert.doesNotMatch(experienceRenderer, /roleGap[^\n]*Review one supplied game/);
});
