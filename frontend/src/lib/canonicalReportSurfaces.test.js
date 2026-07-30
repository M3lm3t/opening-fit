import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOpeningFitScoreTransparency } from "./openingFitScoreTransparency.js";
import { fitBand } from "./fitTrustModel.js";
import { describeLineProvenance } from "./lineProvenance.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { buildReportDecisionModel, openingPerspective } from "./reportDecisionModel.js";
import { reportExclusionSummary } from "./reportGameCounts.js";
import { buildCoachSummary } from "../services/retentionJourney.js";

function recommendation({ id, opening, role, repertoireRole, verdict = "keep", games = 5, findingType = "stable_strength" }) {
  return {
    recommendationId: id,
    openingName: opening,
    opening,
    role,
    repertoireRole,
    relationship: role.startsWith("played_") ? "played" : "faced",
    repertoireOwned: role.startsWith("played_"),
    verdict,
    findingType,
    sample: { games, wins: games, draws: 0, losses: 0, gameIds: Array.from({ length: games }, (_, index) => `${id}-${index}`) },
    confidence: { level: "medium", sampleSize: games },
    trainingAction: { title: `Review ${opening}`, explanation: `${games} supporting games justify this decision.` },
    evidenceCounts: { importedGames: 78, eligibleGames: 40, classifiedOpeningGames: 12, roleAttributedGames: games, supportingGames: games, excludedGames: 38 },
    supportingGameCount: games,
    requiredGameCount: 5,
    confidenceReasonCode: games >= 5 ? "supported_medium_confidence" : "supporting_sample_below_threshold",
    confidenceExplanation: `78 games were identified in this opening family. ${games} consistently support this decision.`,
  };
}

function canonicalReport() {
  const strength = recommendation({ id: "vienna:white", opening: "Vienna Game", role: "played_as_white", repertoireRole: "white" });
  const preparation = recommendation({ id: "caro:white", opening: "Caro-Kann Defence", role: "faced_as_white", repertoireRole: "white", verdict: "explore", findingType: "preparation_opportunity" });
  return {
    username: "Fixture",
    gamesAnalysed: 40,
    openingFitScore: 63,
    gameCounts: { contractVersion: 2, fetchedGames: 78, analysedGames: 40, excludedGames: 38, exclusionReasons: { bullet: 30, missingOpeningSignal: 8 } },
    repertoireCoverageScore: {
      formulaVersion: "repertoire_coverage_v2",
      score: 63,
      components: [
        { key: "repertoireCompleteness", label: "Repertoire completeness", score: 33.3, weight: 60, contribution: 19.98 },
        { key: "evidenceConfidence", label: "Evidence confidence", score: 50, weight: 40, contribution: 20 },
      ],
      repairStatus: { label: "No reliable repair target yet", explanation: "No repair target met the threshold." },
    },
    topOpenings: [{ name: "Stale low result", games: 20, wins: 0, draws: 0, losses: 20, openingRole: "played_as_black", repertoireSlot: "black_vs_e4" }],
    reportDecision: {
      schemaVersion: 3,
      recommendations: [strength, preparation],
      establishedStrength: strength,
      primaryProblem: null,
      nextTrainingAction: { type: "prepare_against", opening: "Caro-Kann Defence", role: "faced_as_white", repertoireRole: "white", findingType: "preparation_opportunity", recommendationId: preparation.recommendationId, sample: preparation.sample, label: "Prepare against the Caro-Kann Defence", reason: "This is preparation, not a weakness." },
      trainingPriority: { priorityId: "priority-caro", taskId: "priority-caro", recommendationId: preparation.recommendationId, openingName: "Caro-Kann Defence", role: "faced_as_white", repertoireRole: "white", findingType: "preparation_opportunity", evidenceCount: 5, estimatedDurationMinutes: 10, rationale: "This is preparation, not a weakness." },
      repertoireRoles: [
        { key: "white", repertoireRole: "white", status: "established", openingName: "Vienna Game", evidenceCount: 5, supportingGameCount: 5, evidenceReasonCode: null },
        { key: "black_e4", repertoireRole: "black_vs_e4", status: "insufficient", openingName: null, evidenceCount: 0, supportingGameCount: 0, evidenceReasonCode: "unsupported_or_unknown", compatibleAlternative: { openingName: "French Defence", repertoireRole: "black_vs_d4" }, alternativeRole: "black_vs_d4" },
        { key: "black_d4", repertoireRole: "black_vs_d4", status: "building", openingName: "Nimzo-Indian Defence", evidenceCount: 3, supportingGameCount: 3, evidenceReasonCode: "below_evidence_threshold" },
      ],
      findings: [{ type: "preparation_opportunity", opening: "Caro-Kann Defence", repertoireRole: "white" }],
      reportCoverage: { level: "moderate", gamesAnalysed: 40 },
      confidence: { status: "sufficient", gamesAnalysed: 40, minimumOpeningGames: 5 },
      baseline: { status: "baseline", hasComparablePrevious: false, comparisonClaimsAllowed: false },
    },
  };
}

