import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export const USER_DATA_TABLES = [
  "profiles",
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

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
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

  if (error) throw error;
  return data;
}

async function selectUserRows(table, userId) {
  const client = requireClient();
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAllUserData(user) {
  if (!user?.id) return null;

  const profile = await ensureProfile(user);
  const tableNames = USER_DATA_TABLES.filter((table) => table !== "profiles");
  const results = await Promise.all(
    tableNames.map(async (table) => [table, await selectUserRows(table, user.id)])
  );

  return {
    profile,
    ...Object.fromEntries(results),
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

  if (error) throw error;
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

  if (error) throw error;
}

export async function getSettings(userId) {
  if (!userId) return {};

  const client = requireClient();
  const { data, error } = await client
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
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

  const [row] = await upsertUserRow("report_history", userId, {
    username,
    platform,
    summary,
    report,
  });

  return row;
}

export async function recordActivity(userId, type, payload = {}) {
  if (!userId || !type) return null;

  const [row] = await upsertUserRow("activity_history", userId, {
    type,
    payload,
  });

  return row;
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
