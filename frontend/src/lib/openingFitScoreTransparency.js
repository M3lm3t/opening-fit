export const OPENINGFIT_SCORE_MINIMUM_GAMES = 5;

// Retained only to explain reports saved under the original mixed methodology.
export const OPENINGFIT_SCORE_FORMULA = Object.freeze([
  { key: "stability", aliases: ["stability"], title: "Familiarity / stability", weight: 22, explanation: "How concentrated the sample is in repeated openings, including openings with at least five games." },
  { key: "whitePerformance", aliases: ["whitePerformance", "white_performance"], title: "White results", weight: 20, explanation: "The game-weighted result score from recognised White openings." },
  { key: "blackPerformance", aliases: ["blackPerformance", "black_performance"], title: "Black results", weight: 20, explanation: "The game-weighted result score from recognised Black openings." },
  { key: "evidenceCoverage", aliases: ["evidenceCoverage", "evidence_coverage", "confidence", "sampleConfidence", "sample_confidence"], title: "Evidence coverage", weight: 18, explanation: "The number of classified games and repeated openings with at least five games." },
  { key: "weaknessControl", aliases: ["weaknessControl", "weakness_control"], title: "Weakness control", weight: 12, explanation: "A legacy deduction for lower-scoring and rare or unclear opening samples." },
  { key: "recentConsistency", aliases: ["recentConsistency", "recent_consistency"], title: "Sample consistency proxy", weight: 8, explanation: "The legacy formula used a coarse sample-size proxy." },
]);

const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const integer = (value) => finite(value) ? Math.round(Number(value)) : null;
const text = (value) => String(value ?? "").trim();

export function openingFitDevelopmentState(score) {
  const value = integer(score);
  if (value === null) return { key: "pending", label: "Coverage pending" };
  if (value < 45) return { key: "building", label: "Building repertoire" };
  if (value < 65) return { key: "developing", label: "Developing repertoire" };
  if (value < 78) return { key: "solid", label: "Solid repertoire" };
  if (value < 90) return { key: "strong", label: "Strong repertoire" };
  return { key: "excellent", label: "Excellent repertoire coverage" };
}

function breakdown(report = {}) {
  const value = report.openingFitScoreBreakdown || report.opening_fit_score_breakdown || report.scoreComponents || report.score_components;
  return value && typeof value === "object" ? value : {};
}

function scoreContract(report = {}) {
  const value = report.repertoireCoverageScore || report.repertoire_coverage_score || report.openingFitScoreContract || report.opening_fit_score_contract || report.score_contract;
  return value && typeof value === "object" ? value : {};
}

function componentValue(source, component) {
  return integer(component.aliases.map((key) => source[key]).find(finite));
}

function coverageLabel(value, fallback = "") {
  if (finite(value)) return Number(value) >= 75 ? "Broad role evidence" : Number(value) >= 50 ? "Moderate role evidence" : "Limited role evidence";
  return text(fallback) || "Insufficient data";
}

function weaknessContext(model = {}, repairStatus = null) {
  const problem = model.authoritative?.primaryProblem || model.primaryProblem;
  if (problem) return "A reliable opening weakness was found and is shown separately as a specific repair target; it does not alter repertoire coverage.";
  if (repairStatus?.label) return `${repairStatus.label}. This is a neutral evidence state, not a good or bad coverage component.`;
  return "No reliable opening weakness is a neutral finding. Coverage instead reflects whether each core repertoire role has enough evidence.";
}

function reasonForChange(currentScore, previousScore, current, previous, currentVersion, previousVersion, currentContract = {}, previousContract = {}) {
  if (previousScore === null) return "This is your baseline score; a later report using the same methodology can explain what changed.";
  if (currentVersion !== previousVersion) return `The saved score uses ${previousVersion}; it is not compared numerically with the current ${currentVersion} method.`;
  if (currentScore === previousScore) return "The rounded score is unchanged from the previous report.";
  if (currentVersion === "repertoire_coverage_v2") {
    const earlier = new Map((previousContract.components || []).map((component) => [component.key, component]));
    const changes = (currentContract.components || []).flatMap((component) => {
      const before = earlier.get(component.key);
      if (!before || !finite(component.score) || !finite(before.score)) return [];
      return [{ title: component.label || component.title || component.key, now: Number(component.score), before: Number(before.score), impact: Math.abs(Number(component.score) - Number(before.score)) * Number(component.weight || 0) }];
    }).sort((left, right) => right.impact - left.impact);
    if (changes.length) return `${changes[0].title} ${changes[0].now > changes[0].before ? "increased" : "decreased"} from ${changes[0].before} to ${changes[0].now}, the largest weighted coverage change.`;
  }
  const changes = OPENINGFIT_SCORE_FORMULA.flatMap((component) => {
    const now = componentValue(current, component);
    const before = componentValue(previous, component);
    return now === null || before === null ? [] : [{ ...component, now, before, contribution: Math.abs(now - before) * component.weight }];
  }).sort((left, right) => right.contribution - left.contribution);
  if (!changes.length) return `The score moved from ${previousScore} to ${currentScore}, but the reports do not contain compatible component data.`;
  const main = changes[0];
  return `${main.title} ${main.now > main.before ? "increased" : "decreased"} from ${main.before} to ${main.now}, the largest weighted component change.`;
}

