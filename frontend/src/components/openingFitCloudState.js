import { getSettings, saveSettings } from "../services/userDataService";

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

  const settings = await getSettings(identity.userId);
  const stateKey = `${identity.platform}:${identity.username}`.toLowerCase();
  return settings?.preferences?.openingFitState?.[stateKey] || null;
}

export async function saveOpeningFitCloudState(user, data = {}, partialState = {}) {
  const identity = getCloudIdentity(user, data);
  if (!identity) return null;

  const settings = await getSettings(identity.userId);
  const stateKey = `${identity.platform}:${identity.username}`.toLowerCase();
  const currentState = settings?.preferences?.openingFitState || {};

  return saveSettings(identity.userId, {
    preferences: {
      openingFitState: {
        ...currentState,
        [stateKey]: {
          ...(currentState[stateKey] || {}),
          platform: identity.platform,
          username: identity.username,
          ...partialState,
        },
      },
    },
  });
}
