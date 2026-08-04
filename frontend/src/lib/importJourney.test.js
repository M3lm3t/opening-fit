import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportRequestKey,
  analysisTimingStatus,
  classifyImportFailure,
  mapAnalysisJobProgress,
  mergeAnalysisJobProgress,
  recoveryActionsForImportFailure,
  runWithControlledRetry,
  validateImportUsername,
  waitForProgressCompletion,
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
  assert.equal(classifyImportFailure({ error: { status: 502, message: "Chess.com could not return all selected monthly game archives" } }).category, "platform_temporarily_unavailable");
});

test("loading timing identifies a genuinely slow upstream request", () => {
  assert.equal(analysisTimingStatus(14).showElapsed, false);
  assert.equal(analysisTimingStatus(15).elapsedLabel, "0:15 elapsed");
  assert.equal(analysisTimingStatus(45).slow, false);
  assert.equal(analysisTimingStatus(91).slow, true);
  assert.match(analysisTimingStatus(91).label, /platform or analysis service/i);
  assert.match(analysisTimingStatus(7).reassurance, /larger game histories/i);
});

test("archive and game processing progress use measurable totals", () => {
  const archives = mapAnalysisJobProgress({ stage: "requesting_public_games", counts: { archivesProcessed: 1, archivesTotal: 3, fetchedGames: 42 } });
  assert.deepEqual(archives.progress, { current: 1, maximum: 3, unit: "archives" });
  assert.match(archives.message, /2 of 3 monthly archives.*42 games found so far/i);
  const games = mapAnalysisJobProgress({ stage: "identifying_openings", counts: { fetchedGames: 42, analysedGames: 30, processedGames: 18 } });
  assert.deepEqual(games.progress, { current: 18, maximum: 30, unit: "games" });
  assert.match(games.message, /Processing game 18 of 30/i);
});

test("progress never moves backwards and malformed totals remain indeterminate", () => {
  const first = mapAnalysisJobProgress({ stage: "requesting_public_games", counts: { archivesProcessed: 2, archivesTotal: 3 } });
  const stale = mapAnalysisJobProgress({ stage: "requesting_public_games", counts: { archivesProcessed: 1, archivesTotal: 3 } });
  assert.equal(mergeAnalysisJobProgress(first, stale).progress.current, 2);
  const later = mapAnalysisJobProgress({ stage: "identifying_openings", counts: { analysedGames: 20, processedGames: 10 } });
  assert.equal(mergeAnalysisJobProgress(later, first).stage, "identifying_openings");
  assert.equal(mapAnalysisJobProgress({ stage: "requesting_public_games", counts: { archivesTotal: 0 } }).progress, null);
});

test("a successful finishing stage reaches a complete determinate unit", () => {
  const saving = mapAnalysisJobProgress({ stage: "finishing_report", counts: { fetchedGames: 42 } });
  assert.deepEqual(saving.progress, { current: 1, maximum: 1, unit: "stage" });
  assert.equal(Math.round((saving.progress.current / saving.progress.maximum) * 100), 100);
});

test("real job stages map without inventing percentage progress", () => {
  const progress = mapAnalysisJobProgress({ stage: "identifying_openings", counts: { fetchedGames: 310, eligibleGames: 180 } });
  assert.equal(progress.real, true);
  assert.equal(progress.stage, "identifying_openings");
  assert.equal(progress.message, "310 games found — identifying recurring openings.");
  assert.equal(Object.hasOwn(progress, "percent"), false);
});

test("recommendation progress reports suitable and excluded counts without fake precision", () => {
  const progress = mapAnalysisJobProgress({ stage: "building_recommendations", counts: { fetchedGames: 311, analysedGames: 280, excludedGames: 31 }, elapsedSeconds: 18, lastUpdatedAt: "2026-07-29T10:00:00Z" });
  assert.equal(progress.progress, null);
  assert.match(progress.message, /280 suitable for analysis, 31 excluded/i);
  assert.equal(progress.elapsedSeconds, 18);
  assert.equal(progress.lastUpdatedAt, "2026-07-29T10:00:00Z");
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
  assert.match(importFlow, /waitForProgressCompletion\(abortController\.signal, 350, window\)/);
  assert.doesNotMatch(importFlow, /setInterval|IMPORT_STAGES\.(FILTERING|IDENTIFYING|RECOMMENDING).*setTimeout/s);
  assert.ok(importFlow.indexOf("activeImportRunRef.current !== runId") < importFlow.indexOf("setData(cleanData)"));
});

test("completion delay and active request are cleaned up on abort or unmount", async () => {
  const controller = new AbortController();
  let scheduled = null;
  let cleared = null;
  const waiting = waitForProgressCompletion(controller.signal, 350, {
    setTimeout(callback) { scheduled = callback; return 17; },
    clearTimeout(id) { cleared = id; },
  });
  controller.abort();
  await waiting;
  assert.equal(cleared, 17);
  assert.equal(typeof scheduled, "function");

  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(source, /useEffect\(\(\) => \(\) => \{\s*activeImportRunRef\.current \+= 1;\s*importAbortRef\.current\?\.abort\(\)/s);
  assert.match(source, /return \(\) => window\.clearInterval\(interval\)/);
});

test("the loading overlay exposes accessible determinate and indeterminate progress", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../components/ImportLoadingOverlay.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../components/ImportLoadingOverlay.css", import.meta.url), "utf8");
  assert.match(source, /role="progressbar"/);
  assert.match(source, /aria-valuenow=\{determinate \? progressValue : undefined\}/);
  assert.match(source, /<b>\{progressPercent\}%<\/b>/);
  assert.match(source, /elapsedSeconds >= 7/);
  assert.match(styles, /importLoadingProgress--indeterminate/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.doesNotMatch(styles, /min-width:\s*[4-9]\d\dpx/);
  assert.match(source, /role="dialog"/);
  assert.equal((source.match(/aria-live="polite"/g) || []).length, 1);
  assert.match(source, /Importing and analysing games/);
  assert.match(source, /hasRealStage \|\| complete \? <div className="importLoadingSteps"/);
  assert.doesNotMatch(source, /Waiting for a confirmed analysis stage/);
});

test("unconfirmed work has one honest indeterminate surface while confirmed stages remain available", async () => {
  const { readFile } = await import("node:fs/promises");
  const overlay = await readFile(new URL("../components/ImportLoadingOverlay.jsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(overlay, /hasRealStage = Boolean\(progress\?\.real/);
  assert.match(overlay, /Detailed stages are not available for this request/);
  assert.match(overlay, /timing\.showElapsed/);
  assert.match(overlay, /You can safely cancel without replacing your last report/);
  assert.match(app, /loading && data \? \([\s\S]*backgroundAnalysisNotice[\s\S]*\) : loading \? \([\s\S]*<ImportLoadingOverlay/);
});
