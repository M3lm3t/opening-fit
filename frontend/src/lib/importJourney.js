export const IMPORT_STAGES = Object.freeze({
  IDLE: "idle",
  VALIDATING: "validating_username",
  ACCOUNT_FOUND: "account_found",
  QUEUED: "queued",
  FETCHING: "fetching_games",
  GAMES_FOUND: "games_found",
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
  [IMPORT_STAGES.QUEUED]: { title: "Waiting to start", detail: "The analysis job is queued. No later stage is assumed yet." },
  [IMPORT_STAGES.FETCHING]: { title: "Finding recent games", detail: "Requesting available public games from the selected platform." },
  [IMPORT_STAGES.GAMES_FOUND]: { title: "Games found", detail: "Public games were returned and are ready for eligibility checks." },
  [IMPORT_STAGES.FILTERING]: { title: "Checking eligible time controls", detail: "Separating games that can support an opening report." },
  [IMPORT_STAGES.IDENTIFYING]: { title: "Identifying recurring opening positions", detail: "Grouping repeated openings and move orders." },
  [IMPORT_STAGES.RECOMMENDING]: { title: "Preparing recommendations", detail: "Comparing results and selecting practical next actions." },
  [IMPORT_STAGES.SAVING]: { title: "Preparing report", detail: "Keeping the completed report locally and syncing it when available." },
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
  const elapsedLabel = elapsed >= 15 ? `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")} elapsed` : "";
  const expectation = "Reports can take up to several minutes when public histories are large or a chess platform is responding slowly.";
  const reassurance = elapsed >= 90
    ? "This is taking longer than usual, but the request is still active."
    : "Still working — larger game histories can take a little longer.";
  if (elapsed >= 90) return { slow: true, showElapsed: true, elapsedLabel, expectation, reassurance, label: "This is taking longer than usual; the chess platform or analysis service may be responding slowly, but the request is still active." };
  return { slow: false, showElapsed: elapsed >= 15, elapsedLabel, expectation, reassurance, label: expectation };
}

const JOB_STAGE_MAP = Object.freeze({
  queued: IMPORT_STAGES.QUEUED,
  requesting_public_games: IMPORT_STAGES.FETCHING,
  games_found: IMPORT_STAGES.GAMES_FOUND,
  filtering_eligible_games: IMPORT_STAGES.FILTERING,
  identifying_openings: IMPORT_STAGES.IDENTIFYING,
  building_recommendations: IMPORT_STAGES.RECOMMENDING,
  finishing_report: IMPORT_STAGES.SAVING,
});

const IMPORT_STAGE_ORDER = Object.freeze([
  IMPORT_STAGES.QUEUED,
  IMPORT_STAGES.FETCHING,
  IMPORT_STAGES.GAMES_FOUND,
  IMPORT_STAGES.FILTERING,
  IMPORT_STAGES.IDENTIFYING,
  IMPORT_STAGES.RECOMMENDING,
  IMPORT_STAGES.SAVING,
  IMPORT_STAGES.COMPLETE,
]);

function determinateProgress(stage, counts) {
  if (stage === IMPORT_STAGES.FETCHING && counts.archivesTotal > 0) {
    return { current: Math.min(counts.archivesProcessed || 0, counts.archivesTotal), maximum: counts.archivesTotal, unit: "archives" };
  }
  if (stage === IMPORT_STAGES.IDENTIFYING && counts.analysedGames > 0 && Number.isFinite(counts.processedGames)) {
    return { current: Math.min(counts.processedGames, counts.analysedGames), maximum: counts.analysedGames, unit: "games" };
  }
  if ([IMPORT_STAGES.GAMES_FOUND, IMPORT_STAGES.SAVING, IMPORT_STAGES.COMPLETE].includes(stage)) {
    return { current: 1, maximum: 1, unit: "stage" };
  }
  return null;
}

export function mapAnalysisJobProgress(progress) {
  const rawStage = String(progress?.stage || "").trim();
  const stage = JOB_STAGE_MAP[rawStage] || null;
  const rawCounts = progress?.counts && typeof progress.counts === "object" ? progress.counts : {};
  const counts = Object.fromEntries(["fetchedGames", "eligibleGames", "analysedGames", "excludedGames", "archivesProcessed", "archivesTotal", "processedGames"].flatMap((key) => {
    const value = Number(rawCounts[key]);
    return Number.isFinite(value) && value >= 0 ? [[key, Math.round(value)]] : [];
  }));
  if (!stage) return { real: false, stage: null, counts: {}, message: "Analysis is running. Detailed stages are not available for this request." };
  const found = counts.fetchedGames;
  const suitable = counts.analysedGames;
  const excluded = counts.excludedGames;
  const stageProgress = determinateProgress(stage, counts);
  const archiveStatus = stageProgress?.unit === "archives"
    ? `Checking ${Math.min(stageProgress.current + 1, stageProgress.maximum)} of ${stageProgress.maximum} monthly archive${stageProgress.maximum === 1 ? "" : "s"}.`
    : "Connecting to the chess platform and checking recent game archives.";
  const processingStatus = stageProgress?.unit === "games"
    ? `Processing game ${stageProgress.current} of ${stageProgress.maximum}${Number.isFinite(found) ? ` from ${found} found` : ""}.`
    : `${Number.isFinite(found) ? `${found} game${found === 1 ? "" : "s"} found — ` : ""}identifying recurring openings.`;
  const prefix = Number.isFinite(found) ? `${found} game${found === 1 ? "" : "s"} found — ` : "";
  const messages = {
    [IMPORT_STAGES.QUEUED]: "Analysis is queued and will start as soon as capacity is available.",
    [IMPORT_STAGES.FETCHING]: `${archiveStatus}${Number.isFinite(found) && found > 0 ? ` ${found} game${found === 1 ? "" : "s"} found so far.` : ""}`,
    [IMPORT_STAGES.GAMES_FOUND]: Number.isFinite(found) ? `${found} public game${found === 1 ? "" : "s"} found.` : "Public games found.",
    [IMPORT_STAGES.FILTERING]: `${prefix}filtering eligible games.`,
    [IMPORT_STAGES.IDENTIFYING]: processingStatus,
    [IMPORT_STAGES.RECOMMENDING]: `${Number.isFinite(suitable) ? `${suitable} suitable for analysis${Number.isFinite(excluded) ? `, ${excluded} excluded` : ""} — ` : prefix}building recommendations from supported opening evidence.`,
    [IMPORT_STAGES.SAVING]: "Finishing the report and preparing it for this device.",
  };
  return { real: true, stage, counts, progress: stageProgress, message: messages[stage] || IMPORT_STAGE_DETAILS[stage]?.detail || "Analysis is running.", elapsedSeconds: Number(progress?.elapsedSeconds) || 0, lastUpdatedAt: progress?.lastUpdatedAt || null };
}

export function mergeAnalysisJobProgress(previous, incoming) {
  if (!incoming?.real) return previous?.real ? previous : incoming;
  if (!previous?.real) return incoming;
  const previousIndex = IMPORT_STAGE_ORDER.indexOf(previous.stage);
  const incomingIndex = IMPORT_STAGE_ORDER.indexOf(incoming.stage);
  if (previousIndex > incomingIndex && incomingIndex >= 0) return previous;
  if (previous.stage !== incoming.stage || !previous.progress || !incoming.progress) return incoming;
  if (previous.progress.unit !== incoming.progress.unit) return incoming;
  const previousRatio = previous.progress.maximum > 0 ? previous.progress.current / previous.progress.maximum : 0;
  const incomingRatio = incoming.progress.maximum > 0 ? incoming.progress.current / incoming.progress.maximum : 0;
  if (incomingRatio < previousRatio) return previous;
  return incoming;
}

export function waitForProgressCompletion(signal, delay = 350, timers = globalThis) {
  return new Promise((resolve) => {
    let settled = false;
    let handleAbort = () => {};
    const finish = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.("abort", handleAbort);
      resolve();
    };
    const timeoutId = timers.setTimeout(finish, Math.max(0, Number(delay) || 0));
    handleAbort = () => {
      timers.clearTimeout(timeoutId);
      finish();
    };
    if (signal?.aborted) handleAbort();
    else signal?.addEventListener?.("abort", handleAbort, { once: true });
  });
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
  if (error?.type === "timeout") return { ...common, category: "analysis_timed_out", title: "Analysis timed out", message: "The analysis took too long, so OpeningFit stopped waiting. Retry, choose a shorter period, or return later." };
  if (error?.type === "network") return { ...common, category: "network_server_failure", title: "Network or analysis server failure", message: "OpeningFit could not reach the analysis service. Check your connection, then retry." };
  if (error?.type === "empty" || error?.type === "parse") return { ...common, category: "invalid_api_response", title: "Invalid analysis response", message: "The analysis service returned an incomplete response. Retrying is appropriate." };
  if (status === 403 && /up to .*months|paid|premium|access/.test(raw)) return { ...common, category: "account_limit", title: "This analysis range is not available", message: "Choose a history range included with this account, then try again.", canRetry: false };
  if (/private|privacy|not public/.test(raw)) return { ...common, category: "private_profile", title: `${platformLabel} games are not public`, message: "OpeningFit can only analyse public games. Change the platform privacy setting or use another public account.", canRetry: false };
  if (status === 401 || status === 403) return { ...common, category: "platform_account_unavailable", title: `${platformLabel} account unavailable`, message: "The platform would not provide public account data. Check account visibility or try another platform." };
  if (status === 404 || /not found|could not find/.test(raw)) return { ...common, category: "username_not_found", title: "Username not found", message: `No public ${platformLabel} account matched that username. Check the spelling and platform.`, canRetry: false };
  if (status === 429 || ([502, 503, 504].includes(status) && /chess\.com|lichess|external platform|rate limit/.test(raw))) return { ...common, category: "platform_temporarily_unavailable", title: `${platformLabel} is temporarily unavailable`, message: "The chess platform is busy or unavailable. Wait briefly, then retry." };
  if ([500, 502, 503, 504].includes(status)) return { ...common, category: "network_server_failure", title: "Analysis server failure", message: "OpeningFit's analysis service could not finish the request. Retry in a moment." };
  if (/no public games|no games/.test(raw)) return { ...common, category: "no_public_games", title: "No public games found", message: "The account exists, but no recent public games were available. Expand the period or switch platform.", canRetry: false };
  if (/no eligible|filtered out|unsupported time control/.test(raw)) return { ...common, category: "no_eligible_games", title: "No games matched the report filters", message: "Public games were found, but none matched the selected date and time-control filters. Broaden the settings and try again.", canRetry: false };
  if (/too few|not enough|insufficient/.test(raw)) return { ...common, category: "too_few_games", title: "Too few eligible games", message: "There are not enough eligible games for a reliable report. Include more time controls or expand the period.", canRetry: false };
  if (error?.category === "authentication_expired") return { ...common, category: "authentication_expired", title: "Report complete—sign in again to save", message: "Your login expired during cloud save. The report remains available locally." };
  if (error?.category === "premium_entitlement_failure") return { ...common, category: "premium_entitlement_failure", title: "Report complete—premium access needs checking", message: "The report was created, but premium access could not be confirmed. Nothing was removed." };
  if (error?.category === "cloud_save_failure") return { ...common, category: "cloud_save_failure", title: "Report complete—cloud save failed", message: "The report is available on this device. Retry account sync when the connection is stable." };
  return { ...common, category: "unknown_import_error", title: "Analysis did not finish", message: "OpeningFit could not complete this import. Check the details and retry." };
}

export function recoveryActionsForImportFailure(category, { canExpand = true, hasPreviousReport = false } = {}) {
  const actions = [];
  if (["platform_temporarily_unavailable", "network_server_failure", "analysis_timed_out", "unknown_import_error", "invalid_api_response"].includes(category)) actions.push("retry");
  if (["username_not_found", "no_public_games", "no_eligible_games", "too_few_games", "platform_temporarily_unavailable"].includes(category)) actions.push("switch_platform");
  if (canExpand && ["no_public_games", "no_eligible_games", "too_few_games"].includes(category)) actions.push("expand_period");
  if (["no_eligible_games", "analysis_timed_out"].includes(category)) actions.push("adjust_settings");
  if (["no_public_games", "no_eligible_games", "too_few_games"].includes(category)) actions.push("sample");
  if (hasPreviousReport) actions.push("last_report");
  return [...new Set(actions)];
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
