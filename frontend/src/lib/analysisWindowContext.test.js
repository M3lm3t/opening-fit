import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");

test("completed reports distinguish the analysis window from historical repertoire context", () => {
  assert.match(app, /reportAnalysisContext/);
  assert.match(app, />Analysed</);
  assert.match(app, /historical games considered for repertoire context/);
  assert.match(app, /No separate historical repertoire context was available/);
  assert.match(app, /recentRepertoireGames/);
  assert.match(app, /historicalRepertoireGames/);
});

test("analysis period choices use the canonical game-history entitlement limit", () => {
  assert.match(app, /maxHistoryMonths={gameHistoryMonths}/);
  assert.match(app, /option\.months <= maxHistoryMonths/);
  for (const label of ["30 days", "90 days", "6 months", "12 months"]) assert.match(app, new RegExp(label));
  assert.match(app, /requires extended history access/);
});

test("analysis context collapses to a two-column mobile selector", () => {
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.reportAnalysisContext[\s\S]*flex-direction: column/);
  assert.match(css, /\.reportAnalysisPeriodSelector > div[\s\S]*grid-template-columns: repeat\(2/);
});
