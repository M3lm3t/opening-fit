import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildWeeklyTrainingPlan } from "../lib/weeklyTrainingPlan.js";
import {
  completeWeeklyTrainingPlan,
  getOrCreateWeeklyTrainingPlan,
  setWeeklyTrainingTaskCompletion,
} from "./weeklyTrainingPlanService.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const REPORT_A = "00000000-0000-4000-8000-000000000010";
const REPORT_B = "00000000-0000-4000-8000-000000000011";
const NOW = new Date("2026-07-18T12:00:00Z");
const repertoire = [{ status: "active", slot: "white_primary", canonical_opening_id: "vienna-game", display_name: "Vienna Game", sample_size: 12, key_weakness: "Early queen pressure" }];
const report = (id) => ({ report_id: id, source_platform: "chesscom", source_username: "Player", total_games_analysed: 20, weaknesses: [{ title: "Early queen pressure", opening: "Vienna Game", frequency: 4 }] });

function row(plan) {
  return {
    id: plan.id,
    user_id: plan.userId,
    schema_version: plan.schemaVersion,
    week_start: plan.weekStart,
    week_end: plan.weekEnd,
    report_id: plan.reportId,
    status: plan.status,
    primary_goal: plan.primaryGoal,
    reason: plan.reason,
    estimated_minutes: plan.estimatedMinutes,
    target_metric: plan.targetMetric,
    tasks: plan.tasks,
    completion_percent: plan.completionPercent,
    created_at: plan.createdAt,
    completed_at: plan.completedAt,
  };
}

function client() {
  const calls = [];
  return {
    calls,
    async rpc(name, params) {
      calls.push({ name, params });
      if (name === "save_weekly_training_plan") return { data: row(params.p_plan), error: null };
      if (name === "set_weekly_training_task_status") {
        const plan = this.plan;
        plan.tasks = plan.tasks.map((task) => task.id === params.p_task_id ? { ...task, status: params.p_completed ? "completed" : "pending" } : task);
        plan.completionPercent = Math.round(plan.tasks.filter((task) => task.status === "completed").length * 100 / plan.tasks.length);
        return { data: row(plan), error: null };
      }
      if (name === "complete_weekly_training_plan") {
        this.plan = { ...this.plan, tasks: this.plan.tasks.map((task) => ({ ...task, status: "completed" })), status: "completed", completionPercent: 100, completedAt: NOW.toISOString() };
        return { data: row(this.plan), error: null };
      }
      return { data: null, error: { message: "Unknown RPC" } };
    },
  };
}

test("service reuses the current active plan without a save call", async () => {
  const currentPlan = buildWeeklyTrainingPlan({ userId: USER_ID, report: report(REPORT_A), repertoire, reportId: REPORT_A, now: NOW }).plan;
  const fake = client();
  const result = await getOrCreateWeeklyTrainingPlan(USER_ID, { client: fake, report: report(REPORT_A), reportId: REPORT_A, repertoire, currentPlan, now: NOW });
  assert.equal(result.state, "reused");
  assert.equal(fake.calls.length, 0);
});

test("a new valid report midweek creates a replacement plan", async () => {
  const currentPlan = buildWeeklyTrainingPlan({ userId: USER_ID, report: report(REPORT_A), repertoire, reportId: REPORT_A, now: NOW }).plan;
  const fake = client();
  const result = await getOrCreateWeeklyTrainingPlan(USER_ID, { client: fake, report: report(REPORT_B), reportId: REPORT_B, repertoire, currentPlan, now: NOW });
  assert.equal(result.state, "regenerated-for-report");
  assert.equal(result.plan.reportId, REPORT_B);
  assert.equal(fake.calls[0].name, "save_weekly_training_plan");
});

test("task and full-plan completion are persisted through RPCs", async () => {
  const fake = client();
  fake.plan = buildWeeklyTrainingPlan({ userId: USER_ID, report: report(REPORT_A), repertoire, reportId: REPORT_A, now: NOW }).plan;
  const first = fake.plan.tasks[0];
  const updated = await setWeeklyTrainingTaskCompletion(USER_ID, fake.plan.id, first.id, true, { client: fake });
  assert.equal(updated.tasks[0].status, "completed");
  const completed = await completeWeeklyTrainingPlan(USER_ID, fake.plan.id, { client: fake });
  assert.equal(completed.status, "completed");
  assert.equal(completed.completionPercent, 100);
});

test("database contract versions plans, enforces RLS, reuse, and task completion", () => {
  const migration = readFileSync(new URL("../../../supabase/migrations/202607180002_weekly_training_plans.sql", import.meta.url), "utf8");
  assert.match(migration, /schema_version integer not null default 1/i);
  assert.match(migration, /weekly_training_plans_one_active_week_idx/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(migration, /existing_plan\.report_id = requested_report/i);
  assert.match(migration, /set_weekly_training_task_status/i);
});

test("outcome migration timestamps individual tasks and protects repertoire outcomes", () => {
  const migration = readFileSync(new URL("../../../supabase/migrations/202607180003_training_outcomes.sql", import.meta.url), "utf8");
  assert.match(migration, /completedAt/i);
  assert.match(migration, /training_outcome jsonb/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /security definer/i);
});
