import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import {
  logSupabaseSyncFailure,
  logSupabaseSyncSuccess,
  logSupabaseSyncWarning,
} from "./supabaseSyncDebug";

export const USER_DATA_TABLES = [
  // Keep full cloud restore focused on the tables OpeningFit actually needs.
  // Restoring old/experimental tables makes startup slow and causes noisy 400s.
  "profiles",
  "premium_entitlements",
  "openingfit_user_state",
  "settings",
  "activity_history",
  "report_history",
  "analysis_history",
  "analysed_games",
  "recommendation_history",
  "saved_recommendations",
  "opening_preferences",
  "repertoire",
  "saved_openings",
  "chess_account_links",
  "notification_preferences",
];

export const USER_FILE_BUCKET = "user-uploads";
const DEBUG_CLOUD_RESTORE =
  typeof import.meta !== "undefined" &&
  import.meta.env?.VITE_DEBUG_CLOUD_RESTORE === "true";
const REQUIRED_RESTORE_TABLES = new Set([
  "profiles",
  "premium_entitlements",
  "openingfit_user_state",
  "settings",
  "report_history",
  "analysed_games",
]);
const DEFAULT_RESTORE_LIMIT = 50;
const RESTORE_TABLE_LIMITS = {
  premium_entitlements: 10,
  openingfit_user_state: 20,
  onboarding_answers: 20,
  measurements: 20,
  outfits: 20,
  favorites: 50,
  uploads: 20,
  ai_generations: 20,
  settings: 5,
  user_settings: 5,
  activity_history: 50,
  report_history: 20,
  analysis_history: 20,
  analysed_games: 50,
  recommendation_history: 50,
  saved_recommendations: 50,
  opening_preferences: 20,
  repertoire: 50,
  saved_openings: 50,
  chess_account_links: 10,
  notification_preferences: 10,
  user_profiles: 5,
  user_activity_log: 50,
  user_streaks: 5,
  user_goals: 20,
  user_achievements: 50,
  weekly_reports: 20,
};
const RESTORE_TABLE_COLUMNS = {
  // Use flexible selects for cloud restore.
  // Exact column lists make restore fragile: if Supabase is missing one column,
  // PostgREST rejects the whole table query with a 400.
  openingfit_user_state: "*",
  report_history: "*",
  analysis_history: "*",
  activity_history: "*",
  analysed_games: "*",
  uploads: "*",
  ai_generations: "*",
  user_profiles: "*",
  user_activity_log: "*",
  user_streaks: "*",
  user_goals: "*",
  user_achievements: "*",
  weekly_reports: "*",
};
const PROFILE_RESTORE_COLUMNS =
  "id,user_id,email,display_name,username,platform,chesscom_username,lichess_username,is_premium,last_report,created_at,updated_at";

function createDefaultUserData(profile = null) {
  return {
    profile,
    premium_entitlements: [],
    openingfit_user_state: [],
    onboarding_answers: [],
    measurements: [],
    outfits: [],
    favorites: [],
    uploads: [],
    ai_generations: [],
    settings: [],
    activity_history: [],
    report_history: [],
    analysed_games: [],
    recommendation_history: [],
    notification_preferences: [],
    user_profiles: [],
    user_activity_log: [],
    user_streaks: [],
    user_goals: [],
    user_achievements: [],
    weekly_reports: [],
  };
}

export function hasActivePremiumEntitlement(entitlements = [], profile = null) {
  const now = Date.now();
  const entitlementRows = entitlements || [];
  const activeEntitlement = entitlementRows.find((entitlement) => {
    if (String(entitlement?.status || "").toLowerCase() !== "active") return false;
    if (!entitlement.expires_at) return true;

    const expiresAt = Date.parse(entitlement.expires_at);
    return Number.isFinite(expiresAt) && expiresAt > now;
  });

  if (entitlementRows.length > 0) {
    return Boolean(activeEntitlement);
  }

  return Boolean(profile?.is_premium);
}

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

