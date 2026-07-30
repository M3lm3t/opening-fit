import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTrainingReviewSelection, deriveKnownLineConcept, nextTrainingSessionStep, parseReplayPgn, recentGamesReviewCopy, restoredTrainingSessionStep, selectTrainingReviewGames, trainingReviewFunnelCopy, trainingReviewRequirements, validatedGameUrl } from "./trainingGameReview.js";

const pgn = (id, date = "2026.07.20", result = "1-0") => `[Event "Fixture"]\n[Site "https://www.chess.com/game/live/${id}"]\n[Date "${date}"]\n[White "ReviewPlayer"]\n[Black "Opponent${id}"]\n[Result "${result}"]\n[Opening "Caro-Kann Defence"]\n\n1. e4 c6 2. d4 d5 3. Nc3 dxe4 ${result}`;
const priority = { openingName: "Caro-Kann Defence", openingKey: "caro-kann-defense", playerColour: "white", actionType: "prepare_against" };
const game = (id, date, result = "1-0", extra = {}) => ({ gameId: id, pgn: pgn(id, date, result), opening: "Caro-Kann Defence", colour: "white", played_at: date.replaceAll(".", "-") + "T12:00:00Z", result, ...extra });

test("selects no more than three exact opening-and-colour games deterministically", () => {
  const blackPgn = `[Event "Fixture"]\n[Date "2026.07.31"]\n[White "Opponentblack"]\n[Black "ReviewPlayer"]\n[Result "0-1"]\n[Opening "Caro-Kann Defence"]\n\n1. e4 c6 2. d4 d5 0-1`;
  const report = { username: "ReviewPlayer", opening_games: [game("1", "2026.07.01"), game("2", "2026.07.02"), game("3", "2026.07.03"), game("4", "2026.07.04"), { ...game("wrong", "2026.07.30"), opening: "French Defence" }, { ...game("black", "2026.07.31"), pgn: blackPgn, colour: "black" }] };
  assert.deepEqual(selectTrainingReviewGames(report, priority).map((item) => item.id), ["4", "3", "2"]);
});

test("deduplicates a lightweight index row and its richer PGN row by stable identifier", () => {
  const report = { username: "ReviewPlayer", opening_games: [game("same", "2026.07.20")], analysis_game_index: [{ gameId: "same", opening: "Caro-Kann Defense", colour: "white", result: "win" }] };
  const selected = selectTrainingReviewGames(report, priority);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].hasInternalReplay, true);
});

test("ten relevant games and one recoverable game produce an honest source funnel", () => {
  const selection = buildTrainingReviewSelection({ username: "ReviewPlayer", games: [game("only", "2026.07.20")] }, { ...priority, evidenceCount: 10 });
  assert.deepEqual(selection.funnel, { relevantGamesFound: 10, usableOpeningAndColour: 1, validPgn: 1, validExternalUrls: 1, recoverable: 1, selected: 1, known: true });
  assert.match(trainingReviewFunnelCopy(selection.funnel, priority.openingName), /found 10 relevant Caro-Kann Defence games.*One contained enough recoverable/i);
});

test("up to three recoverable games are supplied and review copy pluralises", () => {
  const report = { username: "ReviewPlayer", games: [game("1", "2026.07.01"), game("2", "2026.07.02"), game("3", "2026.07.03"), game("4", "2026.07.04")] };
  const selection = buildTrainingReviewSelection(report, { ...priority, evidenceCount: 10 });
  assert.equal(selection.games.length, 3);
  assert.equal(selection.funnel.recoverable, 4);
  assert.equal(recentGamesReviewCopy(1), "Review this recent game");
  assert.equal(recentGamesReviewCopy(2), "Review these 2 recent games");
});

test("opponent metadata resolves from structured fields and PGN headers for both colours", () => {
  const structured = selectTrainingReviewGames({ username: "ReviewPlayer", games: [{ ...game("structured", "2026.07.20"), opponent: { username: "StructuredOpponent" } }] }, priority)[0];
  assert.equal(structured.opponent, "StructuredOpponent");

  const white = selectTrainingReviewGames({ username: "ReviewPlayer", games: [game("white", "2026.07.20")] }, priority)[0];
  assert.equal(white.opponent, "Opponentwhite");
  const blackPgn = `[Event "Fixture"]\n[Date "2026.07.20"]\n[White "WhiteOpponent"]\n[Black "ReviewPlayer"]\n[Result "0-1"]\n[Opening "Caro-Kann Defence"]\n\n1. e4 c6 2. d4 d5 0-1`;
  const black = selectTrainingReviewGames({ username: "ReviewPlayer", games: [{ gameId: "black-pgn", pgn: blackPgn, opening: "Caro-Kann Defence", colour: "black" }] }, { ...priority, playerColour: "black" })[0];
  assert.equal(black.opponent, "WhiteOpponent");
  assert.notEqual(black.opponent, "ReviewPlayer");
});

