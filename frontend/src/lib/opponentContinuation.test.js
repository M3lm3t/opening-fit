import test from "node:test";
import assert from "node:assert/strict";
import { buildMeaningfulOpponentResponsePrep, meaningfulOpponentContinuation } from "./opponentContinuation.js";

const game = (id, colour, moves, classificationPly = 4) => ({
  gameId: id,
  opening: colour === "white" ? "Vienna Game" : "Scandinavian Defence",
  playerColour: colour,
  playerResult: "win",
  classificationPly,
  moves,
  perspective: { role: colour === "white" ? "played_as_white" : "played_as_black", repertoireRole: colour === "white" ? "white" : "black_vs_e4", relationship: "played" },
});

test("meaningful continuation belongs to the opponent after the opening-defining moves", () => {
  const white = meaningfulOpponentContinuation(game("w", "white", ["e4", "e5", "Nc3", "Nf6", "f4", "d5"]));
  const black = meaningfulOpponentContinuation(game("b", "black", ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qd8"]));
  assert.deepEqual({ reply: white.reply, moveIndex: white.moveIndex }, { reply: "d5", moveIndex: 5 });
  assert.deepEqual({ reply: black.reply, moveIndex: black.moveIndex }, { reply: "Nc3", moveIndex: 4 });
  assert.notEqual(white.reply, "e5");
  assert.notEqual(black.reply, "e4");
});

test("response prep omits unclassified and non-repeated continuations and deduplicates game IDs", () => {
  const repeated = game("same", "white", ["e4", "e5", "Nc3", "Nf6", "f4", "d5"]);
  const rows = buildMeaningfulOpponentResponsePrep([
    repeated, repeated,
    game("second", "white", ["e4", "e5", "Nc3", "Nf6", "Bc4", "d5"]),
    game("thin", "white", ["e4", "e5", "Nc3", "Nf6", "g3", "Bc5"]),
    { ...game("unknown", "white", ["e4", "e5", "Nc3", "Nf6", "f4", "d5"]), classificationPly: null },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reply, "d5");
  assert.equal(rows[0].games, 2);
  assert.deepEqual(rows[0].gameIds, ["same", "second"]);
});
