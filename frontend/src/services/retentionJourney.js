import { buildStreak, buildTodayTasks } from "./todayRetention.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(String(value).replace("%", ""));
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed >= 0 && parsed <= 1) return Math.round(parsed * 100);
  return Math.round(parsed);
}

function openingName(item = {}, fallback = "") {
  if (typeof item === "string") return item;
  return item.name || item.opening || item.openingName || item.opening_name || item.ecoName || item.eco_name || fallback;
}

function getReport(row = {}) {
  return row.report || row.analysis || row.last_report || row.data || row.snapshot?.report || row.snapshot || row;
}

function reportDate(row = {}) {
  const report = getReport(row);
  const raw = row.created_at || row.createdAt || row.updated_at || row.updatedAt || row.summary?.reportDate || report.importedAt || report.imported_at || report.lastUpdated || report.last_updated || report.createdAt || report.created_at;
  const parsed = Date.parse(raw || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function reportScore(row = {}) {
  const report = getReport(row);
  const summary = row.summary || row.snapshot || {};
  return numberValue(summary.healthScore ?? summary.openingFitScore ?? report.openingFitScore ?? report.opening_fit_score ?? report.opening_fit_score_v2 ?? report.openingHealth?.score ?? report.opening_health?.score, null);
}

function gameCount(report = {}) {
  report = report || {};
  return numberValue(report.gamesImported ?? report.games_imported ?? report.gamesAnalysed ?? report.gamesAnalyzed ?? report.totalGames ?? report.total_games, 0);
}

function collectOpenings(report = {}) {
  report = report || {};
  return [
    ...asArray(report.best_openings),
    ...asArray(report.bestOpenings),
    ...asArray(report.top_openings),
    ...asArray(report.topOpenings),
    ...asArray(report.opening_stats),
    ...asArray(report.openingStats),
  ].filter((item) => {
    const name = openingName(item).toLowerCase();
    return name && !name.includes("unknown") && !name.includes("unclassified");
  });
}

function openingScore(item = {}) {
  return numberValue(item.fitScore ?? item.fit_score ?? item.openingFitScore ?? item.score ?? item.winRate ?? item.win_rate, null);
}

function activityType(item = {}) {
  return String(item.type || item.action_type || item.activity_type || "").toLowerCase();
}

function isMeaningfulActivity(item = {}) {
  return new Set([
    "today_task_completed",
    "today_plan_completed",
    "training_completed",
    "weakest_line_training_completed",
    "game_review_completed",
    "report_imported",
    "achievement_unlocked",
    "weekly_recap_seen",
    "rating_goal_updated",
  ]).has(activityType(item));
}

function activityOpening(item = {}) {
  return item.payload?.opening || item.payload?.opening_name || item.payload?.task_opening || "";
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date = new Date()) {
  const value = date instanceof Date ? new Date(date) : new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value;
}

function weekKey(date = new Date()) {
  return localDateKey(startOfWeek(date));
}

export const ACHIEVEMENTS = [
  { key: "first_analysis", title: "First Analysis", requirement: "Complete your first valid OpeningFit analysis." },
  { key: "getting_started", title: "Getting Started", requirement: "Complete your first daily training task." },
  { key: "opening_student", title: "Opening Student", requirement: "Complete five opening practice sessions." },
  { key: "game_reviewer", title: "Game Reviewer", requirement: "Complete five personal game-review missions." },
  { key: "consistent_learner", title: "Consistent Learner", requirement: "Maintain a three-day meaningful-activity streak." },
  { key: "one_week_strong", title: "One Week Strong", requirement: "Maintain a seven-day meaningful-activity streak." },
  { key: "century_club", title: "Century Club", requirement: "Analyse at least 100 games in total." },
  { key: "repertoire_builder", title: "Repertoire Builder", requirement: "Have both a White and Black repertoire opening detected or confirmed." },
  { key: "opening_specialist", title: "Opening Specialist", requirement: "Complete ten meaningful activities connected to the same opening." },
  { key: "progress_detected", title: "Progress Detected", requirement: "Record a valid OpeningFit score increase between separate analyses." },
];

export function evaluateAchievements({ reportHistory = [], activity = [], data = {} } = {}) {
  const unlocked = new Map();
  asArray(activity)
    .filter((item) => activityType(item) === "achievement_unlocked")
    .forEach((item) => {
      if (item.payload?.achievement_key) unlocked.set(item.payload.achievement_key, item.created_at || item.createdAt || item.payload.unlocked_at);
    });

  const reports = [...asArray(reportHistory), data ? { report: data, created_at: new Date().toISOString() } : null].filter(Boolean);
  const validReports = reports.filter((row) => gameCount(getReport(row)) > 0 || collectOpenings(getReport(row)).length);
  const practiceCount = asArray(activity).filter((item) => /practice|weakest_line_training_completed|opening_practice_completed/.test(activityType(item))).length;
  const reviewCount = asArray(activity).filter((item) => activityType(item) === "game_review_mission_completed").length;
  const dailyTaskCount = asArray(activity).filter((item) => activityType(item) === "today_task_completed").length;
  const streak = buildStreak(activity);
  const totalGames = validReports.reduce((sum, row) => Math.max(sum, gameCount(getReport(row))), 0);
  const openings = collectOpenings(data || {});
  const hasWhite = openings.some((item) => /white/i.test(String(item.side || item.colour || item.color || item.context || "")));
  const hasBlack = openings.some((item) => /black|e4|d4/i.test(String(item.side || item.colour || item.color || item.context || item.responseTo || "")));
  const openingActivityCounts = asArray(activity).reduce((map, item) => {
    const name = activityOpening(item);
    if (!name) return map;
    map.set(name.toLowerCase(), (map.get(name.toLowerCase()) || 0) + 1);
    return map;
  }, new Map());
  const sortedScores = validReports
    .map((row) => ({ score: reportScore(row), time: reportDate(row) }))
    .filter((row) => row.score !== null && row.time)
    .sort((a, b) => a.time - b.time);
  const scoreImproved = sortedScores.some((row, index) => index > 0 && row.score > sortedScores[index - 1].score);

  const conditions = {
    first_analysis: validReports.length >= 1,
    getting_started: dailyTaskCount >= 1,
    opening_student: practiceCount >= 5,
    game_reviewer: reviewCount >= 5,
    consistent_learner: streak.longest >= 3,
    one_week_strong: streak.longest >= 7,
    century_club: totalGames >= 100,
    repertoire_builder: hasWhite && hasBlack,
    opening_specialist: [...openingActivityCounts.values()].some((count) => count >= 10),
    progress_detected: scoreImproved,
  };

  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    unlocked: Boolean(unlocked.has(achievement.key) || conditions[achievement.key]),
    stored: unlocked.has(achievement.key),
    unlockedAt: unlocked.get(achievement.key) || (conditions[achievement.key] ? new Date().toISOString() : null),
  }));
}

