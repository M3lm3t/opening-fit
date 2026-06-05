import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const exposedServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

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
