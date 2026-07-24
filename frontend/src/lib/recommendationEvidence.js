export const RECOMMENDATION_EVIDENCE_THRESHOLDS = Object.freeze({
  minimum: 5,
  medium: 10,
  high: 15,
});

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const numeric = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function roleFor(item = {}) {
  const explicit = clean(item?.perspective?.role || item.openingRole || item.opening_role || item.role).toLowerCase();
  if (["played_as_white", "played_as_black", "faced_as_white", "faced_as_black"].includes(explicit)) return explicit;
  const context = clean(item.context || item.repertoireContext || item.repertoire_context).toLowerCase();
  if (context === "played_as_white") return context;
  if (context.startsWith("black_")) return "played_as_black";
  if (["faced_as_white", "faced_as_black"].includes(context)) return context;
  return "unknown_mixed";
}

function slotFor(item, role) {
  if (role === "played_as_white") return "white";
  if (role !== "played_as_black") return null;
  return item.repertoireSlot || item.repertoire_slot || item.context || item.repertoireContext || "black_vs_other";
}

export function confidenceForRecommendation(games, valid = true, traceable = true) {
  const count = Math.max(0, Math.round(numeric(games)));
  if (valid && traceable && count >= RECOMMENDATION_EVIDENCE_THRESHOLDS.high) return { level: "high", label: "High confidence" };
  if (valid && count >= RECOMMENDATION_EVIDENCE_THRESHOLDS.medium) return { level: "medium", label: "Medium confidence" };
  return { level: "low", label: "Low confidence" };
}

export function validateRecommendationEvidence(entry = {}) {
  const sample = entry.sample && typeof entry.sample === "object" ? entry.sample : entry;
  const games = Math.max(0, Math.round(numeric(sample.games ?? entry.games)));
  const hasResults = ["wins", "draws", "losses"].some((key) => sample[key] !== undefined && sample[key] !== null);
  const wins = Math.max(0, Math.round(numeric(sample.wins ?? entry.wins)));
  const draws = Math.max(0, Math.round(numeric(sample.draws ?? entry.draws)));
  const losses = Math.max(0, Math.round(numeric(sample.losses ?? entry.losses)));
  const rawIds = sample.gameIds || sample.supportingGameIds || sample.supporting_game_ids || entry.supportingGameIds || entry.supporting_game_ids;
  const ids = Array.isArray(rawIds) ? [...new Set(rawIds.map(clean).filter(Boolean))] : [];
  const issues = [];
  if (hasResults && wins + draws + losses !== games) issues.push("results_do_not_reconcile");
  if (ids.length && ids.length !== games) issues.push("supporting_games_do_not_reconcile");
  if (entry.confidence && typeof entry.confidence === "object" && entry.confidence.sampleSize !== undefined && numeric(entry.confidence.sampleSize) !== games) {
    issues.push("confidence_sample_does_not_reconcile");
  }
  const supplied = sample.scoreRate ?? entry.scoreRate ?? entry.score;
  const calculated = games && hasResults ? Math.round(((wins + draws * 0.5) / games) * 1000) / 10 : supplied !== undefined && supplied !== null ? numeric(supplied) : null;
  if (hasResults && supplied !== undefined && supplied !== null && calculated !== null && Math.abs(numeric(supplied) - calculated) > 0.11) {
    issues.push("score_rate_does_not_reconcile");
  }
  return {
    valid: issues.length === 0,
    issues,
    sample: { gameIds: ids, games, wins, draws, losses, scoreRate: calculated },
  };
}

export function normaliseCanonicalRecommendation(entry) {
  if (!entry) return null;
  const role = roleFor(entry);
  const relationship = role.startsWith("played_") ? "played" : role.startsWith("faced_") ? "faced" : "unknown";
  const checked = validateRecommendationEvidence(entry);
  const confidence = confidenceForRecommendation(checked.sample.games, checked.valid && relationship !== "unknown", checked.sample.gameIds.length === checked.sample.games);
  const supported = checked.valid && checked.sample.games >= RECOMMENDATION_EVIDENCE_THRESHOLDS.minimum;
  const originalVerdict = clean(entry.verdict).toLowerCase();
  const verdict = supported ? originalVerdict : "insufficient-data";
  return {
    ...entry,
    opening: clean(entry.openingName || entry.opening || entry.name),
    openingName: clean(entry.openingName || entry.opening || entry.name),
    role,
    relationship,
    repertoireOwned: relationship === "played",
    repertoireSlot: slotFor(entry, role),
    sample: checked.sample,
    games: checked.sample.games,
    score: checked.sample.scoreRate,
    scoreRate: checked.sample.scoreRate,
    verdict,
    sampleSizeStatus: supported ? "sufficient" : "insufficient_data",
    confidence: { ...(typeof entry.confidence === "object" ? entry.confidence : {}), ...confidence, sampleSize: checked.sample.games },
    validation: { valid: checked.valid, issues: checked.issues },
  };
}

