import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { completeGameCheck, countNewGamesSinceCheckpoint, getCurrentCoachingPriority, getWeeklyCoachingGoal, MEANINGFUL_COACHING_ACTIVITIES, recordMeaningfulCoachingActivity, saveCoachingResponsePlan, selectOwnerCoachingState } from "./coachingStateService.js";

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

test("new game count is only shown from stable IDs and a canonical checkpoint", () => {
  assert.equal(countNewGamesSinceCheckpoint([{ id: "old" }, { game_id: "new" }, { id: "new" }], { checked_game_ids: ["old"] }), 1);
  assert.equal(countNewGamesSinceCheckpoint([{ result: "1-0" }], { checked_game_ids: [] }), null);
  assert.equal(countNewGamesSinceCheckpoint([{ id: "one" }], null), null);
});

test("response-plan save uses canonical identities and does not trust a non-UUID report ID", async () => {
  const client = clientReturning({ id: "plan-1", status: "active" });
  await saveCoachingResponsePlan({ userId: "u1", repertoireRole: "black_vs_e4", openingId: "caro", diagnosisId: "d1", reportId: "legacy-report", taskId: "t1", planText: "  Challenge the centre.  " }, { client });
  assert.deepEqual(client.calls[0], { name: "save_coaching_response_plan", params: { p_repertoire_role: "black_vs_e4", p_opening_id: "caro", p_diagnosis_id: "d1", p_report_id: null, p_task_id: "t1", p_plan_text: "Challenge the centre." } });
});

test("Game Check completion sends one idempotent atomic checkpoint RPC", async () => {
  const client = clientReturning({ activityId: "a1", checkpointId: "c1" });
  await completeGameCheck({ userId: "u1", platform: "ChessCom", username: "Player", checkedGameIds: ["g1", "g1", "g2"], idempotencyKey: "check:g1-g2" }, { client });
  assert.equal(client.calls[0].name, "complete_game_check");
  assert.deepEqual(client.calls[0].params.p_checked_game_ids, ["g1", "g2"]);
  assert.equal(client.calls[0].params.p_idempotency_key, "check:g1-g2");
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
