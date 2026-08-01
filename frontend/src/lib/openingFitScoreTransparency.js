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
  const value = report.repertoireHealth || report.repertoire_health || report.repertoireCoverageScore || report.repertoire_coverage_score || report.openingFitScoreContract || report.opening_fit_score_contract || report.score_contract;
  return value && typeof value === "object" ? value : {};
}

function componentValue(source, component) {
  return integer(component.aliases.map((key) => source[key]).find(finite));
}

function coverageLabel(value, fallback = "") {
  if (finite(value)) return Number(value) >= 75 ? "Broad role evidence" : Number(value) >= 50 ? "Moderate role evidence" : "Limited role evidence";
  return text(fallback) || "Insufficient data";
}

const ROLE_REASON_COPY = Object.freeze({
  below_evidence_threshold: "one or more roles have not reached the supporting-game threshold",
  split_across_openings: "evidence is split across several openings in a role",
  verdict_or_confidence_unsupported: "a role has games but its verdict or confidence is not yet supported",
  role_attribution_unresolved: "some games could not be assigned reliably to a repertoire role",
  opening_unclassified: "some eligible games could not be classified into a usable opening family",
  unsupported_or_unknown: "an older or incomplete report does not contain enough role-specific evidence",
});

function weaknessContext(model = {}, repairStatus = null) {
  const problem = model.authoritative?.primaryProblem || model.primaryProblem;
  if (problem) return "A reliable opening weakness was found and is shown separately as a specific repair target; it does not alter repertoire coverage.";
  const reasons = [...new Set((model.repertoire || []).flatMap((role) => [role.evidenceReasonCode, ...(role.reasonCodes || [])]).map((reason) => ROLE_REASON_COPY[reason]).filter(Boolean))];
  const constraint = reasons.length ? ` The score is lower because ${reasons.slice(0, 2).join(" and ")}.` : "";
  if (repairStatus?.label) return `${repairStatus.label}. This is a neutral evidence state, not a good or bad coverage component.${constraint}`;
  return `No statistically reliable weakness was found. That neutral finding does not mean every core repertoire role is established: coverage reflects whether each role has enough consistent evidence, not the number of weaknesses.${constraint}`;
}

