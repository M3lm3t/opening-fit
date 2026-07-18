import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";
import { normaliseTrainingPreferences, personaliseWeeklyTrainingPlan } from "./trainingPreferences.js";

export const WEEKLY_TRAINING_PLAN_SCHEMA_VERSION = 1;
export const WEEKLY_TRAINING_TASK_TYPES = Object.freeze(["position_drill", "line_replay", "game_review", "concept_review"]);
export const WEEKLY_TRAINING_PLAN_STATUSES = Object.freeze(["active", "completed", "expired"]);
export const WEEKLY_TRAINING_TASK_STATUSES = Object.freeze(["pending", "completed"]);

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const text = (value) => String(value ?? "").trim();
const number = (value, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const makeId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const makeUuid = () => globalThis.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
  const random = Math.floor(Math.random() * 16);
  return (token === "x" ? random : (random & 0x3) | 0x8).toString(16);
});

export function weeklyPlanWindow(now = new Date()) {
  const date = new Date(now);
  const day = date.getUTCDay();
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - ((day + 6) % 7)));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { weekStart: start.toISOString().slice(0, 10), weekEnd: end.toISOString().slice(0, 10) };
}

function openingName(value = {}) {
  return text(value.opening || value.opening_name || value.name || value.display_name || value.canonical_name);
}

function openingKey(value = {}) {
  return value.canonical_opening_id || findOpeningLine(openingName(value))?.id || normaliseOpeningKey(openingName(value));
}

function reportGames(report = {}) {
  return number(report.total_games_analysed ?? report.gamesImported ?? report.games_imported ?? report.totalGames ?? report.total_games ?? report.gamesAnalysed ?? report.games_analyzed, 0);
}

function weaknessRows(report = {}) {
  const metadata = report.analysis_metadata || {};
  return [report.weaknesses, report.problem_lines, report.problemLines, metadata.weaknesses, metadata.problem_lines, report.training_priorities]
    .find((rows) => Array.isArray(rows) && rows.length) || [];
}

function activeOpeningMap(repertoire = []) {
  return new Map(list(repertoire).filter((entry) => entry.status === "active").map((entry) => [openingKey(entry), entry]));
}

function mainWeakness(report, repertoire) {
  const active = activeOpeningMap(repertoire);
  const candidates = weaknessRows(report).map((row, index) => {
    const value = typeof row === "string" ? { title: row } : row;
    const key = openingKey(value);
    const games = number(value.frequency ?? value.issue_games ?? value.games ?? value.sample_size, 0);
    return {
      ...value,
      key,
      opening: openingName(value),
      title: text(value.title || value.label || value.pattern || value.reason || value.explanation) || "Main weekly opening weakness",
      games,
      activeEntry: active.get(key) || null,
      rank: (active.has(key) ? 1000 : 0) + games * 20 - index,
    };
  }).sort((left, right) => right.rank - left.rank);
  if (candidates[0]) return candidates[0];
  const repertoireWeakness = list(repertoire).filter((entry) => entry.status === "active" && text(entry.key_weakness)).sort((left, right) => number(right.sample_size) - number(left.sample_size))[0];
  if (!repertoireWeakness) return null;
  return {
    key: openingKey(repertoireWeakness),
    opening: openingName(repertoireWeakness),
    title: text(repertoireWeakness.key_weakness),
    games: number(repertoireWeakness.sample_size),
    activeEntry: repertoireWeakness,
    rank: 500,
  };
}

function sourceGameIds(weakness = {}) {
  const sources = [weakness.sourceGameIds, weakness.source_game_ids, weakness.gameIds, weakness.game_ids, weakness.supportingGames, weakness.supporting_games]
    .find((value) => Array.isArray(value)) || [];
  return sources.map((item) => text(typeof item === "object" ? item.id || item.game_id || item.url : item)).filter(Boolean).slice(0, 5);
}

function expectedMoves(weakness = {}) {
  const raw = weakness.expectedMoves || weakness.expected_moves || weakness.moves || weakness.moveLine || weakness.move_line || weakness.line;
  if (Array.isArray(raw)) return raw.map(text).filter(Boolean).slice(0, 12);
  return text(raw) ? text(raw).split(/\s+/).filter(Boolean).slice(0, 12) : [];
}

