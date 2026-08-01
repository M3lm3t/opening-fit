const perspective = ({ userColour, openingSide, role, repertoireSlot = null }) => {
  const faced = role.startsWith("faced_");
  return {
    userColour,
    openingSide,
    role,
    relationship: faced ? "faced" : "played",
    repertoireOwned: !faced,
    repertoireSlot,
    opponentPreparation: faced,
    label: role.replaceAll("_", " "),
    classificationSource: "sample_fixture_move_sequence",
  };
};

const openings = [
  {
    name: "Vienna Game",
    games: 18,
    wins: 11,
    draws: 2,
    losses: 5,
    winRate: 67,
    win_rate: 67,
    fitScore: 72,
    verdict: "Keep",
    confidence: "High confidence — based on 18 recent games.",
    perspective: perspective({ userColour: "white", openingSide: "white", role: "played_as_white", repertoireSlot: "white" }),
  },
  {
    name: "Caro-Kann Defence",
    games: 16,
    wins: 8,
    draws: 3,
    losses: 5,
    winRate: 59,
    win_rate: 59,
    fitScore: 64,
    verdict: "Keep",
    confidence: "High confidence — based on 16 recent games.",
    perspective: perspective({ userColour: "black", openingSide: "black", role: "played_as_black", repertoireSlot: "black_vs_e4" }),
  },
  {
    name: "Queen's Gambit Declined",
    games: 12,
    wins: 3,
    draws: 3,
    losses: 6,
    winRate: 38,
    win_rate: 38,
    fitScore: 68,
    verdict: "Improve",
    confidence: "Medium confidence — based on 12 recent games.",
    perspective: perspective({ userColour: "black", openingSide: "black", role: "played_as_black", repertoireSlot: "black_vs_d4" }),
  },
  {
    name: "French Defence",
    games: 10,
    wins: 4,
    draws: 2,
    losses: 4,
    winRate: 50,
    win_rate: 50,
    fitScore: 51,
    verdict: "Prepare",
    confidence: "Medium confidence — based on 10 recent games.",
    perspective: perspective({ userColour: "white", openingSide: "black", role: "faced_as_white" }),
  },
  {
    name: "London System",
    games: 9,
    wins: 4,
    draws: 2,
    losses: 3,
    winRate: 56,
    win_rate: 56,
    fitScore: 58,
    verdict: "Watch",
    confidence: "Low confidence — based on 9 recent games.",
    perspective: perspective({ userColour: "white", openingSide: "white", role: "played_as_white", repertoireSlot: "white" }),
  },
  {
    name: "English Opening",
    games: 7,
    wins: 3,
    draws: 1,
    losses: 3,
    winRate: 50,
    win_rate: 50,
    fitScore: 50,
    verdict: "Prepare",
    confidence: "Low confidence — based on 7 recent games.",
    perspective: perspective({ userColour: "black", openingSide: "white", role: "faced_as_black" }),
  },
].map((opening) => ({
  ...opening,
  openingRole: opening.perspective.role,
  opening_role: opening.perspective.role,
  repertoireOwned: opening.perspective.repertoireOwned,
  repertoireSlot: opening.perspective.repertoireSlot,
  openingSide: opening.perspective.openingSide,
  userColour: opening.perspective.userColour,
  context: opening.perspective.repertoireSlot || opening.perspective.role,
  contextLabel: opening.perspective.label,
}));

const byName = (name) => openings.find((opening) => opening.name === name);

const sampleOpeningMoves = Object.freeze({
  "Vienna Game": ["e4", "e5", "Nc3", "Nf6", "Bc4", "Bc5", "d3", "O-O"],
  "Caro-Kann Defence": ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"],
  "Queen's Gambit Declined": ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7"],
  "French Defence": ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "e5", "Nfd7"],
  "London System": ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6", "e3", "Be7"],
  "English Opening": ["c4", "e5", "Nc3", "Nf6", "g3", "d5", "cxd5", "Nxd5"],
});

const sampleOpeningEco = Object.freeze({
  "Vienna Game": "C25", "Caro-Kann Defence": "B10", "Queen's Gambit Declined": "D30",
  "French Defence": "C00", "London System": "D02", "English Opening": "A10",
});

