import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTrainingPriorityTitle,
  resolveTrainingPriority,
  trainingPlanMatchesPriority,
} from "./trainingPriority.js";
import { buildFoundationalWeeklyPlan } from "./thisWeekTraining.js";
import { countNoun, formatResultCounts } from "./reportGameCounts.js";

const caroDecision = {
  recommendations: [{
    recommendationId: "caro-kann:defence:played_as_black",
    openingName: "Caro-Kann Defence",
    openingId: "caro-kann-defense",
    role: "played_as_black",
    repertoireRole: "black_vs_e4",
    sample: { games: 60, gameIds: ["game-1", "game-2"] },
    confidence: { level: "medium" },
  }],
  nextTrainingAction: {
    type: "repair_repertoire",
    recommendationId: "caro-kann:defence:played_as_black",
    opening: "Caro-Kann Defence",
    role: "played_as_black",
    repertoireRole: "black_vs_e4",
    reason: "60 opening-specific games support this repair priority.",
  },
};

test("normalises the report decision into one stable training priority", () => {
  const priority = resolveTrainingPriority({ analysisId: "analysis-1", reportDecision: caroDecision }, { allowFallback: false });

  assert.equal(priority.priorityId, "training-caro-kann:defence:played_as_black");
  assert.equal(priority.openingName, "Caro-Kann Defence");
  assert.equal(priority.playerColour, "black");
  assert.equal(priority.playerRole, "black_vs_e4");
  assert.equal(priority.evidenceCount, 60);
  assert.equal(priority.estimatedDurationMinutes, 10);
  assert.equal(priority.fallback, false);
  assert.equal(formatTrainingPriorityTitle(priority), "This week: practise Caro-Kann Defence for approximately 10 minutes.");
});

test("an explicit priority reconciles to its evidence-backed recommendation", () => {
  const priority = resolveTrainingPriority({
    reportDecision: caroDecision,
    trainingPriority: {
      priorityId: "training-caro-kann:defence:played_as_black",
      recommendationId: "caro-kann:defence:played_as_black",
      openingName: "Vienna Game",
      estimatedDurationMinutes: 10,
    },
  }, { allowFallback: false });

  assert.equal(priority.openingName, "Caro-Kann Defence");
});

test("the honest fallback is marked and uses only opening-specific evidence", () => {
  const priority = resolveTrainingPriority({
    gamesImported: 311,
    gamesAnalysed: 280,
    topOpenings: [{ name: "Vienna Game", games: 60 }],
  });

  assert.equal(priority.fallback, true);
  assert.equal(priority.evidenceCount, 60);
  assert.match(priority.fallbackReason, /60 relevant games support Vienna Game overall/);
  assert.match(priority.fallbackReason, /not enough repeated examples of one Vienna Game branch/);
  assert.doesNotMatch(priority.fallbackReason, /311|280/);
});

test("collect-more-games recovery remains an analysis action rather than a fabricated training priority", () => {
  const report = { reportDecision: { nextTrainingAction: { type: "collect_more_games", label: "Collect more games", reason: "Evidence is limited." } } };
  assert.equal(resolveTrainingPriority(report, { allowFallback: false }), null);
  assert.equal(resolveTrainingPriority(report).fallback, true);
});

test("an unresolved Black-vs-d4 role cannot inherit an unrelated established opening", () => {
  const report = {
    topOpenings: [{ name: "Vienna Game", games: 60 }],
    reportDecision: {
      repertoireRoles: [
        { repertoireRole: "black_vs_e4", status: "insufficient", supportingGameCount: 0 },
        { repertoireRole: "black_vs_d4", status: "insufficient", supportingGameCount: 0 },
      ],
      nextTrainingAction: { type: "collect_more_games", repertoireRole: "black_vs_d4" },
    },
  };
  const priority = resolveTrainingPriority(report);
  const plan = buildFoundationalWeeklyPlan({ report, now: new Date("2026-08-01T12:00:00Z") });

  assert.equal(priority.openingName, "Black against 1.d4 preparation");
  assert.equal(priority.repertoireRole, "black_vs_d4");
  assert.doesNotMatch(JSON.stringify(plan), /Vienna/);
  assert.ok(plan.tasks.every((task) => task.openingName === "Black against 1.d4 preparation"));
});

