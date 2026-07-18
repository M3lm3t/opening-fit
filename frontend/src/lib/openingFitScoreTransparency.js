export const OPENINGFIT_SCORE_MINIMUM_GAMES = 5;

export const OPENINGFIT_SCORE_FORMULA = Object.freeze([
  { key: "stability", aliases: ["stability"], title: "Familiarity / stability", weight: 22, explanation: "How concentrated the sample is in repeated openings, including openings with at least five games." },
  { key: "whitePerformance", aliases: ["whitePerformance", "white_performance"], title: "White results", weight: 20, explanation: "The game-weighted result score from recognised White openings." },
  { key: "blackPerformance", aliases: ["blackPerformance", "black_performance"], title: "Black results", weight: 20, explanation: "The game-weighted result score from recognised Black openings." },
  { key: "confidence", aliases: ["confidence", "sampleConfidence", "sample_confidence"], title: "Data confidence", weight: 18, explanation: "The number of analysed games and repeated openings with at least five games." },
  { key: "weaknessControl", aliases: ["weaknessControl", "weakness_control"], title: "Weakness control", weight: 12, explanation: "A deduction for lower-scoring and rare or unclear opening samples." },
  { key: "recentConsistency", aliases: ["recentConsistency", "recent_consistency"], title: "Sample consistency proxy", weight: 8, explanation: "The current formula uses a coarse sample-size proxy: 58 below 20 games and 72 from 20 games onward." },
]);

const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const integer = (value) => finite(value) ? Math.round(Number(value)) : null;
const text = (value) => String(value ?? "").trim();

function breakdown(report = {}) {
  const value = report.openingFitScoreBreakdown || report.opening_fit_score_breakdown || report.scoreComponents || report.score_components;
  return value && typeof value === "object" ? value : {};
}

function componentValue(source, component) {
  const value = component.aliases.map((key) => source[key]).find(finite);
  return integer(value);
}

function confidenceLabel(value, fallback = "") {
  if (finite(value)) {
    const score = Number(value);
    return score >= 75 ? "High confidence" : score >= 50 ? "Medium confidence" : "Low confidence";
  }
  const label = text(fallback);
  return label || "Insufficient data";
}

function reasonForChange(currentScore, previousScore, current, previous) {
  if (previousScore === null) return "This is your baseline score; a later report can explain what changed.";
  if (currentScore === previousScore) return "The rounded score is unchanged from the previous report.";
  const changes = OPENINGFIT_SCORE_FORMULA.flatMap((component) => {
    const now = componentValue(current, component);
    const before = componentValue(previous, component);
    return now === null || before === null ? [] : [{ ...component, now, before, contribution: Math.abs(now - before) * component.weight }];
  }).sort((left, right) => right.contribution - left.contribution);
  if (!changes.length) return `The score moved from ${previousScore} to ${currentScore}, but the older report does not contain compatible component data.`;
  const main = changes[0];
  if (main.now === main.before) return `The score moved from ${previousScore} to ${currentScore}; no single saved component explains most of the rounded change.`;
  return `${main.title} ${main.now > main.before ? "increased" : "decreased"} from ${main.before} to ${main.now}, the largest weighted component change in the available reports.`;
}

export function buildOpeningFitScoreTransparency({ model = {}, report = {}, previousReport = null } = {}) {
  const currentScore = integer(model.health?.score ?? report.openingFitScore ?? report.opening_fit_score);
  const previousScore = integer(previousReport?.openingfit_score ?? previousReport?.openingFitScore ?? previousReport?.opening_fit_score);
  const games = integer(model.header?.games ?? report.gamesAnalysed ?? report.gamesImported ?? report.total_games) || 0;
  const currentBreakdown = breakdown(report);
  const previousBreakdown = breakdown(previousReport || {});
  const components = OPENINGFIT_SCORE_FORMULA.flatMap((component) => {
    const value = componentValue(currentBreakdown, component);
    return value === null ? [] : [{ key: component.key, title: component.title, value, weight: component.weight, explanation: component.explanation }];
  });
  const confidence = confidenceLabel(componentValue(currentBreakdown, OPENINGFIT_SCORE_FORMULA.find((item) => item.key === "confidence")), model.health?.confidence);
  const provisional = games < OPENINGFIT_SCORE_MINIMUM_GAMES;
  return {
    currentScore,
    previousScore,
    games,
    confidence,
    provisional,
    statusLabel: provisional ? "Provisional score" : confidence,
    components,
    hasComponentData: components.length > 0,
    reasonForChange: reasonForChange(currentScore, previousScore, currentBreakdown, previousBreakdown),
    meaning: "Your OpeningFit Score is a personalised indicator combining opening results, familiarity, consistency and repertoire suitability. It is not a chess rating.",
    affects: components.length
      ? "The current calculation uses only the components shown below, with the displayed weights."
      : "This older report contains the final score and game sample, but not a compatible component breakdown.",
    doesNotAffect: "Your chess-platform rating and official federation rating do not directly determine this score. It is not an official rating or a measure of objective opening quality.",
    whyChange: "The score can change when recognised opening results, repertoire concentration, repeated weaknesses, sample size, or the mix of White and Black games changes.",
    smallSamples: `Fewer than ${OPENINGFIT_SCORE_MINIMUM_GAMES} analysed games is treated as provisional. Small samples can move sharply because each game has more influence.`,
  };
}