export function buildOpeningFitScoreTransparency({ model = {}, report = {}, previousReport = null } = {}) {
  const currentScore = integer(model.health?.score ?? report.openingFitScore ?? report.opening_fit_score);
  const previousScore = integer(previousReport?.openingfit_score ?? previousReport?.openingFitScore ?? previousReport?.opening_fit_score);
  const games = integer(model.header?.games ?? report.gamesAnalysed ?? report.gamesImported ?? report.total_games) || 0;
  const currentBreakdown = breakdown(report);
  const previousBreakdown = breakdown(previousReport || {});
  const contract = scoreContract(report);
  const previousContract = scoreContract(previousReport || {});
  const formulaVersion = text(contract.formulaVersion) || "openingfit_score_v1";
  const previousFormulaVersion = text(previousContract.formulaVersion) || "openingfit_score_v1";
  const components = formulaVersion === "repertoire_coverage_v2" && Array.isArray(contract.components)
    ? contract.components.map((component) => ({
      key: component.key,
      title: component.label || component.title || component.key,
      value: integer(component.score),
      exactValue: finite(component.score) ? Number(component.score) : null,
      weight: integer(component.weight),
      contribution: finite(component.contribution) ? Number(component.contribution) : null,
      explanation: component.key === "repertoireCompleteness"
        ? "The share of White, Black against 1.e4, and Black against 1.d4 roles that meet the evidence threshold."
        : "How close the three roles are, on average, to their current opening-specific evidence threshold.",
    })).filter((component) => component.value !== null && component.weight !== null)
    : OPENINGFIT_SCORE_FORMULA.flatMap((component) => {
      const value = componentValue(currentBreakdown, component);
      return value === null ? [] : [{ key: component.key, title: component.title, value, exactValue: value, weight: component.weight, contribution: value * component.weight / 100, explanation: component.explanation }];
    });
  const contributors = components
    .map((component) => ({ ...component, constraint: (100 - component.value) * component.weight }))
    .sort((left, right) => right.constraint - left.constraint)
    .slice(0, 3)
    .map((component) => ({ key: component.key, title: component.title, value: component.value, explanation: component.value >= 70 ? `${component.title} supports the current score.` : `${component.title} is limiting the current score.` }));
  const evidence = components.find((item) => item.key === "evidenceConfidence" || item.key === "evidenceCoverage");
  const coverage = formulaVersion === "repertoire_coverage_v2"
    ? coverageLabel(evidence?.exactValue, model.health?.confidence)
    : finite(evidence?.exactValue)
      ? Number(evidence.exactValue) >= 75 ? "Broad report coverage" : Number(evidence.exactValue) >= 50 ? "Moderate report coverage" : "Limited report coverage"
      : text(model.health?.confidence) || "Insufficient data";
  const provisional = games < OPENINGFIT_SCORE_MINIMUM_GAMES;
  const repairStatus = contract.repairStatus || contract.repair_status || null;
  return {
    currentScore, previousScore, games, confidence: coverage, coverage, provisional,
    statusLabel: provisional ? "Provisional score" : coverage,
    components, hasComponentData: components.length > 0,
    reasonForChange: reasonForChange(currentScore, previousScore, currentBreakdown, previousBreakdown, formulaVersion, previousFormulaVersion, contract, previousContract),
    scale: { minimum: 0, maximum: 100 }, formulaVersion, previousFormulaVersion,
    comparableMethodology: previousScore === null || formulaVersion === previousFormulaVersion,
    developmentState: openingFitDevelopmentState(currentScore), contributors,
    meaning: formulaVersion === "repertoire_coverage_v2"
      ? text(contract.meaning) || "Coverage measures the three core repertoire roles and their supporting evidence. It is not a chess rating, opening-quality grade, or engine evaluation."
      : "This legacy score mixed repertoire stability, results, evidence and weakness signals. It is retained for historical reports and is not a chess rating or engine judgement.",
    weaknessContext: weaknessContext(model, repairStatus),
    affects: components.length ? "The calculation uses only the components and weights shown below." : "This older report contains the final score but not a compatible component breakdown.",
    doesNotAffect: formulaVersion === "repertoire_coverage_v2" ? "Recent win rate, chess rating and weakness status do not directly change this coverage score." : "Official ratings do not directly determine the legacy score.",
    whyChange: formulaVersion === "repertoire_coverage_v2"
      ? "It rises only when correctly attributed games establish or strengthen White, Black against 1.e4, and Black against 1.d4 evidence."
      : "The legacy method also moved with results and weakness signals.",
    smallSamples: `Fewer than ${OPENINGFIT_SCORE_MINIMUM_GAMES} relevant games in a role cannot establish that role.`,
    repairStatus,
    recentResultsStatus: contract.recentResults || contract.recent_results || null,
  };
}
