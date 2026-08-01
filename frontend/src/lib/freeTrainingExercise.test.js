import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { buildFreeTrainingExercise, explainTrainingPriority } from "./freeTrainingExercise.js";
import { attemptOpeningOpportunityMove, createOpeningOpportunitySession, normalizeExerciseProvenance } from "./openingOpportunityDrills.js";

const sourceUrl = "https://www.chess.com/game/live/123456789";
const pgn = `[Event "Live Chess"]
[Site "${sourceUrl}"]
[Date "2026.07.20"]
[White "ReportPlayer"]
[Black "PracticeOpponent"]
[Result "1-0"]

1. e4 c6 2. d4 d5 3. Nc3 dxe4 1-0`;
const beforeWhiteMoveTwo = (() => {
  const chess = new Chess();
  chess.move("e4");
  chess.move("c6");
  return chess.fen();
})();
const priority = {
  priorityId: "training-caro",
  openingName: "Caro-Kann Defence",
  openingKey: "caro-kann-defense",
  playerColour: "white",
  role: "faced_as_white",
  actionType: "prepare_against",
  confidenceStatus: "sufficient",
  evidenceCount: 10,
  evidenceGameIds: [sourceUrl],
};
const ownOpportunity = {
  opportunityId: "own-caro",
  gameId: sourceUrl,
  openingId: "caro-kann-defense",
  openingName: "Caro-Kann Defence",
  side: "white",
  moveNumber: 2,
  positionFen: beforeWhiteMoveTwo,
  recommendedMove: "d4",
  explanation: "Review the central decision before choosing a variation-specific plan.",
};
const ownReport = {
  username: "ReportPlayer",
  platform: "chess.com",
  openingTrainingOpportunities: [ownOpportunity],
  recentGames: [{ url: sourceUrl, pgn, white_username: "ReportPlayer", black_username: "PracticeOpponent", opening: "Caro-Kann Defence", result: "1-0", played_at: "2026-07-20T12:00:00Z" }],
};

test("a validated own-game position exposes source metadata without a generic disclaimer", () => {
  const exercise = buildFreeTrainingExercise(ownReport, priority);
  assert.equal(exercise.kind, "own_game_position");
  assert.equal(exercise.provenance.kind, "own_game_position");
  assert.equal(exercise.provenance.disclaimer, "");
  assert.equal(exercise.drill.sourceGame.opponent, "PracticeOpponent");
  assert.equal(exercise.drill.sourceGame.moveNumber, 2);
  assert.equal(exercise.drill.sourceGame.url, sourceUrl);
});

test("a canonical diagnosis drives the own-game FEN, orientation and evidence without inventing a best move", () => {
  const diagnosis = {
    version: "opening_diagnosis_v1",
    diagnosisId: "diagnosis:caro-position",
    opening: "Caro-Kann Defence",
    playerColour: "white",
    precisionLevel: "exact_position",
    positionFen: beforeWhiteMoveTwo,
    targetPly: 2,
    targetMoveNumber: 2,
    representativeGameId: sourceUrl,
    representativeGameIds: [sourceUrl],
    supportingGameIds: [sourceUrl],
    repeatedContinuation: { move: "d4", games: 2, source: "repeated_personal_continuation" },
    evidenceSummary: "Two distinct supporting games reproduce this position.",
    userFacingDiagnosis: "You reached this position twice and chose different continuations.",
  };
  const canonicalPriority = {
    ...priority,
    schemaVersion: 3,
    representativeSelectionRequired: true,
    representativeGameIds: [sourceUrl],
    openingDiagnosis: diagnosis,
    diagnosisId: diagnosis.diagnosisId,
    positionFen: diagnosis.positionFen,
  };
  const report = { ...ownReport, openingTrainingOpportunities: [], analysisGameIndex: ownReport.recentGames };
  const exercise = buildFreeTrainingExercise(report, canonicalPriority);

  assert.equal(exercise.kind, "own_game_position");
  assert.equal(exercise.opportunity.diagnosisId, diagnosis.diagnosisId);
  assert.equal(exercise.drill.orientation, "white");
  assert.equal(exercise.drill.initialFen.split(" ").slice(0, 4).join(" "), diagnosis.positionFen.split(" ").slice(0, 4).join(" "));
  assert.equal(exercise.drill.sourceGame.id, sourceUrl);
  assert.equal(exercise.drill.type, "position_review");
  assert.equal(exercise.drill.recommendedMove, null);
  assert.deepEqual(exercise.drill.expectedMoves, []);
  assert.doesNotMatch(exercise.drill.explanation, /best|winning|losing|blunder/i);
  const completed = attemptOpeningOpportunityMove(exercise.drill, createOpeningOpportunitySession(exercise.drill), "d4");
  assert.equal(completed.completion, true);
  assert.match(completed.feedback.why, /legal move to test.*not labelled best/i);
});

