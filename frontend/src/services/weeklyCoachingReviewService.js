import { supabase } from "../lib/supabaseClient.js";

export async function saveWeeklyCoachingReview(userId, review, { client = supabase } = {}) {
  if (!userId || !review?.id || !review?.weekStart) return null;
  const row = { user_id: userId, week_start: review.weekStart, review_key: review.id, report_id: /^[0-9a-f-]{36}$/i.test(review.reportId || "") ? review.reportId : null, payload: review, status: "ready" };
  const { data, error } = await client.from("coaching_weekly_reviews").upsert(row, { onConflict: "user_id,week_start", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listWeeklyCoachingReviews(userId, { limit = 12, client = supabase } = {}) {
  if (!userId) return [];
  const { data, error } = await client.from("coaching_weekly_reviews").select("*").eq("user_id", userId).order("week_start", { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}
