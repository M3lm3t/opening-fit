export function asArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === "object") {
    return Object.entries(value).map(([name, stats]) => ({
      name,
      ...(stats && typeof stats === "object" ? stats : {}),
    }));
  }

  return [];
}

export function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getOpeningName(item) {
  if (typeof item === "string") return item;

  return (
    item?.name ||
    item?.opening ||
    item?.openingName ||
    item?.opening_name ||
    item?.ecoName ||
    item?.eco_name ||
    item?.displayName ||
    item?.family ||
    "Unclassified opening"
  );
}

export function isUnknownOpeningName(name) {
  const normalized = String(name || "").toLowerCase().trim();

  return (
    !normalized ||
    normalized === "unknown" ||
    normalized === "opening" ||
    normalized === "unknown opening" ||
    normalized === "uncommon opening" ||
    normalized.includes("unknown") ||
    normalized.includes("unclassified")
  );
}

export function getOpeningGames(item) {
  if (!item || typeof item === "string") return 0;

  return safeNumber(
    item?.games ??
      item?.count ??
      item?.total ??
      item?.played ??
      item?.sample,
    0
  );
}

export function getOpeningScore(item) {
  if (!item || typeof item === "string") return null;

  const raw =
    item?.winRate ??
    item?.win_rate ??
    item?.score ??
    item?.scoreRate ??
    item?.score_rate ??
    item?.percentage;

  if (raw === undefined || raw === null || raw === "") return null;

  const number = Number(String(raw).replace("%", ""));

  if (!Number.isFinite(number)) return null;

  return number <= 1 ? Math.round(number * 100) : Math.round(number);
}

export function collectRatings(data) {
  const values = [];

  const directFields = [
    data?.rating,
    data?.currentRating,
    data?.current_rating,
    data?.rapidRating,
    data?.rapid_rating,
    data?.blitzRating,
    data?.blitz_rating,
    data?.bulletRating,
    data?.bullet_rating,
    data?.chesscomRating,
    data?.chesscom_rating,
  ];

  directFields.forEach((value) => {
    const number = safeNumber(value, null);
    if (number && number > 100 && number < 3500) values.push(number);
  });

  const games = [
    ...asArray(data?.recent_games),
    ...asArray(data?.recentGames),
    ...asArray(data?.games),
  ];

  games.forEach((game) => {
    [
      game?.white_rating,
      game?.whiteRating,
      game?.black_rating,
      game?.blackRating,
      game?.player_rating,
      game?.playerRating,
      game?.rating,
    ].forEach((value) => {
      const number = safeNumber(value, null);
      if (number && number > 100 && number < 3500) values.push(number);
    });
  });

  if (!values.length) return null;

  values.sort((a, b) => a - b);

  return values[Math.floor(values.length / 2)];
}

