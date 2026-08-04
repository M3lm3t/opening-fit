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
  try {
    if (!payload?.analysis || typeof payload.analysis !== "object") return { ok: false, reason: "invalid_report" };
    const versioned = { ...payload, schemaVersion: LOCAL_REPORT_SCHEMA_VERSION };
    storage?.setItem?.(key, JSON.stringify(versioned));
    const restored = readPersistedReport(storage, key);
    if (!restored.ok) return { ok: false, reason: "write_verification_failed" };
    return { ok: true, reason: null, payload: versioned };
  } catch {
    return { ok: false, reason: "write_failed" };
  }
}
