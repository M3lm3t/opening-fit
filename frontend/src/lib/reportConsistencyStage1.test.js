import test from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_REPORT, canPersistReport } from "../fixtures/sampleReport.js";
import { canonicalResultAggregate, percentValue } from "./reportResults.js";
import { buildCanonicalReportPresentation, formatCanonicalScoreRate } from "./canonicalReportPresentation.js";
import { buildOpeningVerdictPresentation } from "./fitTrustModel.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { buildOpeningFitScoreTransparency, OPENINGFIT_SCORE_FORMULA } from "./openingFitScoreTransparency.js";
import { buildOpeningScorePresentation } from "../services/openingScorePresentation.js";
import { buildShareReportModel } from "./shareReportPresentation.js";
import { resolveReportEvidence, evidenceAction } from "./reportEvidence.js";

test("draw-inclusive result score, win rate and fit remain distinct across report surfaces", () => {
  const report = structuredClone(SAMPLE_REPORT);
  const before = JSON.stringify(report);
  const model = buildReportDecisionModel(report);
  const summary = buildPrimaryReportSummary(model, report);
  const canonical = buildCanonicalReportPresentation(report);
  const health = buildOpeningScorePresentation({ data: report });
  const share = buildShareReportModel(report);
  const opening = report.reportDecision.establishedStrength;
  const verdict = buildOpeningVerdictPresentation(opening);
  assert.equal(verdict.fit.score, 72);
  assert.equal(verdict.performance.score, 66.7);
  assert.match(verdict.performance.detail, /Win Rate 61.1%.*Score Rate 66.7%/);
  assert.equal(summary.keep.observed.scoreRate, "66.7% score");
  assert.equal(canonical.strength.scoreRate.toFixed(1), "66.7");
  assert.equal(model.repertoire.find(role => role.key === "white").performanceScore, 66.7);
  assert.match(health.factors.find(factor => factor.key === "results").text, /66.7% opening score across 18 games/);
  assert.doesNotMatch(JSON.stringify(health.factors), /72%/);
  const evidence = resolveReportEvidence(report, evidenceAction(opening, "priorities", report));
  assert.equal(canonicalResultAggregate(evidence.target).scoreRate, 66.7);
  assert.equal(share.best.name, summary.keep.opening);
  assert.equal(share.weakest.name, summary.repair.opening);
  assert.equal(share.training.title, summary.trainNext.title);
  assert.equal(share.trainingPriority?.priorityId, model.trainingPriority?.priorityId);
  assert.match(share.text, /66.7% score/);
  assert.match(share.text, /Verdict: Repair/);
  assert.doesNotMatch(share.text, /Legacy fit estimate|canonical report decision|repertoire_health_v/);
  assert.equal(JSON.stringify(report), before);
});

test("zero, small, missing and incomplete result samples do not invent a score", () => {
  for (const opening of [{}, { games: 0, scoreRate: 80 }, { games: 18, winRate: 61.1, fitScore: 72 }, { games: 18, wins: 11 }, { games: 18, wins: 11, draws: null, losses: 5 }, { games: 2, wins: 3, draws: 0, losses: 0 }]) {
    assert.equal(canonicalResultAggregate(opening).scoreRate, null);
    assert.equal(buildOpeningVerdictPresentation(opening).performance.score, null);
  }
  const small = { games: 2, wins: 1, draws: 1, losses: 0 };
  assert.equal(canonicalResultAggregate(small).scoreRate, 75);
  assert.equal(buildOpeningVerdictPresentation(small).confidence.level, "insufficient");
  assert.equal(canonicalResultAggregate({ games: 10, wins: 0, draws: 0, losses: 10 }).scoreRate, 0);
  assert.equal(canonicalResultAggregate({ games: 4, wins: 1, draws: 1, losses: 1, knownResults: 3 }).scoreRate, 50);
  assert.equal(percentValue("66.7%"), 66.7);
  assert.equal(percentValue("1%"), 1);
  assert.equal(formatCanonicalScoreRate(""), "Unavailable");
});

