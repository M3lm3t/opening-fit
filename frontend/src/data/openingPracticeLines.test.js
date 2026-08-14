import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import {
  openingPracticePacks,
  resolveOpeningPracticePack,
  validateOpeningPracticeRegistry,
} from "./openingPracticeLines.js";

test("canonical opening practice registry has complete metadata and legal SAN lines", () => {
  const result = validateOpeningPracticeRegistry();
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.ok(result.packCount >= 60);
  assert.ok(result.lineCount >= 120);
  for (const pack of openingPracticePacks) {
    for (const line of pack.lines) {
      const game = new Chess();
      line.moves.forEach((move) => assert.ok(game.move(move), `${pack.packId}: ${move}`));
    }
  }
});

test("Queen's Pawn recommendations never resolve to an incompatible 1.e4 pack", () => {
  const result = resolveOpeningPracticePack({
    openingName: "Queen's Pawn Opening",
    repertoireRole: "white",
    playerColour: "white",
    initialMoveFamily: "d4",
    targetLine: "d4 d5 c4",
  });
  assert.equal(result.status, "ready");
  assert.equal(result.pack.initialMoveFamily, "d4");
  assert.equal(result.playerColour, undefined);
  assert.ok(result.pack.lines.every((line) => line.moves[0] === "d4"));
});

test("contradictory canonical subjects fail closed with only compatible alternatives", () => {
  const result = resolveOpeningPracticePack({
    openingName: "Italian Game",
    repertoireRole: "black_vs_d4",
    playerColour: "black",
    initialMoveFamily: "d4",
  });
  assert.equal(result.status, "missing");
  assert.equal(result.pack, null);
  assert.ok(result.compatibleAlternatives.length > 0);
  assert.ok(result.compatibleAlternatives.every((pack) =>
    pack.playerColour === "black" &&
    pack.initialMoveFamily === "d4" &&
    pack.compatibleRoles.includes("black_vs_d4")
  ));
});

test("partial substrings do not choose a plausible but unrelated pack", () => {
  assert.equal(resolveOpeningPracticePack("queen").pack, null);
  assert.equal(resolveOpeningPracticePack("game").pack, null);
});