function task({ type, title, explanation, openingId = null, games = [], fen = null, moves = [], success, minutes, order }) {
  return {
    id: makeId("weekly-task"),
    type,
    title,
    explanation,
    openingId,
    sourceGameIds: games,
    positionFen: fen || null,
    expectedMoves: moves,
    successCriteria: success,
    estimatedMinutes: minutes,
    order,
    status: "pending",
  };
}

export function adaptLegacyTrainingPlan(legacyPlan, context = {}) {
  return list(legacyPlan).slice(0, 5).map((item, index) => {
    const value = typeof item === "string" ? { title: item, explanation: item } : item || {};
    const title = text(value.title || value.action || value.task || value.text) || `Training step ${index + 1}`;
    const explanation = text(value.explanation || value.text || value.reason || value.why) || title;
    return task({
      type: WEEKLY_TRAINING_TASK_TYPES.includes(value.type) ? value.type : "concept_review",
      title,
      explanation,
      openingId: value.openingId || value.opening_id || context.openingId || null,
      games: list(value.sourceGameIds || value.source_game_ids),
      fen: value.positionFen || value.position_fen,
      moves: list(value.expectedMoves || value.expected_moves),
      success: text(value.successCriteria || value.success_criteria) || "Complete the review and record one practical takeaway.",
      minutes: Math.max(5, Math.min(12, number(value.estimatedMinutes || value.estimated_minutes, 7))),
      order: index + 1,
    });
  });
}

