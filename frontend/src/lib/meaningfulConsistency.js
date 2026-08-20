const DAY = 86400000;
const dayNumber = (value) => Math.floor(Date.parse(`${value}T00:00:00Z`) / DAY);

export function deriveMeaningfulConsistency(localDates = [], today) {
  const dates = [...new Set((localDates || []).filter(Boolean))].sort();
  if (!dates.length) return { status: "reset", currentStreak: 0, longestStreak: 0, completedToday: false };
  let chain = 0; let longest = 0; let prior = null;
  for (const date of dates) { const current = dayNumber(date); chain = prior === null || current - prior <= 3 ? chain + 1 : 1; longest = Math.max(longest, chain); prior = current; }
  const missed = dayNumber(today) - prior;
  return { status: missed === 0 ? "active" : missed === 1 ? "resting" : missed === 2 ? "at_risk" : "reset", currentStreak: missed >= 3 ? 0 : chain, longestStreak: longest, completedToday: missed === 0 };
}

export function selectMeaningfulConsistency({ userId, serverState, anonymousState } = {}) {
  return userId ? serverState : anonymousState;
}

export function weeklyMeaningfulCount(activities = [], weekStart) {
  const start = dayNumber(weekStart); const end = start + 7; const seen = new Set();
  return (activities || []).reduce((count, activity) => { const day = dayNumber(activity.activityLocalDate); const key = activity.idempotencyKey || activity.id; if (!key || seen.has(key) || day < start || day >= end) return count; seen.add(key); return count + 1; }, 0);
}
