import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export const USER_DATA_TABLES = [
  "profiles",
  "premium_entitlements",
  "openingfit_user_state",
  "onboarding_answers",
  "measurements",
  "outfits",
  "favorites",
  "uploads",
  "ai_generations",
  "settings",
  "activity_history",
  "report_history",
];

export const USER_FILE_BUCKET = "user-uploads";

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
  };
}

export function hasActivePremiumEntitlement(entitlements = [], profile = null) {
  const now = Date.now();
  const activeEntitlement = (entitlements || []).find((entitlement) => {
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

function logQueryFailure(table, operation, error, details = {}) {
  console.error("OpeningFit Supabase query failed", {
    table,
    operation,
    details,
    error,
  });
}

export async function ensureProfile(user) {
  if (!user?.id) return null;

  const client = requireClient();
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email ||
    "";

  const { data, error } = await client
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        email: user.email || "",
        display_name: displayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) {
    logQueryFailure("profiles", "upsert profile by user_id", error, { userId: user.id });
    throw error;
  }
  return data;
}

async function selectUserRows(table, userId) {
  const client = requireClient();
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (error) {
    logQueryFailure(table, "select rows by user_id ordered by updated_at", error, { userId });
    throw error;
  }
  return data || [];
}

export async function fetchAllUserData(user) {
  if (!user?.id) return createDefaultUserData();

  let profile = null;
  try {
    profile = await ensureProfile(user);
  } catch (profileError) {
    logQueryFailure("profiles", "ensure profile during full restore", profileError, {
      userId: user.id,
    });
    console.warn("OpeningFit could not restore profile row; using default profile.", profileError);
  }

  const tableNames = USER_DATA_TABLES.filter((table) => table !== "profiles");
  const results = await Promise.all(
    tableNames.map(async (table) => {
      try {
        return [table, await selectUserRows(table, user.id)];
      } catch (tableError) {
        logQueryFailure(table, "restore table during full restore", tableError, {
          userId: user.id,
        });
        console.warn(`OpeningFit could not restore ${table}; using empty rows.`, tableError);
        return [table, []];
      }
    })
  );

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
  const payload = {
    ...row,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from(table)
    .upsert(payload, options)
    .select("*");

  if (error) {
    logQueryFailure(table, "upsert row", error, { userId, row, options });
    throw error;
  }
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
    throw error;
  }
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
    throw error;
  }
  return data || {};
}

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
  };

  let { data, error } = await client.from("report_history").insert(payload).select("*").single();

  if (
    error &&
    (
      error.code === "PGRST204" ||
      /analysis_time_format|effective_time_format|detected_time_format/i.test(error.message || "")
    )
  ) {
    logQueryFailure("report_history", "insert report with time-format columns unavailable; retrying JSON-only save", error, {
      userId,
      reportKey,
    });

    const retry = await client.from("report_history").insert(basePayload).select("*").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await client
        .from("report_history")
        .select("*")
        .eq("user_id", userId)
        .eq("report_key", reportKey)
        .maybeSingle();

      if (existingError) {
        logQueryFailure("report_history", "select existing report after dedupe collision", existingError, {
          userId,
          reportKey,
        });
        throw existingError;
      }

      return existing;
    }

    logQueryFailure("report_history", "insert report with dedupe key", error, { userId, reportKey });
    throw error;
  }

  return data;
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
