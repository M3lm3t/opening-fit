import assert from "node:assert/strict";
import test from "node:test";

import { SAMPLE_REPORT } from "../fixtures/sampleReport.js";
import { buildCanonicalReportPresentation, formatCanonicalScoreRate } from "./canonicalReportPresentation.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";

const ids = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

function fabioReport() {
  const viennaIds = ids("fabio-vienna", 8);
  const vienna = {
    contextId: "vienna-game:white", decisionId: "decision:fabio:vienna", recommendationId: "fabio:vienna:white",
    openingId: "vienna-game", openingName: "Vienna Game", role: "played_as_white", repertoireRole: "white",
    relationship: "played_by_user", verdict: "keep", sample: { games: 8, wins: 4, draws: 1, losses: 3, gameIds: viennaIds },
    evidenceConfidence: { level: "low", label: "Low confidence" },
  };
  const priority = {
    priorityId: "priority:fabio:black-e4", taskId: "task:fabio:black-e4", decisionId: "decision:fabio:black-e4",
    findingType: "repertoire_gap", subjectType: "role_gap", repertoireRole: "black_vs_e4", subjectRole: "black_vs_e4",
    title: "Establish a Black against 1.e4 choice", rationale: "No correctly attributed opening is established for this role yet.",
  };
  return {
    analysisId: "fabio-production-shaped", username: "Fabio", gamesAnalysed: 38,
    gameCounts: { gamesFetched: 47, eligible: 43, gamesParsed: 43, gamesAttributed: 38, gamesClassified: 38, gamesUsedForOpeningStats: 38, gamesExcluded: 9 },
    reportDecision: {
      decisionId: "decision:fabio", recommendations: [vienna], establishedStrength: vienna, primaryProblem: null,
      confidence: { status: "low", label: "Low confidence" },
      repertoireRoles: [
        { key: "white", repertoireRole: "white", status: "established", openingName: "Vienna Game", evidenceCount: 8, supportingGameCount: 8 },
        { key: "black_e4", repertoireRole: "black_vs_e4", status: "insufficient", evidenceCount: 0, supportingGameCount: 0, decisionId: priority.decisionId },
        { key: "black_d4", repertoireRole: "black_vs_d4", status: "insufficient", evidenceCount: 0, supportingGameCount: 0, decisionId: "decision:fabio:black-d4" },
      ],
      nextTrainingAction: { ...priority, type: "fill_repertoire_gap", label: priority.title, reason: priority.rationale },
      trainingPriority: priority,
      repertoireHealth: { version: "repertoire_health_v2", score: 60 },
    },
    problem_lines: [
      { contextId: "queens-pawn:black", role: "played_as_black", description: "Duplicate legacy row" },
      { contextId: "queens-pawn:black", role: "played_as_black", description: "Duplicate legacy row" },
    ],
  };
}

function melmetLowDataReport() {
  const priority = { schemaVersion: 3, priorityId: "priority:melmet:black-d4", taskId: "task:melmet:black-d4", decisionId: "decision:melmet:black-d4", findingType: "repertoire_gap", subjectType: "role_gap", subjectRole: "black_vs_d4", repertoireRole: "black_vs_d4", openingName: null, openingKey: null, evidenceGameIds: [], representativeGameIds: [], title: "Establish a Black against 1.d4 choice", rationale: "No correctly attributed opening is established for this role yet." };
  return { analysisId: "melmet-low-data", username: "Melmet", gamesAnalysed: 4, reportDecision: { decisionId: "decision:melmet", recommendations: [{ contextId: "sicilian:faced", openingId: "sicilian-defence", openingName: "Sicilian Defence", role: "faced_as_white", repertoireRole: "white", relationship: "faced_by_user", verdict: "explore", sample: { games: 4, wins: 1, draws: 1, losses: 2, gameIds: ids("sicilian-faced", 4) }, evidenceConfidence: { level: "insufficient" } }], repertoireRoles: [{ repertoireRole: "black_vs_d4", status: "insufficient", evidenceCount: 0, supportingGameCount: 0, decisionId: priority.decisionId }], establishedStrength: null, primaryProblem: null, confidence: { status: "low", label: "Low confidence" }, nextTrainingAction: { ...priority, type: "fill_repertoire_gap" }, trainingPriority: priority, repertoireHealth: { score: 43 } } };
}

