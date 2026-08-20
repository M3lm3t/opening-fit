import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCoachingSessionContent, buildPersonalTrainingItems, compareTrainedPosition, dueTrainingSession, evaluatePersonalTrainingMove, evaluatePersonalTrainingOutcomes, mergeTrainingState, reviewTrainingItem, validatePersonalTrainingSource } from "./personalOpeningTraining.js";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3";
const source = { diagnosisId: "diagnosis:1", positionFen: FEN, repertoireRole: "white", playerColour: "white", recommendedMoves: ["Nxe5", "Bc4"], supportingGameIds: ["g1"], opening: "King's Pawn", canonicalOpeningId: "kings-pawn", confidence: "high" };
const report = { analysisId: "report-1", reportDecision: { version: "v6" }, recurringOpeningHabits: [{ ...source, habitId: "h1", habitType: "RECURRING_MISTAKE", playedMove: "d3", occurrenceCount: 4 }] };

test("builds a stable personal item with canonical identities and legal alternatives", () => {
  const first = buildPersonalTrainingItems({ report, ownerId: "user-1", now: "2026-08-19T09:00:00Z" });
  const second = buildPersonalTrainingItems({ report, ownerId: "user-1", now: "2026-08-19T12:00:00Z" });
  assert.equal(first.items.length, 1); assert.equal(first.items[0].itemId, second.items[0].itemId);
  assert.equal(first.items[0].diagnosisId, "diagnosis:1"); assert.deepEqual(first.items[0].acceptedMoves, ["Nxe5", "Bc4"]);
  assert.equal(evaluatePersonalTrainingMove(first.items[0], "Bc4").alternative, true);
});

test("fails closed for illegal, wrong-colour, untrusted and contradictory inputs", () => {
  assert.ok(validatePersonalTrainingSource({ ...source, positionFen: "broken" }).reasons.includes("illegal_position"));
  assert.ok(validatePersonalTrainingSource({ ...source, repertoireRole: "black_vs_e4" }).reasons.includes("wrong_colour"));
  assert.ok(validatePersonalTrainingSource({ ...source, repertoireRole: "unknown" }).reasons.includes("untrusted_role"));
  assert.ok(validatePersonalTrainingSource({ ...source, contradictory: true }).reasons.includes("contradictory_recommendations"));
});

test("scheduler is deterministic and explains assistance and repeated failures", () => {
  const item = buildPersonalTrainingItems({ report, ownerId: "user-1", now: "2026-08-19T09:00:00Z" }).items[0];
  const failed = reviewTrainingItem(item, { correct: false, now: "2026-08-19T10:00:00Z" });
  assert.equal(failed.reviewSchedule.intervalDays, 0); assert.match(failed.reviewSchedule.reason, /Incorrect/);
  const helped = reviewTrainingItem(failed, { correct: true, assistanceUsed: true, now: "2026-08-19T11:00:00Z" });
  assert.equal(helped.reviewSchedule.intervalDays, 1); assert.equal(dueTrainingSession([helped], { now: "2026-08-19T12:00:00Z" }).dueCount, 0);
});

test("restores only the matching owner state", () => {
  const item = buildPersonalTrainingItems({ report, ownerId: "user-1" }).items[0];
  const stored = reviewTrainingItem(item, { correct: false });
  assert.equal(mergeTrainingState([item], [stored], "user-1")[0].state.attempts, 1);
  assert.equal(mergeTrainingState([item], [{ ...stored, ownerId: "user-2" }], "user-1")[0].state.attempts, 0);
});

test("session evidence hierarchy distinguishes source, pack and general setup fallbacks", () => {
  const item = buildPersonalTrainingItems({ report, ownerId: "user-1" }).items[0];
  assert.equal(buildCoachingSessionContent({ item }).provenance, "verified_source_position");
  assert.equal(buildCoachingSessionContent({ item: { ...item, sourceGameId: null, continuation: ["Nf6"] } }).provenance, "recognised_opening_pack_line");
  const general = buildCoachingSessionContent({ report: { analysisId: "report-general", reportDecision: { trainingPriority: { priorityId: "d-general", taskId: "task-general", repertoireRole: "black_vs_e4", openingName: "Caro-Kann Defence", rationale: "Challenge the centre before completing development." } } } });
  assert.equal(general.provenance, "general_setup"); assert.equal(general.interactive, false); assert.deepEqual(general.choices, []); assert.equal(general.orientation, "black");
  assert.equal(buildCoachingSessionContent({ report: {} }).available, false);
});

