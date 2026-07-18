import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { adaptReportHistoryRow } from "../lib/reportSnapshot.js";
import { buildWeeklyTrainingPlan, isReusableWeeklyPlan, weeklyPlanWindow } from "../lib/weeklyTrainingPlan.js";
import { getActiveRepertoire } from "./repertoireService.js";

function requireUser(userId) {
  if (!String(userId || "").trim()) throw new Error("Sign in to use a saved weekly training plan.");
}

function clientFor(options = {}) {
  if (options.client) return options.client;
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function serviceError(error, fallback) {
  return new Error(String(error?.message || fallback));
}

export function weeklyPlanFromRow(row = {}) {
  return {
    schemaVersion: Number(row.schema_version || 1),
    id: row.id,
    userId: row.user_id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    reportId: row.report_id,
    status: row.status,
    primaryGoal: row.primary_goal,
    reason: row.reason,
    estimatedMinutes: row.estimated_minutes,
    targetMetric: row.target_metric || {},
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
    completionPercent: row.completion_percent || 0,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function validSnapshot(snapshot = {}) {
  return Boolean(
    snapshot.report_id &&
    snapshot.source_platform &&
    snapshot.source_platform !== "demo" &&
    snapshot.source_username &&
    Number(snapshot.total_games_analysed || 0) > 0
  );
}

export async function getLatestValidTrainingReport(userId, options = {}) {
  requireUser(userId);
  if (options.report) return { report: options.report, reportId: options.reportId || options.report.report_id || options.report.id || null };
  const client = clientFor(options);
  const { data, error } = await client.from("report_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw serviceError(error, "Could not load the latest report for training.");
  const report = (data || []).map((row) => adaptReportHistoryRow(row)).find(validSnapshot) || null;
  return { report, reportId: report?.report_id || null };
}

export async function getCurrentWeeklyTrainingPlan(userId, options = {}) {
  requireUser(userId);
  const client = clientFor(options);
  const { weekStart } = weeklyPlanWindow(options.now || new Date());
  const { data, error } = await client
    .from("weekly_training_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw serviceError(error, "Could not load this week's training plan.");
  return data ? weeklyPlanFromRow(data) : null;
}

export async function getOrCreateWeeklyTrainingPlan(userId, options = {}) {
  requireUser(userId);
  const client = clientFor(options);
  const [{ report, reportId }, repertoire, current] = await Promise.all([
    getLatestValidTrainingReport(userId, { ...options, client }),
    options.repertoire ? Promise.resolve(options.repertoire) : getActiveRepertoire(userId, { client }),
    options.currentPlan !== undefined ? Promise.resolve(options.currentPlan) : getCurrentWeeklyTrainingPlan(userId, { ...options, client }),
  ]);
  if (!report) return { state: "missing-report", plan: current || null, reused: Boolean(current) };

  const { weekStart } = weeklyPlanWindow(options.now || new Date());
  if (isReusableWeeklyPlan(current, { weekStart, reportId, forceRefresh: options.forceRefresh })) {
    return { state: "reused", plan: current, reused: true };
  }

  const generated = buildWeeklyTrainingPlan({ userId, report, repertoire, reportId, now: options.now || new Date(), preferences: options.preferences });
  if (!generated.plan) return { ...generated, reused: false };
  const { data, error } = await client.rpc("save_weekly_training_plan", {
    p_plan: generated.plan,
    p_force_refresh: Boolean(options.forceRefresh),
  });
  if (error) throw serviceError(error, "Could not save this week's training plan.");
  return { state: current?.reportId && current.reportId !== reportId ? "regenerated-for-report" : "created", plan: weeklyPlanFromRow(data), reused: false };
}

export async function setWeeklyTrainingTaskCompletion(userId, planId, taskId, completed = true, options = {}) {
  requireUser(userId);
  if (!planId || !taskId) throw new Error("Choose a weekly training task to update.");
  const { data, error } = await clientFor(options).rpc("set_weekly_training_task_status", {
    p_plan_id: planId,
    p_task_id: taskId,
    p_completed: Boolean(completed),
  });
  if (error) throw serviceError(error, "Could not update that training task.");
  return weeklyPlanFromRow(data);
}

export async function completeWeeklyTrainingPlan(userId, planId, options = {}) {
  requireUser(userId);
  if (!planId) throw new Error("Choose a weekly training plan to complete.");
  const { data, error } = await clientFor(options).rpc("complete_weekly_training_plan", { p_plan_id: planId });
  if (error) throw serviceError(error, "Could not complete this week's training plan.");
  return weeklyPlanFromRow(data);
}
