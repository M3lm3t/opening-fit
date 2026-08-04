import assert from "node:assert/strict";
import test from "node:test";

import { canonicalResultAggregate } from "./reportResults.js";
import { FABIO_PRODUCTION_RESPONSE_FIXTURE } from "./fixtures/fabioProductionResponseFixture.js";
import { candidateFailureMessage, commitReportCandidate, evaluateReportCandidate, REPORT_CANDIDATE_RESULTS } from "./reportCandidateTransaction.js";
import { LOCAL_REPORT_SCHEMA_VERSION, readPersistedReport } from "./reportPersistence.js";

const key = "openingFit:lastAnalysis";
const clone = (value = FABIO_PRODUCTION_RESPONSE_FIXTURE) => structuredClone(value);

function candidate(id = "fabio-production-3m") {
  return { ...clone(), analysisId: id, analysis_id: id, analysisCompleted: true, analysis_completed: true };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, String(value)),
    removeItem: (name) => values.delete(name),
  };
}

function save(storage, report = candidate()) {
  return commitReportCandidate({
    storage,
    key,
    report,
    payload: { username: "fabiowaintraub", platform: "chess.com", savedAt: "2026-08-04T21:49:12.114Z" },
  });
}

test("the backend-shaped Fabio response passes the exact canonical candidate transaction", () => {
  const storage = memoryStorage();
  const result = save(storage);
  const restoredRaw = storage.getItem(key);
  const restored = readPersistedReport(storage, key);
  const vienna = result.candidate.top_openings.find((row) => row.name === "Vienna Game");

  assert.equal(result.ok, true);
  assert.equal(result.type, REPORT_CANDIDATE_RESULTS.ACCEPTED);
  assert.equal(result.serialized, restoredRaw);
  assert.equal(restored.ok, true);
  assert.equal(restored.payload.schemaVersion, LOCAL_REPORT_SCHEMA_VERSION);
  assert.equal(restored.analysis.analysisId, "fabio-production-3m");
  assert.deepEqual(canonicalResultAggregate(vienna, { precision: 2 }), { games: 60, wins: 36, draws: 3, losses: 21, knownResults: 60, scoreRate: 62.5 });
  assert.equal(result.presentation.trainingPriority.subjectType, "role_gap");
  assert.equal(result.presentation.trainingPriority.subjectRole, "black_vs_e4");
  assert.equal(result.presentation.trainingPriority.openingName, null);
  assert.equal(result.candidate.reportDecision.repertoireRoles.filter((row) => row.repertoireRole.startsWith("black_")).every((row) => row.status === "insufficient" && row.currentOpening == null), true);
  assert.doesNotMatch(JSON.stringify(result.candidate), /Nimzo|"scoreRate":72|"scoreRate":62(?!\.5)/i);
});

test("the first live incompatibility is optional after a safe unresolved-role downgrade", () => {
  const report = candidate();
  const white = report.reportDecision.repertoireRoles[0];
  const blackD4 = report.reportDecision.repertoireRoles[2];
  assert.deepEqual([white.supportingGameCount, white.evidenceRequirement.additionalRelevantGamesRequired], [0, 0]);
  assert.deepEqual([blackD4.supportingGameCount, blackD4.evidenceRequirement.additionalRelevantGamesRequired], [0, 4]);
  assert.equal(evaluateReportCandidate(report).ok, true);

  white.status = "established";
  white.currentOpening = "Vienna Game";
  const rejected = evaluateReportCandidate(report);
  assert.equal(rejected.type, REPORT_CANDIDATE_RESULTS.CONSISTENCY_REJECTED);
  assert.equal(rejected.violations[0], "games_needed_mismatch:white");
});

test("candidate transaction matrix preserves report A byte-for-byte on every failure", () => {
  const reportAStorage = memoryStorage();
  assert.equal(save(reportAStorage, candidate("report-a")).ok, true);
  const bytesA = reportAStorage.getItem(key);

  const valid = save(reportAStorage, candidate("report-b"));
  assert.equal(valid.ok, true);
  assert.equal(readPersistedReport(reportAStorage, key).analysis.analysisId, "report-b");

  const cases = [];
  const contractInvalid = candidate("contract-invalid");
  contractInvalid.reportDecision.repertoireRoles[1] = {
    repertoireRole: "black_vs_e4", status: "building", currentOpening: "Illegal context",
    supportingGameCount: 1, evidenceGameIds: ["d4-only"], requiredGameCount: 5,
  };
  contractInvalid.analysis_game_index = [{ gameId: "d4-only", playerColour: "black", relationship: "played_by_user", firstWhiteMove: "d4" }];
  cases.push([REPORT_CANDIDATE_RESULTS.CONTRACT_REJECTED, contractInvalid]);

  const consistencyInvalid = candidate("consistency-invalid");
  consistencyInvalid.reportDecision.recommendations.push(structuredClone(consistencyInvalid.reportDecision.recommendations[0]));
  cases.push([REPORT_CANDIDATE_RESULTS.CONSISTENCY_REJECTED, consistencyInvalid]);

  for (const [type, report] of cases) {
    const storage = memoryStorage({ [key]: bytesA });
    const result = save(storage, report);
    assert.equal(result.type, type);
    assert.equal(storage.getItem(key), bytesA);
  }

  const throwingBase = memoryStorage({ [key]: bytesA });
  let writeAttempts = 0;
  const writeFailure = {
    ...throwingBase,
    setItem(name, value) {
      writeAttempts += 1;
      if (writeAttempts === 1) throw new Error("quota");
      throwingBase.setItem(name, value);
    },
  };
  assert.equal(save(writeFailure, candidate("write-failure")).type, REPORT_CANDIDATE_RESULTS.WRITE_FAILED);
  assert.equal(throwingBase.getItem(key), bytesA);

  const mismatchBase = memoryStorage({ [key]: bytesA });
  let mismatch = true;
  const readbackMismatch = {
    ...mismatchBase,
    setItem(name, value) {
      mismatchBase.setItem(name, mismatch ? "truncated" : value);
      mismatch = false;
    },
  };
  assert.equal(save(readbackMismatch, candidate("readback-failure")).type, REPORT_CANDIDATE_RESULTS.READBACK_FAILED);
  assert.equal(mismatchBase.getItem(key), bytesA);

  // Backend failure and cancellation never enter the candidate transaction.
  assert.equal(memoryStorage({ [key]: bytesA }).getItem(key), bytesA);
  assert.equal(memoryStorage({ [key]: bytesA }).getItem(key), bytesA);
});

