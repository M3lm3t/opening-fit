const opening = (name, side, games, score) => ({ name, colour: side, games, win_rate: score, confidence: { label: games >= 8 ? "High confidence" : games >= 3 ? "Medium confidence" : "Low confidence", sample_size: games } });

export const basePreviousReport = {
  report_schema_version: 2,
  source_platform: "chesscom",
  source_username: "FixturePlayer",
  openingfit_score: 60,
  score_components: { stability: 58, confidence: 62 },
  total_games_analysed: 20,
  opening_statistics: [opening("Italian Game", "white", 10, 50), opening("Caro-Kann Defense", "black", 8, 55)],
  recommendations: { white: "Italian Game", black_e4: "Caro-Kann Defense", black_d4: "Slav Defense" },
  active_repertoire: { items: [{ name: "Italian Game", colour: "white" }, { name: "Caro-Kann Defense", colour: "black" }] },
  training_priorities: [{ issue_id: "early-queen", title: "Early queen pressure", opening: "Italian Game", frequency: 4, confidence: "Medium" }],
};

export const comparisonFixtures = {
  firstEver: { previous: null, current: { ...basePreviousReport, new_games_since_previous: null } },
  scoreIncrease: { previous: basePreviousReport, current: { ...basePreviousReport, openingfit_score: 68, new_games_since_previous: 8 } },
  scoreDecrease: { previous: basePreviousReport, current: { ...basePreviousReport, openingfit_score: 53 } },
  noMeaningfulChange: { previous: basePreviousReport, current: { ...basePreviousReport, openingfit_score: 61, opening_statistics: [opening("Italian Game", "white", 12, 53), opening("Caro-Kann Defense", "black", 9, 53)] } },
  renamedOpening: { previous: basePreviousReport, current: { ...basePreviousReport, opening_statistics: [opening("Giuoco Piano", "white", 12, 58), opening("Caro-Kann Defense", "black", 9, 55)] } },
  smallSample: { previous: { ...basePreviousReport, opening_statistics: [opening("Italian Game", "white", 2, 20)] }, current: { ...basePreviousReport, opening_statistics: [opening("Giuoco Piano", "white", 3, 80)] } },
  changedPlatform: { previous: basePreviousReport, current: { ...basePreviousReport, source_platform: "lichess", openingfit_score: 75 } },
  missingOldFields: { previous: { report_schema_version: 2, source_platform: "chesscom", opening_statistics: [] }, current: basePreviousReport },
  newRecommendation: { previous: basePreviousReport, current: { ...basePreviousReport, recommendations: { ...basePreviousReport.recommendations, white: "Queen's Gambit" } } },
};