export function safeUserMessage(error, fallback = "OpeningFit could not reach Supabase. Please try again.") {
  const message = String(error?.message || error?.error_description || "");

  if (/already registered|already exists|user already/i.test(message)) {
    return "An account already exists for this email. Log in instead.";
  }

  if (/invalid login|invalid credentials/i.test(message)) {
    return "Wrong email or password. Please check both and try again.";
  }

  if (/email not confirmed|confirm.*email|email confirmation/i.test(message)) {
    return "Email confirmation required. Check your inbox, confirm your email, then log in.";
  }

  if (/security purposes|only request this after|rate limit|too many/i.test(message)) {
    return "We just sent an account email. Please wait a minute, then check your inbox or try logging in.";
  }

  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return "Supabase permission error. Please check RLS policies and try again.";
  }

  if (/failed to fetch|network|load failed|fetch|timeout|timed out/i.test(message) || error?.name === "TypeError") {
    return "Network error. Check your connection and try again.";
  }

  return message || fallback;
}

function logQueryFailure(table, operation, error, details = {}) {
  logSupabaseSyncFailure(table, operation, error, details);
}

function logQuerySuccess(table, operation, details = {}) {
  if (!DEBUG_CLOUD_RESTORE) {
    logSupabaseSyncSuccess(table, operation, details);
    return;
  }

  console.debug("OpeningFit Supabase sync succeeded", { table, operation, details });
}

function debugCloudRestore(message, details = {}) {
  if (!DEBUG_CLOUD_RESTORE) return;
  console.debug(`[OpeningFit cloud restore] ${message}`, details);
}

export async function runSupabaseQuery(queryPromise, options = {}) {
  const { required = false, label = "Supabase query" } = options;
  const result = await queryPromise;

  if (!result?.error) {
    return result;
  }

  if (required) {
    throw result.error;
  }

  logSupabaseSyncWarning("optional", label, result.error);

  return {
    data: null,
    error: result.error,
    skipped: true,
  };
}

async function selectProfileByUserId(userId, columns = "*") {
  const client = requireClient();
  const { data, error } = await client
    .from("profiles")
    .select(columns)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const message = String(error.message || "");
    if (/user_id|column/i.test(message) && /does not exist|schema cache/i.test(message)) {
      debugCloudRestore("profile user_id lookup unavailable; trying id fallback", { userId, message });
      return null;
    }

    logQueryFailure("profiles", "select profile by user_id", error, { userId });
    throw new Error(safeUserMessage(error, "Could not load your OpeningFit profile."));
  }

  debugCloudRestore("profile select by user_id completed", { userId, found: Boolean(data) });
  return data || null;
}

async function selectProfileByPrimaryId(userId, columns = "*") {
  const client = requireClient();
  const { data, error } = await client
    .from("profiles")
    .select(columns)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logQueryFailure("profiles", "select profile by id fallback", error, { userId });
    throw new Error(safeUserMessage(error, "Could not load your OpeningFit profile."));
  }

  debugCloudRestore("profile select by id fallback completed", { userId, found: Boolean(data) });
  return data || null;
}

async function loadExistingProfile(userId, columns = "*") {
  if (!userId) return null;
  return (await selectProfileByUserId(userId, columns)) || (await selectProfileByPrimaryId(userId, columns));
}

