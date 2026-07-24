import { analysisConfidence, evidenceBasedReason, fitBand, fitEvidence, performanceSummary } from "./fitTrustModel.js";
import { normaliseReportDecision } from "./recommendationEvidence.js";
import { coachVerdict, formatRecommendationConfidence, trainingActionCopy } from "./reportCoachCopy.js";

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
  const value = Number(item?.sample?.games ?? item?.games ?? item?.count ?? item?.total ?? item?.sampleSize ?? item?.sample_size ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function openingScore(item) {
  const raw = item?.sample?.scoreRate ?? item?.scoreRate ?? item?.score_rate ?? item?.winRate ?? item?.win_rate ?? item?.fitScore ?? item?.fit_score ?? item?.score;
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(String(raw).replace("%", ""));
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

export function openingContext(item) {
  const perspective = openingPerspective(item);
  const slot = text(perspective.repertoireSlot || item?.context || item?.contextKey || item?.context_key).toLowerCase();
  if (perspective.role === "faced_as_white") return { key: "faced_white", label: "Faced as White" };
  if (perspective.role === "faced_as_black") return { key: "faced_black", label: "Faced as Black" };
  if (perspective.role === "played_as_white" || slot === "white") return { key: "white", label: "Played as White" };
  if (perspective.role === "played_as_black" && slot === "black_vs_e4") return { key: "black_e4", label: "Played as Black vs 1.e4" };
  if (perspective.role === "played_as_black" && slot === "black_vs_d4") return { key: "black_d4", label: "Played as Black vs 1.d4" };
  if (perspective.role === "played_as_black") return { key: "black_other", label: "Played as Black vs other first moves" };
  return { key: "unresolved", label: "Ownership unresolved" };
}

export function openingPerspective(item = {}) {
  const explicit = item?.perspective && typeof item.perspective === "object" ? item.perspective : {};
  const role = text(explicit.role || item.openingRole || item.opening_role || item.role).toLowerCase();
  if (["played_as_white", "played_as_black", "faced_as_white", "faced_as_black"].includes(role)) {
    const relationship = role.startsWith("played_") ? "played" : "faced";
    return {
      role,
      relationship,
      repertoireOwned: relationship === "played",
      repertoireSlot: explicit.repertoireSlot || item.repertoireSlot || item.repertoire_slot || (role === "played_as_white" ? "white" : null),
      userColour: explicit.userColour || item.userColour || item.user_colour || (role.endsWith("white") ? "white" : "black"),
      label: explicit.label || item.roleLabel || item.role_label || (relationship === "played" ? `Played as ${role.endsWith("white") ? "White" : "Black"}` : `Faced as ${role.endsWith("white") ? "White" : "Black"}`),
      source: explicit.classificationSource || item.classificationSource || item.classification_source || "explicit_role",
    };
  }
  return { role: "unknown_mixed", relationship: "unknown", repertoireOwned: false, repertoireSlot: null, userColour: text(item.colour || item.color).toLowerCase() || "unknown", label: "Ownership unresolved", source: "legacy_unresolved" };
}

export function openingConfidence(item) {
  const confidence = analysisConfidence(item);
  return formatRecommendationConfidence({ ...item, confidence: { level: confidence.level } });
}

function verdict(item) {
  return text(item?.fitVerdict || item?.fit_verdict || item?.verdict || item?.recommendation || item?.status).toLowerCase();
}

function reason(item) {
  const provided = text(item?.trainingAction?.explanation || item?.recommendationReason || item?.recommendation_reason || item?.fitExplanation || item?.fit_explanation || item?.reason || item?.summary);
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
    ...list(recommendationGroups.faced_as_white || recommendationGroups.facedAsWhite).map((item) => ({ ...item, openingRole: item.openingRole || "faced_as_white" })),
    ...list(recommendationGroups.faced_as_black || recommendationGroups.facedAsBlack).map((item) => ({ ...item, openingRole: item.openingRole || "faced_as_black" })),
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
  if (!openingPerspective(item).repertoireOwned) return null;
  if (openingGames(item) < 5) return null;
  const label = verdict(item);
  if (/avoid|replace|reduce|drop|park|risky/.test(label)) return "reduce";
  if (/improve|repair|review|fix|weak|unstable/.test(label)) return "repair";
  if (/keep|reliable|strong|best|main weapon/.test(label)) return "keep";
  const games = openingGames(item);
  const score = openingScore(item);
  if (games >= 5 && score !== null && score >= 60) return "keep";
  if (games >= 5 && score !== null && score < 45) return "repair";
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
    role: openingPerspective(item).role,
    relationship: openingPerspective(item).relationship,
    repertoireOwned: openingPerspective(item).repertoireOwned,
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
  const openings = collectReportOpenings(data).filter((item) => openingPerspective(item).repertoireOwned);
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

function comparableHistory(data = {}, reportHistory = []) {
  const currentGames = Number(data.gamesAnalysed ?? data.gamesAnalyzed ?? data.gamesImported ?? data.total_games ?? 0) || 0;
  const currentPlatform = text(data.platform || data.importPlatform).toLowerCase();
  const currentUsername = text(data.username || data.playerName).toLowerCase();
  const currentTime = Date.parse(data.importedAt || data.imported_at || data.lastUpdated || data.last_updated || "");
  return list(reportHistory).find((row) => {
    const candidate = row?.normalized_snapshot || row?.snapshot || row;
    const games = Number(candidate?.total_games_analysed ?? candidate?.summary?.games ?? candidate?.report?.gamesAnalysed ?? 0) || 0;
    const platform = text(candidate?.source_platform || candidate?.report?.platform).toLowerCase();
    const username = text(candidate?.source_username || candidate?.report?.username).toLowerCase();
    const time = Date.parse(candidate?.generated_at || candidate?.created_at || candidate?.report?.importedAt || "");
    if (Math.min(currentGames, games) < 5) return false;
    if (currentPlatform && platform && !currentPlatform.includes(platform) && !platform.includes(currentPlatform)) return false;
    if (currentUsername && username && currentUsername !== username) return false;
    return Number.isFinite(currentTime) && Number.isFinite(time) && time < currentTime;
  }) || null;
}

function canonicalOpening(source, fallbackType) {
  if (!source?.opening) return null;
  const match = source.source || {};
  const sample = source.sample || {};
  const games = Number(sample.games ?? source.games ?? 0);
  const score = sample.scoreRate ?? source.scoreRate ?? source.score ?? null;
  const confidence = typeof source.confidence === "object" ? source.confidence : analysisConfidence({ games });
  return {
    type: fallbackType,
    opening: source.opening,
    context: source.roleLabel || source.role || "Ownership unresolved",
    contextKey: openingContext({ ...match, openingRole: source.role, repertoireSlot: source.repertoireSlot }).key,
    reason: source.trainingAction?.explanation || source.evidence?.[0] || `${games} game${games === 1 ? "" : "s"} support this decision.`,
    confidence: formatRecommendationConfidence(source),
    confidenceDetail: { ...analysisConfidence({ games }), ...confidence, games },
    games,
    score,
    fitLabel: source.sampleSizeStatus === "insufficient_data" ? "Insufficient data" : fitBand(score, analysisConfidence({ games })),
    performance: performanceSummary({ games, wins: sample.wins, draws: sample.draws, losses: sample.losses, scoreRate: score }),
    evidence: fitEvidence({ games, wins: sample.wins, draws: sample.draws, losses: sample.losses, scoreRate: score }),
    source: match,
    role: source.role,
    relationship: source.relationship,
    repertoireOwned: Boolean(source.repertoireOwned),
  };
}

export function buildReportDecisionModel(data = {}, fitData = {}, reportHistory = []) {
  const serverDecision = normaliseReportDecision(data.reportDecision || data.report_decision || null);
  const legacyDecisions = serverDecision ? [] : buildRepertoireDecisions(data);
  const sourceOpenings = collectReportOpenings(data);
  const sourceFor = (entry) => sourceOpenings.find((item) => openingName(item).toLowerCase() === text(entry?.opening).toLowerCase() && openingPerspective(item).role === entry?.role) || {};
  const establishedStrength = serverDecision?.establishedStrength ? { ...serverDecision.establishedStrength, source: sourceFor(serverDecision.establishedStrength) } : null;
  const primaryProblem = serverDecision?.primaryProblem ? { ...serverDecision.primaryProblem, source: sourceFor(serverDecision.primaryProblem) } : null;
  const decisions = serverDecision
    ? [canonicalOpening(establishedStrength, "keep"), canonicalOpening(primaryProblem, "repair")].filter(Boolean)
    : legacyDecisions;
  const keep = decisions.find((item) => item.type === "keep");
  const repair = decisions.find((item) => item.type === "repair");
  const reduce = decisions.find((item) => item.type === "reduce");
  const issues = buildCostlyIssues(data, decisions);
  const games = Number(data.gamesAnalysed ?? data.gamesAnalyzed ?? data.games_analyzed ?? data.gamesImported ?? data.total_games ?? 0) || 0;
  const score = Number(fitData?.overallScore ?? data.openingFitScore ?? data.opening_fit_score ?? data.repertoireHealth?.score ?? data.repertoire_health?.score);
  const scoreValue = Number.isFinite(score) ? Math.round(score) : null;
  const coverage = serverDecision?.reportCoverage;
  const confidence = coverage?.level
    ? `${coverage.level[0].toUpperCase()}${coverage.level.slice(1)} report coverage`
    : `${games} analysed game${games === 1 ? "" : "s"}`;
  const previousRow = comparableHistory(data, reportHistory);
  const previous = previousRow?.openingfit_score ?? previousRow?.normalized_snapshot?.openingfit_score ?? previousRow?.snapshot?.openingfit_score ?? previousRow?.summary?.openingFitProgress?.score ?? previousRow?.summary?.opening_fit_score ?? null;
  const comparisonAllowed = Boolean(serverDecision?.baseline?.comparisonClaimsAllowed || previousRow);
  const trend = comparisonAllowed && scoreValue !== null && previous !== null && previous !== undefined && previous !== "" && Number.isFinite(Number(previous))
    ? scoreValue - Number(previous)
    : null;
  const strongest = keep?.opening || "Not enough evidence yet";
  const weakest = issues[0]?.opening || repair?.opening || reduce?.opening || "No recurring weakness identified";
  const next = repair || reduce || keep || null;
  const nextTrainingAction = serverDecision?.nextTrainingAction || (next ? { type: next.type, opening: next.opening, role: next.role, label: `${next.type === "keep" ? "Consolidate" : "Repair"} ${next.opening}`, reason: next.reason } : { type: "collect_more_games", opening: null, role: null, label: "Collect more games before changing your repertoire", reason: "No opening has enough correctly attributed evidence for a strength or weakness claim." });
  const playerProfile = data.playerProfile || data.player_profile || {};
  const displayName = text(data.displayName || data.display_name || playerProfile.displayName || playerProfile.display_name || data.username || data.playerName) || "OpeningFit player";
  const username = text(data.username || data.playerName || data.player_name || playerProfile.username);
  const platform = data.sampleMode || data.sample_mode
    ? "Example data"
    : /lichess/i.test(text(data.platform || data.importPlatform || playerProfile.platform)) ? "Lichess" : "Chess.com";
  const rating = Number(data.currentRating ?? data.current_rating ?? data.rating ?? playerProfile.currentRating ?? playerProfile.current_rating);
  const period = text(data.analysisPeriod || data.analysis_period || data.importRangeLabel || data.import_range_label) || (data.monthsChecked ? `Last ${data.monthsChecked} month${Number(data.monthsChecked) === 1 ? "" : "s"}` : "Recent games");
  const date = data.importedAt || data.imported_at || data.lastUpdated || data.last_updated || null;
  const timeControl = text(data.effectiveTimeFormatLabel || data.effective_time_format_label || data.analysisTimeFormatLabel || data.analysis_time_format_label || data.detectedTimeFormat?.label || data.detected_time_format?.label);
  const actionSource = sourceFor(nextTrainingAction);
  const actionForCopy = nextTrainingAction?.sample ? nextTrainingAction : { ...nextTrainingAction, sample: { games: openingGames(actionSource) } };
  const paragraph = coachVerdict({ strength: establishedStrength, problem: primaryProblem, action: actionForCopy });
  const baseline = serverDecision?.baseline || { status: comparisonAllowed ? "comparable_later_report" : "baseline", hasComparablePrevious: comparisonAllowed, comparisonClaimsAllowed: comparisonAllowed };
  const authoritative = {
    schemaVersion: serverDecision?.schemaVersion || 1,
    establishedStrength: establishedStrength || (keep ? { opening: keep.opening, role: keep.role, games: keep.games, score: keep.score, repertoireOwned: true } : null),
    primaryProblem: primaryProblem || (repair ? { opening: repair.opening, role: repair.role, games: repair.games, score: repair.score, repertoireOwned: true } : null),
    nextTrainingAction,
    supportingEvidence: serverDecision?.supportingEvidence || [nextTrainingAction.reason],
    confidence: serverDecision?.confidence || { status: decisions.length ? "sufficient" : "insufficient_data", gamesAnalysed: games, minimumOpeningGames: 5 },
    baseline: { ...baseline, status: comparisonAllowed ? "comparable_later_report" : "baseline", hasComparablePrevious: comparisonAllowed, comparisonClaimsAllowed: comparisonAllowed },
  };
  const repertoireSource = serverDecision?.recommendations?.length ? { best_openings: serverDecision.recommendations } : data;
  return {
    ...authoritative,
    authoritative,
    header: { displayName, username, platform, rating: Number.isFinite(rating) ? rating : null, games, period, date, timeControl },
    verdict: { paragraph, strongest, weakness: weakest, nextDecision: nextTrainingAction.label },
    decisions, issues, repertoire: buildRepertoireMapModel(repertoireSource),
    health: { score: scoreValue, confidence, games, strongest, weakest, trend },
    training: { opening: nextTrainingAction.opening, line: text(next?.source?.variation || next?.source?.line || next?.source?.moveLine || next?.source?.move_line), objective: trainingActionCopy(nextTrainingAction, primaryProblem || establishedStrength).explanation, label: trainingActionCopy(nextTrainingAction, primaryProblem || establishedStrength).title, type: nextTrainingAction.type, source: next?.source || primaryProblem || establishedStrength || null },
  };
}
