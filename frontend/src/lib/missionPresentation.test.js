import test from "node:test";
import assert from "node:assert/strict";
import { confidenceCopy, missionAction, missionStatement, normaliseMissionResponse, provenanceLabel, roleLabel } from "./missionPresentation.js";

test("mission availability distinguishes disabled, unavailable and no candidate", () => {
  assert.equal(normaliseMissionResponse({ reasonCode: "missions_disabled" }).kind, "disabled");
  assert.equal(normaliseMissionResponse({ reasonCode: "schema_unavailable" }).kind, "unavailable");
  assert.equal(normaliseMissionResponse({ reasonCode: "no_trusted_candidate" }).kind, "no_candidate");
  assert.equal(normaliseMissionResponse({ reasonCode: "analysis_required" }).kind, "analysis_required");
});

test("known mission survives an unavailable background refresh", () => {
  const previous = normaliseMissionResponse({ mission: { id: "m1", status: "learning" } });
  const next = normaliseMissionResponse({ reasonCode: "temporarily_unavailable" }, previous);
  assert.equal(next.kind, "unavailable");
  assert.equal(next.mission.id, "m1");
});

test("capabilities survive normalization and rollout denial is not an upgrade denial", () => {
  const capabilities = { canSelectNextMission: false, reasonCode: "free_allowance_exhausted", tier: "free" };
  const limited = normaliseMissionResponse({ capabilities });
  assert.equal(limited.capabilities, capabilities);
  assert.equal(normaliseMissionResponse({ reasonCode: "rollout_unavailable", capabilities: { reasonCode: "rollout_unavailable" } }).kind, "unavailable");
});

test("presentation uses trusted fields and honest confidence", () => {
  const mission = { repeated_played_move_san: "Bg5", confidence: { level: "low" } };
  assert.equal(missionStatement(mission), "Replace Bg5 with your prepared response");
  assert.match(confidenceCopy(mission), /limited sample/);
  assert.equal(roleLabel("black_vs_e4"), "Black vs 1.e4");
  assert.match(provenanceLabel("active_repertoire_line"), /active repertoire/);
});

test("lifecycle actions are presentation only", () => {
  assert.equal(missionAction("assigned"), "Start mission");
  assert.equal(missionAction("learning"), "Continue training");
  assert.equal(missionAction("awaiting_evidence"), "View evidence");
  assert.equal(missionAction("needs_review"), "Review mission");
  assert.equal(missionAction("repaired"), "Find my next mission");
});
