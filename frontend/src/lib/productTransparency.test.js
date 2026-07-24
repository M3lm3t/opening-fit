import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULT_PUBLIC_ANALYSIS_CONTRACT, normalisePublicAnalysisContract, publicFeatureComparison } from "./productTransparency.js";

test("public analysis limit matches the active backend limit", () => {
  const source = fs.readFileSync(new URL("../../../backend/main.py", import.meta.url), "utf8");
  const active = Number(source.match(/^ANALYSIS_GAME_LIMIT\s*=\s*(\d+)/m)?.[1]);
  assert.equal(DEFAULT_PUBLIC_ANALYSIS_CONTRACT.analysisGameLimit, active);
});

test("public comparison states exact free and paid limits", () => {
  const copy = publicFeatureComparison().flat().join(" ");
  assert.match(copy, /60 minutes apart/);
  assert.match(copy, /5 minutes apart/);
  assert.match(copy, /Up to 3 months/);
  assert.match(copy, /Up to 12 months/);
  assert.match(copy, /Up to 50 reports/);
  assert.doesNotMatch(copy, /fair.use|automatic or on demand/i);
});

test("public contract rejects invalid remote values", () => {
  const value = normalisePublicAnalysisContract({ analysisGameLimit: -1, freeHistoryMonths: 4 });
  assert.equal(value.analysisGameLimit, 300);
  assert.equal(value.freeHistoryMonths, 4);
});
