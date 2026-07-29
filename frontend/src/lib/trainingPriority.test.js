import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTrainingPriorityTitle,
  resolveTrainingPriority,
  trainingPlanMatchesPriority,
} from "./trainingPriority.js";
import { countNoun, formatResultCounts } from "./reportGameCounts.js";

const caroDecision = {
  recommendations: [{
    recommendationId: "caro-kann:defence:played_as_black",
    openingName: "Caro-Kann Defence",
    openingId: "caro-kann-defense",
    role: "played_as_black",
    sample: { games: 60, gameIds: ["game-1", "game-2"] },
    confidence: { level: "medium" },
  }],
  nextTrainingAction: {
    type: "repair_repertoire",
    recommendationId: "caro-kann:defence:played_as_black",
    opening: "Caro-Kann Defence",
    role: "played_as_black",
    reason: "60 opening-specific games support this repair priority.",
  },
};

test("normalises the report decision into one stable training priority", () => {
  const priority = resolveTrainingPriority({ analysisId: "analysis-1", reportDecision: caroDecision }, { allowFallback: false });

  assert.equal(priority.priorityId, "training-caro-kann:defence:played_as_black");
  assert.equal(priority.openingName, "Caro-Kann Defence");
  assert.equal(priority.playerColour, "black");
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

test("cached plans match only the exact report priority", () => {
  const priority = resolveTrainingPriority({ reportDecision: caroDecision }, { allowFallback: false });
  assert.equal(trainingPlanMatchesPriority({ trainingPriorityId: priority.priorityId }, priority), true);
  assert.equal(trainingPlanMatchesPriority({ trainingPriorityId: "training-vienna" }, priority), false);
  assert.equal(trainingPlanMatchesPriority({}, priority), false);
});

test("shared count formatting handles singular and plural result labels", () => {
  assert.equal(formatResultCounts({ wins: 1, draws: 1, losses: 1 }), "1 win, 1 draw and 1 loss");
  assert.equal(formatResultCounts({ wins: 2, draws: 2, losses: 2 }), "2 wins, 2 draws and 2 losses");
  assert.equal(countNoun(1, "game"), "1 game");
  assert.equal(countNoun(2, "game"), "2 games");
});
