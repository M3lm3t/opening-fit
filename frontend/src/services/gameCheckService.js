import { buildApiUrl } from "../lib/apiBase.js";

export function reportGamesForGameCheck(report = {}) {
  return [report.games, report.opening_games, report.openingGames, report.recent_games, report.recentGames, report.saved_games, report.savedGames].find((rows) => Array.isArray(rows) && rows.length) || [];
}

export async function evaluateGameCheck({ report, checkpoint, priority, responsePlan, comparable = false, signal, fetchImpl = fetch } = {}) {
  const games = reportGamesForGameCheck(report);
  const counts = report?.gameCounts || report?.game_counts || {};
  const importLimit = Number(counts.analysisLimit ?? counts.analysis_limit);
  const response = await fetchImpl(buildApiUrl("/api/game-check/evaluate"), { method: "POST", headers: { "Content-Type": "application/json" }, signal, body: JSON.stringify({ games, checked_ids: checkpoint?.checked_game_ids || [], priority, response_plan: responsePlan, comparable: Boolean(comparable), import_limit: Number.isFinite(importLimit) && importLimit > 0 ? importLimit : null }) });
  if (!response.ok) throw new Error("Game Check could not compare the latest games.");
  const result = await response.json();
  if (!result || !["complete", "no_new_games"].includes(result.status) || !Array.isArray(result.outcomes)) throw new Error("Game Check returned an unsupported result.");
  return result;
}
