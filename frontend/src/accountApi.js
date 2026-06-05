import { supabase } from "./lib/supabaseClient";

const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8001").replace(/\/$/, "");

async function readJsonOrText(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => "");
  return text ? { error: text } : {};
}

function friendlyApiError(payload, fallback) {
  const rawMessage =
    payload?.error ||
    payload?.message ||
    payload?.detail ||
    "";
  const message = typeof rawMessage === "string" ? rawMessage : fallback;

  if (/missing auth token|invalid auth token|forbidden|unauthorized|userId/i.test(message)) {
    return "Please sign in or create an account before upgrading.";
  }

  if (/stripe|checkout|price|secret|not configured/i.test(message)) {
    return "We could not start checkout. Please try again.";
  }

  return message || fallback;
}

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null };
  const token = data?.session?.access_token;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function syncAccountProfile({ user, username, platform, lastReport }) {
  if (!user?.id) return null;

  const response = await fetch(`${API_BASE}/api/account/sync`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      userId: user.id,
      email: user.email,
      displayName: user.user_metadata?.display_name || user.email || "",
      username,
      platform,
      lastReport,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Could not sync account profile.");
  }

  return response.json();
}

export async function loadAccountProfile(userId) {
  if (!userId) return null;

  const response = await fetch(`${API_BASE}/api/account/profile/${userId}`, {
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Could not load account profile.");
  }

  return response.json();
}

export async function startPremiumCheckout(user) {
  if (!user?.id) {
    throw new Error("Please sign in or create an account before upgrading.");
  }

  if (import.meta.env.DEV) {
    console.info("OpeningFit checkout requested", {
      userId: user.id,
      hasEmail: Boolean(user.email),
      apiBase: API_BASE,
    });
  }

  const response = await fetch(`${API_BASE}/api/account/create-checkout-session`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      userId: user.id,
      email: user.email,
    }),
  });

  const data = await readJsonOrText(response);

  if (!response.ok) {
    console.error("OpeningFit checkout endpoint failed", {
      status: response.status,
      payload: data,
    });
    throw new Error(friendlyApiError(data, "We could not start checkout. Please try again."));
  }

  if (!data?.url) {
    console.error("OpeningFit checkout endpoint returned no URL", data);
    throw new Error("We could not start checkout. Please try again.");
  }

  if (import.meta.env.DEV) {
    console.info("OpeningFit redirecting to Stripe checkout", {
      userId: user.id,
      hasUrl: true,
    });
  }
  window.location.href = data.url;

  return data;
}

export async function syncPremiumCheckoutSession(user, sessionId) {
  if (!user?.id || !sessionId) return null;

  const response = await fetch(`${API_BASE}/api/account/sync-checkout-session`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      userId: user.id,
      sessionId,
    }),
  });

  const data = await readJsonOrText(response);

  if (!response.ok) {
    console.error("OpeningFit checkout sync endpoint failed", {
      status: response.status,
      payload: data,
    });
    throw new Error(friendlyApiError(data, "We could not verify checkout yet. Please try again."));
  }

  return data;
}

export async function deleteOpeningFitAccount(userId) {
  if (!userId) {
    throw new Error("Missing user id.");
  }

  const response = await fetch(`${API_BASE}/api/account/${userId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Could not delete account.");
  }

  return response.json();
}