function recommendationFromAggregate(item = {}) {
  const role = roleFor(item);
  const relationship = role.startsWith("played_") ? "played" : role.startsWith("faced_") ? "faced" : "unknown";
  const games = Math.max(0, Math.round(numeric(item.games)));
  const wins = Math.max(0, Math.round(numeric(item.wins)));
  const draws = Math.max(0, Math.round(numeric(item.draws)));
  const losses = Math.max(0, Math.round(numeric(item.losses)));
  const scoreRate = games ? Math.round(((wins + draws * 0.5) / games) * 1000) / 10 : null;
  const supported = games >= RECOMMENDATION_EVIDENCE_THRESHOLDS.minimum && relationship !== "unknown";
  const verdict = !supported ? "insufficient-data" : relationship === "faced" ? "explore" : scoreRate < 45 ? "repair" : scoreRate >= 55 ? "keep" : "explore";
  return normaliseCanonicalRecommendation({
    recommendationId: `${clean(item.opening || item.name).toLowerCase()}:${role}`,
    opening: item.opening || item.name,
    openingName: item.opening || item.name,
    role,
    relationship,
    repertoireOwned: relationship === "played",
    repertoireSlot: slotFor(item, role),
    verdict,
    sample: { games, wins, draws, losses, scoreRate, gameIds: Array.isArray(item.gameIds) ? item.gameIds : [] },
    evidence: [`${games} game${games === 1 ? "" : "s"}: ${wins} wins, ${draws} draws, ${losses} losses.`, `Chess score: ${scoreRate}%.`],
  });
}

export function buildFilteredReportDecision(openings = [], totalGames = 0) {
  const recommendations = openings.map(recommendationFromAggregate);
  const owned = recommendations.filter((item) => item.repertoireOwned && item.sampleSizeStatus === "sufficient");
  const strength = owned.filter((item) => item.verdict === "keep").sort((a, b) => b.sample.games - a.sample.games || b.scoreRate - a.scoreRate || a.opening.localeCompare(b.opening))[0] || null;
  const problem = owned.filter((item) => item.verdict === "repair").sort((a, b) => a.scoreRate - b.scoreRate || b.sample.games - a.sample.games || a.opening.localeCompare(b.opening))[0] || null;
  const faced = recommendations.filter((item) => item.relationship === "faced" && item.sampleSizeStatus === "sufficient").sort((a, b) => b.sample.games - a.sample.games || a.opening.localeCompare(b.opening))[0] || null;
  const target = problem || faced || strength;
  const type = problem ? "repair_repertoire" : faced ? "prepare_against" : strength ? "consolidate_strength" : "collect_more_games";
  const label = problem ? `Repair ${problem.opening}` : faced ? `Prepare against the ${faced.opening}` : strength ? `Keep playing ${strength.opening}` : "Collect more games before changing your repertoire";
  const reason = target
    ? `${target.sample.games} filtered ${target.opening} game${target.sample.games === 1 ? "" : "s"} produce a ${target.scoreRate}% chess score.`
    : "No opening in this filtered view has five correctly attributed games, so no repertoire weakness is claimed.";
  return {
    schemaVersion: 2,
    recommendations,
    establishedStrength: strength,
    primaryProblem: problem,
    nextTrainingAction: { type, opening: target?.opening || null, role: target?.role || null, label, reason, recommendationId: target?.recommendationId || null, sample: target?.sample || null },
    supportingEvidence: target ? [...target.evidence, reason] : [reason],
    reportCoverage: { level: totalGames >= 50 ? "broad" : totalGames >= 20 ? "moderate" : totalGames >= 5 ? "limited" : "insufficient", gamesAnalysed: totalGames },
    confidence: { status: strength || problem || faced ? "sufficient" : "insufficient_data", gamesAnalysed: totalGames, minimumOpeningGames: RECOMMENDATION_EVIDENCE_THRESHOLDS.minimum },
    baseline: { status: "filtered_view", hasComparablePrevious: false, comparisonClaimsAllowed: false },
  };
}

export function normaliseReportDecision(decision = {}) {
  if (!decision || typeof decision !== "object") return null;
  const recommendations = Array.isArray(decision.recommendations) ? decision.recommendations.map(normaliseCanonicalRecommendation).filter(Boolean) : [];
  const byId = (entry) => {
    const normalized = normaliseCanonicalRecommendation(entry);
    if (!normalized || normalized.sampleSizeStatus !== "sufficient") return null;
    return recommendations.find((item) => item.recommendationId && item.recommendationId === normalized.recommendationId) || normalized;
  };
  const establishedStrength = byId(decision.establishedStrength);
  const primaryProblem = byId(decision.primaryProblem);
  let nextTrainingAction = decision.nextTrainingAction || null;
  const target = recommendations.find((item) => item.recommendationId === nextTrainingAction?.recommendationId && item.sampleSizeStatus === "sufficient");
  if (nextTrainingAction && target) {
    const openingMismatch = nextTrainingAction.opening && clean(nextTrainingAction.opening).toLowerCase() !== target.opening.toLowerCase();
    nextTrainingAction = {
      ...nextTrainingAction,
      opening: target.opening,
      role: target.role,
      sample: target.sample,
      label: openingMismatch ? target.trainingAction?.title || `Review ${target.opening}` : nextTrainingAction.label,
      reason: openingMismatch ? target.trainingAction?.explanation || `${target.sample.games} opening-specific games support this action.` : nextTrainingAction.reason,
      validation: openingMismatch ? { valid: false, issues: ["training_opening_does_not_reconcile"] } : nextTrainingAction.validation,
    };
  }
  if (!nextTrainingAction || (nextTrainingAction.recommendationId && !target)) {
    nextTrainingAction = { type: "collect_more_games", opening: null, role: null, label: "Collect more games before changing your repertoire", reason: "The saved recommendation evidence does not reconcile, so no repertoire change is recommended.", recommendationId: null, sample: null };
  }
  return { ...decision, schemaVersion: decision.schemaVersion || 1, recommendations, establishedStrength, primaryProblem, nextTrainingAction };
}
