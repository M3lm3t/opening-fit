import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportRequestKey,
  analysisTimingStatus,
  classifyImportFailure,
  mapAnalysisJobProgress,
  recoveryActionsForImportFailure,
  runWithControlledRetry,
  validateImportUsername,
} from "./importJourney.js";

test("valid Chess.com and Lichess usernames pass validation", () => {
  assert.equal(validateImportUsername("Hikaru").ok, true);
  assert.equal(validateImportUsername("Dr_Nykterstein").ok, true);
});

test("invalid and empty usernames are actionable", () => {
  assert.equal(validateImportUsername("").category, "empty_username");
  assert.equal(validateImportUsername("bad name!").category, "unsupported_username_format");
});

test("too few games retains the previous report", () => {
  const result = classifyImportFailure({ error: { message: "not enough games" }, hadPreviousReport: true });
  assert.equal(result.category, "too_few_games");
  assert.equal(result.retained, true);
});

test("external timeout is recoverable but not automatically retried", async () => {
  let attempts = 0;
  await assert.rejects(() => runWithControlledRetry(async () => {
    attempts += 1;
    throw { type: "timeout" };
  }, { wait: async () => {} }));
  assert.equal(attempts, 1);
});

test("duplicate request keys are deterministic", () => {
  const left = buildImportRequestKey({ platform: "chesscom", username: "Hikaru", months: 3 });
  const right = buildImportRequestKey({ platform: "chesscom", username: "hikaru", months: 3 });
  assert.equal(left, right);
});

test("failed save after successful analysis reports local retention", () => {
  const result = classifyImportFailure({ error: { category: "cloud_save_failure" }, reportCreated: true });
  assert.equal(result.category, "cloud_save_failure");
  assert.equal(result.retained, true);
});

test("safe retry succeeds after a transient failure", async () => {
  let attempts = 0;
  const result = await runWithControlledRetry(async () => {
    attempts += 1;
    if (attempts === 1) throw { type: "network" };
    return "ok";
  }, { wait: async () => {} });
  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("previous report remains represented after import failure", () => {
  const result = classifyImportFailure({ error: { type: "network" }, hadPreviousReport: true });
  assert.match(result.lossMessage, /previous successful report/i);
});

test("error causes stay distinct and actionable", () => {
  assert.equal(classifyImportFailure({ error: { status: 404, message: "not found" } }).category, "username_not_found");
  assert.equal(classifyImportFailure({ error: { status: 403, message: "profile is private" } }).category, "private_profile");
  assert.equal(classifyImportFailure({ error: { message: "no eligible games after unsupported time control filters" } }).category, "no_eligible_games");
  assert.equal(classifyImportFailure({ error: { status: 403, message: "This account can analyse up to 3 months" } }).category, "account_limit");
});

test("loading timing identifies a genuinely slow upstream request", () => {
  assert.equal(analysisTimingStatus(14).showElapsed, false);
  assert.equal(analysisTimingStatus(15).elapsedLabel, "0:15 elapsed");
  assert.equal(analysisTimingStatus(45).slow, false);
  assert.equal(analysisTimingStatus(91).slow, true);
  assert.match(analysisTimingStatus(91).label, /platform or analysis service/i);
});

test("real job stages map without inventing percentage progress", () => {
  const progress = mapAnalysisJobProgress({ stage: "identifying_openings", counts: { fetchedGames: 310, eligibleGames: 180 } });
  assert.equal(progress.real, true);
  assert.equal(progress.stage, "identifying_openings");
  assert.equal(progress.message, "310 games found — identifying recurring openings.");
  assert.equal(Object.hasOwn(progress, "percent"), false);
});

test("missing or unknown job stages remain honestly indeterminate", () => {
  assert.deepEqual(mapAnalysisJobProgress(null), { real: false, stage: null, counts: {}, message: "Analysis is running. Detailed stages are not available for this request." });
  assert.equal(mapAnalysisJobProgress({ stage: "mystery" }).real, false);
});

test("required analysis failures stay distinct and have recovery actions", () => {
  const cases = [
    [{ status: 404, message: "not found" }, "username_not_found"],
    [{ message: "no eligible games" }, "no_eligible_games"],
    [{ status: 429, message: "rate limited" }, "platform_temporarily_unavailable"],
    [{ type: "network" }, "network_server_failure"],
    [{ type: "timeout" }, "analysis_timed_out"],
    [{ message: "unexpected" }, "unknown_import_error"],
  ];
  for (const [error, category] of cases) {
    assert.equal(classifyImportFailure({ error }).category, category);
    assert.ok(recoveryActionsForImportFailure(category).length > 0, `${category} needs a recovery action`);
  }
});

test("the app guards cancellation, duplicate submission and fake stage timers", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const importFlow = source.slice(source.indexOf("const importGames = async"), source.indexOf("const submitFeedback"));
  assert.match(source, /const activeImportRunRef = useRef\(0\)/);
  assert.match(importFlow, /activeImportRunRef\.current !== runId \|\| abortController\.signal\.aborted/);
  assert.match(importFlow, /if \(loading \|\| activeImportKeyRef\.current\)/);
  assert.doesNotMatch(importFlow, /await new Promise\(\(resolve\) => setTimeout/);
  assert.ok(importFlow.indexOf("activeImportRunRef.current !== runId") < importFlow.indexOf("setData(cleanData)"));
});