export async function ensureProfile(user, patch = {}) {
  if (!user?.id) return null;

  const client = requireClient();
  const cleanDisplayName = String(
    patch.display_name ||
      patch.displayName ||
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.email ||
      ""
  ).trim();
  const cleanUsername = String(
    patch.username ||
      user.user_metadata?.username ||
      user.user_metadata?.preferred_username ||
      ""
  ).trim();
  const displayName =
    cleanDisplayName ||
    user.email ||
    "";

  const existingProfile = await loadExistingProfile(user.id);

  const profilePatch = {
    email: patch.email ?? existingProfile?.email ?? user.email ?? "",
    display_name: patch.display_name ?? patch.displayName ?? existingProfile?.display_name ?? displayName,
    username: patch.username ?? existingProfile?.username ?? cleanUsername ?? null,
    platform: patch.platform ?? existingProfile?.platform ?? null,
    chesscom_username: patch.chesscom_username ?? existingProfile?.chesscom_username ?? "",
    lichess_username: patch.lichess_username ?? existingProfile?.lichess_username ?? "",
    is_premium: patch.is_premium ?? existingProfile?.is_premium ?? false,
    last_report: patch.last_report ?? existingProfile?.last_report ?? null,
    ...patch,
    id: patch.id || existingProfile?.id || user.id,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const profileNeedsUserIdBackfill = existingProfile && existingProfile.user_id !== user.id;

  if (existingProfile && !Object.keys(patch).length && !profileNeedsUserIdBackfill) {
    logQuerySuccess("profiles", "select existing profile before ensure upsert", {
      userId: user.id,
      rowId: existingProfile.id,
    });
    return existingProfile;
  }

  const { data, error } = await client
    .from("profiles")
    .upsert(
      profilePatch,
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) {
    logQueryFailure("profiles", "upsert profile by user_id", error, { userId: user.id });
    throw new Error(safeUserMessage(error, "Profile failed to save in Supabase."));
  }
  logQuerySuccess("profiles", "upsert profile by user_id", { userId: user.id, rowId: data?.id });
  return data;
}

export async function getCurrentUser() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();

  if (error) {
    logQueryFailure("auth.users", "get current user", error);
    throw new Error(safeUserMessage(error, "Could not confirm your Supabase login."));
  }

  logQuerySuccess("auth.users", "get current user", { userId: data?.user?.id || null });
  return data?.user || null;
}

export async function signUpWithEmailPassword({ email, password, displayName, username, redirectTo }) {
  const client = requireClient();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanDisplayName = String(displayName || username || cleanEmail).trim();
  const cleanUsername = String(username || "").trim();

  if (!cleanEmail || !password) {
    throw new Error("Enter an email and password.");
  }

  const { data, error } = await client.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        display_name: cleanDisplayName || cleanEmail,
        full_name: cleanDisplayName || cleanEmail,
        username: cleanUsername || undefined,
      },
    },
  });

  if (error) {
    logQueryFailure("auth.users", "sign up with email/password", error, { email: cleanEmail });
    throw new Error(safeUserMessage(error, "Could not create your OpeningFit account."));
  }

  const user = data?.user || data?.session?.user || null;
  if (user && Array.isArray(user.identities) && user.identities.length === 0) {
    throw new Error("An account already exists for this email. Log in instead.");
  }

  let profileError = null;
  if (user?.id && data?.session) {
    try {
      await ensureProfile(user, {
        display_name: cleanDisplayName || cleanEmail,
        username: cleanUsername || null,
      });
    } catch (error) {
      profileError = error;
      logQueryFailure("profiles", "ensure profile after sign up", error, { userId: user.id });
    }
  }

  logQuerySuccess("auth.users", "sign up with email/password", {
    email: cleanEmail,
    userId: user?.id || null,
    hasSession: Boolean(data?.session),
  });

  return {
    user,
    session: data?.session || null,
    needsEmailConfirmation: Boolean(user && !data?.session),
    profileError,
  };
}

export async function signInWithEmailPassword({ email, password }) {
  const client = requireClient();
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error("Enter an email and password.");
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    logQueryFailure("auth.users", "sign in with email/password", error, { email: cleanEmail });
    throw new Error(safeUserMessage(error, "Could not log in to OpeningFit."));
  }

  const confirmedUser = await getCurrentUser();
  if (!confirmedUser?.id) {
    throw new Error("Login started, but Supabase did not return a confirmed user.");
  }

  let profileError = null;
  try {
    await ensureProfile(confirmedUser);
  } catch (error) {
    profileError = error;
    logQueryFailure("profiles", "ensure profile after sign in", error, { userId: confirmedUser.id });
  }

  logQuerySuccess("auth.users", "sign in with email/password", {
    email: cleanEmail,
    userId: confirmedUser.id,
  });

  return {
    session: data?.session || null,
    user: confirmedUser,
    profileError,
  };
}

export async function getUserProfile(userId) {
  if (!userId) return null;

  const profile = await loadExistingProfile(userId);
  logQuerySuccess("profiles", "select profile by user key", { userId, found: Boolean(profile) });
  return profile;
}

