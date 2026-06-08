import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const exposedServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const debugSupabase =
  import.meta.env.DEV ||
  (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debugSupabase"));

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

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
        storageKey: "openingfit:supabase.auth",
      },
    })
  : null;

export async function diagnoseSupabase() {
  if (!debugSupabase || !supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  console.info("Supabase session diagnostic", {
    hasSession: Boolean(sessionData?.session),
    userId: sessionData?.session?.user?.id || null,
  });

  const result = await supabase
    .from("settings")
    .select("user_id")
    .limit(1);

  console.info("Supabase REST diagnostic", {
    ok: !result.error,
    error: result.error,
  });

  return result;
}

if (debugSupabase && supabase) {
  diagnoseSupabase().catch((error) => {
    console.warn("Supabase diagnostic failed", error);
  });
}
