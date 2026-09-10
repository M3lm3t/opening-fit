import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const authProvider = readFileSync(new URL("../context/AuthDataProvider.jsx", import.meta.url), "utf8");
const coachDashboard = readFileSync(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8");
const weeklyRecap = readFileSync(new URL("../components/WeeklyRecap.jsx", import.meta.url), "utf8");

test("analysis completion serializes report-bearing cloud writes and avoids an immediate restore", () => {
  const start = app.indexOf("const orderedCloudSyncResults = [];");
  const end = app.indexOf("setCloudSaveStatus", start);
  const completionSync = app.slice(start, end);

  assert.ok(start > 0 && end > start);
  assert.ok(completionSync.indexOf('"analysed games"') < completionSync.indexOf('"report history"'));
  assert.ok(completionSync.indexOf('"report history"') < completionSync.indexOf('"progress state"'));
  assert.doesNotMatch(completionSync, /refreshUserData/);
});

test("legacy settings sync is change-driven rather than queued on every provider effect mount", () => {
  const interceptStart = authProvider.indexOf("window.localStorage.setItem = (key, value) =>");
  const cleanupStart = authProvider.indexOf("return () => {", interceptStart);
  const intercept = authProvider.slice(interceptStart, cleanupStart);

  assert.match(intercept, /isPersistedLegacyKey\(key\).*queueLegacySync\(\)/s);
  assert.doesNotMatch(intercept, /^\s*queueLegacySync\(\);\s*$/m);
});

test("dashboard shares its weekly goal instead of issuing a duplicate recap request", () => {
  assert.match(coachDashboard, /<WeeklyRecap[^>]*weeklyGoal=\{weeklyGoal\}/s);
  assert.match(weeklyRecap, /sharedWeeklyGoal \? Promise\.resolve\(sharedWeeklyGoal\) : getWeeklyCoachingGoal/);
});
