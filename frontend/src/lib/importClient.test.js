import test from "node:test";
import assert from "node:assert/strict";
import { importGames, ImportClientError } from "./importClient.js";


test("background analysis starts a job and returns its completed result", async (context) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body });
    if (options.method === "POST") {
      return new Response(JSON.stringify({ jobId: "job-1", status: "queued" }), { status: 202 });
    }
    return new Response(JSON.stringify({ status: "completed", result: { gamesImported: 9 } }), { status: 200 });
  };

  let startedJob = null;
  const progress = [];
  const result = await importGames({
    platform: "chesscom",
    username: "ExamplePlayer",
    months: 3,
    timeControl: "rapid",
    onJobStarted: (job) => { startedJob = job; },
    onProgress: (value) => { progress.push(value); },
  });

  assert.equal(startedJob.jobId, "job-1");
  assert.deepEqual(result.data, { gamesImported: 9 });
  assert.deepEqual(calls.map((call) => call.method), ["POST", "GET"]);
  assert.equal(JSON.parse(calls[0].body).time_control, "rapid");
  assert.deepEqual(progress, [null, null]);
});


test("failed background analysis becomes an actionable client error", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options = {}) => options.method === "POST"
    ? new Response(JSON.stringify({ jobId: "job-2", status: "queued" }), { status: 202 })
    : new Response(JSON.stringify({ status: "failed", error: { status: 404, message: "Player not found." } }), { status: 200 });

  await assert.rejects(
    () => importGames({ platform: "lichess", username: "MissingPlayer", months: 1 }),
    (error) => error instanceof ImportClientError && error.status === 404 && error.message === "Player not found."
  );
});

test("polling forwards real progress payloads", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options = {}) => options.method === "POST"
    ? new Response(JSON.stringify({ jobId: "job-3", status: "queued", progress: { stage: "queued", counts: {} } }), { status: 202 })
    : new Response(JSON.stringify({ status: "completed", progress: { stage: "finishing_report", counts: { fetchedGames: 12 } }, result: { gamesImported: 12 } }), { status: 200 });
  const updates = [];
  await importGames({ platform: "lichess", username: "Player", months: 1, onProgress: (progress) => updates.push(progress) });
  assert.deepEqual(updates.map((item) => item.stage), ["queued", "finishing_report"]);
});

test("cancelling polling produces a cancellation and no result", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const controller = new AbortController();
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === "POST") return new Response(JSON.stringify({ jobId: "job-4", status: "queued" }), { status: 202 });
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return new Response(JSON.stringify({ status: "running" }), { status: 200 });
  };
  await assert.rejects(
    () => importGames({ platform: "chesscom", username: "Player", months: 1, controller, onJobStarted: () => controller.abort() }),
    (error) => error instanceof ImportClientError && error.message === "Import cancelled."
  );
});
