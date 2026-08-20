export const REMINDER_TYPES = Object.freeze({ GAME_CHECK: "game_check", WEEKLY_PLAN: "weekly_plan", CONSISTENCY: "consistency" });

const hourInZone = (now, timezone) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone || "UTC", hour: "2-digit", hourCycle: "h23" }).format(now));
export const reminderLocalDate = (now, timezone) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const inQuietHours = (hour, start, end) => start === end ? false : start > end ? hour >= start || hour < end : hour >= start && hour < end;

export function selectCoachingReminder({ preferences = {}, newGames = 0, weekly = null, consistency = null, now = new Date() } = {}) {
  if (!preferences.remindersEnabled) return null;
  const timezone = preferences.timezone || "UTC";
  const today = reminderLocalDate(now, timezone);
  if (preferences.lastReminderDate === today || inQuietHours(hourInZone(now, timezone), Number(preferences.quietHoursStart ?? 21), Number(preferences.quietHoursEnd ?? 8))) return null;
  if (preferences.gameCheckReminders !== false && Number(newGames) > 0) return { type: REMINDER_TYPES.GAME_CHECK, title: "OpeningFit", body: `${Number(newGames)} new game${Number(newGames) === 1 ? " is" : "s are"} ready to check.`, route: "/dashboard?game-check=1" };
  if (preferences.weeklyPlanReminders !== false && weekly && Number(weekly.completed) < Number(weekly.target || 3)) return { type: REMINDER_TYPES.WEEKLY_PLAN, title: "OpeningFit", body: "Your next opening session is ready.", route: "/train" };
  if (preferences.consistencyReminders !== false && consistency?.status === "at_risk") return { type: REMINDER_TYPES.CONSISTENCY, title: "OpeningFit", body: "One short session keeps this week’s goal moving.", route: "/train" };
  return null;
}

export async function showCoachingReminder(reminder, { notifications = globalThis.Notification } = {}) {
  if (!reminder || !notifications || notifications.permission !== "granted") return { shown: false, reason: "in_app_only" };
  const notification = new notifications(reminder.title, { body: reminder.body, tag: `openingfit:${reminder.type}`, data: { route: reminder.route } });
  notification.onclick = () => { globalThis.focus?.(); globalThis.location.assign(reminder.route); };
  return { shown: true };
}
