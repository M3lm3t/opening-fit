import test from "node:test";
import assert from "node:assert/strict";
import { MELMET_REGRESSION_FIXTURE } from "./fixtures/melmetRegressionFixture.js";
import { buildMeaningfulOpponentResponsePrep, meaningfulOpponentContinuation } from "./opponentContinuation.js";
import { assertGeneratedReportConsistency, enforceReportRoleContract, validateReportConsistency } from "./reportConsistency.js";
import { reportActionForPriority, reportActionUrl } from "./reportViews.js";

const clone = () => structuredClone(MELMET_REGRESSION_FIXTURE);

test("the melmet-style report satisfies every cross-section invariant", () => {
  const result = assertGeneratedReportConsistency(clone());
  assert.equal(result.enforceable, true);
  assert.deepEqual(result.violations, []);
});

test("the fixture keeps opening ownership contexts separate and deduplicates aggregate evidence", () => {
  const report = clone();
  const recommendations = report.reportDecision.recommendations;
  const byId = Object.fromEntries(recommendations.map((row) => [row.recommendationId, row]));
  assert.equal(byId["vienna:white"].verdict, "keep");
  assert.equal(recommendations.filter((row) => row.openingName === "Vienna Game").length, 1);
  assert.equal(byId["scandi:black"].sample.games, 43);
  assert.equal(byId["french:faced"].relationship, "faced");
  assert.equal(recommendations.filter((row) => row.openingName === "King's Indian Defence" && row.repertoireRole === "black_vs_d4").length, 1);
  assert.equal(new Set(byId["kid:black"].sample.gameIds).size, byId["kid:black"].sample.games);
  assert.ok(report.analysis_game_index.length > new Set(report.analysis_game_index.map((game) => game.gameId)).size, "raw fixture must contain a duplicate ID");
  assert.equal(new Set(report.displayedDiagnoses.map((item) => item.diagnosisId)).size, report.displayedDiagnoses.length);
});

