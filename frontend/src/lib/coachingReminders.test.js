import test from "node:test";
import assert from "node:assert/strict";
import { REMINDER_TYPES, selectCoachingReminder } from "./coachingReminders.js";

const enabled = { remindersEnabled: true, timezone: "Europe/London", quietHoursStart: 21, quietHoursEnd: 8 };
test("reminders require opt-in and respect quiet hours", () => {
  assert.equal(selectCoachingReminder({ preferences: {}, newGames: 6 }), null);
  assert.equal(selectCoachingReminder({ preferences: enabled, newGames: 6, now: new Date("2026-08-20T22:00:00Z") }), null);
});
test("only one priority reminder is selected per local day", () => {
  const reminder = selectCoachingReminder({ preferences: enabled, newGames: 6, weekly: { completed: 1, target: 3 }, consistency: { status: "at_risk" }, now: new Date("2026-08-20T12:00:00Z") });
  assert.equal(reminder.type, REMINDER_TYPES.GAME_CHECK);
  assert.equal(selectCoachingReminder({ preferences: { ...enabled, lastReminderDate: "2026-08-20" }, newGames: 6, now: new Date("2026-08-20T12:00:00Z") }), null);
});
test("copy is private and routes are shared deep links", () => {
  const reminder = selectCoachingReminder({ preferences: enabled, weekly: { completed: 1, target: 3 }, now: new Date("2026-08-20T12:00:00Z") });
  assert.equal(reminder.route, "/train");
  assert.doesNotMatch(reminder.body, /username|chess\.com|lichess/i);
});
