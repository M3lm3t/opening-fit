import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { logSupabaseSyncFailure } from "../services/supabaseSyncDebug";
import { upsertUserRow } from "../services/userDataService";

function normalisePlatform(value) {
  const platform = String(value || "unknown").trim().toLowerCase();

  if (["chess.com", "chesscom", "chess_com"].includes(platform)) {
    return "chesscom";
  }

  if (["lichess", "lichess.org"].includes(platform)) {
    return "lichess";
  }

  return platform || "unknown";
}

function getUsername(data = {}) {
  return (
    data?.username ||
    data?.player ||
    data?.handle ||
    localStorage.getItem("openingFit:lastUsername") ||
    "guest"
  );
}

function getPlatform(data = {}) {
  return normalisePlatform(
    data?.platform ||
      data?.source ||
      localStorage.getItem("openingFit:lastPlatform") ||
      "unknown"
  );
}

export function getCloudIdentity(user, data = {}) {
  if (!user?.id) return null;

  return {
    userId: user.id,
    platform: getPlatform(data),
    username: getUsername(data),
  };
}

export async function fetchOpeningFitCloudState(user, data = {}) {
  const identity = getCloudIdentity(user, data);
  if (!identity) return null;

  if (!isSupabaseConfigured || !supabase) return null;

  const { data: row, error } = await supabase
    .from("openingfit_user_state")
    .select("platform, username, last_report, coach_progress, progress_history, import_history, updated_at")
    .eq("user_id", identity.userId)
    .eq("platform", identity.platform)
    .eq("username", identity.username)
    .maybeSingle();

  if (error) {
    logSupabaseSyncFailure("openingfit_user_state", "load cloud state", error, {
      userId: identity.userId,
      platform: identity.platform,
      username: identity.username,
    });
    throw error;
  }
  return row || null;
}

export async function saveOpeningFitCloudState(user, data = {}, partialState = {}) {
  const identity = getCloudIdentity(user, data);
  if (!identity) return null;

  if (!isSupabaseConfigured || !supabase) return null;

  const payload = Object.fromEntries(
    Object.entries({
      platform: identity.platform,
      username: identity.username,
      ...partialState,
    }).filter(([, value]) => value !== undefined)
  );

  const rows = await upsertUserRow("openingfit_user_state", identity.userId, payload, {
    onConflict: "user_id,platform,username",
    required: false,
  });
  return rows?.[0] || null;
}