test("games-needed, opponent continuation, quality and report destinations agree", () => {
  const report = clone();
  const blackD4 = report.reportDecision.repertoireRoles.find((role) => role.repertoireRole === "black_vs_d4");
  assert.equal(blackD4.gamesNeeded, 3);
  assert.equal(blackD4.evidenceRequirement.additionalRelevantGamesRequired, 3);
  assert.equal(report.reportDecision.primaryAction.completionTarget.count, 3);

  const whiteGame = report.analysis_game_index.find((game) => game.gameId === "vienna-white-1");
  const blackGame = report.analysis_game_index.find((game) => game.gameId === "scandi-black-1");
  assert.deepEqual(meaningfulOpponentContinuation(whiteGame), { reply: "d5", moveIndex: 5, branch: "e4 e5 Nc3 Nf6 f4 d5" });
  assert.equal(meaningfulOpponentContinuation(blackGame).reply, "Nc3");
  assert.ok(buildMeaningfulOpponentResponsePrep(report.analysis_game_index).some((row) => row.openingName === "Vienna Game" && row.reply === "d5"));

  assert.equal(report.importQuality.category, "Usable data");
  assert.equal(report.importQuality.reportCompleteness.complete, false);
  assert.equal(report.reportActions[0].destinationSection, "evidence");
  assert.match(reportActionUrl(report.reportActions[0], { pathname: "/report", search: "" }), /#report-evidence$/);
  assert.match(reportActionUrl(report.reportActions[2], { pathname: "/report", search: "" }), /^\/train\?start=report-task/);
});

test("every priority variant resolves to content that supports the promised action", () => {
  const diagnosed = reportActionForPriority({ type: "repair_repertoire", findingType: "opening_weakness", diagnosisId: "diagnosis-1", decisionId: "decision-1" });
  const repertoire = reportActionForPriority({ type: "collect_more_games", findingType: "insufficient_evidence", repertoireRole: "black_vs_d4", decisionId: "decision-2" });
  const training = reportActionForPriority({ type: "consolidate_strength", findingType: "stable_strength", taskId: "task-3", decisionId: "decision-3" });
  assert.deepEqual([diagnosed.destinationSection, repertoire.destinationSection, training.destinationSection], ["problems", "repertoire", "train"]);
  assert.ok([diagnosed, repertoire, training].every((action) => action.destinationRoute === "/report"));
});

test("the validator detects contradictions but legacy reports remain non-crashing", () => {
  const cases = [
    (report) => { report.reportDecision.recommendations.push({ ...report.reportDecision.recommendations[0], verdict: "repair" }); },
    (report) => { report.reportDecision.recommendations[0].sample.gameIds.push(report.reportDecision.recommendations[0].sample.gameIds[0]); },
    (report) => { report.reportDecision.recommendations[1].playerColour = "white"; },
    (report) => { report.reportDecision.repertoireRoles[2].evidenceRequirement.additionalRelevantGamesRequired = 1; },
    (report) => { report.displayedDiagnoses.push({ ...report.displayedDiagnoses[0] }); },
    (report) => { report.reportActions[0].destinationSection = "repertoire"; },
    (report) => { delete report.reportDecision.recommendations[0].classificationConfidence; },
    (report) => { report.importQuality.category = "Excellent"; },
    (report) => { report.reportDecision.repertoireHealth.components.push({ componentId: "conflict", status: "strength", evidenceSource: "canonical-scandi-diagnosis", targetDecisionId: "opening-decision:scandi:black", explanation: "The same evidence helps the score." }); },
  ];
  for (const mutate of cases) {
    const report = clone();
    mutate(report);
    assert.equal(validateReportConsistency(report).valid, false);
  }
  const legacy = validateReportConsistency({ reportDecision: { recommendations: [{ openingName: "Legacy" }] } });
  assert.equal(legacy.enforceable, false);
  assert.doesNotThrow(() => assertGeneratedReportConsistency({ reportDecision: { recommendations: [{ openingName: "Legacy" }] } }));
});

test("role legality is rechecked from every supporting game's colour and first move", () => {
  const legal = clone();
  assert.equal(validateReportConsistency(legal).valid, true);
  const illegal = clone();
  illegal.analysis_game_index.filter((game) => game.gameId.startsWith("kid-black-d4-")).forEach((game) => { game.moves[0] = "e4"; });
  assert.ok(validateReportConsistency(illegal).violations.some((violation) => violation.startsWith("illegal_role_support:black_vs_d4:")));
});

test("the production response boundary cannot reconstruct a d4 opening under black versus e4", () => {
  const games = ["d4-1", "d4-2"].map((gameId) => ({
    gameId,
    playerColour: "black",
    relationship: "played_by_user",
    firstWhiteMove: "d4",
    opening: "Nimzo-Indian Defence",
  }));
  const unresolvedE4 = {
    key: "black_e4", repertoireRole: "black_vs_e4", status: "insufficient", currentOpening: null,
    supportingGameCount: 0, evidenceGameIds: [], requiredGameCount: 5,
  };
  const d4 = {
    key: "black_d4", repertoireRole: "black_vs_d4", status: "building", currentOpening: "Nimzo-Indian Defence",
    supportingGameCount: 2, evidenceGameIds: ["d4-1", "d4-2"], requiredGameCount: 5,
  };
  const recommendation = {
    recommendationId: "nimzo:d4", openingName: "Nimzo-Indian Defence", repertoireRole: "black_vs_d4",
    playerColour: "black", relationship: "played_by_user", sample: { games: 2, gameIds: ["d4-1", "d4-2"] },
    sampleSizeConfidence: { label: "Early" }, classificationConfidence: { label: "Known" },
    roleAttributionConfidence: { label: "Verified" }, recommendationConfidence: { label: "Early" },
  };
  const malformedLegacy = { ...recommendation, recommendationId: "nimzo:legacy-e4", repertoireRole: "black_vs_e4" };
  const source = {
    analysis_game_index: games,
    reportDecision: { schemaVersion: 5, repertoireRoles: [unresolvedE4, d4], recommendations: [recommendation, malformedLegacy] },
  };
  const contract = enforceReportRoleContract(source);

  assert.equal(contract.valid, false);
  assert.deepEqual(contract.report.reportDecision.recommendations.map((row) => row.repertoireRole), ["black_vs_d4"]);
  assert.equal(contract.report.reportDecision.repertoireRoles.find((row) => row.repertoireRole === "black_vs_e4").currentOpening, null);
  assert.equal(contract.report.reportDecision.repertoireRoles.find((row) => row.repertoireRole === "black_vs_d4").currentOpening, "Nimzo-Indian Defence");
  assert.equal(validateReportConsistency(contract.report).valid, true);
});

test("opening-level and repeated-line diagnosis scopes remain nested and reconciled", () => {
  const diagnosis = clone().reportDecision.openingDiagnosis;
  assert.equal(diagnosis.openingScopeEvidence.supportingGameCount, 43);
  assert.equal(diagnosis.repeatedLineEvidence.supportingGameCount, 4);
  assert.ok(diagnosis.repeatedLineEvidence.supportingGameIds.every((id) => diagnosis.openingScopeEvidence.supportingGameIds.includes(id)));
  assert.doesNotMatch(diagnosis.userFacingDiagnosis, /no single repeated legal position or variation/i);
});

test("health explanations retain metric, context, unique evidence and exact destination", () => {
  for (const component of clone().reportDecision.repertoireHealth.components) {
    assert.ok(component.metric);
    assert.ok(component.context);
    assert.equal(component.supportingGameCount, new Set(component.supportingGameIds).size);
    assert.ok(component.destinationActionId);
    assert.match(component.explanation, /\d+.*game/i);
  }
});
