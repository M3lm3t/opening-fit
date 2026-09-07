import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MISSION_ANALYSIS_COMPLETED_EVENT, notifyMissionAnalysisCompleted, subscribeToMissionAnalysisCompleted } from "./missionLifecycle.js";

class FakeEventTarget extends EventTarget {
  Event = Event;
}

test("analysis completion notifies mounted Mission state exactly once and supports cleanup", () => {
  const target = new FakeEventTarget();
  let refreshes = 0;
  const unsubscribe = subscribeToMissionAnalysisCompleted(() => { refreshes += 1; }, target);
  assert.equal(notifyMissionAnalysisCompleted(target), true);
  assert.equal(refreshes, 1);
  unsubscribe();
  notifyMissionAnalysisCompleted(target);
  assert.equal(refreshes, 1);
  assert.equal(MISSION_ANALYSIS_COMPLETED_EVENT, "openingfit:mission-analysis-completed");
});

test("successful analysis refreshes Mission state before optional cloud persistence", async () => {
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const mission = await readFile(new URL("../components/MissionExperience.jsx", import.meta.url), "utf8");
  assert.ok(app.indexOf("notifyMissionAnalysisCompleted(window)") > app.indexOf("setData(cleanData)"));
  assert.ok(app.indexOf("notifyMissionAnalysisCompleted(window)") < app.indexOf("Promise.allSettled(["));
  assert.match(mission, /subscribeToMissionAnalysisCompleted\(\(\) => \{ void refresh\(\); \}\)/);
});

test("Mission UI mounts only on dashboard, authenticated report and training surfaces", async () => {
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8");
  assert.match(dashboard, /<CurrentMissionCard/);
  assert.match(app, /activeView === "dashboard"/);
  assert.match(app, /activeAppSection === "report"/);
  assert.match(app, /<MissionEvidencePanel/);
  assert.match(app, /activeAppSection === "train"/);
  assert.match(app, /<MissionTrainingPanel/);
  assert.doesNotMatch(app, /activeView === "profile"[^]*?<Mission(?:Evidence|Training)Panel/);
});