export function getPlayerLevelProfile(data) {
  const rating = collectRatings(data);

  const username = String(
    data?.username ||
      data?.playerName ||
      data?.player_name ||
      data?.requestedUsername ||
      data?.requested_username ||
      ""
  ).toLowerCase();

  const likelyEliteUsername =
    username === "hikaru" ||
    username === "magnuscarlsen" ||
    username === "drnykterstein" ||
    username === "gmhikaru";

  if (likelyEliteUsername && (!rating || rating >= 2200)) {
    return {
      rating,
      level: "elite",
      label: "Elite / master-level profile",
      shortLabel: "Elite",
      tone: "audit",
      openingUnknownLabel: "Rare line / transposition",
      unknownExplanation:
        "At this level, unclassified openings often mean rare move orders, transpositions, or a limitation in the opening detector — not bad opening play.",
      headline:
        "This profile is too strong for basic club-player advice. Treat the report as a repertoire audit.",
      recommendation:
        "Focus on trend detection, colour splits, opponent prep, weak-scoring sidelines, and changes over time.",
      trainingFocus:
        "Review high-sample repertoire trends and identify specific branches that underperform.",
    };
  }

  if (!rating) {
    return {
      rating,
      level: "unknown",
      label: "Unknown level",
      shortLabel: "Unknown",
      tone: "balanced",
      openingUnknownLabel: "Unclassified opening",
      unknownExplanation:
        "This means OpeningFit could not confidently name the opening from the available move order.",
      headline:
        "The player level is unclear, so the report should avoid overclaiming.",
      recommendation:
        "Use game volume, repeated openings, and win-rate signals before giving strong advice.",
      trainingFocus:
        "Import more games to make the level and repertoire read more reliable.",
    };
  }

  if (rating < 800) {
    return {
      rating,
      level: "beginner",
      label: "Beginner",
      shortLabel: "Beginner",
      tone: "simple",
      openingUnknownLabel: "Unclassified / messy setup",
      unknownExplanation:
        "At beginner level, this usually means the game left known opening paths early. Keep the advice simple: develop pieces, castle, and avoid early queen adventures.",
      headline:
        "This player needs simple opening habits more than theory.",
      recommendation:
        "Recommend one easy White setup and one simple Black defence. Avoid deep lines.",
      trainingFocus:
        "Development, king safety, not hanging pieces, and reaching familiar positions.",
    };
  }

  if (rating < 1200) {
    return {
      rating,
      level: "improver",
      label: "Improving beginner",
      shortLabel: "Improver",
      tone: "simple",
      openingUnknownLabel: "Unclassified setup",
      unknownExplanation:
        "This normally means the move order left common book lines early. It is a signal to simplify the repertoire.",
      headline:
        "This player should reduce opening variety and build reliable habits.",
      recommendation:
        "Pick one White opening, one Black defence against 1.e4, and one setup against 1.d4.",
      trainingFocus:
        "Repeatable setup, first 6 moves, simple middlegame plan, and avoiding random sidelines.",
    };
  }

  if (rating < 1600) {
    return {
      rating,
      level: "club",
      label: "Club player",
      shortLabel: "Club",
      tone: "coach",
      openingUnknownLabel: "Unclassified opening",
      unknownExplanation:
        "This may be a transposition or an opening that the detector could not classify. Review the move order before assuming it is a bad opening.",
      headline:
        "This player can build a practical repertoire from repeated patterns.",
      recommendation:
        "Keep the strongest openings, repair one weak line, and study typical middlegame plans.",
      trainingFocus:
        "Common plans, recurring early mistakes, and colour-specific repertoire choices.",
    };
  }

  if (rating < 2000) {
    return {
      rating,
      level: "strong",
      label: "Strong club player",
      shortLabel: "Strong club",
      tone: "refine",
      openingUnknownLabel: "Rare line / transposition",
      unknownExplanation:
        "For stronger players, this often means a transposition, sideline, or incomplete ECO detection rather than a random opening.",
      headline:
        "This player needs refinement, not generic opening advice.",
      recommendation:
        "Use colour splits, weak branches, and repeated middlegame structures to refine the repertoire.",
      trainingFocus:
        "Opening branches, time-control trends, opponent rating bands, and move-order issues.",
    };
  }

  if (rating < 2400) {
    return {
      rating,
      level: "advanced",
      label: "Advanced player",
      shortLabel: "Advanced",
      tone: "audit",
      openingUnknownLabel: "Rare line / transposition",
      unknownExplanation:
        "At advanced level, unclassified openings are more likely to be transpositions, sidelines, or detector limitations.",
      headline:
        "This player probably already has a repertoire. Audit it instead of replacing it.",
      recommendation:
        "Highlight underperforming branches, high-volume openings, and prep gaps.",
      trainingFocus:
        "Repertoire refinement, side-line performance, and recent trend changes.",
    };
  }

  return {
    rating,
    level: "elite",
    label: "Elite / master-level profile",
    shortLabel: "Elite",
    tone: "audit",
    openingUnknownLabel: "Rare line / transposition",
    unknownExplanation:
      "At elite level, unclassified openings are usually a classification limitation, rare sideline, or transposition — not a beginner-style mistake.",
    headline:
      "This profile is beyond normal club-player coaching.",
    recommendation:
      "Use OpeningFit as a trend, prep, and repertoire audit tool.",
    trainingFocus:
      "Deep trend detection, opponent prep, colour splits, and weak-scoring sidelines.",
  };
}

export function displayOpeningName(nameOrItem, data) {
  const raw = typeof nameOrItem === "string" ? nameOrItem : getOpeningName(nameOrItem);

  if (!isUnknownOpeningName(raw)) return raw;

  return getPlayerLevelProfile(data).openingUnknownLabel;
}

export function getUnknownOpeningExplanation(data) {
  return getPlayerLevelProfile(data).unknownExplanation;
}

