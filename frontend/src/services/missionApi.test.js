import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { missionActionKey } from "./missionApi.js";

const source = await readFile(new URL("./missionApi.js", import.meta.url), "utf8");

test("mission client uses the shared bearer session and never sends user identity", () => {
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
