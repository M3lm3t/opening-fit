export const REPORT_SCHEMA_VERSION = 3;

function first(value, ...fallbacks) {
  return [value, ...fallbacks].find((item) => item !== undefined && item !== null && item !== "") ?? null;
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [];
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isoOrNull(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function platformName(report = {}, summary = {}) {
  const raw = cleanText(first(summary.platform, report.platform, report.importPlatform, report.import_platform));
  const value = String(raw || "").toLowerCase();
  if (value.includes("lichess")) return "lichess";
  if (value.includes("chess.com") || value.includes("chesscom")) return "chesscom";
  return raw;
}

function username(report = {}, summary = {}) {
  return cleanText(first(
    summary.username,
    report.username,
    report.playerName,
    report.player_name,
    report.playerProfile?.username,
    report.player_profile?.username,
  ));
}

function gameCount(report = {}, summary = {}) {
  return numberOrNull(first(
    summary.games,
    report.gamesAnalysed,
    report.gamesAnalyzed,
    report.games_analyzed,
    report.gamesImported,
    report.games_imported,
    report.totalGames,
    report.total_games,
  ));
}

function reportGames(report = {}) {
  const sources = [report.opening_games, report.openingGames, report.recent_games, report.recentGames, report.saved_games, report.savedGames, report.games];
  return sources.find((items) => Array.isArray(items) && items.length) || [];
}

function stableGameIds(report = {}) {
  return reportGames(report)
    .map((game) => cleanText(first(game?.id, game?.uuid, game?.game_id, game?.gameId, game?.url, game?.archive)))
    .filter(Boolean)
    .sort();
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function makeUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function recommendationSlots(report = {}) {
  const plan = report.recommendedRepertoirePlan || report.recommended_repertoire_plan || {};
  const items = list(plan.items);
  const bySlot = (slot) => items.find((item) => item?.slot === slot) || null;
  const detail = (item) => ({
    opening: cleanText(first(item?.opening, item?.name)),
    confidence: cleanText(first(item?.confidence, item?.confidenceLabel, item?.confidence_label)),
    sample_size: numberOrNull(first(item?.games, item?.sample_size, item?.sampleSize)),
  });
  return {
    white: detail(bySlot("main_white")),
    black_e4: detail(bySlot("black_vs_e4")),
    black_d4: detail(bySlot("black_vs_d4")),
  };
}

function openingRows(report = {}, summary = {}) {
  const candidates = [
    report.top_openings,
    report.topOpenings,
    report.best_openings,
    report.bestOpenings,
    report.opening_stats,
    report.openings,
    summary.topOpenings,
  ];
  const rows = candidates.find((items) => Array.isArray(items) && items.length) || [];
  return rows.map((item) => {
    const games = numberOrNull(first(item?.games, item?.count, item?.total, item?.sample_size, item?.sampleSize));
    return {
      name: cleanText(first(item?.name, item?.opening, item?.eco_name, item?.label)),
      context: cleanText(first(item?.context, item?.repertoireContext, item?.repertoire_context)),
      colour: cleanText(first(item?.colour, item?.color, item?.side)),
      games,
      wins: numberOrNull(first(item?.wins, item?.win_count)),
      draws: numberOrNull(first(item?.draws, item?.draw_count)),
      losses: numberOrNull(first(item?.losses, item?.loss_count)),
      score: numberOrNull(first(item?.score, item?.fitScore, item?.fit_score)),
      win_rate: numberOrNull(first(item?.winRate, item?.win_rate, item?.scoreRate, item?.score_rate)),
      confidence: {
        label: cleanText(first(item?.fitConfidence, item?.confidenceLabel, item?.confidence, item?.signal)) || "insufficient data",
        sample_size: games,
      },
    };
  }).filter((item) => item.name);
}

function timeControls(report = {}, summary = {}) {
  const explicit = list(first(summary.timeControlsIncluded, summary.time_controls_included, report.timeControlsIncluded, report.time_controls_included));
  if (explicit.length) return [...new Set(explicit.map(cleanText).filter(Boolean))];
  const gameControls = reportGames(report).map((game) => cleanText(first(game?.time_class, game?.timeClass))).filter(Boolean);
  if (gameControls.length) return [...new Set(gameControls)];
  const selected = cleanText(first(summary.analysisTimeFormat, report.analysisTimeFormat, report.analysis_time_format));
  return selected && selected !== "custom" ? [selected] : [];
}

function dateRange(report = {}, summary = {}) {
  const raw = first(summary.analysisDateRange, summary.analysis_date_range, report.analysisDateRange, report.analysis_date_range, report.dateRange, report.date_range, report.timeRange, report.time_range);
  const object = raw && typeof raw === "object" ? raw : {};
  return {
    start: isoOrNull(first(object.start, object.from, object.startDate, report.startDate, report.start_date)),
    end: isoOrNull(first(object.end, object.to, object.endDate, report.endDate, report.end_date)),
    label: typeof raw === "string" ? cleanText(raw) : cleanText(first(object.label, object.description)),
  };
}

function ratingContext(report = {}) {
  const profile = report.playerProfile || report.player_profile || {};
  const context = report.ratingContext || report.rating_context || {};
  const rating = numberOrNull(first(report.currentRating, report.current_rating, report.rating, profile.currentRating, profile.current_rating, profile.rating, context.rating));
  const control = cleanText(first(report.ratingTimeControl, report.rating_time_control, profile.ratingTimeControl, profile.rating_time_control, context.time_control));
  const source = cleanText(first(report.ratingSource, report.rating_source, profile.ratingSource, profile.rating_source, context.source));
  return rating === null && !control && !source ? null : { rating, time_control: control, source };
}

function trainingPriorities(report = {}) {
  const source = list(first(report.studyQueue, report.study_queue, report.nextTrainingActions, report.next_training_actions, report.trainingPlan, report.training_plan));
  return source.map((item) => {
    if (typeof item === "string") return { issue_id: null, title: item, opening: null, priority: null, frequency: null, confidence: null, status: null };
    return {
      issue_id: cleanText(first(item?.issue_id, item?.issueId, item?.id, item?.key)),
      title: cleanText(first(item?.title, item?.action, item?.task, item?.reason)),
      opening: cleanText(first(item?.opening, item?.name)),
      priority: cleanText(first(item?.priority, item?.studyPriority, item?.study_priority)),
      frequency: numberOrNull(first(item?.frequency, item?.issue_games, item?.games, item?.sample_size)),
      confidence: cleanText(first(item?.confidence?.label, item?.confidence, item?.confidenceLabel)),
      status: cleanText(item?.status),
    };
  }).filter((item) => item.title || item.opening);
}

function weaknesses(report = {}) {
  const source = [report.weaknesses, report.weak_lines, report.weakLines, report.problem_lines, report.problemLines]
    .find((items) => Array.isArray(items)) || [];
  return source.map((item) => ({
    issue_id: cleanText(first(item?.issue_id, item?.issueId, item?.id, item?.key)),
    title: cleanText(first(item?.title, item?.label, item?.pattern, item?.line, item?.variation, item?.type)),
    opening: cleanText(first(item?.opening, item?.opening_name, item?.name)),
    category: cleanText(first(item?.category, item?.type, item?.pattern)),
    frequency: numberOrNull(first(item?.frequency, item?.issue_games, item?.games, item?.count)),
    sample_size: numberOrNull(first(item?.sample_size, item?.sampleSize, item?.total_games)),
    confidence: cleanText(first(item?.confidence?.label, item?.confidence, item?.confidenceLabel)),
    status: cleanText(item?.status),
  })).filter((item) => item.issue_id || item.title || item.opening);
}

export function isDemoReport(report = {}) {
  const platform = String(first(report.platform, report.importPlatform, report.import_platform) || "").toLowerCase();
  const player = String(first(report.username, report.playerName, report.player_name) || "").toLowerCase();
  return platform === "demo" || player === "demoplayer" || report.isDemo === true || report.is_demo === true;
}

export function isValidCompletedReport(report = {}, summary = {}, userId = null) {
  const owner = cleanText(first(summary.analysisOwnerUserId, summary.analysis_owner_user_id, report.analysisOwnerUserId, report.analysis_owner_user_id));
  const completed = first(summary.analysisCompleted, summary.analysis_completed, report.analysisCompleted, report.analysis_completed) === true;
  return Boolean(
    userId
    && completed
    && owner === String(userId)
    && !isDemoReport(report)
    && ["chesscom", "lichess"].includes(platformName(report, summary))
    && username(report, summary)
    && (gameCount(report, summary) || 0) > 0
  );
}

export function stableAnalysisIdentity(report = {}, summary = {}) {
  const explicit = cleanText(first(summary.analysisId, summary.analysis_id, report.analysisId, report.analysis_id));
  if (explicit) return explicit;
  const ids = stableGameIds(report);
  if (!ids.length) return null;
  return `games-${hashText([platformName(report, summary), username(report, summary)?.toLowerCase(), ...ids].join("|"))}`;
}

export function analysisFingerprint(report = {}, summary = {}) {
  const identity = stableAnalysisIdentity(report, summary);
  if (identity) return `analysis:${identity}`;
  const generated = first(summary.reportDate, summary.generatedAt, report.importedAt, report.imported_at, report.lastUpdated, report.last_updated);
  return `fallback:${hashText([
    platformName(report, summary),
    username(report, summary)?.toLowerCase(),
    gameCount(report, summary),
    generated,
    timeControls(report, summary).join(","),
  ].join("|"))}`;
}

export function buildReportSnapshot({
  report = {},
  summary = {},
  userId,
  reportId = makeUuid(),
  defaultGeneratedAt = true,
} = {}) {
  const generatedAt = isoOrNull(first(summary.reportDate, summary.generatedAt, summary.generated_at, report.importedAt, report.imported_at, report.lastUpdated, report.last_updated)) || (defaultGeneratedAt ? new Date().toISOString() : null);
  const fitScore = numberOrNull(first(
    report.openingfitScore,
    report.openingfit_score,
    report.openingFitScore,
    report.opening_fit_score,
    report.retentionMetrics?.openingFitScore,
    report.retention_metrics?.opening_fit_score,
    summary.healthScore,
  ));
  const scoreComponents = first(
    report.openingFitScoreBreakdown,
    report.opening_fit_score_breakdown,
    report.scoreComponents,
    report.score_components,
    report.retentionMetrics?.scoreComponents,
    report.retention_metrics?.score_components,
  );
  const recommendations = recommendationSlots(report);
  const activeRepertoire = first(
    summary.activeRepertoire,
    summary.active_repertoire,
    report.activeRepertoire,
    report.active_repertoire,
    report.repertoireWorkspace,
    report.repertoire_workspace,
  );
  const analysisId = stableAnalysisIdentity(report, summary);

  return {
    report_id: reportId,
    user_id: userId || null,
    source_platform: platformName(report, summary),
    source_username: username(report, summary),
    generated_at: generatedAt,
    report_schema_version: REPORT_SCHEMA_VERSION,
    analysis_id: analysisId,
    analysis_date_range: dateRange(report, summary),
    total_games_analysed: gameCount(report, summary),
    new_games_since_previous: numberOrNull(first(summary.newGamesSincePrevious, summary.new_games_since_previous, report.newEligibleGames, report.new_games_since_previous)),
    rating_context: ratingContext(report),
    time_controls_included: timeControls(report, summary),
    openingfit_score: fitScore,
    score_components: scoreComponents && typeof scoreComponents === "object" ? scoreComponents : null,
    style_profile: first(summary.styleProfile, summary.style_profile, report.styleProfile, report.style_profile),
    recommendations: {
      white: recommendations.white.opening,
      black_e4: recommendations.black_e4.opening,
      black_d4: recommendations.black_d4.opening,
    },
    recommendation_confidence: {
      white: { label: recommendations.white.confidence, sample_size: recommendations.white.sample_size },
      black_e4: { label: recommendations.black_e4.confidence, sample_size: recommendations.black_e4.sample_size },
      black_d4: { label: recommendations.black_d4.confidence, sample_size: recommendations.black_d4.sample_size },
    },
    opening_statistics: openingRows(report, summary),
    weaknesses: weaknesses(report),
    training_priorities: trainingPriorities(report),
    training_outcomes: list(first(report.trainingOutcomes, report.training_outcomes)),
    training_outcome_context: first(report.trainingOutcomeContext, report.training_outcome_context) || {},
    active_repertoire: activeRepertoire && typeof activeRepertoire === "object" ? activeRepertoire : null,
    analysis_metadata: {
      analysis_id: analysisId,
      analysis_version: cleanText(first(report.analysisVersion, report.analysis_version)),
      analysis_time_format: cleanText(first(summary.analysisTimeFormat, report.analysisTimeFormat, report.analysis_time_format)),
      effective_time_format: cleanText(first(summary.effectiveTimeFormat, report.effectiveTimeFormat, report.effective_time_format)),
      detected_time_format: first(summary.detectedTimeFormat, report.detectedTimeFormat, report.detected_time_format),
      import_months: numberOrNull(first(summary.importMonths, report.monthsChecked, report.months_checked, report.importMonths, report.import_months)),
      filters: first(report.reportFilters, report.report_filters, report.filterSummary, report.filter_summary),
    },
  };
}

export function adaptReportHistoryRow(row = {}) {
  const rawSnapshot = row.normalized_snapshot || row.snapshot;
  if (rawSnapshot && Number(rawSnapshot.report_schema_version) >= 2) {
    return {
      ...rawSnapshot,
      report_id: row.id || rawSnapshot.report_id || null,
      user_id: row.user_id || rawSnapshot.user_id || null,
      generated_at: isoOrNull(rawSnapshot.generated_at),
      report_schema_version: REPORT_SCHEMA_VERSION,
      source_platform: rawSnapshot.source_platform || null,
      source_username: rawSnapshot.source_username || null,
      analysis_date_range: rawSnapshot.analysis_date_range || { start: null, end: null, label: null },
      total_games_analysed: numberOrNull(rawSnapshot.total_games_analysed),
      new_games_since_previous: numberOrNull(rawSnapshot.new_games_since_previous),
      rating_context: rawSnapshot.rating_context || null,
      time_controls_included: list(rawSnapshot.time_controls_included),
      openingfit_score: numberOrNull(rawSnapshot.openingfit_score),
      score_components: rawSnapshot.score_components || null,
      style_profile: rawSnapshot.style_profile || null,
      recommendations: {
        white: rawSnapshot.recommendations?.white || null,
        black_e4: rawSnapshot.recommendations?.black_e4 || null,
        black_d4: rawSnapshot.recommendations?.black_d4 || null,
      },
      recommendation_confidence: rawSnapshot.recommendation_confidence || {},
      opening_statistics: list(rawSnapshot.opening_statistics).map((opening) => ({
        ...opening,
        confidence: {
          label: opening?.confidence?.label || "insufficient data",
          sample_size: numberOrNull(opening?.confidence?.sample_size ?? opening?.games),
        },
      })),
      weaknesses: list(rawSnapshot.weaknesses),
      training_priorities: list(rawSnapshot.training_priorities),
      training_outcomes: list(rawSnapshot.training_outcomes),
      training_outcome_context: rawSnapshot.training_outcome_context || {},
      active_repertoire: rawSnapshot.active_repertoire || null,
      analysis_metadata: rawSnapshot.analysis_metadata || {},
    };
  }
  return buildReportSnapshot({
    report: row.report || row.data || {},
    summary: {
      ...(row.summary || {}),
      reportDate: first(row.summary?.reportDate, row.created_at, row.createdAt),
    },
    userId: row.user_id || null,
    reportId: row.id || null,
    defaultGeneratedAt: false,
  });
}

async function findExistingSnapshot(client, payload) {
  const filters = payload.analysis_id
    ? [["analysis_id", payload.analysis_id]]
    : payload.analysis_fingerprint
      ? [["analysis_fingerprint", payload.analysis_fingerprint]]
      : [["report_key", payload.report_key]];
  let query = client.from("report_history").select("*").eq("user_id", payload.user_id);
  filters.forEach(([column, value]) => {
    query = query.eq(column, value);
  });
  let result = await query.maybeSingle();
  if (result.error?.code === "PGRST204" && payload.report_key) {
    result = await client
      .from("report_history")
      .select("*")
      .eq("user_id", payload.user_id)
      .eq("report_key", payload.report_key)
      .maybeSingle();
  }
  if (result.error) throw result.error;
  return result.data || null;
}

export async function persistReportSnapshot(client, payload, legacyPayload = null) {
  let result = await client.from("report_history").insert(payload).select("*").single();
  if (result.error?.code === "PGRST204" && legacyPayload) {
    result = await client.from("report_history").insert(legacyPayload).select("*").single();
  }
  if (result.error?.code === "23505") {
    return findExistingSnapshot(client, payload);
  }
  if (result.error) throw result.error;
  return result.data;
}

export function createSnapshotReportId() {
  return makeUuid();
}