export function newlyUnlockedAchievements(args = {}) {
  return evaluateAchievements(args).filter((item) => item.unlocked && !item.stored);
}

export function buildWeeklyRecap({ data = {}, reportHistory = [], activity = [], date = new Date() } = {}) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const inWeek = (raw) => {
    const parsed = Date.parse(raw || "");
    return Number.isFinite(parsed) && parsed >= start.getTime() && parsed < end.getTime();
  };
  const weekActivity = asArray(activity).filter((item) => inWeek(item.created_at || item.createdAt || item.updated_at || item.updatedAt));
  const reports = asArray(reportHistory).filter((row) => inWeek(row.created_at || row.createdAt || getReport(row).importedAt || getReport(row).imported_at));
  const tasks = weekActivity.filter((item) => activityType(item) === "today_task_completed").length;
  const practices = weekActivity.filter((item) => /practice|training_completed|weakest_line_training_completed/.test(activityType(item))).length;
  const reviews = weekActivity.filter((item) => activityType(item) === "game_review_mission_completed").length;
  const xp = weekActivity.reduce((sum, item) => sum + numberValue(item.points ?? item.payload?.points, 0), 0);
  const streak = buildStreak(activity, date);
  const scores = reports.map((row) => reportScore(row)).filter((score) => score !== null);
  const scoreChange = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null;
  const openings = collectOpenings(data);
  const strongest = openings.filter((item) => openingScore(item) !== null).sort((a, b) => openingScore(b) - openingScore(a))[0];
  const priority = buildTodayTasks({ data, reportHistory, activity, date }).find((task) => !task.completed);
  const mostReviewed = [...weekActivity.reduce((map, item) => {
    const name = activityOpening(item);
    if (name) map.set(name, (map.get(name) || 0) + 1);
    return map;
  }, new Map()).entries()].sort((a, b) => b[1] - a[1])[0];

  const observation = mostReviewed
    ? `You worked on ${mostReviewed[0]} more than any other opening this week.`
    : scoreChange !== null
      ? `Your OpeningFit score ${scoreChange >= 0 ? "rose" : "moved down"} ${Math.abs(scoreChange)} point${Math.abs(scoreChange) === 1 ? "" : "s"} across comparable reports.`
      : "This week has enough room for one focused opening action.";

  return {
    key: `weekly_recap:${weekKey(date)}`,
    weekStart: weekKey(date),
    metrics: [
      tasks ? { label: "Tasks completed", value: tasks } : null,
      practices ? { label: "Practice sessions", value: practices } : null,
      reviews ? { label: "Games reviewed", value: reviews } : null,
      reports.length ? { label: "Analyses", value: reports.length } : null,
      xp ? { label: "XP earned", value: xp } : null,
      scoreChange !== null ? { label: "Score change", value: `${scoreChange >= 0 ? "+" : ""}${scoreChange}` } : null,
    ].filter(Boolean),
    streak,
    strongestOpening: strongest ? openingName(strongest) : "",
    priorityOpening: priority?.opening || "",
    observation,
    firstTask: priority?.title || "Analyse new games when you have a fresh sample.",
    hasData: weekActivity.length > 0 || reports.length > 0,
  };
}

