import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { answerOpeningConcept, attemptOpeningOpportunityMove, buildOpeningOpportunityDrill, createOpeningOpportunitySession, loadOpeningOpportunityProgress, saveOpeningOpportunityProgress, updateOpeningOpportunityProgress } from "./openingOpportunityDrills.js";

const opportunity = (overrides = {}) => ({ opportunityId: "opp-1", gameId: "game-1", openingId: "italian-game", side: "white", positionFen: new Chess().fen(), playedMove: "d4", recommendedMove: "e4", alternativeMoves: [], issueType: "intended_repertoire_move_missed", explanation: "Use the intended central move.", evidence: "Saved repertoire evidence.", confidence: 0.8, recurrenceCount: 2, source: "active_repertoire_line", ...overrides });

test("White opportunities orient the reused board as White", () => { assert.equal(buildOpeningOpportunityDrill(opportunity()).orientation, "white"); });
test("Black opportunities orient the reused board as Black", () => { const fen = new Chess().move("e4") && new Chess("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1").fen(); assert.equal(buildOpeningOpportunityDrill(opportunity({ side: "black", positionFen: fen, recommendedMove: "c5" })).orientation, "black"); });

test("line replay automatically applies the expected opponent reply", () => {
  const drill = buildOpeningOpportunityDrill(opportunity({ expectedMoves: ["e4", "e5", "Nf3"] }));
  const next = attemptOpeningOpportunityMove(drill, createOpeningOpportunitySession(drill), "e4");
  assert.deepEqual(next.opponentMoves, ["e5"]);
  assert.equal(new Chess(next.fen).turn(), "w");
  assert.equal(next.lineIndex, 2);
});

test("the supported repertoire move completes a position choice", () => { const drill = buildOpeningOpportunityDrill(opportunity()); const result = attemptOpeningOpportunityMove(drill, createOpeningOpportunitySession(drill), "e4"); assert.equal(result.success, true); assert.equal(result.completion, true); });
test("a legal but unsupported move receives constructive incorrect feedback", () => { const drill = buildOpeningOpportunityDrill(opportunity()); const result = attemptOpeningOpportunityMove(drill, createOpeningOpportunitySession(drill), "d4"); assert.equal(result.success, false); assert.match(result.feedback.error, /does not match/); assert.doesNotMatch(result.feedback.error, /terrible|blunder/i); });
test("an existing recognised transposition is accepted", () => { const drill = buildOpeningOpportunityDrill(opportunity({ alternativeMoves: ["Nc3"] })); const result = attemptOpeningOpportunityMove(drill, createOpeningOpportunitySession(drill), "Nc3"); assert.equal(result.success, true); assert.equal(result.feedback.transposition, true); });
test("a malformed position fails gracefully", () => { const drill = buildOpeningOpportunityDrill(opportunity({ positionFen: "not-a-fen" })); assert.equal(drill.valid, false); assert.match(drill.error, /not valid/); });
test("a malformed replay sequence fails without opening a broken board", () => { const drill = buildOpeningOpportunityDrill(opportunity({ drillType: "line_replay", expectedMoves: ["e4", "not-a-move"] })); assert.equal(drill.valid, false); assert.match(drill.error, /not legal/); });

test("concept answers stay hidden until an attempt or explicit reveal", () => {
  const drill = buildOpeningOpportunityDrill(opportunity({ recommendedMove: null, issueType: "delayed_castling" }));
  const session = createOpeningOpportunitySession(drill);
  assert.equal(drill.type, "concept_check");
  assert.equal(session.feedback, null);
  assert.equal(session.revealed, false);
  const answered = answerOpeningConcept(drill, session, drill.correctOptionId);
  assert.equal(answered.success, true);
  assert.equal(answered.completion, true);
});

test("completion progress persists attempts, success and last practised", () => {
  const drill = buildOpeningOpportunityDrill(opportunity());
  const session = attemptOpeningOpportunityMove(drill, createOpeningOpportunitySession(drill), "e4");
  const progress = updateOpeningOpportunityProgress({}, drill, session, new Date("2026-07-18T12:00:00Z"));
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  assert.equal(saveOpeningOpportunityProgress(progress, storage), true);
  assert.deepEqual(loadOpeningOpportunityProgress(storage), progress);
  assert.deepEqual(progress[drill.id], { attempts: 1, success: true, completion: true, lastPractised: "2026-07-18T12:00:00.000Z", repeatedFailure: false });
});

test("repeated failure remains tracked after later success", () => {
  const drill = buildOpeningOpportunityDrill(opportunity());
  let session = createOpeningOpportunitySession(drill);
  session = attemptOpeningOpportunityMove(drill, session, "d4");
  session = attemptOpeningOpportunityMove(drill, session, "Nf3");
  session = attemptOpeningOpportunityMove(drill, session, "c4");
  assert.equal(session.repeatedFailure, true);
  session = attemptOpeningOpportunityMove(drill, session, "e4");
  assert.equal(session.success, true);
  assert.equal(session.repeatedFailure, true);
});