test("cached plans match only the exact report priority", () => {
  const priority = resolveTrainingPriority({ reportDecision: caroDecision }, { allowFallback: false });
  assert.equal(trainingPlanMatchesPriority({ trainingPriorityId: priority.priorityId }, priority), true);
  assert.equal(trainingPlanMatchesPriority({ trainingPriorityId: "training-vienna" }, priority), false);
  assert.equal(trainingPlanMatchesPriority({}, priority), false);
});

test("the report priority and the Train plan retain the same canonical ID", () => {
  const report = {
    analysisId: "analysis-caro",
    reportDecision: caroDecision,
    trainingPriority: {
      schemaVersion: 2,
      priorityId: "training-caro-kann:defence:played_as_black",
      recommendationId: "caro-kann:defence:played_as_black",
      openingName: "Caro-Kann Defence",
      role: "played_as_black",
      relationship: "played_by_user",
      evidenceCount: 60,
      evidenceGameIds: ["game-1", "game-2"],
      representativeGameIds: ["game-2"],
      nextGameObjective: "Use the rehearsed response in the next five relevant games.",
    },
  };
  const reportPriority = resolveTrainingPriority(report, { allowFallback: false });
  const trainPlan = buildFoundationalWeeklyPlan({ report, now: new Date("2026-08-01T12:00:00Z") });

  assert.equal(trainPlan.trainingPriorityId, reportPriority.priorityId);
  assert.equal(trainPlan.tasks[0].trainingPriorityId, reportPriority.priorityId);
  assert.equal(trainPlan.tasks[0].representativeGameIds[0], "game-2");
});

test("a saved canonical diagnosis wins over conflicting frontend fallback fields", () => {
  const diagnosis = {
    version: "opening_diagnosis_v1",
    diagnosisId: "diagnosis:queen-pawn-position",
    opening: "Queen Pawn Game",
    repertoireRole: "white",
    playerColour: "white",
    precisionLevel: "exact_position",
    positionFen: "rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq - 2 3",
    targetPly: 4,
    commonMovePrefix: { san: "1. d4 d5 2. Nf3 Nf6", uci: ["d2d4", "d7d5", "g1f3", "g8f6"] },
    representativeGameIds: ["game-2"],
    trainingTask: "Replay the supplied game to this position and choose one legal continuation to test.",
    successCheck: "Rehearse the chosen continuation three times.",
  };
  const report = {
    analysisId: "analysis-diagnosis",
    reportDecision: {
      ...caroDecision,
      openingDiagnosis: diagnosis,
      trainingPriority: {
        schemaVersion: 3,
        priorityId: "training-queen-pawn",
        recommendationId: "caro-kann:defence:played_as_black",
        openingName: "Wrong frontend fallback",
        evidenceGameIds: ["game-1", "game-2"],
        representativeGameIds: ["game-1"],
        positionFen: "wrong-fen",
        openingDiagnosis: diagnosis,
      },
    },
  };
  const priority = resolveTrainingPriority(report, { allowFallback: false });

  assert.equal(priority.diagnosisId, diagnosis.diagnosisId);
  assert.equal(priority.openingName, "Queen Pawn Game");
  assert.equal(priority.positionFen, diagnosis.positionFen);
  assert.equal(priority.classificationPly, 4);
  assert.deepEqual(priority.representativeGameIds, ["game-2"]);
  assert.equal(priority.nextAction, diagnosis.trainingTask);
  assert.equal(priority.successCheck, diagnosis.successCheck);
});

test("shared count formatting handles singular and plural result labels", () => {
  assert.equal(formatResultCounts({ wins: 1, draws: 1, losses: 1 }), "1 win, 1 draw and 1 loss");
  assert.equal(formatResultCounts({ wins: 2, draws: 2, losses: 2 }), "2 wins, 2 draws and 2 losses");
  assert.equal(countNoun(1, "game"), "1 game");
  assert.equal(countNoun(2, "game"), "2 games");
});
