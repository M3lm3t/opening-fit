import assert from "node:assert/strict";
import test from "node:test";

import { buildMeaningfulProgressSummary } from "./meaningfulProgressSummary.js";

function snapshot(overrides = {}) {
  return {
    report_id: overrides.report_id || "report-current",
    generated_at: overrides.generated_at || "2026-08-10T12:00:00.000Z",
    source_platform: "chesscom",
    source_username: "openingfit-player",
    total_games_analysed: 20,
    openingfit_score: 70,
    opening_statistics: [],
    weaknesses: [],
    ...overrides,
  };
}

function previous(overrides = {}) {
  return snapshot({ report_id: "report-previous", generated_at: "2026-07-10T12:00:00.000Z", total_games_analysed: 12, ...overrides });
}

test("no previous report produces no progress summary", () => {
  const view = buildMeaningfulProgressSummary({ currentSnapshot: snapshot(), reportSnapshots: [] });
  assert.equal(view.state, "no-previous");
  assert.deepEqual(view.rows, []);
});

test("ordinary score noise is not surfaced, while genuine new-game count remains visible", () => {
  const before = previous({ opening_statistics: [{ name: "Vienna Game", side: "white", games: 18, score: 56 }] });
  const current = snapshot({ opening_statistics: [{ name: "Vienna Game", side: "white", games: 20, score: 58 }] });
  const view = buildMeaningfulProgressSummary({ currentSnapshot: current, reportSnapshots: [before] });
  assert.equal(view.state, "ready");
  assert.deepEqual(view.rows.map((row) => row.category), ["NEW GAMES", "REPERTOIRE HEALTH"]);
  assert.match(view.rows[1].text, /classified as stable/i);
});

test("recommendation confidence increase is reported as more evidence", () => {
  const before = previous({ recommendations: { white: { opening: "Vienna Game", confidence: "Low confidence" } } });
  const current = snapshot({ recommendations: { white: { opening: "Vienna Game", confidence: "High confidence" } } });
  const view = buildMeaningfulProgressSummary({ currentSnapshot: current, reportSnapshots: [before] });
  assert.equal(view.rows.find((row) => row.category === "MORE EVIDENCE").title, "Vienna Game");
});

test("a previous repair disappearing from a sufficient sample is resolved", () => {
  const before = previous({ weaknesses: [{ issue_id: "weak-1", opening: "Scandinavian Defense", frequency: 5 }] });
  const current = snapshot({ weaknesses: [] });
  const view = buildMeaningfulProgressSummary({ currentSnapshot: current, reportSnapshots: [before] });
  assert.match(view.rows.find((row) => row.category === "RESOLVED").text, /no longer recurring/i);
});

test("a supported new repair is reported as a new issue", () => {
  const before = previous({ weaknesses: [] });
  const current = snapshot({ weaknesses: [{ issue_id: "weak-2", opening: "French Defense", frequency: 3 }] });
  const view = buildMeaningfulProgressSummary({ currentSnapshot: current, reportSnapshots: [before] });
  assert.match(view.rows.find((row) => row.category === "NEW ISSUE").text, /3 supporting games/i);
});

test("an established repertoire role is reported as a coverage change", () => {
  const before = previous({ repertoire_roles: [{ key: "black_vs_d4", status: "low_confidence", games: 3 }] });
  const current = snapshot({ repertoire_roles: [{ key: "black_vs_d4", status: "established", games: 9 }] });
  const view = buildMeaningfulProgressSummary({ currentSnapshot: current, reportSnapshots: [before] });
  assert.match(view.rows.find((row) => row.category === "COVERAGE CHANGE").text, /now established/i);
});

test("small opening samples never produce improvement claims", () => {
  const before = previous({ total_games_analysed: 8, opening_statistics: [{ name: "Dutch Defense", side: "black", games: 3, score: 20 }] });
  const current = snapshot({ total_games_analysed: 9, opening_statistics: [{ name: "Dutch Defense", side: "black", games: 4, score: 80 }] });
  const view = buildMeaningfulProgressSummary({ currentSnapshot: current, reportSnapshots: [before] });
  assert.equal(view.state, "ready");
  assert.equal(view.rows.some((row) => row.category === "IMPROVED"), false);
});

test("canonical KEEP and REPAIR changes use qualifying evidence", () => {
  const recommendation = (verdict, games, score) => ({
    recommendationId: "rec-scandi",
    opening: "Scandinavian Defense",
    verdict,
    sample: { games, scoreRate: score },
    confidence: { label: "Strong" },
  });
  const before = previous({ report_decision: { recommendations: [recommendation("repair", 12, 46)] } });
  const current = snapshot({ report_decision: { recommendations: [recommendation("keep", 30, 55)] } });
  const view = buildMeaningfulProgressSummary({ currentSnapshot: current, reportSnapshots: [before] });
  assert.equal(view.rows[0].category, "RESOLVED");
  assert.match(view.rows[0].text, /REPAIR to KEEP after 18 additional qualifying games; score 46% to 55%/);
});

test("low-confidence verdict changes are not presented as authoritative", () => {
  const recommendation = (verdict, games) => ({ recommendationId: "rec-dutch", opening: "Dutch Defense", verdict, sample: { games }, confidence: { label: "Low confidence" } });
  const before = previous({ report_decision: { recommendations: [recommendation("keep", 3)] } });
  const current = snapshot({ report_decision: { recommendations: [recommendation("repair", 4)] } });
  const view = buildMeaningfulProgressSummary({ currentSnapshot: current, reportSnapshots: [before] });
  assert.equal(view.state, "ready");
});

test("compatible reports expose new games recurring positions and health context", () => {
  const habit = (occurrenceCount) => ({ trainingSubjectId: "subject-1", positionIdentity: "position-1", opening: "Scandinavian Defense", occurrenceCount });
  const before = previous({ openingfit_score: 64, recurring_opening_habits: [habit(2)] });
  const current = snapshot({ openingfit_score: 70, recurring_opening_habits: [habit(4)] });
  const view = buildMeaningfulProgressSummary({ currentSnapshot: current, reportSnapshots: [before] });
  assert.equal(view.rows.some((row) => row.category === "NEW GAMES"), true);
  assert.equal(view.rows.some((row) => row.category === "POSITION REACHED"), true);
  assert.equal(view.rows.some((row) => row.category === "REPERTOIRE HEALTH"), true);
});