test("PGN identity corrects inconsistent supplied colour metadata", () => {
  const inconsistentPgn = `[White "SomeoneElse"]\n[Black "ReviewPlayer"]\n[Opening "Caro-Kann Defence"]\n\n1. e4 c6 2. d4 d5`;
  const report = { username: "ReviewPlayer", games: [{ gameId: "inconsistent", pgn: inconsistentPgn, opening: "Caro-Kann Defence", colour: "white" }] };
  assert.equal(selectTrainingReviewGames(report, priority).length, 0);
  const selected = selectTrainingReviewGames(report, { ...priority, playerColour: "black" })[0];
  assert.equal(selected.userColour, "black");
  assert.equal(selected.opponent, "SomeoneElse");
});

test("missing opponent uses the conservative recorded-state fallback", () => {
  const selected = selectTrainingReviewGames({ username: "ReviewPlayer", games: [{ gameId: "missing-opponent", pgn: "1. e4 c6 2. d4 d5", opening: "Caro-Kann Defence", colour: "white" }] }, priority)[0];
  assert.equal(selected.opponent, "Opponent not recorded");
});

test("known PGN lines ground a structure-specific concept without inventing moves", () => {
  const exchangePgn = `[Event "Fixture"]\n[White "ReviewPlayer"]\n[Black "Opponent"]\n[Result "1/2-1/2"]\n\n1. e4 c6 2. Nc3 d5 3. exd5 cxd5 4. d4 1/2-1/2`;
  const concept = deriveKnownLineConcept({ pgn: exchangePgn, opening: "Caro-Kann Defense" }, "Caro-Kann Defense");
  assert.equal(concept.line, "1.e4 c6 2.Nc3 d5 3.exd5 cxd5 4.d4");
  assert.match(concept.plan, /light-squared bishop.*castle/i);
  assert.match(concept.why, /central exchange.*piece activity/i);
  assert.doesNotMatch(concept.line, /e5/);
  assert.equal(deriveKnownLineConcept({ pgn: "1. e4" }, "Caro-Kann Defence"), null);
});

test("valid PGN creates an internal replay using recorded moves", () => {
  const parsed = parseReplayPgn(pgn("replay"));
  assert.deepEqual(parsed.moves.slice(0, 4), ["e4", "c6", "d4", "d5"]);
  assert.equal(selectTrainingReviewGames({ username: "ReviewPlayer", games: [game("replay", "2026.07.20")] }, priority)[0].hasInternalReplay, true);
});

test("only validated Chess.com and Lichess game URLs enable source access", () => {
  assert.match(validatedGameUrl("https://www.chess.com/game/live/123456"), /chess\.com/);
  assert.match(validatedGameUrl("https://lichess.org/abcdefgh"), /lichess\.org/);
  assert.equal(validatedGameUrl("http://chess.com/game/live/123"), "");
  assert.equal(validatedGameUrl("https://example.com/game/live/123"), "");
});

test("unavailable source data remains visible but does not block a legacy session", () => {
  const selected = selectTrainingReviewGames({ games: [{ gameId: "metadata", opening: "Caro-Kann Defence", colour: "white" }] }, priority);
  assert.equal(selected[0].hasInternalReplay, false);
  assert.equal(selected[0].sourceUrl, "");
  assert.equal(trainingReviewRequirements({ games: selected, conceptEngaged: true, responsePlan: "Develop and castle." }).complete, true);
});

test("repair reviews rank losses before draws and wins without changing the score", () => {
  const reason = { kind: "reliable_weakness" };
  const report = { username: "ReviewPlayer", games: [game("win", "2026.07.22", "1-0"), game("draw", "2026.07.21", "1/2-1/2"), game("loss", "2026.07.20", "0-1")] };
  assert.deepEqual(selectTrainingReviewGames(report, { ...priority, actionType: "repair_repertoire" }, reason).map((item) => item.result), ["Loss", "Draw", "Win"]);
});

test("representative selection prefers the recorded branch and retains a successful comparison", () => {
  const reason = { kind: "reliable_weakness" };
  const report = { username: "ReviewPlayer", games: [
    game("recent-loss", "2026.07.24", "0-1"),
    game("branch-loss", "2026.07.20", "0-1", { branch: "1.e4 c6 2.d4 d5" }),
    game("comparison-win", "2026.07.19", "1-0"),
    game("older-draw", "2026.07.18", "1/2-1/2"),
  ] };
  const selected = selectTrainingReviewGames(report, { ...priority, actionType: "repair_repertoire", lineOrPosition: "1.e4 c6 2.d4 d5", evidenceGameIds: ["branch-loss", "comparison-win"] }, reason);
  assert.equal(selected[0].id, "branch-loss");
  assert.equal(selected[0].selectionCategory, "target_branch");
  assert.ok(selected.some((item) => item.selectionCategory === "successful_comparison"));
  assert.equal(new Set(selected.map((item) => item.id)).size, selected.length);
});