test("an exact trusted catalogue continuation is rehearsed with its source intact", () => {
  const diagnosis = {
    version: "opening_diagnosis_v1", diagnosisId: "diagnosis:caro-catalogue", opening: "Caro-Kann Defence",
    playerColour: "white", precisionLevel: "exact_position", positionFen: beforeWhiteMoveTwo,
    targetPly: 2, targetMoveNumber: 2, representativeGameId: sourceUrl, representativeGameIds: [sourceUrl],
    supportingGameIds: [sourceUrl], authoritativeContinuation: { move: "d4", source: "opening_reference_line", sourceLabel: "existing opening catalogue" },
    evidenceSummary: "Two distinct supporting games reproduce this position.", userFacingDiagnosis: "Review the repeated position.",
  };
  const exercise = buildFreeTrainingExercise(
    { ...ownReport, openingTrainingOpportunities: [], analysisGameIndex: ownReport.recentGames },
    { ...priority, schemaVersion: 3, representativeSelectionRequired: true, representativeGameIds: [sourceUrl], openingDiagnosis: diagnosis, diagnosisId: diagnosis.diagnosisId },
  );

  assert.equal(exercise.drill.type, "position_choice");
  assert.equal(exercise.drill.recommendedMove, "d4");
  assert.equal(exercise.opportunity.source, "opening_reference_line");
  assert.equal(attemptOpeningOpportunityMove(exercise.drill, createOpeningOpportunitySession(exercise.drill), "d4").completion, true);
});

test("a general setup has a conservative disclaimer and no source link", () => {
  const exercise = buildFreeTrainingExercise({}, priority);
  assert.equal(exercise.kind, "general_opening_setup");
  assert.equal(exercise.drill.sourceGame, null);
  assert.match(exercise.provenance.disclaimer, /illustrative.*not claimed/i);
});

test("a canonical priority without a verified representative never borrows another opening's game", () => {
  const canonical = { ...priority, schemaVersion: 2, representativeGameIds: [], representativeSelectionRequired: true };
  const unrelated = { ...ownOpportunity, gameId: "queen-game", openingId: "queens-gambit", openingName: "Queen's Gambit" };
  const exercise = buildFreeTrainingExercise({ ...ownReport, openingTrainingOpportunities: [unrelated] }, canonical);

  assert.equal(exercise.kind, "general_opening_setup");
  assert.equal(exercise.drill.sourceGame, null);
  assert.match(exercise.provenance.disclaimer, /not claimed/i);
});

test("incomplete or unverifiable own-game data degrades to general setup", () => {
  for (const broken of [
    { ...ownOpportunity, moveNumber: null },
    { ...ownOpportunity, positionFen: new Chess().fen() },
    { ...ownOpportunity, gameId: "missing-game" },
  ]) {
    const provenance = normalizeExerciseProvenance(broken, ownReport);
    assert.equal(provenance.kind, "general_opening_setup");
    assert.equal(provenance.sourceGame, null);
  }
});

test("an own-game position never exposes an unvalidated source URL", () => {
  const report = { ...ownReport, recentGames: [{ ...ownReport.recentGames[0], url: "https://example.com/not-a-chess-game", gameId: sourceUrl }] };
  const provenance = normalizeExerciseProvenance(ownOpportunity, report);
  assert.equal(provenance.kind, "own_game_position");
  assert.equal(provenance.sourceGame.url, "");
});

test("legacy ambiguous provenance defaults to the least-assertive state", () => {
  assert.equal(normalizeExerciseProvenance({ gameId: sourceUrl }, ownReport).kind, "general_opening_setup");
});

test("fictional example exercises can never belong to the visitor", () => {
  const exercise = buildFreeTrainingExercise({ ...ownReport, sampleMode: true, source: "sample_fixture" }, priority);
  assert.equal(exercise.kind, "general_opening_setup");
  assert.equal(exercise.provenance.fictional, true);
  assert.match(exercise.provenance.label, /fictional/i);
  assert.equal(exercise.drill.sourceGame, null);
});

test("training-priority wording separates preparation, weakness and insufficient evidence", () => {
  const preparation = explainTrainingPriority({}, priority);
  assert.equal(preparation.kind, "preparation_opportunity");
  assert.match(preparation.text, /faced.*10 times/i);
  assert.doesNotMatch(preparation.text, /reliable weakness/i);

  const noWeakness = explainTrainingPriority({ reportDecision: { primaryProblem: null } }, { ...priority, confidenceStatus: "unknown" });
  assert.equal(noWeakness.kind, "preparation_opportunity");
  assert.match(noWeakness.text, /preparation, not a weakness claim/i);

  const weakness = explainTrainingPriority({ reportDecision: { primaryProblem: { opening: "French Defence", sample: { games: 8 } } } }, { ...priority, openingName: "French Defence", openingKey: "french-defense", role: "played_as_black", actionType: "repair_repertoire", evidenceCount: 8 });
  assert.equal(weakness.kind, "reliable_weakness");
  assert.match(weakness.text, /repair priority/i);

  const insufficient = explainTrainingPriority({}, { ...priority, role: "played_as_white", confidenceStatus: "insufficient_evidence", fallback: true });
  assert.equal(insufficient.kind, "insufficient_evidence");
  assert.doesNotMatch(insufficient.text, /repair priority/i);
});

