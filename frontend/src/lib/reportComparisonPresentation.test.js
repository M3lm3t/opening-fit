import assert from "node:assert/strict";
import test from "node:test";

import { comparisonFixtures } from "./fixtures/reportComparisonFixtures.js";
import { buildReportComparisonView } from "./reportComparisonPresentation.js";
import { selectPreviousReportSnapshot } from "./reportComparisonPresentation.js";

const dated = (snapshot, generatedAt) => ({ ...snapshot, generated_at: generatedAt });
const previous = dated(comparisonFixtures.scoreIncrease.previous, "2026-06-01T10:00:00Z");

function viewFor(current, options = {}) {
  return buildReportComparisonView({
    currentSnapshot: dated(current, "2026-07-01T10:00:00Z"),
    reportSnapshots: [previous],
    ...options,
  });
}

test("renders a first-report state without empty numeric placeholders", () => {
  const view = buildReportComparisonView({ currentSnapshot: dated(comparisonFixtures.firstEver.current, "2026-07-01T10:00:00Z") });
  assert.equal(view.state, "first-report");
  assert.match(view.message, /future reports will compare/i);
  assert.match(view.message, /play more games/i);
  assert.equal(view.primaryHighlights.length, 0);
  assert.doesNotMatch(view.message, /\b0\b/);
});

test("renders meaningful improvement with previous and current values", () => {
  const view = viewFor(comparisonFixtures.scoreIncrease.current);
  assert.equal(view.state, "ready");
  assert.equal(view.primaryHighlights.length <= 5, true);
  assert.ok(view.primaryHighlights.some((item) => item.statusLabel === "Improvement" && /60 to 68/.test(item.text)));
  assert.ok(view.details.some((item) => item.title === "OpeningFit Score" && /60 before · 68 now/.test(item.text)));
});

test("does not compare the in-memory report with its saved copy", () => {
  const current = dated(comparisonFixtures.scoreIncrease.current, "2026-07-01T10:00:00Z");
  const savedCurrent = dated({ ...comparisonFixtures.scoreIncrease.current }, "2026-06-30T10:00:00Z");
  assert.equal(selectPreviousReportSnapshot(current, [savedCurrent, previous]), previous);
});

test("renders decline explicitly", () => {
  const view = viewFor(comparisonFixtures.scoreDecrease.current);
  assert.ok(view.primaryHighlights.some((item) => item.statusLabel === "Decline"));
  assert.ok(view.details.some((item) => item.title === "OpeningFit Score" && item.statusLabel === "Decline"));
});

test("small samples render insufficient data and never claim improvement", () => {
  const smallPrevious = dated({ ...comparisonFixtures.smallSample.previous, total_games_analysed: 2 }, "2026-06-01T10:00:00Z");
  const view = buildReportComparisonView({
    currentSnapshot: dated({ ...comparisonFixtures.smallSample.current, total_games_analysed: 3, openingfit_score: 90 }, "2026-07-01T10:00:00Z"),
    reportSnapshots: [smallPrevious],
  });
  assert.ok(view.warnings.some((warning) => /required before OpeningFit calls/i.test(warning)));
  assert.equal(view.details.find((item) => item.title === "OpeningFit Score")?.statusLabel, "Insufficient data");
  assert.equal(view.primaryHighlights.some((item) => item.statusLabel === "Improvement"), false);
});

test("renders loading state", () => {
  const view = viewFor(comparisonFixtures.scoreIncrease.current, { loading: true });
  assert.equal(view.state, "loading");
  assert.match(view.title, /loading/i);
});

test("renders comparison error without hiding the current report", () => {
  const view = viewFor(comparisonFixtures.scoreIncrease.current, { error: "history unavailable" });
  assert.equal(view.state, "error");
  assert.match(view.message, /current report is still available/i);
});
