export const TRAINING_PREFERENCES_STORAGE_KEY = "openingFit:trainingPreferences:v1";

export const TRAINING_GOALS = Object.freeze([
  { value: "simple_repertoire", label: "Build a simple repertoire" },
  { value: "fix_weak_openings", label: "Fix weak openings" },
  { value: "improve_consistency", label: "Improve consistency" },
  { value: "prepare_rated_games", label: "Prepare for rated games" },
]);

export const PLAY_FREQUENCIES = Object.freeze([
  { value: "monthly", label: "A few games per month" },
  { value: "weekly", label: "A few games per week" },
  { value: "most_days", label: "Most days" },
]);

export const WEEKLY_TRAINING_TIMES = Object.freeze([15, 30, 60]);

const goalValues = new Set(TRAINING_GOALS.map((item) => item.value));
const frequencyValues = new Set(PLAY_FREQUENCIES.map((item) => item.value));

export function normaliseTrainingPreferences(value = {}) {
  value = value && typeof value === "object" ? value : {};
  const weeklyMinutes = Number(value.weeklyMinutes ?? value.weekly_minutes);
  return {
    mainGoal: goalValues.has(value.mainGoal ?? value.main_goal) ? (value.mainGoal ?? value.main_goal) : "",
    playFrequency: frequencyValues.has(value.playFrequency ?? value.play_frequency) ? (value.playFrequency ?? value.play_frequency) : "",
    weeklyMinutes: WEEKLY_TRAINING_TIMES.includes(weeklyMinutes) ? weeklyMinutes : null,
    status: ["completed", "skipped"].includes(value.status) ? value.status : "",
    updatedAt: value.updatedAt || value.updated_at || null,
  };
}

export function hasCompleteTrainingPreferences(value) {
  const prefs = normaliseTrainingPreferences(value);
  return Boolean(prefs.mainGoal && prefs.playFrequency && prefs.weeklyMinutes);
}

export function readLocalTrainingPreferences(storage = globalThis.localStorage) {
  try {
    return normaliseTrainingPreferences(JSON.parse(storage?.getItem(TRAINING_PREFERENCES_STORAGE_KEY) || "{}"));
  } catch {
    return normaliseTrainingPreferences();
  }
}

export function writeLocalTrainingPreferences(value, storage = globalThis.localStorage) {
  const preferences = normaliseTrainingPreferences(value);
  try {
    storage?.setItem(TRAINING_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences remain available for this session if storage is unavailable.
  }
  return preferences;
}

export function resolveTrainingPreferences({ authenticated = false, settings = {}, localPreferences = {} } = {}) {
  const cloud = normaliseTrainingPreferences(settings?.preferences?.trainingPreferences);
  if (authenticated) return cloud;
  return normaliseTrainingPreferences(localPreferences);
}

export function shouldStartPostReportOnboarding() {
  return false;
}

function goalCopy(goal, focus) {
  if (goal === "simple_repertoire") return `Build a simple, repeatable ${focus} repertoire`;
  if (goal === "improve_consistency") return `Make your ${focus} decisions more consistent`;
  if (goal === "prepare_rated_games") return `Prepare ${focus} for your rated games`;
  return `Repair your main ${focus} weakness`;
}

function cadenceCopy(frequency) {
  if (frequency === "monthly") return "Because you normally play a few games each month, the wording favours cues that are easy to retain between games.";
  if (frequency === "most_days") return "Because you normally play most days, the plan uses repetition you can apply quickly in upcoming games.";
  return "Because you normally play a few games each week, the plan balances review with near-term application.";
}

function allocateMinutes(tasks, total) {
  if (!tasks.length || !total) return tasks;
  const minimum = 3;
  const base = Math.max(minimum, Math.floor(total / tasks.length));
  let remaining = total - (base * tasks.length);
  return tasks.map((task, index) => {
    const minutes = base + (remaining > 0 ? 1 : 0);
    if (remaining > 0) remaining -= 1;
    return { ...task, estimatedMinutes: minutes, order: index + 1 };
  });
}

export function personaliseWeeklyTrainingPlan(plan, value, { allowTaskResize = false } = {}) {
  if (!plan || !hasCompleteTrainingPreferences(value)) return plan;
  const preferences = normaliseTrainingPreferences(value);
  const requestedTaskCount = preferences.weeklyMinutes === 15 ? 3 : preferences.weeklyMinutes === 60 ? 5 : 4;
  const available = Array.isArray(plan.tasks) ? plan.tasks : [];
  const selected = allowTaskResize ? available.slice(0, requestedTaskCount) : available;
  const tasks = allocateMinutes(selected, preferences.weeklyMinutes);
  const focus = String(plan.targetMetric?.openingId || "opening").replaceAll("-", " ");
  return {
    ...plan,
    primaryGoal: goalCopy(preferences.mainGoal, focus),
    reason: `${plan.reason} ${cadenceCopy(preferences.playFrequency)}`,
    estimatedMinutes: tasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0),
    tasks,
    trainingPreferences: preferences,
  };
}
