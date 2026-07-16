import { buildApiUrl } from "./apiBase";
import { supabase } from "./supabaseClient";

async function authHeaders(extra = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null };
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sign in with an authorised admin account.");
  return { ...extra, Authorization: `Bearer ${token}` };
}

async function adminRequest(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: await authHeaders(options.headers),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.error || "Referral admin request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function loadReferralAdminReport(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
  return adminRequest(`/api/admin/referrals${query.size ? `?${query}` : ""}`);
}

export async function createReferralPartner(payload) {
  return adminRequest("/api/admin/referrals/partners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function downloadReferralCsv(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
  const path = `/api/admin/referrals/export.csv${query.size ? `?${query}` : ""}`;
  const response = await fetch(buildApiUrl(path), {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Referral export failed.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "openingfit-referrals.csv";
  link.click();
  URL.revokeObjectURL(url);
}