const canonicalSampleRole = (opening) => {
  if (opening.perspective.userColour === "white") return "white_repertoire";
  return opening.perspective.repertoireSlot || "black_other";
};

const sampleGames = openings.flatMap((opening) => Array.from({ length: opening.games }, (_, offset) => {
  const number = offset + 1;
  const slug = opening.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const id = `sample-${slug}-${number}`;
  const playerIsWhite = opening.perspective.userColour === "white";
  const white = playerIsWhite ? "Example Player — Sample" : `Example opponent ${number}`;
  const black = playerIsWhite ? `Example opponent ${number}` : "Example Player — Sample";
  const moves = sampleOpeningMoves[opening.name];
  const result = number % 5 === 0 ? "1/2-1/2" : playerIsWhite ? "1-0" : "0-1";
  return {
    id, gameId: id, url: `https://example.invalid/games/${id}`,
    white_username: white, black_username: black, playerColour: opening.perspective.userColour,
    playerResult: result === "1/2-1/2" ? "draw" : "win", result, time_class: "rapid",
    playedAt: `2026-06-${String(15 - (offset % 14)).padStart(2, "0")}T12:00:00.000Z`,
    eco: sampleOpeningEco[opening.name], opening: opening.name, openingFamily: opening.name,
    variation: null, classificationPly: 4, repertoireRole: canonicalSampleRole(opening),
    relationship: opening.perspective.repertoireOwned ? "played_by_user" : "faced_by_user",
    exclusionReason: null, moves,
    pgn: `[White "${white}"]\n[Black "${black}"]\n[Result "${result}"]\n[ECO "${sampleOpeningEco[opening.name]}"]\n[Opening "${opening.name}"]\n\n1. ${moves[0]} ${moves[1]} 2. ${moves[2]} ${moves[3]} 3. ${moves[4]} ${moves[5]} 4. ${moves[6]} ${moves[7]} ${result}`,
  };
}));

const establishedStrength = {
  opening: "Vienna Game",
  role: "played_as_white",
  roleLabel: "played by you as White",
  relationship: "played",
  repertoireOwned: true,
  repertoireSlot: "white",
  userColour: "white",
  games: 18,
  score: 66.7,
  fitScore: 72,
  sample: { games: 18, wins: 11, draws: 2, losses: 5, scoreRate: 66.7, gameIds: [] },
  confidence: "High confidence — based on 18 recent games.",
  sampleSizeStatus: "sufficient",
  evidence: ["18 games", "67% score rate", "Reliable development and king safety"],
};

const primaryProblem = {
  opening: "Queen's Gambit Declined",
  role: "played_as_black",
  roleLabel: "played by you as Black",
  relationship: "played",
  repertoireOwned: true,
  repertoireSlot: "black_vs_d4",
  userColour: "black",
  games: 12,
  score: 38,
  fitScore: 68,
  sample: { games: 12, wins: 3, draws: 3, losses: 6, scoreRate: 37.5, gameIds: [] },
  confidence: "Medium confidence — based on 12 recent games.",
  sampleSizeStatus: "sufficient",
  evidence: ["12 games", "38% score rate", "Repeated difficulty completing development"],
};

const nextTrainingAction = {
  type: "repair_repertoire",
  opening: "Queen's Gambit Declined",
  role: "played_as_black",
  label: "Review your Queen's Gambit Declined development",
  reason: "Review three recent losses as Black and mark the first move where you left a familiar development plan.",
  exercise: "Replay those three games from the Black side and write down one safer development plan.",
  completionTarget: { type: "reviewed_games", count: 3, label: "Finish three annotated reviews." },
};

