import test from "node:test";
import assert from "node:assert/strict";
import { isPilotEntry, loadPilotEligibility, loadPilotHistory, confirmedPilotReport } from "./reportPilot.js";
import { isReportPilot, setReportPilot, isolatedReportClient, PILOT_CLIENT } from "./reportRollout.js";
import { selectNextMission } from "../services/missionApi.js";

const session = { user: { id: "account-a" }, access_token: "test-token" };
test("pilot URL is reserved even when disabled; ordinary web and native routes stay legacy", () => {
  assert.equal(isReportPilot(), false);
  for (const native of [true, false]) for (const enabled of [true, false]) for (const pathname of ["/", "/login", "/report", "/report-pilot", "/report-pilot/", "/report-pilot-extra"]) {
    assert.equal(isPilotEntry({ enabled, native, pathname }), !native && ["/report-pilot", "/report-pilot/"].includes(pathname));
  }
});

test("admission requires the server's exact account and scope; failures never downgrade", async (t) => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    assert.equal(options.headers["X-OpeningFit-Report-Client"], PILOT_CLIENT);
    return Response.json({ userId: "other", allowed: true, creationEnabled: true, scope: "reports-only" });
  };
  await assert.rejects(loadPilotEligibility(session), /did not confirm/);
  globalThis.fetch = async () => Response.json({ userId: session.user.id, allowed: false, creationEnabled: false, scope: "reports-only" });
  assert.equal((await loadPilotEligibility(session)).allowed, false);
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  await assert.rejects(loadPilotEligibility(session));
  await assert.rejects(loadPilotEligibility(null), /Sign in/);
  assert.equal(calls, 1);
});

test("history refuses cross-account results and cannot claim an unconfirmed save", async (t) => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.operation, "select");
    assert.deepEqual(body.filters, [["user_id", "eq", session.user.id]]);
    return Response.json({ data: [{ user_id: "other" }] });
  };
  await assert.rejects(loadPilotHistory(session), /ownership/);
  const result = { analysisId: "job-a" };
  assert.throws(() => confirmedPilotReport([], result), /could not be verified/);
  assert.throws(() => confirmedPilotReport([{ analysis_id: "job-a", report: { reportGeneration: "legacy_v1" } }], result));
  const row = { analysis_id: "job-a", report: { reportGeneration: "stage6_v1" } };
  assert.equal(confirmedPilotReport([row], result), row);
});

test("pilot mutations cannot reach missions or RPCs, and legacy sessions retain their RPCs", async (t) => {
  t.after(() => setReportPilot(false));
  let calls = 0;
  const client = isolatedReportClient({ rpc() { calls++; return { data: "legacy", error: null }; } });
  setReportPilot(true);
  assert.match((await client.rpc("save_coaching_response_plan", {})).error.message, /reading only/);
  await assert.rejects(selectNextMission("new-report"), /reading only/);
  assert.equal(calls, 0);
  setReportPilot(false);
  assert.equal(client.rpc("save_coaching_response_plan", {}).data, "legacy");
});
