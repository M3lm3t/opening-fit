import { supabase } from "./lib/supabaseClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

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
    throw new Error("Please log in before upgrading.");
  }

  const response = await fetch(`${API_BASE}/api/account/create-checkout-session`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      userId: user.id,
      email: user.email,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Could not start checkout.");
  }

  const data = await response.json();

  if (data?.url) {
    window.location.href = data.url;
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
