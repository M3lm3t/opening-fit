import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  acceptRepertoireRecommendation,
  getActiveRepertoire,
  initialiseRepertoireFromReport,
  rejectRepertoireRecommendation,
  replaceRepertoireEntry,
  updateRepertoireMetrics,
} from "./repertoireService.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const report = {
  recommendedRepertoirePlan: {
    items: [
      { slot: "main_white", opening: "Vienna Game", confidence: "High", games: 18, score: 62 },
      { slot: "black_vs_e4", opening: "Caro-Kann Defense", confidence: "Medium", games: 12, score: 58 },
      { slot: "black_vs_d4", opening: "Slav Defense", confidence: "Medium", games: 9, score: 56 },
    ],
  },
};

function memoryClient(seed = []) {
  let sequence = seed.length;
  const rows = seed.map((row) => ({ ...row }));
  const insert = (entry, overrides = {}) => {
    const row = { id: `entry-${++sequence}`, user_id: USER_ID, status: "active", ...entry, ...overrides };
    rows.push(row);
    return row;
  };
  const activeFor = (slot) => rows.find((row) => row.slot === slot && row.status === "active");

  return {
    rows,
    from() {
      const filters = [];
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        order() {
          return Promise.resolve({ data: rows.filter((row) => filters.every(([key, value]) => row[key] === value)), error: null });
        },
      };
      return query;
    },
    async rpc(name, params) {
      if (name === "initialise_repertoire_from_report") {
        if (rows.some((row) => row.status === "active")) return { data: null, error: { message: "An active repertoire already exists" } };
        return { data: params.p_entries.map((entry) => insert(entry)), error: null };
      }
      if (name === "sync_repertoire_report") {
        params.p_recommendations.forEach((entry) => {
          const active = activeFor(entry.slot);
          if (!active || active.canonical_opening_id === entry.canonical_opening_id) return;
          const exists = rows.some((row) => row.slot === entry.slot && row.canonical_opening_id === entry.canonical_opening_id && row.status === "considering");
          if (!exists) insert(entry, { status: "considering", source: "recommended" });
        });
        return { data: rows, error: null };
      }
      if (name === "apply_repertoire_training_outcomes") {
        params.p_metrics.forEach((entry) => {
          const target = rows.find((row) => row.status === "active" && row.canonical_opening_id === entry.canonical_opening_id);
          if (target && entry.training_outcome) target.training_outcome = entry.training_outcome;
        });
        return { data: rows, error: null };
      }
      if (name === "accept_repertoire_recommendation") {
        const recommendation = rows.find((row) => row.id === params.p_recommendation_id && row.status === "considering");
        if (!recommendation) return { data: null, error: { message: "Recommendation not found" } };
        const active = activeFor(recommendation.slot);
        if (active) active.status = "archived";
        recommendation.status = "active";
        return { data: recommendation, error: null };
      }
      if (name === "reject_repertoire_recommendation") {
        const recommendation = rows.find((row) => row.id === params.p_recommendation_id && row.status === "considering");
        if (!recommendation) return { data: null, error: { message: "Recommendation not found" } };
        recommendation.status = "archived";
        return { data: recommendation, error: null };
      }
      if (name === "replace_repertoire_entry") {
        const active = activeFor(params.p_slot);
        if (active) active.status = "archived";
        return { data: insert(params.p_entry, { source: "user_selected" }), error: null };
      }
      return { data: null, error: { message: "Unknown RPC" } };
    },
  };
}

test("first repertoire creation normalises all required report slots", async () => {
  const client = memoryClient();
  const created = await initialiseRepertoireFromReport(USER_ID, report, { client });
  assert.deepEqual(created.map((row) => row.slot).sort(), ["black_vs_d4", "black_vs_e4", "white_primary"]);
  assert.equal(created.every((row) => row.status === "active" && row.source === "recommended"), true);
  assert.equal(created.find((row) => row.slot === "white_primary").canonical_opening_id, "vienna-game");
  assert.equal((await getActiveRepertoire(USER_ID, { client })).length, 3);
});

