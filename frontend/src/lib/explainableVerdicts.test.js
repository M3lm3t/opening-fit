import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { buildOpeningFitScoreTransparency } from "./openingFitScoreTransparency.js";

const recommendation = ({ opening, games, wins, draws, losses, scoreRate, verdict, confidence = "Strong" }) => ({
  opening,
  verdict,
  repertoireRole: verdict === "keep" ? "played_as_white" : "played_as_black",
  sampleSizeStatus: "sufficient_data",
  sample: { games, wins, draws, losses, knownResults: games, scoreRate },
  evidenceConfidence: { label: confidence, level: confidence === "Strong" ? "high" : confidence.toLowerCase(), sampleSize: games },
  confidence: { level: confidence.toLowerCase() },
  reason: `${opening} has enough evidence for this decision.`,
});

test("strong KEEP and genuine REPAIR expose their canonical supporting evidence", () => {
  const keep = recommendation({ opening: "Vienna Game", games: 38, wins: 18, draws: 8, losses: 12, scoreRate: 57.9, verdict: "keep" });
  const repair = recommendation({ opening: "Scandinavian Defence", games: 31, wins: 11, draws: 6, losses: 14, scoreRate: 45.2, verdict: "repair" });
  const view = buildPrimaryReportSummary({
    health: { games: 69, confidence: "Strong" },
    authoritative: { establishedStrength: keep, primaryProblem: repair, nextTrainingAction: { type: "repair", opening: repair.opening, sample: repair.sample }, decisionId: "decision-17", trainingPriority: { diagnosisId: "diagnosis-9" } },
  });

  assert.deepEqual(view.keep.observed, { games: 38, gamesLabel: "38 qualifying games", wins: 18, draws: 8, losses: 12, results: "18 W / 8 D / 12 L", scoreRate: "57.9% score", confidence: "Strong" });
  assert.equal(view.keep.label, "Keep");
  assert.equal(view.repair.observed.gamesLabel, "31 qualifying games");
  assert.equal(view.repair.observed.results, "11 W / 6 D / 14 L");
  assert.equal(view.repair.confidence, "Strong");
  assert.equal(view.decisionId, "decision-17");
  assert.equal(view.diagnosisId, "diagnosis-9");
});

test("a low sample is labelled as insufficient and never presented as an authoritative KEEP", () => {
  const lowSample = recommendation({ opening: "Dutch Defence", games: 4, wins: 3, draws: 0, losses: 1, scoreRate: 75, verdict: "keep", confidence: "Low" });
  lowSample.sampleSizeStatus = "insufficient_data";
  const view = buildPrimaryReportSummary({ health: { games: 4, confidence: "Low" }, establishedStrength: lowSample });

  assert.equal(view.keep.available, false);
  assert.equal(view.keep.label, "Not enough evidence");
  assert.equal(view.keep.opening, "Dutch Defence");
  assert.equal(view.keep.observed.gamesLabel, "4 qualifying games");
  assert.match(view.keep.reason, /more (?:eligible )?games?|enough evidence/i);
});

test("draw-inclusive percentages are named score, never win rate", () => {
  const keep = recommendation({ opening: "Vienna Game", games: 38, wins: 18, draws: 8, losses: 12, scoreRate: 57.9, verdict: "keep" });
  const view = buildPrimaryReportSummary({ authoritative: { establishedStrength: keep } });
  assert.equal(view.keep.observed.scoreRate, "57.9% score");
  assert.doesNotMatch(view.keep.observed.scoreRate, /win rate/i);
});

test("health score always has a deterministic explanation of its limiting factor", () => {
  const view = buildOpeningFitScoreTransparency({
    model: { health: { score: 74 }, header: { games: 30 } },
    report: { repertoireHealth: { version: "repertoire_health_v2", score: 74, components: [{ key: "roleCompleteness", label: "Role completeness", score: 50, weight: 60 }, { key: "evidenceStrength", label: "Evidence strength", score: 90, weight: 40 }] } },
  });
  assert.match(view.explanation, /coverage gap/i);
});

test("Overview keeps one evidence renderer, compact mobile rules, and canonical CTA IDs", async () => {
  const source = await readFile(new URL("../components/PrimaryReportSummary.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../components/PrimaryReportSummary.css", import.meta.url), "utf8");
  assert.equal((source.match(/function DecisionEvidence/g) || []).length, 1);
  assert.equal((source.match(/data-command-role="keep"/g) || []).length, 1);
  assert.equal((source.match(/data-command-role="repair"/g) || []).length, 1);
  assert.equal((source.match(/data-command-role="train-next"/g) || []).length, 1);
  assert.match(source, /<h2[^>]*>\{scoreView\.scoreDisplayLabel\}[^<]+\{scoreView\.developmentState\.label\}<\/h2>\s*<p className="primaryReportHealthSummary">\{scoreView\.explanation\}<\/p>/);
  assert.match(source, /data-decision-id=\{view\.decisionId \|\| undefined\}/);
  assert.match(source, /data-diagnosis-id=\{view\.diagnosisId \|\| undefined\}/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.primaryReportDecisionEvidence p/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.primaryReportCommandGrid \{ grid-template-columns: 1fr; \}/);
});