export function collectOpenings(data, { includeUnknown = false } = {}) {
  const sources = [
    data?.openings,
    data?.openingStats,
    data?.opening_stats,
    data?.topOpenings,
    data?.top_openings,
    data?.bestOpenings,
    data?.best_openings,
    data?.preferredWhite,
    data?.preferred_white,
    data?.preferredBlack,
    data?.preferred_black,
    data?.openingWinRates,
    data?.opening_win_rates,
    data?.recommendations,
  ];

  const merged = new Map();

  sources.flatMap(asArray).forEach((item) => {
    const name = getOpeningName(item);
    const unknown = isUnknownOpeningName(name);

    if (!includeUnknown && unknown) return;

    const key = unknown ? `unknown-${merged.size}` : name.toLowerCase();
    const incomingGames = getOpeningGames(item);
    const incomingScore = getOpeningScore(item);

    if (!merged.has(key)) {
      merged.set(key, {
        ...item,
        name,
        games: incomingGames,
        score: incomingScore,
        isUnknownOpening: unknown,
      });
      return;
    }

    const existing = merged.get(key);
    const existingGames = getOpeningGames(existing);

    if (incomingGames > existingGames) {
      merged.set(key, {
        ...existing,
        ...item,
        name,
        games: incomingGames,
        score: incomingScore ?? existing.score,
        isUnknownOpening: unknown,
      });
    }
  });

  return Array.from(merged.values());
}

export function buildLevelAwareRecommendation(data, fitData) {
  const profile = getPlayerLevelProfile(data);
  const openings = collectOpenings(data);
  const ranked = [...openings].sort((a, b) => {
    const scoreDiff = (getOpeningScore(b) ?? -1) - (getOpeningScore(a) ?? -1);
    if (scoreDiff) return scoreDiff;
    return getOpeningGames(b) - getOpeningGames(a);
  });

  const weakest = [...openings]
    .filter((item) => getOpeningGames(item) >= 2 && getOpeningScore(item) !== null)
    .sort((a, b) => (getOpeningScore(a) ?? 100) - (getOpeningScore(b) ?? 100))[0];

  const best = fitData?.bestOpening || ranked[0];
  const bestName = best ? displayOpeningName(best, data) : "your strongest repeated opening";
  const weakName = weakest ? displayOpeningName(weakest, data) : "your weakest repeated opening";

  if (profile.level === "elite") {
    return {
      title: "Elite-level repertoire audit",
      summary:
        "Do not give this player beginner-style opening advice. The useful output is a high-level audit of trends, underperforming branches, and preparation gaps.",
      primaryAction:
        "Prioritise colour splits, time-control splits, opponent-rating bands, and openings that have changed performance recently.",
      bestName,
      weakName,
    };
  }

  if (profile.level === "advanced") {
    return {
      title: "Advanced repertoire refinement",
      summary:
        "This player likely already has opening knowledge. Recommendations should refine what they play, not replace it with beginner systems.",
      primaryAction:
        `Use ${bestName} as the stable reference point, then investigate ${weakName} for specific branches or move-order issues.`,
      bestName,
      weakName,
    };
  }

  if (profile.level === "strong") {
    return {
      title: "Strong club-player refinement",
      summary:
        "The goal is not just choosing openings — it is improving the branches and structures that appear most often.",
      primaryAction:
        `Keep ${bestName} as a main weapon and use ${weakName} as the next repair target.`,
      bestName,
      weakName,
    };
  }

  if (profile.level === "club") {
    return {
      title: "Practical club repertoire",
      summary:
        "This player should build around repeated strengths and study typical middlegame plans rather than memorising lots of theory.",
      primaryAction:
        `Build around ${bestName}, then review the first uncomfortable position in ${weakName}.`,
      bestName,
      weakName,
    };
  }

  if (profile.level === "beginner" || profile.level === "improver") {
    return {
      title: "Simplify the opening choices",
      summary:
        "This player will improve faster by playing fewer openings and reaching familiar positions more often.",
      primaryAction:
        "Choose one White setup, one Black defence against 1.e4, and one simple setup against 1.d4 for the next 20 games.",
      bestName,
      weakName,
    };
  }

  return {
    title: "Level-aware recommendation",
    summary:
      "The rating level is unclear, so the advice should stay cautious and rely on repeated opening patterns.",
    primaryAction:
      best ? `Start with ${bestName}, then import more games to improve confidence.` : "Import more games to improve confidence.",
    bestName,
    weakName,
  };
}
