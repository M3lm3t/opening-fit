import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";
import { WEEKLY_TRAINING_PLAN_SCHEMA_VERSION, weeklyPlanWindow } from "./weeklyTrainingPlan.js";
import { normaliseTrainingPreferences, personaliseWeeklyTrainingPlan } from "./trainingPreferences.js";

const text = (value) => String(value ?? "").trim();
const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const number = (value, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const makeId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

function reportGames(report = {}) {
  return number(report.total_games_analysed ?? report.gamesImported ?? report.games_imported ?? report.totalGames ?? report.total_games, 0);
}

function foundationOpening(report = {}, repertoire = []) {
  const active = list(repertoire).find((entry) => entry.status === "active") || {};
  const reportOpening = list(report.topOpenings || report.top_openings || report.openings)[0] || {};
  const raw = active.display_name || active.canonical_name || active.name || reportOpening.display_name || reportOpening.name || reportOpening.opening || "Opening fundamentals";
  const known = findOpeningLine(raw);
  const slot = text(active.slot || reportOpening.slot || reportOpening.context || "");
  return {
    id: active.canonical_opening_id || known?.id || normaliseOpeningKey(raw) || "opening-fundamentals",
    name: known?.name || text(raw),
    side: slot.startsWith("black") || known?.color === "black" ? "black" : "white",
  };
}

function foundationalTask({ type, title, explanation, successCriteria, minutes, order, opening }) {
  return {
    id: makeId("foundation-task"),
    type,
    title,
    explanation,
    openingId: opening.id,
    openingName: opening.name,
    trainingSide: opening.side,
    sourceGameIds: [],
    positionFen: null,
    expectedMoves: [],
    successCriteria,
    estimatedMinutes: minutes,
    order,
    status: "pending",
  };
}

export function buildFoundationalWeeklyPlan({ userId = "local", report = {}, repertoire = [], now = new Date(), preferences = null } = {}) {
  const opening = foundationOpening(report, repertoire);
  const games = reportGames(report);
  const { weekStart, weekEnd } = weeklyPlanWindow(now);
  const tasks = [
    foundationalTask({ type: "concept_review", title: `Set up ${opening.name} with purpose`, explanation: "Start with development, king safety, and a clear plan. This stays foundational because there is not enough reliable game evidence for a narrower claim yet.", successCriteria: "Name your first development priority and one king-safety cue.", minutes: 6, order: 1, opening }),
    foundationalTask({ type: "line_replay", title: `Replay one familiar ${opening.name} setup`, explanation: "Rehearse a familiar setup without treating it as forced theory. The aim is to reach a playable position you recognise.", successCriteria: "Replay the setup twice and describe where each minor piece belongs.", minutes: 8, order: 2, opening }),
    foundationalTask({ type: "game_review", title: "Review one game for the first decision point", explanation: "Use one recent game if available; otherwise use your next game. Look for the first moment your opening plan became unclear.", successCriteria: "Record one decision to repeat and one to reconsider.", minutes: 8, order: 3, opening }),
  ];
  const requestedMinutes = normaliseTrainingPreferences(preferences).weeklyMinutes;
  if (requestedMinutes >= 30) tasks.push(foundationalTask({ type: "concept_review", title: `Recall your ${opening.name} cues`, explanation: "This adds spaced recall for the longer weekly block you selected, without introducing unsupported theory.", successCriteria: "Explain the setup and one danger without looking at your notes.", minutes: 8, order: 4, opening }));
  if (requestedMinutes === 60) tasks.push(foundationalTask({ type: "game_review", title: `Apply the ${opening.name} checklist once more`, explanation: "This uses your longer training preference to reinforce the same foundation in another game or practice example.", successCriteria: "Use the same checklist on one additional example and record one practical cue.", minutes: 12, order: 5, opening }));
  const plan = {
    schemaVersion: WEEKLY_TRAINING_PLAN_SCHEMA_VERSION,
    id: makeId("foundation-plan"),
    userId,
    weekStart,
    weekEnd,
    reportId: null,
    status: "active",
    primaryGoal: `Build a reliable ${opening.name} foundation`,
    reason: games ? `Only ${games} recent game${games === 1 ? " is" : "s are"} available, so this week builds dependable habits without making a low-sample performance claim.` : "There is not enough report evidence yet, so this week builds dependable opening habits while you collect games.",
    estimatedMinutes: 22,
    targetMetric: { type: "task_completion", target: 100, label: "Complete all 3 foundation tasks", openingId: opening.id },
    tasks,
    completionPercent: 0,
    createdAt: new Date(now).toISOString(),
    completedAt: null,
    foundation: true,
  };
  return personaliseWeeklyTrainingPlan(plan, preferences, { allowTaskResize: true });
}

export function openingForWeeklyTask(task = {}, plan = {}) {
  const known = findOpeningLine(task.openingName || task.openingId || plan.targetMetric?.openingId || "");
  const fallback = text(task.openingName || task.openingId || plan.targetMetric?.openingId) || "Opening focus";
  const blackSignal = /black|defen[cs]e|sicilian|french|caro|scandinavian|pirc|dutch|king.?s indian/i.test(`${task.trainingSide || ""} ${fallback}`);
  return { name: known?.name || fallback.replaceAll("-", " "), id: task.openingId || known?.id || null, side: task.trainingSide === "black" || known?.color === "black" || blackSignal ? "black" : "white" };
}

export function weeklyTargetMetricLabel(metric = {}, taskCount = 0) {
  if (text(metric.label)) return text(metric.label);
  if (metric.type === "task_completion") return `Complete ${taskCount || "all"} focused task${taskCount === 1 ? "" : "s"}`;
  if (metric.target !== undefined && metric.target !== null) return `${text(metric.type || "Target").replaceAll("_", " ")}: ${metric.target}`;
  return "Complete this week's focused plan";
}

export function buildThisWeekTrainingView(plan) {
  if (!plan) return { state: "empty", tasks: [], nextTask: null, completedTasks: [], pendingTasks: [] };
  const tasks = list(plan.tasks).slice().sort((left, right) => number(left.order) - number(right.order));
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const pendingTasks = tasks.filter((task) => task.status !== "completed");
  const complete = plan.status === "completed" || (tasks.length > 0 && completedTasks.length === tasks.length);
  return {
    state: complete ? "completed" : plan.foundation ? "foundation" : "active",
    tasks,
    completedTasks,
    pendingTasks,
    nextTask: complete ? null : pendingTasks[0] || null,
    completionPercent: tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : number(plan.completionPercent),
    targetMetricLabel: weeklyTargetMetricLabel(plan.targetMetric, tasks.length),
    completionMessage: `You completed all ${tasks.length} tasks for ${text(plan.primaryGoal).replace(/^./, (letter) => letter.toLowerCase())}.`,
    futureCue: "In your next games, notice whether the weekly position feels easier to recognise and whether your first plan is clearer.",
    reassessment: `OpeningFit will reassess this plan after a new valid report or when the next week starts after ${plan.weekEnd || "this week"}.`,
  };
}
