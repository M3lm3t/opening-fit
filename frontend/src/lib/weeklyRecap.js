import { compareReportSnapshots } from "./reportComparison.js";
import { weeklyPlanWindow } from "./weeklyTrainingPlan.js";

export const WEEKLY_RECAP_STORAGE_KEY = "openingFit:weeklyRecaps:v1";
export const WEEKLY_RECAP_HISTORY_LIMIT = 12;

const text = (value) => String(value ?? "").trim();
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function improvedArea(comparison) {
  const resolved = comparison.resolvedWeaknesses?.[0];
  if (resolved) return { label: resolved.opening || resolved.title || "Recurring opening issue", detail: resolved.evidence || "The recurring signal reduced in the latest comparable sample." };
  const opening = comparison.openingChanges?.find((item) => item.status === "improved");
  if (opening) return { label: opening.opening, detail: `Improved in the available ${opening.side || "opening"} sample.` };
  const training = comparison.trainingProgress?.find((item) => ["improved", "partially_improved"].includes(item.status));
  if (training) return { label: training.opening || "Training focus", detail: training.message };
  return null;
}

function repairArea(comparison) {
  const continued = comparison.continuedWeaknesses?.[0];
  if (continued) return { label: continued.opening || continued.title || "Recurring opening issue", detail: `${continued.previousFrequency} supporting game${continued.previousFrequency === 1 ? "" : "s"} before · ${continued.frequency} now.` };
  const added = comparison.newWeaknesses?.[0];
  if (added) return { label: added.opening || added.title || "New opening issue", detail: `${added.frequency} supporting game${added.frequency === 1 ? "" : "s"} in the latest report.` };
  const opening = comparison.openingChanges?.find((item) => item.status === "declined");
  if (opening) return { label: opening.opening, detail: `Declined in the available ${opening.side || "opening"} sample.` };
  return null;
}

function scoreSummary(comparison) {
  if (comparison.previousScore === null || comparison.currentScore === null) return null;
  if (comparison.scoreStatus === "insufficient evidence") return {
    previous: Math.round(comparison.previousScore),
    current: Math.round(comparison.currentScore),
    status: "insufficient_data",
    label: "Not enough comparable data to call this a score change.",
  };
  const previous = Math.round(comparison.previousScore);
  const current = Math.round(comparison.currentScore);
  const direction = comparison.scoreStatus === "improved" ? "increased" : comparison.scoreStatus === "declined" ? "decreased" : "remained broadly unchanged";
  return { previous, current, status: comparison.scoreStatus, label: direction === "remained broadly unchanged" ? `Broadly unchanged: ${previous} before · ${current} now.` : `${direction} from ${previous} to ${current}.` };
}

export function buildWeeklyRecap({ currentSnapshot, previousSnapshot, plan = null, now = new Date() } = {}) {
  const { weekStart, weekEnd } = weeklyPlanWindow(now);
  const activeIncompletePlan = Boolean(plan && plan.status === "active" && Number(plan.completionPercent || 0) < 100);
  const comparison = compareReportSnapshots(previousSnapshot, currentSnapshot);
  const newGames = previousSnapshot ? Math.max(0, Math.round(number(comparison.newGamesCount) || 0)) : 0;

  if (!newGames) {
    if (!activeIncompletePlan) return null;
    return {
      id: `weekly-recap:${weekStart}:training-reminder`,
      weekStart,
      weekEnd,
      type: "training_reminder",
      title: "Your weekly training is ready to continue",
      newGames: 0,
      trainingCompletion: Math.max(0, Math.min(99, Math.round(number(plan.completionPercent) || 0))),
      nextFocus: text(plan.primaryGoal) || null,
      score: null,
      improvedArea: null,
      repairArea: null,
    };
  }

  const score = scoreSummary(comparison);
  const improved = improvedArea(comparison);
  const repair = repairArea(comparison);
  const trainingCompletion = plan ? Math.max(0, Math.min(100, Math.round(number(plan.completionPercent) || 0))) : null;
  const nextFocus = text(plan?.primaryGoal) || null;
  const meaningful = Boolean(score || improved || repair || trainingCompletion !== null || nextFocus);
  if (!meaningful) return null;

  return {
    id: `weekly-recap:${weekStart}:${text(currentSnapshot?.report_id) || "latest"}`,
    weekStart,
    weekEnd,
    type: "comparison",
    title: "Your OpeningFit weekly recap",
    newGames,
    score,
    improvedArea: improved,
    repairArea: repair,
    trainingCompletion,
    nextFocus,
  };
}

export function readLocalWeeklyRecaps(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(WEEKLY_RECAP_STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function mergeWeeklyRecapRecord(records = {}, weekStart, patch = {}) {
  const next = { ...(records || {}), [weekStart]: { ...(records?.[weekStart] || {}), ...patch } };
  return Object.fromEntries(Object.entries(next).sort(([left], [right]) => right.localeCompare(left)).slice(0, WEEKLY_RECAP_HISTORY_LIMIT));
}

export function writeLocalWeeklyRecaps(records, storage = globalThis.localStorage) {
  try { storage?.setItem(WEEKLY_RECAP_STORAGE_KEY, JSON.stringify(records || {})); } catch { /* Keep the current recap usable. */ }
  return records || {};
}

export function weeklyRecapRecords({ settings = {}, localRecords = {} } = {}) {
  return { ...(localRecords || {}), ...(settings?.preferences?.weeklyRecaps || {}) };
}

export function shouldAutoShowWeeklyRecap(recap, record = {}) {
  return Boolean(recap && !record.shownAt && !record.dismissedAt);
}
