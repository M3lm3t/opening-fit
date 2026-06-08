const DEFAULT_DEV_API_BASE_URL = "http://127.0.0.1:8001";

export function getApiBaseUrl() {
  const envBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();

  if (envBase) {
    return envBase.replace(/\/+$/, "");
  }

  if (import.meta.env.PROD) {
    throw new Error("Missing VITE_API_BASE_URL for OpeningFit production API calls.");
  }

  return DEFAULT_DEV_API_BASE_URL;
}

export function buildApiUrl(path) {
  const cleanPath = String(path || "");
  const normalizedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function logApiDiagnostic(label, details = {}) {
  if (!import.meta.env.DEV) return;
  console.info(`OpeningFit API diagnostic: ${label}`, details);
}
