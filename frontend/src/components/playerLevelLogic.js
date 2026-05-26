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
    data?.lichessRating,
    data?.lichess_rating,
    data?.player_level?.rating,
    data?.playerLevel?.rating,
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

export function getPlayerLevelLabel(value, fallback = "") {
  if (!value) return fallback;

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim() || fallback;
  }

  if (typeof value !== "object") return fallback;

  return (
    value.label ||
    value.shortLabel ||
    value.short_label ||
    value.levelLabel ||
    value.level_label ||
    value.level ||
    value.name ||
    fallback
  );
}

export function getPlayerLevelText(data, fallback = "") {
  return (
    getPlayerLevelLabel(data?.playerLevel, "") ||
    getPlayerLevelLabel(data?.player_level, "") ||
    getPlayerLevelLabel(data?.level, fallback)
  );
}

export function classifyPlayerLevel({ rating = null, level = "", title = "" } = {}) {
  const cleanLevel = String(level || "").toLowerCase();
  const cleanTitle = String(title || "").trim().toLowerCase();
  const titledPlayer = ["gm", "im", "fm", "cm", "wgm", "wim", "wfm", "wcm"].includes(cleanTitle);

  if (
    titledPlayer ||
    rating >= 2400 ||
    cleanLevel.includes("master") ||
    cleanLevel.includes("elite") ||
    cleanLevel.includes("gm") ||
    cleanLevel.includes("grandmaster") ||
    cleanLevel.includes("international master")
  ) {
    return {
      level: "master",
      label: "Master",
      shortLabel: "Master",
      tone: "audit",
    };
  }

  if (
    rating >= 2200 ||
    cleanLevel.includes("expert") ||
    cleanLevel.includes("candidate master") ||
    cleanLevel.includes("national master")
  ) {
    return {
      level: "expert",
      label: "Expert",
      shortLabel: "Expert",
      tone: "audit",
    };
  }

  if (rating >= 1800 || cleanLevel.includes("advanced")) {
    return {
      level: "advanced",
      label: "Advanced",
      shortLabel: "Advanced",
      tone: "refine",
    };
  }

  if (rating >= 1400 || cleanLevel.includes("intermediate") || cleanLevel.includes("club")) {
    return {
      level: "intermediate",
      label: "Intermediate",
      shortLabel: "Intermediate",
      tone: "coach",
    };
  }

  if (rating >= 900 || cleanLevel.includes("developing") || cleanLevel.includes("improver")) {
    return {
      level: "developing",
      label: "Developing",
      shortLabel: "Developing",
      tone: "simple",
    };
  }

  return {
    level: "beginner",
    label: "Beginner",
    shortLabel: "Beginner",
    tone: "simple",
  };
}

export function isAdvancedOrStrongerLevel(level) {
  return ["advanced", "expert", "master", "elite", "strong"].includes(String(level || "").toLowerCase());
}

export function isMasterLevel(level) {
  return ["master", "elite"].includes(String(level || "").toLowerCase());
}

export function getRecommendationRatingBand(level) {
  const cleanLevel = String(level || "").toLowerCase();

  if (["advanced", "expert", "master", "elite", "strong"].includes(cleanLevel)) {
    return "advanced";
  }

  if (cleanLevel === "intermediate") return "intermediate";

  return "lower_club";
}

