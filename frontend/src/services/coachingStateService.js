import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

/** @typedef {'training_session_completed'|'source_game_review_completed'|'response_plan_saved'|'response_plan_recalled'|'game_check_completed'|'position_review_completed'} CoachingActivityType */
/** @typedef {'ready'|'in_progress'|'completed'|'superseded'|'unavailable'} CoachingPriorityStatus */
/** @typedef {{id:string,userId:string,reportId:string|null,diagnosisId:string|null,decisionId:string|null,recommendationId:string|null,repertoireRole:string,openingId:string|null,openingName:string|null,taskId:string,status:CoachingPriorityStatus,evidenceRefs:Record<string,unknown>,createdAt:string|null,completedAt:string|null}} CoachingPriority */

export const MEANINGFUL_COACHING_ACTIVITIES = Object.freeze([
  "training_session_completed", "source_game_review_completed", "response_plan_saved",
  "response_plan_recalled", "game_check_completed", "position_review_completed",
]);
const ACTIVITY_TYPES = new Set(MEANINGFUL_COACHING_ACTIVITIES);

function cloudClient(options = {}) {
  const client = options.client ?? (isSupabaseConfigured ? supabase : null);
  if (!client) throw new Error("Coaching sync is unavailable.");
  return client;
}

function requireUser(userId) {
  if (!String(userId || "").trim()) throw new Error("Sign in to use cloud coaching progress.");
}

/** @returns {CoachingPriority|null} */
export function coachingPriorityFromRow(row) {
  if (!row?.id || !row?.task_id || !row?.repertoire_role) return null;
  return { id: row.id, userId: row.user_id, reportId: row.report_id || null, diagnosisId: row.diagnosis_id || null, decisionId: row.decision_id || null, recommendationId: row.recommendation_id || null, repertoireRole: row.repertoire_role, openingId: row.opening_id || null, openingName: row.opening_name || null, taskId: row.task_id, status: row.status || "unavailable", evidenceRefs: row.evidence_refs || {}, createdAt: row.created_at || null, completedAt: row.completed_at || null };
}

export async function getCurrentCoachingPriority(userId, options = {}) {
  requireUser(userId);
  const { data, error } = await cloudClient(options).rpc("get_current_coaching_priority");
  if (error) throw error;
  return coachingPriorityFromRow(data);
}

export async function recordMeaningfulCoachingActivity({ userId, activityType, idempotencyKey, payload = {}, occurredAt = null }, options = {}) {
  requireUser(userId);
  if (!ACTIVITY_TYPES.has(activityType)) throw new Error("Unsupported meaningful coaching activity.");
  const stableKey = String(idempotencyKey || "").trim();
  if (!stableKey || stableKey.length > 200) throw new Error("A stable idempotency key is required.");
  const { data, error } = await cloudClient(options).rpc("record_meaningful_coaching_activity", { p_activity_type: activityType, p_idempotency_key: stableKey, p_payload: payload, p_occurred_at: occurredAt });
  if (error) throw error;
  return data;
}

export async function getWeeklyCoachingGoal(userId, options = {}) {
  requireUser(userId);
  const { data, error } = await cloudClient(options).rpc("get_weekly_coaching_goal");
  if (error) throw error;
  return { target: Math.max(1, Number(data?.target) || 3), completed: Math.max(0, Number(data?.completed) || 0), weekStart: data?.weekStart || null, weekEnd: data?.weekEnd || null, timezone: data?.timezone || "UTC" };
}

export function selectOwnerCoachingState({ userId, cloudState = null, anonymousState = null } = {}) {
  return userId ? { source: "cloud", state: cloudState } : { source: "anonymous_device", state: anonymousState };
}
