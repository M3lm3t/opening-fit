import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { Chess } from "chess.js";
import { buildTodayPrimaryAction, todayGoalContext } from "./todayPrimaryAction.js";

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
  assert.match(empty.title, /Nothing urgent to repair/);
  assert.equal(empty.cta, undefined);
});

test("completion uses the existing today activity event and yields one lightweight completed state", () => {
  const priority = { priorityId: "priority-1", subjectType: "opening", openingName: "Vienna Game" };
  const first = buildTodayPrimaryAction({ decisionModel: { coachingPriority: priority }, date: day, hasReport: true });
  const activity = [{ type: "today_task_completed", created_at: day.toISOString(), payload: { task_id: first.id, training_date: "2026-08-11" } }];
  const completed = buildTodayPrimaryAction({ decisionModel: { coachingPriority: priority }, activity, date: day, hasReport: true });
  assert.equal(completed.completed, true);
  assert.match(dashboard, /Done for today/);
  assert.match(dashboard, /onRecordActivity\?\.\("today_task_completed"/);
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
});

test("mobile Today keeps one full-width CTA and a bounded board", () => {
  const css = fs.readFileSync(new URL("../components/CoachDashboard.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.todayPrimaryPosition \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.todayPrimaryActions \.primaryBtn \{ width: 100%; \}/);
  assert.match(css, /\.todayPrimaryPosition \.chessPositionBoard \{ width: min\(100%, 320px\);/);
});
