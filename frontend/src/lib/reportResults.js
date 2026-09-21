const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

export function percentValue(value) {
  const raw = typeof value === "string" ? value.trim().replace(/%$/, "") : value;
  if (!finite(raw)) return null;
  const numeric = Number(raw);
  return Math.max(0, Math.min(100, !String(value).includes("%") && numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric));
}

export function canonicalResultAggregate(source = {}, { precision = 1 } = {}) {
  const sample = source.observedPerformance || source.observed_performance || (source.sample && typeof source.sample === "object" ? source.sample : source);
  const games = Number(sample.games ?? source.games ?? source.games_played ?? source.gamesPlayed ?? source.count ?? 0) || 0;
  const wins = Number(sample.wins ?? source.wins ?? 0) || 0;
  const draws = Number(sample.draws ?? source.draws ?? 0) || 0;
  const losses = Number(sample.losses ?? source.losses ?? 0) || 0;
  const wdlResults = wins + draws + losses;
  const suppliedKnownResults = Number(sample.knownResults ?? sample.known_results ?? source.knownResults ?? source.known_results ?? wdlResults) || 0;
  // Backend aggregate metadata can retain a pre-filter known-results count while
  // the W/D/L values already represent the canonical displayed sample. When the
  // complete W/D/L total reconciles with games, it is the exact score denominator.
  const knownResults = wdlResults > 0 && wdlResults <= games ? wdlResults : suppliedKnownResults;
  const completeResults = [sample.wins ?? source.wins, sample.draws ?? source.draws, sample.losses ?? source.losses].every(finite);
  const anyResults = [sample.wins ?? source.wins, sample.draws ?? source.draws, sample.losses ?? source.losses].some(finite);
  // Fit estimates and win rates are different metrics, never score-rate fallbacks.
  const supplied = sample.scoreRate ?? sample.score_rate ?? source.scoreRate ?? source.score_rate ?? source.rawResultScore ?? source.raw_result_score ?? source.score;
  const scoreRate = games <= 0 ? null : completeResults && knownResults > 0 && wdlResults === knownResults && knownResults <= games
    ? ((wins + draws * 0.5) / knownResults) * 100
    : anyResults ? null : percentValue(supplied);
  return {
    games: Math.max(0, Math.round(games)),
    knownResults: Math.max(0, Math.round(knownResults)),
    wins: Math.max(0, Math.round(wins)),
    draws: Math.max(0, Math.round(draws)),
    losses: Math.max(0, Math.round(losses)),
    scoreRate: scoreRate === null ? null : Number(scoreRate.toFixed(Math.max(0, Math.min(4, precision)))),
  };
}
