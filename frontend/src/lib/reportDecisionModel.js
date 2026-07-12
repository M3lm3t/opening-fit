import { analysisConfidence, evidenceBasedReason, fitBand, fitEvidence, performanceSummary } from "./fitTrustModel.js";

function list(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "object") return Object.entries(value).map(([name, row]) => ({ name, ...(typeof row === "object" ? row : {}) }));
  return [];
}

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function openingName(item) {
  return text(item?.name || item?.opening || item?.openingName || item?.opening_name || item?.label || item?.ecoName);
}

export function openingGames(item) {
  const value = Number(item?.games ?? item?.count ?? item?.total ?? item?.sampleSize ?? item?.sample_size ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function openingScore(item) {
  const raw = item?.fitScore ?? item?.fit_score ?? item?.winRate ?? item?.win_rate ?? item?.score;
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(String(raw).replace("%", ""));
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

export function openingContext(item) {
  const raw = text([item?.context, item?.contextKey, item?.context_key, item?.role, item?.side, item?.colour, item?.color].join(" ")).toLowerCase();
  if (raw.includes("white") || raw.includes("played_as_white")) return { key: "white", label: "White" };
  if (raw.includes("black_vs_e4") || raw.includes("vs 1.e4") || raw.includes("vs e4")) return { key: "black_e4", label: "Black vs 1.e4" };
  if (raw.includes("black_vs_d4") || raw.includes("vs 1.d4") || raw.includes("vs d4")) return { key: "black_d4", label: "Black vs 1.d4" };
  if (raw.includes("black")) return { key: "black_other", label: "Black / other responses" };
  return { key: "unresolved", label: "Other or unresolved" };
}

export function openingConfidence(item) {
  return analysisConfidence(item).label;
}

function verdict(item) {
  return text(item?.fitVerdict || item?.fit_verdict || item?.verdict || item?.recommendation || item?.status).toLowerCase();
}

function reason(item) {
  const provided = text(item?.recommendationReason || item?.recommendation_reason || item?.fitExplanation || item?.fit_explanation || item?.reason || item?.summary);
  if (provided) return provided;
  const games = openingGames(item);
  const score = openingScore(item);
  if (games && score !== null) return `${score}% result across ${games} analysed game${games === 1 ? "" : "s"}.`;
  if (games) return `Appeared in ${games} analysed game${games === 1 ? "" : "s"}.`;
  return "No supporting explanation is available yet.";
}

export function collectReportOpenings(data = {}) {
  const recommendationGroups = data.opening_recommendations || data.openingRecommendations || {};
  const grouped = [
    ...list(recommendationGroups.white || recommendationGroups.white_repertoire).map((item) => ({ ...item, context: item.context || "white_repertoire" })),
    ...list(recommendationGroups.black_vs_e4 || recommendationGroups.blackVsE4).map((item) => ({ ...item, context: item.context || "black_vs_e4" })),
    ...list(recommendationGroups.black_vs_d4 || recommendationGroups.blackVsD4).map((item) => ({ ...item, context: item.context || "black_vs_d4" })),
    ...list(recommendationGroups.black_vs_other || recommendationGroups.blackVsOther).map((item) => ({ ...item, context: item.context || "black_vs_other" })),
  ];
  const sources = [
    data.preferred_white, data.preferredWhite, data.preferred_black, data.preferredBlack,
    grouped, data.best_openings, data.bestOpenings, data.top_openings, data.topOpenings,
    data.opening_stats, data.openingStats, data.openings,
  ];
  const seen = new Set();
  const resolvedNames = new Set();
  return sources.flatMap(list).filter((item) => {
    const name = openingName(item);
    if (!name || /unknown|unclassified|unclear transposition/i.test(name)) return false;
    const context = openingContext(item).key;
    const normalizedName = name.toLowerCase();
    if (context === "unresolved" && resolvedNames.has(normalizedName)) return false;
    if (context !== "unresolved") resolvedNames.add(normalizedName);
    const key = `${normalizedName}:${context}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function decisionType(item) {
  if (openingGames(item) < 3) return null;
  const label = verdict(item);
  if (/avoid|replace|reduce|drop|park|risky/.test(label)) return "reduce";
  if (/improve|repair|review|fix|weak|unstable/.test(label)) return "repair";
  if (/keep|reliable|strong|best|main weapon/.test(label)) return "keep";
  const games = openingGames(item);
  const score = openingScore(item);
  if (games >= 3 && score !== null && score >= 60) return "keep";
  if (games >= 3 && score !== null && score < 45) return "repair";
  return null;
}

function decision(item, type) {
  const context = openingContext(item);
  return {
    type,
    opening: openingName(item),
    context: context.label,
    contextKey: context.key,
    reason: evidenceBasedReason(item) || reason(item),
    confidence: openingConfidence(item),
    confidenceDetail: analysisConfidence(item),
    games: openingGames(item),
    score: openingScore(item),
    fitLabel: fitBand(openingScore(item), analysisConfidence(item)),
    performance: performanceSummary(item),
    evidence: fitEvidence(item),
    source: item,
  };
}

export function buildRepertoireDecisions(data = {}) {
  const openings = collectReportOpenings(data);
  const rank = (a, b) => openingGames(b) - openingGames(a) || (openingScore(b) ?? -1) - (openingScore(a) ?? -1);
  return ["keep", "repair", "reduce"]
    .map((type) => {
      const item = openings.filter((opening) => decisionType(opening) === type).sort(rank)[0];
      return item ? decision(item, type) : null;
    })
    .filter(Boolean);
}

function problemRows(data = {}) {
  return [
    ...list(data.problem_lines || data.problemLines),
    ...list(data.weak_lines || data.weakLines),
    ...list(data.weakestLineTracking?.lines || data.weakest_line_tracking?.lines),
  ];
}

export function buildCostlyIssues(data = {}, decisions = buildRepertoireDecisions(data)) {
  const rows = problemRows(data).map((item) => {
    const affected = Number(item.affectedGames ?? item.affected_games ?? item.games ?? item.count ?? 0) || 0;
    const lost = Number(item.lostGames ?? item.lost_games ?? item.losses ?? item.loss_count ?? 0) || 0;
    const severity = Number(item.severityScore ?? item.severity_score ?? item.severity ?? 0) || 0;
    return {
      opening: openingName(item) || text(item.position || item.lineName || item.line_name) || "Recurring opening position",
      line: text(item.variation || item.line || item.moveLine || item.move_line),
      affectedGames: affected,
      lostGames: lost,
      explanation: text(item.explanation || item.reason || item.summary || item.issue) || "This position recurs in the available game sample.",
      importance: lost * 5 + affected * 2 + severity,
      source: item,
    };
  });
  if (!rows.length) {
    decisions.filter((item) => item.type !== "keep").forEach((item) => rows.push({
      opening: item.opening,
      line: "",
      affectedGames: item.games,
      lostGames: 0,
      explanation: item.reason,
      importance: item.games * 2 + Math.max(0, 50 - (item.score ?? 50)),
      source: item.source,
    }));
  }
  return rows.sort((a, b) => b.importance - a.importance).slice(0, 5);
}

export function buildRepertoireMapModel(data = {}) {
  const groups = [
    ["white", "White repertoire"], ["black_e4", "Black versus 1.e4"],
    ["black_d4", "Black versus 1.d4"], ["black_other", "Other Black responses"],
    ["unresolved", "Other or unresolved"],
  ];
  const openings = collectReportOpenings(data);
  return groups.map(([key, label]) => {
    const candidates = openings.filter((item) => openingContext(item).key === key).sort((a, b) => openingGames(b) - openingGames(a));
    const main = candidates[0];
    if (!main) return null;
    const weak = candidates.filter((item) => item !== main).sort((a, b) => (openingScore(a) ?? 100) - (openingScore(b) ?? 100))[0];
    return {
      key, label, opening: openingName(main), verdict: verdict(main) || "Review",
      fit: openingScore(main), confidence: openingConfidence(main), games: openingGames(main),
      weakestLine: text(weak?.variation || weak?.line || weak?.moveLine || weak?.move_line) || (weak ? openingName(weak) : ""),
      nextAction: reason(main), source: main,
    };
  }).filter(Boolean);
}

export function buildReportDecisionModel(data = {}, fitData = {}, reportHistory = []) {
  const decisions = buildRepertoireDecisions(data);
  const keep = decisions.find((item) => item.type === "keep");
  const repair = decisions.find((item) => item.type === "repair");
  const reduce = decisions.find((item) => item.type === "reduce");
  const issues = buildCostlyIssues(data, decisions);
  const games = Number(data.gamesAnalysed ?? data.gamesAnalyzed ?? data.games_analyzed ?? data.gamesImported ?? data.total_games ?? 0) || 0;
  const score = Number(fitData?.overallScore ?? data.openingFitScore ?? data.opening_fit_score ?? data.repertoireHealth?.score ?? data.repertoire_health?.score);
  const scoreValue = Number.isFinite(score) ? Math.round(score) : null;
  const confidence = text(data.confidenceLabel || data.confidence_label || data.reportConfidence || data.report_confidence) || analysisConfidence({ games }).label;
  const previous = reportHistory?.[1]?.summary?.openingFitProgress?.score ?? reportHistory?.[1]?.summary?.opening_fit_score ?? null;
  const trend = scoreValue !== null && previous !== null && previous !== undefined && previous !== "" && Number.isFinite(Number(previous))
    ? scoreValue - Number(previous)
    : null;
  const strongest = keep?.opening || buildRepertoireMapModel(data)[0]?.opening || "Not enough evidence yet";
  const weakest = issues[0]?.opening || repair?.opening || reduce?.opening || "No recurring weakness identified";
  const next = repair || reduce || keep || null;
  const playerProfile = data.playerProfile || data.player_profile || {};
  const displayName = text(data.displayName || data.display_name || playerProfile.displayName || playerProfile.display_name || data.username || data.playerName) || "OpeningFit player";
  const username = text(data.username || data.playerName || data.player_name || playerProfile.username);
  const platform = /lichess/i.test(text(data.platform || data.importPlatform || playerProfile.platform)) ? "Lichess" : "Chess.com";
  const rating = Number(data.currentRating ?? data.current_rating ?? data.rating ?? playerProfile.currentRating ?? playerProfile.current_rating);
  const period = text(data.analysisPeriod || data.analysis_period || data.importRangeLabel || data.import_range_label) || (data.monthsChecked ? `Last ${data.monthsChecked} month${Number(data.monthsChecked) === 1 ? "" : "s"}` : "Recent games");
  const date = data.importedAt || data.imported_at || data.lastUpdated || data.last_updated || null;
  const timeControl = text(data.effectiveTimeFormatLabel || data.effective_time_format_label || data.analysisTimeFormatLabel || data.analysis_time_format_label || data.detectedTimeFormat?.label || data.detected_time_format?.label);
  const paragraph = keep || repair
    ? `${keep ? `${keep.opening} is the clearest area to keep.` : "No keep decision is reliable yet."} ${repair ? `${repair.opening} is the most important repair target.` : reduce ? `${reduce.opening} needs a reduce-or-replace decision.` : "No repeated repair target is clear yet."}`
    : "The current game sample is too small or unclear for a confident repertoire verdict.";
  return {
    header: { displayName, username, platform, rating: Number.isFinite(rating) ? rating : null, games, period, date, timeControl },
    verdict: { paragraph, strongest, weakness: weakest, nextDecision: next ? `${next.type === "keep" ? "Keep" : next.type === "repair" ? "Repair" : "Reduce or replace"} ${next.opening}` : "Collect more games before changing the repertoire" },
    decisions, issues, repertoire: buildRepertoireMapModel(data),
    health: { score: scoreValue, confidence, games, strongest, weakest, trend },
    training: next ? { opening: next.opening, line: text(next.source?.variation || next.source?.line || next.source?.moveLine || next.source?.move_line), objective: next.reason, source: next.source } : null,
  };
}