export async function upsertUserProfile(user, patch = {}) {
  if (!user?.id) throw new Error("Missing Supabase user.");

  const [row] = await upsertUserRow(
    "profiles",
    user.id,
    {
      id: patch.id || user.id,
      email: user.email || patch.email || "",
      display_name:
        patch.display_name ||
        patch.displayName ||
        user.user_metadata?.full_name ||
        user.user_metadata?.display_name ||
        user.email ||
        "",
      ...patch,
    },
    { onConflict: "user_id" }
  );

  return row || null;
}

async function selectUserRows(table, userId, options = {}) {
  const client = requireClient();
  const limit = options.limit ?? RESTORE_TABLE_LIMITS[table] ?? DEFAULT_RESTORE_LIMIT;
  const columns = options.columns || RESTORE_TABLE_COLUMNS[table] || "*";
  const ordered = await client
    .from(table)
    .select(columns)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (!ordered.error) {
    logQuerySuccess(table, "select rows by user_id ordered by updated_at", {
      userId,
      limit,
      count: ordered.data?.length || 0,
    });
    return ordered.data || [];
  }

  if (/updated_at/i.test(ordered.error.message || "")) {
    const fallback = await client.from(table).select(columns).eq("user_id", userId).limit(limit);
    if (!fallback.error) {
      logQuerySuccess(table, "select rows by user_id without updated_at ordering", {
        userId,
        limit,
        count: fallback.data?.length || 0,
      });
      return fallback.data || [];
    }

    logQueryFailure(table, "select rows by user_id without updated_at ordering", fallback.error, {
      userId,
    });
    throw fallback.error;
  }

  logQueryFailure(table, "select rows by user_id ordered by updated_at", ordered.error, { userId });
  throw ordered.error;
}

export async function fetchAllUserData(user, options = {}) {
  if (!user?.id) return createDefaultUserData();

  let profile = null;
  try {
    profile = await loadExistingProfile(user.id, PROFILE_RESTORE_COLUMNS);
  } catch (profileError) {
    logQueryFailure("profiles", "select profile during full restore", profileError, {
      userId: user.id,
    });
    if (options.strict) {
      throw new Error(profileError?.message || "Profile failed to load from Supabase.");
    }
    console.warn("OpeningFit could not restore profile; using empty profile.", profileError);
  }

  const tableNames = USER_DATA_TABLES.filter((table) => table !== "profiles");
  const tableErrors = [];
  const results = await Promise.all(
    tableNames.map(async (table) => {
      try {
        return [table, await selectUserRows(table, user.id)];
      } catch (tableError) {
        logQueryFailure(table, "restore table during full restore", tableError, {
          userId: user.id,
        });
        tableErrors.push({ table, error: tableError });
        if (options.strict && REQUIRED_RESTORE_TABLES.has(table)) {
          return [table, null];
        }
        console.warn(`OpeningFit could not restore ${table}; using empty rows.`, tableError);
        return [table, []];
      }
    })
  );

  const requiredTableErrors = tableErrors.filter((item) => REQUIRED_RESTORE_TABLES.has(item.table));

  if (options.strict && requiredTableErrors.length) {
    const first = requiredTableErrors[0];
    const error = new Error(
      safeUserMessage(first.error, `Could not restore ${first.table} from Supabase.`)
    );
    error.table = first.table;
    error.cause = first.error;
    throw error;
  }

  const restored = {
    ...createDefaultUserData(profile),
    ...Object.fromEntries(results),
  };

  return {
    ...restored,
    hasPremiumAccess: hasActivePremiumEntitlement(restored.premium_entitlements, profile),
  };
}

export async function upsertUserRow(table, userId, row, options = {}) {
  if (!userId) throw new Error("Missing user id.");

  const client = requireClient();
  const { required = true, ...upsertOptions } = options;
  const payload = {
    ...row,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error, skipped } = await runSupabaseQuery(
    client
      .from(table)
      .upsert(payload, upsertOptions)
      .select("*"),
    {
      required,
      label: `${table} upsert row`,
    }
  );

  if (skipped) {
    return [];
  }

  if (error) {
    logQueryFailure(table, "upsert row", error, { userId, row, options });
    throw new Error(safeUserMessage(error, `Could not save ${table}.`));
  }
  logQuerySuccess(table, "upsert row", { userId, count: data?.length || 0, options });
  return data;
}

