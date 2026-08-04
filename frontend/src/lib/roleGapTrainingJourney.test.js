import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFreeTrainingExercise } from "./freeTrainingExercise.js";
import { selectAuthoritativeCoachingPriority } from "./authoritativeReportPresentation.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { adaptReportHistoryRow, buildReportSnapshot } from "./reportSnapshot.js";
import { buildFoundationalWeeklyPlan } from "./thisWeekTraining.js";
import { resolveTrainingPriority, trainingPlanMatchesPriority } from "./trainingPriority.js";
import { buildWeeklyTrainingPlan, weeklyPlanWindow } from "./weeklyTrainingPlan.js";
import { getOrCreateWeeklyTrainingPlan } from "../services/weeklyTrainingPlanService.js";

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
    nextTrainingAction: { type: "fill_repertoire_gap", findingType: "repertoire_gap", repertoireRole: "black_vs_e4", decisionId: "unresolved-black-e4", label: "Establish a Black against 1.e4 choice", reason: "No correctly attributed opening is established for this role yet." },
    trainingPriority: { schemaVersion: 3, priorityId: "training-fill_repertoire_gap:report", taskId: "training-fill_repertoire_gap:report", findingType: "repertoire_gap", repertoireRole: "black_vs_e4", decisionId: "unresolved-black-e4", openingKey: null, openingName: null, evidenceGameIds: [], representativeGameIds: [], title: "Establish a Black against 1.e4 choice", rationale: "No correctly attributed opening is established for this role yet." },
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

test("full subject identity rejects every incompatible cache and retains an exact role-gap cache", () => {
  const priority = selectAuthoritativeCoachingPriority(fabioImport);
  const matching = buildFoundationalWeeklyPlan({ report: fabioImport, now: new Date("2026-08-04T12:00:00Z") });
  const mutateIdentity = (changes) => {
    const plan = structuredClone(matching);
    Object.assign(plan.trainingPriority, changes);
    Object.assign(plan.targetMetric, changes);
    Object.assign(plan.tasks[0], changes, { openingId: changes.openingKey ?? changes.openingId ?? plan.tasks[0].openingId });
    return plan;
  };
  const legacyVienna = mutateIdentity({ subjectType: "opening", subjectRole: "white", openingKey: "vienna-game", openingId: "vienna-game", openingName: "Vienna Game" });
  const wrongRole = mutateIdentity({ subjectRole: "black_vs_d4" });
  const wrongReport = mutateIdentity({ sourceReportId: "another-report" });
  const untyped = structuredClone(matching);
  delete untyped.trainingPriority;
  for (const source of [untyped.targetMetric, untyped.tasks[0]]) {
    delete source.subjectType; delete source.subjectRole; delete source.sourceReportVersion;
  }

  assert.equal(trainingPlanMatchesPriority(legacyVienna, priority), false);
  assert.equal(trainingPlanMatchesPriority(wrongRole, priority), false);
  assert.equal(trainingPlanMatchesPriority(wrongReport, priority), false);
  assert.equal(trainingPlanMatchesPriority(untyped, priority), false);
  assert.equal(trainingPlanMatchesPriority(structuredClone(matching), priority), true);
});

test("production service rejects a completed legacy Vienna plan and rebuilds from the Fabio priority", async () => {
  const snapshot = buildReportSnapshot({ report: fabioImport, reportId: "fabio-report-row", defaultGeneratedAt: false });
  const report = adaptReportHistoryRow({ id: "fabio-report-row", normalized_snapshot: snapshot });
  const selected = selectAuthoritativeCoachingPriority(report);
  const { weekStart, weekEnd } = weeklyPlanWindow(new Date("2026-08-04T12:00:00Z"));
  const legacy = {
    schemaVersion: 1, id: "legacy-vienna-plan", userId: "fabio-user", weekStart, weekEnd, reportId: "fabio-report-row", status: "active",
    trainingPriorityId: selected.priorityId,
    targetMetric: { trainingPriorityId: selected.priorityId, openingId: "vienna-game" },
    tasks: [{ id: "legacy-opening-review", subjectType: "opening", subjectRole: "white", openingId: "vienna-game", openingName: "Vienna Game", status: "completed", order: 1 }],
  };
  const calls = [];
  const row = (plan) => ({ id: plan.id, user_id: plan.userId, schema_version: plan.schemaVersion, week_start: plan.weekStart, week_end: plan.weekEnd, report_id: plan.reportId, status: plan.status, primary_goal: plan.primaryGoal, reason: plan.reason, estimated_minutes: plan.estimatedMinutes, target_metric: plan.targetMetric, tasks: plan.tasks, completion_percent: plan.completionPercent, created_at: plan.createdAt, completed_at: plan.completedAt });
  const client = { async rpc(name, params) { calls.push({ name, params }); return { data: row(params.p_plan), error: null }; } };
  const result = await getOrCreateWeeklyTrainingPlan("fabio-user", { client, report, reportId: "fabio-report-row", repertoire: [{ status: "active", slot: "white_primary", canonical_opening_id: "vienna-game", display_name: "Vienna Game" }], currentPlan: legacy, now: new Date("2026-08-04T12:00:00Z") });
  const task = result.plan.tasks[0];
  const model = buildReportDecisionModel(report);
  const summary = buildPrimaryReportSummary(model, report);
  const exercise = buildFreeTrainingExercise(report, selected);
  const lineage = [
    ["canonical priority inputs", "current report", "untyped repertoire_gap", "black_vs_e4", null, "training-fill_repertoire_gap:report", false],
    ["selected priority", "current report", selected.subjectType, selected.subjectRole, selected.openingName, selected.taskId, false],
    ["cache lookup", "legacy weekly plan", legacy.tasks[0].subjectType, legacy.tasks[0].subjectRole, legacy.tasks[0].openingName, legacy.tasks[0].id, false],
    ["built task", "current report", task.subjectType, task.subjectRole, task.openingName, task.id, false],
    ["Summary", "current report", summary.trainingPriority.subjectType, summary.trainingPriority.subjectRole, summary.trainingPriority.openingName, summary.trainNext.action.target.taskId, false],
    ["Train tab", "current report", model.coachingPriority.subjectType, model.coachingPriority.subjectRole, model.coachingPriority.openingName, model.coachingPriority.taskId, false],
    ["/train", "rebuilt weekly plan", task.subjectType, task.subjectRole, task.openingName, task.id, false],
  ].map(([layer, source, subject, role, opening, taskId, cacheUsed]) => ({ layer, source, subject, role, opening: opening || "none", taskId, cacheUsed }));
  console.table(lineage);

  assert.equal(result.reused, false);
  assert.equal(calls[0].name, "save_weekly_training_plan");
  assert.equal(calls[0].params.p_force_refresh, true);
  assert.equal(task.subjectType, "role_gap");
  assert.equal(task.subjectRole, "black_vs_e4");
  assert.equal(task.openingName, null);
  assert.equal(task.status, "pending");
  assert.equal(summary.trainNext.title, "This week: establish a Black against 1.e4 choice for approximately 10 minutes.");
  assert.equal(result.plan.primaryGoal, "Build your Black response to 1.e4");
  assert.equal(exercise.kind, "role_gap_guidance");
  assert.doesNotMatch(JSON.stringify({ selected, result: result.plan, summary: summary.trainNext, exercise }), /Vienna|null line|recognised line|verified .*source game|supplied game/i);

  calls.length = 0;
  const reloaded = await getOrCreateWeeklyTrainingPlan("fabio-user", { client, report, reportId: "fabio-report-row", repertoire: [], currentPlan: result.plan, now: new Date("2026-08-04T12:00:00Z") });
  assert.equal(reloaded.state, "reused");
  assert.equal(reloaded.plan.tasks[0].id, task.id);
  assert.equal(calls.length, 0);
});