test("the general Caro-Kann exercise teaches a concrete concept with plausible alternatives", () => {
  const exercise = buildFreeTrainingExercise({}, priority);
  assert.match(exercise.drill.prompt, /Caro-Kann variation unknown/i);
  assert.match(exercise.drill.plan, /develop.*castle/i);
  assert.equal(exercise.drill.conceptOptions.length, 3);
  assert.ok(exercise.drill.conceptOptions.every((option) => option.explanation));
  assert.doesNotMatch(JSON.stringify(exercise.drill.conceptOptions), /copy the opponent|queen first|recorded development plan/i);
});

test("a recoverable PGN grounds the concept in only its recorded opening moves", () => {
  const exchangePgn = `[Event "Fixture"]\n[White "ReportPlayer"]\n[Black "PracticeOpponent"]\n[Result "1/2-1/2"]\n\n1. e4 c6 2. Nc3 d5 3. exd5 cxd5 4. d4 1/2-1/2`;
  const exercise = buildFreeTrainingExercise({ username: "ReportPlayer", games: [{ gameId: "known", opening: "Caro-Kann Defense", colour: "white", pgn: exchangePgn }] }, priority);
  assert.equal(exercise.kind, "general_opening_setup");
  assert.equal(exercise.drill.openingName, "Caro-Kann Defence");
  assert.equal(exercise.drill.knownLine, "1.e4 c6 2.Nc3 d5 3.exd5 cxd5 4.d4");
  assert.match(exercise.drill.prompt, /supplied game.*1\.e4 c6/i);
  assert.match(exercise.drill.answerExplanation, /central exchange.*piece activity/i);
  assert.doesNotMatch(exercise.drill.knownLine, /e5/);
});

test("invalid or incomplete PGN retains the honest general concept", () => {
  const exercise = buildFreeTrainingExercise({ username: "ReportPlayer", games: [{ gameId: "broken", opening: "Caro-Kann Defense", colour: "white", pgn: "1. e4" }] }, priority);
  assert.equal(exercise.drill.knownLine, "");
  assert.match(exercise.drill.prompt, /variation unknown/i);
});

test("fictional training renderers explicitly skip persistence", () => {
  const drillSource = readFileSync(new URL("../components/OpeningOpportunityDrill.jsx", import.meta.url), "utf8");
  const sessionSource = readFileSync(new URL("../components/TrainingGameReviewSession.jsx", import.meta.url), "utf8");
  assert.match(drillSource, /if \(!drill\.provenance\?\.fictional\) saveOpeningOpportunityProgress/);
  assert.match(sessionSource, /if \(!fictional\) saveOpeningOpportunityProgress/);
  assert.match(sessionSource, /Fictional example plans are not saved/);
});

test("the renderer consumes one mutually exclusive provenance state", () => {
  const source = readFileSync(new URL("../components/OpeningOpportunityDrill.jsx", import.meta.url), "utf8");
  assert.match(source, /drill\.provenance\?\.kind === "own_game_position"/);
  assert.match(source, /if \(sessionIdentityRef\.current === sessionIdentity\) return;/);
  assert.doesNotMatch(source, /Own-game exercise from this report/);
  assert.doesNotMatch(source, /drill\.sourceGame \? .*drill\.generalSetup/s);
});

test("starting the report action auto-opens the free exercise and counts one start", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const training = readFileSync(new URL("../components/ThisWeekTrainingExperience.jsx", import.meta.url), "utf8");
  assert.match(app, /path: "\/train\?start=report-task"/);
  assert.match(training, /get\("start"\) === "report-task"/);
  assert.match(training, /onceKey: `free:\$\{plan\?\.id\}:\$\{previewTask\.id\}`/);
  assert.equal((training.match(/onceKey: `free:\$\{plan\?\.id\}:\$\{(?:previewTask|task)\.id\}`/g) || []).length, 2);
  assert.match(training, /replaceState\(\{\}, "", "\/train"\)/);
});

test("the duplicate-start removal preserves the authoritative premium gate", () => {
  const source = readFileSync(new URL("../components/ThisWeekTrainingExperience.jsx", import.meta.url), "utf8");
  assert.match(source, /hasWeeklyPlan = canUseFeature\(entitlement, OPENINGFIT_FEATURES\.WEEKLY_PLAN\)/);
  assert.match(source, /if \(hasWeeklyPlan \|\| !previewTask/);
  assert.match(source, /if \(!hasWeeklyPlan\)/);
});

test("free completion requires the complete review session", () => {
  const source = readFileSync(new URL("../components/ThisWeekTrainingExperience.jsx", import.meta.url), "utf8");
  assert.match(source, /<TrainingGameReviewSession[\s\S]*?<OpeningOpportunityDrill[\s\S]*?onEngaged=/);
  assert.match(source, /trainingSessionReady \? <button[\s\S]*?Complete this session/);
  assert.doesNotMatch(source, /Mark action complete/);
});