test("accepting a recommendation archives the old user selection explicitly", async () => {
  const client = memoryClient([
    { id: "old", user_id: USER_ID, slot: "white_primary", canonical_opening_id: "italian-game", display_name: "Italian Game", source: "user_selected", status: "active" },
    { id: "suggested", user_id: USER_ID, slot: "white_primary", canonical_opening_id: "vienna-game", display_name: "Vienna Game", source: "recommended", status: "considering" },
  ]);
  await acceptRepertoireRecommendation(USER_ID, "suggested", { client });
  assert.equal(client.rows.find((row) => row.id === "old").status, "archived");
  assert.equal(client.rows.find((row) => row.id === "suggested").status, "active");
});

test("rejecting a recommendation preserves the active user selection", async () => {
  const client = memoryClient([
    { id: "old", user_id: USER_ID, slot: "white_primary", canonical_opening_id: "italian-game", source: "user_selected", status: "active" },
    { id: "suggested", user_id: USER_ID, slot: "white_primary", canonical_opening_id: "vienna-game", source: "recommended", status: "considering" },
  ]);
  await rejectRepertoireRecommendation(USER_ID, "suggested", { client });
  assert.equal(client.rows.find((row) => row.id === "old").status, "active");
  assert.equal(client.rows.find((row) => row.id === "suggested").status, "archived");
});

test("manual replacement preserves the prior entry as archived", async () => {
  const client = memoryClient([{ id: "old", user_id: USER_ID, slot: "white_primary", canonical_opening_id: "italian-game", source: "user_selected", status: "active" }]);
  const replacement = await replaceRepertoireEntry(USER_ID, "white_primary", "Vienna Game", { client });
  assert.equal(replacement.source, "user_selected");
  assert.equal(replacement.status, "active");
  assert.equal(client.rows.find((row) => row.id === "old").status, "archived");
  assert.equal(client.rows.length, 2);
});

test("a changed report recommendation is considering and never silently replaces a user choice", async () => {
  const client = memoryClient([{ id: "old", user_id: USER_ID, slot: "white_primary", canonical_opening_id: "italian-game", canonical_name: "Italian Game", source: "user_selected", status: "active" }]);
  await updateRepertoireMetrics(USER_ID, report, { client });
  assert.equal(client.rows.find((row) => row.id === "old").status, "active");
  assert.equal(client.rows.find((row) => row.canonical_opening_id === "vienna-game").status, "considering");
});

test("a measured outcome updates only the matching active repertoire opening", async () => {
  const client = memoryClient([
    { id: "vienna", user_id: USER_ID, slot: "white_primary", canonical_opening_id: "vienna-game", status: "active" },
    { id: "caro", user_id: USER_ID, slot: "black_vs_e4", canonical_opening_id: "caro-kann-defense", status: "active" },
  ]);
  const outcome = { trainingFocusId: "focus-1", status: "improved", laterGameCount: 3, relevantPositionCount: 3, correctApplicationCount: 2, repeatedMistakeCount: 0, beforeMetric: null, afterMetric: { applicationPercent: 67, openingResultPercent: null }, explanation: "You applied this successfully in two later games.", confidence: "medium" };
  await updateRepertoireMetrics(USER_ID, {
    top_openings: [{ name: "Vienna Game", context: "main_white", games: 8 }],
    training_outcomes: [outcome],
    training_outcome_context: { "focus-1": { openingId: "vienna-game", openingName: "Vienna Game" } },
  }, { client });
  assert.deepEqual(client.rows.find((row) => row.id === "vienna").training_outcome, outcome);
  assert.equal(client.rows.find((row) => row.id === "caro").training_outcome, undefined);
});

test("database contract prevents duplicate active slots and exposes ownership RLS", async () => {
  const migration = readFileSync(new URL("../../../supabase/migrations/202607180001_persistent_repertoire_model.sql", import.meta.url), "utf8");
  assert.match(migration, /unique index[^;]+repertoire_one_active_slot_idx[^;]+where status = 'active'/is);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);

  const client = memoryClient([{ id: "existing", user_id: USER_ID, slot: "white_primary", status: "active" }]);
  await assert.rejects(() => initialiseRepertoireFromReport(USER_ID, report, { client }), /already exists/i);
  assert.equal(client.rows.filter((row) => row.slot === "white_primary" && row.status === "active").length, 1);
});
