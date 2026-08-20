import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getTrainingStreak, QUALIFYING_STREAK_ACTIVITIES, recordQualifiedActivity } from "./trainingStreakService.js";
import { deriveMeaningfulConsistency, selectMeaningfulConsistency, weeklyMeaningfulCount } from "../lib/meaningfulConsistency.js";

function clientReturning(data) { const calls = []; return { calls, async rpc(name, params) { calls.push({ name, params }); return { data, error: null }; } }; }

test("web and Android consume one canonical server consistency state", async () => {
  const client = clientReturning({ status: "active", currentStreak: 7, longestStreak: 18, completedToday: true, lastQualifiedDate: "2026-08-20", timezone: "Europe/London", weeklyCompleted: 2, weeklyTarget: 3, milestones: [3,7,14,30,50,100] });
  const state = await getTrainingStreak("user-1", { client });
  assert.equal(state.status, "active"); assert.equal(state.currentStreak, 7); assert.equal(state.weeklyCompleted, 2); assert.equal(state.timezone, "Europe/London");
  assert.deepEqual(client.calls, [{ name: "get_meaningful_consistency", params: undefined }]);
});

test("same-day actions advance one day; two missed days survive and the third resets", () => {
  assert.deepEqual(deriveMeaningfulConsistency(["2026-08-17", "2026-08-17", "2026-08-20"], "2026-08-20"), { status: "active", currentStreak: 2, longestStreak: 2, completedToday: true });
  assert.equal(deriveMeaningfulConsistency(["2026-08-17"], "2026-08-18").status, "resting");
  assert.equal(deriveMeaningfulConsistency(["2026-08-17"], "2026-08-19").status, "at_risk");
  assert.deepEqual(deriveMeaningfulConsistency(["2026-08-17"], "2026-08-20"), { status: "reset", currentStreak: 0, longestStreak: 1, completedToday: false });
});

test("immutable local dates make timezone and DST changes unable to duplicate days", () => {
  assert.equal(deriveMeaningfulConsistency(["2026-03-29", "2026-03-29", "2026-03-30"], "2026-03-30").currentStreak, 2);
  const migration = readFileSync(new URL("../../../supabase/migrations/202608200004_meaningful_consistency.sql", import.meta.url), "utf8");
  assert.match(migration, /activity_local_date date/); assert.match(migration, /Immutable local calendar day/);
});

test("weekly boundary and Android retry count canonical idempotency keys once", () => {
  const rows = [{ id: "a", activityLocalDate: "2026-08-17" }, { id: "a", activityLocalDate: "2026-08-17" }, { id: "b", activityLocalDate: "2026-08-23" }, { id: "c", activityLocalDate: "2026-08-24" }];
  assert.equal(weeklyMeaningfulCount(rows, "2026-08-17"), 2);
});

test("signed-in server state wins without anonymous overwrite", () => {
  const server = { currentStreak: 4 }; const anonymous = { currentStreak: 20 };
  assert.equal(selectMeaningfulConsistency({ userId: "u1", serverState: server, anonymousState: anonymous }), server);
  assert.equal(selectMeaningfulConsistency({ userId: null, serverState: server, anonymousState: anonymous }), anonymous);
});

test("legacy adapter no longer awards a second streak and excludes navigation activity", async () => {
  const client = clientReturning({ status: "active", currentStreak: 1 });
  await recordQualifiedActivity({ userId: "u1", activityType: QUALIFYING_STREAK_ACTIVITIES.TRAINING_TASK_COMPLETED, sourceId: "task-1" }, { client });
  assert.equal(client.calls[0].name, "get_meaningful_consistency");
  await assert.rejects(recordQualifiedActivity({ userId: "u1", activityType: "page_viewed", sourceId: "page" }, { client }), /Unsupported/);
});

test("existing legitimate training history migrates but analysis/app-open history does not", () => {
  const migration = readFileSync(new URL("../../../supabase/migrations/202608200004_meaningful_consistency.sql", import.meta.url), "utf8");
  assert.match(migration, /today_training_completed.*training_task_completed.*repair_review_completed/s);
  assert.doesNotMatch(migration.match(/insert into public\.activity_history[\s\S]*?on conflict/)[0], /analysis_completed/);
});

test("Today and completion use restrained reduced-motion milestone feedback", () => {
  const today = readFileSync(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8");
  const trainer = readFileSync(new URL("../components/PersonalOpeningTrainer.jsx", import.meta.url), "utf8");
  const card = readFileSync(new URL("../components/TrainingStreakCard.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/TrainingStreakCard.css", import.meta.url), "utf8");
  assert.match(today, /<TrainingStreakCard/); assert.match(trainer, /<TrainingStreakCard/); assert.match(card, /What counts\?/); assert.match(css, /prefers-reduced-motion: reduce/);
});
