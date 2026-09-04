import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { __resetMissionFeatureGateForTests, loadMissionFeatureState, missionsClientEnabled, parseMissionFeatureState } from "./missionFeatureGate.js";

test("Mission bootstrap fails closed for absent or malformed configuration", () => {
  for (const payload of [null, undefined, [], {}, { status: "ready" }, { missions: "enabled" }, { status: "loading", missions: "enabled" }]) assert.equal(parseMissionFeatureState(payload), "disabled");
});

test("disabled bootstrap makes zero Mission requests for anonymous and authenticated sessions", async () => {
  for (const authenticated of [false, true]) {
    __resetMissionFeatureGateForTests(); const urls = [];
    const state = await loadMissionFeatureState({ fetchImpl: async (url) => { urls.push(String(url)); return { ok: true, json: async () => ({ status: "ready", missions: "disabled", authenticated }) }; } });
    assert.equal(state, "disabled"); assert.equal(missionsClientEnabled(), false); assert.deepEqual(urls.filter((url) => url.includes("/api/v1/missions")), []); assert.equal(urls.length, 1); assert.match(urls[0], /\/api\/readiness$/);
  }
});

test("configuration failure remains disabled without probing Mission endpoints", async () => {
  __resetMissionFeatureGateForTests(); const urls = [];
  const state = await loadMissionFeatureState({ fetchImpl: async (url) => { urls.push(String(url)); throw new Error("offline"); } });
  assert.equal(state, "disabled"); assert.equal(missionsClientEnabled(), false); assert.deepEqual(urls.filter((url) => url.includes("/api/v1/missions")), []);
});

test("enabled bootstrap is shared and leaves rollout decisions to the Mission API", async () => {
  __resetMissionFeatureGateForTests(); const urls = [];
  const fetchImpl = async (url) => { urls.push(String(url)); return { ok: true, json: async () => ({ status: "ready", missions: "enabled" }) }; };
  assert.equal(await loadMissionFeatureState({ fetchImpl }), "enabled"); assert.equal(missionsClientEnabled(), true); assert.equal(await loadMissionFeatureState({ fetchImpl }), "enabled"); assert.equal(urls.length, 1);
});

test("all Mission hook consumers sit behind the shared bootstrap provider", async () => {
  const component = await readFile(new URL("../components/MissionExperience.jsx", import.meta.url), "utf8");
  const entry = await readFile(new URL("../main.jsx", import.meta.url), "utf8");
  assert.match(entry, /<MissionFeatureProvider>/);
  assert.equal((component.match(/useMissionFeatureState\(\) === "enabled"/g) || []).length, 3);
  assert.equal((component.match(/const \{ state[^\n]+\} = useMission\(/g) || []).length, 3);
  assert.match(component, /EnabledCurrentMissionCard/);
  assert.match(component, /EnabledMissionEvidencePanel/);
  assert.match(component, /EnabledMissionTrainingPanel/);
});