export function buildWeeklyTrainingPlan({ userId, report, repertoire = [], reportId = null, now = new Date(), preferences = null } = {}) {
  if (!userId || !report) return { state: "missing-report", plan: null };
  const active = list(repertoire).filter((entry) => entry.status === "active");
  if (!active.length) return { state: "missing-repertoire", plan: null };
  const gamesAnalysed = reportGames(report);
  if (gamesAnalysed < 5) return { state: "insufficient-games", plan: null };

  const weakness = mainWeakness(report, active);
  const legacy = adaptLegacyTrainingPlan(report.training_plan || report.trainingPlan || [], { openingId: weakness?.key || null });
  const targetOpening = weakness?.activeEntry || active.sort((left, right) => number(right.sample_size) - number(left.sample_size))[0];
  const targetName = weakness?.opening || openingName(targetOpening) || "your main opening";
  const targetId = weakness?.key || openingKey(targetOpening) || null;
  const reason = weakness
    ? `${weakness.title}${weakness.games ? ` (${weakness.games} supporting game${weakness.games === 1 ? "" : "s"})` : ""}.`
    : `No repeated weakness is strong enough to isolate, so this plan keeps one active opening as the weekly focus.`;
  const games = sourceGameIds(weakness);
  const moves = expectedMoves(weakness);
  const fen = text(weakness?.positionFen || weakness?.position_fen || weakness?.fen) || null;
  const tasks = [];

  tasks.push(task({
    type: "concept_review",
    title: `Understand the main issue in ${targetName}`,
    explanation: weakness ? `Selected because the latest report identifies this as the clearest recurring issue in an active repertoire opening.` : `Selected to keep this week focused on one active opening while more evidence develops.`,
    openingId: targetId,
    games,
    success: "Write down one position cue and one safer practical response.",
    minutes: 6,
    order: 1,
  }));

  if (fen && moves.length) {
    tasks.push(task({ type: "position_drill", title: `Drill the recorded ${targetName} position`, explanation: "Selected because the report includes both a saved position and expected continuation from analysed game data.", openingId: targetId, games, fen, moves, success: "Play the recorded continuation correctly twice without revealing the answer.", minutes: 8, order: 2 }));
  } else if (moves.length) {
    tasks.push(task({ type: "line_replay", title: `Replay the recorded ${targetName} line`, explanation: "Selected because this move sequence appears in the available analysis; it is a replay task, not a claim that it is the only theoretical line.", openingId: targetId, games, moves, success: "Replay the recorded sequence twice and explain the first decision point.", minutes: 8, order: 2 }));
  } else {
    tasks.push(task({ type: "concept_review", title: `Review the plan for ${targetName}`, explanation: "No exact position or move sequence is available, so this task stays conceptual instead of inventing theory.", openingId: targetId, games, success: "Identify the development plan and one recurring danger from the report evidence.", minutes: 7, order: 2 }));
  }

  tasks.push(task({
    type: games.length ? "game_review" : "concept_review",
    title: games.length ? `Review supporting ${targetName} games` : `Connect the issue to your recent ${targetName} sample`,
    explanation: games.length ? "Selected because these analysed games support the weekly weakness." : "No source game identifiers are available, so review the report evidence without inventing a specific game reference.",
    openingId: targetId,
    games,
    success: games.length ? "Find the first moment the recurring issue appeared in each saved game." : "Record one example from the report and one adjustment for the next game.",
    minutes: 9,
    order: 3,
  }));

  const focusTerms = [targetName, weakness?.title].map((value) => normaliseOpeningKey(value)).filter(Boolean);
  const legacyTask = legacy.find((item) => {
    const value = normaliseOpeningKey(`${item.title} ${item.explanation}`);
    return !tasks.some((current) => current.title === item.title) && focusTerms.some((term) => value.includes(term) || term.includes(value));
  });
  tasks.push(legacyTask ? { ...legacyTask, order: 4, estimatedMinutes: Math.min(8, legacyTask.estimatedMinutes) } : task({ type: "concept_review", title: `Prepare one practical cue for ${targetName}`, explanation: "Selected to convert the same weekly weakness into a simple cue suitable for the next game.", openingId: targetId, games, success: "Create one short reminder you can recall before move ten.", minutes: 6, order: 4 }));

  if (normaliseTrainingPreferences(preferences).weeklyMinutes === 60) {
    tasks.push(task({ type: games.length ? "game_review" : "concept_review", title: `Reinforce the ${targetName} focus`, explanation: "Included because you chose a longer weekly training block; it repeats the same focus instead of adding an unrelated weakness.", openingId: targetId, games, success: "Explain the weekly cue from memory, then identify it in one more relevant example.", minutes: 12, order: 5 }));
  }

  const totalMinutes = tasks.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const { weekStart, weekEnd } = weeklyPlanWindow(now);
  const plan = {
    schemaVersion: WEEKLY_TRAINING_PLAN_SCHEMA_VERSION,
    id: makeUuid(),
    userId,
    weekStart,
    weekEnd,
    reportId: reportId || report.report_id || report.id || null,
    status: "active",
    primaryGoal: weakness ? `Repair ${weakness.title} in ${targetName}` : `Build reliable habits in ${targetName}`,
    reason,
    estimatedMinutes: totalMinutes,
    targetMetric: {
      type: "task_completion",
      target: 100,
      openingId: targetId,
      issueType: weakness?.issueType || weakness?.issue_type || weakness?.type || null,
      evidenceGames: weakness?.games || 0,
      beforeMetric: weakness?.games ? { repeatedMistakeCount: weakness.games, sampleSize: weakness.games } : null,
    },
    tasks,
    completionPercent: 0,
    createdAt: new Date(now).toISOString(),
    completedAt: null,
  };
  return {
    state: "created",
    plan: personaliseWeeklyTrainingPlan(plan, preferences, { allowTaskResize: true }),
  };
}

export function completeWeeklyTask(plan, taskId, completed = true) {
  const tasks = list(plan?.tasks).map((item) => item.id === taskId ? {
    ...item,
    status: completed ? "completed" : "pending",
    completedAt: completed ? (item.completedAt || new Date().toISOString()) : null,
  } : item);
  const completedCount = tasks.filter((item) => item.status === "completed").length;
  const completionPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  return {
    ...plan,
    tasks,
    completionPercent,
    status: completionPercent === 100 ? "completed" : "active",
    completedAt: completionPercent === 100 ? new Date().toISOString() : null,
  };
}

export function isReusableWeeklyPlan(plan, { weekStart, reportId, forceRefresh = false } = {}) {
  return Boolean(plan && !forceRefresh && plan.status === "active" && plan.weekStart === weekStart && (!reportId || plan.reportId === reportId));
}
