function asArray(value) {
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

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getName(item) {
  if (typeof item === "string") return item;

  return (
    item?.name ||
    item?.opening ||
    item?.openingName ||
    item?.opening_name ||
    item?.ecoName ||
    item?.eco_name ||
    item?.displayName ||
    "Unknown opening"
  );
}

function getGames(item) {
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

function getScore(item) {
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

function isUnknown(name) {
  const lower = String(name || "").toLowerCase();

  return (
    !lower.trim() ||
    lower.includes("unknown") ||
    lower.includes("uncommon") ||
    lower === "opening"
  );
}

function collectOpenings(data) {
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
    const name = getName(item);
    const key = name.toLowerCase();

    if (!key || isUnknown(name)) return;

    const incomingGames = getGames(item);
    const incomingScore = getScore(item);

    if (!merged.has(key)) {
      merged.set(key, {
        ...item,
        name,
        games: incomingGames,
        score: incomingScore,
      });
      return;
    }

    const existing = merged.get(key);
    const existingGames = getGames(existing);

    if (incomingGames > existingGames) {
      merged.set(key, {
        ...existing,
        ...item,
        name,
        games: incomingGames,
        score: incomingScore ?? existing.score,
      });
    }
  });

  return Array.from(merged.values());
}

function collectRatings(data) {
  const values = [];

  const directFields = [
    data?.rating,
    data?.currentRating,
    data?.current_rating,
    data?.rapidRating,
    data?.rapid_rating,
    data?.blitzRating,
    data?.blitz_rating,
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

function ratingBand(rating) {
  if (!rating) {
    return {
      label: "Unrated / unknown level",
      level: "unknown",
      advice:
        "The report could not confidently read a rating level, so it should lean on opening results and sample size instead.",
    };
  }

  if (rating < 800) {
    return {
      label: "Beginner",
      level: "beginner",
      advice:
        "This player needs simple development rules, fewer opening choices, and repeatable setups more than theory.",
    };
  }

  if (rating < 1200) {
    return {
      label: "Improving beginner",
      level: "improver",
      advice:
        "This player should reduce random openings and build one dependable White setup plus one simple Black defence.",
    };
  }

  if (rating < 1600) {
    return {
      label: "Club player",
      level: "club",
      advice:
        "This player can start building a real repertoire, but plans and typical middlegames matter more than memorising long lines.",
    };
  }

  if (rating < 2000) {
    return {
      label: "Strong club player",
      level: "strong",
      advice:
        "This player needs deeper preparation, better colour-specific choices, and clearer repair work on weak opening families.",
    };
  }

  if (rating < 2400) {
    return {
      label: "Advanced player",
      level: "advanced",
      advice:
        "This player likely needs targeted repertoire refinement, opponent prep, and deeper opening family breakdowns.",
    };
  }

  return {
    label: "Elite / master-level profile",
    level: "elite",
    advice:
      "For this level, generic opening advice is not enough. The report should focus on trends, preparation gaps, and high-sample repertoire patterns.",
  };
}

function getGameCount(data, openings) {
  return (
    safeNumber(data?.gamesImported, null) ??
    safeNumber(data?.games_imported, null) ??
    safeNumber(data?.totalGames, null) ??
    safeNumber(data?.total_games, null) ??
    safeNumber(data?.gameCount, null) ??
    safeNumber(data?.game_count, null) ??
    openings.reduce((sum, item) => sum + getGames(item), 0)
  );
}

function analyseProfile(data) {
  const openings = collectOpenings(data);
  const rating = collectRatings(data);
  const band = ratingBand(rating);
  const gameCount = getGameCount(data, openings);

  const sortedByScore = [...openings].sort((a, b) => {
    const aScore = getScore(a) ?? -1;
    const bScore = getScore(b) ?? -1;

    if (bScore !== aScore) return bScore - aScore;
    return getGames(b) - getGames(a);
  });

  const sortedWeak = [...openings]
    .filter((item) => getGames(item) >= 2 && getScore(item) !== null)
    .sort((a, b) => (getScore(a) ?? 100) - (getScore(b) ?? 100));

  const best = sortedByScore[0] || null;
  const weak = sortedWeak[0] || null;

  const knownOpenings = openings.length;
  const repeatOpenings = openings.filter((item) => getGames(item) >= 3).length;
  const highVariety = knownOpenings >= 12 && repeatOpenings < knownOpenings * 0.45;
  const lowSample = gameCount < 30;
  const goodSample = gameCount >= 80;
  const bestScore = getScore(best);
  const weakScore = getScore(weak);

  let confidence = "Medium confidence";

  if (lowSample) confidence = "Low confidence";
  if (goodSample && repeatOpenings >= 4) confidence = "High confidence";
  if (band.level === "elite" && gameCount >= 200) confidence = "High confidence, but needs advanced analysis";

  const insights = [];

  if (band.level === "elite") {
    insights.push({
      title: "Do not treat this like a normal club-player report",
      text:
        "This profile looks extremely strong. Basic advice like “learn one simple opening” is not relevant. The useful angle is repertoire trend detection, weak-scoring sidelines, colour splits, and prep gaps.",
    });
  } else if (band.level === "advanced") {
    insights.push({
      title: "Advanced profile detected",
      text:
        "This player probably already understands opening principles. The report should focus on refining their existing repertoire rather than suggesting beginner-friendly replacements.",
    });
  } else if (band.level === "beginner" || band.level === "improver") {
    insights.push({
      title: "Simplify the repertoire",
      text:
        "This level benefits most from fewer openings, clearer development plans, and avoiding sharp theory unless the results clearly support it.",
    });
  } else {
    insights.push({
      title: "Build around repeatable strengths",
      text:
        "This looks like a player who can benefit from a focused repertoire: keep the best-performing structures and repair one weak opening at a time.",
    });
  }

  if (highVariety) {
    insights.push({
      title: "Too much opening variety",
      text:
        "The player appears to be switching openings often. That makes improvement harder because they keep reaching different middlegames. Recommend narrowing the repertoire.",
    });
  }

  if (lowSample) {
    insights.push({
      title: "Small sample warning",
      text:
        "There are not enough games to make strong claims yet. The app should present this as an early read, not a final verdict.",
    });
  }

  if (best && bestScore !== null) {
    insights.push({
      title: `Best current signal: ${getName(best)}`,
      text:
        bestScore >= 65
          ? `This opening is performing well enough to treat as a real strength. Build the next study block around it.`
          : `This is the best available signal, but the score is not dominant. It may be the best of a mixed set rather than a clear main weapon.`,
    });
  }

  if (weak && weakScore !== null) {
    insights.push({
      title: `Weakest useful signal: ${getName(weak)}`,
      text:
        weakScore <= 40
          ? `This opening is costing points. The player should either simplify the line, study the first recurring mistake, or pause it for now.`
          : `This is not disastrous, but it is the clearest place to look for improvement next.`,
    });
  }

  const nextAction = (() => {
    if (band.level === "elite") {
      return "Show deeper breakdowns: openings by colour, opponent rating, time control, recent trend, and recurring weak lines.";
    }

    if (band.level === "advanced") {
      return "Recommend repertoire refinement, not beginner replacements. Focus on weak-scoring branches and high-volume openings.";
    }

    if (highVariety) {
      return "Tell the player to cut down to one White opening, one answer to 1.e4, and one answer to 1.d4 for the next 20 games.";
    }

    if (weak && weakScore !== null && weakScore <= 40) {
      return `Make ${getName(weak)} the next repair target, or suggest a simpler replacement.`;
    }

    if (best) {
      return `Build the next study session around ${getName(best)} and one common middlegame plan.`;
    }

    return "Import more games before giving a strong recommendation.";
  })();

  return {
    rating,
    band,
    openings,
    gameCount,
    knownOpenings,
    repeatOpenings,
    highVariety,
    confidence,
    best,
    weak,
    bestScore,
    weakScore,
    insights: insights.slice(0, 5),
    nextAction,
  };
}

export default function IntelligentCoachInsights({ data }) {
  if (!data) return null;

  const profile = analyseProfile(data);

  return (
    <section className="intelligentCoachShell">
      <div className="intelligentCoachHeader">
        <div>
          <div className="intelligentCoachEyebrow">Smarter coach logic</div>
          <h2>Player-specific diagnosis</h2>
          <p>
            This section adapts the advice based on rating level, sample size,
            opening variety, and whether the profile looks like a beginner,
            club player, advanced player, or elite account.
          </p>
        </div>

        <div className="coachConfidenceBadge">
          <strong>{profile.confidence}</strong>
          <span>
            {profile.rating ? `Estimated rating: ${profile.rating}` : "Rating not detected"}
          </span>
        </div>
      </div>

      <div className="coachProfileGrid">
        <article>
          <span>Player level</span>
          <strong>{profile.band.label}</strong>
          <p>{profile.band.advice}</p>
        </article>

        <article>
          <span>Games checked</span>
          <strong>{profile.gameCount || "Unknown"}</strong>
          <p>
            {profile.gameCount >= 80
              ? "Enough games for a stronger pattern read."
              : "More games will make the recommendation sharper."}
          </p>
        </article>

        <article>
          <span>Opening spread</span>
          <strong>{profile.knownOpenings} known</strong>
          <p>
            {profile.highVariety
              ? "The player may be experimenting too much."
              : `${profile.repeatOpenings} openings appear repeatedly enough to study.`}
          </p>
        </article>
      </div>

      <div className="coachInsightList">
        {profile.insights.map((item) => (
          <article key={item.title} className="coachInsightCard">
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>

      <div className="coachNextAction">
        <span>Recommended next action</span>
        <strong>{profile.nextAction}</strong>
      </div>
    </section>
  );
}
