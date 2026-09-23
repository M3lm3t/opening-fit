import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { buildPersonalTrainingItems, buildCoachingSessionContent, evaluatePersonalTrainingMove, retainTrainingHistory, personalTrainingReviewRoute } from "./personalOpeningTraining.js";
import { navigateApp } from "../appNavigation.js";
import { traitPresentation, suitabilityReason } from "./suitabilityPresentation.js";

test("zero, missing, invalid, defaulted and partial traits remain distinct", () => {
  assert.equal(traitPresentation({ traits: { x: 0 }, traitInputStatus: { x: "heuristic" } }, "x").value, 0);
  for (const status of ["missing", "defaulted", "partial", "invalid"]) {
    const result = traitPresentation({ traits: { x: 50 }, traitInputStatus: { x: status } }, "x");
    assert.equal(result.value, null); assert.equal(result.status, status);
  }
  assert.equal(traitPresentation({ traits: { x: "bad" } }, "x").status, "invalid");
  assert.equal(traitPresentation({ traits: { x: 50 }, sample_size: 0 }, "x").value, null);
  const historic = { traits: { x: 73 } }, saved = structuredClone(historic);
  assert.equal(traitPresentation(historic, "x").label, "Stored estimate; provenance unavailable");
  assert.deepEqual(historic, saved);
});

for (const name of ["Italian Game", "Scandinavian Defence"]) test(`unplayed ${name} is not a proven personal fit`, () => {
  assert.match(suitabilityReason({ name, games: 0, reason: "A perfect fit" }), /not a personally proven fit/);
});

for (const [ownerId, opening, moves, expected] of [
  ["alice", "Italian Game", ["e4", "e5", "Nf3", "Nc6"], "Bc4"],
  ["boris", "Queen's Gambit", ["d4", "d5"], "c4"],
]) test(`usable sourced task and honest fallback for ${ownerId}/${opening}`, () => {
  const board = new Chess(); moves.forEach(move => board.move(move));
  const diagnosis = { diagnosisId: "diagnosis", positionFen: board.fen(), repertoireRole: "white", playerColour: "white", opening, recommendedMoves: [expected], supportingGameIds: ["game-1"] };
  const report = { analysisId: "report-1", analysis_game_index: [{ gameId: "game-1", playerColour: "white", moves }], reportDecision: { openingDiagnosis: diagnosis, trainingPriority: { priorityId: "priority", openingName: opening, repertoireRole: "white", rationale: "Practise this position" } } };
  const saved = structuredClone(report);
  const generated = buildPersonalTrainingItems({ report, ownerId, selectedOpening: { name: opening } });
  assert.equal(generated.items.length, 1);
  const task = buildCoachingSessionContent({ item: generated.items[0], report, selectedOpening: { name: opening } });
  assert.equal(task.interactive, true);
  assert.equal(evaluatePersonalTrainingMove(task.item, expected).accepted, true);
  assert.equal(evaluatePersonalTrainingMove(task.item, "a3").reason, "saved_line_deviation");
  assert.equal(evaluatePersonalTrainingMove(task.item, "a3").moveQuality, "unassessed");
  for (const broken of [
    { ...report, analysis_game_index: [] },
    { ...report, analysis_game_index: [{ gameId: "game-1", playerColour: "black", moves }] },
    { ...report, reportDecision: { ...report.reportDecision, openingDiagnosis: { ...diagnosis, positionFen: "invalid" } } },
  ]) {
    assert.equal(buildPersonalTrainingItems({ report: broken, ownerId }).items.length, 0);
    const fallback = buildCoachingSessionContent({ report: broken });
    assert.equal(fallback.available, false);
    assert.match(fallback.recoveryAction, /supporting games/);
  }
  assert.equal(buildPersonalTrainingItems({ report, ownerId, selectedOpening: { name: "Unrelated opening" } }).items.length, 0);
  assert.deepEqual(report, saved);
});

test("a retained legal reference continuation is usable; invented or illegal references are not", () => {
  const board = new Chess(); board.move("e4");
  const source = { diagnosisId: "scandi", opening: "Scandinavian Defence", repertoireRole: "black_vs_e4", playerColour: "black", positionFen: board.fen(), authoritativeContinuation: { source: "opening_reference_line", move: "d5" } };
  const report = { analysisId: "reference-report", reportDecision: { openingDiagnosis: source } };
  const generated = buildPersonalTrainingItems({ report, ownerId: "chen", selectedOpening: { name: "Scandinavian Defence", repertoireRole: "black_vs_e4" } });
  assert.equal(generated.items.length, 1);
  assert.equal(buildCoachingSessionContent({ item: generated.items[0] }).interactive, true);
  assert.equal(generated.items[0].sourceGameId, null);
  for (const reference of [{ source: "guessed", move: "d5" }, { source: "opening_reference_line", move: "d8d1" }]) {
    assert.equal(buildPersonalTrainingItems({ report: { ...report, reportDecision: { openingDiagnosis: { ...source, authoritativeContinuation: reference } } }, ownerId: "chen" }).items.length, 0);
  }
});

test("saving a usable task preserves ineligible historical completions without changing owner", () => {
  const historical = { itemId: "legacy", ownerId: "alice", state: { sessionCompleted: true, correct: 2 }, sourceReportVersion: "old" };
  const before = structuredClone(historical);
  const next = { itemId: "current", ownerId: "alice", state: { attempts: 1 } };
  const retained = retainTrainingHistory([], [historical, { ...historical, itemId: "foreign", ownerId: "boris" }], next, "alice");
  assert.deepEqual(retained.find(item => item.itemId === "legacy"), before);
  assert.equal(retained.some(item => item.itemId === "foreign"), false);
  assert.deepEqual(historical, before);
  assert.equal(retained.find(item => item.itemId === "current").ownerId, "alice");
});

test("unsupported drill review uses the existing navigation action to open Evidence for the selected opening", () => {
  const originalWindow = globalThis.window;
  const originalEvent = globalThis.CustomEvent;
  const urls = [], events = [], views = [];
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  globalThis.window = { location: { pathname: "/train", search: "", hash: "" }, history: { pushState: (_state, _unused, url) => urls.push(url) }, dispatchEvent: event => events.push(event) };
  try {
    navigateApp(personalTrainingReviewRoute({ name: "Scandinavian Defence", repertoireRole: "black_vs_e4" }), { setView: view => views.push(view), delays: [] });
    assert.deepEqual(views, ["report"]);
    assert.match(urls[0], /#report-evidence$/);
    assert.equal(new URL(urls[0], "https://example.test").searchParams.get("openingName"), "Scandinavian Defence");
    assert.equal(events[0].detail.view, "evidence");
  } finally { globalThis.window = originalWindow; globalThis.CustomEvent = originalEvent; }
});
