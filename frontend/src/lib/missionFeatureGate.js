import { buildApiUrl } from "./apiBase.js";

let bootstrapPromise = null;
let eligibilityPromise = null;
let eligibilityUserId = "";
let eligibilityAccessToken = "";
let currentState = "loading";

export const MISSION_READINESS_TIMEOUT_MS = 15000;
export const MISSION_ELIGIBILITY_TIMEOUT_MS = 8000;

export function parseMissionFeatureState(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "disabled";
  return payload.status === "ready" && payload.missions === "enabled" ? "enabled" : "disabled";
}

async function loadGlobalMissionState({ fetchImpl, timeoutMs }) {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    if (typeof fetchImpl !== "function") return "unavailable";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(buildApiUrl("/api/readiness"), { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response?.ok) return "unavailable";
      return parseMissionFeatureState(await response.json().catch(() => null));
    } catch {
      return "unavailable";
    } finally {
      clearTimeout(timeout);
    }
  })();
  const result = await bootstrapPromise;
  // A transient readiness failure must not become the page-lifetime feature
  // decision. Keep successful/disabled configuration deduplicated, but allow
  // an explicit retry to perform a fresh bounded request.
  if (result === "unavailable") bootstrapPromise = null;
  return result;
}

export async function loadMissionFeatureState({ userId = "", accessToken = "", fetchImpl = globalThis.fetch,
  readinessTimeoutMs = MISSION_READINESS_TIMEOUT_MS, eligibilityTimeoutMs = MISSION_ELIGIBILITY_TIMEOUT_MS } = {}) {
  currentState = "loading";
  const globalState = await loadGlobalMissionState({ fetchImpl, timeoutMs: readinessTimeoutMs });
  if (globalState === "unavailable") {
    currentState = "unavailable";
    return currentState;
  }
  if (globalState !== "enabled" || !userId || !accessToken || typeof fetchImpl !== "function") {
    currentState = "disabled";
    return currentState;
  }
  // A TOKEN_REFRESHED event keeps the same user ID. Never reuse an eligibility
  // result that was obtained with the preceding access token.
  if (!eligibilityPromise || eligibilityUserId !== userId || eligibilityAccessToken !== accessToken) {
    eligibilityUserId = userId;
    eligibilityAccessToken = accessToken;
    eligibilityPromise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), eligibilityTimeoutMs);
      try {
        const response = await fetchImpl(buildApiUrl("/api/features/missions/eligibility"), {
          method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
        });
        if (!response?.ok) return "unavailable";
        const payload = await response.json().catch(() => null);
        if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.enabled !== "boolean") return "unavailable";
        return payload.enabled ? "enabled" : "disabled";
      } catch {
        return "unavailable";
      } finally {
        clearTimeout(timeout);
      }
    })();
  }
  currentState = await eligibilityPromise;
  if (currentState === "unavailable") {
    eligibilityPromise = null;
    eligibilityUserId = "";
    eligibilityAccessToken = "";
  }
  return currentState;
}

export function missionsClientEnabled() { return currentState === "enabled"; }

export function __resetMissionFeatureGateForTests() { bootstrapPromise = null; eligibilityPromise = null; eligibilityUserId = ""; eligibilityAccessToken = ""; currentState = "loading"; }
