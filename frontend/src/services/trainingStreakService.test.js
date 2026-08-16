import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getTrainingStreak, QUALIFYING_STREAK_ACTIVITIES, recordQualifiedActivity } from "./trainingStreakService.js";

function clientReturning(data) {
  const calls = [];
  return {
    calls,
    async rpc(name, params) { calls.push({ name, params }); return { data, error: null }; },
  };
}

test("web and native clients consume the same canonical server streak state", async () => {
  const client = clientReturning({ currentStreak: 7, longestStreak: 18, completedToday: true, lastQualifiedDate: "2026-08-16", timezone: "UTC" });
  const state = await getTrainingStreak("user-1", { client });
  assert.deepEqual(state, { currentStreak: 7, longestStreak: 18, completedToday: true, lastQualifiedDate: "2026-08-16", lastQualifiedAt: null, timezone: "UTC" });
  assert.deepEqual(client.calls, [{ name: "get_training_streak", params: undefined }]);
});

test("qualified activity delegates calculation and idempotency to the atomic RPC", async () => {
  const client = clientReturning({ currentStreak: 1, longestStreak: 1, completedToday: true, lastQualifiedDate: "2026-08-16" });
  const state = await recordQualifiedActivity({ userId: "user-1", activityType: QUALIFYING_STREAK_ACTIVITIES.ANALYSIS_COMPLETED, sourceId: "analysis-123", occurredAt: "2020-01-01T00:00:00Z" }, { client });
  assert.equal(state.currentStreak, 1);
  assert.deepEqual(client.calls[0], { name: "record_qualified_streak_activity", params: { p_activity_type: "analysis_completed", p_source_id: "analysis-123" } });
  assert.equal("p_occurred_at" in client.calls[0].params, false);
});

test("unsupported, anonymous, and unstable activities never reach the server", async () => {
  const client = clientReturning({});
  await assert.rejects(recordQualifiedActivity({ userId: "", activityType: "analysis_completed", sourceId: "one" }, { client }), /Sign in/);
  await assert.rejects(recordQualifiedActivity({ userId: "user", activityType: "page_viewed", sourceId: "one" }, { client }), /Unsupported/);
  await assert.rejects(recordQualifiedActivity({ userId: "user", activityType: "training_task_completed", sourceId: "" }, { client }), /stable/);
  assert.equal(client.calls.length, 0);
});

test("failed underlying actions cannot award a streak because only explicit success integrations call the service", () => {
  assert.deepEqual(Object.values(QUALIFYING_STREAK_ACTIVITIES).sort(), ["analysis_completed", "repair_review_completed", "today_training_completed", "training_task_completed"]);
  const coach = readFileSync(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8");
  const today = readFileSync(new URL("../components/TodayTrainingCard.jsx", import.meta.url), "utf8");
  const repair = readFileSync(new URL("../components/OpeningPracticeLinesPanel.jsx", import.meta.url), "utf8");
  const weekly = readFileSync(new URL("./weeklyTrainingPlanService.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

  assert.ok(coach.indexOf('await onRecordActivity?.("today_plan_completed"') < coach.indexOf("await recordQualifiedActivity"));
  assert.ok(today.indexOf("await recordActivity(") < today.indexOf("await recordQualifiedActivity"));
  assert.ok(repair.indexOf("await recordActivity({") < repair.indexOf("await recordQualifiedActivity"));
  assert.ok(weekly.indexOf("if (error) throw serviceError") < weekly.indexOf("await recordQualifiedActivity"));
  assert.ok(app.indexOf("setData(cleanData)") < app.indexOf("void recordQualifiedActivity"));
});
