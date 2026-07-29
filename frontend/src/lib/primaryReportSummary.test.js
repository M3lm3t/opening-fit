import test from "node:test";
import assert from "node:assert/strict";
import { buildPrimaryReportSummary, primaryComparisonState } from "./primaryReportSummary.js";

const completeModel = {
  header: { games: 24 },
  health: { score: 68, confidence: "High confidence", games: 24 },
  verdict: { paragraph: "Italian Game is the clearest area to keep; Sicilian Defence is the most important repair target.", strongest: "Italian Game", weakness: "Sicilian Defence" },
  establishedStrength: { opening: "Italian Game", games: 10, sample: { games: 10, wins: 6, draws: 2, losses: 2 } },
  primaryProblem: { opening: "Sicilian Defence", games: 8, sample: { games: 8, wins: 2, draws: 2, losses: 4 } },
  repertoire: [
    { key: "white", opening: "Italian Game", confidence: "High confidence", games: 10 },
    { key: "black_e4", opening: "Caro-Kann Defence", confidence: "Medium confidence", games: 8 },
    { key: "black_d4", opening: "Slav Defence", confidence: "Medium confidence", games: 6 },
  ],
  training: { opening: "Sicilian Defence", objective: "Review the recurring development issue.", source: { name: "Sicilian Defence" } },
};

test("free and premium first reports share the same analysis hierarchy", () => {
  const free = buildPrimaryReportSummary(completeModel, { isPremium: false });
  const premium = buildPrimaryReportSummary(completeModel, { isPremium: true });
  assert.deepEqual(free, premium);
  assert.equal(free.score, 68);
  assert.equal(free.slots.length, 3);
  assert.deepEqual(free.decisions.map((decision) => decision.label), ["Keep", "Repair", "Train next"]);
  assert.deepEqual(free.decisions.map((decision) => decision.title), ["Italian Game", "Sicilian Defence", "This week: practise Sicilian Defence for approximately 10 minutes."]);
  assert.equal(free.decisions[2].action.label, "Start 10-minute practice");
  assert.equal(free.training.cta, "Start 10-minute practice");
  assert.equal(free.scoreLabel, "Coverage indicator");
  assert.equal(free.establishedRoleCount, 3);
  assert.deepEqual(free.slots.map((slot) => slot.confidence), ["Established", "Established", "Established"]);
});

test("the report leads with verdict, evidence, one action and compact status", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../components/PrimaryReportSummary.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../components/PrimaryReportSummary.css", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const decisions = source.indexOf("<section className=\"primaryReportDecisions\"");
  const verdict = source.indexOf("<div className=\"primaryReportVerdict\"");
  const action = source.indexOf("<section className=\"primaryReportNextAction\"");
  const building = source.indexOf("<section className=\"primaryReportBuilding\"");
  const more = source.indexOf("<div className=\"primaryReportMore\"");
  const status = source.indexOf("<ReportGameCountSummary");
  const score = source.indexOf("<section className=\"primaryReportScoreSection\"");
  assert.ok(verdict < building && building < action && action < more && more < status && status < score && score < decisions);
  assert.ok(decisions < source.indexOf("<section className=\"primaryReportRepertoire\""));
  assert.equal((source.match(/"primaryBtn"/g) || []).length, 1);
  assert.doesNotMatch(source, /FeatureAccessPreview/);
  assert.match(source, /Why these decisions\?/);
  assert.match(source, /Why isn&apos;t this established\?/);
  assert.match(source, /View evidence and full report/);
  assert.match(source, /does not measure playing strength or opening quality/);
  assert.doesNotMatch(source, /<small>\/100<\/small>|Why \$\{view\.score\}\?/);
  assert.doesNotMatch(source, /primaryReportProblem|primaryReportTraining/);
  assert.match(appSource, /onPractice=\{onPractice\}/);
  assert.match(appSource, /onEvidence=\{openOpeningBreakdown\}/);
  assert.match(appSource, /primaryComparison !== "hidden" && primaryComparison !== "preview"/);
  assert.match(appSource, /onNavigate\("analyse"\)/);
  assert.match(appSource, /target: "training-plan"/);
  assert.match(appSource, /activeAppSection === "report" && !reportData && !loading/);
  assert.match(appSource, /className="card loadingCard" role="status" aria-live="polite" aria-busy="true"/);
  assert.match(appSource, /className="errorBox analyseErrorBox" role="alert"/);
  assert.match(styles, /\.primaryReportNextAction/);
  assert.match(styles, /\.reportGameCountCompact/);
  assert.match(styles, /-webkit-line-clamp: 2;/);
});

