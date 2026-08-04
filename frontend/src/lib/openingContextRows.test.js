import test from "node:test";
import assert from "node:assert/strict";
import { evidenceGapCategory, mergeOpeningContextRows, shouldShowEvidenceGap } from "./openingContextRows.js";

test("duplicate opening/context rows merge deterministically by unique game ID", () => {
  const rows = mergeOpeningContextRows([
    { openingName: "King's Indian Defence", context: "black_vs_d4", relationship: "played_by_user", games: 9, supportingGameIds: Array.from({ length: 9 }, (_, index) => `kid-${index}`), variation: "Normal" },
    { openingName: "King's Indian Defense", context: "black_vs_d4", relationship: "played_by_user", games: 7, supportingGameIds: Array.from({ length: 7 }, (_, index) => `kid-${index}`), variation: "Fianchetto" },
  ], { normaliseName: (name) => name.toLowerCase().replace("defence", "defense") });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].games, 9);
  assert.equal(rows[0].supportingGameIds.length, 9);
  assert.deepEqual(rows[0].variationLabels, ["Normal", "Fianchetto"]);
});

test("the same family remains separate across played and faced contexts", () => {
  const rows = mergeOpeningContextRows([
    { openingName: "Scandinavian Defence", context: "black_vs_e4", relationship: "played_by_user", games: 78 },
    { openingName: "Scandinavian Defence", context: "played_as_white", relationship: "faced_by_user", games: 94 },
  ]);
  assert.equal(rows.length, 2);
});

test("diagnosis type participates in identity and merged rows have stable context ordering", () => {
  const rows = mergeOpeningContextRows([
    { openingId: "nimzo", openingName: "Nimzo-Indian Defence", context: "black_vs_d4", diagnosisType: "mixed_signal", supportingGameIds: ["n-2"] },
    { openingId: "nimzo", openingName: "Nimzo-Indian Defence", context: "black_vs_d4", diagnosisType: "evidence_gap", supportingGameIds: ["n-1", "n-1"] },
    { openingId: "nimzo", openingName: "Nimzo-Indian Defence", context: "black_vs_d4", diagnosisType: "evidence_gap", supportingGameIds: ["n-1"] },
    { openingId: "kid", openingName: "King's Indian Defence", context: "black_vs_e4", diagnosisType: "evidence_gap", supportingGameIds: ["k-1"] },
  ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.context), ["black_vs_d4", "black_vs_d4", "black_vs_e4"]);
  assert.equal(rows.find((row) => row.diagnosisType === "evidence_gap" && row.openingId === "nimzo").supportingGameIds.length, 1);
});

test("large samples are never labelled small and faced evidence does not become a repertoire gap", () => {
  const opening = { openingName: "Scandinavian Defence", games: 94, relationship: "faced_by_user", evidenceStatus: "sufficient" };
  assert.equal(evidenceGapCategory(opening), "Sufficient evidence but mixed performance");
  assert.equal(shouldShowEvidenceGap(opening), false);
  assert.equal(evidenceGapCategory({ games: 2, evidenceStatus: "insufficient" }), "Small sample");
  assert.equal(evidenceGapCategory({ games: 94, evidenceStatus: "insufficient" }), "Context uncertain");
});

test("evidence gaps retain specific classification reasons", () => {
  assert.equal(evidenceGapCategory({ games: 12, evidenceReasonCode: "role_attribution_unresolved" }), "Context uncertain");
  assert.equal(evidenceGapCategory({ games: 12, classificationIssue: "mixed transposition" }), "Mixed/transpositional classification");
  assert.equal(evidenceGapCategory({ games: 12, evidenceReasonCode: "opening_unclassified" }), "Missing move data");
});
