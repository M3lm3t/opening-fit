import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseReplayPgn, selectTrainingReviewGames, trainingReviewRequirements, validatedGameUrl } from "./trainingGameReview.js";

const pgn = (id, date = "2026.07.20", result = "1-0") => `[Event "Fixture"]\n[Site "https://www.chess.com/game/live/${id}"]\n[Date "${date}"]\n[White "ReviewPlayer"]\n[Black "Opponent${id}"]\n[Result "${result}"]\n[Opening "Caro-Kann Defence"]\n\n1. e4 c6 2. d4 d5 3. Nc3 dxe4 ${result}`;
const priority = { openingName: "Caro-Kann Defence", openingKey: "caro-kann-defense", playerColour: "white", actionType: "prepare_against" };
const game = (id, date, result = "1-0", extra = {}) => ({ gameId: id, pgn: pgn(id, date, result), opening: "Caro-Kann Defence", colour: "white", played_at: date.replaceAll(".", "-") + "T12:00:00Z", result, ...extra });

test("selects no more than three exact opening-and-colour games deterministically", () => {
  const report = { username: "ReviewPlayer", opening_games: [game("1", "2026.07.01"), game("2", "2026.07.02"), game("3", "2026.07.03"), game("4", "2026.07.04"), { ...game("wrong", "2026.07.30"), opening: "French Defence" }, { ...game("black", "2026.07.31"), colour: "black" }] };
  assert.deepEqual(selectTrainingReviewGames(report, priority).map((item) => item.id), ["4", "3", "2"]);
});

test("deduplicates a lightweight index row and its richer PGN row by stable identifier", () => {
  const report = { username: "ReviewPlayer", opening_games: [game("same", "2026.07.20")], analysis_game_index: [{ gameId: "same", opening: "Caro-Kann Defense", colour: "white", result: "win" }] };
  const selected = selectTrainingReviewGames(report, priority);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].hasInternalReplay, true);
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

test("the session uses the existing replay board and exposes accessible review semantics", () => {
  const source = readFileSync(new URL("../components/TrainingGameReviewSession.jsx", import.meta.url), "utf8");
  assert.match(source, /import GameReplayBoard/);
  assert.match(source, /Review these games/);
  assert.match(source, /Why this topic was selected/);
  assert.match(source, /label htmlFor=/);
  assert.match(source, /opens in a new tab/);
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
  assert.match(css, /@media\(max-width:900px\).*grid-template-columns:1fr/s);
  assert.match(css, /min-height:44px/);
});
