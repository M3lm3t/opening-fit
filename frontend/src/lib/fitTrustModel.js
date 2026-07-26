export const OPENING_EVIDENCE_THRESHOLDS = Object.freeze({
  minimum: 5,
  moderate: 10,
  high: 15,
});

export const OPENING_VERDICT_DEFINITIONS = Object.freeze({
  fit: "How well the opening and resulting positions appear to match your demonstrated preferences, strengths and recurring successful patterns.",
  performance: "What your available results in this opening currently show.",
  confidence: "How much reliable, opening-specific data supports this verdict.",
});

export const OPENING_VERDICT_BANDS = Object.freeze({
  fit: Object.freeze({ strong: 65, mixed: 45 }),
  performance: Object.freeze({ strong: 55, inconsistent: 45 }),
});

function numeric(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace("%", ""));
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function rounded(value) {
  const parsed = numeric(value);
  if (parsed === null) return null;
  const normalised = parsed <= 1 && parsed >= 0 ? parsed * 100 : parsed;
  return Math.round(normalised * 10) / 10;
}

function sampleFor(item = {}) {
  return item.sample && typeof item.sample === "object" ? item.sample : item;
}

function gameCount(item = {}) {
  const sample = sampleFor(item);
  const value = numeric(sample.games ?? item.games ?? item.games_played ?? item.gamesPlayed ?? item.count);
  return value === null ? 0 : Math.max(0, Math.round(value));
}

function resultSample(item = {}) {
  const sample = sampleFor(item);
  const games = gameCount(item);
  const raw = [sample.wins ?? item.wins ?? item.w, sample.draws ?? item.draws ?? item.d, sample.losses ?? item.losses ?? item.l];
  const supplied = raw.some((value) => value !== undefined && value !== null && value !== "");
  const [wins, draws, losses] = raw.map((value) => {
    const parsed = numeric(value);
    return parsed === null ? null : Math.max(0, Math.round(parsed));
  });
  const reconciled = supplied && [wins, draws, losses].every((value) => value !== null) && wins + draws + losses === games;
  const explicitRate = rounded(sample.scoreRate ?? sample.score_rate ?? item.scoreRate ?? item.score_rate ?? item.rawResultScore ?? item.raw_result_score ?? item.winRate ?? item.win_rate);
  const scoreRate = reconciled ? Math.round(((wins + draws * 0.5) / games) * 1000) / 10 : !supplied && games && explicitRate !== null && explicitRate >= 0 && explicitRate <= 100 ? explicitRate : null;
  return { games, wins, draws, losses, supplied, reconciled, scoreRate };
}

function validationInvalid(item = {}, sample = resultSample(item)) {
  const validation = item.validation;
  if (validation && typeof validation === "object" && validation.valid === false) return true;
  if (sample.supplied && !sample.reconciled) return true;
  const ids = sampleFor(item).gameIds || sampleFor(item).supportingGameIds || sampleFor(item).supporting_game_ids;
  return Array.isArray(ids) && ids.length > 0 && ids.length !== sample.games;
}

export function analysisConfidence(item = {}) {
  const sample = resultSample(item);
  const games = sample.games;
  if (!games) return { level: "insufficient", label: "Insufficient data", games, explanation: "No opening-specific games are available." };
  if (games < OPENING_EVIDENCE_THRESHOLDS.minimum || validationInvalid(item, sample)) {
    return { level: "insufficient", label: "Insufficient data", games, explanation: `${games} game${games === 1 ? " is" : "s are"} not enough reliable evidence for a firm opening verdict.` };
  }

  const ids = sampleFor(item).gameIds || sampleFor(item).supportingGameIds || sampleFor(item).supporting_game_ids;
  const traceable = Array.isArray(ids) && ids.length === games;
  const highQuality = sample.reconciled && traceable;
  const moderateQuality = sample.reconciled || (!sample.supplied && sample.scoreRate !== null);
  const level = games >= OPENING_EVIDENCE_THRESHOLDS.high && highQuality
    ? "high"
    : games >= OPENING_EVIDENCE_THRESHOLDS.moderate && moderateQuality
      ? "moderate"
      : "low";
  const label = level === "high" ? "High" : level === "moderate" ? "Moderate" : "Low";
  const explanation = level === "high"
    ? `${games} traceable games with reconciled results provide a repeated opening-specific sample.`
    : level === "moderate"
      ? `${games} games support a useful pattern, but not a final verdict.`
      : `${games} games provide limited or incomplete opening-specific evidence.`;
  return { level, label, games, explanation };
}

export function openingFitScore(item = {}) {
  return rounded(item.fitScore ?? item.fit_score ?? item.openingFitScore ?? item.opening_fit_score ?? item.traitFitScore ?? item.trait_fit_score ?? item.styleFitScore ?? item.style_fit_score);
}

export function fitBand(score) {
  const value = rounded(score);
  if (value === null) return "Unknown";
  if (value >= OPENING_VERDICT_BANDS.fit.strong) return "Strong";
  if (value >= OPENING_VERDICT_BANDS.fit.mixed) return "Mixed";
  return "Weak";
}

export function performanceBand(item = {}) {
  const score = resultSample(item).scoreRate;
  if (score === null) return "Unknown";
  if (score >= OPENING_VERDICT_BANDS.performance.strong) return "Strong";
  if (score >= OPENING_VERDICT_BANDS.performance.inconsistent) return "Inconsistent";
  return "Struggling";
}

