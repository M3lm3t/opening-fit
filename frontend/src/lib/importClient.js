import { buildApiUrl } from "./apiBase";

const IMPORT_TIMEOUT_MS = 90000;

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

export async function importGames({ platform, username, months, controller }) {
  const apiPath = platformPath(platform);
  const cleanUsername = String(username || "").trim();
  const safeMonths = Number.isFinite(Number(months)) ? Number(months) : 3;
  const url = buildApiUrl(
    `/api/import/${apiPath}/${encodeURIComponent(cleanUsername)}?months=${safeMonths}`
  );
  const abortController = controller || new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, IMPORT_TIMEOUT_MS);

  let response;
  let responseText = "";

  try {
    response = await fetch(url, { signal: abortController.signal });
  } catch (error) {
    window.clearTimeout(timeoutId);

    if (timedOut || error?.name === "AbortError") {
      throw new ImportClientError({
        type: timedOut ? "timeout" : "unknown",
        message: timedOut
          ? "The import took too long. Please try fewer months or try again."
          : "Import cancelled.",
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

  try {
    responseText = await response.text();
  } catch {
    responseText = "";
  } finally {
    window.clearTimeout(timeoutId);
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

  let json;

  try {
    json = JSON.parse(responseText);
  } catch {
    throw new ImportClientError({
      type: "parse",
      status: response.status,
      message: `Import response was not valid JSON${response.status ? ` (HTTP ${response.status})` : ""}.`,
      responseText,
      url,
    });
  }

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
