import assert from "node:assert/strict";
import test from "node:test";

import { REPERTOIRE_EVIDENCE_REASON_CODES, evidenceFilterLabel, repertoireRoleEvidenceCopy } from "./repertoireEvidence.js";

function missingBlackD4(additional = 4, current = 1, controls = ["rapid"]) {
  return {
    key: "black_d4",
    label: "Black against 1.d4",
    status: current ? "tentative" : "missing",
    games: current,
    opening: current ? "Queen's Gambit Declined" : null,
    evidenceRequirement: {
      requiredRole: "played_as_black",
      requiredColour: "black",
      opponentFirstMove: "1.d4",
      timeControls: controls,
      currentRelevantSample: current,
      threshold: current + additional,
      additionalRelevantGamesRequired: additional,
    },
  };
}

test("the reason-code contract stays small and explicit", () => {
  assert.deepEqual(REPERTOIRE_EVIDENCE_REASON_CODES, [
    "no_matching_games", "filtered_by_time_control", "outside_date_window", "opening_unclassified",
    "split_across_openings", "below_evidence_threshold", "unsupported_or_unknown",
  ]);
});

test("below-threshold roles state the exact filter, role and remaining requirement", () => {
  const copy = repertoireRoleEvidenceCopy(missingBlackD4());
  assert.equal(copy.reasonCode, "below_evidence_threshold");
  assert.match(copy.explanation, /1 of the 5 correctly attributed games/);
  assert.match(copy.requirement, /rapid.*4 more correctly attributed games.*Black-versus-1\.d4/i);
});

test("singular evidence requirements use singular grammar", () => {
  const copy = repertoireRoleEvidenceCopy(missingBlackD4(1, 4, ["rapid", "classical"]));
  assert.match(copy.requirement, /1 more correctly attributed game is required/);
  assert.equal(evidenceFilterLabel(missingBlackD4(1, 4, ["rapid", "classical"]).evidenceRequirement), "rapid, classical");
});

test("split evidence reports the qualifying total instead of zero games", () => {
  const copy = repertoireRoleEvidenceCopy({
    ...missingBlackD4(2, 3),
    evidenceReasonCode: "split_across_openings",
    evidenceFunnel: { correctlyAttributed: 8, assignedToLeadingOpening: 3, distinctAttributedOpenings: 4 },
  });
  assert.equal(copy.reasonCode, "split_across_openings");
  assert.match(copy.explanation, /8 qualifying games were split across 4 openings/);
  assert.doesNotMatch(copy.explanation, /zero|no qualifying game/i);
});

test("time-control filtering is distinguished from no imported games", () => {
  const filtered = repertoireRoleEvidenceCopy({
    ...missingBlackD4(5, 0),
    evidenceFunnel: { importedCandidates: 12, passedReportFilters: 0, filteredByTimeControl: 12, correctlyAttributed: 0, assignedToLeadingOpening: 0 },
  });
  const none = repertoireRoleEvidenceCopy({
    ...missingBlackD4(5, 0),
    evidenceFunnel: { importedCandidates: 0, passedReportFilters: 0, correctlyAttributed: 0, assignedToLeadingOpening: 0 },
  });
  assert.equal(filtered.reasonCode, "filtered_by_time_control");
  assert.match(filtered.explanation, /12 Black-versus-1\.d4 games were found.*none matched/i);
  assert.equal(none.reasonCode, "no_matching_games");
  assert.match(none.explanation, /No Black-versus-1\.d4 game was found/i);
});

test("unclassified evidence reports only stored counts", () => {
  const copy = repertoireRoleEvidenceCopy({
    ...missingBlackD4(5, 0),
    evidenceFunnel: { passedReportFilters: 5, correctlyAttributed: 0, assignedToLeadingOpening: 0, openingUnclassified: 5 },
  });
  assert.equal(copy.reasonCode, "opening_unclassified");
  assert.match(copy.explanation, /5 games could not be assigned confidently/);
});

test("unknown legacy data uses the conservative fallback and never invents zero", () => {
  const copy = repertoireRoleEvidenceCopy({ key: "black_e4", label: "Black against 1.e4", status: "missing" });
  assert.equal(copy.reasonCode, "unsupported_or_unknown");
  assert.equal(copy.explanation, "OpeningFit does not yet have enough correctly attributed games for this role.");
  assert.deepEqual(copy.funnelRows, []);
  assert.doesNotMatch(copy.explanation, /0|no .* game was found/i);
});

test("irrelevant overall games cannot reduce a role-specific gap", () => {
  const slot = { ...missingBlackD4(5, 0), totalGamesAnalysed: 280, gamesImported: 311 };
  const copy = repertoireRoleEvidenceCopy(slot);
  assert.match(copy.requirement, /5 more correctly attributed games/);
  assert.doesNotMatch(`${copy.evidence} ${copy.requirement}`, /280|311/);
});
