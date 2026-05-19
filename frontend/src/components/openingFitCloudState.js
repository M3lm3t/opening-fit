const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function normalisePlatform(value) {
  const platform = String(value || "unknown").trim().toLowerCase();

  if (["chess.com", "chesscom", "chess_com"].includes(platform)) {
    return "chesscom";
  }

  if (["lichess", "lichess.org"].includes(platform)) {
    return "lichess";
  }

  return platform || "unknown";
}

function getUsername(data = {}) {
  return (
    data?.username ||
    data?.player ||
    data?.handle ||
    localStorage.getItem("openingFit:lastUsername") ||
    "guest"
  );
}

function getPlatform(data = {}) {
  return normalisePlatform(
    data?.platform ||
      data?.source ||
      localStorage.getItem("openingFit:lastPlatform") ||
      "unknown"
  );
}

export function getCloudIdentity(user, data = {}) {
  if (!user?.id) return null;

  return {
    userId: user.id,
    platform: getPlatform(data),
    username: getUsername(data),
  };
}

export async function fetchOpeningFitCloudState(user, data = {}) {
  const identity = getCloudIdentity(user, data);
  if (!identity) return null;

  const params = new URLSearchParams({
    platform: identity.platform,
    username: identity.username,
  });

  const response = await fetch(
    `${API_BASE}/api/account/state/${identity.userId}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Cloud state fetch failed: ${response.status}`);
  }

  return response.json();
}

export async function saveOpeningFitCloudState(user, data = {}, partialState = {}) {
  const identity = getCloudIdentity(user, data);
  if (!identity) return null;

  const response = await fetch(`${API_BASE}/api/account/state`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: identity.userId,
      platform: identity.platform,
      username: identity.username,
      ...partialState,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Cloud state save failed: ${response.status}`);
  }

  return response.json();
}
