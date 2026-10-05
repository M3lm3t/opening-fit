import test from "node:test";
import assert from "node:assert/strict";
import { isolatedReportClient, isolatedLocalStorage, hasNewReport, REPORT_CAPABILITIES, REPORT_COLLECTIONS, STAGE6_REPORTS } from "./reportRollout.js";
import { importGames } from "./importClient.js";

test("new generation is off by default", () => assert.equal(STAGE6_REPORTS, false));

test("all report mirrors use only the capable API, including unmarked retention and settings caches", async () => {
  const calls = [];
  const raw = { from() { assert.fail("legacy database path used"); } };
  const client = isolatedReportClient(raw, { enabled: true, request: async (payload) => { calls.push(payload); return { data: payload.values, error: null }; } });
  for (const table of REPORT_COLLECTIONS) {
    const row = { user_id: "owner", snapshot: { score: 83 } };
    assert.equal((await client.from(table).upsert(row).select("*").single()).error, null);
    await client.from(table).select("*").eq("user_id", "owner").order("updated_at", { ascending: false }).limit(20);
  }
  assert.equal(calls.length, REPORT_COLLECTIONS.size * 2);
  assert.ok(calls.every((call) => call.capabilities === REPORT_CAPABILITIES));
});

test("legacy builds preserve genuine legacy writes and reject cached new reports", async () => {
  const values = [];
  const raw = { from() { return { upsert(value) { values.push(value); return Promise.resolve({ data: value, error: null }); } }; } };
  const client = isolatedReportClient(raw, { enabled: false });
  const old = { report: { repertoireHealth: { version: "repertoire_health_v3", score: 61 } } };
  await client.from("profiles").upsert(old);
  const next = { preferences: { legacyStorage: JSON.stringify({ report: { version: "repertoire_health_v4" } }) } };
  assert.equal((await client.from("settings").upsert(next).select("*").single()).error.code, "REPORT_ISOLATION");
  assert.deepEqual(values, [old]);
});

test("unsupported RPC writes and unknown mirrors fail closed without legacy fallback", async () => {
  const raw = { from() { return { insert() { assert.fail("legacy writer called"); } }; }, rpc() { assert.fail("legacy RPC called"); } };
  const client = isolatedReportClient(raw, { enabled: true, request() { assert.fail("unknown API write"); } });
  assert.ok((await client.rpc("save_weekly_training_plan", { score: 83 })).error);
  assert.ok((await client.from("future_report_mirror").insert({ score: 83 })).error);
});

test("new local caches cannot overwrite legacy caches and remain readable after server rollback", () => {
  const map = new Map([["openingFit:lastAnalysis", "legacy"]]);
  const raw = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
  const old = isolatedLocalStorage(() => raw, false), current = isolatedLocalStorage(() => raw, true);
  assert.equal(current.getItem("openingFit:lastAnalysis"), "legacy");
  current.setItem("openingFit:lastAnalysis", "new-v4");
  assert.equal(old.getItem("openingFit:lastAnalysis"), "legacy");
  assert.equal(current.getItem("openingFit:lastAnalysis"), "new-v4");
  raw.setItem("openingfit.studyPlanner.v1.player", "old-plan");
  assert.equal(current.getItem("openingfit.studyPlanner.v1.player"), "old-plan");
  current.setItem("openingfit.studyPlanner.v1.player", "new-plan");
  assert.equal(raw.getItem("openingfit.studyPlanner.v1.player"), "old-plan");
  assert.equal(current.getItem("openingfit.studyPlanner.v1.player"), "new-plan");
  current.removeItem("openingFit:lastAnalysis");
  assert.equal(current.getItem("openingFit:lastAnalysis"), null);
  assert.equal(old.getItem("openingFit:lastAnalysis"), "legacy");
});

test("nested and serialized report markers are detected", () => {
  assert.ok(hasNewReport({ snapshot: JSON.stringify({ version: "report_decision_v7" }) }));
  assert.equal(hasNewReport({ version: "report_decision_v6" }), false);
});

test("new imports negotiate capabilities and use the same generation for polling", async (t) => {
  const calls = [];
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return new Response(JSON.stringify(calls.length === 1 ? { jobId: "v4-job", generation: "stage6_v1" }
      : { status: "completed", generation: "stage6_v1", result: { version: "repertoire_health_v4" } }), { status: 200 });
  };
  const result = await importGames({ platform: "lichess", username: "Player", stage6: true, accessToken: "test-token" });
  assert.equal(result.data.version, "repertoire_health_v4");
  assert.ok(calls.every(({ url }) => url.includes("/api/v2/analysis/jobs")));
  assert.deepEqual(JSON.parse(calls[0].body).capabilities, REPORT_CAPABILITIES);
  assert.equal(calls[1].headers["X-OpeningFit-Report-Capabilities"], REPORT_CAPABILITIES.join(","));
});

for (const status of [404, 409, 503]) test(`new import HTTP ${status} never falls back to legacy`, async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ detail: "disabled" }), { status }); };
  await assert.rejects(importGames({ platform: "lichess", username: "Player", stage6: true }));
  assert.equal(calls, 1);
});

test("poll generation drift is rejected before accepting any report", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = async () => new Response(JSON.stringify(++calls === 1
    ? { jobId: "job", generation: "stage6_v1" }
    : { generation: "legacy_v1", status: "completed", result: {} }), { status: 200 });
  await assert.rejects(importGames({ platform: "lichess", username: "Player", stage6: true }), /changed report generation/);
});
