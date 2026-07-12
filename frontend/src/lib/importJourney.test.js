import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportRequestKey,
  classifyImportFailure,
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
