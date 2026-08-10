import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRepertoireCoverage, REPERTOIRE_COVERAGE_STATES as STATES } from "./repertoireCoverage.js";

const established = (key, displayName, verdict = "keep") => ({ key, displayName, status: "established", complete: true, verdict, supportingGames: 12, confidence: { label: "Moderate confidence" } });

test("complete repertoire reports all canonical roles established", () => {
  const view = buildRepertoireCoverage({ repertoire: [established("white", "Vienna Game"), established("black_e4", "Scandinavian"), established("black_d4", "Queen's Gambit Declined")] });
  assert.equal(view.complete, true);
  assert.equal(view.summary, "All 3 core repertoire roles are established.");
});

test("missing Black against 1.d4 is a coverage gap", () => {
  const view = buildRepertoireCoverage({ repertoire: [established("white", "Vienna Game"), established("black_e4", "Scandinavian")] });
  assert.equal(view.roles.find(({ key }) => key === "black_d4").state, STATES.COVERAGE_GAP);
});

test("limited evidence remains low confidence", () => {
  const view = buildRepertoireCoverage({ repertoire: [{ key: "black_e4", displayName: "Sicilian Defence", status: "building", supportingGames: 4 }] });
  assert.equal(view.roles.find(({ key }) => key === "black_e4").state, STATES.LOW_CONFIDENCE);
});

test("genuine weak established defence needs repair without becoming a gap", () => {
  const view = buildRepertoireCoverage({ repertoire: [established("black_e4", "Scandinavian", "repair")] });
  const role = view.roles.find(({ key }) => key === "black_e4");
  assert.equal(role.state, STATES.NEEDS_REPAIR);
  assert.notEqual(role.state, STATES.COVERAGE_GAP);
});

test("white-only sparse sample does not imply complete coverage", () => {
  const view = buildRepertoireCoverage({ repertoire: [{ key: "white", displayName: "Vienna Game", status: "building", games: 3 }] });
  assert.deepEqual(view.roles.map(({ state }) => state), [STATES.LOW_CONFIDENCE, STATES.COVERAGE_GAP, STATES.COVERAGE_GAP]);
});

test("unknown roles are ignored and mixed inconsistent evidence fails safely", () => {
  const view = buildRepertoireCoverage({ repertoire: [{ key: "black_c4", status: "established", complete: true }, { ...established("black_d4", "King's Indian"), dataQuality: "inconsistent_evidence" }] });
  assert.equal(view.establishedCount, 0);
  assert.equal(view.roles.find(({ key }) => key === "black_d4").state, STATES.LOW_CONFIDENCE);
});

test("coverage UI stays compact, expandable, and mobile-stacked", () => {
  const component = readFileSync(new URL("../components/RepertoireCoverageMap.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/ProductAppShell.css", import.meta.url), "utf8");
  assert.match(component, /<details><summary>Evidence<\/summary>/);
  assert.match(css, /repertoireCoverageGrid/);
  assert.match(css, /@media[\s\S]*decisionRepertoireMap > div/);
});
