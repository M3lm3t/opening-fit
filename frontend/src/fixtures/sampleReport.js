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
    confidence: "High confidence",
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
    confidence: "High confidence",
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
    fitScore: 38,
    verdict: "Improve",
    confidence: "Medium confidence",
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
    confidence: "Medium confidence",
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
    confidence: "Medium confidence",
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
    confidence: "Medium confidence",
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

const establishedStrength = {
  opening: "Vienna Game",
  role: "played_as_white",
  roleLabel: "played by you as White",
  relationship: "played",
  repertoireOwned: true,
  repertoireSlot: "white",
  userColour: "white",
  games: 18,
  score: 72,
  confidence: "High confidence",
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
  confidence: "Medium confidence",
  sampleSizeStatus: "sufficient",
  evidence: ["12 games", "38% score rate", "Repeated difficulty completing development"],
};

const nextTrainingAction = {
  type: "repair_repertoire",
  opening: "Queen's Gambit Declined",
  role: "played_as_black",
  label: "Repair the Queen's Gambit Declined",
  reason: "Review one dependable development plan against 1.d4; this is the best-supported weakness in the example repertoire.",
};

export const SAMPLE_REPORT = Object.freeze({
  schemaVersion: 4,
  sampleMode: true,
  sample_mode: true,
  sampleLabel: "Sample report",
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
  games_imported: 72,
  gamesAnalysed: 72,
  games_analyzed: 72,
  gamesEligible: 72,
  games_eligible: 72,
  gamesClassified: 72,
  games_classified: 72,
  gamesExcluded: 0,
  games_excluded: 0,
  gameCounts: {
    contractVersion: 2,
    fetchedGames: 72,
    dateRangeEligibleGames: 72,
    timeControlEligibleGames: 72,
    analysisCandidateGames: 72,
    analysedGames: 72,
    usableOpeningSignals: 72,
    excludedGames: 0,
    exclusionReasons: {
      outsideDateRange: 0, unsupportedTimeControl: 0, unsupportedGameType: 0,
      incompleteGame: 0, duplicate: 0, analysisLimit: 0,
      missingOpeningSignal: 0, other: 0,
    },
    analysisLimit: 300,
  },
  game_counts: { imported: 72, eligible: 72, classified: 72, excluded: 0, exclusion_reasons: [] },
  totalGames: 72,
  total_games: 72,
  monthsChecked: 3,
  rating: 1420,
  playerLevel: "Intermediate",
  openingFitScore: 72,
  opening_fit_score: 72,
  openingFitScoreBand: "Developing repertoire",
  summary: "Example data shows a dependable Vienna Game, a repair priority in the Queen's Gambit Declined, and separate preparation notes for openings the example player faces.",
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
      "Vienna Game: 18 games and a 72 fit score.",
      "Queen's Gambit Declined: 12 games and a 38 fit score.",
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
      "Vienna Game: 18 games and a 72 fit score.",
      "Queen's Gambit Declined: 12 games and a 38 fit score.",
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
  recent_games: [
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
  games: [],
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
