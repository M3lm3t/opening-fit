type JsonObject = Record<string, unknown>;

const LOCAL_RETENTION_EVENT_KEY = "openingFit:legacyRetentionEvents";

function readLocalRetentionEvents(): JsonObject[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_RETENTION_EVENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalRetentionEvents(events: JsonObject[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCAL_RETENTION_EVENT_KEY, JSON.stringify(events.slice(0, 50)));
  } catch {
    // Retention logging should never block the app.
  }
}

// Deprecated Supabase tables intentionally no longer queried here:
// user_profiles, user_activity_log, user_streaks, user_goals,
// user_achievements, weekly_reports.
// Current retention/report persistence lives in userDataService.js via
// openingfit_retention_snapshots, activity_history, report_history, and
// openingfit_user_state. This module only keeps the local activity event
// logger used by retentionEvents.js.

export async function logUserActivity(
  activityType: string,
  points: number,
  metadata: JsonObject = {}
) {
  if (!activityType) return null;

  const event = {
    id: `${activityType}:${Date.now()}`,
    activity_type: activityType,
    points: Number.isFinite(points) ? points : 0,
    metadata,
    created_at: new Date().toISOString(),
  };
  writeLocalRetentionEvents([event, ...readLocalRetentionEvents()]);
  return event;
}
