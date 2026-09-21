import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthDataProvider.jsx";
import { reminderLocalDate, selectCoachingReminder, showCoachingReminder } from "../lib/coachingReminders.js";
import { getTrainingStreak } from "../services/trainingStreakService.js";

const normalise = (row = {}) => ({
  remindersEnabled: row.reminders_enabled === true,
  gameCheckReminders: row.game_check_reminders !== false,
  weeklyPlanReminders: row.weekly_plan_reminders !== false,
  consistencyReminders: row.consistency_reminders !== false,
  missionReminders: row.mission_reminders === true,
  timezone: row.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  quietHoursStart: Number(row.quiet_hours_start ?? 21),
  quietHoursEnd: Number(row.quiet_hours_end ?? 8),
  lastReminderDate: row.last_reminder_date || null,
  permissionRequestedAt: row.permission_requested_at,
});

export default function CoachingReminderSettings({ consistency, weeklyGoal, newGames = 0 }) {
  const { user, notificationPreferences, upsertUserData } = useAuth();
  const stored = useMemo(() => notificationPreferences?.[0] || {}, [notificationPreferences]);
  const [preferences, setPreferences] = useState(() => normalise(stored));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [canonicalConsistency, setCanonicalConsistency] = useState(consistency);
  const handledReminder = useRef("");
  useEffect(() => setPreferences(normalise(stored)), [stored]);
  useEffect(() => { let active = true; if (user?.id) getTrainingStreak(user.id).then((value) => { if (active) setCanonicalConsistency(value); }).catch(() => {}); return () => { active = false; }; }, [user?.id]);
  const eligibleToAsk = Boolean(user?.id && (canonicalConsistency?.currentStreak > 0 || Number(weeklyGoal?.completed) > 0));
  const reminder = useMemo(() => selectCoachingReminder({ preferences: normalise(stored), newGames, weekly: weeklyGoal, consistency: canonicalConsistency }), [canonicalConsistency, newGames, stored, weeklyGoal]);

  const save = async (patch) => {
    const next = { ...preferences, ...patch };
    if (patch.remindersEnabled) next.permissionRequestedAt = new Date().toISOString();
    setPreferences(next);
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      await upsertUserData("notification_preferences", {
      reminders_enabled: next.remindersEnabled,
      game_check_reminders: next.gameCheckReminders,
      weekly_plan_reminders: next.weeklyPlanReminders,
      consistency_reminders: next.consistencyReminders,
      mission_reminders: next.missionReminders,
      timezone: next.timezone,
      quiet_hours_start: next.quietHoursStart,
      quiet_hours_end: next.quietHoursEnd,
      permission_requested_at: next.permissionRequestedAt,
    }, { onConflict: "user_id" });
      setMessage("Reminder preferences saved.");
      return true;
    } catch (error) {
      setSaveError(error?.message || "Reminder preferences could not be saved. Retry to save your changes.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const enable = async () => {
    let permission = "in-app";
    try {
      if (globalThis.Notification?.requestPermission) permission = await globalThis.Notification.requestPermission();
      if (await save({ remindersEnabled: permission !== "denied" })) {
        setMessage(permission === "granted" ? "Reminders enabled." : permission === "denied" ? "Notifications remain off. You can enable them later." : "In-app reminders enabled while OpeningFit is open.");
      }
    } catch {
      setSaveError("Notification permission could not be requested. Please try again.");
    }
  };

  useEffect(() => {
    if (!reminder || handledReminder.current === `${reminder.type}:${reminder.route}`) return;
    handledReminder.current = `${reminder.type}:${reminder.route}`;
    void showCoachingReminder(reminder).then(() => upsertUserData("notification_preferences", { last_reminder_date: reminderLocalDate(new Date(), preferences.timezone), last_reminder_type: reminder.type }, { onConflict: "user_id" })).catch(() => {});
  }, [preferences.timezone, reminder, upsertUserData]);

  if (!user?.id || !eligibleToAsk) return null;
  return (
    <details className="coachingReminderSettings">
      <summary>Reminders</summary>
      <p>OpeningFit can remind you about new games, one weekly session, or an at-risk consistency day. It sends at most one reminder per day and never includes your chess username.</p>
      <label><input type="checkbox" disabled={saving} checked={preferences.remindersEnabled} onChange={(event) => event.target.checked ? void enable() : void save({ remindersEnabled: false })} /> Enable reminders</label>
      {preferences.remindersEnabled ? <fieldset disabled={saving}><legend>Reminder types</legend>
        <label><input type="checkbox" checked={preferences.gameCheckReminders} onChange={(event) => void save({ gameCheckReminders: event.target.checked })} /> New games ready</label>
        <label><input type="checkbox" checked={preferences.weeklyPlanReminders} onChange={(event) => void save({ weeklyPlanReminders: event.target.checked })} /> Weekly plan</label>
        <label><input type="checkbox" checked={preferences.consistencyReminders} onChange={(event) => void save({ consistencyReminders: event.target.checked })} /> At-risk consistency</label>
        <label><input type="checkbox" checked={preferences.missionReminders} onChange={(event) => void save({ missionReminders: event.target.checked })} /> Opening Missions (delivery is not enabled during beta setup)</label>
        <p>Quiet hours: 21:00–08:00 · {preferences.timezone}</p>
      </fieldset> : null}
      {reminder ? <a href={reminder.route}>{reminder.body}</a> : null}
      {message ? <p role="status">{message}</p> : null}
      {saving ? <p role="status">Saving reminder preferences...</p> : null}
      {saveError ? <div role="alert"><p>Unsaved changes. {saveError}</p><button type="button" disabled={saving} onClick={() => void save({})}>Retry reminder save</button></div> : null}
    </details>
  );
}