export function getRatingAwareRecommendationCopy({ level = "", label = "", bestName = "", weakName = "" } = {}) {
  const band = getRecommendationRatingBand(level);
  const levelLabel = label || (band === "advanced" ? "Advanced" : band === "intermediate" ? "Intermediate" : "Beginner / lower club");
  const safeBest = bestName || "your strongest repeated opening";
  const safeWeak = weakName || "your weakest repeated opening";

  if (band === "advanced") {
    return {
      band,
      levelLabel,
      title: "Advanced repertoire refinement",
      summary:
        `${levelLabel} recommendation: the opening choice is probably not the whole issue. Look for transpositions, sidelines, move-order precision, and whether your repertoire covers the positions opponents are steering you into.`,
      primaryAction:
        `Use ${safeBest} as the stable reference point, then audit ${safeWeak} for move-order precision, specific sidelines, transpositions, and the first recurring branch where the score drops.`,
      keepAction:
        `Keep ${safeBest} as a repertoire weapon only in the side/context shown, then check whether opponents are reaching one awkward sideline.`,
      weakAction:
        `Do not replace ${safeWeak} from one score line. Compare move orders, transpositions, and specific branches before changing the repertoire.`,
      training:
        "Audit move-order precision, sideline coverage, transpositions, colour splits, and the exact branch where practical results start changing.",
    };
  }

  if (band === "intermediate") {
    return {
      band,
      levelLabel,
      title: "Intermediate repertoire plan",
      summary:
        `${levelLabel} recommendation: you probably know the setup. The useful question is what middlegame plan appears after development, which common branch repeats, and whether your move order is disciplined enough to reach it.`,
      primaryAction:
        `Build around ${safeBest}, then review ${safeWeak} by finding the first uncomfortable middlegame position after development and writing one repeatable plan for it.`,
      keepAction:
        `Keep ${safeBest}, but connect the opening to the first middlegame plan: pawn break, piece placement, and the common branch you see most often.`,
      weakAction:
        `For ${safeWeak}, study the common branches and the first middlegame plan after development before changing openings.`,
      training:
        "Review structures, common branches, repeated middlegame plans, and the move order that gets you into those positions.",
    };
  }

  return {
    band,
    levelLabel,
    title: "Simple opening plan",
    summary:
      `${levelLabel} recommendation: do not memorise 15 moves. Learn the setup, common traps, development pattern, castling plan, and where your pieces belong.`,
    primaryAction:
      `Use ${safeBest} as a simple repeatable setup, and simplify ${safeWeak}: learn the first few moves, castle, develop every piece, and watch for the same trap or early mistake.`,
    keepAction:
      `Keep ${safeBest} simple: learn the setup, the common trap to avoid, where the pieces go, and when to castle.`,
    weakAction:
      `Do not fix ${safeWeak} with deep theory. Pick one safer setup, avoid early queen adventures, develop pieces, castle, and review the first repeated mistake.`,
    training:
      "Focus on simple plans, development, castling, common traps, safe setups, and repeating the same opening often enough to recognise the position.",
  };
}

export function getLevelToneCopy(level) {
  const cleanLevel = String(level || "").toLowerCase();

  if (isMasterLevel(cleanLevel)) {
    return {
      reviewLabel: "Trend review",
      weakLabel: "Review",
      lowResultLabel: "Targeted review",
      reason:
        "At your level, this is likely about move-order precision, opponent preparation, or a recent trend in one branch, not basic understanding.",
      action:
        "Run targeted analysis on the repeated branch: compare transpositions, sidelines, move orders, opponent preparation, colour splits, and recent trend changes.",
      training:
        "Audit trend changes, transpositions, sideline coverage, move-order precision, opponent preparation, and high-sample branches.",
    };
  }

  if (cleanLevel === "expert") {
    return {
      reviewLabel: "Practical review",
      weakLabel: "Review",
      lowResultLabel: "Targeted review",
      reason:
        "Your results suggest this line deserves targeted analysis before making any repertoire decision.",
      action:
        "Review the repeated branch for transpositions, sidelines, move-order issues, opponent preparation, and recurring middlegame structures.",
      training:
        "Refine the repertoire with branch-level review, sideline coverage, opponent pools, and recent trend checks.",
    };
  }

  if (cleanLevel === "advanced" || cleanLevel === "strong") {
    return {
      reviewLabel: "Review",
      weakLabel: "Improve",
      lowResultLabel: "Practical review",
      reason:
        "This may be a practical review area. The useful question is which branch or structure is costing points.",
      action:
        "Review recurring loss patterns, transpositions, move orders, and early middlegame structures before changing the opening.",
      training:
        "Refine the repertoire by checking branches, sidelines, structures, transpositions, and side-specific performance.",
    };
  }

  if (cleanLevel === "intermediate") {
    return {
      reviewLabel: "Study next",
      weakLabel: "Improve",
      lowResultLabel: "Improve",
      reason:
        "This is a useful study-plan target. Review the first uncomfortable position and build one clear plan from there.",
      action:
        "Review recent losses, identify the first repeated structure or branch, and practise one plan for the resulting middlegame.",
      training:
        "Build a study plan around structures, common branches, repeated middlegame plans, and move-order discipline.",
    };
  }

  return {
    reviewLabel: "Study next",
    weakLabel: "Improve",
    lowResultLabel: "Review",
    reason:
      "Keep this simple and practical: focus on development, king safety, and reaching familiar positions.",
    action:
      "Do not memorise deep theory. Play fewer openings, learn the setup, common traps, development, castling, and one repeated mistake after each game.",
    training:
      "Use simple opening habits: learn the setup, develop pieces, castle, avoid early queen moves, know common traps, and repeat familiar plans.",
  };
}

