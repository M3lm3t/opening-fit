function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  if (!Number.isFinite(number)) return fallback;
  return number >= 0 && number <= 1 ? Math.round(number * 100) : Math.round(number);
}

export function getRepertoireOpeningName(opening, fallback = "Unclear opening") {
  if (typeof opening === "string") return opening;
  return cleanText(
    opening?.name ||
      opening?.opening ||
      opening?.openingName ||
      opening?.opening_name ||
      opening?.ecoName ||
      opening?.eco_name ||
      opening?.label,
    fallback
  );
}

export function getRepertoireGames(opening) {
  if (!opening || typeof opening === "string") return 0;
  return numberValue(
    opening.games ??
      opening.games_played ??
      opening.gamesPlayed ??
      opening.count ??
      opening.total ??
      opening.sampleSize ??
      opening.sample_size,
    0
  );
}

export function getRepertoireScore(opening) {
  if (!opening || typeof opening === "string") return null;
  const direct =
    opening.fitScore ??
    opening.fit_score ??
    opening.openingFitScore ??
    opening.opening_fit_score ??
    opening.score ??
    opening.performance ??
    opening.winRate ??
    opening.win_rate;
  const directNumber = numberValue(direct, null);
  if (directNumber !== null) return directNumber;

  const games = getRepertoireGames(opening);
  if (!games) return null;
  const wins = numberValue(opening.wins ?? opening.w, 0);
  const draws = numberValue(opening.draws ?? opening.d, 0);
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

export function getRepertoireStatus(opening, context = {}) {
  if (!opening) {
    return {
      status: "Missing",
      tone: "missing",
      explanation: "No clear plan has been detected here yet.",
      actionLabel: "Explore alternatives",
    };
  }

  const games = getRepertoireGames(opening);
  const score = getRepertoireScore(opening);
  const consistency = numberValue(opening.consistency ?? opening.consistencyScore ?? opening.consistency_score, null);
  const frequency = numberValue(opening.frequency ?? opening.frequencyPercent ?? opening.frequency_percent, null);
  const recommendation = cleanText(
    opening.recommendation_label ||
      opening.recommendationLabel ||
      opening.verdict ||
      opening.recommendation ||
      opening.upgrade_type ||
      opening.upgradeType
  ).toLowerCase();
  const sectionCount = numberValue(context.sectionCount, 0) || 0;

  if (sectionCount >= 4) {
    return {
      status: "Overloaded",
      tone: "overloaded",
      explanation: "This area has several choices in rotation, so choosing one main line will make progress easier to see.",
      actionLabel: "Choose as main defence",
    };
  }

  if (games > 0 && games < 3) {
    return {
      status: "Too little data",
      tone: "thin",
      explanation: "There are not enough analysed games to judge this opening confidently yet.",
      actionLabel: "Review",
    };
  }

  if (/avoid|pause|replace|weak|repair|fix/.test(recommendation) && games >= 3) {
    return {
      status: score !== null && score < 43 ? "Weak" : "Developing",
      tone: score !== null && score < 43 ? "weak" : "developing",
      explanation: "OpeningFit already flags this as a repair area, so treat it as a focused training target.",
      actionLabel: "Practice",
    };
  }

  if (score !== null && games >= 3) {
    if (score >= 65 && (consistency === null || consistency >= 55)) {
      return {
        status: "Strong",
        tone: "strong",
        explanation: "This is one of the clearest positive opening signals in the current report.",
        actionLabel: "Keep building",
      };
    }
    if (score >= 52) {
      return {
        status: "Stable",
        tone: "stable",
        explanation: frequency && frequency >= 25
          ? "You reach this often enough for it to be a useful main repertoire candidate."
          : "The current results look usable, but more repeat games will make the signal stronger.",
        actionLabel: "Practice",
      };
    }
    if (score >= 42) {
      return {
        status: "Developing",
        tone: "developing",
        explanation: "The opening is playable, but the results are not reliable enough to call it settled.",
        actionLabel: "Practice",
      };
    }
    return {
      status: "Weak",
      tone: "weak",
      explanation: "The current results are less stable here than your stronger repertoire options.",
      actionLabel: "Review",
    };
  }

  if (games >= 3) {
    return {
      status: "Developing",
      tone: "developing",
      explanation: "This appears often enough to track, but the report does not include a clean performance score.",
      actionLabel: "Review",
    };
  }

  return {
    status: "Too little data",
    tone: "thin",
    explanation: "OpeningFit can see the opening, but not enough evidence to judge it.",
    actionLabel: "Review",
  };
}

function normaliseKey(value) {
  return cleanText(value).toLowerCase();
}

function hasAnyText(opening, patterns) {
  const text = normaliseKey([
    getRepertoireOpeningName(opening, ""),
    opening?.context,
    opening?.slotLabel,
    opening?.slotKey,
    opening?.side,
    opening?.colour,
    opening?.color,
    opening?.responseTo,
    opening?.response_to,
    opening?.against,
  ].filter(Boolean).join(" "));
  return patterns.some((pattern) => pattern.test(text));
}

function tagOpening(opening, section, sourcePriority = 1) {
  return {
    ...(typeof opening === "object" ? opening : { name: opening }),
    name: getRepertoireOpeningName(opening),
    section,
    sourcePriority,
  };
}

function uniqueOpenings(openings) {
  const merged = new Map();
  openings.forEach((opening) => {
    const name = getRepertoireOpeningName(opening, "");
    if (!name || /unknown|unclassified|uncommon|other/i.test(name)) return;
    const key = `${name.toLowerCase()}::${opening.section}`;
    const current = merged.get(key);
    const games = getRepertoireGames(opening);
    const score = getRepertoireScore(opening);
    if (
      !current ||
      opening.sourcePriority > current.sourcePriority ||
      games > getRepertoireGames(current) ||
      (games === getRepertoireGames(current) && (score || 0) > (getRepertoireScore(current) || 0))
    ) {
      merged.set(key, opening);
    }
  });
  return [...merged.values()];
}

export function buildRepertoireMap(data = {}) {
  data = data || {};
  const recs = data.opening_recommendations || data.openingRecommendations || data.recommendedOpenings || {};
  const recommendedGroups = data.recommendedOpeningsByStyle || data.recommended_openings || {};
  const white = [
    ...asArray(data.preferred_white),
    ...asArray(data.preferredWhite),
    ...asArray(recommendedGroups.white),
    ...asArray(recs.white_repertoire),
    ...asArray(recs.whiteDetailed),
  ].map((item) => tagOpening(item, "white", 3));

  const blackE4 = [
    ...asArray(recommendedGroups.black_vs_e4 || recommendedGroups.blackVsE4),
    ...asArray(recs.black_vs_e4),
    ...asArray(recs.blackVsE4Detailed),
  ].map((item) => tagOpening(item, "blackE4", 3));

  const blackD4 = [
    ...asArray(recommendedGroups.black_vs_d4 || recommendedGroups.blackVsD4),
    ...asArray(recs.black_vs_d4),
    ...asArray(recs.blackVsD4Detailed),
    ...asArray(recs.black_vs_other),
    ...asArray(recs.blackVsOtherDetailed),
  ].map((item) => tagOpening(item, "blackD4", 3));

  const general = [
    ...asArray(data.best_openings),
    ...asArray(data.bestOpenings),
    ...asArray(data.top_openings),
    ...asArray(data.topOpenings),
    ...asArray(data.opening_stats),
    ...asArray(data.openingStats),
    ...asArray(data.openings),
  ];

  general.forEach((item) => {
    if (hasAnyText(item, [/white/])) white.push(tagOpening(item, "white", 2));
    else if (hasAnyText(item, [/1\.?e4/, /\be4\b/, /sicilian|french|caro|scandinavian|pirc|modern|alekhine|petrov|philidor|black vs/])) {
      blackE4.push(tagOpening(item, "blackE4", 1));
    } else if (hasAnyText(item, [/1\.?d4/, /\bd4\b/, /queen|nimzo|king'?s indian|grunfeld|gruenfeld|dutch|benoni|slav|black vs/])) {
      blackD4.push(tagOpening(item, "blackD4", 1));
    }
  });

  const sections = {
    white: uniqueOpenings(white).slice(0, 4),
    blackE4: uniqueOpenings(blackE4).slice(0, 5),
    blackD4: uniqueOpenings(blackD4).slice(0, 5),
  };

  const all = [...sections.white, ...sections.blackE4, ...sections.blackD4];
  const statuses = all.map((opening) => getRepertoireStatus(opening, { sectionCount: sections[opening.section]?.length || 0 }));
  const overloaded = Object.values(sections).some((items) => items.length >= 4);
  const missingWhite = !sections.white.length;
  const missingE4 = !sections.blackE4.length;
  const missingD4 = !sections.blackD4.length;
  const weakCount = statuses.filter((status) => ["Weak", "Overloaded"].includes(status.status)).length;
  const thinCount = statuses.filter((status) => status.status === "Too little data").length;

  let focusLabel = "Still building";
  let overview = "We need more games before we can map your repertoire with confidence.";
  let action = "Analyse more games or keep playing your intended main lines.";

  if (missingWhite || missingE4 || missingD4) {
    focusLabel = all.length ? "Incomplete" : "Still building";
    overview = missingWhite
      ? "No clear White repertoire has been detected yet."
      : missingE4
        ? "Your White repertoire has signals, but Black against 1.e4 needs a clearer plan."
        : "Your White repertoire has signals, but Black against 1.d4 needs a clearer plan.";
    action = "Use one planned opening in the missing area for your next few games.";
  } else if (overloaded) {
    focusLabel = "Scattered";
    overview = "You are rotating between too many openings in at least one repertoire area.";
    action = "Choose one main defence or system for the next 10 games.";
  } else if (weakCount >= 2 || thinCount >= 3) {
    focusLabel = "Mostly focused";
    overview = "Your repertoire has a usable shape, but a few areas need clearer evidence or repair.";
    action = "Practise the weakest repeat opening before adding anything new.";
  } else if (all.length >= 3) {
    focusLabel = "Focused";
    overview = "Your repertoire has a compact core across White and Black.";
    action = "Keep the core stable and review one recurring early problem.";
  }

  const gaps = [];
  if (missingWhite && all.length) gaps.push("No clear White repertoire detected yet.");
  if (missingE4 && all.length) gaps.push("No clear plan detected against 1.e4.");
  if (missingD4 && all.length) gaps.push("No clear plan detected against 1.d4.");
  Object.entries(sections).forEach(([section, items]) => {
    if (items.length >= 4) {
      const label = section === "white" ? "White repertoire" : section === "blackE4" ? "Black against 1.e4" : "Black against 1.d4 and other first moves";
      gaps.push(`${label} is split across ${items.length} choices.`);
    }
  });
  if (thinCount) gaps.push(`${thinCount} detected opening${thinCount === 1 ? " has" : "s have"} too little data for a firm verdict.`);
  if (!gaps.length) gaps.push("No major coverage gap detected in the current report.");

  return {
    focusLabel,
    overview,
    action,
    sections,
    gaps: gaps.slice(0, 4),
    totalOpenings: all.length,
  };
}