test("overall sufficiency is not inherited by a role with missing or low confidence", () => {
  const report = structuredClone(SAMPLE_REPORT);
  const entry = report.reportDecision.recommendations[0];
  delete entry.evidenceConfidence;
  delete entry.confidence;
  assert.equal(buildCanonicalReportPresentation(report).contexts[0].confidenceLabel, "Evidence unavailable");
  entry.evidenceConfidence = { level: "low", label: "Low confidence" };
  const presentation = buildCanonicalReportPresentation(report);
  assert.equal(presentation.reportConfidenceLabel, "Sufficient evidence");
  assert.equal(presentation.contexts[0].confidenceLabel, "Low confidence");
  const summary = buildPrimaryReportSummary(buildReportDecisionModel(SAMPLE_REPORT), SAMPLE_REPORT);
  assert.equal(summary.completenessLabel, "All core roles covered");
  assert.equal(summary.establishedRoleCount, 3);
  assert.match(summary.confidence, /Overall Evidence Confidence: Sufficient evidence/);
  assert.equal(summary.confidenceWarning, "");
  assert.doesNotMatch(summary.health.explanation, /need more qualifying games|not yet.*established/);
  assert.match(summary.repair.confidence, /Medium/i);
});

test("sample sharing stays explicitly fictional and real reports never borrow sample values", () => {
  assert.match(buildShareReportModel(SAMPLE_REPORT).text, /Illustrative example.*Fictional data/);
  assert.equal(canPersistReport(SAMPLE_REPORT), false);
  const real = { username: "Real player", gamesAnalysed: 0, reportDecision: { recommendations: [], confidence: { status: "insufficient" } } };
  const share = buildShareReportModel(real);
  assert.equal(share.sample, false);
  assert.equal(canPersistReport(real), true);
  assert.equal(share.best, null);
  assert.equal(share.weakest, null);
  assert.doesNotMatch(share.text, /Vienna|83\/100|Example Player|Fictional/);
});

test("missing health remains unavailable and nested report decisions take precedence", () => {
  for (const score of [null, undefined, ""]) {
    const report = { gamesAnalysed: 18, openingFitScore: 99, repertoireHealth: { version: "repertoire_health_v3", score } };
    assert.equal(buildReportDecisionModel(report).health.score, null);
    assert.equal(buildCanonicalReportPresentation(report).healthScore, null);
    assert.equal(buildOpeningScorePresentation({ data: report }).score, null);
    assert.equal(buildOpeningFitScoreTransparency({ report }).currentScore, null);
  }
  const report = { repertoireHealth: { score: 99 }, reportDecision: { repertoireHealth: { version: "repertoire_health_v3", score: 63 } } };
  assert.equal(buildReportDecisionModel(report).health.score, 63);
  assert.equal(buildOpeningScorePresentation({ data: report }).score, 63);
  assert.equal(buildOpeningFitScoreTransparency({ report }).currentScore, 63);
});

test("historical formula versions, stored scores, weights and contributions are preserved", () => {
  assert.deepEqual(OPENINGFIT_SCORE_FORMULA.map(row => row.weight), [22, 20, 20, 18, 12, 8]);
  for (const version of ["openingfit_score_v1", "repertoire_coverage_v2", "repertoire_coverage_v3", "repertoire_health_v2", "repertoire_health_v3"]) {
    const report = { gamesAnalysed: 30, repertoireHealth: { version, formulaVersion: version, score: 63.25, components: [{ key: "roleCompleteness", score: 63.25, effectiveWeight: 100, contribution: 63.25, available: true }] } };
    const before = JSON.stringify(report);
    const view = buildOpeningFitScoreTransparency({ report, previousReport: { repertoireHealth: { version: "different_version", score: 90 } } });
    assert.equal(view.formulaVersion, version);
    assert.equal(view.currentScore, 63);
    assert.equal(view.comparableMethodology, false);
    buildOpeningScorePresentation({ data: report });
    buildShareReportModel(report);
    assert.equal(JSON.stringify(report), before);
    if (version !== "openingfit_score_v1") assert.equal(view.components[0].contribution, 63.25);
  }
});
