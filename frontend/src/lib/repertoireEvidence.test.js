import assert from "node:assert/strict";
import test from "node:test";

import { evidenceFilterLabel, repertoireRoleEvidenceCopy } from "./repertoireEvidence.js";

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
      openingFamily: current ? "Queen's Gambit Declined" : null,
      timeControls: controls,
      currentRelevantSample: current,
      threshold: current + additional,
      additionalRelevantGamesRequired: additional,
    },
  };
}

test("missing roles state the exact colour, opponent move, filter and calculated gap", () => {
  const copy = repertoireRoleEvidenceCopy(missingBlackD4());
  assert.match(copy.requirement, /rapid games as Black against 1\.d4/);
  assert.match(copy.requirement, /4 more relevant examples are currently needed/);
  assert.match(copy.filters, /arbitrary games do not guarantee a diagnosis/i);
});

test("singular evidence requirements use singular grammar", () => {
  const copy = repertoireRoleEvidenceCopy(missingBlackD4(1, 4, ["rapid", "classical"]));
  assert.match(copy.requirement, /1 more relevant example is currently needed/);
  assert.equal(evidenceFilterLabel(missingBlackD4(1, 4, ["rapid", "classical"]).evidenceRequirement), "rapid, classical");
});

test("irrelevant overall games cannot reduce a role-specific gap", () => {
  const slot = { ...missingBlackD4(5, 0), totalGamesAnalysed: 280, gamesImported: 311 };
  const copy = repertoireRoleEvidenceCopy(slot);
  assert.match(copy.requirement, /5 more relevant examples/);
  assert.doesNotMatch(`${copy.evidence} ${copy.requirement}`, /280|311/);
});
