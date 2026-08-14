import assert from "node:assert/strict";
import test from "node:test";

import {
  REPORT_SCHEMA_VERSION,
  adaptReportHistoryRow,
  analysisFingerprint,
  buildReportSnapshot,
  isValidCompletedReport,
  persistReportSnapshot,
} from "./reportSnapshot.js";

function completedReport(platform = "chesscom") {
  return {
    platform,
    username: platform === "lichess" ? "LichessPlayer" : "ChessPlayer",
    gamesImported: 12,
    analysisCompleted: true,
    analysisOwnerUserId: "user-1",
    analysisId: `${platform}-analysis-1`,
    importedAt: "2026-07-16T12:00:00Z",
    analysisTimeFormat: "rapid",
    openingfitScore: 74,
    styleProfile: { label: "Positional" },
    recommendedRepertoirePlan: {
      items: [
        { slot: "main_white", opening: "Queen's Gambit" },
        { slot: "black_vs_e4", opening: "Caro-Kann Defence" },
        { slot: "black_vs_d4", opening: "Queen's Gambit Declined" },
      ],
    },
    topOpenings: [{ name: "Queen's Gambit", games: 5, winRate: 60 }],
  };
}

function memoryClient() {
  const rows = [];
  return {
    rows,
    from() {
      return {
        insert(payload) {
          return {
            select() {
              return {
                async single() {
                  const duplicate = rows.some((row) =>
                    row.user_id === payload.user_id &&
                    ((payload.analysis_id && row.analysis_id === payload.analysis_id) ||
                      (payload.analysis_fingerprint && row.analysis_fingerprint === payload.analysis_fingerprint))
                  );
                  if (duplicate) return { data: null, error: { code: "23505", message: "duplicate" } };
                  const row = { ...payload };
                  rows.push(row);
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        select() {
          const filters = [];
          const query = {
            eq(column, value) {
              filters.push([column, value]);
              return query;
            },
            async maybeSingle() {
              const row = rows.find((candidate) => filters.every(([column, value]) => candidate[column] === value));
              return { data: row || null, error: null };
            },
          };
          return query;
        },
      };
    },
  };
}

test("saves one immutable snapshot and returns it on a duplicate save", async () => {
  const client = memoryClient();
  const report = completedReport();
  const snapshot = buildReportSnapshot({ report, userId: "user-1", reportId: "report-1" });
  const payload = {
    id: "report-1",
    user_id: "user-1",
    report_key: `analysis:${snapshot.analysis_id}`,
    analysis_id: snapshot.analysis_id,
    analysis_fingerprint: analysisFingerprint(report),
    snapshot,
  };

  const first = await persistReportSnapshot(client, payload);
  const duplicate = await persistReportSnapshot(client, { ...payload, id: "report-2" });

  assert.equal(client.rows.length, 1);
  assert.equal(first.id, "report-1");
  assert.equal(duplicate.id, "report-1");
});

test("role evidence accounting survives saved-report serialization and restoration", () => {
  const report = completedReport();
  report.roleEvidenceAccounting = {
    valid: true,
    importedGames: 300,
    eligibleGames: 297,
    excludedGames: 3,
    roleAttributedGames: 290,
    eligibleOutsideCoreRoles: 7,
    attributionErrors: 0,
    diagnosticReference: "role-fixture300",
  };
  const snapshot = buildReportSnapshot({ report, userId: "user-1", reportId: "report-role" });
  const restored = adaptReportHistoryRow({ id: "report-role", user_id: "user-1", normalized_snapshot: snapshot });
  assert.deepEqual(restored.role_evidence_accounting, report.roleEvidenceAccounting);
});

test("adapts an old report without inventing unavailable fields", () => {
  const adapted = adaptReportHistoryRow({
    id: "old-report",
    user_id: "user-1",
    created_at: "2025-01-02T10:00:00Z",
    report: { platform: "chess.com", username: "OldPlayer", totalGames: 4 },
    summary: { topOpenings: [{ name: "Italian Game", games: 2 }] },
  });

  assert.equal(adapted.report_schema_version, REPORT_SCHEMA_VERSION);
  assert.equal(adapted.report_id, "old-report");
  assert.equal(adapted.generated_at, "2025-01-02T10:00:00.000Z");
  assert.equal(adapted.openingfit_score, null);
  assert.equal(adapted.recommendations.white, null);
  assert.equal(adapted.opening_statistics[0].confidence.label, "insufficient data");
});

test("missing optional legacy fields remain null or empty", () => {
  const adapted = adaptReportHistoryRow({ id: "sparse", report: { platform: "lichess", username: "Sparse", totalGames: 1 } });
  assert.equal(adapted.generated_at, null);
  assert.equal(adapted.rating_context, null);
  assert.equal(adapted.new_games_since_previous, null);
  assert.deepEqual(adapted.training_priorities, []);
});

test("normalises Chess.com and Lichess reports into the same schema", () => {
  for (const platform of ["chess.com", "lichess"]) {
    const snapshot = buildReportSnapshot({ report: completedReport(platform), userId: "user-1", reportId: platform });
    assert.equal(snapshot.report_schema_version, REPORT_SCHEMA_VERSION);
    assert.equal(snapshot.source_platform, platform === "lichess" ? "lichess" : "chesscom");
    assert.equal(snapshot.total_games_analysed, 12);
    assert.equal(snapshot.recommendations.black_e4, "Caro-Kann Defence");
  }
});

test("stores structured training outcomes without inventing rating causation", () => {
  const outcome = {
    trainingFocusId: "focus-1", status: "insufficient_data", laterGameCount: 1,
    relevantPositionCount: 1, correctApplicationCount: 1, repeatedMistakeCount: 0,
    beforeMetric: null, afterMetric: { applicationPercent: null, openingResultPercent: null },
    explanation: "There is not enough evidence to judge this.", confidence: "low",
  };
  const snapshot = buildReportSnapshot({ report: { trainingOutcomes: [outcome] }, userId: "user-1", defaultGeneratedAt: false });
  assert.deepEqual(snapshot.training_outcomes, [outcome]);
  assert.doesNotMatch(JSON.stringify(snapshot.training_outcomes), /caused|rating improvement/i);
});

test("persists and restores the canonical training priority", () => {
  const report = {
    ...completedReport(),
    trainingPriority: {
      schemaVersion: 3,
      priorityId: "training-caro:played_as_black",
      recommendationId: "caro:played_as_black",
      openingName: "Caro-Kann Defence",
      role: "played_as_black",
      relationship: "played_by_user",
      evidenceCount: 5,
      evidenceGameIds: ["caro-1", "caro-2"],
      representativeGameIds: ["caro-2"],
      diagnosisId: "diagnosis:caro-position",
      openingDiagnosis: {
        version: "opening_diagnosis_v1", diagnosisId: "diagnosis:caro-position",
        opening: "Caro-Kann Defence", repertoireRole: "black_vs_e4", playerColour: "black",
        precisionLevel: "exact_position", positionFen: "rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2",
        targetPly: 3, commonMovePrefix: { san: "1. e4 c6 2. d4", uci: ["e2e4", "c7c6", "d2d4"] },
        representativeGameIds: ["caro-2"], trainingTask: "Review the diagnosed position.", successCheck: "Rehearse one legal continuation.",
      },
      recognisedLine: "1. e4 c6",
      classificationPly: 2,
      opponentContinuation: { move: "d4", games: 2, supportingGameIds: ["caro-1", "caro-2"] },
      nextGameObjective: "Use the response in the next five relevant games.",
    },
    reportDecision: {
      schemaVersion: 4,
      recommendations: [{
        recommendationId: "caro:played_as_black",
        opening: "Caro-Kann Defence",
        role: "played_as_black",
        verdict: "repair",
        sample: { games: 5, wins: 0, draws: 2, losses: 3, scoreRate: 20 },
      }],
      primaryProblem: {
        recommendationId: "caro:played_as_black",
        opening: "Caro-Kann Defence",
        role: "played_as_black",
        verdict: "repair",
        sample: { games: 5, wins: 0, draws: 2, losses: 3, scoreRate: 20 },
      },
      nextTrainingAction: {
        type: "repair_repertoire",
        recommendationId: "caro:played_as_black",
        opening: "Caro-Kann Defence",
        role: "played_as_black",
        reason: "Five opening-specific games support this repair priority.",
        sample: { games: 5, wins: 0, draws: 2, losses: 3, scoreRate: 20 },
      },
    },
  };
  const snapshot = buildReportSnapshot({ report, userId: "user-1", reportId: "report-caro" });
  const restored = adaptReportHistoryRow({ id: "report-caro", user_id: "user-1", snapshot });

  assert.equal(snapshot.training_priority.openingName, "Caro-Kann Defence");
  assert.equal(snapshot.training_priority.estimatedDurationMinutes, 10);
  assert.equal(restored.training_priority.priorityId, snapshot.training_priority.priorityId);
  assert.equal(restored.training_priority.openingName, "Caro-Kann Defence");
  assert.equal(restored.training_priority.relationship, "played_by_user");
  assert.deepEqual(restored.training_priority.representativeGameIds, ["caro-2"]);
  assert.equal(restored.training_priority.diagnosisId, "diagnosis:caro-position");
  assert.equal(restored.training_priority.openingDiagnosis.positionFen, report.trainingPriority.openingDiagnosis.positionFen);
  assert.equal(restored.training_priority.recognisedLine, "1. e4 c6 2. d4");
  assert.equal(restored.training_priority.classificationPly, 3);
  assert.equal(restored.training_priority.opponentContinuation, null);
  assert.match(restored.training_priority.nextGameObjective, /next five relevant games/i);
  assert.equal(snapshot.report_decision.primaryProblem.verdict, "repair");
  assert.equal(restored.report_decision.primaryProblem.verdict, "repair");
  assert.equal(restored.report_decision.nextTrainingAction.opening, "Caro-Kann Defence");
});

test("persists the score methodology so historical comparisons do not mix versions", () => {
  const scoreContract = {
    formulaVersion: "repertoire_coverage_v2",
    score: 44,
    components: [
      { key: "repertoireCompleteness", score: 33.3, weight: 60, contribution: 19.98 },
      { key: "evidenceConfidence", score: 60, weight: 40, contribution: 24 },
    ],
  };
  const snapshot = buildReportSnapshot({
    report: { ...completedReport(), openingFitScore: 44, openingFitScoreContract: scoreContract, repertoireRoles: [{ key: "white", status: "supported" }] },
    userId: "user-1",
    reportId: "versioned-score",
  });
  const restored = adaptReportHistoryRow({ id: "versioned-score", user_id: "user-1", snapshot });

  assert.equal(snapshot.score_contract.formulaVersion, "repertoire_coverage_v2");
  assert.equal(restored.score_contract.formulaVersion, "repertoire_coverage_v2");
  assert.equal(restored.repertoire_roles[0].key, "white");
});

test("persists the canonical count pipeline and maximum-game selection rule", () => {
  const snapshot = buildReportSnapshot({
    report: { ...completedReport(), gameCounts: {
      contractVersion: 4, gamesFetched: 314, eligible: 281, gamesStructurallyUsable: 281,
      gamesPgnAvailable: 281, gamesParsed: 281, gamesAttributed: 280,
      gamesClassified: 280, gamesUsedForOpeningStats: 279, gamesUnclassified: 0,
      gamesExcluded: 35, analysisLimit: 300, analysisSelectionRule: "newest_first",
      exclusionReasons: { beyondMaximumGameCap: 14, incompleteGame: 19, attributionFailed: 1, notUsedForOpeningStats: 1 },
    } },
    userId: "user-1", reportId: "count-contract",
  });
  assert.equal(snapshot.game_counts.analysisSelectionRule, "newest_first");
  assert.deepEqual([
    snapshot.game_counts.fetchedGames, snapshot.game_counts.gamesStructurallyUsable,
    snapshot.game_counts.gamesClassified, snapshot.game_counts.gamesUsedForOpeningStats,
    snapshot.game_counts.gamesUnclassified, snapshot.game_counts.gamesExcluded,
  ], [314, 281, 280, 279, 0, 35]);
});

test("only completed, owned, non-demo reports are eligible for cloud history", () => {
  const valid = completedReport();
  assert.equal(isValidCompletedReport(valid, {}, "user-1"), true);
  assert.equal(isValidCompletedReport({ ...valid, analysisCompleted: false }, {}, "user-1"), false);
  assert.equal(isValidCompletedReport({ ...valid, analysisOwnerUserId: null }, {}, "user-1"), false);
  assert.equal(isValidCompletedReport({ ...valid, isDemo: true }, {}, "user-1"), false);
});
