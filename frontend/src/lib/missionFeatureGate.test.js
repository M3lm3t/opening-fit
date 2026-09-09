import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { __resetMissionFeatureGateForTests, loadMissionFeatureState, MISSION_READINESS_TIMEOUT_MS, missionsClientEnabled, parseMissionFeatureState } from "./missionFeatureGate.js";

test("Mission bootstrap fails closed for absent or malformed configuration", () => {
  for (const payload of [null, undefined, [], {}, { status: "ready" }, { missions: "enabled" }, { status: "loading", missions: "enabled" }]) assert.equal(parseMissionFeatureState(payload), "disabled");
});

test("disabled bootstrap makes zero Mission requests for anonymous and authenticated sessions", async () => {
  for (const authenticated of [false, true]) {
    __resetMissionFeatureGateForTests(); const urls = [];
    const state = await loadMissionFeatureState({ userId: authenticated ? "user-1" : "", accessToken: authenticated ? "token" : "", fetchImpl: async (url) => { urls.push(String(url)); return { ok: true, json: async () => ({ status: "ready", missions: "disabled", authenticated }) }; } });
    assert.equal(state, "disabled"); assert.equal(missionsClientEnabled(), false); assert.deepEqual(urls.filter((url) => url.includes("/api/v1/missions")), []); assert.equal(urls.length, 1); assert.match(urls[0], /\/api\/readiness$/);
  }
});

test("configuration failure remains disabled without probing Mission endpoints", async () => {
  __resetMissionFeatureGateForTests(); const urls = [];
  const state = await loadMissionFeatureState({ fetchImpl: async (url) => { urls.push(String(url)); throw new Error("offline"); } });
  assert.equal(state, "unavailable"); assert.equal(missionsClientEnabled(), false); assert.deepEqual(urls.filter((url) => url.includes("/api/v1/missions")), []);
});

test("a delayed successful readiness response within the production latency margin enables an eligible user", async () => {
  assert.ok(MISSION_READINESS_TIMEOUT_MS > 10950, "the production 10.95-second response must fit inside the client bound");
  __resetMissionFeatureGateForTests(); const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    if (String(url).endsWith("/api/readiness")) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { ok: true, json: async () => ({ status: "ready", missions: "enabled" }) };
    }
    return { ok: true, json: async () => ({ enabled: true }) };
  };
  assert.equal(await loadMissionFeatureState({ userId: "user-1", accessToken: "token", fetchImpl, readinessTimeoutMs: 50 }), "enabled");
  assert.equal(urls.filter((url) => url.endsWith("/api/features/missions/eligibility")).length, 1);
});

test("a readiness timeout is bounded, makes no Mission request and can be retried", async () => {
  __resetMissionFeatureGateForTests(); const urls = []; let readinessAttempts = 0;
  const fetchImpl = async (url, { signal } = {}) => {
    urls.push(String(url));
    if (String(url).endsWith("/api/readiness")) {
      readinessAttempts += 1;
      if (readinessAttempts === 1) await new Promise((resolve, reject) => { signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); });
      return { ok: true, json: async () => ({ status: "ready", missions: "enabled" }) };
    }
    return { ok: true, json: async () => ({ enabled: true }) };
  };
  const options = { userId: "user-1", accessToken: "token", fetchImpl, readinessTimeoutMs: 5 };
  assert.equal(await loadMissionFeatureState(options), "unavailable");
  assert.equal(urls.filter((url) => url.includes("/api/v1/missions")).length, 0);
  assert.equal(urls.filter((url) => url.endsWith("/api/features/missions/eligibility")).length, 0);
  assert.equal(await loadMissionFeatureState(options), "enabled");
  assert.equal(readinessAttempts, 2);
});

test("enabled bootstrap checks authenticated eligibility outside the Mission API and deduplicates", async () => {
  __resetMissionFeatureGateForTests(); const urls = [];
  const fetchImpl = async (url) => { urls.push(String(url)); return { ok: true, json: async () => String(url).endsWith("/api/readiness") ? ({ status: "ready", missions: "enabled" }) : ({ enabled: true }) }; };
  const options = { userId: "user-1", accessToken: "token", fetchImpl };
  assert.equal(await loadMissionFeatureState(options), "enabled"); assert.equal(missionsClientEnabled(), true); assert.equal(await loadMissionFeatureState(options), "enabled");
  assert.equal(urls.filter((url) => url.endsWith("/api/readiness")).length, 1);
  assert.equal(urls.filter((url) => url.endsWith("/api/features/missions/eligibility")).length, 1);
  assert.deepEqual(urls.filter((url) => url.includes("/api/v1/missions")), []);
});

test("a refreshed access token cannot reuse a stale eligibility result", async () => {
  __resetMissionFeatureGateForTests(); const authorization = [];
  const fetchImpl = async (url, options = {}) => {
    if (String(url).endsWith("/api/readiness")) return { ok: true, json: async () => ({ status: "ready", missions: "enabled" }) };
    authorization.push(options.headers?.Authorization);
    return { ok: options.headers?.Authorization === "Bearer current-token", json: async () => ({ enabled: true }) };
  };
  assert.equal(await loadMissionFeatureState({ userId: "user-1", accessToken: "expired-token", fetchImpl }), "unavailable");
  assert.equal(await loadMissionFeatureState({ userId: "user-1", accessToken: "current-token", fetchImpl }), "enabled");
  assert.deepEqual(authorization, ["Bearer expired-token", "Bearer current-token"]);
});

test("non-eligible, malformed and failed eligibility responses fail closed without Mission requests", async () => {
  for (const result of [{ ok: true, payload: { enabled: false } }, { ok: true, payload: { enabled: "true" } }, { ok: false, payload: null }, { error: true }]) {
    __resetMissionFeatureGateForTests(); const urls = [];
    const fetchImpl = async (url) => {
      urls.push(String(url));
      if (String(url).endsWith("/api/readiness")) return { ok: true, json: async () => ({ status: "ready", missions: "enabled" }) };
      if (result.error) throw new Error("unavailable");
      return { ok: result.ok, json: async () => result.payload };
    };
    const expected = result.ok && result.payload?.enabled === false ? "disabled" : "unavailable";
    assert.equal(await loadMissionFeatureState({ userId: "user-2", accessToken: "token", fetchImpl }), expected);
    assert.equal(missionsClientEnabled(), false);
    assert.deepEqual(urls.filter((url) => url.includes("/api/v1/missions")), []);
  }
});

test("all Mission hook consumers sit behind the shared bootstrap provider", async () => {
  const component = await readFile(new URL("../components/MissionExperience.jsx", import.meta.url), "utf8");
  const entry = await readFile(new URL("../main.jsx", import.meta.url), "utf8");
  assert.match(entry, /<MissionFeatureProvider>/);
  assert.ok(entry.indexOf("<AuthDataProvider>") < entry.indexOf("<MissionFeatureProvider>"));
  assert.match(component, /function MissionGate/);
  assert.equal((component.match(/<MissionGate>/g) || []).length, 3);
  assert.match(component, /state !== "unavailable" \|\| !user\?\.id/);
  assert.match(component, /Mission availability could not be checked/);
  assert.match(component, /onClick=\{retry\}/);
  assert.equal((component.match(/const \{ state[^\n]+\} = useMission\(/g) || []).length, 3);
  assert.match(component, /EnabledCurrentMissionCard/);
  assert.match(component, /EnabledMissionEvidencePanel/);
  assert.match(component, /EnabledMissionTrainingPanel/);
});
