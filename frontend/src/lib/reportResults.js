const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

export function percentValue(value) {
  if (!finite(value)) return null;
  const numeric = Number(String(value).replace("%", ""));
  return Math.max(0, Math.min(100, numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric));
}

export function canonicalResultAggregate(source = {}, { precision = 1 } = {}) {
  const sample = source.sample && typeof source.sample === "object" ? source.sample : source;
  const games = Number(sample.games ?? source.games ?? 0) || 0;
  const wins = Number(sample.wins ?? source.wins ?? 0) || 0;
  const draws = Number(sample.draws ?? source.draws ?? 0) || 0;
  const losses = Number(sample.losses ?? source.losses ?? 0) || 0;
  const knownResults = Number(sample.knownResults ?? sample.known_results ?? source.knownResults ?? source.known_results ?? wins + draws + losses) || 0;
  const supplied = sample.scoreRate ?? source.observedPerformance?.scoreRate ?? source.observed_performance?.scoreRate ?? source.scoreRate ?? source.score_rate ?? source.winRate ?? source.win_rate ?? source.score;
  const scoreRate = knownResults > 0
    ? ((wins + draws * 0.5) / knownResults) * 100
    : percentValue(supplied);
  return {
    games: Math.max(0, Math.round(games)),
    knownResults: Math.max(0, Math.round(knownResults)),
    wins: Math.max(0, Math.round(wins)),
    draws: Math.max(0, Math.round(draws)),
    losses: Math.max(0, Math.round(losses)),
    scoreRate: scoreRate === null ? null : Number(scoreRate.toFixed(Math.max(0, Math.min(4, precision)))),
  };
}
