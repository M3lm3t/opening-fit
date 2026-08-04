const confidence = (games) => ({ level: games >= 5 ? "low" : "insufficient", label: games >= 5 ? "Low sample confidence" : "Insufficient sample confidence", scope: "opening_decision" });
const roleConfidence = { level: "trusted", label: "Role attribution trusted" };
const classificationConfidence = { level: "trusted", label: "Opening classification trusted" };
const recommendationConfidence = { level: "low", label: "Low recommendation confidence", scope: "recommendation" };

function recommendation({ id, opening, openingId, colour, role, repertoireRole, relationship, gameIds, verdict }) {
  return {
    decisionId: `opening-decision:${id}`, recommendationId: id, openingName: opening, openingId,
    playerColour: colour, role, repertoireRole, relationship, verdict,
    sample: { games: gameIds.length, gameIds, wins: gameIds.length, draws: 0, losses: 0 },
    sampleSize: gameIds.length, gamesNeeded: Math.max(0, 5 - gameIds.length),
    evidenceConfidence: confidence(gameIds.length), sampleSizeConfidence: confidence(gameIds.length),
    roleAttributionConfidence: roleConfidence, classificationConfidence, recommendationConfidence,
  };
}

const ids = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
const viennaIds = ids("vienna-white", 8);
const scandiBlackIds = ids("scandi-black", 7);
const scandiFacedIds = ids("scandi-faced", 3);
const frenchBlackIds = ids("french-black", 5);
const frenchFacedIds = ids("french-faced", 3);
const kidIds = ids("kid-black-d4", 2);

export const MELMET_REGRESSION_FIXTURE = {
  username: "RegressionPlayer",
  gamesAnalysed: 31,
  analysis_game_index: [
    ...viennaIds.map((gameId) => ({ gameId, opening: "Vienna Game", playerColour: "white", classificationPly: 4, moves: ["e4", "e5", "Nc3", "Nf6", "f4", "d5"] })),
    ...scandiBlackIds.map((gameId) => ({ gameId, opening: "Scandinavian Defence", playerColour: "black", classificationPly: 4, moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qd8"] })),
    ...scandiFacedIds.map((gameId) => ({ gameId, opening: "Scandinavian Defence", playerColour: "white", classificationPly: 4, moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qd8"] })),
    ...frenchBlackIds.map((gameId) => ({ gameId, opening: "French Defence", playerColour: "black", classificationPly: 4, moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"] })),
    ...frenchFacedIds.map((gameId) => ({ gameId, opening: "French Defence", playerColour: "white", classificationPly: 4, moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"] })),
    { gameId: "sicilian-faced-1", opening: "Sicilian Defence", playerColour: "white", classificationPly: 4, moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4"] },
    { gameId: "jobava-white-1", opening: "Jobava London System", playerColour: "white", classificationPly: 5, moves: ["d4", "Nf6", "Nc3", "d5", "Bf4", "e6"] },
    ...kidIds.map((gameId) => ({ gameId, opening: "King's Indian Defence", playerColour: "black", classificationPly: 6, moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"] })),
    { gameId: kidIds[0], opening: "King's Indian Defence", playerColour: "black", classificationPly: 6, moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"] },
  ],
  reportDecision: {
    schemaVersion: 5,
    decisionId: "decision:melmet-regression",
    recommendations: [
      recommendation({ id: "vienna:white", opening: "Vienna Game", openingId: "vienna-game", colour: "white", role: "played_as_white", repertoireRole: "white", relationship: "played", gameIds: viennaIds, verdict: "keep" }),
      recommendation({ id: "scandi:black", opening: "Scandinavian Defence", openingId: "scandinavian-defence", colour: "black", role: "played_as_black", repertoireRole: "black_vs_e4", relationship: "played", gameIds: scandiBlackIds, verdict: "keep" }),
      recommendation({ id: "scandi:faced", opening: "Scandinavian Defence", openingId: "scandinavian-defence", colour: "white", role: "faced_as_white", repertoireRole: "white", relationship: "faced", gameIds: scandiFacedIds, verdict: "insufficient-data" }),
      recommendation({ id: "french:black", opening: "French Defence", openingId: "french-defence", colour: "black", role: "played_as_black", repertoireRole: "black_vs_e4", relationship: "played", gameIds: frenchBlackIds, verdict: "keep" }),
      recommendation({ id: "french:faced", opening: "French Defence", openingId: "french-defence", colour: "white", role: "faced_as_white", repertoireRole: "white", relationship: "faced", gameIds: frenchFacedIds, verdict: "insufficient-data" }),
      recommendation({ id: "kid:black", opening: "King's Indian Defence", openingId: "kings-indian-defence", colour: "black", role: "played_as_black", repertoireRole: "black_vs_d4", relationship: "played", gameIds: kidIds, verdict: "insufficient-data" }),
    ],
    repertoireRoles: [
      { key: "white", repertoireRole: "white", supportingGameCount: 8, requiredGameCount: 5, gamesNeeded: 0, evidenceRequirement: { threshold: 5, additionalRelevantGamesRequired: 0 } },
      { key: "black_e4", repertoireRole: "black_vs_e4", supportingGameCount: 7, requiredGameCount: 5, gamesNeeded: 0, evidenceRequirement: { threshold: 5, additionalRelevantGamesRequired: 0 } },
      { key: "black_d4", repertoireRole: "black_vs_d4", supportingGameCount: 2, requiredGameCount: 5, gamesNeeded: 3, evidenceRequirement: { threshold: 5, additionalRelevantGamesRequired: 3 } },
    ],
    primaryAction: { type: "collect_more_games", decisionId: "decision:melmet-regression", repertoireRole: "black_vs_d4", completionTarget: { type: "new_games", count: 3 } },
  },
  displayedDiagnoses: [{ diagnosisId: "diagnosis:kid-black-d4", opening: "King's Indian Defence" }],
  reportActions: [
    { actionType: "open_evidence", sourceSection: "summary", destinationSection: "evidence", decisionId: "decision:melmet-regression" },
    { actionType: "open_repertoire_priority", sourceSection: "evidence", destinationSection: "repertoire", decisionId: "decision:melmet-regression", repertoireRole: "black_vs_d4" },
    { actionType: "start_training", sourceSection: "summary", destinationRoute: "/train?start=report-task", destinationSection: "train", trainingTaskId: "task:kid" },
  ],
  importQuality: {
    category: "Usable data",
    sampleSize: { games: 31, label: "Moderate" },
    reportCompleteness: { complete: false, correctlyAttributedGames: 30, unresolvedContextCount: 1, coveredRoles: ["white", "black_vs_e4", "black_vs_d4"] },
  },
};
