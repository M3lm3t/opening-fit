import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyRepertoirePreferences,
  getUserRepertoirePreferences,
  setUserRepertoirePreference,
} from "./repertoirePreferenceService.js";

const history = {
  openings: [{
    opening: "Sicilian Defence",
    canonicalOpeningId: "sicilian-defence-b20",
    repertoireRole: "black_vs_e4",
    classification: "EXPERIMENT",
    totalEligibleGames: 7,
    recentGames: 3,
    historicalGames: 4,
    firstSeen: "2025-01-01T00:00:00Z",
    lastSeen: "2026-08-01T00:00:00Z",
    continuity: { repeatedAcrossTime: true },
    performance: { wins: 3, draws: 2, losses: 2, scoreRate: 57.1 },
  }],
};

function preferenceClient(rows = []) {
  const calls = [];
  const query = {
    select() { return this; },
    eq() { return this; },
    async order() { return { data: rows, error: null }; },
  };
  return {
    calls,
    from(table) { calls.push({ type: "from", table }); return query; },
    async rpc(name, params) { calls.push({ type: "rpc", name, params }); return { data: { ...params, preference: params.p_preference }, error: null }; },
  };
}

test("preferences are restored by account, role, and canonical opening ID", async () => {
  const stored = [{
    user_id: "user-1", repertoire_role: "black_vs_e4",
    canonical_opening_id: "sicilian-defence-b20", preference: "main",
  }];
  const firstSession = await getUserRepertoirePreferences("user-1", { client: preferenceClient(stored) });
  const restoredSession = await getUserRepertoirePreferences("user-1", { client: preferenceClient(stored) });
  assert.deepEqual(restoredSession, firstSession);
  assert.equal(restoredSession[0].canonicalOpeningId, "sicilian-defence-b20");
});

test("saving sends canonical identity and never a mutable display name", async () => {
  const client = preferenceClient();
  await setUserRepertoirePreference({
    userId: "user-1", repertoireRole: "black_vs_e4",
    canonicalOpeningId: "sicilian-defence-b20", preference: "experimenting",
    opening: "A renamed display label",
  }, { client });
  const call = client.calls.find((entry) => entry.type === "rpc");
  assert.equal(call.name, "set_user_repertoire_preference");
  assert.deepEqual(call.params, {
    p_repertoire_role: "black_vs_e4",
    p_canonical_opening_id: "sicilian-defence-b20",
    p_preference: "experimenting",
  });
  assert.equal(JSON.stringify(call).includes("renamed"), false);
});

test("manual status overrides presentation without rewriting historical evidence", () => {
  const original = structuredClone(history.openings[0]);
  const [shown] = applyRepertoirePreferences(history, [{
    repertoireRole: "black_vs_e4", canonicalOpeningId: "sicilian-defence-b20", preference: "main",
  }]);
  assert.equal(shown.classification, "EXPERIMENT");
  assert.equal(shown.automaticClassification, "EXPERIMENT");
  assert.equal(shown.effectiveClassification, "MAIN_REPERTOIRE");
  for (const field of ["totalEligibleGames", "recentGames", "historicalGames", "firstSeen", "lastSeen", "continuity", "performance"])
    assert.deepEqual(shown[field], original[field]);
  assert.deepEqual(history.openings[0], original);
});

test("preferences follow canonical IDs across new analyses and automatic restores detection", () => {
  const preference = [{ repertoireRole: "black_vs_e4", canonicalOpeningId: "sicilian-defence-b20", preference: "ignore" }];
  const renamedAnalysis = { openings: [{ ...history.openings[0], opening: "Sicilian Defense" }] };
  assert.equal(applyRepertoirePreferences(renamedAnalysis, preference)[0].effectiveClassification, "IGNORED");
  assert.equal(applyRepertoirePreferences(renamedAnalysis, [])[0].effectiveClassification, "EXPERIMENT");
});

test("migration enforces account/canonical identity and keeps automatic as deletion", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/202608170001_user_repertoire_preferences.sql", import.meta.url), "utf8");
  assert.match(sql, /primary key \(user_id, repertoire_role, canonical_opening_id\)/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /if p_preference = 'automatic' then\s+delete from/is);
  assert.doesNotMatch(sql, /display_name|opening_name/i);
});
