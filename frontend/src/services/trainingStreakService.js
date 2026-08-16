import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

export const QUALIFYING_STREAK_ACTIVITIES = Object.freeze({
  ANALYSIS_COMPLETED: "analysis_completed",
  TODAY_TRAINING_COMPLETED: "today_training_completed",
  TRAINING_TASK_COMPLETED: "training_task_completed",
  REPAIR_REVIEW_COMPLETED: "repair_review_completed",
});

const ALLOWED_ACTIVITIES = new Set(Object.values(QUALIFYING_STREAK_ACTIVITIES));
export const TRAINING_STREAK_UPDATED_EVENT = "openingfit:training-streak-updated";

export function emptyTrainingStreak() {
  return { currentStreak: 0, longestStreak: 0, completedToday: false, lastQualifiedDate: null, lastQualifiedAt: null, timezone: "UTC" };
}

function normaliseStreak(value) {
  const row = value && typeof value === "object" ? value : {};
  return {
    currentStreak: Math.max(0, Number(row.currentStreak ?? row.current_streak) || 0),
    longestStreak: Math.max(0, Number(row.longestStreak ?? row.longest_streak) || 0),
    completedToday: Boolean(row.completedToday ?? row.completed_today),
    lastQualifiedDate: row.lastQualifiedDate ?? row.last_qualified_date ?? null,
    lastQualifiedAt: row.lastQualifiedAt ?? row.last_qualified_at ?? null,
    timezone: "UTC",
  };
}

function requireAccount(userId, client) {
  if (!userId) throw new Error("Sign in to use a training streak.");
  if (!client) throw new Error("Training streak sync is unavailable.");
}

export async function getTrainingStreak(userId, options = {}) {
  const client = options.client ?? (isSupabaseConfigured ? supabase : null);
  requireAccount(userId, client);
  const { data, error } = await client.rpc("get_training_streak");
  if (error) throw error;
  return normaliseStreak(data);
}

export async function recordQualifiedActivity({ userId, activityType, sourceId }, options = {}) {
  const client = options.client ?? (isSupabaseConfigured ? supabase : null);
  requireAccount(userId, client);
  if (!ALLOWED_ACTIVITIES.has(activityType)) throw new Error("Unsupported qualifying streak activity.");
  const stableSourceId = String(sourceId || "").trim();
  if (!stableSourceId || stableSourceId.length > 200) throw new Error("A stable streak activity source is required.");
  const { data, error } = await client.rpc("record_qualified_streak_activity", {
    p_activity_type: activityType,
    p_source_id: stableSourceId,
  });
  if (error) throw error;
  const streak = normaliseStreak(data);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(TRAINING_STREAK_UPDATED_EVENT, { detail: streak }));
  return streak;
}