test("serialization failures are distinct and never touch report A", () => {
  const base = memoryStorage();
  assert.equal(save(base, candidate("report-a")).ok, true);
  const bytesA = base.getItem(key);
  const cyclic = candidate("cyclic-report");
  cyclic.corruptStorageValue = cyclic;
  const result = save(base, cyclic);
  assert.equal(result.type, REPORT_CANDIDATE_RESULTS.SERIALISATION_FAILED);
  assert.equal(base.getItem(key), bytesA);
});

test("contract rejection copy is not mislabeled as persistence or cloud failure", () => {
  const invalid = candidate("contract-copy");
  invalid.reportDecision.repertoireRoles[1] = {
    repertoireRole: "black_vs_e4", status: "building", currentOpening: "Illegal context",
    supportingGameCount: 1, evidenceGameIds: ["d4-only"], requiredGameCount: 5,
  };
  invalid.analysis_game_index = [{ gameId: "d4-only", playerColour: "black", relationship: "played_by_user", firstWhiteMove: "d4" }];
  const rejected = evaluateReportCandidate(invalid);
  const message = candidateFailureMessage(rejected, { hadPreviousReport: false });
  assert.equal(message.message, "We analysed the games but could not safely build the report. Your previous report was not replaced.");
  assert.equal(message.category, REPORT_CANDIDATE_RESULTS.CONTRACT_REJECTED);
  assert.match(message.referenceCode, /^OF-[A-Z0-9]+$/);
  assert.doesNotMatch(JSON.stringify(message), /cloud|persistence verification|remains available on this device/i);
  assert.deepEqual(message.recoveryActions, ["retry"]);
});

test("mixed training subjects and contradictory canonical verdicts still fail closed", () => {
  const mixed = candidate("mixed-training");
  mixed.reportDecision.nextTrainingAction = {
    subjectType: "opening", subjectRole: "white", repertoireRole: "white",
    openingName: "Vienna Game", openingKey: "vienna-game",
  };
  const mixedResult = evaluateReportCandidate(mixed);
  assert.equal(mixedResult.type, REPORT_CANDIDATE_RESULTS.CONTRACT_REJECTED);
  assert.ok(mixedResult.violations.includes("mixed_training_subjects"));

  const contradictory = candidate("contradictory-verdict");
  const evidenceIds = Array.from({ length: 5 }, (_, index) => `english-${index + 1}`);
  const confidence = {
    sampleSizeConfidence: { level: "sufficient", label: "Sufficient" },
    classificationConfidence: { level: "trusted", label: "Opening side classified" },
    roleAttributionConfidence: { level: "trusted", label: "Role verified" },
    recommendationConfidence: { level: "sufficient", label: "Sufficient" },
  };
  const original = {
    ...confidence, recommendationId: "opening-aggregate:vienna:white", decisionId: "keep-vienna",
    canonicalContextId: "vienna:white", canonicalAggregateId: "opening-aggregate:vienna:white",
    openingId: "vienna-game", openingName: "Vienna Game", playerColour: "white", repertoireRole: "white",
    role: "played_as_white", relationship: "played_by_user", verdict: "keep",
    sample: { games: 5, wins: 4, draws: 0, losses: 1, gameIds: evidenceIds }, supportingGameCount: 5,
  };
  const duplicate = { ...structuredClone(original), decisionId: "repair-vienna", verdict: "repair", sample: { games: 5, wins: 0, draws: 1, losses: 4, gameIds: evidenceIds } };
  contradictory.reportDecision.recommendations = [original, duplicate];
  contradictory.analysis_game_index = evidenceIds.map((gameId) => ({ gameId, canonicalContextId: original.canonicalContextId, playerColour: "white", relationship: "played_by_user", firstWhiteMove: "e4" }));
  const contradictoryResult = evaluateReportCandidate(contradictory);
  assert.equal(contradictoryResult.type, REPORT_CANDIDATE_RESULTS.CONSISTENCY_REJECTED);
  assert.ok(contradictoryResult.violations.includes(`conflicting_verdict:${duplicate.canonicalContextId}`));
});