export function performanceSummary(item = {}) {
  const sample = resultSample(item);
  if (sample.reconciled) return `${sample.wins} wins, ${sample.draws} draws, ${sample.losses} losses`;
  if (sample.scoreRate !== null) return `${sample.scoreRate}% chess score across ${sample.games} game${sample.games === 1 ? "" : "s"}`;
  return sample.games ? `${sample.games} opening-specific game${sample.games === 1 ? "" : "s"}; result split unavailable` : "Performance unavailable";
}

function branchLabel(item = {}) {
  const issue = item.recurringIssue || item.recurring_issue || item.issue;
  const named = item.trainingAction?.variationName || item.training_action?.variationName || item.variationName || item.variation_name || issue?.variationName || issue?.variation_name;
  if (named) return String(named).trim();
  const sequence = issue?.positionOrMoveSequence || issue?.position_or_move_sequence || issue?.moveLine || issue?.move_line;
  return sequence ? `after ${String(sequence).trim()}` : "";
}

function recommendationLabel(item = {}, fallback = "Review") {
  const raw = String(item.verdict || item.recommendationLabel || item.recommendation_label || fallback).toLowerCase();
  if (/keep|strong|main/.test(raw)) return "Keep";
  if (/repair|improve|fix|review/.test(raw)) return "Improve";
  if (/replace|avoid|reduce|drop|park/.test(raw)) return "Replace";
  if (/recommend|try|explore/.test(raw)) return "Recommended";
  if (/insufficient/.test(raw)) return "Wait for more data";
  return fallback;
}

export function buildOpeningVerdictPresentation(item = {}, options = {}) {
  const fitScore = openingFitScore(item);
  const result = resultSample(item);
  const confidence = analysisConfidence(item);
  const opening = String(item.opening || item.openingName || item.name || options.opening || "this opening").trim();
  const baseRecommendation = recommendationLabel(item, options.verdict || "Review");
  const branch = branchLabel(item);
  const branchRepair = Boolean(branch && ["Improve", "Replace"].includes(baseRecommendation));
  const recommendation = branchRepair
    ? branch.startsWith("after ")
      ? `Keep ${opening}, but repair the branch ${branch}.`
      : `Keep ${opening}, but repair the ${branch} branch.`
    : baseRecommendation;
  return {
    fit: { label: fitBand(fitScore), score: fitScore, definition: OPENING_VERDICT_DEFINITIONS.fit },
    performance: { label: performanceBand(item), score: result.scoreRate, detail: performanceSummary(item), definition: OPENING_VERDICT_DEFINITIONS.performance },
    confidence: { label: confidence.label, level: confidence.level, games: confidence.games, detail: confidence.explanation, definition: OPENING_VERDICT_DEFINITIONS.confidence },
    recommendation,
    branchRepair,
  };
}

export function formatOpeningVerdictText(item = {}, options = {}) {
  const model = buildOpeningVerdictPresentation(item, options);
  return `Fit: ${model.fit.label}. Performance: ${model.performance.label}. Confidence: ${model.confidence.label}. Verdict: ${model.recommendation}.`;
}

export function fitEvidence(item = {}) {
  const rows = [];
  const games = gameCount(item);
  if (games) rows.push(["Current performance", performanceSummary(item)]);
  const plan = rounded(item.planClarityScore ?? item.plan_clarity_score);
  if (plan !== null) rows.push(["Move-order consistency", `${plan}/100 plan-clarity signal`]);
  const early = rounded(item.earlyLossRate ?? item.early_loss_rate);
  if (early !== null) rows.push(["Early-game mistakes", `${early}% early-loss rate`]);
  const trend = item.recentTrend || item.recent_trend;
  if (trend) rows.push(["Trend", String(trend)]);
  const recency = item.lastPlayedAt || item.last_played_at || item.lastSeen || item.last_seen;
  if (recency) rows.push(["Recency", String(recency)]);
  const style = rounded(item.traitFitScore ?? item.trait_fit_score ?? item.styleFitScore ?? item.style_fit_score);
  if (style !== null) rows.push(["Behavioural fit", `${style}/100 available style signal`]);
  return rows;
}

export function evidenceBasedReason(item = {}) {
  const games = gameCount(item);
  const early = rounded(item.earlyLossRate ?? item.early_loss_rate);
  const trend = String(item.recentTrend || item.recent_trend || "").toLowerCase();
  const plan = rounded(item.planClarityScore ?? item.plan_clarity_score);
  const supplied = String(item.shortReason || item.short_reason || item.recommendationReason || item.recommendation_reason || item.reason || "").trim();
  if (games > 0 && games < OPENING_EVIDENCE_THRESHOLDS.minimum) return `Only ${games} game${games === 1 ? "" : "s"} is available, so this is a watch signal rather than a firm verdict.`;
  if (early !== null && early >= 45) return `Repeated early problems affect ${early}% of the available sample.`;
  if (trend === "declining") return "Recent results are declining in the available trend data.";
  if (plan !== null && plan < 52) return `The current move-order pattern branches often (plan clarity ${plan}/100).`;
  if (supplied) return supplied;
  return games ? performanceSummary(item) : "The report does not contain enough opening-specific evidence to explain this recommendation.";
}

export async function saveRecommendationFeedback(send, payload) {
  if (typeof send !== "function") return false;
  try { return (await send("recommendation_feedback", payload)) === true; } catch { return false; }
}
