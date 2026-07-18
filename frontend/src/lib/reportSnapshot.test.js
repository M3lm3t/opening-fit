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

test("only completed, owned, non-demo reports are eligible for cloud history", () => {
  const valid = completedReport();
  assert.equal(isValidCompletedReport(valid, {}, "user-1"), true);
  assert.equal(isValidCompletedReport({ ...valid, analysisCompleted: false }, {}, "user-1"), false);
  assert.equal(isValidCompletedReport({ ...valid, analysisOwnerUserId: null }, {}, "user-1"), false);
  assert.equal(isValidCompletedReport({ ...valid, isDemo: true }, {}, "user-1"), false);
});