export async function deleteUserRow(table, userId, id) {
  if (!userId || !id) throw new Error("Missing delete target.");

  const client = requireClient();
  const { error } = await client
    .from(table)
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) {
    logQueryFailure(table, "delete row by user_id and id", error, { userId, id });
    throw new Error(safeUserMessage(error, `Could not delete ${table}.`));
  }
  logQuerySuccess(table, "delete row by user_id and id", { userId, id });
}

export async function getSettings(userId) {
  if (!userId) return {};

  const client = requireClient();
  const { data, error } = await client
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logQueryFailure("settings", "select settings by user_id", error, { userId });
    throw new Error(safeUserMessage(error, "Could not load saved settings from Supabase."));
  }
  logQuerySuccess("settings", "select settings by user_id", { userId, found: Boolean(data) });
  return data || {};
}

export const loadUserSettings = getSettings;

export async function saveSettings(userId, patch) {
  if (!userId) return null;

  const current = await getSettings(userId);
  const nextPreferences = {
    ...(current.preferences || {}),
    ...(patch.preferences || {}),
  };

  const [row] = await upsertUserRow(
    "settings",
    userId,
    {
      ...(current.id ? { id: current.id } : {}),
      theme: patch.theme ?? current.theme ?? null,
      preferences: nextPreferences,
    },
    { onConflict: "user_id" }
  );

  return row;
}

export const saveUserSettings = saveSettings;

export async function loadAnalysisHistory(userId) {
  if (!userId) return [];
  return selectUserRows("report_history", userId);
}

export async function saveAnalysisHistory(userId, report, summary = {}) {
  return saveReport(userId, report, summary);
}

export async function loadOpeningRecommendations(userId) {
  if (!userId) return [];
  return selectUserRows("recommendation_history", userId);
}

export async function saveOpeningRecommendations(userId, snapshot = {}) {
  return saveRecommendationHistory(userId, snapshot);
}

