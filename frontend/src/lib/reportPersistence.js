export const LOCAL_REPORT_SCHEMA_VERSION = 1;

export function readPersistedReport(storage = globalThis.localStorage, key = "openingFit:lastAnalysis") {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return { ok: false, reason: "missing", payload: null, analysis: null };
    const parsed = JSON.parse(raw);
    if (parsed?.analysis && typeof parsed.analysis === "object") {
      return { ok: true, reason: null, payload: parsed, analysis: parsed.analysis, migrated: !parsed.schemaVersion };
    }
    if (parsed && typeof parsed === "object" && (parsed.reportDecision || parsed.report_decision || parsed.analysisCompleted || parsed.analysis_completed)) {
      const payload = { schemaVersion: 0, savedAt: parsed.lastUpdated || parsed.last_updated || null, analysis: parsed };
      return { ok: true, reason: null, payload, analysis: parsed, migrated: true };
    }
    return { ok: false, reason: "unsupported_schema", payload: null, analysis: null };
  } catch {
    return { ok: false, reason: "corrupt", payload: null, analysis: null };
  }
}

export function persistReport(storage = globalThis.localStorage, key = "openingFit:lastAnalysis", payload = {}) {
  let previousRaw = null;
  try {
    if (!payload?.analysis || typeof payload.analysis !== "object") return { ok: false, reason: "invalid_report" };
    const versioned = { ...payload, schemaVersion: LOCAL_REPORT_SCHEMA_VERSION };
    const serialized = JSON.stringify(versioned);
    previousRaw = storage?.getItem?.(key) ?? null;
    storage?.setItem?.(key, serialized);
    if (storage?.getItem?.(key) !== serialized) throw new Error("write_verification_failed");
    const restored = readPersistedReport(storage, key);
    if (!restored.ok || JSON.stringify(restored.payload) !== serialized) throw new Error("write_verification_failed");
    return { ok: true, reason: null, payload: versioned };
  } catch (error) {
    try {
      if (previousRaw === null) storage?.removeItem?.(key);
      else storage?.setItem?.(key, previousRaw);
    } catch {
      return { ok: false, reason: "rollback_failed" };
    }
    return { ok: false, reason: error?.message === "write_verification_failed" ? "write_verification_failed" : "write_failed" };
  }
}
