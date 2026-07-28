import test from "node:test";
import assert from "node:assert/strict";
import { buildOpeningFitScoreTransparency, openingFitDevelopmentState, OPENINGFIT_SCORE_FORMULA, OPENINGFIT_SCORE_MINIMUM_GAMES } from "./openingFitScoreTransparency.js";

const breakdown = { stability: 78, whitePerformance: 64, blackPerformance: 58, confidence: 82, weaknessControl: 70, recentConsistency: 72 };
const model = { header: { games: 30 }, health: { score: 68, confidence: "High confidence" } };

test("score exposes real weighted formula inputs and separate report coverage", () => {
  const view = buildOpeningFitScoreTransparency({ model, report: { openingFitScoreBreakdown: breakdown } });
  assert.equal(view.currentScore, 68);
  assert.equal(view.coverage, "Broad report coverage");
  assert.equal(view.provisional, false);
  assert.deepEqual(view.components.map((item) => item.key), OPENINGFIT_SCORE_FORMULA.map((item) => item.key));
  assert.equal(view.components.reduce((sum, item) => sum + item.weight, 0), 100);
  assert.match(view.meaning, /not a chess rating/i);
  assert.deepEqual(view.scale, { minimum: 0, maximum: 100 });
});

test("a medium score explains why one supported role can coexist with no weakness", () => {
  const view = buildOpeningFitScoreTransparency({
    model: { header: { games: 12 }, health: { score: 63 }, authoritative: { establishedStrength: { opening: "Vienna Game" }, primaryProblem: null } },
    report: { openingFitScoreBreakdown: breakdown },
  });
  assert.match(view.weaknessContext, /63\/100.*Vienna Game.*other roles remain incomplete/i);
  assert.equal(view.developmentState.label, "Developing repertoire");
  assert.equal(view.contributors.length, 3);
});

test("score-state bands describe development without changing stored values", () => {
  assert.equal(openingFitDevelopmentState(44).label, "Building repertoire");
  assert.equal(openingFitDevelopmentState(63).label, "Developing repertoire");
  assert.equal(openingFitDevelopmentState(70).label, "Solid repertoire");
  assert.equal(openingFitDevelopmentState(82).label, "Strong repertoire");
  assert.equal(openingFitDevelopmentState(93).label, "Excellent repertoire coverage");
});

test("63 with an identifiable weakness names the repair context without changing the score", () => {
  const view = buildOpeningFitScoreTransparency({
    model: { header: { games: 28 }, health: { score: 63 }, authoritative: { primaryProblem: { opening: "French Defence" }, establishedStrength: { opening: "Ruy Lopez" } } },
    report: { openingFitScoreBreakdown: { ...breakdown, weaknessControl: 46 } },
  });
  assert.equal(view.currentScore, 63);
  assert.equal(view.developmentState.label, "Developing repertoire");
  assert.match(view.weaknessContext, /reliable opening weakness was found.*specific repair target/i);
  assert.ok(view.contributors.some((item) => item.key === "weaknessControl"));
});

test("high score and moderate low-sample states keep confidence separate from development", () => {
  const strong = buildOpeningFitScoreTransparency({
    model: { header: { games: 60 }, health: { score: 88, confidence: "Broad report coverage" } },
    report: { openingFitScoreBreakdown: { stability: 91, whitePerformance: 87, blackPerformance: 86, confidence: 95, weaknessControl: 90, recentConsistency: 82 } },
  });
  assert.equal(strong.developmentState.label, "Strong repertoire");
  assert.equal(strong.statusLabel, "Broad report coverage");

  const lowSample = buildOpeningFitScoreTransparency({
    model: { header: { games: 4 }, health: { score: 63, confidence: "Low confidence" } },
    report: { openingFitScoreBreakdown: { ...breakdown, confidence: 18 } },
  });
  assert.equal(lowSample.developmentState.label, "Developing repertoire");
  assert.equal(lowSample.statusLabel, "Provisional score");
  assert.match(lowSample.smallSamples, /Fewer than 5 classified games/i);
});

test("fewer than the minimum games visibly marks the score provisional", () => {
  const view = buildOpeningFitScoreTransparency({ model: { header: { games: 3 }, health: { score: 42, confidence: "Low confidence" } }, report: { openingFitScoreBreakdown: { ...breakdown, confidence: 20 } } });
  assert.equal(view.provisional, true);
  assert.equal(view.statusLabel, "Provisional score");
  assert.match(view.smallSamples, new RegExp(`Fewer than ${OPENINGFIT_SCORE_MINIMUM_GAMES}`));
});

test("missing component data does not invent a breakdown", () => {
  const view = buildOpeningFitScoreTransparency({ model, report: {} });
  assert.equal(view.hasComponentData, false);
  assert.deepEqual(view.components, []);
  assert.match(view.affects, /older report.*not a compatible component breakdown/i);
});

test("previous-score comparison identifies the largest weighted component change", () => {
  const view = buildOpeningFitScoreTransparency({
    model,
    report: { openingFitScoreBreakdown: breakdown },
    previousReport: { openingfit_score: 62, score_components: { ...breakdown, stability: 50, whitePerformance: 63 } },
  });
  assert.equal(view.previousScore, 62);
  assert.match(view.reasonForChange, /familiarity.*increased from 50 to 78/i);
});

test("main score surfaces reuse the central development-state helper", async () => {
  const { readFile } = await import("node:fs/promises");
  const progressSource = await readFile(new URL("../services/openingScorePresentation.js", import.meta.url), "utf8");
  const summarySource = await readFile(new URL("../components/PrimaryReportSummary.jsx", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const diagnosisSource = await readFile(new URL("../components/OpeningFitDiagnosisFirst.jsx", import.meta.url), "utf8");
  const methodologySource = await readFile(new URL("../components/PublicTrustPage.jsx", import.meta.url), "utf8");
  assert.match(progressSource, /openingFitDevelopmentState\(score\)\.label/);
  assert.match(summarySource, /scoreView\.developmentState\.label/);
  for (const source of [appSource, diagnosisSource, methodologySource]) {
    assert.match(source, /Repertoire coverage/i);
    assert.doesNotMatch(source, /Opening\s*Fit Score/i);
  }
});