function surfaceRecord(report, context) {
  const model = buildReportDecisionModel(report);
  const summary = buildPrimaryReportSummary(model, report);
  const presentation = buildCanonicalReportPresentation(report);
  const fromPresentation = presentation.contexts.find((item) => item.contextId === context.contextId);
  return { model, summary, presentation, context: fromPresentation };
}

test("sample Summary, Repertoire, Problems, Evidence and Health share the fictional canonical contexts", () => {
  const presentation = buildCanonicalReportPresentation(SAMPLE_REPORT);
  assert.deepEqual(presentation.contexts.map(({ openingName, gameCount, wins, draws, losses, scoreRate, verdict }) => ({ openingName, gameCount, wins, draws, losses, scoreRate: formatCanonicalScoreRate(scoreRate), verdict })), [
    { openingName: "Vienna Game", gameCount: 18, wins: 11, draws: 2, losses: 5, scoreRate: "66.7%", verdict: "keep" },
    { openingName: "Queen's Gambit Declined", gameCount: 12, wins: 3, draws: 3, losses: 6, scoreRate: "37.5%", verdict: "repair" },
  ]);
  const model = buildReportDecisionModel(SAMPLE_REPORT);
  const summary = buildPrimaryReportSummary(model, SAMPLE_REPORT);
  assert.equal(summary.keep.opening, presentation.strength.openingName);
  assert.equal(summary.repair.opening, presentation.weakness.openingName);
  assert.equal(model.health.strongest, presentation.strength.openingName);
  assert.equal(model.health.weakest, presentation.weakness.openingName);
});

test("Fabio-shaped report keeps one Vienna identity, exact aggregate, confidence, health and role-gap task", () => {
  const report = fabioReport();
  const expected = buildCanonicalReportPresentation(report).contexts[0];
  const { model, summary, presentation, context } = surfaceRecord(report, expected);
  assert.deepEqual(context, expected);
  assert.deepEqual({ games: context.gameCount, wdl: [context.wins, context.draws, context.losses], score: context.scoreRate, confidence: context.confidenceLabel, verdict: context.verdict }, { games: 8, wdl: [4, 1, 3], score: 56.25, confidence: "Low confidence", verdict: "keep" });
  assert.equal(presentation.healthScore, 60);
  assert.equal(model.health.score, 60);
  assert.equal(model.health.confidence, "Low confidence");
  assert.equal(summary.keep.opening, "Vienna Game");
  assert.equal(summary.trainingPriority.subjectType, "role_gap");
  assert.equal(summary.trainingPriority.subjectRole, "black_vs_e4");
  assert.doesNotMatch(JSON.stringify({ model: model.health, summary, presentation }), /62%|Sicilian Defence|review one recent opening/i);
  assert.equal(model.issues.length, 0);
});

test("Melmet low-data report omits unsupported strengths and weaknesses and preserves faced context", () => {
  const report = melmetLowDataReport();
  const presentation = buildCanonicalReportPresentation(report);
  assert.equal(presentation.healthScore, 43);
  assert.equal(presentation.strength, null);
  assert.equal(presentation.weakness, null);
  assert.equal(presentation.contexts[0].playedByUser, false);
  assert.equal(presentation.trainingPriority.subjectRole, "black_vs_d4");
  assert.doesNotMatch(JSON.stringify({ strength: presentation.strength, weakness: presentation.weakness }), /Sicilian|Vienna/);
});

test("duplicate rows merge only for the same context and perspective", () => {
  const base = fabioReport();
  const duplicate = structuredClone(base.reportDecision.recommendations[0]);
  const faced = { ...structuredClone(duplicate), relationship: "faced_by_user", role: "faced_as_black" };
  base.reportDecision.recommendations = [duplicate, structuredClone(duplicate), faced];
  const contexts = buildCanonicalReportPresentation(base).contexts;
  assert.equal(contexts.length, 2);
  assert.equal(contexts.filter((item) => item.playerPerspective === "played_as_white").length, 1);
  assert.equal(contexts.filter((item) => item.playerPerspective === "faced_as_black").length, 1);
});
