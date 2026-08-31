import { supabase } from "../lib/supabaseClient.js";
import { buildApiUrl } from "../lib/apiBase.js";

const currentReads = new Map();

export class MissionApiError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = "MissionApiError"; this.code = code; this.status = status; }
}

export function missionActionKey(prefix = "mission") {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function safeCode(payload, response) {
  const code = payload?.reasonCode || payload?.detail?.code || payload?.code;
  if (code === "missions_disabled") return "missions_disabled";
  if (["schema_unavailable", "training_schema_unavailable", "temporarily_unavailable", "database_unavailable"].includes(code)) return "unavailable";
  if (response?.status === 401) return "authentication_required";
  if (response?.status === 429) return "rate_limited";
  if (code === "illegal_move") return "illegal_move";
  if (["mission_not_trainable", "session_not_active", "not_found", "idempotency_key_conflict"].includes(code)) return "conflict";
  return code || "request_failed";
}

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null };
  const token = data?.session?.access_token;
  if (!token) throw new MissionApiError("authentication_required", "Please sign in to use Missions.", 401);
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function request(path, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(buildApiUrl(path), { method, headers: await authHeaders(), signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new MissionApiError("offline", "Reconnect to continue with this Mission.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = safeCode(payload, response);
    const messages = { authentication_required: "Please sign in again.", rate_limited: "Please wait a moment and try again.",
      illegal_move: "That move is not legal in this position.", conflict: "This Mission changed elsewhere. Refreshing will restore the latest state." };
    throw new MissionApiError(code, messages[code] || "Missions are temporarily unavailable.", response.status);
  }
  return { ...payload, availability: safeCode(payload, response) };
}

export function getCurrentMission({ signal, dedupeKey = "current" } = {}) {
  if (currentReads.has(dedupeKey)) return currentReads.get(dedupeKey);
  const pending = request("/api/v1/missions/current", { signal }).finally(() => currentReads.delete(dedupeKey));
  currentReads.set(dedupeKey, pending); return pending;
}
export const listMissionHistory = ({ limit = 10, cursor, signal } = {}) => request(`/api/v1/missions?limit=${Math.min(20, Math.max(1, limit))}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal });
export const selectNextMission = (idempotencyKey, options = {}) => request("/api/v1/missions/select-next", { method: "POST", body: { idempotencyKey }, ...options });
export const dismissMission = (missionId, reason, idempotencyKey, options = {}) => request(`/api/v1/missions/${missionId}/dismiss`, { method: "POST", body: { reason, idempotencyKey }, ...options });
export const startTrainingSession = (missionId, idempotencyKey, options = {}) => request(`/api/v1/missions/${missionId}/training/sessions`, { method: "POST", body: { idempotencyKey }, ...options });
export const getCurrentTrainingSession = (missionId, options = {}) => request(`/api/v1/missions/${missionId}/training/sessions/current`, options);
export const submitTrainingAttempt = (missionId, sessionId, exerciseId, attemptedMoveUci, idempotencyKey, options = {}) => request(`/api/v1/missions/${missionId}/training/sessions/${sessionId}/attempts`, { method: "POST", body: { exerciseId, attemptedMoveUci, idempotencyKey }, ...options });
export const completeTrainingSession = (missionId, sessionId, idempotencyKey, options = {}) => request(`/api/v1/missions/${missionId}/training/sessions/${sessionId}/complete`, { method: "POST", body: { idempotencyKey }, ...options });

export function __resetMissionApiForTests() { currentReads.clear(); }
