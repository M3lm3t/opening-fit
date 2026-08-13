import { isNativeApp } from "./platform.js";
import { supabase } from "./supabaseClient.js";

export const PRODUCTION_AUTH_ORIGIN = "https://www.openingfit.com";

export function getAuthRedirectUrl(path = "/account") {
  const cleanPath = String(path || "/account").startsWith("/") ? String(path || "/account") : `/${path}`;
  if (isNativeApp() || typeof window === "undefined") return `${PRODUCTION_AUTH_ORIGIN}${cleanPath}`;

  const { hostname, origin } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
  const authOrigin = isLocalhost
    ? origin
    : hostname === "www.openingfit.com" || hostname === "openingfit.com" || hostname.endsWith(".vercel.app")
      ? PRODUCTION_AUTH_ORIGIN
      : origin;
  return `${authOrigin}${cleanPath}`;
}

export function isAuthCallbackUrl(url) {
  if (!url) return false;
  const callback = new URL(url);
  const fragment = new URLSearchParams(callback.hash.replace(/^#/, ""));
  return callback.searchParams.has("code") ||
    callback.searchParams.has("error") ||
    (fragment.has("access_token") && fragment.has("refresh_token"));
}

export async function restoreSessionFromAuthUrl(url) {
  if (!supabase || !url) return false;
  const callback = new URL(url);
  const query = callback.searchParams;
  const fragment = new URLSearchParams(callback.hash.replace(/^#/, ""));
  const code = query.get("code");
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return true;
  }
  return false;
}
