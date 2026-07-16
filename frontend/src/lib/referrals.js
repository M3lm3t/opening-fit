export const REFERRAL_STORAGE_KEY = "openingfit_referral";
export const REFERRAL_VISITOR_KEY = "openingfit_referral_visitor_id";
export const REFERRAL_CAPTURED_EVENT = "openingfit:referral-captured";
export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CODE_PATTERN = /^[a-z0-9_-]+$/;

function browserStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function readJson(storage, key) {
  try {
    return JSON.parse(storage?.getItem?.(key) || "null");
  } catch {
    return null;
  }
}

function removeItem(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    // Referral storage must never block the product.
  }
}

function writeItem(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
    return true;
  } catch {
    return false;
  }
}

function rpcRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null;
}

function emitCaptured(referral) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent(REFERRAL_CAPTURED_EVENT, {
    detail: { partnerName: referral.partnerName },
  }));
}

function createVisitorId(storage, visitorIdFactory) {
  try {
    const existing = String(storage?.getItem?.(REFERRAL_VISITOR_KEY) || "").trim();
    if (existing) return existing;
  } catch {
    // Fall through to an in-memory ID when browser storage is unavailable.
  }

  const generated = visitorIdFactory?.()
    || globalThis.crypto?.randomUUID?.()
    || `visitor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  writeItem(storage, REFERRAL_VISITOR_KEY, generated);
  return generated;
}

async function validateCode(code, rpc) {
  if (typeof rpc !== "function") return { valid: false, error: new Error("Referral validation unavailable.") };
  try {
    const { data, error } = await rpc("validate_referral_code", { input_code: code });
    if (error) return { valid: false, error };
    const row = rpcRow(data);
    return {
      valid: Boolean(row?.valid),
      code: normalizeReferralCode(row?.normalized_code || code),
      partnerName: String(row?.partner_display_name || "").trim(),
    };
  } catch (error) {
    return { valid: false, error };
  }
}

export function normalizeReferralCode(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized.length > 50 || !CODE_PATTERN.test(normalized)) return "";
  return normalized;
}

export function getStoredReferral({ storage = browserStorage(), now = Date.now() } = {}) {
  const stored = readJson(storage, REFERRAL_STORAGE_KEY);
  if (!stored || normalizeReferralCode(stored.code) !== stored.code) return null;
  if (!String(stored.partnerName || "").trim() || !String(stored.visitorId || "").trim()) return null;
  const capturedAt = Date.parse(stored.capturedAt);
  const expiresAt = Date.parse(stored.expiresAt);
  if (!Number.isFinite(capturedAt) || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return stored;
}

export function clearExpiredReferral({ storage = browserStorage(), now = Date.now() } = {}) {
  const raw = readJson(storage, REFERRAL_STORAGE_KEY);
  if (!raw) return false;
  const expiresAt = Date.parse(raw.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > now && normalizeReferralCode(raw.code) === raw.code) {
    return false;
  }
  removeItem(storage, REFERRAL_STORAGE_KEY);
  return true;
}

export async function captureReferralCode(inputCode, {
  storage = browserStorage(),
  rpc,
  now = Date.now(),
  landingPath = typeof window !== "undefined" ? window.location.pathname : "/",
  visitorIdFactory,
  notify = true,
  onError,
} = {}) {
  clearExpiredReferral({ storage, now });
  const existing = getStoredReferral({ storage, now });
  const code = normalizeReferralCode(inputCode);

  if (!code) return { success: false, reason: "invalid-format" };
  if (existing) {
    return {
      success: true,
      referral: existing,
      preserved: true,
      reason: existing.code === code ? "already-captured" : "first-touch-preserved",
    };
  }

  const validation = await validateCode(code, rpc);
  if (!validation.valid || !validation.code || !validation.partnerName) {
    if (validation.error) onError?.(validation.error, "validate");
    return { success: false, reason: validation.error ? "validation-unavailable" : "invalid-code" };
  }

  const visitorId = createVisitorId(storage, visitorIdFactory);
  const referral = {
    code: validation.code,
    partnerName: validation.partnerName,
    visitorId,
    capturedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + REFERRAL_TTL_MS).toISOString(),
  };
  if (!writeItem(storage, REFERRAL_STORAGE_KEY, JSON.stringify(referral))) {
    return { success: false, reason: "storage-unavailable" };
  }

  try {
    const { error } = await rpc("record_referral_visit", {
      input_code: referral.code,
      input_visitor_id: referral.visitorId,
      input_landing_path: landingPath,
    });
    if (error) onError?.(error, "record-visit");
  } catch (error) {
    onError?.(error, "record-visit");
  }

  if (notify) emitCaptured(referral);
  return { success: true, referral, preserved: false };
}

export async function captureReferralFromUrl({
  href = typeof window !== "undefined" ? window.location.href : "",
  history = typeof window !== "undefined" ? window.history : null,
  ...options
} = {}) {
  if (!href) return { success: false, reason: "no-url" };
  let url;
  try {
    url = new URL(href, "https://www.openingfit.com");
  } catch {
    return { success: false, reason: "invalid-url" };
  }

  const supplied = url.searchParams.get("ref") ?? url.searchParams.get("referral");
  if (supplied === null) return { success: false, reason: "no-referral" };
  const result = await captureReferralCode(supplied, {
    ...options,
    landingPath: url.pathname,
  });

  if (result.success) {
    url.searchParams.delete("ref");
    url.searchParams.delete("referral");
    history?.replaceState?.(history.state ?? null, "", `${url.pathname}${url.search}${url.hash}`);
  }
  return result;
}

export async function attachStoredReferralToAuthenticatedUser({
  storage = browserStorage(),
  rpc,
  now = Date.now(),
  onError,
} = {}) {
  clearExpiredReferral({ storage, now });
  const referral = getStoredReferral({ storage, now });
  if (!referral) return { success: false, reason: "no-referral" };
  if (typeof rpc !== "function") return { success: false, reason: "rpc-unavailable" };

  try {
    const { data, error } = await rpc("attach_referral_to_user", {
      input_code: referral.code,
      input_visitor_id: referral.visitorId,
    });
    if (error) {
      onError?.(error, "attach");
      return { success: false, reason: "attach-failed" };
    }
    const row = rpcRow(data);
    return { success: Boolean(row?.success), code: row?.code || referral.code, status: row?.status || "registered" };
  } catch (error) {
    onError?.(error, "attach");
    return { success: false, reason: "attach-failed" };
  }
}
