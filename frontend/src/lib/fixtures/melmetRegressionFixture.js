const confidence = (games) => ({ level: games >= 10 ? "medium" : games >= 5 ? "low" : "insufficient", label: `${games >= 10 ? "Medium" : games >= 5 ? "Low" : "Insufficient"} sample confidence`, scope: "opening_decision" });
const roleConfidence = { level: "trusted", label: "Role attribution trusted" };
const classificationConfidence = { level: "trusted", label: "Opening classification trusted" };
const recommendationConfidence = { level: "medium", label: "Medium recommendation confidence", scope: "recommendation" };
const ids = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

function recommendation({ id, opening, openingId, colour, role, repertoireRole, relationship, gameIds, results, verdict }) {
  const wins = results.filter((value) => value === "win").length;
  const draws = results.filter((value) => value === "draw").length;
  const losses = results.filter((value) => value === "loss").length;
  const knownResults = wins + draws + losses;
  const scoreRate = knownResults ? Math.round(((wins + draws * 0.5) / knownResults) * 1000) / 10 : null;
  return {
    decisionId: `opening-decision:${id}`, recommendationId: id, openingName: opening, openingId,
    playerColour: colour, role, repertoireRole, relationship, verdict,
    sample: { games: gameIds.length, knownResults, gameIds, wins, draws, losses, scoreRate },
    sampleSize: gameIds.length, gamesNeeded: Math.max(0, 5 - gameIds.length), scoreRate,
    evidenceConfidence: confidence(gameIds.length), sampleSizeConfidence: confidence(gameIds.length),
    roleAttributionConfidence: roleConfidence, classificationConfidence, recommendationConfidence,
  };
}

const viennaIds = ids("vienna-white", 30);
const viennaResults = [...Array(17).fill("win"), ...Array(13).fill("loss")];
const scandiIds = ids("scandi-black", 43);
const scandiResults = [...Array(15).fill("win"), ...Array(8).fill("draw"), ...Array(20).fill("loss")];
const frenchIds = ids("french-faced", 5);
const frenchResults = ["win", "draw", "loss", "loss", "loss"];
const kidIds = ids("kid-black-d4", 2);
const kidResults = ["draw", "loss"];

const indexed = (gameIds, results, opening, playerColour, moves, classificationPly) => gameIds.map((gameId, index) => ({
  gameId, opening, playerColour, playerResult: results[index], result: results[index], classificationPly, moves,
  whiteUsername: playerColour === "white" ? (index % 2 ? " Melmet " : "MELMET") : "Opponent",
  blackUsername: playerColour === "black" ? (index % 2 ? "melmet" : "Melmet") : "Opponent",
}));

