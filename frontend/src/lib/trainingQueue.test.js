import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { buildFiniteSession, buildTrainingQueue, evaluateTrainingMove, trainingOutcome } from "./trainingQueue.js";

test("finite queue prioritises a repeated weak line", () => { const queue = buildTrainingQueue({ weak_lines: [{ opening: "Italian", games: 5, losses: 3, lossRate: 60, moveLine: "e4 e5 Nf3" }] }); assert.equal(queue[0].title, "Italian"); assert.ok(buildFiniteSession(queue).tasks.length <= 3); });
test("recurring opening opportunities enter the existing queue first", () => { const target = { opportunityId: "opp-1", openingId: "italian-game", recurrenceCount: 3, explanation: "Repeated repertoire deviation." }; const queue = buildTrainingQueue({ openingTrainingOpportunities: [target], weak_lines: [{ opening: "French", games: 5, losses: 3 }] }); assert.equal(queue[0].target, target); assert.match(queue[0].type, /Opening/); });
test("white and black moves are evaluated from the supplied position", () => { assert.equal(evaluateTrainingMove({ attempted: "e4", expected: "e4" }).accepted, true); const game = new Chess(); game.move("e4"); assert.equal(evaluateTrainingMove({ fen: game.fen(), attempted: "c5", expected: "c5" }).accepted, true); });
test("wrong, valid alternative, and invalid line data are safe", () => { assert.equal(evaluateTrainingMove({ attempted: "d4", expected: "e4" }).reason, "wrong"); assert.equal(evaluateTrainingMove({ attempted: "d4", expected: "e4", alternatives: ["d4"] }).alternative, true); assert.equal(evaluateTrainingMove({ attempted: "bad", expected: "e4" }).reason, "illegal"); });
test("training outcomes distinguish retry, reveal, and failure", () => { assert.equal(trainingOutcome({ attempts: 1 }), "correct_first_attempt"); assert.equal(trainingOutcome({ attempts: 2 }), "correct_after_retry"); assert.equal(trainingOutcome({ attempts: 5 }), "repeated_failure"); assert.equal(trainingOutcome({ attempts: 1, revealed: true }), "revealed"); });
test("missing report data produces an empty personalised queue", () => assert.deepEqual(buildTrainingQueue({}), []));
