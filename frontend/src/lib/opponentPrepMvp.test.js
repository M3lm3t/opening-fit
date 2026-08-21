import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../../backend/main.py", import.meta.url), "utf8");
const builder = readFileSync(new URL("../../../backend/analysis/opponent_prep.py", import.meta.url), "utf8");

test("opponent prep is independently feature flagged on client and server", () => {
  assert.match(app, /VITE_OPPONENT_PREP_MVP/);
  assert.match(backend, /OPENINGFIT_OPPONENT_PREP_MVP/);
  assert.match(backend, /Opponent prep is not enabled/);
});

test("MVP uses real canonical evidence without prohibited database branding or invented engine prep", () => {
  assert.match(builder, /canonicalOpeningId/);
  assert.match(builder, /positionIdentity/);
  assert.match(builder, /intersectsUserRepertoire/);
  assert.match(builder, /"engineAnalysisRan": False/);
  assert.match(builder, /"recommendedMove": None/);
  assert.doesNotMatch(`${app}\n${backend}\n${builder}`, /ChessBase/i);
});

test("candidate positions reuse the existing board-training target contract", () => {
  assert.match(app, /Start opponent prep/);
  assert.match(app, /opportunityId: target\.trainingSubjectId/);
  assert.match(app, /openingId: target\.canonicalOpeningId/);
  assert.match(app, /gameId: target\.gameReferences\?\.\[0\]/);
});
