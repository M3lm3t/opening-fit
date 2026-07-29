import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { buildFreeTrainingExercise } from "./freeTrainingExercise.js";

const priority = {
  priorityId: "training-vienna",
  openingName: "Vienna Game",
  openingKey: "vienna-game",
  playerColour: "white",
  evidenceCount: 5,
  evidenceGameIds: ["game-own-2"],
  rationale: "Review the first repeated Vienna decision.",
};

test("the free exercise selects a valid position from canonical evidence", () => {
  const exercise = buildFreeTrainingExercise({
    openingTrainingOpportunities: [
      { opportunityId: "other", gameId: "game-other", openingId: "vienna-game", openingName: "Vienna Game", side: "white", positionFen: new Chess().fen(), recommendedMove: "e4", explanation: "General sample." },
      { opportunityId: "own", gameId: "game-own-2", openingId: "vienna-game", openingName: "Vienna Game", side: "white", positionFen: new Chess().fen(), recommendedMove: "e4", explanation: "Evidence position." },
    ],
    opening_games: [{ url: "game-own-2", opening: "Vienna Game" }],
  }, priority);

  assert.equal(exercise.kind, "own_game");
  assert.equal(exercise.opportunity.opportunityId, "own");
  assert.equal(exercise.sourceGameId, "game-own-2");
  assert.equal(exercise.drill.recommendedMove, "e4");
  assert.equal(exercise.drill.sourceGame.id, "game-own-2");
});

test("invalid or missing positions fall back without inventing a user-game position", () => {
  const exercise = buildFreeTrainingExercise({
    openingTrainingOpportunities: [{ opportunityId: "broken", gameId: "game-own-2", openingName: "Vienna Game", side: "white", positionFen: "invalid", recommendedMove: "e4" }],
  }, priority);

  assert.equal(exercise.kind, "general_setup");
  assert.equal(exercise.sourceGameId, null);
  assert.equal(exercise.drill.type, "concept_check");
  assert.equal(exercise.drill.generalSetup, true);
  assert.match(exercise.opportunity.evidence, /not claimed to come from one of your games/i);
});

test("an opportunity from another opening cannot masquerade as canonical evidence", () => {
  const exercise = buildFreeTrainingExercise({ openingTrainingOpportunities: [
    { opportunityId: "caro", gameId: "game-own-2", openingId: "caro-kann-defense", openingName: "Caro-Kann Defence", side: "white", positionFen: new Chess().fen(), recommendedMove: "e4" },
  ] }, priority);
  assert.equal(exercise.kind, "general_setup");
});

test("the free UI gates completion behind an actual exercise interaction", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../components/ThisWeekTrainingExperience.jsx", import.meta.url), "utf8");
  assert.match(source, /buildFreeTrainingExercise\(report \|\| \{\}, currentPriority\)/);
  assert.match(source, /<OpeningOpportunityDrill[\s\S]*?onEngaged=/);
  assert.match(source, /freeExerciseEngaged \? <button[\s\S]*?Complete this exercise/);
  assert.doesNotMatch(source, /Mark action complete/);
});
