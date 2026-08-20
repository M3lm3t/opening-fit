import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getCurrentCoachingPriority, getWeeklyCoachingGoal, MEANINGFUL_COACHING_ACTIVITIES, recordMeaningfulCoachingActivity, selectOwnerCoachingState } from "./coachingStateService.js";

const migration = readFileSync(new URL("../../../supabase/migrations/202608200001_canonical_coaching_activity.sql", import.meta.url), "utf8");
function clientReturning(data) { const calls = []; return { calls, async rpc(name, params) { calls.push({ name, params }); return { data, error: null }; } }; }

test("migration is additive on clean and existing schemas", () => {
  assert.match(migration, /alter table public\.activity_history[\s\S]*add column if not exists coaching_activity_type/i);
  for (const table of ["coaching_priorities", "coaching_game_checkpoints", "coaching_response_plans"]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.doesNotMatch(migration, /drop table|rename (table|column)|delete from|truncate/i);
});

test("meaningful activity uses one authenticated idempotent RPC", async () => {
  const client = clientReturning({ id: "activity-1", coaching_activity_type: "training_session_completed" });
  await recordMeaningfulCoachingActivity({ userId: "user-1", activityType: "training_session_completed", idempotencyKey: "session:one" }, { client });
  assert.deepEqual(client.calls[0], { name: "record_meaningful_coaching_activity", params: { p_activity_type: "training_session_completed", p_idempotency_key: "session:one", p_payload: {}, p_occurred_at: null } });
  assert.match(migration, /on conflict \(user_id, dedupe_key\)[\s\S]*do nothing/i);
  assert.match(migration, /Meaningful coaching activity must use the canonical recorder/i);
  assert.match(migration, /auth\.role\(\) = 'service_role'[\s\S]*else now\(\)/i);
  assert.equal(MEANINGFUL_COACHING_ACTIVITIES.includes("page_view"), false);
});

test("priority and weekly goal are selected from authoritative cloud state", async () => {
  const priorityClient = clientReturning({ id: "p1", user_id: "u1", task_id: "t1", repertoire_role: "white", status: "ready" });
  assert.equal((await getCurrentCoachingPriority("u1", { client: priorityClient })).taskId, "t1");
  const goalClient = clientReturning({ target: 3, completed: 2, weekStart: "2026-08-17", weekEnd: "2026-08-23", timezone: "Europe/London" });
  assert.deepEqual(await getWeeklyCoachingGoal("u1", { client: goalClient }), { target: 3, completed: 2, weekStart: "2026-08-17", weekEnd: "2026-08-23", timezone: "Europe/London" });
  assert.match(migration, /date_trunc\('week', local_now\)/i);
  assert.match(migration, /pg_timezone_names[\s\S]*UTC/i);
});

test("RLS prevents cross-user reads and keeps service role explicit", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select to authenticated using \(auth\.uid\(\) = user_id\)/i);
  assert.match(migration, /with check \(auth\.uid\(\) = user_id\)/i);
  assert.match(migration, /grant all on public\.%I to service_role/i);
  assert.doesNotMatch(migration, /to anon[\s\S]*using \(true\)/i);
});

test("game checkpoints retain identifiers without duplicate PGNs", () => {
  assert.match(migration, /latest_platform_game_id text/i);
  assert.match(migration, /checked_game_ids jsonb/i);
  assert.doesNotMatch(migration, /\bpgn\s+(text|jsonb)\b/i);
});

test("anonymous state cannot overwrite authenticated cloud state or grant access", () => {
  const cloud = { priority: { id: "cloud" }, hasPremiumAccess: false };
  const local = { priority: { id: "local" }, hasPremiumAccess: true };
  assert.deepEqual(selectOwnerCoachingState({ userId: "u1", cloudState: cloud, anonymousState: local }), { source: "cloud", state: cloud });
  assert.deepEqual(selectOwnerCoachingState({ anonymousState: local }), { source: "anonymous_device", state: local });
});

test("existing report and training history tables remain readable and untouched", () => {
  assert.doesNotMatch(migration, /alter table public\.(report_history|weekly_training_plans)/i);
  assert.doesNotMatch(migration, /revoke select on public\.(report_history|weekly_training_plans)/i);
});
