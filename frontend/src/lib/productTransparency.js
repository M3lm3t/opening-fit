import { FEATURE_ENTITLEMENTS, OPENINGFIT_FEATURES } from "./premiumEntitlement.js";
import { buildApiUrl } from "./apiBase.js";

export const DEFAULT_PUBLIC_ANALYSIS_CONTRACT = Object.freeze({
  analysisGameLimit: 300,
  freeHistoryMonths: FEATURE_ENTITLEMENTS[OPENINGFIT_FEATURES.GAME_HISTORY].limits.months,
  plusHistoryMonths: 12,
  freeRefreshMinutes: FEATURE_ENTITLEMENTS[OPENINGFIT_FEATURES.REPORT_REFRESH].limits.minimumMinutesBetweenRefreshes,
  plusRefreshMinutes: 5,
  freeEvidenceGames: FEATURE_ENTITLEMENTS[OPENINGFIT_FEATURES.GAME_HISTORY].limits.evidenceGames,
  plusEvidenceGames: FEATURE_ENTITLEMENTS[OPENINGFIT_FEATURES.FULL_RECOMMENDATION_EVIDENCE].limits.evidenceGames,
  freeWeeklyTasks: FEATURE_ENTITLEMENTS[OPENINGFIT_FEATURES.WEEKLY_PLAN_PREVIEW].limits.tasks,
  plusWeeklyTasks: FEATURE_ENTITLEMENTS[OPENINGFIT_FEATURES.WEEKLY_PLAN].limits.tasks,
  savedReportLimit: FEATURE_ENTITLEMENTS[OPENINGFIT_FEATURES.SAVED_REPORT_HISTORY].limits.reports,
});

const positiveInteger = (value, fallback) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

export function normalisePublicAnalysisContract(value = {}) {
  const fallback = DEFAULT_PUBLIC_ANALYSIS_CONTRACT;
  return {
    analysisGameLimit: positiveInteger(value.analysisGameLimit ?? value.analysis_game_limit, fallback.analysisGameLimit),
    freeHistoryMonths: positiveInteger(value.freeHistoryMonths ?? value.free_history_months, fallback.freeHistoryMonths),
    plusHistoryMonths: positiveInteger(value.plusHistoryMonths ?? value.plus_history_months, fallback.plusHistoryMonths),
    freeRefreshMinutes: positiveInteger(value.freeRefreshMinutes ?? value.free_refresh_minutes, fallback.freeRefreshMinutes),
    plusRefreshMinutes: positiveInteger(value.plusRefreshMinutes ?? value.plus_refresh_minutes, fallback.plusRefreshMinutes),
    freeEvidenceGames: positiveInteger(value.freeEvidenceGames ?? value.free_evidence_games, fallback.freeEvidenceGames),
    plusEvidenceGames: positiveInteger(value.plusEvidenceGames ?? value.plus_evidence_games, fallback.plusEvidenceGames),
    freeWeeklyTasks: positiveInteger(value.freeWeeklyTasks ?? value.free_weekly_tasks, fallback.freeWeeklyTasks),
    plusWeeklyTasks: positiveInteger(value.plusWeeklyTasks ?? value.plus_weekly_tasks, fallback.plusWeeklyTasks),
    savedReportLimit: positiveInteger(value.savedReportLimit ?? value.saved_report_limit, fallback.savedReportLimit),
  };
}

export async function loadPublicAnalysisContract(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") return DEFAULT_PUBLIC_ANALYSIS_CONTRACT;
  const response = await fetchImpl(buildApiUrl("/api/public/analysis-contract"), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Public analysis contract unavailable (${response.status}).`);
  return normalisePublicAnalysisContract(await response.json());
}

export function publicFeatureComparison(contract = DEFAULT_PUBLIC_ANALYSIS_CONTRACT) {
  const limits = normalisePublicAnalysisContract(contract);
  return [
    ["Opening report", "First report included", "Ongoing reports"],
    ["OpeningFit Score and style", "Included", "Included"],
    ["Keep / repair / next action", "One of each", "One of each, with fuller evidence"],
    ["Report refresh", `On demand, at least ${limits.freeRefreshMinutes} minutes apart`, `On demand, at least ${limits.plusRefreshMinutes} minutes apart`],
    ["Game-history window", `Up to ${limits.freeHistoryMonths} months`, `Up to ${limits.plusHistoryMonths} months`],
    ["Recommendation evidence", `Up to ${limits.freeEvidenceGames} games`, `Up to ${limits.plusEvidenceGames} games`],
    ["Weekly training", `${limits.freeWeeklyTasks}-task preview`, `Up to ${limits.plusWeeklyTasks} tasks`],
    ["Saved report history", "Not included", `Up to ${limits.savedReportLimit} reports`],
    ["Progress comparisons", "Not included", "Comparable completed reports only"],
  ];
}