test("invalid hybrid rebuilds from canonical role coverage and an impossible rebuild stays unavailable", () => {
  const recoverable = structuredClone(fabioImport);
  recoverable.reportDecision.trainingPriority = { subjectType: "role_gap", repertoireRole: "black_vs_e4", openingName: "Vienna Game", openingId: "vienna-game" };
  const rebuilt = selectAuthoritativeCoachingPriority(recoverable);
  assert.equal(rebuilt.subjectType, "role_gap");
  assert.equal(rebuilt.openingName, null);

  const impossible = { ...fabioImport, reportDecision: { schemaVersion: 6, decisionId: "invalid", trainingPriority: { subjectType: "opening", repertoireRole: "black_vs_e4", openingName: null, openingId: null } } };
  assert.equal(selectAuthoritativeCoachingPriority(impossible), null);
  assert.deepEqual(buildWeeklyTrainingPlan({ userId: "user", report: impossible, reportId: "invalid-report", now: new Date("2026-08-04T12:00:00Z") }), { state: "unavailable-priority", plan: null });
});

test("an impossible canonical rebuild does not reuse an unrelated cached plan", async () => {
  const impossible = { ...fabioImport, reportDecision: { schemaVersion: 6, decisionId: "invalid", trainingPriority: { subjectType: "opening", repertoireRole: "black_vs_e4", openingName: null, openingId: null } } };
  const { weekStart } = weeklyPlanWindow(new Date("2026-08-04T12:00:00Z"));
  const cached = { id: "legacy", weekStart, reportId: "invalid-report", status: "active", trainingPriorityId: "training-vienna", tasks: [{ id: "vienna", subjectType: "opening", subjectRole: "white", openingId: "vienna-game", openingName: "Vienna Game" }] };
  const calls = [];
  const result = await getOrCreateWeeklyTrainingPlan("user", { client: { async rpc(...args) { calls.push(args); return { data: null, error: null }; } }, report: impossible, reportId: "invalid-report", repertoire: [], currentPlan: cached, now: new Date("2026-08-04T12:00:00Z") });
  assert.deepEqual(result, { state: "unavailable-priority", plan: null, reused: false });
  assert.equal(calls.length, 0);
});

test("a Keep Vienna priority cannot outrank an explicit unresolved Black role", () => {
  const report = structuredClone(fabioImport);
  report.reportDecision.trainingPriority = { priorityId: "training-vienna", taskId: "training-vienna", openingName: "Vienna Game", openingKey: "vienna-game", repertoireRole: "white", role: "played_as_white", findingType: "stable_strength", evidenceGameIds: ["white-1"] };
  const priority = selectAuthoritativeCoachingPriority(report);
  assert.deepEqual({ subject: priority.subjectType, role: priority.subjectRole, opening: priority.openingName }, { subject: "role_gap", role: "black_vs_e4", opening: null });
});

test("the /train loader suppresses first-opening fallback widgets for a role gap", () => {
  const source = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(source, /reportTrainingPriority\?\.subjectType === TRAINING_SUBJECT_TYPES\.ROLE_GAP\) return null/);
  assert.match(source, /practiceOpening \|\| reportTrainingPriority\?\.subjectType !== TRAINING_SUBJECT_TYPES\.ROLE_GAP/);
});
