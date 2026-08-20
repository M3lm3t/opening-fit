import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { enforceReportRoleContract, validateReportConsistency } from "./reportConsistency.js";
import { persistReport, readPersistedReport } from "./reportPersistence.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("production Python serialization feeds the frontend role and persistence adapters unchanged", () => {
  const script = String.raw`
import json
import main

games = [
  {"gameId": "white-1", "playerColour": "white", "relationship": "played_by_user", "firstWhiteMove": "e4", "opening": "Vienna Game"},
  {"gameId": "d4-1", "playerColour": "black", "relationship": "played_by_user", "firstWhiteMove": "d4", "opening": "Nimzo-Indian Defence"},
  {"gameId": "d4-2", "playerColour": "black", "relationship": "played_by_user", "firstWhiteMove": "d4", "opening": "Nimzo-Indian Defence"},
]
confidence = {
  "sampleSizeConfidence": {"label": "Early"}, "classificationConfidence": {"label": "Known"},
  "roleAttributionConfidence": {"label": "Verified"}, "recommendationConfidence": {"label": "Early"},
}
roles = [
  {"key": "white", "repertoireRole": "white", "status": "building", "currentOpening": "Vienna Game", "supportingGameCount": 1, "evidenceGameIds": ["white-1"], "requiredGameCount": 5},
  {"key": "black_e4", "repertoireRole": "black_vs_e4", "status": "insufficient", "currentOpening": None, "supportingGameCount": 0, "evidenceGameIds": [], "requiredGameCount": 5},
  {"key": "black_d4", "repertoireRole": "black_vs_d4", "status": "building", "currentOpening": "Nimzo-Indian Defence", "supportingGameCount": 2, "evidenceGameIds": ["d4-1", "d4-2"], "requiredGameCount": 5},
]
recommendations = [
  {**confidence, "recommendationId": "vienna:white", "openingName": "Vienna Game", "repertoireRole": "white", "playerColour": "white", "relationship": "played_by_user", "sample": {"games": 1, "gameIds": ["white-1"]}},
  {**confidence, "recommendationId": "nimzo:d4", "openingName": "Nimzo-Indian Defence", "repertoireRole": "black_vs_d4", "playerColour": "black", "relationship": "played_by_user", "sample": {"games": 2, "gameIds": ["d4-1", "d4-2"]}},
]
report = {"analysisId": "python-contract-report", "analysisCompleted": True, "opening_games": games, "gameCounts": {"fetchedGames": 3, "dateRangeEligibleGames": 3, "timeControlEligibleGames": 3, "analysisCandidateGames": 3, "analysedGames": 3, "excludedGames": 0}, "reportDecision": {"schemaVersion": 5, "repertoireRoles": roles, "recommendations": recommendations}}
print(json.dumps(main.compact_analysis_result(report), separators=(",", ":")))
`;
  const serialized = spawnSync("uv", ["run", "--offline", "--with-requirements", "requirements.txt", "python", "-c", script], {
    cwd: new URL("../../../backend", import.meta.url),
    encoding: "utf8",
    env: { ...process.env, UV_CACHE_DIR: process.env.UV_CACHE_DIR || fileURLToPath(new URL("../../../.uv-cache-retention", import.meta.url)) },
  });
  assert.equal(serialized.status, 0, serialized.stderr);
  const backendJson = JSON.parse(serialized.stdout);
  const adapted = enforceReportRoleContract(backendJson);
  const model = buildReportDecisionModel(adapted.report);
  const byRole = Object.fromEntries(model.repertoire.map((row) => [row.role, row]));

  assert.equal(adapted.valid, true);
  assert.equal(validateReportConsistency(adapted.report).valid, true);
  assert.equal(byRole.white.displayName, "Vienna Game");
  assert.equal(byRole.black_vs_e4.displayName, "Not established yet");
  assert.equal(byRole.black_vs_d4.displayName, "Nimzo-Indian Defence");
  assert.equal(byRole.black_vs_d4.status, "building");
  assert.equal(backendJson.analysis_game_index.filter((game) => game.firstWhiteMove === "d4").length, 2);

  const storage = memoryStorage();
  assert.equal(persistReport(storage, "report", { analysis: adapted.report }).ok, true);
  const restored = enforceReportRoleContract(readPersistedReport(storage, "report").analysis).report;
  assert.equal(buildReportDecisionModel(restored).repertoire.find((row) => row.role === "black_vs_d4").displayName, "Nimzo-Indian Defence");
});
