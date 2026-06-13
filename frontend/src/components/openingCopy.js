export const OPENING_COPY = {
  fitScore:
    "Fit score is a prioritisation signal, not a chess truth. It blends results, sample size, plan clarity, recent form, risk, and learning cost so you know which opening deserves attention first.",
  styleFingerprint:
    "The style fingerprint explains why these openings were suggested. It reads recurring patterns from your games: pawn structures, development speed, king safety, tactics, and the positions you keep reaching.",
  weakLine:
    "A weak line is a repeated early move order where your score or stability drops. Review the first uncomfortable position in this branch before replacing the whole opening.",
};

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function normaliseOpeningName(opening) {
  if (typeof opening === "string") return opening;
  return opening?.displayName || opening?.name || opening?.opening || opening?.openingName || opening?.opening_name || "This opening";
}

function getOpeningGames(opening, stats = {}) {
  return numberValue(
    stats.games ?? opening?.games ?? opening?.count ?? opening?.total ?? opening?.played ?? opening?.sample,
    0
  );
}

function getOpeningScore(opening, stats = {}) {
  const direct =
    stats.winRate ??
    stats.win_rate ??
    stats.score ??
    stats.scoreRate ??
    stats.score_rate ??
    opening?.winRate ??
    opening?.win_rate ??
    opening?.score ??
    opening?.scoreRate ??
    opening?.score_rate ??
    opening?.percentage;
  const parsed = numberValue(direct);
  if (parsed !== null) return Math.round(parsed <= 1 ? parsed * 100 : parsed);

  const games = getOpeningGames(opening, stats);
  if (!games) return null;
  const wins = numberValue(stats.wins ?? opening?.wins ?? opening?.w, 0);
  const draws = numberValue(stats.draws ?? opening?.draws ?? opening?.d, 0);
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function getLossRate(opening, stats = {}) {
  const direct = numberValue(stats.lossRate ?? stats.loss_rate ?? opening?.lossRate ?? opening?.loss_rate);
  if (direct !== null) return Math.round(direct <= 1 ? direct * 100 : direct);
  const games = getOpeningGames(opening, stats);
  const losses = numberValue(stats.losses ?? opening?.losses ?? opening?.l, null);
  if (!games || losses === null) return null;
  return Math.round((losses / games) * 100);
}

function getAverageScore(playerProfile = {}, context = {}) {
  const direct = numberValue(
    context.averageScore ??
      context.average_score ??
      context.averageOpeningScore ??
      context.average_opening_score ??
      playerProfile.averageOpeningScore ??
      playerProfile.average_opening_score ??
      playerProfile.averageScore ??
      playerProfile.average_score ??
      playerProfile.baselineScore ??
      playerProfile.baseline_score
  );
  if (direct !== null) return direct <= 1 ? Math.round(direct * 100) : Math.round(direct);

  const rows = [
    ...(Array.isArray(context.openings) ? context.openings : []),
    ...(Array.isArray(context.topOpenings) ? context.topOpenings : []),
    ...(Array.isArray(context.top_openings) ? context.top_openings : []),
    ...(Array.isArray(playerProfile.openings) ? playerProfile.openings : []),
    ...(Array.isArray(playerProfile.topOpenings) ? playerProfile.topOpenings : []),
    ...(Array.isArray(playerProfile.top_openings) ? playerProfile.top_openings : []),
  ];
  const scores = rows
    .map((item) => ({
      games: getOpeningGames(item),
      score: getOpeningScore(item),
    }))
    .filter((item) => item.games >= 5 && item.score !== null)
    .map((item) => item.score);

  if (scores.length) {
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  return null;
}

function getActiveRepertoireCount(playerProfile = {}, context = {}) {
  const direct = numberValue(context.activeRepertoireCount ?? context.active_repertoire_count ?? playerProfile.activeRepertoireCount);
  if (direct !== null) return direct;
  const active = context.activeOpenings || context.active_openings || playerProfile.activeOpenings || playerProfile.repertoire || [];
  return Array.isArray(active) ? active.length : 0;
}

function getBetterAlternative(opening, context = {}) {
  const name = normaliseOpeningName(opening).toLowerCase();
  const score = getOpeningScore(opening, context.stats || {});
  const alternatives = [
    ...(Array.isArray(context.alternatives) ? context.alternatives : []),
    ...(Array.isArray(context.similarOpenings) ? context.similarOpenings : []),
    ...(Array.isArray(context.similar_openings) ? context.similar_openings : []),
  ];

  return alternatives
    .filter((item) => item && typeof item === "object")
    .map((item) => ({ ...item, score: getOpeningScore(item), games: getOpeningGames(item) }))
    .filter((item) => normaliseOpeningName(item).toLowerCase() !== name && item.score !== null && item.games >= 5)
    .sort((a, b) => b.score - a.score)
    .find((item) => score === null || item.score >= score + 8);
}

function textMatches(value, pattern) {
  return pattern.test(String(value || "").toLowerCase());
}

function getStyleConflict(opening, playerProfile = {}) {
  const name = normaliseOpeningName(opening);
  const styleText = [
    playerProfile.primaryStyle,
    playerProfile.primary_style,
    playerProfile.style,
    playerProfile.label,
    playerProfile.summary,
    ...(Array.isArray(playerProfile.labels) ? playerProfile.labels : []),
  ].join(" ");
  const openingText = [
    name,
    opening?.style,
    opening?.styleTag,
    opening?.style_tag,
    opening?.risk_level,
    opening?.riskLevel,
    opening?.theory_load,
    opening?.theoryLoad,
    ...(Array.isArray(opening?.style_tags) ? opening.style_tags : []),
    ...(Array.isArray(opening?.styleTags) ? opening.styleTags : []),
  ].join(" ");
  const tacticalPlayer = textMatches(styleText, /tactical|attack|sharp|initiative|open/);
  const solidPlayer = textMatches(styleText, /solid|positional|quiet|endgame|technical|grind/);
  const slowOpening = textMatches(openingText, /slow|system|quiet|positional|closed|london|colle/);
  const sharpOpening = textMatches(openingText, /sharp|gambit|sacrifice|attack|king.?s gambit|englund|sicilian|dutch/);

  return (tacticalPlayer && slowOpening) || (solidPlayer && sharpOpening);
}

function isTheoryHeavy(opening) {
  const name = normaliseOpeningName(opening);
  const complexity = numberValue(opening?.complexityScore ?? opening?.complexity_score ?? opening?.theoryScore ?? opening?.theory_score);
  const text = [
    name,
    opening?.theory_load,
    opening?.theoryLoad,
    opening?.learning_cost,
    opening?.learningCost,
    opening?.complexity,
    opening?.risk_level,
    opening?.riskLevel,
  ].join(" ");

  return (
    (complexity !== null && complexity >= 70) ||
    textMatches(text, /high|heavy|advanced|complex|grunfeld|gruenfeld|king.?s indian|najdorf|dragon|benoni|benko|sveshnikov/)
  );
}

function hasEarlyLossSignal(opening, stats = {}) {
  const lossRate = getLossRate(opening, stats);
  const games = getOpeningGames(opening, stats);
  const earlyLosses = numberValue(
    stats.earlyLosses ??
      stats.early_losses ??
      opening?.earlyLosses ??
      opening?.early_losses ??
      opening?.quickLosses ??
      opening?.quick_losses
  );
  const badEarlyPositions = numberValue(
    stats.badEarlyPositions ??
      stats.bad_early_positions ??
      opening?.badEarlyPositions ??
      opening?.bad_early_positions
  );
  const text = [
    opening?.lossTimingNote,
    opening?.loss_timing_note,
    opening?.earlyPositionNote,
    opening?.early_position_note,
    opening?.moveOrderNote,
    opening?.move_order_note,
  ].join(" ");

  return (
    (lossRate !== null && lossRate >= 60 && games >= 5) ||
    (earlyLosses !== null && earlyLosses >= 3) ||
    (badEarlyPositions !== null && badEarlyPositions >= 3) ||
    textMatches(text, /early|quick|opening phase|bad position|lost before|move order/)
  );
}

function playableOpeningPrefix(opening, label) {
  const name = normaliseOpeningName(opening);
  const knownPlayable = !/unknown|unclassified|this opening/i.test(name);
  return knownPlayable && ["Better option found", "May not match your current style", "High effort for your current results"].includes(label)
    ? `${name} is a good opening, but `
    : "";
}

export function getOpeningRecommendationReason(opening = {}, stats = {}, playerProfile = {}, context = {}) {
  const games = getOpeningGames(opening, stats);
  const score = getOpeningScore(opening, stats);
  const average = getAverageScore(playerProfile, context);
  const activeCount = getActiveRepertoireCount(playerProfile, context);
  const betterAlternative = getBetterAlternative(opening, context);
  const lossRate = getLossRate(opening, stats);

  if (games > 0 && games < 5) {
    return {
      label: "Not enough evidence yet",
      reason: "You have only played this a few times, so it is too early to know whether it suits you.",
      action: "Play 5-10 more games before making it part of your main repertoire.",
      category: "low_sample_size",
    };
  }

  if (betterAlternative) {
    return {
      label: "Better option found",
      reason: `${playableOpeningPrefix(opening, "Better option found")}you have a similar opening that is currently performing better, so that should be your main focus.`,
      action: `Prioritise ${normaliseOpeningName(betterAlternative)} for now.`,
      category: "better_alternative",
    };
  }

  if (hasEarlyLossSignal(opening, stats)) {
    return {
      label: "Early positions are costing you",
      reason: "This opening seems to be giving opponents easy chances before you reach a comfortable middlegame.",
      action: "Study one simple setup instead of memorising lots of lines.",
      category: "early_losses",
    };
  }

  if (
    score !== null &&
    games >= 5 &&
    ((average !== null && score <= average - 10) ||
      (lossRate !== null && lossRate >= 55 && score < 45))
  ) {
    return {
      label: "Results are below your usual level",
      reason: "You are scoring worse here than in your stronger openings, so it should not be a main focus yet.",
      action: "Review the first 6-8 moves and check where your positions start going wrong.",
      category: "below_average",
    };
  }

  if (activeCount >= 4 && context.allowRepertoireLoadReason !== false) {
    return {
      label: "Too much to learn right now",
      reason: "This may be playable, but adding another opening now could spread your study time too thin.",
      action: "Focus on your strongest White and Black choices first.",
      category: "too_many_openings",
    };
  }

  if (getStyleConflict(opening, playerProfile)) {
    return {
      label: "May not match your current style",
      reason: `${playableOpeningPrefix(opening, "May not match your current style")}your results suggest you do better in positions with a different type of middlegame.`,
      action: "Keep this as a side option, but prioritise openings that fit your current strengths.",
      category: "style_mismatch",
    };
  }

  if (isTheoryHeavy(opening)) {
    return {
      label: "High effort for your current results",
      reason: `${playableOpeningPrefix(opening, "High effort for your current results")}it usually needs more preparation than your current results justify.`,
      action: "Use a simpler setup first, then return to this later.",
      category: "theory_heavy",
    };
  }

  return {
    label: "Not a priority yet",
    reason: "OpeningFit does not have enough positive evidence to recommend this as a main opening right now.",
    action: "Focus first on the openings where your results and positions look strongest.",
    category: "fallback",
  };
}

export function sampleSizeCopy(games) {
  const count = Number(games) || 0;

  if (count >= 25) {
    return `${count} games. Reliable enough to treat as a pattern.`;
  }

  if (count >= 10) {
    return `${count} games. Useful signal; confirm it with more games before changing everything.`;
  }

  if (count >= 5) {
    return `${count} games. Early signal only. Watch it, but do not make a hard repertoire call yet.`;
  }

  if (count > 0) {
    return `${count} game${count === 1 ? "" : "s"}. Too small for a verdict.`;
  }

  return "No reliable game sample yet.";
}

export function weakLineIssueCopy(issue, games = null) {
  const key = String(issue || "").toLowerCase();

  if (games !== null && Number(games) > 0 && Number(games) < 5) {
    return "Sample size is the main issue. Collect more games before blaming the opening.";
  }

  if (/move.?order|transposition|branch|variation|line/.test(key)) {
    return "The opening may be fine, but this move order is where the position starts to drift.";
  }

  if (/plan|clarity|random|setup|structure/.test(key)) {
    return "You reach the opening, but the follow-up plan changes too much from game to game.";
  }

  if (/loss|mistake|blunder|tactic|short/.test(key)) {
    return "The issue appears early in the game. Review the first repeated mistake before switching openings.";
  }

  if (/black|white|colour|color|side/.test(key)) {
    return "This is colour-specific. Treat it as a White or Black repair, not a general opening verdict.";
  }

  if (/weak_fit|avoid|replace/.test(key)) {
    return "The current fit is weak enough to review the repeated positions before trusting this line.";
  }

  if (/training|improve|review|repair/.test(key)) {
    return "This looks fixable. Train the repeated branch before replacing the opening.";
  }

  return "Use this as a focused review target from your games, not a verdict on the whole opening.";
}
