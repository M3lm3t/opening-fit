import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

export const REPERTOIRE_SLOTS = Object.freeze([
  "white_primary",
  "white_secondary",
  "black_vs_e4",
  "black_vs_d4",
  "black_other",
]);
export const REQUIRED_REPERTOIRE_SLOTS = Object.freeze(["white_primary", "black_vs_e4", "black_vs_d4"]);

const SLOT_ALIASES = Object.freeze({
  main_white: "white_primary",
  white: "white_primary",
  white_repertoire: "white_primary",
  played_as_white: "white_primary",
  white_primary: "white_primary",
  white_secondary: "white_secondary",
  black_e4: "black_vs_e4",
  black_vs_e4: "black_vs_e4",
  black_d4: "black_vs_d4",
  black_vs_d4: "black_vs_d4",
  black_vs_d4_other: "black_other",
  black_other: "black_other",
  black_vs_other: "black_other",
  black_vs_c4_nf3: "black_other",
});

const array = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const textOrNull = (value) => String(value ?? "").trim() || null;

function requireUserId(userId) {
  const id = textOrNull(userId);
  if (!id) throw new Error("Sign in before changing your repertoire.");
  return id;
}

function getClient(options = {}) {
  if (options.client) return options.client;
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function repertoireError(error, fallback) {
  const message = String(error?.message || "");
  if (/duplicate key|repertoire_one_active_slot/i.test(message)) return new Error("That repertoire slot already has an active opening.");
  if (/active repertoire already exists/i.test(message)) return new Error("Your repertoire already exists. Review recommendations instead of rebuilding it.");
  return new Error(message || fallback);
}

async function callRpc(client, name, params, fallback) {
  const { data, error } = await client.rpc(name, params);
  if (error) throw repertoireError(error, fallback);
  return data;
}

export function canonicaliseRepertoireOpening(opening, slot = null, defaults = {}) {
  const raw = typeof opening === "string" ? { name: opening } : opening || {};
  const rawName = textOrNull(raw.display_name || raw.displayName || raw.opening || raw.name || defaults.display_name);
  if (!rawName) throw new Error("Choose an opening before saving this repertoire entry.");
  const known = findOpeningLine(rawName);
  const canonicalName = known?.name || rawName;
  const normalizedSlot = SLOT_ALIASES[slot || raw.slot || raw.context || raw.repertoireContext];
  if (!REPERTOIRE_SLOTS.includes(normalizedSlot)) throw new Error("Choose a valid repertoire slot.");
  const score = numberOrNull(raw.recent_score ?? raw.recentScore ?? raw.win_rate ?? raw.winRate ?? raw.score);
  const sample = numberOrNull(raw.sample_size ?? raw.sampleSize ?? raw.games ?? raw.count);

  return {
    slot: normalizedSlot,
    canonical_opening_id: known?.id || textOrNull(raw.canonical_opening_id || raw.canonicalOpeningId),
    canonical_name: canonicalName,
    display_name: rawName,
    source: ["recommended", "user_selected", "imported"].includes(raw.source) ? raw.source : defaults.source || "recommended",
    confidence: textOrNull(raw.confidence?.label || raw.confidenceLabel || raw.confidence),
    sample_size: sample === null ? null : Math.max(0, Math.round(sample)),
    recent_score: score === null ? null : Math.max(0, Math.min(100, Math.round(score * 100) / 100)),
    key_strength: textOrNull(raw.key_strength || raw.keyStrength || raw.strength),
    key_weakness: textOrNull(raw.key_weakness || raw.keyWeakness || raw.weakness),
    current_training_focus: textOrNull(raw.current_training_focus || raw.currentTrainingFocus || raw.training_focus || raw.trainingFocus),
    recommendation_reason: textOrNull(raw.recommendation_reason || raw.recommendationReason || raw.reason || raw.explanation),
    expected_benefit: textOrNull(raw.expected_benefit || raw.expectedBenefit || raw.benefit || raw.key_strength || raw.keyStrength),
  };
}

function recommendationRows(report = {}) {
  const plan = report.recommendedRepertoirePlan || report.recommended_repertoire_plan || {};
  const planItems = array(plan.items);
  const direct = report.recommendations && typeof report.recommendations === "object" ? report.recommendations : {};
  const rows = planItems.length
    ? planItems
    : Object.entries(direct).map(([slot, value]) => ({ ...(typeof value === "object" ? value : { opening: value }), slot }));
  const seen = new Set();
  return rows.flatMap((row) => {
    try {
      const normalized = canonicaliseRepertoireOpening(row, row.slot, { source: "recommended" });
      if (seen.has(normalized.slot)) return [];
      seen.add(normalized.slot);
      return [normalized];
    } catch {
      return [];
    }
  });
}

function reportOpeningRows(report = {}) {
  const rows = [
    report.opening_statistics,
    report.opening_stats,
    report.openingStats,
    report.top_openings,
    report.topOpenings,
    report.best_openings,
    report.bestOpenings,
  ].find((items) => Array.isArray(items) && items.length) || [];
  return rows.flatMap((row) => {
    const context = SLOT_ALIASES[row.slot || row.context || row.repertoireContext || row.repertoire_context];
    if (!context) return [];
    try {
      return [canonicaliseRepertoireOpening(row, context, { source: "imported" })];
    } catch {
      return [];
    }
  });
}

export function repertoireEntriesFromReport(report = {}) {
  const recommendations = recommendationRows(report);
  const imported = reportOpeningRows(report);
  const bySlot = new Map(imported.map((entry) => [entry.slot, entry]));
  recommendations.forEach((entry) => bySlot.set(entry.slot, { ...bySlot.get(entry.slot), ...entry, source: "recommended" }));
  return [...bySlot.values()];
}

export async function getActiveRepertoire(userId, options = {}) {
  requireUserId(userId);
  const client = getClient(options);
  const { data, error } = await client
    .from("repertoire")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("slot", { ascending: true });
  if (error) throw repertoireError(error, "Could not load your repertoire.");
  return data || [];
}

export async function getRepertoireEntries(userId, options = {}) {
  requireUserId(userId);
  const client = getClient(options);
  const { data, error } = await client
    .from("repertoire")
    .select("*")
    .eq("user_id", userId)
    .in("status", options.statuses || ["active", "considering"])
    .order("updated_at", { ascending: false });
  if (error) throw repertoireError(error, "Could not load your repertoire workspace.");
  return data || [];
}

export async function initialiseRepertoireFromReport(userId, report, options = {}) {
  requireUserId(userId);
  const entries = repertoireEntriesFromReport(report);
  const missing = REQUIRED_REPERTOIRE_SLOTS.filter((slot) => !entries.some((entry) => entry.slot === slot));
  if (missing.length) throw new Error(`This report cannot build a complete repertoire yet. Missing: ${missing.join(", ")}.`);
  return callRpc(getClient(options), "initialise_repertoire_from_report", { p_entries: entries }, "Could not build your repertoire.");
}

export async function acceptRepertoireRecommendation(userId, recommendationId, options = {}) {
  requireUserId(userId);
  if (!textOrNull(recommendationId)) throw new Error("Choose a repertoire recommendation to accept.");
  return callRpc(getClient(options), "accept_repertoire_recommendation", { p_recommendation_id: recommendationId }, "Could not accept that recommendation.");
}

export async function rejectRepertoireRecommendation(userId, recommendationId, options = {}) {
  requireUserId(userId);
  if (!textOrNull(recommendationId)) throw new Error("Choose a repertoire recommendation to reject.");
  return callRpc(getClient(options), "reject_repertoire_recommendation", { p_recommendation_id: recommendationId }, "Could not reject that recommendation.");
}

export async function replaceRepertoireEntry(userId, slot, opening, options = {}) {
  requireUserId(userId);
  const entry = canonicaliseRepertoireOpening(opening, slot, { source: "user_selected" });
  return callRpc(getClient(options), "replace_repertoire_entry", { p_slot: entry.slot, p_entry: entry }, "Could not replace that repertoire entry.");
}

export async function archiveRepertoireEntry(userId, entryId, options = {}) {
  requireUserId(userId);
  if (!textOrNull(entryId)) throw new Error("Choose a repertoire entry to archive.");
  return callRpc(getClient(options), "archive_repertoire_entry", { p_entry_id: entryId }, "Could not archive that repertoire entry.");
}

export async function updateRepertoireMetrics(userId, report, options = {}) {
  requireUserId(userId);
  const outcomes = array(report.trainingOutcomes || report.training_outcomes);
  const outcomeContext = report.trainingOutcomeContext || report.training_outcome_context || {};
  const outcomeByOpening = new Map(outcomes.flatMap((outcome) => {
    const context = outcomeContext[outcome.trainingFocusId] || {};
    const key = context.openingId || findOpeningLine(context.openingName || "")?.id || normaliseOpeningKey(context.openingName || "");
    return key ? [[key, outcome]] : [];
  }));
  const metrics = reportOpeningRows(report).map((entry) => ({
    ...entry,
    training_outcome: outcomeByOpening.get(entry.canonical_opening_id || normaliseOpeningKey(entry.canonical_name)) || null,
  }));
  const recommendations = recommendationRows(report);
  const client = getClient(options);
  const synced = await callRpc(
    client,
    "sync_repertoire_report",
    { p_metrics: metrics, p_recommendations: recommendations },
    "Could not update repertoire evidence."
  );
  if (metrics.some((entry) => entry.training_outcome)) {
    return callRpc(client, "apply_repertoire_training_outcomes", { p_metrics: metrics }, "Could not update training outcomes.");
  }
  return synced;
}

export function repertoireCanonicalKey(entry = {}) {
  return entry.canonical_opening_id || normaliseOpeningKey(entry.canonical_name || entry.display_name || "");
}