function reasonForChange(currentScore, previousScore, current, previous, currentVersion, previousVersion, currentContract = {}, previousContract = {}) {
  if (previousScore === null) return "This is your baseline coverage indicator; a later report using the same methodology can explain what changed.";
  if (currentVersion !== previousVersion) return `The saved score uses ${previousVersion}; it is not compared numerically with the current ${currentVersion} method.`;
  if (currentScore === previousScore) return "The rounded coverage indicator is unchanged from the previous report.";
  if (["repertoire_health_v2", "repertoire_coverage_v2", "repertoire_coverage_v3"].includes(currentVersion)) {
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
  if (!changes.length) return `The coverage indicator moved from ${previousScore} to ${currentScore}, but the reports do not contain compatible component data.`;
  const main = changes[0];
  return `${main.title} ${main.now > main.before ? "increased" : "decreased"} from ${main.before} to ${main.now}, the largest weighted component change.`;
}

export function buildOpeningFitScoreTransparency({ model = {}, report = {}, previousReport = null } = {}) {
  const contract = scoreContract(report);
  const previousContract = scoreContract(previousReport || {});
  const currentScore = integer(contract.score ?? model.health?.score ?? report.openingFitScore ?? report.opening_fit_score);
  const previousScore = integer(previousContract.score ?? previousReport?.openingfit_score ?? previousReport?.openingFitScore ?? previousReport?.opening_fit_score);
  const games = integer(model.header?.games ?? report.gamesAnalysed ?? report.gamesImported ?? report.total_games) || 0;
  const currentBreakdown = breakdown(report);
  const previousBreakdown = breakdown(previousReport || {});
  const formulaVersion = text(contract.version || contract.formulaVersion) || "openingfit_score_v1";
  const previousFormulaVersion = text(previousContract.version || previousContract.formulaVersion) || "openingfit_score_v1";
  const isHealthContract = ["repertoire_health_v2", "repertoire_coverage_v2", "repertoire_coverage_v3"].includes(formulaVersion);
  const components = isHealthContract && Array.isArray(contract.components)
    ? contract.components.map((component) => ({
      key: component.key,
      title: component.label || component.title || component.key,
      value: integer(component.score),
      exactValue: finite(component.score) ? Number(component.score) : null,
      weight: finite(component.effectiveWeight) ? Number(component.effectiveWeight) : integer(component.weight),
      baseWeight: finite(component.baseWeight) ? Number(component.baseWeight) : integer(component.weight),
      available: component.available !== false,
      contribution: finite(component.contribution) ? Number(component.contribution) : null,
      explanation: ({
        repertoireCompleteness: "The share of White, Black against 1.e4, and Black against 1.d4 roles that meet the evidence threshold.",
        evidenceConfidence: "How close the three roles are, on average, to their opening-specific evidence threshold.",
        roleCompleteness: "The share of White, Black against 1.e4, and Black against 1.d4 roles established from openings played by the user.",
        concentrationConsistency: "The average share held by the leading opening in each role where personal evidence is available. Missing roles are represented by role completeness, not a fabricated zero here.",
        evidenceStrength: "How strongly the leading opening in each role is supported, reaching full strength at 25 unique games.",
        unresolvedRecurringProblems: "Whether the three user-played roles contain an unresolved evidence-backed repair target or a sufficient but mixed signal.",
      })[component.key] || text(component.explanation) || "A documented input to repertoire coverage.",
    })).filter((component) => component.available && component.value !== null && component.weight !== null)
    : OPENINGFIT_SCORE_FORMULA.flatMap((component) => {
      const value = componentValue(currentBreakdown, component);
      return value === null ? [] : [{ key: component.key, title: component.title, value, exactValue: value, weight: component.weight, contribution: value * component.weight / 100, explanation: component.explanation }];
    });
  const contributors = components
    .map((component) => ({ ...component, constraint: (100 - component.value) * component.weight }))
    .sort((left, right) => right.constraint - left.constraint)
    .slice(0, 3)
    .map((component) => ({ key: component.key, title: component.title, value: component.value, explanation: component.value >= 70 ? `${component.title} supports the current coverage indicator.` : `${component.title} is limiting the current coverage indicator.` }));
  const evidence = components.find((item) => ["evidenceStrength", "evidenceConfidence", "evidenceCoverage"].includes(item.key));
  const coverage = isHealthContract
    ? coverageLabel(evidence?.exactValue, model.health?.confidence)
    : finite(evidence?.exactValue)
      ? Number(evidence.exactValue) >= 75 ? "Broad report coverage" : Number(evidence.exactValue) >= 50 ? "Moderate report coverage" : "Limited report coverage"
      : text(model.health?.confidence) || "Insufficient data";
  const provisional = games < OPENINGFIT_SCORE_MINIMUM_GAMES;
  const repairStatus = contract.repairStatus || contract.repair_status || null;
  return {
    currentScore, previousScore, games, confidence: coverage, coverage, provisional,
    displayScore: components.length ? currentScore : null,
    scoreDisplayLabel: components.length ? (currentScore === null ? "Score still forming" : `${currentScore}/100`) : "Score still forming",
    statusLabel: provisional ? "Provisional coverage indicator" : coverage,
    components, hasComponentData: components.length > 0,
    reasonForChange: reasonForChange(currentScore, previousScore, currentBreakdown, previousBreakdown, formulaVersion, previousFormulaVersion, contract, previousContract),
    scale: { minimum: 0, maximum: 100 }, formulaVersion, previousFormulaVersion,
    comparableMethodology: previousScore === null || (formulaVersion === previousFormulaVersion && contract.comparisonEligibility?.eligible !== false),
    developmentState: openingFitDevelopmentState(currentScore), contributors,
    meaning: isHealthContract
      ? text(contract.meaning) || "Repertoire Health describes the condition and completeness of the three core repertoire roles. It is not a chess rating, opening-quality grade, or engine evaluation."
      : "This legacy score mixed repertoire stability, results, evidence and weakness signals. It is retained for historical reports and is not a chess rating or engine judgement.",
    weaknessContext: text(contract.weaknessExplanation) || weaknessContext(model, repairStatus),
    explanation: text(contract.explanation),
    limitingFactors: Array.isArray(contract.limitingFactors) ? contract.limitingFactors : contributors.slice(0, 2),
    evidenceConfidence: contract.confidence && typeof contract.confidence === "object" ? contract.confidence : null,
    affects: components.length ? "The calculation uses only the components and weights shown below." : "This older report contains the final score but not a compatible component breakdown.",
    doesNotAffect: formulaVersion === "repertoire_health_v2" || formulaVersion === "repertoire_coverage_v3" ? "Chess rating and opponent openings faced by the player do not fill or lower role completeness." : formulaVersion === "repertoire_coverage_v2" ? "Recent win rate, chess rating and weakness status do not directly change this coverage score." : "Official ratings do not directly determine the legacy score.",
    whyChange: formulaVersion === "repertoire_health_v2" || formulaVersion === "repertoire_coverage_v3"
      ? "It rises when user-played roles become complete, concentrated, strongly evidenced, and free of unresolved recurring problems."
      : formulaVersion === "repertoire_coverage_v2"
        ? "It rises only when correctly attributed games establish or strengthen White, Black against 1.e4, and Black against 1.d4 evidence."
      : "The legacy method also moved with results and weakness signals.",
    smallSamples: `Fewer than ${OPENINGFIT_SCORE_MINIMUM_GAMES} relevant games in a role cannot establish that role.`,
    roleScores: Array.isArray(contract.roleScores) ? contract.roleScores : [],
    concentrationRule: contract.concentrationRule || null,
    repairStatus,
    recentResultsStatus: contract.recentResults || contract.recent_results || null,
  };
}
