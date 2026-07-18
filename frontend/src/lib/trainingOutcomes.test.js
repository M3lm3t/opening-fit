import test from "node:test";
import assert from "node:assert/strict";
import { completedTrainingFocuses, evaluateTrainingOutcome, TRAINING_OUTCOME_THRESHOLDS } from "./trainingOutcomes.js";

const completedAt = "2026-06-01T12:00:00.000Z";
const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
const focus = {
  id: "focus-1",
  trainingFocusId: "focus-1",
  completedAt,
  openingId: "king's knight opening",
  positionFen: fen,
  recommendedMove: "Nc6",
  playedMove: "Qf6",
  beforeMetric: { applicationPercent: 20, sampleSize: 5 },
};

function game(id, reply = "Nc6", date = "2026-06-03T12:00:00.000Z", result = "win", opening = "King's Knight Opening") {
  return {
    id,
    played_at: date,
    opening,
    user_result: result,
    pgn: `[Event "Outcome"]\n[Date "2026.06.03"]\n[White "User"]\n[Black "Opponent"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 ${reply} 3. Bb5 a6 *`,
  };
}

test("improved requires two supported applications and enough later opening games", () => {
  const outcome = evaluateTrainingOutcome(focus, [game("a"), game("b"), game("c", "Nf6")]);
  assert.equal(outcome.status, "improved");
  assert.equal(outcome.correctApplicationCount, 2);
  assert.match(outcome.explanation, /successfully in two later games/i);
});

test("partially improved records mixed but positive application", () => {
  const outcome = evaluateTrainingOutcome(focus, [game("a"), game("b", "Nf6"), game("c", "Nf6")]);
  assert.equal(outcome.status, "partially_improved");
});

test("not improved requires the same supported mistake to recur twice", () => {
  const outcome = evaluateTrainingOutcome(focus, [game("a", "Qf6"), game("b", "Qf6"), game("c", "Nf6")]);
  assert.equal(outcome.status, "not_improved");
  assert.equal(outcome.repeatedMistakeCount, 2);
  assert.match(outcome.explanation, /same issue occurred again/i);
});

test("not encountered is distinct from failure", () => {
  const outcome = evaluateTrainingOutcome(focus, [game("a", "Nc6", undefined, "win", "French Defence")]);
  assert.equal(outcome.status, "not_encountered");
  assert.equal(outcome.repeatedMistakeCount, 0);
  assert.match(outcome.explanation, /has not appeared again/i);
});

test("insufficient data prevents a one-game improvement claim", () => {
  const outcome = evaluateTrainingOutcome(focus, [game("a")]);
  assert.equal(outcome.status, "insufficient_data");
  assert.match(outcome.explanation, /not enough evidence/i);
});

test("games on or before completion and unrelated openings are excluded", () => {
  const outcome = evaluateTrainingOutcome(focus, [
    game("before", "Qf6", "2026-06-01T11:59:59.000Z"),
    game("same-time", "Qf6", completedAt),
    game("unrelated", "Qf6", "2026-06-04T12:00:00.000Z", "loss", "French Defence"),
  ]);
  assert.equal(outcome.laterGameCount, 0);
  assert.equal(outcome.status, "not_encountered");
});

test("opening result metric stays hidden below its separate threshold", () => {
  const four = [game("a"), game("b"), game("c"), game("d")];
  assert.equal(evaluateTrainingOutcome(focus, four).afterMetric.openingResultPercent, null);
  assert.equal(evaluateTrainingOutcome(focus, [...four, game("e", "Nf6", undefined, "loss")]).afterMetric.openingResultPercent, 80);
  assert.equal(TRAINING_OUTCOME_THRESHOLDS.minimumOpeningResultGames, 5);
});

test("completed focuses use task completion and fall back to plan completion for legacy plans", () => {
  const focuses = completedTrainingFocuses([{ completedAt, targetMetric: { openingId: "Italian Game" }, tasks: [{ id: "done", status: "completed" }, { id: "todo", status: "pending" }] }]);
  assert.equal(focuses.length, 1);
  assert.equal(focuses[0].completedAt, completedAt);
});