export const SAMPLE_REPORT = Object.freeze({
  schemaVersion: 4,
  sampleMode: true,
  sample_mode: true,
  sampleLabel: "Illustrative example",
  source: "sample_fixture",
  isDemo: true,
  analysisCompleted: true,
  analysis_completed: true,
  analysisId: "openingfit-sample-report-v1",
  analysis_id: "openingfit-sample-report-v1",
  username: "Example Player — Sample",
  playerName: "Example Player — Sample",
  platform: "example",
  importPlatform: "example",
  importedAt: "2026-06-15T12:00:00.000Z",
  lastUpdated: "2026-06-15T12:00:00.000Z",
  gamesImported: 72,
  gamesFound: 72,
  games_imported: 72,
  gamesAnalysed: 72,
  games_analyzed: 72,
  gamesEligible: 72,
  games_eligible: 72,
  gamesWithPgn: 72,
  gamesParsed: 72,
  gamesAttributed: 72,
  gamesClassified: 72,
  games_classified: 72,
  gamesUsedForOpeningStats: 72,
  gamesUsedForFit: 72,
  gamesUnclassified: 0,
  gamesExcluded: 0,
  games_excluded: 0,
  gameCounts: {
    contractVersion: 4,
    fetchedGames: 72,
    gamesFetched: 72,
    gamesStructurallyUsable: 72,
    eligible: 72,
    gamesPgnAvailable: 72,
    gamesParsed: 72,
    gamesAttributed: 72,
    gamesClassified: 72,
    gamesUsedForOpeningStats: 72,
    gamesUnclassified: 0,
    gamesExcluded: 0,
    dateRangeEligibleGames: 72,
    timeControlEligibleGames: 72,
    analysisCandidateGames: 72,
    analysedGames: 72,
    usableOpeningSignals: 72,
    excludedGames: 0,
    exclusionReasons: {
      outsideDateRange: 0, unsupportedTimeControl: 0, unsupportedGameType: 0,
      incompleteGame: 0, duplicate: 0, analysisLimit: 0,
      missingOpeningSignal: 0, parseFailure: 0, attributionFailed: 0,
      unclassifiedOpening: 0, notUsedForOpeningStats: 0, other: 0,
    },
    analysisLimit: 300,
  },
  game_counts: {
    contractVersion: 4, gamesFetched: 72, eligible: 72, gamesPgnAvailable: 72,
    gamesParsed: 72, gamesAttributed: 72, gamesClassified: 72,
    gamesUsedForOpeningStats: 72, gamesExcluded: 0, exclusionReasons: {},
  },
  totalGames: 72,
  total_games: 72,
  monthsChecked: 3,
  rating: 1420,
  playerLevel: "Intermediate",
  openingFitScore: 72,
  opening_fit_score: 72,
  openingFitScoreBand: "Developing repertoire",
  summary: "Example data shows a reliable Vienna Game, one Queen's Gambit Declined problem to review, and separate preparation notes for openings the example player faces.",
  styleProfile: {
    primary: "Active, development-first play",
    summary: "The example player performs best with clear development and familiar pawn structures.",
    labels: ["Active", "Practical", "Development-first"],
  },
  style_profile: {
    primary: "Active, development-first play",
    summary: "The example player performs best with clear development and familiar pawn structures.",
    labels: ["Active", "Practical", "Development-first"],
  },
  best_openings: openings,
  bestOpenings: openings,
  top_openings: openings,
  topOpenings: openings,
  opening_stats: openings,
  openingStats: openings,
  preferred_white: [byName("Vienna Game"), byName("London System")],
  preferredWhite: [byName("Vienna Game"), byName("London System")],
  preferred_black: [byName("Caro-Kann Defence"), byName("Queen's Gambit Declined")],
  preferredBlack: [byName("Caro-Kann Defence"), byName("Queen's Gambit Declined")],
  opening_recommendations: {
    white_repertoire: [byName("Vienna Game"), byName("London System")],
    black_vs_e4: [byName("Caro-Kann Defence")],
    black_vs_d4: [byName("Queen's Gambit Declined")],
    black_vs_other: [],
    faced_as_white: [byName("French Defence")],
    faced_as_black: [byName("English Opening")],
    experimental_rare: [],
    too_little_data: [],
  },
  openingRecommendations: {
    white_repertoire: [byName("Vienna Game"), byName("London System")],
    black_vs_e4: [byName("Caro-Kann Defence")],
    black_vs_d4: [byName("Queen's Gambit Declined")],
    black_vs_other: [],
    faced_as_white: [byName("French Defence")],
    faced_as_black: [byName("English Opening")],
  },
  reportDecision: {
    schemaVersion: 1,
    establishedStrength,
    primaryProblem,
    nextTrainingAction,
    supportingEvidence: [
      "Vienna Game: 18 relevant games.",
      "Queen's Gambit Declined: 12 relevant games with a 37.5% chess score.",
      "French Defence is faced as White and is opponent preparation, not owned repertoire.",
    ],
    confidence: { status: "sufficient", sampleSizeStatus: "sufficient", gamesAnalysed: 72, minimumOpeningGames: 3 },
    baseline: { status: "baseline", hasComparablePrevious: false, comparisonClaimsAllowed: false },
  },
  report_decision: {
    schemaVersion: 1,
    establishedStrength,
    primaryProblem,
    nextTrainingAction,
    supportingEvidence: [
      "Vienna Game: 18 relevant games.",
      "Queen's Gambit Declined: 12 relevant games with a 37.5% chess score.",
      "French Defence is faced as White and is opponent preparation, not owned repertoire.",
    ],
    confidence: { status: "sufficient", sampleSizeStatus: "sufficient", gamesAnalysed: 72, minimumOpeningGames: 3 },
    baseline: { status: "baseline", hasComparablePrevious: false, comparisonClaimsAllowed: false },
  },
  progress_comparison: {
    baseline: true,
    hasComparablePrevious: false,
    comparisonClaimsAllowed: false,
    status: "baseline",
    summary: "This example is a baseline report, so no improvement claim is made.",
  },
  training_plan: [
    {
      title: "Repair the Queen's Gambit Declined",
      detail: "Review one development plan against 1.d4, then practise the first ten moves from the Black side.",
      opening: "Queen's Gambit Declined",
    },
  ],
  next_training_actions: [nextTrainingAction],
  example_game_previews: [
    {
      id: "sample-vienna-1",
      white_username: "Example Player — Sample",
      black_username: "Example opponent",
      opening: "Vienna Game",
      openingRole: "played_as_white",
      result: "1-0",
      time_class: "rapid",
      moves: ["e4", "e5", "Nc3", "Nf6", "Bc4", "Bc5", "d3", "O-O"],
    },
    {
      id: "sample-qgd-1",
      white_username: "Example opponent",
      black_username: "Example Player — Sample",
      opening: "Queen's Gambit Declined",
      openingRole: "played_as_black",
      result: "1-0",
      time_class: "rapid",
      moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7"],
    },
    {
      id: "sample-french-1",
      white_username: "Example Player — Sample",
      black_username: "Example opponent",
      opening: "French Defence",
      openingRole: "faced_as_white",
      result: "1/2-1/2",
      time_class: "rapid",
      moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "e5", "Nfd7"],
    },
  ],
  recent_games: sampleGames.filter((game) => ["sample-vienna-game-1", "sample-queen-s-gambit-declined-1", "sample-french-defence-1"].includes(game.id)),
  recentGames: sampleGames.filter((game) => ["sample-vienna-game-1", "sample-queen-s-gambit-declined-1", "sample-french-defence-1"].includes(game.id)),
  games: sampleGames,
  opening_games: sampleGames,
  openingGames: sampleGames,
  analysis_game_index: sampleGames,
  analysisGameIndex: sampleGames,
});

export const SAMPLE_REPORT_PATH = "/report/sample";
export const SAMPLE_REPORT_CTA_SOURCES = Object.freeze({
  landingStory: "landing_story_sample_cta",
  importHero: "import_hero_sample_cta",
});

export function isSampleReport(report) {
  return Boolean(report?.sampleMode || report?.sample_mode || report?.source === "sample_fixture" || report === SAMPLE_REPORT);
}

export function isSampleReportPath(path = "") {
  return String(path).replace(/\/+$/, "") === SAMPLE_REPORT_PATH;
}

export function reportForInitialPath(path = "") {
  return isSampleReportPath(path) ? SAMPLE_REPORT : null;
}

export function canPersistReport(report) {
  return Boolean(report) && !isSampleReport(report);
}

export function sampleAnalyticsContext(source = "sample_report") {
  return { sample: true, reportKind: "sample", source };
}

export function sampleReportEntry(source = "sample_report") {
  return { path: SAMPLE_REPORT_PATH, view: "report", report: SAMPLE_REPORT, analytics: sampleAnalyticsContext(source) };
}

export function sampleReportExit() {
  return { path: "/", view: "analyse", report: null, target: "import" };
}
