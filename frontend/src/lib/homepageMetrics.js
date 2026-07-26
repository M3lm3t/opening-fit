import { buildApiUrl } from "./apiBase.js";

export const GAMES_ANALYSED_CREDIBILITY_THRESHOLD = 100;
export const GAMES_ANALYSED_SOURCE = "analysed_games_unique_saved_records";

const integerMetric = (value) => {
  if (typeof value !== "number") return null;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
};

export function formatGamesAnalysedMetric(value) {
  const count = integerMetric(value);
  if (count === null || count < GAMES_ANALYSED_CREDIBILITY_THRESHOLD) return null;
  if (count <= 10_000 || count % 10_000 === 0) return `${new Intl.NumberFormat("en-GB").format(count)} games analysed`;
  const supportedFloor = Math.floor(count / 10_000) * 10_000;
  return `Over ${new Intl.NumberFormat("en-GB").format(supportedFloor)} games analysed`;
}

export function resolveGamesAnalysedMetric({ loading = false, payload = null, failed = false } = {}) {
  if (loading || failed || payload?.ok !== true || payload?.source !== GAMES_ANALYSED_SOURCE) return null;
  const label = formatGamesAnalysedMetric(payload.count);
  return label ? { count: integerMetric(payload.count), label } : null;
}

export async function fetchGamesAnalysedMetric(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") return null;
  try {
    const response = await fetchImpl(buildApiUrl("/api/public/games-analysed-count"), { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return resolveGamesAnalysedMetric({ payload: await response.json() });
  } catch {
    return null;
  }
}
