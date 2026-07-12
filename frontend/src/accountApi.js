import { supabase } from "./lib/supabaseClient";
import { buildApiUrl, getApiBaseUrl } from "./lib/apiBase";
import { canStartCheckout } from "./lib/premiumExperience";
import { trackProductEvent } from "./lib/productAnalytics";

async function readJsonOrText(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => "");
  return text ? { error: text } : {};
}

function friendlyApiError(payload, fallback) {
  if (payload?.code === "checkout_server_not_configured") {
    return "Checkout is temporarily unavailable. Please contact support so we can fix the payment setup.";
  }

  if (payload?.code === "stripe_checkout_create_failed" || payload?.code === "stripe_checkout_missing_url") {
    return "Stripe checkout could not start. Please try again, or contact support if it keeps happening.";
  }

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

function safeDiagnosticPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  return {
    error: typeof payload.error === "string" ? payload.error : undefined,
    code: typeof payload.code === "string" ? payload.code : undefined,
    message: typeof payload.message === "string" ? payload.message : undefined,
    detail: typeof payload.detail === "string" ? payload.detail : undefined,
    ok: payload.ok,
    status: payload.status,
    paymentStatus: payload.paymentStatus,
    hasPremiumAccess: payload.hasPremiumAccess,
  };
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

  const response = await fetch(buildApiUrl("/api/account/sync"), {
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

  const response = await fetch(buildApiUrl(`/api/account/profile/${userId}`), {
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Could not load account profile.");
  }

  return response.json();
}

export async function startPremiumCheckout(user) {
  if (!canStartCheckout(user)) {
    throw new Error("Please sign in or create an account before upgrading.");
  }

  if (import.meta.env.DEV) {
    console.info("OpeningFit checkout requested", {
      userId: user.id,
      hasEmail: Boolean(user.email),
      apiBase: getApiBaseUrl(),
    });
  }

  let response;
  try {
    response = await fetch(buildApiUrl("/api/account/create-checkout-session"), {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
      }),
    });
  } catch (error) {
    console.error("OpeningFit checkout request could not reach backend", {
      apiBase: getApiBaseUrl(),
      error: {
        name: error?.name,
        message: error?.message,
      },
    });
    throw new Error("Could not reach the payment server. Please check your connection and try again.");
  }

  const data = await readJsonOrText(response);

  if (!response.ok) {
    console.error("OpeningFit checkout endpoint failed", {
      status: response.status,
      payload: safeDiagnosticPayload(data),
    });
    throw new Error(friendlyApiError(data, "We could not start checkout. Please try again."));
  }

  if (!data?.url) {
    console.error("OpeningFit checkout endpoint returned no URL", safeDiagnosticPayload(data));
    throw new Error("We could not start checkout. Please try again.");
  }

  if (import.meta.env.DEV) {
    console.info("OpeningFit redirecting to Stripe checkout", {
      userId: user.id,
      hasUrl: true,
    });
  }
  void trackProductEvent("checkout_started", { source: "account_checkout", authenticated: true });
  window.location.href = data.url;

  return data;
}

export async function syncPremiumCheckoutSession(user, sessionId) {
  if (!user?.id || !sessionId) return null;

  let response;
  try {
    response = await fetch(buildApiUrl("/api/account/sync-checkout-session"), {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        userId: user.id,
        sessionId,
      }),
    });
  } catch (error) {
    console.error("OpeningFit checkout sync could not reach backend", {
      apiBase: getApiBaseUrl(),
      error: {
        name: error?.name,
        message: error?.message,
      },
    });
    throw new Error("Could not reach the payment server to verify checkout. Please try restore access again.");
  }

  const data = await readJsonOrText(response);

  if (!response.ok) {
    console.error("OpeningFit checkout sync endpoint failed", {
      status: response.status,
      payload: safeDiagnosticPayload(data),
    });
    throw new Error(friendlyApiError(data, "We could not verify checkout yet. Please try again."));
  }

  return data;
}

export async function deleteOpeningFitAccount(userId) {
  if (!userId) {
    throw new Error("Missing user id.");
  }

  const response = await fetch(buildApiUrl(`/api/account/${userId}`), {
    method: "DELETE",
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Could not delete account.");
  }

  return response.json();
}
