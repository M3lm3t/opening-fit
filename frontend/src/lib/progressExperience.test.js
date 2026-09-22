import test from "node:test";
import assert from "node:assert/strict";
import { buildReturningProgress, compareCompletedReports, orderedCompletedReports } from "./progressExperience.js";
import cases from "./fixtures/comparisonPolicyCases.json" with { type: "json" };
const report = (date, fit, issueGames = 0) => ({ created_at: date, report: { ...structuredClone(date.includes("02-01") ? cases[0].current : cases[0].previous), openingFitScore: fit, repertoireHealth: { version: "repertoire_health_v4", score: fit }, best_openings: [{ name: "Italian", canonicalContextId: "italian|white", repertoireRole: "white", playerColour: "white", games: 10, wins: fit / 10, draws: 0, losses: 10-fit/10 }], weak_lines: issueGames ? [{ name: "Italian trap", games: issueGames }] : [] } });

test("anonymous and first authenticated users remain first-time", () => { assert.equal(buildReturningProgress({}).isReturning, false); assert.equal(buildReturningProgress({ user: { id: "u" } }).isReturning, false); });
test("one completed report creates returning state without comparison", () => { const model = buildReturningProgress({ user: { id: "u" }, reportHistory: [report("2026-01-01", 60)] }); assert.equal(model.isReturning, true); assert.equal(model.comparison.available, false); });
test("multiple reports compare observed opening score without implying causation", () => { const comparison = compareCompletedReports([report("2026-02-01", 70), report("2026-01-01", 60)]); assert.equal(comparison.health.delta, 10); assert.equal(comparison.changes[0].scoreDelta, 10); });
test("new games are shown only when supplied reliably", () => { assert.equal(buildReturningProgress({ currentReport: { newEligibleGames: 6 } }).newGames, 6); assert.equal(buildReturningProgress({ currentReport: {} }).newGamesReliable, false); });
test("failed report is excluded and duplicates are prevented", () => { const good = report("2026-01-01", 60); good.id = "same"; assert.equal(orderedCompletedReports([{ ...good, status: "failed" }, good, { ...good }]).length, 1); });
test("training completion is counted between reports", () => { const comparison = compareCompletedReports([report("2026-02-01", 70), report("2026-01-01", 60)], [{ type: "training_completed", created_at: "2026-01-15" }]); assert.equal(comparison.trainingCompleted, 1); });
test("reduced frequency never resolves an issue", () => { const comparison = compareCompletedReports([report("2026-02-01", 70, 1), report("2026-01-01", 60, 4)]); assert.equal(comparison.resolved.length, 0); });
test("missing history remains safe", () => assert.deepEqual(compareCompletedReports([]).changes, []));