export function canGiveAvoidVerdict({ level = "", games = 0, score = null } = {}) {
  const cleanLevel = String(level || "").toLowerCase();
  const count = Number(games || 0);
  const result = score === null || score === undefined ? null : Number(score);

  if (!Number.isFinite(result)) return false;

  if (isMasterLevel(cleanLevel)) return count >= 30 && result <= 20;
  if (cleanLevel === "expert") return count >= 24 && result <= 24;
  if (cleanLevel === "advanced" || cleanLevel === "strong") return count >= 20 && result <= 28;
  if (cleanLevel === "intermediate") return count >= 12 && result <= 30;
  if (cleanLevel === "developing" || cleanLevel === "improver") return count >= 10 && result <= 32;

  return count >= 8 && result <= 35;
}

export function adaptVerdictForPlayerLevel(verdict, { level = "", games = 0, score = null } = {}) {
  const cleanVerdict = String(verdict || "").trim();
  const lower = cleanVerdict.toLowerCase();

  if (!lower.includes("avoid")) return cleanVerdict;

  if (canGiveAvoidVerdict({ level, games, score })) return cleanVerdict || "Avoid";

  const copy = getLevelToneCopy(level);
  return isAdvancedOrStrongerLevel(level) ? copy.lowResultLabel : copy.weakLabel;
}

