import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { buildFreeTrainingExercise, explainTrainingPriority } from "./freeTrainingExercise.js";
import { normalizeExerciseProvenance } from "./openingOpportunityDrills.js";

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

test("a general setup has a conservative disclaimer and no source link", () => {
  const exercise = buildFreeTrainingExercise({}, priority);
  assert.equal(exercise.kind, "general_opening_setup");
  assert.equal(exercise.drill.sourceGame, null);
  assert.match(exercise.provenance.disclaimer, /illustrative.*not claimed/i);
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

test("the renderer consumes one mutually exclusive provenance state", () => {
  const source = readFileSync(new URL("../components/OpeningOpportunityDrill.jsx", import.meta.url), "utf8");
  assert.match(source, /drill\.provenance\?\.kind === "own_game_position"/);
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

test("free completion remains gated behind exercise engagement", () => {
  const source = readFileSync(new URL("../components/ThisWeekTrainingExperience.jsx", import.meta.url), "utf8");
  assert.match(source, /<OpeningOpportunityDrill[\s\S]*?onEngaged=/);
  assert.match(source, /freeExerciseEngaged \? <button[\s\S]*?Complete this exercise/);
  assert.doesNotMatch(source, /Mark action complete/);
});
