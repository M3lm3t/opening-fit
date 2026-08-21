import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildEvidenceSufficiency } from "./evidenceSufficiency.js";

test("graduated role evidence retains counts and next thresholds", () => {
  const report = { reportDecision: { evidenceHierarchy: { repertoireRole: [{ identity: "white", games: 3, confidence: { state: "limited", stateLabel: "Limited evidence", weightedGameEquivalent: 3, additionalRelevantGamesForDeveloping: 2, additionalRelevantGamesForStrong: 7, recommendationStrength: "observation_only" } }], analysisFailure: { failed: false } } } };
  const [role] = buildEvidenceSufficiency(report).roles;
  assert.deepEqual(role, { identity: "white", games: 3, state: "limited", label: "Limited evidence", weightedGames: 3, additionalForDeveloping: 2, additionalForStrong: 7, recommendationStrength: "observation_only" });
});

test("large imports with little usable evidence produce reconciliation warning", () => {
  const view = buildEvidenceSufficiency({ gameCounts: { fetchedGames: 280, gamesUsedForOpeningStats: 12, exclusionReasons: { parseFailure: 268 } } });
  assert.equal(view.warning, true);
  assert.equal(view.imported, 280);
  assert.equal(view.usable, 12);
});

test("systemic failure retains diagnostics and a Reanalyse action", () => {
  const view = buildEvidenceSufficiency({ reportDecision: { evidenceHierarchy: { analysisFailure: { failed: true, diagnosticReference: "evidence-123" } } } });
  assert.equal(view.systemicFailure, true);
  assert.equal(view.diagnosticReference, "evidence-123");
  const component = fs.readFileSync(fileURLToPath(new URL("../components/EvidenceSufficiencySummary.jsx", import.meta.url)), "utf8");
  assert.match(component, />Reanalyse</);
  assert.match(component, /additional relevant game/);
  assert.match(component, /Recommendation strength/);
});
