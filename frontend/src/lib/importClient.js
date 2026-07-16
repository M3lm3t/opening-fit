import { buildApiUrl } from "./apiBase.js";

const IMPORT_TIMEOUT_MS = 15 * 60 * 1000;
const JOB_START_TIMEOUT_MS = 75000;
const JOB_POLL_INTERVAL_MS = 1400;

export class ImportClientError extends Error {
  constructor({ type, status = null, message, responseText = "", url = "", errorName = "" }) {
    super(message);
    this.name = "ImportClientError";
    this.type = type;
    this.status = status;
    this.responseText = responseText;
    this.url = url;
    this.errorName = errorName;
  }
}

function platformPath(platform) {
  if (platform === "chesscom" || platform === "chess.com") return "chesscom";
  if (platform === "lichess") return "lichess";
  return String(platform || "").trim();
}

function backendMessageFromJson(json, fallback) {
  return json?.message || json?.detail || json?.error || fallback;
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const timeoutId = globalThis.setTimeout(finish, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timeoutId);
      reject(new DOMException("Import cancelled.", "AbortError"));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function readJsonResponse(response, url) {
  let responseText = "";
  try {
    responseText = await response.text();
  } catch {
    // The structured error below explains an unreadable response.
  }
  if (!responseText) {
    throw new ImportClientError({
      type: "empty",
      status: response.status,
      message: `Import response was empty${response.status ? ` (HTTP ${response.status})` : ""}.`,
      responseText,
      url,
    });
  }
  try {
    return { json: JSON.parse(responseText), responseText };
  } catch {
    throw new ImportClientError({
      type: "parse",
      status: response.status,
      message: `Import response was not valid JSON${response.status ? ` (HTTP ${response.status})` : ""}.`,
      responseText,
      url,
    });
  }
}

async function legacyImport({ apiPath, cleanUsername, safeMonths, abortController }) {
  const url = buildApiUrl(
    `/api/import/${apiPath}/${encodeURIComponent(cleanUsername)}?months=${safeMonths}`
  );
  let response;
  try {
    response = await fetch(url, { signal: abortController.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ImportClientError({
        type: "unknown",
        message: "Import cancelled.",
        url,
        errorName: error?.name || "",
      });
    }

    throw new ImportClientError({
      type: "network",
      message: "OpeningFit could not reach the analysis server. Please try again in a moment.",
      url,
      errorName: error?.name || "TypeError",
    });
  }
  const { json, responseText } = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new ImportClientError({
      type: "http",
      status: response.status,
      message: backendMessageFromJson(json, `Import request failed with HTTP ${response.status}.`),
      responseText,
      url,
    });
  }

  return {
    data: json,
    url,
    status: response.status,
    responseText,
  };
}

export async function importGames({ platform, username, months, controller, onJobStarted }) {
  const apiPath = platformPath(platform);
  const cleanUsername = String(username || "").trim();
  const safeMonths = Number.isFinite(Number(months)) ? Number(months) : 3;
  const abortController = controller || new AbortController();
  const startUrl = buildApiUrl("/api/analysis/jobs");
  let timedOut = false;
  let startTimedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, IMPORT_TIMEOUT_MS);

  try {
    const startTimeout = globalThis.setTimeout(() => {
      startTimedOut = true;
      abortController.abort();
    }, JOB_START_TIMEOUT_MS);
    let startResponse;
    try {
      startResponse = await fetch(startUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: apiPath, username: cleanUsername, months: safeMonths }),
        signal: abortController.signal,
      });
    } finally {
      globalThis.clearTimeout(startTimeout);
    }

    if ([404, 405].includes(startResponse.status)) {
      return await legacyImport({ apiPath, cleanUsername, safeMonths, abortController });
    }

    const { json: started, responseText: startText } = await readJsonResponse(startResponse, startUrl);
    if (!startResponse.ok) {
      throw new ImportClientError({
        type: "http",
        status: startResponse.status,
        message: backendMessageFromJson(started, `Analysis could not start (HTTP ${startResponse.status}).`),
        responseText: startText,
        url: startUrl,
      });
    }
    if (!started?.jobId) {
      throw new ImportClientError({ type: "parse", status: startResponse.status, message: "Analysis server did not return a job ID.", responseText: startText, url: startUrl });
    }

    onJobStarted?.(started);
    const statusUrl = buildApiUrl(`/api/analysis/jobs/${encodeURIComponent(started.jobId)}`);
    while (true) {
      if (abortController.signal.aborted) throw new DOMException("Import cancelled.", "AbortError");
      const statusResponse = await fetch(statusUrl, { signal: abortController.signal });
      const { json: job, responseText } = await readJsonResponse(statusResponse, statusUrl);
      if (!statusResponse.ok) {
        throw new ImportClientError({ type: "http", status: statusResponse.status, message: backendMessageFromJson(job, "Could not check analysis progress."), responseText, url: statusUrl });
      }
      if (job.status === "completed") {
        return { data: job.result, url: statusUrl, status: statusResponse.status, responseText: JSON.stringify(job.result) };
      }
      if (job.status === "failed") {
        throw new ImportClientError({ type: "http", status: job.error?.status || 500, message: job.error?.message || "Analysis failed.", responseText, url: statusUrl });
      }
      await delay(JOB_POLL_INTERVAL_MS, abortController.signal);
    }
  } catch (error) {
    if (error instanceof ImportClientError) throw error;
    if (timedOut || startTimedOut || error?.name === "AbortError") {
      throw new ImportClientError({
        type: timedOut || startTimedOut ? "timeout" : "unknown",
        message: timedOut
          ? "The analysis took too long. Your previous report is unchanged; please try again."
          : startTimedOut
            ? "The analysis server took too long to start. Please try again."
            : "Import cancelled.",
        url: startUrl,
        errorName: error?.name || "",
      });
    }
    throw new ImportClientError({ type: "network", message: "OpeningFit could not reach the analysis server. Please try again in a moment.", url: startUrl, errorName: error?.name || "TypeError" });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
