function number(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? Math.round(parsed <= 1 && parsed >= 0 ? parsed * 100 : parsed) : null;
}

export function analysisConfidence(item = {}) {
  const games = Math.max(0, Number(item.games ?? item.games_played ?? item.gamesPlayed ?? item.count ?? 0) || 0);
  const supplied = String(item.confidence_level || item.confidenceLevel || item.confidence || "").toLowerCase();
  if (!games) return { level: "insufficient", label: "Insufficient evidence", games, explanation: "No opening-specific games are available." };
  const level = supplied.includes("high") ? "high" : supplied.includes("medium") ? "medium" : supplied.includes("low") ? "low" : games >= 8 ? "high" : games >= 3 ? "medium" : "low";
  const label = level === "high" ? "High confidence" : level === "medium" ? "Medium confidence" : "Low confidence";
  const explanation = level === "high" ? `${games} games provides a repeated opening-specific sample.` : level === "medium" ? `${games} games supports an early pattern, not a final verdict.` : `${games} game${games === 1 ? "" : "s"} is too small for a hard repertoire decision.`;
  return { level, label, games, explanation };
}

export function fitBand(score, confidence = {}) {
  if (score === null || score === undefined || confidence.level === "insufficient") return "Insufficient evidence";
  if (score >= 80) return "Excellent fit";
  if (score >= 65) return "Strong fit";
  if (score >= 45) return "Mixed fit";
  return "Weak fit";
}

export function performanceSummary(item = {}) {
  const games = Number(item.games ?? item.games_played ?? item.gamesPlayed ?? 0) || 0;
  const wins = number(item.wins ?? item.w);
  const draws = number(item.draws ?? item.d);
  const losses = number(item.losses ?? item.l);
  const rate = number(item.winRate ?? item.win_rate ?? item.scoreRate ?? item.score_rate);
  if (wins !== null || losses !== null) return `${wins ?? 0} wins, ${draws ?? 0} draws, ${losses ?? 0} losses`;
  if (rate !== null && games) return `${rate}% result across ${games} games`;
  return games ? `${games} analysed games; result split unavailable` : "Performance unavailable";
}

export function fitEvidence(item = {}) {
  const rows = [];
  const games = Number(item.games ?? item.games_played ?? item.gamesPlayed ?? 0) || 0;
  if (games) rows.push(["Performance", performanceSummary(item)]);
  const plan = number(item.planClarityScore ?? item.plan_clarity_score);
  if (plan !== null) rows.push(["Move-order consistency", `${plan}/100 plan-clarity signal`]);
  const early = number(item.earlyLossRate ?? item.early_loss_rate);
  if (early !== null) rows.push(["Early-game mistakes", `${early}% early-loss rate`]);
  const trend = item.recentTrend || item.recent_trend;
  if (trend) rows.push(["Trend", String(trend)]);
  const recency = item.lastPlayedAt || item.last_played_at || item.lastSeen || item.last_seen;
  if (recency) rows.push(["Recency", String(recency)]);
  const style = number(item.traitFitScore ?? item.trait_fit_score ?? item.styleFitScore ?? item.style_fit_score);
  if (style !== null) rows.push(["Behavioural fit", `${style}/100 available style signal`]);
  return rows;
}

export function evidenceBasedReason(item = {}) {
  const games = Number(item.games ?? item.games_played ?? item.gamesPlayed ?? 0) || 0;
  const early = number(item.earlyLossRate ?? item.early_loss_rate);
  const trend = String(item.recentTrend || item.recent_trend || "").toLowerCase();
  const plan = number(item.planClarityScore ?? item.plan_clarity_score);
  const supplied = String(item.shortReason || item.short_reason || item.recommendationReason || item.recommendation_reason || item.reason || "").trim();
  if (games > 0 && games < 4) return `Only ${games} game${games === 1 ? "" : "s"} is available, so this is a watch signal rather than a firm verdict.`;
  if (early !== null && early >= 45) return `Repeated early problems affect ${early}% of the available sample.`;
  if (trend === "declining") return `Recent results are declining in the available trend data.`;
  if (plan !== null && plan < 52) return `The current move-order pattern branches often (plan clarity ${plan}/100).`;
  if (supplied) return supplied;
  return games ? performanceSummary(item) : "The report does not contain enough opening-specific evidence to explain this recommendation.";
}

export async function saveRecommendationFeedback(send, payload) {
  if (typeof send !== "function") return false;
  try { return (await send("recommendation_feedback", payload)) === true; } catch { return false; }
}
