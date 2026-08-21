import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

export const REPERTOIRE_PREFERENCES = Object.freeze({
  AUTOMATIC: "automatic",
  MAIN: "main",
  EXPERIMENTING: "experimenting",
  IGNORE: "ignore",
});

const VALID_PREFERENCES = new Set(Object.values(REPERTOIRE_PREFERENCES));
const VALID_ROLES = new Set(["white", "black_vs_e4", "black_vs_d4"]);

function text(value) { return String(value ?? "").trim(); }
function clientFor(options = {}) { return options.client ?? (isSupabaseConfigured ? supabase : null); }
function requireAccount(userId, client) {
  if (!text(userId)) throw new Error("Sign in to edit your repertoire.");
  if (!client) throw new Error("Repertoire sync is unavailable.");
}

function normalisePreference(row = {}) {
  return {
    userId: text(row.userId || row.user_id),
    repertoireRole: text(row.repertoireRole || row.repertoire_role),
    canonicalOpeningId: text(row.canonicalOpeningId || row.canonical_opening_id),
    preference: text(row.preference) || REPERTOIRE_PREFERENCES.AUTOMATIC,
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

export async function getUserRepertoirePreferences(userId, options = {}) {
  const client = clientFor(options);
  requireAccount(userId, client);
  const { data, error } = await client
    .from("user_repertoire_preferences")
    .select("user_id,repertoire_role,canonical_opening_id,preference,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message || "Could not load your repertoire choices.");
  return (Array.isArray(data) ? data : []).map(normalisePreference);
}

export async function setUserRepertoirePreference({ userId, repertoireRole, canonicalOpeningId, preference }, options = {}) {
  const client = clientFor(options);
  requireAccount(userId, client);
  const role = text(repertoireRole);
  const openingId = text(canonicalOpeningId);
  const nextPreference = text(preference);
  if (!VALID_ROLES.has(role)) throw new Error("Choose a valid repertoire role.");
  if (!openingId || openingId.length > 160) throw new Error("A canonical opening ID is required.");
  if (!VALID_PREFERENCES.has(nextPreference)) throw new Error("Choose a valid repertoire status.");
  const { data, error } = await client.rpc("set_user_repertoire_preference", {
    p_repertoire_role: role,
    p_canonical_opening_id: openingId,
    p_preference: nextPreference,
  });
  if (error) throw new Error(error.message || "Could not save your repertoire choice.");
  return normalisePreference(data);
}

export function applyRepertoirePreferences(repertoireHistory = {}, preferences = []) {
  const byOpening = new Map((Array.isArray(preferences) ? preferences : []).map((row) => {
    const preference = normalisePreference(row);
    return [`${preference.repertoireRole}:${preference.canonicalOpeningId}`, preference.preference];
  }));
  const openings = Array.isArray(repertoireHistory?.openings) ? repertoireHistory.openings : [];
  return openings.filter((row) => text(row.canonicalOpeningId)).map((row) => {
    const preference = byOpening.get(`${text(row.repertoireRole)}:${text(row.canonicalOpeningId)}`) || REPERTOIRE_PREFERENCES.AUTOMATIC;
    const effectiveClassification = preference === REPERTOIRE_PREFERENCES.MAIN
      ? "MAIN_REPERTOIRE"
      : preference === REPERTOIRE_PREFERENCES.EXPERIMENTING
        ? "EXPERIMENT"
        : preference === REPERTOIRE_PREFERENCES.IGNORE ? "IGNORED" : row.classification;
    return {
      ...row,
      automaticClassification: row.classification,
      effectiveClassification,
      userPreference: preference,
    };
  });
}