export function buildCoachSummary({ data = {}, reportHistory = [], activity = [] } = {}) {
  const openings = collectOpenings(data);
  const strongest = openings.filter((item) => openingScore(item) !== null).sort((a, b) => openingScore(b) - openingScore(a))[0];
  const weakest = openings.filter((item) => openingScore(item) !== null).sort((a, b) => openingScore(a) - openingScore(b))[0];
  const tasks = buildTodayTasks({ data, reportHistory, activity });
  const incomplete = tasks.find((task) => !task.completed);

  return {
    goingWell: strongest
      ? `${openingName(strongest)} is your strongest current signal across ${numberValue(strongest.games ?? strongest.count, 0) || "a small sample"} games.`
      : "OpeningFit needs more repeated opening data before naming a strength.",
    needsAttention:
      weakest && strongest && openingName(weakest) !== openingName(strongest)
        ? `${openingName(weakest)} is the current priority to review. Sample size: ${numberValue(weakest.games ?? weakest.count, 0) || "limited"}.`
        : "No separate recurring weakness is strong enough to call yet.",
    nextStep: incomplete?.title || "Refresh analysis after your next few games.",
    confidence: openings.length >= 3 ? "Medium confidence" : "Low sample size",
  };
}

export function buildJourneyEvents({ data = {}, reportHistory = [], activity = [] } = {}) {
  const events = new Map();
  const add = (event) => {
    if (!event?.key || events.has(event.key)) return;
    events.set(event.key, event);
  };

  asArray(reportHistory).forEach((row, index) => {
    const report = getReport(row);
    const time = reportDate(row);
    if (!time) return;
    if (index === 0) add({ key: "first-analysis", type: "milestones", date: time, title: "First analysis", detail: `${gameCount(report)} games analysed.` });
    const score = reportScore(row);
    if (score !== null) add({ key: `score:${time}`, type: "progress", date: time, title: `OpeningFit score ${score}`, detail: "Saved report score." });
    const strongest = collectOpenings(report).filter((item) => openingScore(item) !== null).sort((a, b) => openingScore(b) - openingScore(a))[0];
    if (strongest) add({ key: `strongest:${time}:${openingName(strongest)}`, type: "openings", date: time, title: "Strongest opening identified", detail: openingName(strongest) });
  });

  evaluateAchievements({ reportHistory, activity, data }).filter((item) => item.unlocked).forEach((item) => {
    add({ key: `achievement:${item.key}`, type: "milestones", date: Date.parse(item.unlockedAt || new Date()), title: item.title, detail: item.requirement });
  });

  asArray(activity).forEach((item) => {
    const type = activityType(item);
    const time = Date.parse(item.created_at || item.createdAt || item.updated_at || item.updatedAt || "");
    if (!Number.isFinite(time)) return;
    if (type === "rating_goal_updated") add({ key: `rating-goal:${item.payload?.dedupe_key || time}`, type: "milestones", date: time, title: "Rating goal updated", detail: "Your training target was adjusted." });
    if (type === "weekly_recap_seen") add({ key: `weekly:${item.payload?.week_start || time}`, type: "progress", date: time, title: "Weekly recap viewed", detail: item.payload?.observation || "Weekly summary available." });
  });

  return [...events.values()].sort((a, b) => b.date - a.date);
}

export function buildProgressCharts({ reportHistory = [], activity = [] } = {}) {
  const scorePoints = asArray(reportHistory)
    .map((row) => ({ date: reportDate(row), value: reportScore(row) }))
    .filter((point) => point.date && point.value !== null)
    .sort((a, b) => a.date - b.date);
  const activityByWeek = asArray(activity).filter(isMeaningfulActivity).reduce((map, item) => {
    const key = weekKey(item.created_at || item.createdAt || item.updated_at || item.updatedAt || new Date());
    if (!key) return map;
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  return {
    scorePoints,
    activityBars: [...activityByWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([label, value]) => ({ label, value })),
  };
}

export function buildNewSinceLastVisit({ reportHistory = [], activity = [], settings = null } = {}) {
  const dismissed = new Set(settings?.preferences?.dismissedJourneyEvents || []);
  const latestReport = asArray(reportHistory).sort((a, b) => reportDate(b) - reportDate(a))[0];
  const latestAchievement = asArray(activity).filter((item) => activityType(item) === "achievement_unlocked").sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))[0];
  const items = [];
  if (latestReport) items.push({ key: `new-report:${reportDate(latestReport)}`, title: "New report comparison available", detail: "Your latest saved analysis can be compared with previous reports." });
  if (latestAchievement) items.push({ key: `achievement:${latestAchievement.payload?.achievement_key}`, title: "Achievement unlocked", detail: latestAchievement.payload?.title || "A real milestone was reached." });
  const recapKey = `weekly:${weekKey(new Date())}`;
  items.push({ key: recapKey, title: "Weekly recap ready", detail: "Review what changed this week and what to do next." });
  return items.filter((item) => !dismissed.has(item.key)).slice(0, 3);
}

export function cohortComparisonState() {
  return {
    available: false,
    reason: "Anonymous comparisons are hidden until a secure aggregate cohort endpoint with at least 25 qualifying users is available.",
  };
}
