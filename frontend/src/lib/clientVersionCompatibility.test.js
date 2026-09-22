import test from "node:test";
import assert from "node:assert/strict";
import { buildOpeningFitScoreTransparency } from "./openingFitScoreTransparency.js";
import { compatibleEvidenceGeneration, decisionVersionStatus } from "./generationCompatibility.js";
import { normaliseReportDecision } from "./recommendationEvidence.js";

test("missing and unknown calculation versions preserve stored values without assuming legacy arithmetic", () => {
  for (const version of [undefined, "repertoire_health_v99"]) {
    const report = { repertoireHealth: { version, score: 82.68, components: [{ key: "roleCompleteness", score: 100, weight: 35 }] }, openingFitScoreBreakdown: { stability: 100 } };
    const before = JSON.stringify(report);
    const view = buildOpeningFitScoreTransparency({ report, previousReport: report });
    assert.equal(view.currentScore, 83);
    assert.equal(view.components.length, 0);
    assert.equal(view.comparableMethodology, false);
    assert.match(view.meaning, /missing or unsupported/);
    assert.doesNotMatch(view.meaning + view.whyChange, /legacy/);
    assert.equal(JSON.stringify(report), before);
    assert.equal(compatibleEvidenceGeneration(report, report), false);
  }
});

test("supported generations remain explicit and differing versions cannot compare", () => {
  for (const version of ["repertoire_health_v3", "repertoire_health_v4"]) {
    const report = { repertoireHealth: { version, score: 70, components: [{ key: "roleCompleteness", score: 100, effectiveWeight: 35, contribution: 35 }] } };
    assert.equal(buildOpeningFitScoreTransparency({ report }).components.length, 1);
    assert.equal(compatibleEvidenceGeneration(report, report), true);
  }
  assert.equal(compatibleEvidenceGeneration({ repertoireHealth: { version: "repertoire_health_v3" } }, { repertoireHealth: { version: "repertoire_health_v4" } }), false);
});

test("unknown decisions cannot authorise a current training recommendation", () => {
  const decision = { version: "report_decision_v99", primaryProblem: { opening: "Unknown policy target" }, recommendations: [], primaryAction: { type: "repair_repertoire" } };
  const before = JSON.stringify(decision);
  const view = normaliseReportDecision(decision);
  assert.equal(view.versionSupport, "unsupported");
  assert.equal(view.primaryProblem, null);
  assert.equal(view.nextTrainingAction.type, "review_report_version");
  assert.equal(JSON.stringify(decision), before);
  assert.equal(decisionVersionStatus({ version: "report_decision_v7" }), "supported");
  assert.equal(decisionVersionStatus({}), "missing");
});