test("the report keeps one explicit training action when a weekly plan is in progress", () => {
  const view = buildPrimaryReportSummary(completeModel, { isPremium: true, weeklyTrainingPlan: { completionPercent: 50 } });
  assert.equal(view.training.cta, "Start 10-minute practice");
});

test("one-game samples cannot become keep or repair decisions", () => {
  const oneGame = { opening: "French Defence", games: 1, sample: { games: 1, wins: 1, draws: 0, losses: 0 } };
  const view = buildPrimaryReportSummary({
    ...completeModel,
    header: { ...completeModel.header, timeControl: "Rapid" },
    establishedStrength: oneGame,
    primaryProblem: oneGame,
    nextTrainingAction: { type: "collect_more_games" },
    training: { label: "Collect more games", objective: "The sample is too small." },
  });
  assert.equal(view.decisions[0].source, null);
  assert.equal(view.decisions[1].source, null);
  assert.match(view.decisions[0].reason, /Play 4 more rapid games/);
  assert.match(view.decisions[1].reason, /no single repeated pattern supports a repair claim/i);
  assert.deepEqual(view.decisions[2].action, { label: "Analyse more games", type: "analyse" });
});

test("empty and partial report objects fall back to analysis instead of inventing training", () => {
  const empty = buildPrimaryReportSummary({}, {});
  assert.equal(empty.score, null);
  assert.equal(empty.decisions[0].source, null);
  assert.equal(empty.decisions[1].source, null);
  assert.deepEqual(empty.decisions[2].action, { label: "Analyse more games", type: "analyse" });
  assert.doesNotMatch(JSON.stringify(empty), /undefined|null games/);

  const partial = buildPrimaryReportSummary({
    health: { games: 3, confidence: "Insufficient data" },
    establishedStrength: { opening: "Vienna Game", sampleSizeStatus: "insufficient_data", sample: { games: 3 } },
    training: { label: "Collect more games" },
  }, { effectiveTimeFormatLabel: "Rapid" });
  assert.equal(partial.decisions[0].source, null);
  assert.equal(partial.decisions[2].action.type, "analyse");
  assert.match(partial.decisions[0].reason, /2 more rapid games/);
});

test("legacy report summaries remain usable through conservative display fallbacks", () => {
  const legacy = buildPrimaryReportSummary({
    health: { games: 8, confidence: "Limited report coverage" },
    decisions: [{ type: "keep", opening: "Italian Game", games: 8, winRate: 62.5 }],
    training: { type: "keep", opening: "Italian Game", label: "Review Italian Game", objective: "Review one recent game." },
  }, { gamesImported: 8 });
  assert.equal(legacy.decisions[0].title, "Italian Game");
  assert.equal(legacy.decisions[1].source, null);
  assert.equal(legacy.decisions[2].action.label, "Start 10-minute practice");
  assert.equal(legacy.score, null);
});

test("supported branch evidence selects a specific working action", () => {
  const position = buildPrimaryReportSummary({
    ...completeModel,
    primaryProblem: { ...completeModel.primaryProblem, issue: { positionOrMoveSequence: "4...Nf6" } },
  });
  assert.equal(position.decisions[1].action.label, "Practise this position");
  assert.equal(position.decisions[1].action.type, "practice");

  const branch = buildPrimaryReportSummary({
    ...completeModel,
    primaryProblem: { ...completeModel.primaryProblem, variationName: "Advance Variation" },
  });
  assert.equal(branch.decisions[1].action.label, "Review this branch");
  assert.equal(branch.decisions[1].action.type, "evidence");
});