test("preparation examples never describe a loss as weakness evidence", () => {
  const selected = selectTrainingReviewGames({ username: "ReviewPlayer", games: [game("loss", "2026.07.20", "0-1")] }, priority, { kind: "preparation_opportunity" });
  assert.match(selected[0].whySelected, /not presented as proof of weakness/i);
});

test("completion requires review, concept engagement, and a saved plan when a game is actionable", () => {
  const games = selectTrainingReviewGames({ username: "ReviewPlayer", games: [game("one", "2026.07.20")] }, priority);
  assert.equal(trainingReviewRequirements({ games, conceptEngaged: true, responsePlan: "Castle." }).complete, false);
  assert.equal(trainingReviewRequirements({ games, reviewedGameIds: ["one"], responsePlan: "Castle." }).complete, false);
  assert.equal(trainingReviewRequirements({ games, reviewedGameIds: ["one"], conceptEngaged: true, responsePlan: "" }).complete, false);
  assert.equal(trainingReviewRequirements({ games, reviewedGameIds: ["one"], conceptEngaged: true, responsePlan: "Castle." }).complete, true);
});

test("four training steps advance in order and saved or legacy progress remains recoverable", () => {
  assert.equal(nextTrainingSessionStep("focus", "continue"), "review");
  assert.equal(nextTrainingSessionStep("review", "reviewed"), "concept");
  assert.equal(nextTrainingSessionStep("concept", "engaged"), "commit");
  assert.equal(nextTrainingSessionStep("review", "unknown_legacy_event"), "review");
  assert.equal(restoredTrainingSessionStep({ reviewedGameIds: ["one"] }), "concept");
  assert.equal(restoredTrainingSessionStep({ attempts: 1 }), "commit");
  assert.equal(restoredTrainingSessionStep({ responsePlan: "Develop and castle." }), "commit");
  assert.equal(restoredTrainingSessionStep({ legacyUnknown: true }), "focus");
});

test("the session uses the existing replay board and exposes accessible review semantics", () => {
  const source = readFileSync(new URL("../components/TrainingGameReviewSession.jsx", import.meta.url), "utf8");
  assert.match(source, /import GameReplayBoard/);
  assert.match(source, /recentGamesReviewCopy/);
  assert.match(source, /Why this topic was selected/);
  assert.match(source, /label htmlFor=/);
  assert.match(source, /opens in a new tab/);
  assert.match(source, /Mark reviewed and continue/);
  assert.match(source, /Session complete/);
  assert.match(source, /Review again/);
  assert.doesNotMatch(source, /onClick=\{\(\) => persist\(\{ reviewedGameIds/);
  assert.doesNotMatch(source, /mastery|mastered|you improved/i);
  assert.doesNotMatch(source, /repeated position|move was a mistake|blunder/i);
});

test("general feedback cannot use unsupported position-cue recall copy", () => {
  const drill = readFileSync(new URL("../components/OpeningOpportunityDrill.jsx", import.meta.url), "utf8");
  const backend = readFileSync(new URL("../../../backend/analysis/report_decision.py", import.meta.url), "utf8");
  assert.doesNotMatch(drill, /Good recall\. Keep the position cue/i);
  assert.doesNotMatch(backend, /first repeated position where your plan was unclear/i);
});

test("mobile rules stack cards and preserve practical tap targets", () => {
  const css = readFileSync(new URL("../components/TrainingGameReviewSession.css", import.meta.url), "utf8");
  const weeklyCss = readFileSync(new URL("../components/ThisWeekTrainingExperience.css", import.meta.url), "utf8");
  assert.match(css, /@media\(max-width:900px\).*grid-template-columns:1fr/s);
  assert.match(css, /min-height:44px/);
  assert.match(css, /trainingReviewProgress.*overflow-x:auto/s);
  assert.match(css, /replayMovesWrap\{max-height:/);
  assert.match(weeklyCss, /@media\(max-width:480px\).*thisWeekFreeTask>\.primaryBtn\{width:100%;min-height:44px\}/s);
  assert.match(weeklyCss, /overflow-wrap:anywhere/);
  assert.match(weeklyCss, /trainingReviewProgress ol\{display:flex;min-width:max-content\}/);
});
