export const LOCAL_REPORT_SCHEMA_VERSION = 1;

export function shouldClearLegacyStorageForAuthEvent(event, hasUser) {
  return !hasUser && event === "SIGNED_OUT";
}

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
  let serialized;
  let failureReason = "local_write_failed";
  if (!payload?.analysis || typeof payload.analysis !== "object") return { ok: false, reason: "invalid_report" };
  try {
    const versioned = { ...payload, schemaVersion: LOCAL_REPORT_SCHEMA_VERSION };
    try {
      serialized = JSON.stringify(versioned);
      if (typeof serialized !== "string") throw new Error("serialization_failed");
    } catch {
      return { ok: false, reason: "local_serialisation_failed" };
    }
    failureReason = "local_readback_failed";
    previousRaw = storage?.getItem?.(key) ?? null;
    failureReason = "local_write_failed";
    storage?.setItem?.(key, serialized);
    failureReason = "local_readback_failed";
    if (storage?.getItem?.(key) !== serialized) throw new Error("readback_mismatch");
    const restored = readPersistedReport(storage, key);
    const expectedId = payload.analysis.analysisId || payload.analysis.analysis_id || null;
    const restoredId = restored.analysis?.analysisId || restored.analysis?.analysis_id || null;
    if (
      !restored.ok ||
      JSON.stringify(restored.payload) !== serialized ||
      restored.payload?.schemaVersion !== LOCAL_REPORT_SCHEMA_VERSION ||
      (expectedId && restoredId !== expectedId)
    ) throw new Error("readback_mismatch");
    return { ok: true, reason: null, payload: versioned, serialized };
  } catch {
    try {
      if (previousRaw === null) storage?.removeItem?.(key);
      else storage?.setItem?.(key, previousRaw);
    } catch {
      return { ok: false, reason: failureReason, rollbackFailed: true };
    }
    return { ok: false, reason: failureReason, rollbackFailed: false };
  }
}
