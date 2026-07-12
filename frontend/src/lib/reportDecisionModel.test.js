import test from "node:test";
import assert from "node:assert/strict";
import { buildReportDecisionModel } from "./reportDecisionModel.js";

const full = {
  username: "LongChessUsername_2026",
  platform: "chess.com",
  gamesImported: 24,
  best_openings: [
    { name: "Italian Game", context: "played_as_white", games: 10, winRate: 65, verdict: "Keep" },
    { name: "Sicilian Defence", context: "black_vs_e4", games: 8, winRate: 38, verdict: "Improve" },
    { name: "Dutch Defence", context: "black_vs_d4", games: 6, winRate: 25, verdict: "Avoid" },
  ],
};

test("full Chess.com data produces ordered decisions", () => {
  const model = buildReportDecisionModel(full, { overallScore: 62 });
  assert.deepEqual(model.decisions.map((item) => item.type), ["keep", "repair", "reduce"]);
  assert.equal(model.header.platform, "Chess.com");
});
test("very small sample exposes low confidence", () => assert.match(buildReportDecisionModel({ gamesImported: 2 }).health.confidence, /Low/));
test("white-only data does not create inaccurate Black categories", () => assert.deepEqual(buildReportDecisionModel({ preferred_white: [{ name: "Vienna", context: "white", games: 5, score: 70 }] }).repertoire.map((row) => row.key), ["white"]));
test("black-only data does not create a White category", () => assert.equal(buildReportDecisionModel({ preferred_black: [{ name: "Caro-Kann", context: "black_vs_e4", games: 5, score: 60 }] }).repertoire.some((row) => row.key === "white"), false));
test("missing style and previous report remain safe", () => assert.equal(buildReportDecisionModel(full, {}, []).health.trend, null));
test("premium/free status does not alter decisions", () => assert.deepEqual(buildReportDecisionModel({ ...full, isPremium: true }).decisions, buildReportDecisionModel({ ...full, isPremium: false }).decisions));
test("Lichess and long usernames are retained", () => { const model = buildReportDecisionModel({ ...full, platform: "lichess" }); assert.equal(model.header.platform, "Lichess"); assert.equal(model.header.username, full.username); });
test("empty recommendation categories do not render empty decisions", () => assert.deepEqual(buildReportDecisionModel({ opening_recommendations: {} }).decisions, []));
test("insufficient evidence never becomes an avoid decision", () => assert.deepEqual(buildReportDecisionModel({ best_openings: [{ name: "Gambit", games: 2, fitScore: 90, verdict: "Avoid" }] }).decisions, []));