export async function saveReport(userId, report, summary = {}) {
  if (!userId || !report) return null;

  const username =
    summary.username ||
    report.username ||
    report.playerName ||
    report.player_name ||
    "Unknown player";
  const platform = summary.platform || report.platform || report.importPlatform || "unknown";
  const games =
    summary.games ||
    report.gamesImported ||
    report.games_imported ||
    report.totalGames ||
    report.total_games ||
    "recent";
  const importedAt =
    summary.importedAt ||
    summary.savedAt ||
    report.importedAt ||
    report.imported_at ||
    report.lastUpdated ||
    report.last_updated ||
    "";
  const months =
    summary.months ||
    report.monthsChecked ||
    report.months_checked ||
    report.importMonths ||
    report.import_months ||
    "recent";
  const analysisTimeFormat =
    summary.analysisTimeFormat ||
    summary.analysis_time_format ||
    report.analysisTimeFormat ||
    report.analysis_time_format ||
    "custom";
  const reportKey = [
    String(platform).toLowerCase(),
    String(username).toLowerCase(),
    String(months),
    String(analysisTimeFormat).toLowerCase(),
    String(games),
    String(importedAt).slice(0, 19),
  ].join(":");

  const client = requireClient();
  const basePayload = {
    user_id: userId,
    username,
    platform,
    summary,
    report,
    report_key: reportKey,
    updated_at: new Date().toISOString(),
  };
  const payload = {
    ...basePayload,
    analysis_time_format: analysisTimeFormat,
    effective_time_format:
      summary.effectiveTimeFormat ||
      summary.effective_time_format ||
      report.effectiveTimeFormat ||
      report.effective_time_format ||
      analysisTimeFormat,
    detected_time_format:
      summary.detectedTimeFormat ||
      summary.detected_time_format ||
      report.detectedTimeFormat ||
      report.detected_time_format ||
      null,
    style_profile:
      summary.styleProfile ||
      summary.style_profile ||
      report.styleProfile ||
      report.style_profile ||
      null,
    style_based_recommendations:
      summary.styleBasedRecommendations ||
      summary.style_based_recommendations ||
      report.styleBasedRecommendations ||
      report.style_based_recommendations ||
      null,
  };

  let activePayload = payload;
  let { data, error } = await client.from("report_history").insert(payload).select("*").single();

  if (
    error &&
    (
      error.code === "PGRST204" ||
      /analysis_time_format|effective_time_format|detected_time_format|style_profile|style_based_recommendations/i.test(error.message || "")
    )
  ) {
    logQueryFailure("report_history", "insert report with time-format columns unavailable; retrying JSON-only save", error, {
      userId,
      reportKey,
    });

    const retry = await client.from("report_history").insert(basePayload).select("*").single();
    activePayload = basePayload;
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await client
        .from("report_history")
        .update({
          ...activePayload,
          user_id: userId,
          report_key: reportKey,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("report_key", reportKey)
        .select("*")
        .maybeSingle();

      if (existingError) {
        logQueryFailure("report_history", "update existing report after dedupe collision", existingError, {
          userId,
          reportKey,
        });
        throw new Error(safeUserMessage(existingError, "Could not update saved report in Supabase."));
      }

      logQuerySuccess("report_history", "update existing report after dedupe collision", {
        userId,
        reportKey,
        rowId: existing?.id,
      });
      return existing;
    }

    logQueryFailure("report_history", "insert report with dedupe key", error, { userId, reportKey });
    throw new Error(safeUserMessage(error, "Could not save report to Supabase."));
  }

  logQuerySuccess("report_history", "insert report with dedupe key", {
    userId,
    reportKey,
    rowId: data?.id,
  });
  return data;
}

export async function saveRecommendationHistory(userId, snapshot = {}) {
  if (!userId || !snapshot) return null;

  const client = requireClient();
  const progress = snapshot.progress || {};
  const analysisDate = snapshot.analysisDate || snapshot.analysis_date || new Date().toISOString();
  const timeControlFilter =
    snapshot.timeControlFilter || snapshot.time_control_filter || snapshot.analysisTimeFormat || "custom";
  const snapshotKey = String(
    snapshot.snapshotKey ||
      snapshot.snapshot_key ||
      [
        progress.platform || snapshot.platform || "unknown",
        progress.username || snapshot.username || "unknown",
        String(analysisDate).slice(0, 19),
        snapshot.gamesAnalysed ?? snapshot.games_analyzed ?? snapshot.games_analysed ?? 0,
        timeControlFilter,
        snapshot.currentRecommendation || snapshot.current_recommendation || "",
      ].join(":")
  );
  const payload = {
    user_id: userId,
    snapshot_key: snapshotKey,
    analysis_date: analysisDate,
    games_analysed:
      Number(snapshot.gamesAnalysed ?? snapshot.games_analyzed ?? snapshot.games_analysed ?? 0) || 0,
    detected_openings: snapshot.detectedOpenings || snapshot.detected_openings || [],
    recommended_openings: snapshot.recommendedOpenings || snapshot.recommended_openings || [],
    confidence_score:
      snapshot.confidenceScore ?? snapshot.confidence_score ?? snapshot.repertoireConfidenceScore ?? null,
    style_profile: snapshot.styleProfile || snapshot.style_profile || null,
    time_control_filter: timeControlFilter,
    analysis_version: snapshot.analysisVersion || snapshot.analysis_version || "retention-history-v1",
    snapshot,
    updated_at: new Date().toISOString(),
  };

  let activePayload = payload;
  let { data, error } = await client
    .from("recommendation_history")
    .upsert(payload, { onConflict: "user_id,snapshot_key" })
    .select("*")
    .single();

  if (
    error &&
    (
      error.code === "PGRST204" ||
      /snapshot_key|user_id,snapshot_key/i.test(error.message || "")
    )
  ) {
    activePayload = { ...payload };
    delete activePayload.snapshot_key;
    const retry = await client
      .from("recommendation_history")
      .insert(activePayload)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    logQueryFailure("recommendation_history", "insert recommendation snapshot", error, {
      userId,
      snapshot,
    });
    throw new Error(safeUserMessage(error, "Could not save recommendations to Supabase."));
  }

  logQuerySuccess("recommendation_history", "insert recommendation snapshot", {
    userId,
    rowId: data?.id,
  });
  return data;
}

function stableGameId(game, index) {
  const raw =
    game?.game_id ||
    game?.gameId ||
    game?.id ||
    game?.url ||
    game?.link ||
    game?.pgn ||
    JSON.stringify(game || {});
  const input = String(raw || `game-${index}`);
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }

  return String(game?.game_id || game?.gameId || game?.id || game?.url || `game-${index}-${hash}`);
}