test("no previous report hides comparison while a failed comparison remains visible", () => {
  assert.equal(primaryComparisonState({ authenticated: true }), "hidden");
  assert.equal(primaryComparisonState({ authenticated: true, error: "Unavailable" }), "error");
  assert.equal(primaryComparisonState({ authenticated: true, loading: true }), "loading");
  assert.equal(primaryComparisonState({ authenticated: false, previousReport: {} }), "hidden");
});

test("incomplete repertoire keeps all three required slots without invented openings", () => {
  const view = buildPrimaryReportSummary({ ...completeModel, repertoire: completeModel.repertoire.slice(0, 1) });
  assert.equal(view.incompleteRepertoire, true);
  assert.deepEqual(view.slots.map((slot) => slot.label), ["White", "Black against 1.e4", "Black against 1.d4"]);
  assert.equal(view.slots[1].opening, "Not established yet");
  assert.equal(view.slots[1].reasonCode, "unsupported_or_unknown");
  assert.match(view.slots[1].explanation, /does not yet have enough correctly attributed games/i);
});

test("low data produces a calm prominent confidence warning", () => {
  const view = buildPrimaryReportSummary({ ...completeModel, health: { score: null, confidence: "Low confidence", games: 2 }, verdict: { paragraph: "The current game sample is too small for a confident repertoire verdict." } });
  assert.equal(view.score, null);
  assert.match(view.confidenceWarning, /recommendations are provisional/i);
  assert.doesNotMatch(view.confidenceWarning, /bad|failed|unreliable/i);
});

test("coach verdict is exactly one sentence", () => {
  const view = buildPrimaryReportSummary(completeModel);
  assert.equal((view.verdict.match(/[.!?]/g) || []).length, 1);
});

test("a positive verdict can have medium coverage and no reliable weakness", () => {
  const view = buildPrimaryReportSummary({
    ...completeModel,
    health: { score: 60, confidence: "Moderate report coverage", games: 12 },
    authoritative: {
      establishedStrength: { opening: "Vienna Game", games: 8, sample: { games: 8, wins: 5, draws: 2, losses: 1 } },
      primaryProblem: null,
      nextTrainingAction: { type: "keep", opening: "Vienna Game" },
      confidence: { status: "sufficient", gamesAnalysed: 12 },
    },
    establishedStrength: { opening: "Vienna Game", games: 8, sample: { games: 8, wins: 5, draws: 2, losses: 1 } },
    primaryProblem: null,
    repertoire: [{ key: "white", opening: "Vienna Game", confidence: "Moderate", games: 8 }],
    training: { type: "keep", opening: "Vienna Game" },
  });
  assert.equal(view.score, 60);
  assert.equal(view.scoreLabel, "Coverage indicator");
  assert.equal(view.establishedRoleCount, 1);
  assert.equal(view.weaknessState, "strong_results");
  assert.equal(view.problem.title, "No statistically reliable opening weakness was found");
  assert.match(view.evidenceExplanation, /Vienna Game has enough evidence.*still need more evidence/i);
  assert.equal(view.primaryAction.title, "This week: practise Vienna Game for approximately 10 minutes.");
  assert.equal(view.recommendationContext.title, "Why Vienna Game fits your current repertoire");
  assert.match(view.recommendationContext.reasons.join(" "), /8 suitable games/i);
});

