import { buildApiUrl } from "./apiBase.js";

let bootstrapPromise = null;
let eligibilityPromise = null;
let eligibilityUserId = "";
let currentState = "loading";

export function parseMissionFeatureState(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "disabled";
  return payload.status === "ready" && payload.missions === "enabled" ? "enabled" : "disabled";
}

async function loadGlobalMissionState({ fetchImpl, timeoutMs }) {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    if (typeof fetchImpl !== "function") return "disabled";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(buildApiUrl("/api/readiness"), { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response?.ok) return "disabled";
      return parseMissionFeatureState(await response.json().catch(() => null));
    } catch {
      return "disabled";
    } finally {
      clearTimeout(timeout);
    }
  })();
  return bootstrapPromise;
}

export async function loadMissionFeatureState({ userId = "", accessToken = "", fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  currentState = "loading";
  const globalState = await loadGlobalMissionState({ fetchImpl, timeoutMs });
  if (globalState !== "enabled" || !userId || !accessToken || typeof fetchImpl !== "function") {
    currentState = "disabled";
    return currentState;
  }
  if (!eligibilityPromise || eligibilityUserId !== userId) {
    eligibilityUserId = userId;
    eligibilityPromise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(buildApiUrl("/api/features/missions/eligibility"), {
          method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
        });
        if (!response?.ok) return "disabled";
        const payload = await response.json().catch(() => null);
        return payload && typeof payload === "object" && !Array.isArray(payload) && payload.enabled === true ? "enabled" : "disabled";
      } catch {
        return "disabled";
      } finally {
        clearTimeout(timeout);
      }
    })();
  }
  currentState = await eligibilityPromise;
  return currentState;
}

export function missionsClientEnabled() { return currentState === "enabled"; }

export function __resetMissionFeatureGateForTests() { bootstrapPromise = null; eligibilityPromise = null; eligibilityUserId = ""; currentState = "loading"; }