function extractAnalysedGames(report = {}) {
  const candidates = [
    report.analysed_games,
    report.analyzed_games,
    report.analysedGames,
    report.analyzedGames,
    report.imported_games,
    report.importedGames,
    report.recent_games,
    report.recentGames,
    report.games,
  ];

  return candidates.find((value) => Array.isArray(value) && value.some((item) => item && typeof item === "object")) || [];
}

export async function saveAnalysedGames(userId, report = {}, summary = {}) {
  if (!userId || !report) return [];

  const games = extractAnalysedGames(report).slice(0, 80);
  if (!games.length) return [];

  const client = requireClient();
  const platform = summary.platform || report.platform || report.importPlatform || report.import_platform || "unknown";
  const username =
    summary.username ||
    report.username ||
    report.playerName ||
    report.player_name ||
    "Unknown player";
  const now = new Date().toISOString();
  const rows = games.map((game, index) => ({
    user_id: userId,
    platform,
    username,
    game_id: stableGameId(game, index),
    game,
    analysis: {
      opening: game.opening || game.eco || game.detected_opening || null,
      result: game.result || game.user_result || null,
      colour: game.colour || game.color || null,
      saved_from_report: true,
    },
    updated_at: now,
  }));

  const { data, error } = await client
    .from("analysed_games")
    .upsert(rows, { onConflict: "user_id,platform,username,game_id" })
    .select("*");

  if (error) {
    logQueryFailure("analysed_games", "upsert analysed games", error, {
      userId,
      platform,
      username,
      count: rows.length,
    });
    throw new Error(safeUserMessage(error, "Could not save analysed games to Supabase."));
  }

  logQuerySuccess("analysed_games", "upsert analysed games", {
    userId,
    platform,
    username,
    count: data?.length || 0,
  });
  return data || [];
}

export async function recordActivity(userId, type, payload = {}) {
  if (!userId || !type) return null;

  const client = requireClient();
  const dedupeKey = payload.dedupe_key || payload.dedupeKey || null;
  const { data, error } = await client
    .from("activity_history")
    .insert({
      user_id: userId,
      type,
      action_type: type,
      points: Number(payload.points || payload.xp || 0) || 0,
      related_report_id: payload.related_report_id || null,
      dedupe_key: dedupeKey,
      payload,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return null;
    logQueryFailure("activity_history", "insert activity with dedupe key", error, { userId, type, dedupeKey });
    throw error;
  }

  return data;
}

export async function uploadUserFile(userId, file, pathPrefix = "uploads") {
  if (!userId || !file) throw new Error("Missing upload data.");

  const client = requireClient();
  const cleanName = String(file.name || "upload").replace(/[^a-z0-9._-]/gi, "-");
  const path = `users/${userId}/${pathPrefix}/${Date.now()}-${cleanName}`;

  const { error: uploadError } = await client.storage
    .from(USER_FILE_BUCKET)
    .upload(path, file, { upsert: false });

  if (uploadError) throw uploadError;

  const { data: signedData, error: signedError } = await client.storage
    .from(USER_FILE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  if (signedError) throw signedError;

  const [row] = await upsertUserRow("uploads", userId, {
    bucket: USER_FILE_BUCKET,
    path,
    url: signedData?.signedUrl || null,
    metadata: {
      name: file.name,
      type: file.type,
      size: file.size,
    },
  });

  return row;
}
