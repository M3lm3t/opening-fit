const DEBUG_ENABLED =
  typeof import.meta !== "undefined" &&
  (import.meta.env?.DEV || import.meta.env?.VITE_OPENINGFIT_SUPABASE_DEBUG === "true");

function redactDetails(details = {}) {
  return Object.fromEntries(
    Object.entries(details || {}).map(([key, value]) => {
      if (/email|token|secret|password|authorization|session/i.test(key)) {
        return [key, "[redacted]"];
      }

      if (/row|payload|report|snapshot|game/i.test(key)) {
        return [key, "[omitted]"];
      }

      return [key, value];
    })
  );
}

function normaliseError(error) {
  if (!error) return error;

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  };
}

export function logSupabaseSyncFailure(table, operation, error, details = {}) {
  console.error("OpeningFit Supabase sync failed", {
    table,
    operation,
    details: redactDetails(details),
    error: normaliseError(error),
  });
}

export function logSupabaseSyncSuccess(table, operation, details = {}) {
  if (!DEBUG_ENABLED) return;

  console.debug("OpeningFit Supabase sync succeeded", {
    table,
    operation,
    details,
  });
}

export function logSupabaseSyncWarning(table, operation, error, details = {}) {
  console.warn("OpeningFit Supabase sync warning", {
    table,
    operation,
    details: redactDetails(details),
    error: normaliseError(error),
  });
}
