import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import {
  logSupabaseSyncFailure,
  logSupabaseSyncSuccess,
  logSupabaseSyncWarning,
} from "./supabaseSyncDebug";

export const USER_DATA_TABLES = [
  // Keep full cloud restore focused on the tables the app actually reads from
  // AuthDataProvider. Old/experimental tables caused noisy Profile warnings
  // when a live Supabase project had not applied every historical migration.
  "profiles",
  "premium_entitlements",
  "openingfit_user_state",
  "settings",
  "activity_history",
  "report_history",
  "openingfit_retention_snapshots",
  "analysed_games",
  "recommendation_history",
  "notification_preferences",
];

export const USER_FILE_BUCKET = "user-uploads";
const DEBUG_CLOUD_RESTORE =
  typeof import.meta !== "undefined" &&
  import.meta.env?.VITE_DEBUG_CLOUD_RESTORE === "true";
const REQUIRED_RESTORE_TABLES = new Set([
  "profiles",
]);
const DEFAULT_RESTORE_LIMIT = 50;
const RESTORE_TABLE_LIMITS = {
  premium_entitlements: 10,
  openingfit_user_state: 20,
  // Deprecated legacy wardrobe/app tables. Kept out of USER_DATA_TABLES so
  // missing remote tables cannot create Profile restore warnings.
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
  openingfit_retention_snapshots: 30,
  analysis_history: 20,
  analysed_games: 50,
  recommendation_history: 50,
  saved_recommendations: 50,
  opening_preferences: 20,
  repertoire: 50,
  saved_openings: 50,
  chess_account_links: 10,
  notification_preferences: 10,
  // Deprecated experimental retention tables. Current OpeningFit progress
  // uses openingfit_retention_snapshots, activity_history, report_history,
  // and openingfit_user_state instead.
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
  openingfit_retention_snapshots: "*",
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
const RESTORE_PROFILE_TIMEOUT_MS = 5000;
const RESTORE_TABLE_TIMEOUT_MS = 3500;

function isRequiredRestoreTable(table) {
  return REQUIRED_RESTORE_TABLES.has(table);
}

function getRestoreQueryDetails(table, userId, options = {}) {
  const limit = options.limit ?? RESTORE_TABLE_LIMITS[table] ?? DEFAULT_RESTORE_LIMIT;
  const columns = options.columns || RESTORE_TABLE_COLUMNS[table] || "*";
  const required = isRequiredRestoreTable(table);

  return {
    userId,
    selectedColumns: columns,
    filterColumn: "user_id",
    filter: "user_id.eq.<current-user>",
    limit,
    required,
    optional: !required,
    emptyRowsAllowed: true,
  };
}

function withUserDataTimeout(promise, ms, label) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      error.name = "WorkspaceRestoreTimeout";
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export function createDefaultUserData(profile = null) {
  return {
    profile,
    premium_entitlements: [],
    openingfit_user_state: [],
    // Deprecated legacy tables are defaulted for old UI compatibility only.
    // They are intentionally not included in USER_DATA_TABLES/cloud restore.
    onboarding_answers: [],
    measurements: [],
    outfits: [],
    favorites: [],
    uploads: [],
    ai_generations: [],
    settings: [],
    activity_history: [],
    report_history: [],
    openingfit_retention_snapshots: [],
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

  return Boolean(activeEntitlement || profile?.is_premium);
}

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function classifyRestoreError(error) {
  const message = String(error?.message || error?.error_description || "");
  const details = String(error?.details || "");
  const hint = String(error?.hint || "");
  const code = String(error?.code || "");
  const combined = `${message} ${details} ${hint} ${code}`.toLowerCase();

  if (error?.name === "WorkspaceRestoreTimeout" || /timeout|timed out/.test(combined)) {
    return "timeout";
  }

  if (/relation .* does not exist|could not find the table|schema cache|42p01/.test(combined)) {
    return "missing_table";
  }

  if (/row-level security|permission denied|insufficient privilege|42501/.test(combined)) {
    return "rls_permission";
  }

  if (/column .* does not exist|could not find .* column|42703|pgrst204/.test(combined)) {
    return "bad_column_or_query";
  }

  if (/jwt|session|auth|unauthorized|401|403/.test(combined)) {
    return "auth_session";
  }

  if (/failed to fetch|network|load failed|fetcherror/.test(combined) || error?.name === "TypeError") {
    return "network";
  }

  return "unknown";
}

function logRestoreWarning(table, error, details = {}) {
  const failureType = classifyRestoreError(error);
  const required = details.required ?? isRequiredRestoreTable(table);
  console.warn("OpeningFit cloud restore table warning", {
    table,
    failureType,
    timedOut: failureType === "timeout",
    message: error?.message || String(error || ""),
    code: error?.code,
    supabaseDetails: error?.details,
    hint: error?.hint,
    status: error?.status,
    required,
    optional: !required,
    userVisible: required,
    emptyRowsAllowed: details.emptyRowsAllowed ?? true,
    query: {
      selectedColumns: details.selectedColumns || RESTORE_TABLE_COLUMNS[table] || "*",
      filterColumn: details.filterColumn || "user_id",
      filter: details.filter || "user_id.eq.<current-user>",
      limit: details.limit ?? RESTORE_TABLE_LIMITS[table] ?? DEFAULT_RESTORE_LIMIT,
    },
    details,
  });
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

  const authenticatedUser = data?.user || data?.session?.user || null;
  if (!authenticatedUser?.id) {
    throw new Error("Login succeeded, but Supabase did not return the account details.");
  }

  // Authentication is complete as soon as Supabase returns the session. Profile
  // repair is best-effort and must not turn a successful login into a timeout.
  void ensureProfile(authenticatedUser).catch((profileError) => {
    logQueryFailure("profiles", "ensure profile after sign in", profileError, {
      userId: authenticatedUser.id,
    });
  });

  logQuerySuccess("auth.users", "sign in with email/password", {
    email: cleanEmail,
    userId: authenticatedUser.id,
  });

  return {
    session: data?.session || null,
    user: authenticatedUser,
    profileError: null,
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
  const queryDetails = getRestoreQueryDetails(table, userId, options);
  const { limit, selectedColumns: columns } = queryDetails;

  const result = await client
    .from(table)
    .select(columns)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!result.error) {
    logQuerySuccess(table, "select rows by user_id", {
      ...queryDetails,
      count: result.data?.length || 0,
    });
    return result.data || [];
  }

  logQueryFailure(table, "select rows by user_id", result.error, queryDetails);
  throw result.error;
}

export async function fetchAllUserData(user, options = {}) {
  if (!user?.id) return createDefaultUserData();

  const profileTimeout = options.profileTimeoutMs ?? RESTORE_PROFILE_TIMEOUT_MS;
  const tableTimeout = options.tableTimeoutMs ?? RESTORE_TABLE_TIMEOUT_MS;
  let profile = null;
  try {
    profile = await withUserDataTimeout(
      loadExistingProfile(user.id, PROFILE_RESTORE_COLUMNS),
      profileTimeout,
      "OpeningFit profile restore"
    );
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
  const settledResults = await Promise.allSettled(
    tableNames.map(async (table) => {
      try {
        const rows = await withUserDataTimeout(
          selectUserRows(table, user.id),
          tableTimeout,
          `OpeningFit ${table} restore`
        );
        return { table, rows, error: null };
      } catch (tableError) {
        const queryDetails = getRestoreQueryDetails(table, user.id);
        logQueryFailure(table, "restore table during full restore", tableError, {
          ...queryDetails,
        });
        logRestoreWarning(table, tableError, queryDetails);
        return {
          table,
          rows: options.strict && isRequiredRestoreTable(table) ? null : [],
          error: tableError,
        };
      }
    })
  );

  const tableErrors = [];
  const results = settledResults.map((result, index) => {
    const table = tableNames[index];
    if (result.status === "rejected") {
      const tableError = result.reason;
      const queryDetails = getRestoreQueryDetails(table, user.id);
      logQueryFailure(table, "restore table during full restore", tableError, queryDetails);
      logRestoreWarning(table, tableError, queryDetails);
      tableErrors.push({ table, error: tableError, required: isRequiredRestoreTable(table) });
      return [table, options.strict && isRequiredRestoreTable(table) ? null : []];
    }

    if (result.value?.error) {
      tableErrors.push({
        table: result.value.table,
        error: result.value.error,
        required: isRequiredRestoreTable(result.value.table),
      });
    }

    return [table, result.value?.rows || []];
  });

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
    restoreWarnings: tableErrors.map((item) => {
      const failureType = classifyRestoreError(item.error);
      const required = item.required ?? isRequiredRestoreTable(item.table);
      return {
        table: item.table,
        message: safeUserMessage(item.error, `Could not restore ${item.table}.`),
        failureType,
        timedOut: failureType === "timeout",
        code: item.error?.code,
        supabaseDetails: item.error?.details,
        hint: item.error?.hint,
        status: item.error?.status,
        required,
        optional: !required,
        userVisible: required,
        emptyRowsAllowed: true,
        query: getRestoreQueryDetails(item.table, user.id),
      };
    }),
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
  const playerProfile =
    summary.playerProfile ||
    summary.player_profile ||
    report.playerProfile ||
    report.player_profile ||
    null;
  const enrichedSummary = {
    ...summary,
    ...(playerProfile ? { playerProfile, player_profile: playerProfile } : {}),
  };
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
    summary: enrichedSummary,
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

function compactOpeningMastery(report = {}) {
  const rows = report.openingMastery || report.opening_mastery || report.retentionMetrics?.openingMastery || [];
  return (Array.isArray(rows) ? rows : [])
    .slice(0, 5)
    .map((item) => ({
      opening: item.opening || item.name || "Unknown opening",
      variation: item.variation || "",
      games_played: Number(item.gamesPlayed ?? item.games_played ?? 0) || 0,
      win_rate: Number(item.winRate ?? item.win_rate ?? 0) || 0,
      loss_rate: Number(item.lossRate ?? item.loss_rate ?? 0) || 0,
      weak_line_count: Number(item.weakLineCount ?? item.weak_line_count ?? 0) || 0,
      mastery_score: Number(item.masteryScore ?? item.mastery_score ?? 0) || 0,
      mastery_level: Number(item.masteryLevel ?? item.mastery_level ?? 1) || 1,
      recent_trend: item.recentTrend || item.recent_trend || null,
    }));
}

function compactSourceSummary(report = {}, summary = {}) {
  const dateRange =
    report.dateRange ||
    report.date_range ||
    report.sourceSummary?.dateRange ||
    report.source_summary?.date_range ||
    null;

  return {
    username: summary.username || report.username || report.playerName || report.player_name || "",
    platform: summary.platform || report.platform || report.importPlatform || report.import_platform || "",
    games_analysed:
      Number(
        summary.games ??
          report.gamesAnalysed ??
          report.gamesAnalyzed ??
          report.gamesImported ??
          report.games_imported ??
          report.totalGames ??
          report.total_games ??
          0
      ) || 0,
    date_range: dateRange,
    imported_at: summary.importedAt || summary.savedAt || report.importedAt || report.imported_at || report.lastUpdated || "",
  };
}

function compactLine(line = null) {
  if (!line || typeof line !== "object") return null;
  return {
    opening: line.opening || line.name || line.trainingTarget || "",
    variation: line.variation || line.line || "",
    move_line: line.moveLine || line.move_line || "",
    games: Number(line.games ?? line.gamesPlayed ?? line.games_played ?? 0) || 0,
    win_rate: Number(line.winRate ?? line.win_rate ?? 0) || 0,
    loss_rate: Number(line.lossRate ?? line.loss_rate ?? 0) || 0,
    reason: line.flagReason || line.reason || line.exactIssue || line.exact_issue || "",
  };
}

function compactFix(fix = null) {
  if (!fix || typeof fix !== "object") return null;
  return {
    opening: fix.opening || fix.name || fix.trainingTarget || "",
    variation: fix.variation || "",
    exact_issue: fix.exactIssue || fix.exact_issue || "",
    why_it_matters: fix.whyItMatters || fix.why_it_matters || "",
    suggested_training_action: fix.suggestedTrainingAction || fix.suggested_training_action || "",
    short_display_text: fix.shortDisplayText || fix.short_display_text || "",
    reason_code: fix.reasonCode || fix.reason_code || "",
    decay_risk: fix.decayRisk || fix.decay_risk || "",
  };
}

function compactIdentity(identity = null) {
  if (!identity) return null;
  if (typeof identity === "string") {
    return { identity, confidence_percentage: null, reasons: [], suggested_opening_direction: "" };
  }
  if (typeof identity !== "object") return null;
  return {
    identity: identity.identity || identity.label || "",
    confidence_percentage: Number(identity.confidencePercentage ?? identity.confidence_percentage ?? identity.confidence ?? 0) || 0,
    reasons: Array.isArray(identity.reasons) ? identity.reasons.slice(0, 2) : [],
    suggested_opening_direction: identity.suggestedOpeningDirection || identity.suggested_opening_direction || "",
  };
}

function buildRetentionSnapshotPayload(userId, report = {}, summary = {}) {
  const retentionMetrics = report.retentionMetrics || report.retention_metrics || {};
  const scoreObject =
    report.openingfitScore ||
    report.openingfit_score ||
    report.openingFitScoreV2 ||
    report.opening_fit_score_v2 ||
    retentionMetrics.openingFitScore ||
    retentionMetrics.opening_fit_score ||
    null;
  const repertoireHealth = report.repertoireHealth || report.repertoire_health || retentionMetrics.repertoireHealth || {};
  const weakestTracking = report.weakestLineTracking || report.weakest_line_tracking || retentionMetrics.weakestLineTracking || {};
  const oneThingToFix = compactFix(report.oneThingToFix || report.one_thing_to_fix || retentionMetrics.oneThingToFix || null);
  const sourceSummary = compactSourceSummary(report, summary);
  const createdAt = summary.createdAt || summary.savedAt || report.importedAt || report.imported_at || report.lastUpdated || new Date().toISOString();
  const openingFitScore =
    Number(
      scoreObject?.score ??
        scoreObject?.scoreOutOf1000 ??
        scoreObject?.score_out_of_1000 ??
        report.openingFitScore ??
        report.opening_fit_score ??
        report.fitScore ??
        report.fit_score ??
        0
    ) || null;
  const repertoireHealthScore = Number(repertoireHealth.score ?? repertoireHealth.healthScore ?? 0) || null;
  const topOpeningMastery = compactOpeningMastery(report);
  const weakestLine = compactLine(
    weakestTracking.currentWeakestLine ||
    weakestTracking.current_weakest_line ||
    report.currentWeakestLine ||
    report.current_weakest_line ||
    null
  );
  const openingIdentity = compactIdentity(
    report.openingIdentityV2 ||
    report.opening_identity_v2 ||
    retentionMetrics.openingIdentity ||
    retentionMetrics.opening_identity ||
    report.repertoireIdentitySummary ||
    report.repertoire_identity_summary ||
    report.openingIdentity ||
    report.opening_identity ||
    null
  );
  const snapshotKey = [
    String(sourceSummary.platform || "unknown").toLowerCase(),
    String(sourceSummary.username || "unknown").toLowerCase(),
    String(sourceSummary.imported_at || createdAt).slice(0, 19),
    String(sourceSummary.games_analysed || 0),
  ].join(":");
  const compactSnapshot = {
    opening_fit_score: openingFitScore,
    repertoire_health_score: repertoireHealthScore,
    top_opening_mastery: topOpeningMastery,
    weakest_line: weakestLine,
    one_thing_to_fix: oneThingToFix,
    opening_identity: openingIdentity,
    source_summary: sourceSummary,
  };

  return {
    user_id: userId,
    profile_id: summary.profileId || summary.profile_id || userId,
    snapshot_key: snapshotKey,
    created_at: createdAt,
    opening_fit_score: openingFitScore,
    repertoire_health_score: repertoireHealthScore,
    top_opening_mastery: topOpeningMastery,
    weakest_line: weakestLine,
    one_thing_to_fix: oneThingToFix,
    opening_identity: openingIdentity,
    source_summary: sourceSummary,
    snapshot: compactSnapshot,
    updated_at: new Date().toISOString(),
  };
}

export async function saveRetentionSnapshot(userId, report = {}, summary = {}) {
  if (!userId || !report) return null;

  const client = requireClient();
  const payload = buildRetentionSnapshotPayload(userId, report, summary);
  const { data, error, skipped } = await runSupabaseQuery(
    client
      .from("openingfit_retention_snapshots")
      .upsert(payload, { onConflict: "user_id,snapshot_key" })
      .select("*")
      .single(),
    {
      required: false,
      label: "openingfit_retention_snapshots upsert compact snapshot",
    }
  );

  if (skipped || error) {
    logSupabaseSyncWarning("openingfit_retention_snapshots", "save compact retention snapshot", error, {
      userId,
      snapshotKey: payload.snapshot_key,
    });
    return null;
  }

  logQuerySuccess("openingfit_retention_snapshots", "save compact retention snapshot", {
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

function classifySavedTimeControl(value) {
  const clean = String(value || "").trim().toLowerCase();

  if (!clean || clean === "?" || clean === "-") return null;
  if (clean.includes("daily") || clean.includes("correspondence")) return "daily";
  if (clean.includes("classical") || clean.includes("standard")) return "classical";
  if (clean.includes("rapid")) return "rapid";
  if (clean.includes("blitz")) return "blitz";
  if (clean.includes("bullet")) return "bullet";
  if (clean.includes("/")) return "daily";

  const [baseRaw, incrementRaw] = (clean.split(":")[0] || clean).split("+");
  const baseSeconds = Number(baseRaw);
  const incrementSeconds = Number(incrementRaw || 0);

  if (!Number.isFinite(baseSeconds)) return null;
  if (baseSeconds >= 86400) return "daily";

  const estimatedSeconds = baseSeconds + incrementSeconds * 40;
  if (estimatedSeconds < 180) return "bullet";
  if (estimatedSeconds < 600) return "blitz";
  if (estimatedSeconds < 1800) return "rapid";
  return "classical";
}

function pgnHeaderValue(pgnText, headerName) {
  const pattern = new RegExp(`\\[${headerName}\\s+"([^"]+)"\\]`, "i");
  return String(pgnText || "").match(pattern)?.[1] || "";
}

function normalizePgnDateValue(value) {
  const clean = String(value || "").trim();
  if (!clean || clean.includes("?")) return "";
  return clean.replace(/\./g, "-");
}

function playedDateFromPgn(pgnText) {
  const utcDate = normalizePgnDateValue(pgnHeaderValue(pgnText, "UTCDate"));
  const utcTime = String(pgnHeaderValue(pgnText, "UTCTime") || "").trim();
  const date = utcDate || normalizePgnDateValue(pgnHeaderValue(pgnText, "Date"));

  if (!date) return "";
  if (utcTime && !utcTime.includes("?")) return `${date}T${utcTime}Z`;
  return date;
}

function normalizeSavedTimeControl(game = {}) {
  const candidates = [
    game.time_control_normalized,
    game.timeControlNormalized,
    game.time_class,
    game.timeClass,
    game.time_control_class,
    game.timeControlClass,
    game.speed,
    game.perf,
    game.perfType,
    game.time_control,
    game.timeControl,
    game.time_control_raw,
    game.timeControlRaw,
    game.rawTimeControl,
    pgnHeaderValue(game.pgn || game.PGN || game.rawPgn || "", "TimeControl"),
  ];

  for (const candidate of candidates) {
    const normalized = classifySavedTimeControl(candidate);
    if (normalized) return normalized;
  }

  return "unknown";
}

function normalizeSavedTimestamp(value) {
  if (!value) return null;
  if (typeof value === "number") return value > 100000000000 ? value : value * 1000;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 100000000000 ? numeric : numeric * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSavedGameMetadata(game = {}) {
  if (!game || typeof game !== "object") return game;

  const timeControl = normalizeSavedTimeControl(game);
  const rawTimeControl =
    game.time_control_raw ||
    game.timeControlRaw ||
    game.rawTimeControl ||
    game.time_control ||
    game.timeControl ||
    game.time_class ||
    game.timeClass ||
    game.speed ||
    game.perf ||
    "unknown";
  const pgnPlayedAt = playedDateFromPgn(game.pgn || game.PGN || game.rawPgn || "");
  const timestamp = normalizeSavedTimestamp(
    game.end_time ||
      game.endTime ||
      game.played_at ||
      game.playedAt ||
      game.played_date ||
      game.playedDate ||
      game.date ||
      pgnPlayedAt ||
      game.createdAt ||
      game.created_at
  );
  const playedAt =
    game.played_at ||
    game.playedAt ||
    game.played_date ||
    game.playedDate ||
    pgnPlayedAt ||
    (timestamp ? new Date(timestamp).toISOString() : "");
  const colour = String(game.colour || game.color || game.player_color || game.playerColour || "").toLowerCase();
  const context = String(game.context || game.repertoireContext || game.repertoire_context || "").toLowerCase();
  const normalizedColour =
    colour.includes("white") || context === "played_as_white"
      ? "white"
      : colour.includes("black") || context.startsWith("black")
        ? "black"
        : "unknown";

  return {
    ...game,
    time_class: timeControl,
    timeClass: timeControl,
    time_control_normalized: timeControl,
    timeControlNormalized: timeControl,
    time_control_raw: rawTimeControl,
    timeControlRaw: rawTimeControl,
    played_at: playedAt,
    playedAt,
    played_date: playedAt,
    playedDate: playedAt,
    colour: normalizedColour,
    color: normalizedColour,
  };
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
  const rows = games.map((game, index) => {
    const normalizedGame = normalizeSavedGameMetadata(game);

    return {
      user_id: userId,
      platform,
      username,
      game_id: stableGameId(normalizedGame, index),
      game: normalizedGame,
      analysis: {
        opening: normalizedGame.opening || normalizedGame.eco || normalizedGame.detected_opening || null,
        result: normalizedGame.result || normalizedGame.user_result || null,
        colour: normalizedGame.colour || normalizedGame.color || "unknown",
        color: normalizedGame.colour || normalizedGame.color || "unknown",
        time_control_raw: normalizedGame.time_control_raw || normalizedGame.timeControlRaw || "unknown",
        time_control: normalizedGame.time_class || "unknown",
        played_at: normalizedGame.played_at || null,
        saved_from_report: true,
      },
      updated_at: now,
    };
  });

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

  // Deprecated public.uploads metadata rows are no longer written. The storage
  // object itself is enough for this legacy helper, and avoiding the table
  // prevents missing legacy upload metadata tables from affecting cloud flows.
  return {
    bucket: USER_FILE_BUCKET,
    path,
    url: signedData?.signedUrl || null,
    metadata: {
      name: file.name,
      type: file.type,
      size: file.size,
    },
  };
}
