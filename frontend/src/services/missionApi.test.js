import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getCurrentMission, missionActionKey, __resetMissionApiForTests } from "./missionApi.js";
import { __resetMissionFeatureGateForTests } from "../lib/missionFeatureGate.js";

const source = await readFile(new URL("./missionApi.js", import.meta.url), "utf8");

test("mission client uses the shared bearer session and never sends user identity", () => {
  assert.match(source, /if \(!missionsClientEnabled\(\)\) throw new MissionApiError\("missions_disabled"/);
  assert.match(source, /supabase\.auth\.getSession/);
  assert.match(source, /Authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(source, /userId\s*:/);
});

test("mission mutations send only allowed contracts", () => {
  assert.match(source, /body: \{ exerciseId, attemptedMoveUci, idempotencyKey \}/);
  assert.match(source, /body: \{ idempotencyKey \}/);
  assert.doesNotMatch(source, /correctness|acceptedMoves|missionStatus|candidateScore/);
});

test("current reads deduplicate and generated action keys are stable values", () => {
  assert.match(source, /currentReads\.has\(dedupeKey\)/);
  const key = missionActionKey("attempt");
  assert.equal(key, key);
  assert.match(key, /^attempt:/);
});

test("errors are centrally normalised without exposing internal payload text", () => {
  assert.match(source, /function safeCode/);
  assert.match(source, /Missions are temporarily unavailable/);
  assert.doesNotMatch(source, /payload\?\.detail\?\.message/);
});

test("unknown or disabled bootstrap blocks the Mission transport before fetch", async () => {
  __resetMissionFeatureGateForTests(); __resetMissionApiForTests();
  const originalFetch = globalThis.fetch; const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); throw new Error("unexpected request"); };
  try {
    await assert.rejects(getCurrentMission({ dedupeKey: "disabled" }), (error) => error?.code === "missions_disabled");
    assert.deepEqual(urls.filter((url) => url.includes("/api/v1/missions")), []);
  } finally { globalThis.fetch = originalFetch; }
});
