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
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("openingfit:training-streak-updated"));
  return data;
}

export async function getWeeklyCoachingGoal(userId, options = {}) {
  requireUser(userId);
  const { data, error } = await cloudClient(options).rpc("get_weekly_coaching_goal");
  if (error) throw error;
  return { target: Math.max(1, Number(data?.target) || 3), completed: Math.max(0, Number(data?.completed) || 0), weekStart: data?.weekStart || null, weekEnd: data?.weekEnd || null, timezone: data?.timezone || "UTC" };
}

export async function getCoachingGameCheckpoint(userId, { platform, username, client } = {}) {
  requireUser(userId);
  if (!platform || !username) return null;
  const { data, error } = await cloudClient({ client }).from("coaching_game_checkpoints").select("platform,username,last_completed_at,last_imported_at,latest_platform_game_id,checked_game_ids").eq("user_id", userId).eq("platform", String(platform).toLowerCase()).eq("username", String(username).toLowerCase()).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getActiveCoachingResponsePlan(userId, { repertoireRole = null, client } = {}) {
  requireUser(userId);
  let query = cloudClient({ client }).from("coaching_response_plans").select("id,repertoire_role,opening_id,diagnosis_id,report_id,task_id,plan_text,updated_at").eq("user_id", userId).eq("status", "active").order("updated_at", { ascending: false }).limit(1);
  if (repertoireRole) query = query.eq("repertoire_role", repertoireRole);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function completeGameCheck({ userId, platform, username, checkedGameIds, idempotencyKey, payload = {}, latestPlatformGameId = null, lastImportedAt = null }, options = {}) {
  requireUser(userId);
  const ids = [...new Set((checkedGameIds || []).map(String).filter(Boolean))];
  if (!platform || !username || !ids.length || !idempotencyKey) throw new Error("A completed Game Check requires an account, stable game IDs and an idempotency key.");
  const { data, error } = await cloudClient(options).rpc("complete_game_check", { p_platform: String(platform).toLowerCase(), p_username: String(username).toLowerCase(), p_checked_game_ids: ids, p_idempotency_key: idempotencyKey, p_payload: payload, p_latest_platform_game_id: latestPlatformGameId, p_last_imported_at: lastImportedAt });
  if (error) throw error;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("openingfit:training-streak-updated"));
  return data;
}

export async function saveCoachingResponsePlan({ userId, repertoireRole, openingId = null, diagnosisId = null, reportId = null, taskId = null, planText }, options = {}) {
  requireUser(userId);
  const plan = String(planText || "").trim();
  if (!repertoireRole || !plan || plan.length > 4000) throw new Error("A role and a short response plan are required.");
  const safeReportId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(reportId || "")) ? reportId : null;
  const { data, error } = await cloudClient(options).rpc("save_coaching_response_plan", { p_repertoire_role: repertoireRole, p_opening_id: openingId, p_diagnosis_id: diagnosisId, p_report_id: safeReportId, p_task_id: taskId, p_plan_text: plan });
  if (error) throw error;
  return data;
}

export function countNewGamesSinceCheckpoint(games, checkpoint) {
  if (!checkpoint || !Array.isArray(games)) return null;
  const checked = new Set(Array.isArray(checkpoint.checked_game_ids) ? checkpoint.checked_game_ids.map(String) : []);
  const ids = games.map((game) => game?.id ?? game?.uuid ?? game?.game_id ?? game?.gameId ?? game?.url ?? game?.archive).filter(Boolean).map(String);
  if (!ids.length) return null;
  return new Set(ids.filter((id) => !checked.has(id))).size;
}

export function selectOwnerCoachingState({ userId, cloudState = null, anonymousState = null } = {}) {
  return userId ? { source: "cloud", state: cloudState } : { source: "anonymous_device", state: anonymousState };
}
