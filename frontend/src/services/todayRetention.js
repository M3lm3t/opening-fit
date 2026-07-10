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

function localDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) return localDateKey(new Date());
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function daysBetween(a, b) {
  const first = dateFromKey(a);
  const second = dateFromKey(b);
  if (!first || !second) return null;
  return Math.round((second.setHours(0, 0, 0, 0) - first.setHours(0, 0, 0, 0)) / 86400000);
}

function openingName(opening, fallback = "") {
  if (typeof opening === "string") return opening;
  return (
    opening?.name ||
    opening?.opening ||
    opening?.openingName ||
    opening?.opening_name ||
    opening?.ecoName ||
    opening?.eco_name ||
    fallback
  );
}

function openingGames(opening) {
  if (!opening || typeof opening === "string") return 0;
  return numberValue(opening.games ?? opening.count ?? opening.total ?? opening.sampleSize, 0);
}

function openingScore(opening) {
  if (!opening || typeof opening === "string") return null;
  const direct =
    opening.fitScore ??
    opening.fit_score ??
    opening.openingFitScore ??
    opening.score ??
    opening.winRate ??
    opening.win_rate;
  if (direct !== undefined && direct !== null && direct !== "") return numberValue(direct, null);

  const games = openingGames(opening);
  const wins = Number(opening.wins ?? opening.w ?? 0) || 0;
  const draws = Number(opening.draws ?? opening.d ?? 0) || 0;
  if (!games) return null;
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function getReportPayload(row = {}) {
  return row.report || row.analysis || row.last_report || row.data || row.snapshot?.report || row.snapshot || row;
}

function getReportDate(row = {}) {
  const report = getReportPayload(row);
  const raw =
    row.created_at ||
    row.createdAt ||
    row.updated_at ||
    row.updatedAt ||
    row.summary?.reportDate ||
    report.importedAt ||
    report.imported_at ||
    report.lastUpdated ||
    report.last_updated ||
    report.createdAt ||
    report.created_at;
  const parsed = Date.parse(raw || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function reportScore(row = {}) {
  const report = getReportPayload(row);
  const summary = row.summary || row.snapshot || {};
  return numberValue(
    row.opening_fit_score ??
      row.openingFitScore ??
      summary.healthScore ??
      summary.openingFitScore ??
      summary.opening_fit_score ??
      report.openingFitScore ??
      report.opening_fit_score ??
      report.opening_fit_score_v2 ??
      report.openingHealth?.score ??
      report.opening_health?.score,
    null
  );
}

function getGameCount(data = {}) {
  return numberValue(
    data.gamesImported ??
      data.games_imported ??
      data.gamesAnalysed ??
      data.gamesAnalyzed ??
      data.games_analyzed ??
      data.totalGames ??
      data.total_games,
    0
  );
}

function collectOpenings(data = {}) {
  return [
    ...asArray(data.best_openings),
    ...asArray(data.bestOpenings),
    ...asArray(data.top_openings),
    ...asArray(data.topOpenings),
    ...asArray(data.opening_stats),
    ...asArray(data.openingStats),
  ].filter((item) => {
    const name = openingName(item, "").toLowerCase();
    return name && !name.includes("unknown") && !name.includes("unclassified");
  });
}

function getCompletedTaskIds(activity = [], dateKey = localDateKey()) {
  return new Set(
    asArray(activity)
      .filter((item) => item?.type === "today_task_completed" || item?.action_type === "today_task_completed")
      .filter((item) => item?.payload?.training_date === dateKey || localDateKey(item.created_at || item.createdAt) === dateKey)
      .map((item) => item?.payload?.task_id || item?.payload?.taskId)
      .filter(Boolean)
  );
}

function stableTaskId(dateKey, type, opening = "") {
  return ["today", dateKey, type, String(opening || "general").toLowerCase().replace(/[^a-z0-9]+/g, "-")].join(":");
}

export function buildTodayTasks({ data = {}, fitData = null, reportHistory = [], activity = [], date = new Date() } = {}) {
  const dateKey = localDateKey(date);
  const completedIds = getCompletedTaskIds(activity, dateKey);
  const openings = collectOpenings(data);
  const scored = openings
    .map((opening) => ({ opening, name: openingName(opening), games: openingGames(opening), score: openingScore(opening) }))
    .filter((item) => item.name && item.games > 0);
  const weakness = scored
    .filter((item) => item.games >= 2 && item.score !== null)
    .sort((a, b) => a.score - b.score || b.games - a.games)[0];
  const strength =
    scored
      .filter((item) => item.score !== null)
      .sort((a, b) => b.score - a.score || b.games - a.games)[0] ||
    (fitData?.bestOpening ? { opening: fitData.bestOpening, name: openingName(fitData.bestOpening), games: openingGames(fitData.bestOpening), score: openingScore(fitData.bestOpening) } : null);
  const reportCount = asArray(reportHistory).length;

  const tasks = [];

  if (weakness) {
    tasks.push({
      id: stableTaskId(dateKey, "review-weakness", weakness.name),
      type: "review_weakness",
      title: `Review your ${weakness.name} games`,
      explanation:
        weakness.score !== null
          ? `${weakness.games} analysed game${weakness.games === 1 ? "" : "s"} make this today's clearest repair area.`
          : "This opening appears often enough to review before adding more theory.",
      duration: "4 minutes",
      cta: "Review games",
      route: "report",
      opening: weakness.name,
    });
  }

  if (strength) {
    tasks.push({
      id: stableTaskId(dateKey, "practice-opening", strength.name),
      type: "practice_opening",
      title: `Practise your ${strength.name} move order`,
      explanation: `${strength.name} is one of your most useful current signals. Make the first moves more repeatable.`,
      duration: "3 minutes",
      cta: "Start practice",
      route: "practice",
      opening: strength.name,
    });
  }

  tasks.push({
    id: stableTaskId(dateKey, reportCount ? "refresh-analysis" : "first-analysis", data?.username || ""),
    type: reportCount ? "refresh_analysis" : "first_analysis",
    title: reportCount ? "Check for new games" : "Analyse your games",
    explanation: reportCount
      ? "Refresh your report to see whether your opening score has changed."
      : "OpeningFit needs one analysis before it can build a personal daily plan.",
    duration: "1 minute",
    cta: reportCount ? "Check for games" : "Analyse games",
    route: "analyse",
    opening: "",
  });

  return tasks.slice(0, 3).map((task) => ({
    ...task,
    completed: completedIds.has(task.id),
  }));
}

export function buildDailyProgress(tasks = []) {
  const total = tasks.length || 0;
  const completed = tasks.filter((task) => task.completed).length;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    complete: total > 0 && completed >= total,
    label: `${completed} of ${total} completed`,
  };
}

function meaningfulActivityDate(item = {}) {
  const type = String(item.type || item.action_type || item.activity_type || "").toLowerCase();
  const meaningful =
    type === "today_task_completed" ||
    type === "training_completed" ||
    type === "weakest_line_training_completed" ||
    type === "report_imported" ||
    type === "game_review_completed";
  if (!meaningful) return null;
  return item.payload?.training_date || localDateKey(item.created_at || item.createdAt || item.updated_at || item.updatedAt);
}

export function buildStreak(activity = [], date = new Date()) {
  const today = localDateKey(date);
  const activeDays = [...new Set(asArray(activity).map(meaningfulActivityDate).filter(Boolean))].sort();
  if (!activeDays.length) {
    return { current: 0, longest: 0, lastActiveDate: null, activeToday: false };
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < activeDays.length; index += 1) {
    if (daysBetween(activeDays[index - 1], activeDays[index]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  const lastActiveDate = activeDays[activeDays.length - 1];
  const gap = daysBetween(lastActiveDate, today);
  let current = 0;
  if (gap === 0 || gap === 1) {
    current = 1;
    for (let index = activeDays.length - 1; index > 0; index -= 1) {
      if (daysBetween(activeDays[index - 1], activeDays[index]) === 1) current += 1;
      else break;
    }
  }

  return {
    current,
    longest: Math.max(longest, current),
    lastActiveDate,
    activeToday: gap === 0,
  };
}

export function buildTodayHeader({ profile = null, data = {}, reportHistory = [], activity = [], date = new Date() } = {}) {
  const displayName =
    profile?.display_name ||
    profile?.username ||
    data?.displayName ||
    data?.username ||
    data?.playerName ||
    "";
  const score = reportScore(data);
  const sortedReports = asArray(reportHistory)
    .map((row) => ({ row, score: reportScore(row), time: getReportDate(row) }))
    .filter((row) => row.score !== null)
    .sort((a, b) => b.time - a.time);
  const previousScore = sortedReports.find((row) => getReportPayload(row.row) !== data)?.score ?? null;
  const scoreDelta = score !== null && previousScore !== null ? score - previousScore : null;
  const streak = buildStreak(activity, date);
  const hasReport = getGameCount(data) > 0 || collectOpenings(data).length > 0;

  return {
    greeting: displayName ? `Good ${greetingPart(date)}, ${displayName}` : hasReport ? "Welcome back" : "Let's build your opening plan.",
    score,
    scoreDelta,
    streak,
    primaryCta: hasReport ? "Continue today's training" : "Analyse my games",
    summary: hasReport
      ? scoreDelta === null
        ? score !== null
          ? `Your opening score is ${score}. Analyse again after more games to track movement.`
          : "Your report is ready. Complete one useful task today to keep momentum."
        : `Your opening score is ${score}, ${scoreDelta >= 0 ? "up" : "down"} ${Math.abs(scoreDelta)} since your previous report.`
      : "Analyse your games and OpeningFit will turn the report into a daily plan.",
  };
}

function greetingPart(date = new Date()) {
  const hour = (date instanceof Date ? date : new Date(date)).getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function firstRatingValue(...values) {
  for (const value of values) {
    const rating = numberValue(value, null);
    if (rating !== null && rating >= 100 && rating <= 4000) return rating;
  }
  return null;
}

function timeControlLabel(value) {
  const label = String(value || "").replace(/_/g, " ").trim();
  if (!label) return "";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function platformLabel(value) {
  const label = String(value || "").toLowerCase();
  if (label.includes("lichess")) return "Lichess";
  if (label.includes("chess")) return "Chess.com";
  return "";
}

function ratingFromPlatformRatings(ratings = {}) {
  const source = ratings && typeof ratings === "object" ? ratings : {};
  for (const control of ["rapid", "blitz", "classical", "daily", "bullet"]) {
    const entry = source[control];
    const rating = firstRatingValue(entry?.rating, entry);
    if (rating !== null) return { rating, timeControl: control };
  }
  return { rating: null, timeControl: "" };
}

function detectImportedRating(data = {}, profile = null) {
  const playerProfile = data.playerProfile || data.player_profile || profile?.playerProfile || profile?.player_profile || profile || {};
  const platformRatings =
    data.platformRatings ||
    data.platform_ratings ||
    playerProfile.platformRatings ||
    playerProfile.platform_ratings ||
    {};
  const platformPick = ratingFromPlatformRatings(platformRatings);
  const rating = firstRatingValue(
    data.currentRating,
    data.current_rating,
    data.rating,
    data.rapidRating,
    data.rapid_rating,
    data.blitzRating,
    data.blitz_rating,
    data.classicalRating,
    data.classical_rating,
    data.dailyRating,
    data.daily_rating,
    data.bulletRating,
    data.bullet_rating,
    data.chesscomRating,
    data.chesscom_rating,
    data.lichessRating,
    data.lichess_rating,
    playerProfile.currentRating,
    playerProfile.current_rating,
    playerProfile.rating,
    playerProfile.rapidRating,
    playerProfile.rapid_rating,
    playerProfile.blitzRating,
    playerProfile.blitz_rating,
    playerProfile.classicalRating,
    playerProfile.classical_rating,
    playerProfile.dailyRating,
    playerProfile.daily_rating,
    playerProfile.bulletRating,
    playerProfile.bullet_rating,
    platformPick.rating
  );
  const source = platformLabel(data.ratingSource || data.rating_source || playerProfile.ratingSource || playerProfile.rating_source || data.platform || data.importPlatform);
  const timeControl = timeControlLabel(
    data.ratingTimeControl ||
      data.rating_time_control ||
      playerProfile.ratingTimeControl ||
      playerProfile.rating_time_control ||
      platformPick.timeControl
  );

  return {
    rating,
    source,
    timeControl,
    label: rating !== null ? [source, timeControl].filter(Boolean).join(" ") || "Imported rating" : "",
  };
}

export function buildRatingGoalModel({ profile = null, settings = null, activity = [], data = {} } = {}) {
  const preferences = settings?.preferences || {};
  const goal =
    preferences.ratingGoal ||
    preferences.rating_goal ||
    profile?.rating_goal ||
    profile?.ratingGoal ||
    asArray(activity).find((item) => item.type === "rating_goal_updated")?.payload ||
    null;
  const detected = detectImportedRating(data, profile);
  const savedCurrent = firstRatingValue(goal?.currentRating, goal?.current_rating);
  const current = detected.rating ?? savedCurrent;
  const target = numberValue(goal?.targetRating ?? goal?.target_rating ?? goal?.target_value, null);
  const start = numberValue(goal?.startRating ?? goal?.start_rating ?? goal?.rating_goal_start ?? savedCurrent ?? current, current);
  const progress =
    current !== null && target !== null && start !== null && target !== start
      ? Math.max(0, Math.min(100, Math.round(((current - start) / (target - start)) * 100)))
      : 0;

  return {
    hasGoal: target !== null,
    current,
    target,
    start,
    progress,
    detectedRating: detected.rating,
    ratingSourceLabel: detected.label,
    hasImportedRating: detected.rating !== null,
  };
}

export function buildWhatChanged({ data = {}, reportHistory = [] } = {}) {
  const current = { report: data, score: reportScore(data), games: getGameCount(data), openings: collectOpenings(data) };
  const previousRow = asArray(reportHistory)
    .map((row) => ({ row, time: getReportDate(row) }))
    .filter(({ row }) => getReportPayload(row) !== data)
    .sort((a, b) => b.time - a.time)[0]?.row;
  if (!previousRow) {
    return {
      hasComparison: false,
      rows: [],
      empty: "Save one more analysis and OpeningFit will show what changed.",
    };
  }

  const previousReport = getReportPayload(previousRow);
  const previous = {
    score: reportScore(previousRow),
    games: getGameCount(previousReport),
    openings: collectOpenings(previousReport),
  };
  const rows = [];

  if (current.score !== null && previous.score !== null) {
    const delta = current.score - previous.score;
    rows.push({
      label: "OpeningFit score",
      value: delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta}`,
      tone: delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral",
      detail: delta === 0 ? "Your headline score held steady." : "Compared with your previous completed analysis.",
    });
  }

  const gameDelta = current.games - previous.games;
  if (current.games || previous.games) {
    rows.push({
      label: "Analysed games",
      value: gameDelta === 0 ? `${current.games}` : `${gameDelta > 0 ? "+" : ""}${gameDelta}`,
      tone: gameDelta > 0 ? "positive" : "neutral",
      detail: gameDelta > 0 ? "New games are included in this report." : "The compared reports used a similar game sample.",
    });
  }

  const currentStrongest = current.openings.sort((a, b) => openingScore(b) - openingScore(a))[0];
  const previousStrongest = previous.openings.sort((a, b) => openingScore(b) - openingScore(a))[0];
  if (openingName(currentStrongest) && openingName(currentStrongest) !== openingName(previousStrongest)) {
    rows.push({
      label: "Strongest opening",
      value: openingName(currentStrongest),
      tone: "positive",
      detail: previousStrongest ? `Previously: ${openingName(previousStrongest)}.` : "A new strongest signal appeared.",
    });
  }

  return {
    hasComparison: rows.length > 0,
    rows: rows.slice(0, 4),
    empty: "The saved reports do not share enough comparable fields yet.",
  };
}

export function buildRecentActivity(activity = []) {
  const labels = {
    today_task_completed: "Daily task completed",
    training_completed: "Training completed",
    weakest_line_training_completed: "Opening practised",
    training_started: "Training started",
    weak_line_training_started: "Opening practice started",
    report_imported: "Analysis completed",
    rating_goal_updated: "Rating goal updated",
  };

  return asArray(activity)
    .filter((item) => labels[item.type] || labels[item.action_type])
    .sort((a, b) => Date.parse(b.created_at || b.createdAt || 0) - Date.parse(a.created_at || a.createdAt || 0))
    .slice(0, 5)
    .map((item) => {
      const type = item.type || item.action_type;
      return {
        id: item.id || `${type}:${item.created_at || item.createdAt || ""}`,
        label: labels[type],
        detail: item.payload?.opening || item.payload?.task_title || item.payload?.username || "",
        date: item.created_at || item.createdAt || item.updated_at || item.updatedAt || "",
      };
    });
}

export { localDateKey };