test("all canonical report models retain the same weekly preparation priority", () => {
  const report = canonicalReport();
  const model = buildReportDecisionModel(report);
  const summary = buildPrimaryReportSummary(model, report);
  const retention = buildCoachSummary({ data: report });
  assert.equal(model.coachingPriority.openingName, "Caro-Kann Defence");
  assert.equal(summary.trainingPriority.openingName, "Caro-Kann Defence");
  assert.match(retention.nextStep, /Caro-Kann/i);
  assert.doesNotMatch(retention.needsAttention, /Stale low result/);
});

test("supported Vienna and Scandinavian samples keep summary and role-card decisions aligned", () => {
  const report = canonicalReport();
  const scandinavian = recommendation({ id: "scandinavian:black-e4", opening: "Scandinavian Defence", role: "played_as_black", repertoireRole: "black_vs_e4", verdict: "keep", games: 20 });
  report.reportDecision.recommendations = [report.reportDecision.establishedStrength, scandinavian, ...report.reportDecision.recommendations.slice(1)];
  report.reportDecision.repertoireRoles = [
    report.reportDecision.repertoireRoles[0],
    { key: "black_e4", repertoireRole: "black_vs_e4", status: "established", openingName: "Scandinavian Defence", evidenceCount: 20, supportingGameCount: 20, requiredGameCount: 5 },
    report.reportDecision.repertoireRoles[2],
  ];

  const model = buildReportDecisionModel(report);
  const summary = buildPrimaryReportSummary(model, report);
  const white = summary.slots.find((item) => item.key === "white");
  const blackE4 = summary.slots.find((item) => item.key === "black_e4");
  const blackCard = model.repertoire.find((item) => item.key === "black_e4");

  assert.equal(white.opening, "Vienna Game");
  assert.equal(white.status, "established");
  assert.equal(blackE4.opening, "Scandinavian Defence");
  assert.equal(blackE4.status, "established");
  assert.equal(blackE4.verdict, blackCard.verdict);
  assert.equal(blackCard.source.verdict, "keep");
  assert.match(blackCard.confidenceExplanation, /20/);
  assert.doesNotMatch(blackCard.confidenceExplanation, /insufficient/i);
});

test("active report history and training surfaces do not reintroduce legacy conclusions", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const history = readFileSync(new URL("../components/ReportHistoryVault.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /<OpeningCoachPlan|<OpeningFitRetentionCommandCenter/);
  assert.match(history, /normaliseReportDecision/);
  assert.match(history, /canonical\.primaryProblem\?\.opening \|\| "No reliable weakness"/);
});

test("insufficient roles stay unestablished, reject cross-role alternatives and avoid practice", () => {
  const report = canonicalReport();
  const model = buildReportDecisionModel(report);
  const role = model.repertoire.find((item) => item.role === "black_vs_e4");
  assert.equal(role.status, "insufficient");
  assert.equal(role.statusLabel, "Not enough evidence");
  assert.equal(role.complete, false);
  assert.equal(role.compatibleAlternative, null);
  assert.equal(role.contextualAction.type, "analyse");
  assert.notEqual(role.contextualAction.label, "Practise this role");
  const established = model.repertoire.find((item) => item.role === "white");
  assert.match(established.confidenceExplanation, /12 games were identified.*5 consistently reached a position/i);
});

test("coverage explanation uses role reason codes and hides an unexplained precise score", () => {
  const report = canonicalReport();
  const model = buildReportDecisionModel(report);
  const explained = buildOpeningFitScoreTransparency({ model, report });
  const forming = buildOpeningFitScoreTransparency({ model: { ...model, health: { ...model.health, score: 63 } }, report: { openingFitScore: 63 } });
  assert.match(explained.weaknessContext, /supporting-game threshold|role-specific evidence/);
  assert.equal(explained.scoreDisplayLabel, "63%");
  assert.equal(forming.scoreDisplayLabel, "Score still forming");
});

test("exclusion summaries use recorded counts and disclose high exclusion impact", () => {
  const summary = reportExclusionSummary({ gameCounts: { contractVersion: 2, fetchedGames: 100, analysedGames: 40, exclusionReasons: { bullet: 50, missingOpeningSignal: 10 } } });
  assert.match(summary.summary, /60 excluded: 50 did not match the selected time controls, 10 did not contain enough opening information/i);
  assert.match(summary.confidenceNote, /More than half/);
  assert.equal(reportExclusionSummary({ gamesImported: 20, gamesAnalysed: 10, gamesExcluded: 10 }).summary, "A detailed exclusion breakdown is unavailable for this older report.");
});

test("line provenance never promotes tiny observed evidence to recommended theory", () => {
  const observed = describeLineProvenance({ line: "1. e4 e5", sampleSize: 2, sourceGameIds: ["a", "b"] });
  const setup = describeLineProvenance({ line: "1. d4 d5" });
  assert.equal(observed.label, "Observed line from your games");
  assert.match(observed.note, /not a repertoire recommendation/);
  assert.equal(setup.label, "Recommended setup");
});

test("Mixed is not used as player colour and legacy reports remain safe", () => {
  assert.equal(fitBand(50), "Developing fit");
  assert.equal(openingPerspective({ name: "Legacy opening" }).userColour, "unknown");
  assert.doesNotThrow(() => buildReportDecisionModel({ gamesAnalysed: 2, topOpenings: [{ name: "Legacy opening", games: 2 }] }));
});