test("recommended opening reasons use recorded evidence rather than a weakness claim", () => {
  const view = buildPrimaryReportSummary({
    ...completeModel,
    establishedStrength: { opening: "Ruy Lopez", sample: { games: 7, wins: 4, draws: 2, losses: 1, scoreRate: 71.4 }, fitReasonBullets: ["Builds from move orders already present in the analysed games."] },
    authoritative: { establishedStrength: { opening: "Ruy Lopez", sample: { games: 7, wins: 4, draws: 2, losses: 1, scoreRate: 71.4 }, fitReasonBullets: ["Builds from move orders already present in the analysed games."] }, primaryProblem: null, nextTrainingAction: { type: "keep", opening: "Ruy Lopez" }, confidence: { status: "sufficient" } },
    primaryProblem: null,
    training: { type: "keep", opening: "Ruy Lopez" },
  });
  assert.equal(view.recommendationContext.reasons.length, 3);
  assert.match(view.recommendationContext.reasons[0], /move orders already present/i);
  assert.doesNotMatch(view.recommendationContext.reasons.join(" "), /because you are weak|AI/i);
});

test("a recorded style-fit recommendation is explained as fit rather than weakness", () => {
  const ruy = { opening: "Ruy Lopez", sample: { games: 9, wins: 5, draws: 2, losses: 2, scoreRate: 66.7 }, fitReasonBullets: ["The recorded style profile favours patient positional pressure.", "This move order already appears in the analysed games."] };
  const view = buildPrimaryReportSummary({
    ...completeModel,
    establishedStrength: ruy,
    primaryProblem: null,
    authoritative: { establishedStrength: ruy, primaryProblem: null, nextTrainingAction: { type: "keep", opening: "Ruy Lopez" }, confidence: { status: "sufficient" } },
    training: { type: "keep", opening: "Ruy Lopez" },
  });
  assert.equal(view.recommendationContext.title, "Why Ruy Lopez fits your current repertoire");
  assert.match(view.recommendationContext.reasons.join(" "), /recorded style profile.*move order already appears/i);
  assert.doesNotMatch(view.recommendationContext.reasons.join(" "), /weakness|repair/i);
});

