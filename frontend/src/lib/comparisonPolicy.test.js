import test from "node:test";
import assert from "node:assert/strict";
import cases from "./fixtures/comparisonPolicyCases.json" with { type: "json" };
import { comparisonEligibility, openingContextIdentity, observedOpeningPerformance } from "./comparisonPolicy.js";
import { buildReportSnapshot } from "./reportSnapshot.js";
import { compareReportSnapshots } from "./reportComparison.js";
import { compareCompletedReports } from "./progressExperience.js";
import { evaluatePersonalTrainingMove, compareTrainedPosition } from "./personalOpeningTraining.js";
import { Chess } from "chess.js";

for (const fixture of cases) test(`comparison policy: ${fixture.name}`, () => {
  const before = structuredClone(fixture);
  assert.equal(comparisonEligibility(fixture.previous, fixture.current).comparable, fixture.comparable);
  const snapshots = [fixture.previous, fixture.current].map(report => buildReportSnapshot({ report, defaultGeneratedAt: false }));
  assert.equal(compareReportSnapshots(...snapshots).comparable, fixture.comparable);
  assert.equal(compareCompletedReports(snapshots).available, fixture.comparable);
  assert.deepEqual(fixture, before);
});

test("opening score includes draws; missing results never become fit or win-rate evidence", () => {
  const performance = observedOpeningPerformance({ games: 18, wins: 11, draws: 2, losses: 5 });
  assert.equal(performance.winRate.toFixed(1), "61.1");
  assert.equal(performance.scoreRate.toFixed(1), "66.7");
  for (const row of [{ games: 0, wins: 0, draws: 0, losses: 0 }, { games: 5, score_rate: 90, win_rate: 80, fitScore: 70 }, { games: 5, wins: 6, draws: 0, losses: 0 }]) assert.equal(observedOpeningPerformance(row), null);
});

test("opening comparison identity requires a role and consistent colour", () => {
  const white = { canonicalContextId: "same-opening", repertoireRole: "white", playerColour: "white" };
  assert.notEqual(openingContextIdentity(white), openingContextIdentity({ ...white, repertoireRole: "black_vs_e4", playerColour: "black" }));
  assert.equal(openingContextIdentity({ ...white, playerColour: "black" }), null);
  assert.equal(openingContextIdentity({ canonicalContextId: "same-opening" }), null);
});

test("legal alternatives are saved-line deviations, not validated errors", () => {
  const chess = new Chess(); chess.move("e4"); chess.move("e5");
  const item = { startingFen: chess.fen(), playerColour: "white", originalMove: "Nc3", expectedMoveUci: "g1f3", acceptedMoveUcis: ["g1f3", "f1c4"] };
  assert.equal(evaluatePersonalTrainingMove(item, "Bc4").accepted, true);
  assert.equal(evaluatePersonalTrainingMove(item, "Nc3").reason, "saved_line_deviation");
  assert.equal(evaluatePersonalTrainingMove(item, "Nc3").moveQuality, "unassessed");
  assert.equal(compareTrainedPosition(item, { pgn: "1. e4 e5 2. Nc3" }).outcome, "repeated_original_move");
});
