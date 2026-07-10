const XP_RULES = {
  today_task_completed: 20,
  opening_practice_completed: 15,
  game_review_mission_completed: 25,
  today_plan_completed: 30,
  report_imported: 10,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function xpForEvent(type) {
  return XP_RULES[type] || 0;
}

export function levelFromXp(totalXp = 0) {
  const xp = Math.max(0, numberValue(totalXp, 0));
  let level = 1;
  let requiredForNext = 100;
  let remaining = xp;

  while (remaining >= requiredForNext) {
    remaining -= requiredForNext;
    level += 1;
    requiredForNext += 50;
  }

  return {
    level,
    totalXp: xp,
    currentLevelXp: remaining,
    nextLevelXp: requiredForNext,
    percent: Math.round((remaining / requiredForNext) * 100),
  };
}

export function buildXpProgress(activity = []) {
  const seen = new Set();
  const total = asArray(activity).reduce((sum, item) => {
    const type = item.type || item.action_type || "";
    const key = item.dedupe_key || item.payload?.dedupe_key || item.payload?.dedupeKey || item.id || "";
    if (key && seen.has(key)) return sum;
    if (key) seen.add(key);
    return sum + numberValue(item.points ?? item.payload?.points ?? xpForEvent(type), 0);
  }, 0);

  return levelFromXp(total);
}

export { XP_RULES };