export const MELMET_REGRESSION_FIXTURE = {
  username: "melmet",
  gamesAnalysed: 139,
  analysisCompleted: true,
  analysis_game_index: [
    ...indexed(viennaIds, viennaResults, "Vienna Game", "white", ["e4", "e5", "Nc3", "Nf6", "f4", "d5"], 4),
    ...indexed(scandiIds, scandiResults, "Scandinavian Defence", "black", ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qd8"], 4),
    ...indexed(frenchIds, frenchResults, "French Defence", "white", ["e4", "e6", "d4", "d5", "Nc3", "Nf6"], 4),
    ...indexed(kidIds, kidResults, "King's Indian Defence", "black", ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"], 6),
    { ...indexed(kidIds, kidResults, "King's Indian Defence", "black", ["d4", "Nf6", "c4", "g6"], 4)[0] },
    { gameId: "malformed-unattributable", opening: "Unclassified opening", white: 7, black: [], playerColour: "unknown", playerResult: "unknown" },
  ],
  reportDecision: {
    schemaVersion: 5,
    decisionId: "decision:melmet-regression",
    recommendations: [
      recommendation({ id: "vienna:white", opening: "Vienna Game", openingId: "vienna-game", colour: "white", role: "played_as_white", repertoireRole: "white", relationship: "played", gameIds: viennaIds, results: viennaResults, verdict: "keep" }),
      recommendation({ id: "scandi:black", opening: "Scandinavian Defence", openingId: "scandinavian-defence", colour: "black", role: "played_as_black", repertoireRole: "black_vs_e4", relationship: "played", gameIds: scandiIds, results: scandiResults, verdict: "repair" }),
      recommendation({ id: "french:faced", opening: "French Defence", openingId: "french-defence", colour: "white", role: "faced_as_white", repertoireRole: "white", relationship: "faced", gameIds: frenchIds, results: frenchResults, verdict: "explore" }),
      recommendation({ id: "kid:black", opening: "King's Indian Defence", openingId: "kings-indian-defence", colour: "black", role: "played_as_black", repertoireRole: "black_vs_d4", relationship: "played", gameIds: kidIds, results: kidResults, verdict: "insufficient-data" }),
      recommendation({ id: "experiment:queens-gambit", opening: "Queen's Gambit", openingId: "queens-gambit", colour: "white", role: "played_as_white", repertoireRole: "white", relationship: "played", gameIds: [], results: [], verdict: "insufficient-data" }),
    ],
    establishedStrength: { recommendationId: "vienna:white", opening: "Vienna Game" },
    primaryProblem: { recommendationId: "scandi:black", opening: "Scandinavian Defence" },
    experiment: { recommendationId: "experiment:queens-gambit", openingName: "Queen's Gambit", verdict: "experiment", sample: { games: 0 } },
    repertoireRoles: [
      { key: "white", repertoireRole: "white", status: "established", openingName: "Vienna Game", supportingGameCount: 30, evidenceCount: 30, requiredGameCount: 5, gamesNeeded: 0, evidenceRequirement: { threshold: 5, additionalRelevantGamesRequired: 0 } },
      { key: "black_e4", repertoireRole: "black_vs_e4", status: "established", openingName: "Scandinavian Defence", supportingGameCount: 43, evidenceCount: 43, requiredGameCount: 5, gamesNeeded: 0, evidenceRequirement: { threshold: 5, additionalRelevantGamesRequired: 0 } },
      { key: "black_d4", repertoireRole: "black_vs_d4", status: "building", openingName: "King's Indian Defence", supportingGameCount: 2, evidenceCount: 2, requiredGameCount: 5, gamesNeeded: 3, evidenceRequirement: { threshold: 5, additionalRelevantGamesRequired: 3 } },
    ],
    openingDiagnosis: {
      diagnosisId: "diagnosis:scandi-opening", canonicalDecisionId: "opening-decision:scandi:black", opening: "Scandinavian Defence",
      repertoireRole: "black_vs_e4", playerColour: "black", diagnosisScope: "opening", precisionLevel: "opening",
      supportingGameIds: scandiIds, affectedGameCount: 43, lostGameCount: 20, trainingTaskId: "training-task:scandi-opening",
      confidence: "high", confidenceReason: "43 unique opening-level games support this review.",
      userFacingDiagnosis: "This opening-level pattern recurs across 43 supporting Scandinavian games, but no single repeated legal position or variation was retained.",
    },
    primaryAction: { type: "repair_repertoire", verdict: "repair", decisionId: "decision:melmet-regression", recommendationId: "scandi:black", opening: "Scandinavian Defence", repertoireRole: "black_vs_e4", completionTarget: { type: "reviewed_games", count: 3 } },
    trainingPriority: { type: "repair_repertoire", findingType: "opening_weakness", decisionId: "decision:melmet-regression", diagnosisId: "diagnosis:scandi-opening", openingName: "Scandinavian Defence", repertoireRole: "black_vs_e4", openingDiagnosis: null },
    repertoireHealth: { version: "repertoire_health_v2", score: 62, components: [
      { componentId: "role-completeness", contribution: 28, status: "supported", evidenceSource: "canonical-role-counts", targetDecisionId: "decision:melmet-regression", explanation: "Vienna and Scandinavian provide established White and Black-vs-e4 coverage." },
      { componentId: "repair-priority", contribution: 10, status: "weakness", evidenceSource: "canonical-scandi-diagnosis", targetDecisionId: "opening-decision:scandi:black", explanation: "Scandinavian results create the current repair priority across 43 supporting games." },
    ] },
  },
  gameCounts: {
    contractVersion: 4, gamesFetched: 164, eligible: 156, gamesPgnAvailable: 156, gamesParsed: 156,
    gamesAttributed: 139, gamesClassified: 139, gamesUsedForOpeningStats: 139, gamesExcluded: 25,
    exclusionReasons: { attributionFailed: 17, other: 8 }, duplicateGamesRemoved: 1,
  },
  displayedDiagnoses: [{ diagnosisId: "diagnosis:scandi-opening", opening: "Scandinavian Defence" }],
  reportActions: [
    { actionType: "open_evidence", sourceSection: "summary", destinationSection: "evidence", decisionId: "decision:melmet-regression" },
    { actionType: "open_diagnosed_problem", sourceSection: "evidence", destinationSection: "problems", decisionId: "decision:melmet-regression", diagnosisId: "diagnosis:scandi-opening" },
    { actionType: "start_training", sourceSection: "summary", destinationRoute: "/train?start=report-task", destinationSection: "train", trainingTaskId: "training-task:scandi-opening" },
  ],
  importQuality: { category: "Usable data", sampleSize: { games: 139, label: "Large" }, reportCompleteness: { complete: false, correctlyAttributedGames: 139, unresolvedContextCount: 17, coveredRoles: ["white", "black_vs_e4", "black_vs_d4"] } },
};

MELMET_REGRESSION_FIXTURE.reportDecision.trainingPriority.openingDiagnosis = MELMET_REGRESSION_FIXTURE.reportDecision.openingDiagnosis;
