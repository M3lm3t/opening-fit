export const OPENING_RECOMMENDATION_VERDICT_THRESHOLDS = {
  watchMaxGames: 3,
  repairMinGames: 4,
  keepMinGames: 6,
  replaceMinGames: 10,
  keepScoreMin: 64,
  repairScoreMax: 58,
  replaceScoreMax: 42,
  repairLossRateMin: 45,
  replaceLossRateMin: 55,
  weakLineCountMin: 1,
  planClarityLowMax: 45,
  credibleAlternativeMinScore: 62,
  credibleAlternativeScoreGap: 12,
};

export const OPENING_RECOMMENDATION_VERDICT_ACTIONS = {
  KEEP: "Keep using it in rapid and review your common response.",
  REPAIR: "Practise the line or plan that is costing you most.",
  REPLACE: "Try the suggested alternative in practice before switching games.",
  WATCH: "Play more games before making a repertoire decision.",
};
