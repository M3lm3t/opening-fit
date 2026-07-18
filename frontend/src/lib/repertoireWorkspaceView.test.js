import assert from "node:assert/strict";
import test from "node:test";

import { buildRepertoireWorkspaceView } from "./repertoireWorkspaceView.js";

const report = { username: "Player", platform: "chesscom", gamesImported: 20, importedAt: "2026-07-18T10:00:00Z" };
const entry = (overrides = {}) => ({
  id: "entry-1",
  slot: "white_primary",
  canonical_opening_id: "vienna-game",
  canonical_name: "Vienna Game",
  display_name: "Vienna Game",
  source: "user_selected",
  status: "active",
  ...overrides,
});

test("no report state directs the user to analysis", () => {
  const view = buildRepertoireWorkspaceView();
  assert.equal(view.state, "no-report");
  assert.match(view.notice, /analyse your games/i);
});

test("a report without saved entries requires explicit repertoire creation", () => {
  const view = buildRepertoireWorkspaceView({ report });
  assert.equal(view.state, "not-built");
  assert.match(view.notice, /no repertoire has been saved/i);
});

test("only White data keeps Black slots as useful empty states", () => {
  const view = buildRepertoireWorkspaceView({ report, entries: [entry()] });
  assert.equal(view.state, "ready");
  assert.equal(view.coverage, "only-white");
  assert.equal(view.sections.find((section) => section.key === "white").cards.length, 1);
  assert.equal(view.sections.find((section) => section.key === "black-e4").cards.length, 0);
});

test("only Black data keeps the White slot empty", () => {
  const view = buildRepertoireWorkspaceView({ report, entries: [entry({ slot: "black_vs_e4", canonical_opening_id: "caro-kann-defense", display_name: "Caro-Kann Defense" })] });
  assert.equal(view.coverage, "only-black");
  assert.equal(view.sections.find((section) => section.key === "white").cards.length, 0);
});

test("missing and low-sample statistics never become fake zero values", () => {
  const view = buildRepertoireWorkspaceView({ report, entries: [entry()] });
  const card = view.sections[0].cards[0];
  assert.equal(view.lowSample, true);
  assert.equal(card.gamesLabel, "Not enough evidence yet");
  assert.equal(card.scoreLabel, "Not enough evidence yet");
  assert.equal(card.confidenceLabel, "Not enough evidence yet");
  assert.equal(card.progress.label, "Not enough evidence yet");
});

test("active cards and suggested changes expose complete saved evidence", () => {
  const current = entry({ sample_size: 12, recent_score: 58, confidence: "Medium", key_strength: "Reliable structure", key_weakness: "Early queen pressure", current_training_focus: "Practise the main response", last_reviewed_at: "2026-07-17T10:00:00Z" });
  const suggestion = entry({ id: "suggested", status: "considering", source: "recommended", canonical_opening_id: "italian-game", canonical_name: "Italian Game", display_name: "Italian Game", sample_size: 9, recent_score: 64, confidence: "Medium", recommendation_reason: "A stronger recent sample", expected_benefit: "More natural development" });
  const view = buildRepertoireWorkspaceView({ report, entries: [current, suggestion] });
  const card = view.sections[0].cards[0];
  assert.equal(card.gamesLabel, "12 games");
  assert.equal(card.scoreLabel, "58%");
  assert.equal(card.strengthLabel, "Reliable structure");
  assert.equal(view.suggestions[0].currentOpening, "Vienna Game");
  assert.equal(view.suggestions[0].reason, "A stronger recent sample");
  assert.equal(view.suggestions[0].expectedBenefit, "More natural development");
});

test("loading state is explicit", () => {
  assert.equal(buildRepertoireWorkspaceView({ loading: true }).state, "loading");
});
