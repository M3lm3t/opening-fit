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

function strongestRole(snapshot = {}) {
  const decision = snapshot.report_decision || snapshot.reportDecision || {};
  const roles = snapshot.repertoire_roles || decision.repertoireRoles || [];
  return [...roles].filter(Boolean).sort((left, right) => {
    const established = (value) => /established/i.test(text(value?.status)) ? 1 : 0;
    return established(right) - established(left)
      || (number(right.supportingGameCount ?? right.games) || 0) - (number(left.supportingGameCount ?? left.games) || 0)
      || text(left.repertoireRole || left.key).localeCompare(text(right.repertoireRole || right.key));
  })[0] || null;
}

function canonicalContinuity(snapshot = {}, comparison = {}) {
  const decision = snapshot.report_decision || snapshot.reportDecision || {};
  const priority = decision.trainingPriority || decision.training_priority || decision.nextTrainingAction || {};
  const repair = decision.primaryProblem || decision.primary_problem || comparison.continuedWeaknesses?.[0] || comparison.newWeaknesses?.[0] || null;
  const role = strongestRole(snapshot);
  return {
    strongestRole: role ? { label: text(role.label || role.repertoireRole || role.key).replaceAll("_", " "), opening: text(role.currentOpening || role.openingName || role.opening) || null, games: number(role.supportingGameCount ?? role.games) || 0 } : null,
    urgentRepair: repair ? { label: text(repair.openingName || repair.opening || repair.title) || "Current canonical repair", diagnosisId: text(repair.diagnosisId || repair.diagnosis_id) || null } : null,
    avoidedMistake: comparison.resolvedWeaknesses?.[0] ? { label: text(comparison.resolvedWeaknesses[0].opening || comparison.resolvedWeaknesses[0].title), detail: "The prior canonical weakness was not repeated in the sufficient compatible sample." } : null,
    repeatedMistake: comparison.continuedWeaknesses?.[0] ? { label: text(comparison.continuedWeaknesses[0].opening || comparison.continuedWeaknesses[0].title), detail: `${comparison.continuedWeaknesses[0].frequency} supporting games in the current report.` } : null,
    recommendedAction: text(priority.title || priority.label || priority.nextAction || priority.exercise) || null,
    targetNextWeek: text(priority.successCheck || priority.success_check || priority.completionTarget?.label || priority.completion_target?.label) || "Complete the current canonical training task and analyse genuinely new games.",
    identity: text(priority.priorityId || priority.priority_id || priority.decisionId || priority.decision_id) || null,
  };
}

export function buildWeeklyRecap({ currentSnapshot, previousSnapshot, plan = null, now = new Date() } = {}) {
  const { weekStart, weekEnd } = weeklyPlanWindow(now);
  const activeIncompletePlan = Boolean(plan && plan.status === "active" && Number(plan.completionPercent || 0) < 100);
  const comparison = compareReportSnapshots(previousSnapshot, currentSnapshot);
  const newGames = previousSnapshot ? Math.max(0, Math.round(number(comparison.newGamesCount) || 0)) : 0;
  const continuity = canonicalContinuity(currentSnapshot, comparison);

  if (!newGames) {
    if (!currentSnapshot && !activeIncompletePlan) return null;
    return {
      id: `weekly-recap:${weekStart}:continuity:${continuity.identity || "current"}`,
      weekStart,
      weekEnd,
      type: "training_reminder",
      title: "Your weekly training is ready to continue",
      newGames: 0,
      trainingCompletion: activeIncompletePlan ? Math.max(0, Math.min(99, Math.round(number(plan.completionPercent) || 0))) : null,
      nextFocus: text(plan?.primaryGoal) || continuity.recommendedAction,
      progressConfidence: "limited",
      continuity,
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
    progressConfidence: comparison.comparable ? "comparable" : "limited",
    continuity,
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
