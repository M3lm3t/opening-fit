import test from "node:test";
import assert from "node:assert/strict";
import { fetchGamesAnalysedMetric, formatGamesAnalysedMetric, resolveGamesAnalysedMetric } from "./homepageMetrics.js";

const payload = (count) => ({ ok: true, count, source: "analysed_games_unique_saved_records" });

test("a genuine smaller total is displayed exactly", () => {
  assert.deepEqual(resolveGamesAnalysedMetric({ payload: payload(8426) }), { count: 8426, label: "8,426 games analysed" });
});

test("a large total is rounded down only to a mathematically supported claim", () => {
  assert.equal(formatGamesAnalysedMetric(10_001), "Over 10,000 games analysed");
  assert.equal(formatGamesAnalysedMetric(20_000), "20,000 games analysed");
  assert.equal(formatGamesAnalysedMetric(28_426), "Over 20,000 games analysed");
});

test("zero, null, undefined, malformed and low-credibility values are hidden", () => {
  for (const value of [0, null, undefined, "8426", "invalid", Number.NaN, 99, -1, 8.5]) {
    assert.equal(resolveGamesAnalysedMetric({ payload: payload(value) }), null);
  }
});

test("loading and failed states never expose a counter", () => {
  assert.equal(resolveGamesAnalysedMetric({ loading: true, payload: payload(8426) }), null);
  assert.equal(resolveGamesAnalysedMetric({ failed: true, payload: payload(8426) }), null);
  assert.equal(resolveGamesAnalysedMetric({ payload: { ok: false, count: 8426, source: "unavailable" } }), null);
  assert.equal(resolveGamesAnalysedMetric({ payload: { ok: true, count: 8426, source: "baseline_only" } }), null);
});

test("request failures and invalid responses silently hide the metric", async () => {
  assert.equal(await fetchGamesAnalysedMetric(async () => { throw new Error("offline"); }), null);
  assert.equal(await fetchGamesAnalysedMetric(async () => ({ ok: false })), null);
  assert.equal(await fetchGamesAnalysedMetric(async () => ({ ok: true, json: async () => payload(null) })), null);
});