test("a repertoire-gap repair remains a repair action and does not masquerade as a fit recommendation", () => {
  const gap = { opening: "Queen's Gambit Declined", games: 6, sample: { games: 6, wins: 1, draws: 2, losses: 3 }, issue: { positionOrMoveSequence: "1.d4 d5 2.c4 e6" } };
  const view = buildPrimaryReportSummary({
    ...completeModel,
    establishedStrength: null,
    primaryProblem: gap,
    authoritative: { establishedStrength: null, primaryProblem: gap, nextTrainingAction: { type: "repair_repertoire", opening: gap.opening, sample: gap.sample }, confidence: { status: "sufficient" } },
    training: { type: "repair_repertoire", opening: gap.opening, line: "1.d4 d5 2.c4 e6", source: gap },
  });
  assert.equal(view.weaknessState, "reliable_weakness");
  assert.equal(view.recommendationContext, null);
  assert.equal(view.primaryAction.type, "training");
  assert.match(view.primaryAction.title, /Queen's Gambit Declined.*1\.d4 d5 2\.c4 e6/i);
});

test("insufficient evidence explains no weakness without claiming strength", () => {
  const view = buildPrimaryReportSummary({
    health: { score: 60, confidence: "Limited report coverage", games: 3 },
    authoritative: { primaryProblem: null, establishedStrength: null, nextTrainingAction: { type: "collect_more_games" }, confidence: { status: "insufficient_data", gamesAnalysed: 3 } },
    repertoire: [{ key: "black_d4", label: "Black against 1.d4", status: "tentative", opening: "Queen's Gambit Declined", games: 4, evidenceRequirement: { requiredColour: "black", opponentFirstMove: "1.d4", timeControls: ["rapid"], threshold: 5, additionalRelevantGamesRequired: 1 } }],
  }, {});
  assert.equal(view.weaknessState, "insufficient_evidence");
  assert.match(view.evidenceExplanation, /not enough evidence.*not.*all openings are strong/i);
  assert.equal(view.primaryAction.type, "analyse");
  assert.match(view.primaryAction.title, /rapid.*1 more correctly attributed game.*Black-versus-1\.d4/i);
  assert.doesNotMatch(view.primaryAction.title, /play 5 more|arbitrary rapid games/i);
});

test("missing optional training data uses an honest unnamed fallback", () => {
  const view = buildPrimaryReportSummary({
    ...completeModel,
    authoritative: { nextTrainingAction: { type: "review" }, establishedStrength: null, primaryProblem: null, confidence: { status: "sufficient" } },
    training: { type: "review" },
    establishedStrength: null,
    primaryProblem: null,
    decisions: [],
  });
  assert.equal(view.primaryAction.title, "This week: review one recent analysed opening game for approximately 10 minutes.");
  assert.doesNotMatch(view.primaryAction.title, /branch|variation|position/i);
});

test("no-weakness states distinguish confidence failure from distributed evidence", () => {
  const threshold = buildPrimaryReportSummary({
    health: { score: 55, confidence: "Moderate report coverage", games: 10 },
    authoritative: { primaryProblem: { opening: "French Defence", games: 6, confidence: { status: "insufficient" } }, nextTrainingAction: { type: "collect_more_games" }, confidence: { status: "sufficient" } },
  });
  assert.equal(threshold.weaknessState, "confidence_threshold");
  assert.match(threshold.evidenceExplanation, /confidence or evidence quality did not meet the threshold/i);

  const mixed = buildPrimaryReportSummary({
    health: { score: 55, confidence: "Moderate report coverage", games: 12 },
    authoritative: { primaryProblem: null, establishedStrength: null, nextTrainingAction: { type: "review" }, confidence: { status: "sufficient" } },
    training: { type: "review" },
  });
  assert.equal(mixed.weaknessState, "mixed_or_distributed");
  assert.match(mixed.evidenceExplanation, /mixed across openings or roles/i);
});

test("no reliable weakness labels a frequent faced opening as preparation, not repair", () => {
  const view = buildPrimaryReportSummary({
    ...completeModel,
    primaryProblem: null,
    authoritative: {
      primaryProblem: null,
      establishedStrength: completeModel.establishedStrength,
      nextTrainingAction: { type: "prepare_against", opening: "Caro-Kann Defence", role: "faced_as_white", sample: { games: 10 } },
      trainingPriority: { openingName: "Caro-Kann Defence", role: "faced_as_white", evidenceCount: 10, estimatedDurationMinutes: 10 },
      confidence: { status: "sufficient" },
    },
    training: { type: "prepare_against", opening: "Caro-Kann Defence" },
  });
  assert.equal(view.decisions[2].label, "Best preparation opportunity");
  assert.match(view.decisions[2].reason, /No statistically reliable opening weakness.*faced it 10 times/i);
  assert.doesNotMatch(view.decisions[2].reason, /repair|mistake|poor plan/i);
});

test("a supported weakness retains repair language", () => {
  const view = buildPrimaryReportSummary(completeModel);
  assert.equal(view.weaknessState, "reliable_weakness");
  assert.equal(view.decisions[1].label, "Repair");
  assert.equal(view.decisions[2].label, "Train next");
  assert.equal(view.establishedRoleCount, 3);
});

test("coverage completeness and the weighted indicator remain separate", () => {
  const view = buildPrimaryReportSummary({
    ...completeModel,
    health: { score: 67, confidence: "Moderate report coverage", games: 280 },
    repertoire: [
      { key: "white", status: "supported", opening: "Vienna Game", games: 8 },
      { key: "black_e4", status: "missing", games: 0, evidenceReasonCode: "unsupported_or_unknown" },
      { key: "black_d4", status: "supported", opening: "Slav Defence", games: 7 },
    ],
  });
  assert.equal(view.establishedRoleCount, 2);
  assert.equal(view.totalRoleCount, 3);
  assert.equal(view.score, 67);
  assert.equal(view.scoreLabel, "Coverage indicator");
});
