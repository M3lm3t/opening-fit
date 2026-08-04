import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAuthoritativeRoleViewModels, selectAuthoritativeCoachingPriority } from "./authoritativeReportPresentation.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";

const established = (key, opening, games) => ({
  key,
  status: "supported",
  opening,
  games,
  evidenceFunnel: { correctlyAttributed: games, assignedToLeadingOpening: games, distinctAttributedOpenings: 1 },
  evidenceRequirement: { threshold: 5, currentRelevantSample: games },
});

const recommendation = (opening, role, repertoireSlot, games, verdict, fitScore, scoreRate) => ({
  opening,
  openingRole: role,
  repertoireSlot,
  sample: { games, scoreRate },
  verdict,
  fitScore,
  reason: `${games} relevant games support this decision.`,
});

const roleFixture = () => ({
  baseRoles: [
    established("white", "Vienna Game", 60),
    established("black_e4", "Scandinavian Defense", 78),
    established("black_d4", "King's Indian Defense", 7),
  ],
  candidates: [
    recommendation("Vienna Game", "played_as_white", "white", 60, "Keep", 67, 58),
    recommendation("Scandinavian Defense", "played_as_black", "black_vs_e4", 78, "Keep", 62, 54),
    recommendation("King's Indian Defense", "played_as_black", "black_vs_d4", 7, "Repair", 39, 41),
  ],
});

test("one role model preserves the live report verdicts, evidence and British display names", () => {
  const roles = buildAuthoritativeRoleViewModels(roleFixture());
  assert.deepEqual(roles.map(({ key, verdict, relevantGames }) => ({ key, verdict, relevantGames })), [
    { key: "white", verdict: "keep", relevantGames: 60 },
    { key: "black_e4", verdict: "keep", relevantGames: 78 },
    { key: "black_d4", verdict: "repair", relevantGames: 7 },
  ]);
  assert.deepEqual(roles.map((role) => role.status), ["established", "established", "established"]);
  assert.notEqual(roles[0].confidence.level, "insufficient");
  assert.equal(roles[1].displayName, "Scandinavian Defence");
  assert.equal(roles[2].displayName, "King's Indian Defence");
});

test("missing fit does not erase available role evidence or confidence", () => {
  const fixture = roleFixture();
  delete fixture.candidates[0].fitScore;
  const role = buildAuthoritativeRoleViewModels(fixture)[0];
  assert.equal(role.fitScore, null);
  assert.equal(role.fitLabel, "Fit not calculated for this saved report.");
  assert.equal(role.relevantGames, 60);
  assert.notEqual(role.confidence.level, "insufficient");
});

test("legacy and contradictory evidence fail conservatively without invented scores", () => {
  const [legacy] = buildAuthoritativeRoleViewModels({ baseRoles: [{ key: "white", opening: "Vienna Game", games: 3, status: "tentative" }] });
  assert.equal(legacy.status, "building");
  assert.equal(legacy.verdict, "insufficient_evidence");
  assert.equal(legacy.fitScore, null);
  assert.equal(legacy.isLegacyFallback, true);

  const [invalid] = buildAuthoritativeRoleViewModels({ baseRoles: [{ ...established("white", "Vienna Game", 3), games: 3, evidenceFunnel: { correctlyAttributed: 3, assignedToLeadingOpening: 3 } }] });
  assert.equal(invalid.status, "building");
  assert.equal(invalid.dataQuality, "inconsistent_evidence");

  const mismatch = roleFixture();
  mismatch.candidates[0].sample.games = 59;
  const mismatchedRole = buildAuthoritativeRoleViewModels(mismatch)[0];
  assert.equal(mismatchedRole.status, "established");
  assert.equal(mismatchedRole.verdict, "insufficient_evidence");
  assert.equal(mismatchedRole.dataQuality, "inconsistent_evidence");
});

test("a report exposes one Caro-Kann preparation priority and does not substitute Sicilian evidence", () => {
  const reportDecision = {
    nextTrainingAction: {
      type: "prepare_against",
      opening: "Caro-Kann Defense",
      role: "faced_as_white",
      label: "Prepare against the Caro-Kann",
      reason: "You faced it 10 times.",
      sample: { games: 10 },
    },
  };
  const report = {
    analysisId: "report-fixture-1",
    reportDecision,
    best_openings: [{ opening: "Sicilian Defense", openingRole: "faced_as_white", games: 12 }],
  };
  const priority = selectAuthoritativeCoachingPriority(report, { decision: reportDecision, allowFallback: false });
  assert.equal(priority.displayName, "Caro-Kann Defence");
  assert.equal(priority.type, "preparation_opportunity");
  assert.equal(priority.sourceReportId, "report-fixture-1");
  assert.notEqual(priority.displayName, "Sicilian Defence");
});

test("summary completeness and every repertoire renderer consume the authoritative role model", () => {
  const roles = buildAuthoritativeRoleViewModels(roleFixture());
  const summary = buildPrimaryReportSummary({
    repertoire: roles,
    health: { score: 63, games: 145, confidence: "Moderate report coverage" },
    verdict: { paragraph: "Keep the established roles while training one preparation opportunity." },
    authoritative: { establishedStrength: { opening: "Vienna Game", sample: { games: 60 } }, primaryProblem: null, confidence: { status: "sufficient" } },
  });
  assert.equal(summary.establishedRoleCount, 3);
  assert.deepEqual(summary.slots.map((slot) => slot.verdict), roles.map((role) => role.verdict));

  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /getFocusedRepertoirePlan\(data \|\| \{\}, model\)/);
  const decisionMap = app.slice(app.indexOf("function DecisionRepertoireMap"), app.indexOf("function FiniteTrainingSession"));
  assert.match(decisionMap, /model\.repertoire\.map/);
  assert.doesNotMatch(app.slice(app.indexOf("function getFocusedRepertoirePlan(data, model)"), app.indexOf("function movesForReportGame")), /rows:|model\?\.repertoire/);
  assert.doesNotMatch(app.slice(app.indexOf("function DecisionRepertoireMap"), app.indexOf("function FiniteTrainingSession")), /OpeningVerdictSummary/);
  assert.doesNotMatch(app.slice(app.indexOf("function getFocusedRepertoirePlan(data, model)"), app.indexOf("function movesForReportGame")), /focusMission|repertoireRecommendation\?\.focus/);
});

test("the fictional summary uses current role-completeness copy and never calls itself saved", () => {
  const source = readFileSync(new URL("../components/PrimaryReportSummary.jsx", import.meta.url), "utf8");
  assert.match(source, /Role completeness shows whether the fictional repertoire fills all three jobs/);
  const sampleBranch = source.slice(source.indexOf("isSampleReport(report)"), source.indexOf(": [\"repertoire_health_v2\""));
  assert.doesNotMatch(sampleBranch, /saved report/i);
});
