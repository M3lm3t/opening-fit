import { createClient } from "@supabase/supabase-js";

const viteEnv = import.meta.env || {};
const supabaseUrl = String(viteEnv.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(viteEnv.VITE_SUPABASE_ANON_KEY || "").trim();
const exposedServiceRoleKey = viteEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
const debugSupabase =
  viteEnv.DEV ||
  (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debugSupabase"));

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const SUPABASE_AUTH_STORAGE_KEY = "openingfit:supabase.auth";

function getSupabaseProjectRef() {
  if (!supabaseUrl) return "";

  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function getLegacySupabaseAuthKeys() {
  if (typeof window === "undefined" || !window.localStorage) return [];

  const projectRef = getSupabaseProjectRef();
  const keys = new Set([
    projectRef ? `sb-${projectRef}-auth-token` : "",
    "supabase.auth.token",
  ]);

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (/^sb-.+-auth-token$/.test(String(key || ""))) {
        keys.add(key);
      }
    }
  } catch {
    // Browser storage can be unavailable in private contexts.
  }

  keys.delete("");
  keys.delete(SUPABASE_AUTH_STORAGE_KEY);

  return [...keys];
}

function getBrowserStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

const authStorage = {
  getItem(key) {
    const storage = getBrowserStorage();
    if (!storage) return null;

    try {
      const currentValue = storage.getItem(key);
      if (currentValue) return currentValue;

      if (key !== SUPABASE_AUTH_STORAGE_KEY) return null;

      for (const legacyKey of getLegacySupabaseAuthKeys()) {
        const legacyValue = storage.getItem(legacyKey);
        if (legacyValue) {
          storage.setItem(SUPABASE_AUTH_STORAGE_KEY, legacyValue);
          return legacyValue;
        }
      }
    } catch {
      return null;
    }

    return null;
  },
  setItem(key, value) {
    const storage = getBrowserStorage();
    if (!storage) return;

    try {
      storage.setItem(key, value);

      if (key === SUPABASE_AUTH_STORAGE_KEY) {
        getLegacySupabaseAuthKeys().forEach((legacyKey) => {
          storage.removeItem(legacyKey);
        });
      }
    } catch {
      // Browser storage can be unavailable in private contexts.
    }
  },
  removeItem(key) {
    const storage = getBrowserStorage();
    if (!storage) return;

    try {
      storage.removeItem(key);

      if (key === SUPABASE_AUTH_STORAGE_KEY) {
        getLegacySupabaseAuthKeys().forEach((legacyKey) => {
          storage.removeItem(legacyKey);
        });
      }
    } catch {
      // Browser storage can be unavailable in private contexts.
    }
  },
};

export function clearStoredSupabaseSession() {
  authStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
}

if (exposedServiceRoleKey) {
  throw new Error(
    "OpeningFit security error: never expose VITE_SUPABASE_SERVICE_ROLE_KEY in the frontend."
  );
}

if (!isSupabaseConfigured) {
  const missing = [
    !supabaseUrl ? "VITE_SUPABASE_URL" : null,
    !supabaseAnonKey ? "VITE_SUPABASE_ANON_KEY" : null,
  ].filter(Boolean);
  const message = `OpeningFit Supabase is not configured. Missing ${missing.join(
    " and "
  )}. Cloud auth/save/load is disabled.`;

  console.warn(message);
}

if (debugSupabase) {
  let urlHost = "";
  try {
    urlHost = supabaseUrl ? new URL(supabaseUrl).host : "";
  } catch {
    urlHost = "invalid-url";
  }

  console.info("Supabase config", {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    urlHost,
  });
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        storage: authStorage,
      },
    })
  : null;

export async function diagnoseSupabase() {
  if (!debugSupabase || !supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const result = {
    ok: true,
    hasSession: Boolean(sessionData?.session),
    userId: sessionData?.session?.user?.id || null,
  };

  console.info("Supabase session diagnostic", {
    hasSession: result.hasSession,
    userId: result.userId,
  });

  return result;
}

if (debugSupabase && supabase) {
  diagnoseSupabase().catch((error) => {
    console.warn("Supabase diagnostic failed", error);
  });
}
