export const IMPORT_STAGES = Object.freeze({
  IDLE: "idle",
  VALIDATING: "validating_username",
  ACCOUNT_FOUND: "account_found",
  FETCHING: "fetching_games",
  FILTERING: "filtering_eligible_games",
  IDENTIFYING: "identifying_openings",
  RECOMMENDING: "building_recommendations",
  SAVING: "saving_report",
  COMPLETE: "complete",
  RECOVERABLE_ERROR: "recoverable_error",
  FATAL_ERROR: "fatal_error",
});

export const IMPORT_STAGE_DETAILS = Object.freeze({
  [IMPORT_STAGES.VALIDATING]: { title: "Checking username", detail: "Validating the username and selected platform." },
  [IMPORT_STAGES.ACCOUNT_FOUND]: { title: "Account found", detail: "The platform account is available for analysis." },
  [IMPORT_STAGES.FETCHING]: { title: "Finding recent games", detail: "Requesting available public games from the selected platform." },
  [IMPORT_STAGES.FILTERING]: { title: "Checking eligible time controls", detail: "Separating games that can support an opening report." },
  [IMPORT_STAGES.IDENTIFYING]: { title: "Identifying recurring opening positions", detail: "Grouping repeated openings and move orders." },
  [IMPORT_STAGES.RECOMMENDING]: { title: "Preparing recommendations", detail: "Comparing results and selecting practical next actions." },
  [IMPORT_STAGES.SAVING]: { title: "Saving report", detail: "Keeping the completed report locally and syncing it when available." },
  [IMPORT_STAGES.COMPLETE]: { title: "Report complete", detail: "Your latest successful report is ready." },
});

export function validateImportUsername(username) {
  const value = String(username || "").trim();
  if (!value) return { ok: false, category: "empty_username", message: "Enter a username to continue." };
  if (value.length < 2 || value.length > 30 || !/^[a-z0-9_-]+$/i.test(value)) {
    return {
      ok: false,
      category: "unsupported_username_format",
      message: "Use only letters, numbers, underscores, or hyphens (2–30 characters).",
    };
  }
  return { ok: true, value };
}

export function buildImportRequestKey({ platform, username, months, timeControl = "custom" }) {
  return [platform, String(username || "").trim().toLowerCase(), Number(months) || 3, timeControl].join(":");
}

export function isSafeAutomaticRetry(error, attempt = 0, maxRetries = 2) {
  if (attempt >= maxRetries) return false;
  if (error?.type === "network") return true;
  return error?.type === "http" && [502, 503, 504].includes(Number(error?.status));
}

export function retryDelay(attempt) {
  return Math.min(2400, 400 * (2 ** Math.max(0, Number(attempt) || 0)));
}

export function analysisTimingStatus(elapsedSeconds = 0) {
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  if (elapsed >= 90) return { slow: true, label: "This is taking longer than the usual 15-second to 3-minute window. The chess platform or analysis service may be responding slowly." };
  return { slow: false, label: "Most reports finish in about 15 seconds to 3 minutes; large public histories can take longer." };
}

export function classifyImportFailure({ error, platform = "chesscom", hadPreviousReport = false, reportCreated = false }) {
  const platformLabel = platform === "lichess" ? "Lichess" : "Chess.com";
  const status = Number(error?.status) || null;
  const raw = String(error?.message || "").toLowerCase();
  const retained = hadPreviousReport || reportCreated;
  const common = {
    retained,
    lossMessage: retained
      ? "Your previous successful report is still available."
      : "No completed report was replaced.",
    canRetry: true,
    fatal: false,
  };

  if (error?.category === "empty_username") return { ...common, category: "empty_username", title: "Username required", message: error.message, canRetry: false };
  if (error?.category === "unsupported_username_format") return { ...common, category: "unsupported_username_format", title: "Check the username format", message: error.message, canRetry: false };
  if (error?.type === "timeout") return { ...common, category: "request_timeout", title: `${platformLabel} import timed out`, message: "The request took too long, so OpeningFit stopped waiting. Try again, use a shorter period, or return later." };
  if (error?.type === "network") return { ...common, category: "backend_unavailable", title: "Analysis service unavailable", message: "OpeningFit could not reach the analysis service. Check your connection and retry." };
  if (error?.type === "empty" || error?.type === "parse") return { ...common, category: "invalid_api_response", title: "Invalid analysis response", message: "The analysis service returned an incomplete response. Retrying is appropriate." };
  if (status === 403 && /up to .*months|paid|premium|access/.test(raw)) return { ...common, category: "account_limit", title: "This analysis range is not available", message: "Choose a history range included with this account, then try again.", canRetry: false };
  if (/private|privacy|not public/.test(raw)) return { ...common, category: "private_profile", title: `${platformLabel} games are not public`, message: "OpeningFit can only analyse public games. Change the platform privacy setting or use another public account.", canRetry: false };
  if (status === 401 || status === 403) return { ...common, category: "platform_account_unavailable", title: `${platformLabel} account unavailable`, message: "The platform would not provide public account data. Check account visibility or try another platform." };
  if (status === 404 || /not found|could not find/.test(raw)) return { ...common, category: "username_not_found", title: "Username not found", message: `No public ${platformLabel} account matched that username. Check the spelling and platform.`, canRetry: false };
  if ([429, 502, 503, 504].includes(status)) return { ...common, category: "platform_temporarily_unavailable", title: `${platformLabel} is temporarily unavailable`, message: "The external platform is busy or unavailable. Wait briefly, then retry." };
  if (/no public games|no games/.test(raw)) return { ...common, category: "no_public_games", title: "No public games found", message: "The account exists, but no recent public games were available. Expand the period or switch platform.", canRetry: false };
  if (/no eligible|filtered out|unsupported time control/.test(raw)) return { ...common, category: "no_eligible_games", title: "No games matched the report filters", message: "Public games were found, but none matched the selected date and time-control filters. Broaden the settings and try again.", canRetry: false };
  if (/too few|not enough|insufficient/.test(raw)) return { ...common, category: "too_few_games", title: "Too few eligible games", message: "There are not enough eligible games for a reliable report. Include more time controls or expand the period.", canRetry: false };
  if (error?.category === "authentication_expired") return { ...common, category: "authentication_expired", title: "Report complete—sign in again to save", message: "Your login expired during cloud save. The report remains available locally." };
  if (error?.category === "premium_entitlement_failure") return { ...common, category: "premium_entitlement_failure", title: "Report complete—premium access needs checking", message: "The report was created, but premium access could not be confirmed. Nothing was removed." };
  if (error?.category === "cloud_save_failure") return { ...common, category: "cloud_save_failure", title: "Report complete—cloud save failed", message: "The report is available on this device. Retry account sync when the connection is stable." };
  return { ...common, category: "unknown_import_error", title: "Analysis did not finish", message: "OpeningFit could not complete this import. Check the details and retry." };
}

export async function runWithControlledRetry(operation, { maxRetries = 2, onRetry, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!isSafeAutomaticRetry(error, attempt, maxRetries)) throw error;
      const delay = retryDelay(attempt);
      attempt += 1;
      onRetry?.({ attempt, delay, error });
      await wait(delay);
    }
  }
}
