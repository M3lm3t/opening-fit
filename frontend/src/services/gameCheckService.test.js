import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGameCheck, reportGamesForGameCheck } from "./gameCheckService.js";

test("Game Check sends existing stable games, checkpoint IDs and import limit to the shared endpoint", async () => {
  let request;
  const result = await evaluateGameCheck({ report: { games: [{ id: "g1" }, { id: "g1" }], gameCounts: { analysisLimit: 20 } }, checkpoint: { checked_game_ids: ["old"] }, comparable: false, fetchImpl: async (_url, options) => { request = JSON.parse(options.body); return { ok: true, async json() { return { status: "complete", newGameCount: 1, outcomes: [], checkedGameIds: ["g1"] }; } }; } });
  assert.equal(result.newGameCount, 1);
  assert.deepEqual(request.checked_ids, ["old"]);
  assert.equal(request.import_limit, 20);
  assert.equal(request.comparable, false);
});

test("report game selection does not manufacture games from aggregate counts", () => {
  assert.deepEqual(reportGamesForGameCheck({ gamesImported: 300 }), []);
});
