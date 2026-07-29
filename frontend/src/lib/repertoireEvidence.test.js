import assert from "node:assert/strict";
import test from "node:test";

import { REPERTOIRE_EVIDENCE_REASON_CODES, evidenceFilterLabel, normaliseRepertoireRoleEvidence, repertoireRoleEvidenceCopy } from "./repertoireEvidence.js";

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
  assert.match(copy.explanation, /currently has 1 relevant game.*4 more games are needed/);
  assert.match(copy.requirement, /rapid.*4 more correctly attributed games.*Black-against-1\.d4/i);
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
  assert.match(copy.explanation, /8 qualifying games were distributed across 4 openings/);
  assert.match(copy.explanation, /Queen's Gambit Declined currently has 3 relevant games/);
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
  assert.match(filtered.explanation, /12 Black-against-1\.d4 games were found.*only 0 matched/i);
  assert.equal(none.reasonCode, "no_matching_games");
  assert.match(none.explanation, /No qualifying Black-against-1\.d4 games were found/i);
});

test("unclassified evidence reports only stored counts", () => {
  const copy = repertoireRoleEvidenceCopy({
    ...missingBlackD4(5, 0),
    evidenceFunnel: { passedReportFilters: 5, correctlyAttributed: 0, assignedToLeadingOpening: 0, openingUnclassified: 5 },
  });
  assert.equal(copy.reasonCode, "opening_unclassified");
  assert.match(copy.explanation, /5 qualifying games were found.*could not confidently attribute enough/i);
});

test("unknown legacy data uses the conservative fallback and never invents zero", () => {
  const copy = repertoireRoleEvidenceCopy({ key: "black_e4", label: "Black against 1.e4", status: "missing" });
  assert.equal(copy.reasonCode, "unsupported_or_unknown");
  assert.equal(copy.explanation, "OpeningFit does not yet have enough correctly attributed evidence to establish this role.");
  assert.deepEqual(copy.funnelRows, []);
  assert.doesNotMatch(copy.explanation, /0|no .* game was found/i);
});

test("irrelevant overall games cannot reduce a role-specific gap", () => {
  const slot = { ...missingBlackD4(5, 0), totalGamesAnalysed: 280, gamesImported: 311 };
  const copy = repertoireRoleEvidenceCopy(slot);
  assert.match(copy.requirement, /5 more correctly attributed games/);
  assert.doesNotMatch(`${copy.evidence} ${copy.requirement}`, /280|311/);
});

test("the impossible live split state falls back and remains diagnostic", () => {
  const copy = repertoireRoleEvidenceCopy({
    key: "black_e4",
    status: "missing",
    opening: "Caro-Kann Defense",
    evidenceReasonCode: "split_across_openings",
    evidenceFunnel: { correctlyAttributed: 84, assignedToLeadingOpening: 0, distinctAttributedOpenings: 4 },
    evidenceRequirement: { requiredColour: "black", opponentFirstMove: "1.e4", threshold: 5, additionalRelevantGamesRequired: 5 },
  });
  assert.equal(copy.reasonCode, "unsupported_or_unknown");
  assert.match(copy.explanation, /does not yet have enough correctly attributed evidence/i);
  assert.doesNotMatch(copy.explanation, /84|distributed|has 0|5 more/i);
  assert.deepEqual(copy.diagnostics, ["attributed_openings_missing_leading_count"]);
});

test("84 games across four recorded openings derive a real leading count", () => {
  const normalized = normaliseRepertoireRoleEvidence({
    key: "black_e4",
    status: "supported",
    opening: "Caro-Kann Defense",
    evidenceFunnel: {
      passedReportFilters: 84,
      correctlyAttributed: 84,
      distinctAttributedOpenings: 4,
      openingBreakdown: [
        { openingName: "Caro-Kann Defense", games: 30 },
        { openingName: "French Defense", games: 20 },
        { openingName: "Sicilian Defense", games: 18 },
        { openingName: "Pirc Defense", games: 16 },
      ],
    },
    evidenceRequirement: { threshold: 5, additionalRelevantGamesRequired: 0 },
  });
  assert.equal(normalized.leading, 30);
  assert.equal(normalized.opening, "Caro-Kann Defence");
  assert.equal(normalized.gamesNeeded, 0);
  assert.deepEqual(normalized.diagnostics, []);
});

test("missing leading count without a breakdown uses the conservative legacy fallback", () => {
  const copy = repertoireRoleEvidenceCopy({
    key: "black_e4",
    status: "missing",
    evidenceReasonCode: "split_across_openings",
    evidenceFunnel: { correctlyAttributed: 12, distinctAttributedOpenings: 3 },
    evidenceRequirement: { threshold: 5 },
  });
  assert.equal(copy.reasonCode, "unsupported_or_unknown");
  assert.doesNotMatch(copy.explanation, /12|3 openings|0/);
  assert.ok(copy.diagnostics.includes("attributed_openings_missing_leading_count"));
});

test("games needed and establishment use the same leading count and threshold", () => {
  const building = repertoireRoleEvidenceCopy({
    ...missingBlackD4(99, 3),
    evidenceRequirement: { ...missingBlackD4(99, 3).evidenceRequirement, threshold: 5, additionalRelevantGamesRequired: 2 },
  });
  assert.match(building.explanation, /2 more games are needed/);
  assert.match(building.requirement, /2 more correctly attributed games/);

  const established = repertoireRoleEvidenceCopy({
    ...missingBlackD4(0, 5), status: "supported", complete: true,
    evidenceRequirement: { ...missingBlackD4(0, 5).evidenceRequirement, threshold: 5, additionalRelevantGamesRequired: 0 },
  });
  assert.equal(established.established, true);
  assert.doesNotMatch(`${established.explanation} ${established.requirement}`, /more game|needed/);
});

test("a breakdown that exceeds candidate games triggers a conservative fallback", () => {
  const copy = repertoireRoleEvidenceCopy({
    key: "black_e4",
    status: "tentative",
    opening: "Caro-Kann Defense",
    evidenceFunnel: {
      importedCandidates: 5,
      passedReportFilters: 5,
      correctlyAttributed: 5,
      distinctAttributedOpenings: 2,
      openingBreakdown: [{ openingName: "Caro-Kann Defense", games: 4 }, { openingName: "French Defense", games: 3 }],
    },
    evidenceRequirement: { threshold: 5 },
  });
  assert.equal(copy.reasonCode, "unsupported_or_unknown");
  assert.ok(copy.diagnostics.includes("breakdown_exceeds_candidates"));
  assert.ok(copy.diagnostics.includes("breakdown_exceeds_attributed"));
});

test("opening names use British presentation spelling without changing the source value", () => {
  const slot = missingBlackD4(2, 3);
  slot.opening = "Sicilian Defense";
  const copy = repertoireRoleEvidenceCopy(slot);
  assert.match(copy.explanation, /Sicilian Defence/);
  assert.equal(slot.opening, "Sicilian Defense");
});