export function getPlayerLevelProfile(data) {
  const rating = collectRatings(data);
  const level = getPlayerLevelText(data).toLowerCase();
  const title = String(
    data?.title ??
      data?.chessTitle ??
      data?.chess_title ??
      data?.fideTitle ??
      data?.fide_title ??
      data?.playerTitle ??
      data?.player_title ??
      data?.profile?.title ??
      ""
  )
    .trim()
    .toLowerCase();
  const band = classifyPlayerLevel({ rating, level, title });

  if (band.level === "master") {
    return {
      rating,
      level: "master",
      label: "Master",
      shortLabel: "Master",
      tone: "audit",
      openingUnknownLabel: "Rare line / transposition",
      unknownExplanation:
        "At this level, unclassified openings often mean rare move orders, transpositions, or a limitation in the opening detector — not bad opening play.",
      headline:
        "This is a master-level profile. Treat the report as a repertoire audit, not basic coaching.",
      recommendation:
        "Focus on trend detection, colour splits, opponent prep, move-order precision, and changes over time.",
      trainingFocus:
        "Trend analysis, move-order precision, opponent preparation, and high-sample branch review.",
    };
  }

  if (band.level === "expert") {
    return {
      rating,
      level: "expert",
      label: "Expert",
      shortLabel: "Expert",
      tone: "audit",
      openingUnknownLabel: "Rare line / transposition",
      unknownExplanation:
        "For strong players, unclassified openings are more likely to be transpositions, sidelines, or detector limitations than random opening play.",
      headline:
        "This player needs repertoire refinement, not generic opening advice.",
      recommendation:
        "Use colour splits, weak branches, and repeated middlegame structures to refine the repertoire.",
      trainingFocus:
        "Repertoire refinement, move-order issues, time-control trends, and opponent rating bands.",
    };
  }

  if (band.level === "advanced") {
    return {
      rating,
      level: "advanced",
      label: "Advanced",
      shortLabel: "Advanced",
      tone: "refine",
      openingUnknownLabel: "Rare line / transposition",
      unknownExplanation:
        "For advanced players, this often means a transposition, sideline, or incomplete ECO detection rather than a random opening.",
      headline:
        "This player can refine a practical repertoire from repeated structures.",
      recommendation:
        "Use colour splits, weak branches, and repeated middlegame structures to refine the repertoire.",
      trainingFocus:
        "Opening branches, time-control trends, opponent rating bands, and move-order issues.",
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

  if (band.level === "beginner") {
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

  if (band.level === "developing") {
    return {
      rating,
      level: "developing",
      label: "Developing",
      shortLabel: "Developing",
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

  if (band.level === "intermediate") {
    return {
      rating,
      level: "intermediate",
      label: "Intermediate",
      shortLabel: "Intermediate",
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

  if (band.level === "advanced") {
    return {
      rating,
      level: "advanced",
      label: "Advanced",
      shortLabel: "Advanced",
      tone: "refine",
      openingUnknownLabel: "Rare line / transposition",
      unknownExplanation:
        "For stronger players, this often means a transposition, sideline, or incomplete ECO detection rather than a random opening.",
      headline:
        "This player can refine a practical repertoire from repeated structures.",
      recommendation:
        "Use colour splits, weak branches, and repeated middlegame structures to refine the repertoire.",
      trainingFocus:
        "Opening branches, time-control trends, opponent rating bands, and move-order issues.",
    };
  }

  if (band.level === "expert") {
    return {
      rating,
      level: "expert",
      label: "Expert",
      shortLabel: "Expert",
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
    level: "master",
    label: "Master",
    shortLabel: "Master",
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

  const fitOpenings = Array.isArray(fitData?.scoredOpenings)
    ? fitData.scoredOpenings
    : [];

  const fitConcernRank = {
    avoid: 0,
    review: 1,
    improve: 2,
    neutral: 3,
    keep: 4,
  };

  const weakestFromFit = [...fitOpenings]
    .filter((item) => getOpeningGames(item) >= 3)
    .sort((a, b) => {
      const categoryDiff =
        (fitConcernRank[a.fitCategory] ?? 3) -
        (fitConcernRank[b.fitCategory] ?? 3);
      if (categoryDiff) return categoryDiff;
      return (a.fitScore ?? 100) - (b.fitScore ?? 100);
    })[0];

  const weakest = weakestFromFit ||
    [...openings]
      .filter((item) => getOpeningGames(item) >= 2 && getOpeningScore(item) !== null)
      .sort((a, b) => (getOpeningScore(a) ?? 100) - (getOpeningScore(b) ?? 100))[0];

  const best = fitData?.bestOpening || ranked[0];
  const bestName = best ? displayOpeningName(best, data) : "your strongest repeated opening";
  const weakName = weakest ? displayOpeningName(weakest, data) : "your weakest repeated opening";
  const ratingCopy = getRatingAwareRecommendationCopy({
    level: profile.level,
    label: profile.shortLabel || profile.label,
    bestName,
    weakName,
  });

  if (profile.level === "master" || profile.level === "elite") {
    return {
      title: "Master-level repertoire audit",
      summary: ratingCopy.summary,
      primaryAction: ratingCopy.primaryAction,
      ratingBand: ratingCopy.band,
      trainingFocus: ratingCopy.training,
      bestName,
      weakName,
    };
  }

  if (profile.level === "expert") {
    return {
      title: "Expert repertoire audit",
      summary: ratingCopy.summary,
      primaryAction: ratingCopy.primaryAction,
      ratingBand: ratingCopy.band,
      trainingFocus: ratingCopy.training,
      bestName,
      weakName,
    };
  }

  if (profile.level === "advanced") {
    return {
      title: ratingCopy.title,
      summary: ratingCopy.summary,
      primaryAction: ratingCopy.primaryAction,
      ratingBand: ratingCopy.band,
      trainingFocus: ratingCopy.training,
      bestName,
      weakName,
    };
  }

  if (profile.level === "intermediate") {
    return {
      title: ratingCopy.title,
      summary: ratingCopy.summary,
      primaryAction: ratingCopy.primaryAction,
      ratingBand: ratingCopy.band,
      trainingFocus: ratingCopy.training,
      bestName,
      weakName,
    };
  }

  if (profile.level === "beginner" || profile.level === "developing" || profile.level === "improver") {
    return {
      title: ratingCopy.title,
      summary: ratingCopy.summary,
      primaryAction: ratingCopy.primaryAction,
      ratingBand: ratingCopy.band,
      trainingFocus: ratingCopy.training,
      bestName,
      weakName,
    };
  }

  return {
    title: "Level-aware recommendation",
    summary:
      "The rating level is unclear, so the advice should stay cautious and rely on repeated opening patterns.",
    primaryAction:
      best ? `Verdict: low certainty. Evidence: ${bestName} is the clearest repeated sample. Action: import more games before changing the repertoire.` : "Verdict: too little data. Evidence: no stable repeated opening sample. Action: import more games.",
    bestName,
    weakName,
  };
}

export function getBackendPlayerLevel(data) {
  return data?.player_level || data?.playerLevel || null;
}

export function getBackendRecommendation(data) {
  return data?.backend_recommendation || data?.backendRecommendation || null;
}

export function getBackendDataQuality(data) {
  return data?.data_quality || data?.dataQuality || null;
}

export function getBackendOpeningClassification(data) {
  return data?.opening_classification || data?.openingClassification || null;
}

export function getSmartPlayerLevelProfile(data) {
  const backend = getBackendPlayerLevel(data);

  if (backend && typeof backend === "object") {
    const backendBand = classifyPlayerLevel({
      rating: backend.rating ?? collectRatings(data),
      level: backend.level || backend.label || "",
      title:
        data?.title ||
        data?.chessTitle ||
        data?.chess_title ||
        data?.fideTitle ||
        data?.fide_title ||
        data?.playerTitle ||
        data?.player_title ||
        data?.profile?.title ||
        "",
    });

    return {
      rating: backend.rating ?? null,
      level: backendBand.level || backend.level || "unknown",
      label: backend.label || backendBand.label || "Unknown level",
      shortLabel: backend.short_label || backend.shortLabel || backendBand.shortLabel || backend.label || "Unknown",
      tone: backend.tone || backendBand.tone || "balanced",
      openingUnknownLabel:
        backend.opening_unknown_label ||
        backend.openingUnknownLabel ||
        "Unclassified opening",
      unknownExplanation:
        backend.unknown_explanation ||
        backend.unknownExplanation ||
        "OpeningFit could not confidently classify this opening.",
      headline:
        backend.headline ||
        "The player level is unclear, so the report should avoid overclaiming.",
      recommendation:
        backend.recommendation ||
        "Use repeated opening patterns and game volume before giving strong advice.",
      trainingFocus:
        backend.training_focus ||
        backend.trainingFocus ||
        "Import more games before changing the repertoire.",
      source: "backend",
    };
  }

  return {
    ...getPlayerLevelProfile(data),
    source: "frontend",
  };
}

export function getSmartLevelAwareRecommendation(data, fitData) {
  const backend = getBackendRecommendation(data);

  if (backend && typeof backend === "object") {
    const profile = getSmartPlayerLevelProfile(data);
    const advancedOrHigher = ["advanced", "expert", "master", "elite", "strong"].includes(profile.level);
    const bestName =
      backend.best_opening ||
      backend.bestOpening ||
      "your strongest repeated opening";
    const weakName =
      backend.weak_opening ||
      backend.weakOpening ||
      "your weakest repeated opening";
    const ratingCopy = getRatingAwareRecommendationCopy({
      level: profile.level,
      label: profile.shortLabel || profile.label,
      bestName,
      weakName,
    });
    const rawPrimaryAction =
      backend.primary_action ||
      backend.primaryAction ||
      data?.backend_next_action ||
      ratingCopy.primaryAction;
    const primaryAction =
      advancedOrHigher && /learn the basics|stop playing|avoid this opening|drop this opening|memorise 15 moves|simple setup/i.test(rawPrimaryAction)
        ? ratingCopy.primaryAction
        : `${rawPrimaryAction} ${ratingCopy.training}`;

    return {
      type: backend.type || "backend_recommendation",
      title: backend.title || ratingCopy.title || "OpeningFit recommendation",
      summary: ratingCopy.summary,
      primaryAction,
      ratingBand: ratingCopy.band,
      trainingFocus: ratingCopy.training,
      bestName,
      weakName,
      source: "backend",
    };
  }

  return {
    ...buildLevelAwareRecommendation(data, fitData),
    source: "frontend",
  };
}