test("legacy reports fail closed without adding an entitlement gate", () => {
  const legacy = buildPersonalTrainingItems({ report: { analysisId: "old-report", weaknesses: [{ opening: "French" }] }, ownerId: "user-1" });
  assert.deepEqual(legacy.items, []);
  const component = readFileSync(new URL("../components/PersonalOpeningTrainer.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /canUseFeature|OPENINGFIT_FEATURES|premium/i);
});

test("later games distinguish trained move, acceptable move, repeated mistake and absence", () => {
  const item = buildPersonalTrainingItems({ report, ownerId: "user-1" }).items[0];
  assert.equal(compareTrainedPosition(item, { pgn: "1. e4 e5 2. Nf3 Nc6 3. Nxe5" }).outcome, "trained_move");
  assert.equal(compareTrainedPosition(item, { pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4" }).outcome, "acceptable_alternative");
  assert.equal(compareTrainedPosition(item, { pgn: "1. e4 e5 2. Nf3 Nc6 3. d3" }).outcome, "repeated_original_mistake");
  assert.equal(compareTrainedPosition(item, { pgn: "1. d4 d5" }).outcome, "left_known_position");
});

test("improvement requires two trustworthy later-game position comparisons", () => {
  const item = { ...buildPersonalTrainingItems({ report, ownerId: "user-1" }).items[0], updatedAt: "2026-08-01T00:00:00Z" };
  const one = evaluatePersonalTrainingOutcomes([item], [{ playedAt: "2026-08-02", pgn: "1. e4 e5 2. Nf3 Nc6 3. Nxe5" }])[0];
  assert.equal(one.status, "insufficient_data");
  const two = evaluatePersonalTrainingOutcomes([item], [{ playedAt: "2026-08-02", pgn: "1. e4 e5 2. Nf3 Nc6 3. Nxe5" }, { playedAt: "2026-08-03", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4" }])[0];
  assert.equal(two.status, "improved"); assert.equal(two.correctApplicationCount, 2);
});

test("mobile trainer keeps a bounded board, accessible controls, and resumable progression", () => {
  const component = readFileSync(new URL("../components/PersonalOpeningTrainer.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/PersonalOpeningTrainer.css", import.meta.url), "utf8");
  assert.match(component, /aria-label="Coaching session progress"/); assert.match(component, /onPieceDrop/); assert.match(component, /COACHING_SESSION_STEPS/);
  assert.match(css, /@media \(max-width: 430px\)/); assert.match(css, /max-width: 100%/); assert.match(css, /min-height: 44px/);
  assert.match(css, /var\(--of-color-surface\)/); assert.doesNotMatch(css, /#[0-9a-f]{3,8}/i);
  assert.match(css, /safe-area-inset-bottom/); assert.match(component, /orientation=\{content\.orientation\}/);
});

test("session completion is idempotent, requires Commit, and saves canonical response-plan identities", () => {
  const component = readFileSync(new URL("../components/PersonalOpeningTrainer.jsx", import.meta.url), "utf8");
  assert.match(component, /completionStarted\.current/);
  assert.match(component, /activityType: "training_session_completed"/);
  assert.match(component, /idempotencyKey: `coaching-session:\$\{item\.itemId\}`/);
  assert.match(component, /saveCoachingResponsePlan\(\{ userId: user\.id, repertoireRole: item\.repertoireRole, openingId: item\.openingId, diagnosisId: item\.diagnosisId/);
  assert.match(component, /sessionStep: "commit"/);
  assert.doesNotMatch(component, /OPENINGFIT_FEATURES|hasPremiumAccess|isPremium/);
});
