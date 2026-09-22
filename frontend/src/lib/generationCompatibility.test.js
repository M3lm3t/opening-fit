import test from "node:test";
import assert from "node:assert/strict";
import { compatibleEvidenceGeneration } from "./generationCompatibility.js";
import { reportComparisonCompatibility } from "./reportComparison.js";
import { compareCompletedReports } from "./progressExperience.js";
import { buildOpeningFitScoreTransparency } from "./openingFitScoreTransparency.js";

test("Stage 6A comparisons reject legacy and missing versions in either direction", () => {
  const current = { repertoireHealth: { version: "repertoire_health_v4", score: 70 }, importedAt: "2026-09-20" };
  for (const version of [undefined, "openingfit_score_v1", "repertoire_health_v2", "repertoire_health_v3"]) {
    const previous = { score_contract: { formulaVersion: version, score: 60 }, importedAt: "2026-09-01" };
    const before = JSON.stringify(previous);
    for (const [a, b] of [[previous, current], [current, previous]]) {
      assert.equal(compatibleEvidenceGeneration(a, b), false);
      assert.equal(reportComparisonCompatibility(a, b).comparable, false);
    }
    assert.equal(compareCompletedReports([current, previous]).available, false);
    assert.equal(JSON.stringify(previous), before);
  }
  assert.equal(compatibleEvidenceGeneration(current, { score_contract: { formulaVersion: "repertoire_health_v4" } }), true);
});

test("new health contract displays stored components and preserves legacy values", () => {
  for (const version of ["repertoire_health_v3", "repertoire_health_v4"]) {
    const contract = { version, formulaVersion: version, score: 61.25, components: [{ key: "roleCompleteness", score: 61.25, effectiveWeight: 100, contribution: 61.25, available: true }] };
    const report = { repertoireHealth: contract };
    const before = JSON.stringify(report);
    const view = buildOpeningFitScoreTransparency({ report, previousReport: { repertoireHealth: { ...contract, version: "repertoire_health_v3" } } });
    assert.equal(view.formulaVersion, version);
    assert.equal(view.comparableMethodology, version === "repertoire_health_v3");
    assert.equal(JSON.stringify(report), before);
  }
});
