import test from "node:test";
import assert from "node:assert/strict";
import { persistReport, readPersistedReport } from "./reportPersistence.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("a verified candidate atomically replaces the previous report", () => {
  const key = "report";
  const storage = memoryStorage();
  assert.equal(persistReport(storage, key, { username: "A", analysis: { analysisCompleted: true, id: "A" } }).ok, true);
  assert.equal(persistReport(storage, key, { username: "B", analysis: { analysisCompleted: true, id: "B" } }).ok, true);
  assert.equal(readPersistedReport(storage, key).analysis.id, "B");
});

test("a failed candidate write restores report A byte-for-byte", () => {
  const key = "report";
  const previous = JSON.stringify({ schemaVersion: 1, username: "A", analysis: { analysisCompleted: true, id: "A" } });
  const base = memoryStorage({ [key]: previous });
  let writes = 0;
  const storage = {
    ...base,
    setItem(name, value) {
      writes += 1;
      if (writes === 1) return base.setItem(name, "truncated");
      return base.setItem(name, value);
    },
  };
  const result = persistReport(storage, key, { username: "B", analysis: { analysisCompleted: true, id: "B" } });
  assert.equal(result.ok, false);
  assert.equal(base.getItem(key), previous);
  assert.equal(readPersistedReport(storage, key).analysis.id, "A");
});

test("an invalid candidate never touches an existing report", () => {
  const key = "report";
  const previous = JSON.stringify({ schemaVersion: 1, analysis: { id: "A" } });
  const storage = memoryStorage({ [key]: previous });
  assert.deepEqual(persistReport(storage, key, { analysis: null }), { ok: false, reason: "invalid_report" });
  assert.equal(storage.getItem(key), previous);
});
