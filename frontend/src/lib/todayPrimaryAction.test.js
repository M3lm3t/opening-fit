import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { Chess } from "chess.js";
import { buildTodayExperienceAction, buildTodayPrimaryAction, todayGoalContext } from "./todayPrimaryAction.js";

const dashboard = fs.readFileSync(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

const day = new Date(2026, 7, 11, 12);

test("active canonical Train next is the single primary Today action", () => {
  const chess = new Chess(); chess.move("e4"); chess.move("d5");
  const priority = { priorityId: "priority-1", subjectType: "diagnosed_position", openingName: "Scandinavian Defence", repertoireRole: "black_vs_e4", playerColour: "black", positionFen: chess.fen(), recognisedLine: "1. e4 d5", evidenceCount: 7 };
  const action = buildTodayPrimaryAction({ decisionModel: { coachingPriority: priority }, date: day, hasReport: true });
  assert.equal(action.kind, "train");
  assert.equal(action.title, "Train this position");
  assert.equal(action.explanation, "You have reached this target in 7 supporting games.");
  assert.equal(action.cta, "Train position");
  assert.equal(action.chessEvidence.orientation, "black");
  assert.equal(action.durationMinutes, null);
  assert.match(action.improvementCheck, /compare this canonical target/i);
  assert.equal(action.identities.trainingSubjectId, "priority-1");
});

test("an unresolved canonical Repair is used when no Train next task exists", () => {
  const repair = { diagnosisId: "repair-1", opening: "Scandinavian Defence", repertoireRole: "black_vs_e4", games: 9, recurringIssue: { moveLine: "1. e4 d5 2. exd5" } };
  const action = buildTodayPrimaryAction({ decisionModel: { primaryProblem: repair }, date: day, hasReport: true });
  assert.equal(action.kind, "repair");
  assert.equal(action.route, "practice");
  assert.equal(action.chessEvidence.moveLine, "1. e4 d5 2. exd5");
});

test("a supported role gap follows Train and Repair in priority", () => {
  const action = buildTodayPrimaryAction({ decisionModel: { coachingPriority: { priorityId: "gap-1", subjectType: "role_gap", subjectRole: "black_vs_d4" } }, date: day, hasReport: true });
  assert.equal(action.kind, "coverage");
  assert.equal(action.route, "repertoire");
  assert.match(action.title, /1\.d4/);
});

test("low evidence and no trustworthy task produce calm states without busywork", () => {
  const low = buildTodayPrimaryAction({ decisionModel: null, hasReport: true, date: day });
  const empty = buildTodayPrimaryAction({ decisionModel: {}, hasReport: true, date: day });
  const collect = buildTodayPrimaryAction({ decisionModel: { coachingPriority: { priorityId: "collect", subjectType: "general_guidance", actionType: "collect_more_games" } }, hasReport: true, date: day });
  assert.equal(low.kind, "calm");
  assert.equal(empty.kind, "calm");
  assert.equal(collect.kind, "calm");
  assert.match(empty.title, /No supported session/);
  assert.equal(empty.cta, "Check for new games");
});

test("Today state precedence covers connection, import and recoverable systemic failure", () => {
  assert.equal(buildTodayExperienceAction({ connected: false }).cta, "Connect and import");
  assert.equal(buildTodayExperienceAction({ connected: true, loading: true, importMessage: "Imported 20 of 50 games." }).explanation, "Imported 20 of 50 games.");
  const failed = buildTodayExperienceAction({ connected: true, hasReport: true, evidence: { systemicFailure: true, diagnosticReference: "diag-7" } });
  assert.equal(failed.cta, "Reanalyse");
  assert.match(failed.explanation, /diag-7/);
});

test("completion restores from existing activity while canonical status can complete across devices", () => {
  const priority = { priorityId: "priority-1", subjectType: "opening", openingName: "Vienna Game" };
  const first = buildTodayPrimaryAction({ decisionModel: { coachingPriority: priority }, date: day, hasReport: true });
  const activity = [{ type: "today_task_completed", created_at: day.toISOString(), payload: { task_id: first.id, training_date: "2026-08-11" } }];
  const completed = buildTodayPrimaryAction({ decisionModel: { coachingPriority: priority }, activity, date: day, hasReport: true });
  assert.equal(completed.completed, true);
  assert.match(dashboard, /Session complete/);
  assert.match(dashboard, /onRecordActivity\?\.\("today_task_completed"/);
  const cloudCompleted = buildTodayPrimaryAction({ canonicalPriority: { taskId: "cloud-task", repertoireRole: "white", status: "completed", evidenceRefs: {} }, date: day });
  assert.equal(cloudCompleted.completed, true);
});

test("canonical coaching priority retains stable identities and honest duration", () => {
  const action = buildTodayPrimaryAction({ canonicalPriority: { taskId: "task-9", reportId: "report-2", diagnosisId: "diagnosis-3", decisionId: "decision-4", openingId: "opening-5", openingName: "Vienna Game", repertoireRole: "white", status: "ready", evidenceRefs: { durationMinutes: 5, why: "Repeated in six games." } }, date: day });
  assert.equal(action.cta, "Start session");
  assert.equal(action.durationMinutes, 5);
  assert.deepEqual(action.identities, { reportId: "report-2", diagnosisId: "diagnosis-3", decisionId: "decision-4", openingId: "opening-5", trainingSubjectId: "task-9" });
});

test("target rating is contextual only and safely omitted when absent", () => {
  assert.equal(todayGoalContext({ hasGoal: true, current: 1350, target: 1600 }), "1350 → 1600");
  assert.equal(todayGoalContext({ hasGoal: false, current: 1350, target: 1600 }), null);
  assert.doesNotMatch(dashboard, /guarantee|reach your target/i);
});

test("Today renders one primary action and does not alter premium entitlement plumbing", () => {
  assert.equal((dashboard.match(/<TodayPrimaryAction /g) || []).length, 1);
  assert.doesNotMatch(dashboard, /<TodayTrainingPlan/);
  assert.doesNotMatch(dashboard, /<NextBestAction/);
  assert.match(app, /entitlement=\{entitlement\}/);
  assert.match(app, /hasPremiumAccess=\{isPremium\}/);
  assert.match(dashboard, /getCurrentCoachingPriority/);
  assert.match(dashboard, /getWeeklyCoachingGoal/);
  assert.match(dashboard, /recordMeaningfulCoachingActivity/);
  assert.match(dashboard, /aria-labelledby="today-primary-title"/);
  assert.match(dashboard, /aria-labelledby="today-journey-title"/);
});

test("mobile Today keeps one full-width CTA and a bounded board", () => {
  const css = fs.readFileSync(new URL("../components/CoachDashboard.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.todayPrimaryPosition \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.todayPrimaryActions \.primaryBtn \{ width: 100%; \}/);
  assert.match(css, /\.todayPrimaryPosition \.chessPositionBoard \{ width: min\(100%, 320px\);/);
  assert.match(css, /max-height: 700px/);
  assert.match(css, /safe-area-inset-bottom/);
});
