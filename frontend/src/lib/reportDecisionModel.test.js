import test from "node:test";
import assert from "node:assert/strict";
import { buildReportDecisionModel, openingContext, openingPerspective } from "./reportDecisionModel.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";

const full = {
  username: "LongChessUsername_2026",
  platform: "chess.com",
  gamesImported: 24,
  best_openings: [
    { name: "Italian Game", openingRole: "played_as_white", repertoireSlot: "white", games: 10, winRate: 65, verdict: "Keep" },
    { name: "Sicilian Defence", openingRole: "played_as_black", repertoireSlot: "black_vs_e4", games: 8, winRate: 38, verdict: "Improve" },
    { name: "Dutch Defence", openingRole: "played_as_black", repertoireSlot: "black_vs_d4", games: 6, winRate: 25, verdict: "Avoid" },
  ],
};

test("full Chess.com data produces ordered decisions", () => {
  const model = buildReportDecisionModel(full, { overallScore: 62 });
  assert.deepEqual(model.decisions.map((item) => item.type), ["keep", "repair", "reduce"]);
  assert.equal(model.header.platform, "Chess.com");
});
test("very small report exposes its coverage without inflating recommendation confidence", () => assert.match(buildReportDecisionModel({ gamesImported: 2 }).health.confidence, /2 analysed games/));
test("white-only data does not create inaccurate Black categories", () => assert.deepEqual(buildReportDecisionModel({ preferred_white: [{ name: "Vienna", openingRole: "played_as_white", repertoireSlot: "white", games: 5, score: 70 }] }).repertoire.map((row) => row.key), ["white"]));
test("black-only data does not create a White category", () => assert.equal(buildReportDecisionModel({ preferred_black: [{ name: "Caro-Kann", openingRole: "played_as_black", repertoireSlot: "black_vs_e4", games: 5, score: 60 }] }).repertoire.some((row) => row.key === "white"), false));
test("missing style and previous report remain safe", () => assert.equal(buildReportDecisionModel(full, {}, []).health.trend, null));
test("premium/free status does not alter decisions", () => assert.deepEqual(buildReportDecisionModel({ ...full, isPremium: true }).decisions, buildReportDecisionModel({ ...full, isPremium: false }).decisions));
test("Lichess and long usernames are retained", () => { const model = buildReportDecisionModel({ ...full, platform: "lichess" }); assert.equal(model.header.platform, "Lichess"); assert.equal(model.header.username, full.username); });
test("empty recommendation categories do not render empty decisions", () => assert.deepEqual(buildReportDecisionModel({ opening_recommendations: {} }).decisions, []));
test("insufficient evidence never becomes an avoid decision", () => assert.deepEqual(buildReportDecisionModel({ best_openings: [{ name: "Gambit", games: 2, fitScore: 90, verdict: "Avoid" }] }).decisions, []));

test("legacy records without explicit perspective never infer ownership from the name", () => {
  const item = { name: "French Defence", context: "played_as_white", colour: "white", games: 8 };
  assert.equal(openingPerspective(item).role, "unknown_mixed");
  assert.equal(openingContext(item).key, "unresolved");
  assert.deepEqual(buildReportDecisionModel({ best_openings: [item] }).decisions, []);
});

test("faced French and Scandinavian records remain opponent preparation", () => {
  for (const opening of ["French Defence", "Scandinavian Defence"]) {
    const reportDecision = {
      schemaVersion: 1,
      establishedStrength: null,
      primaryProblem: null,
      nextTrainingAction: { type: "prepare_against", opening, role: "faced_as_white", label: `Prepare against the ${opening}`, reason: `You face this opening as White (6 games).` },
      supportingEvidence: ["6 games"],
      confidence: { status: "sufficient", gamesAnalysed: 6, minimumOpeningGames: 3 },
      baseline: { status: "baseline", hasComparablePrevious: false, comparisonClaimsAllowed: false },
    };
    const model = buildReportDecisionModel({ gamesAnalysed: 6, reportDecision, best_openings: [{ name: opening, openingRole: "faced_as_white", games: 6, fitScore: 30 }] });
    assert.equal(model.decisions.length, 0);
    assert.equal(model.training.type, "prepare_against");
    assert.match(model.verdict.paragraph, new RegExp(`face the ${opening}`));
  }
});

test("one-game canonical report remains insufficient and baseline", () => {
  const model = buildReportDecisionModel({
    gamesAnalysed: 1,
    reportDecision: {
      establishedStrength: null,
      primaryProblem: null,
      nextTrainingAction: { type: "collect_more_games", opening: null, role: null, label: "Collect more games before changing your repertoire", reason: "Insufficient data." },
      supportingEvidence: ["1 game analysed."],
      confidence: { status: "insufficient_data", gamesAnalysed: 1, minimumOpeningGames: 3 },
      baseline: { status: "baseline", hasComparablePrevious: false, comparisonClaimsAllowed: false },
    },
  });
  assert.equal(model.establishedStrength, null);
  assert.equal(model.health.trend, null);
  assert.equal(model.baseline.comparisonClaimsAllowed, false);
});

test("a genuine earlier comparable report enables, but a baseline suppresses, comparison", () => {
  const current = { ...full, importedAt: "2026-07-23T12:00:00Z" };
  const baseline = buildReportDecisionModel(current, { overallScore: 62 }, []);
  const later = buildReportDecisionModel(current, { overallScore: 62 }, [{ source_platform: "chess.com", source_username: full.username, generated_at: "2026-06-23T12:00:00Z", total_games_analysed: 20, openingfit_score: 55 }]);
  assert.equal(baseline.health.trend, null);
  assert.equal(baseline.baseline.status, "baseline");
  assert.equal(later.health.trend, 7);
  assert.equal(later.baseline.status, "comparable_later_report");
});

test("all headline consumers use the same authoritative next action", () => {
  const model = buildReportDecisionModel(full, { overallScore: 62 });
  const summary = buildPrimaryReportSummary(model, full);
  assert.equal(model.verdict.nextDecision, model.nextTrainingAction.label);
  assert.equal(model.training.label, model.nextTrainingAction.label);
  assert.equal(summary.training.title, model.nextTrainingAction.label);
  assert.equal(summary.verdict, model.verdict.paragraph);
});
