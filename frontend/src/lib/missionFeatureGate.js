import { buildApiUrl } from "./apiBase.js";

let bootstrapPromise = null;
let currentState = "loading";

export function parseMissionFeatureState(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "disabled";
  return payload.status === "ready" && payload.missions === "enabled" ? "enabled" : "disabled";
}

export function loadMissionFeatureState({ fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
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
  })().then((state) => { currentState = state; return state; });
  return bootstrapPromise;
}

export function missionsClientEnabled() { return currentState === "enabled"; }

export function __resetMissionFeatureGateForTests() { bootstrapPromise = null; currentState = "loading"; }
