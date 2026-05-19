function normaliseOpeningName(opening) {
  if (!opening) return "Unknown opening";

  if (typeof opening === "string") return opening;

  return (
    opening.name ||
    opening.opening ||
    opening.eco ||
    opening.label ||
    "Unknown opening"
  );
}

function getGames(opening) {
  return Number(
    opening?.games ??
      opening?.count ??
      opening?.total ??
      opening?.played ??
      0
  );
}

function getWinRate(opening) {
  const direct = opening?.winRate ?? opening?.win_rate ?? opening?.score ?? opening?.percentage;

  if (direct !== undefined && direct !== null && !Number.isNaN(Number(direct))) {
    const value = Number(direct);
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
  }

  const wins = Number(opening?.wins ?? opening?.won ?? 0);
  const draws = Number(opening?.draws ?? opening?.drawn ?? 0);
  const games = getGames(opening);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function collectOpenings(data) {
  const candidates = [
    data?.topOpenings,
    data?.top_openings,
    data?.openingStats,
    data?.opening_stats,
    data?.openings,
    data?.openingTable,
    data?.opening_table,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
    if (item && typeof item === "object") return Object.values(item);
  }

  return [];
}

function getVerdict(opening) {
  const existing = opening?.verdict || opening?.recommendation || opening?.status;

  if (existing) return String(existing);

  const games = getGames(opening);
  const winRate = getWinRate(opening);

  if (games < 3) return "Watch";
  if (winRate >= 58) return "Keep";
  if (winRate >= 45) return "Improve";
  return "Avoid for now";
}

function isStrongProfile(data) {
  const rating = Number(
    data?.rating ??
      data?.chesscomRating ??
      data?.chesscom_rating ??
      data?.lichessRating ??
      data?.lichess_rating ??
      data?.player_level?.rating ??
      data?.playerLevel?.rating ??
      0
  );
  const level = String(
    data?.playerLevel?.level ??
      data?.playerLevel?.label ??
      data?.playerLevel ??
      data?.player_level?.level ??
      data?.player_level?.label ??
      data?.player_level ??
      ""
  ).toLowerCase();

  return (
    rating >= 2200 ||
    level.includes("advanced") ||
    level.includes("expert") ||
    level.includes("master") ||
    level.includes("elite")
  );
}

function getVerdictClass(verdict) {
  const lower = verdict.toLowerCase();

  if (lower.includes("keep")) return "reportVerdictKeep";
  if (lower.includes("avoid")) return "reportVerdictAvoid";
  if (lower.includes("improve")) return "reportVerdictImprove";

  return "reportVerdictWatch";
}

function getStyleLabel(data) {
  const label =
    data?.styleProfile?.label ||
    data?.style_profile?.label ||
    data?.styleLabel ||
    data?.style_label ||
    data?.playerStyle ||
    data?.player_style;

  if (label) return label;

  return "Practical attacker";
}

function getTotalGames(data, openings) {
  const direct =
    data?.gamesImported ??
    data?.games_imported ??
    data?.totalGames ??
    data?.total_games ??
    data?.games?.length;

  if (direct) return Number(direct);

  const openingTotal = openings.reduce((sum, opening) => sum + getGames(opening), 0);

  return openingTotal || 0;
}

function buildReportCards(openings) {
  const cleaned = openings
    .map((opening) => ({
      raw: opening,
      name: normaliseOpeningName(opening),
      games: getGames(opening),
      winRate: getWinRate(opening),
      verdict: getVerdict(opening),
    }))
    .filter((opening) => {
      const name = opening.name.toLowerCase();
      return (
        opening.games > 0 &&
        !["unknown", "unknown opening", "uncommon opening"].includes(name)
      );
    })
    .sort((a, b) => b.games - a.games);

  const keep =
    cleaned
      .filter((opening) => opening.winRate >= 58 && opening.games >= 3)
      .sort((a, b) => b.winRate - a.winRate)[0] || cleaned[0];

  const improve =
    cleaned
      .filter((opening) => opening.winRate >= 42 && opening.winRate < 58 && opening.games >= 3)
      .sort((a, b) => b.games - a.games)[0] || cleaned[1];

  const avoid =
    cleaned
      .filter((opening) => opening.winRate < 42 && opening.games >= 3)
      .sort((a, b) => a.winRate - b.winRate)[0] || cleaned[2];

  return { keep, improve, avoid, cleaned };
}

export default function OpeningReportSummary({ data, username, platform }) {
  if (!data) return null;

  const openings = collectOpenings(data);
  const totalGames = getTotalGames(data, openings);
  const styleLabel = getStyleLabel(data);
  const { keep, improve, avoid, cleaned } = buildReportCards(openings);
  const strongProfile = isStrongProfile(data);

  const platformLabel =
    platform === "lichess"
      ? "Lichess"
      : platform === "chesscom"
        ? "Chess.com"
        : "Chess profile";

  const bestOpening = keep?.name || "your strongest repeated opening";
  const weakOpening = avoid?.name || "your lowest-scoring repeated opening";
  const focusOpening = improve?.name || bestOpening;

  return (
    <section className="openingReportShell">
      <div className="openingReportHero">
        <div>
          <p className="openingReportEyebrow">Opening report</p>
          <h2>Your personalised opening summary</h2>
          <p>
            {strongProfile
              ? `Based on ${totalGames || "your recent"} imported games${
                  username ? ` from ${platformLabel} user ${username}` : ""
                }, here is a repertoire audit of core openings and lines worth reviewing.`
              : `Based on ${totalGames || "your recent"} imported games${
                  username ? ` from ${platformLabel} user ${username}` : ""
                }, here is what looks strongest, what needs work, and what to avoid for now.`}
          </p>
        </div>

        <div className="openingReportScore">
          <span>{cleaned.length || "—"}</span>
          <small>tracked openings</small>
        </div>
      </div>

      <div className="openingInsightCard">
        <div className="openingInsightIcon">♟</div>
        <div>
          <h3>{styleLabel}</h3>
          <p>
            {strongProfile ? (
              <>
                Treat <strong>{bestOpening}</strong> as the stable reference point,
                then review <strong>{focusOpening}</strong> for recurring structures
                or move-order details before changing the repertoire.
              </>
            ) : (
              <>
                Your current profile suggests you should focus on openings that create
                clear plans quickly. Keep building around <strong>{bestOpening}</strong>,
                review <strong>{focusOpening}</strong>, and be careful with{" "}
                <strong>{weakOpening}</strong> until the results improve.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="openingReportGrid">
        <ReportCard
          title="Keep playing"
          opening={keep}
          fallbackTitle="Best repeated opening"
          fallbackText="Once more games are imported, this will show the opening that best fits your current results."
          type="keep"
        />

        <ReportCard
          title={strongProfile ? "Review next" : "Improve next"}
          opening={improve}
          fallbackTitle={strongProfile ? "Main review target" : "Main study target"}
          fallbackText={
            strongProfile
              ? "This will highlight a core or recurring opening worth auditing for specific branches."
              : "This will highlight an opening with enough promise to keep, but enough weakness to study."
          }
          type="improve"
        />

        <ReportCard
          title={strongProfile ? "Check carefully" : "Avoid for now"}
          opening={avoid}
          fallbackTitle={strongProfile ? "Trend to inspect" : "Risky opening"}
          fallbackText={
            strongProfile
              ? "This will flag openings where recent results deserve review before any repertoire decision."
              : "This will flag openings that are repeatedly costing you games or producing poor positions."
          }
          type="avoid"
        />
      </div>

      <div className="openingReportNextSteps">
        <div>
          <strong>Recommended next step</strong>
          <span>
            Study one opening at a time. Start with {focusOpening}, then compare
            your results after another batch of games.
          </span>
        </div>

        <div>
          <strong>Premium direction</strong>
          <span>
            A paid version should turn this into a deeper repertoire plan, with
            explanations, progress tracking, and study priorities.
          </span>
        </div>
      </div>
    </section>
  );
}

function ReportCard({ title, opening, fallbackTitle, fallbackText, type }) {
  const name = opening?.name || fallbackTitle;
  const games = opening?.games || 0;
  const winRate = opening?.winRate || 0;
  const verdict = opening?.verdict || title;

  return (
    <article className={`openingReportCard openingReportCard-${type}`}>
      <div className="openingReportCardTop">
        <span>{title}</span>
        <em className={getVerdictClass(verdict)}>{verdict}</em>
      </div>

      <h3>{name}</h3>

      {opening ? (
        <>
          <div className="openingReportStats">
            <div>
              <strong>{games}</strong>
              <small>games</small>
            </div>

            <div>
              <strong>{winRate}%</strong>
              <small>score</small>
            </div>
          </div>

          <p>
            {type === "keep" &&
              "This is currently one of your better fits. Keep it in your repertoire and build more depth around the common middlegame plans."}

            {type === "improve" &&
              "This has enough promise to keep, but your results suggest it needs focused study before it becomes reliable."}

            {type === "avoid" &&
              "This is underperforming compared with your other openings. Reduce how often you play it until you understand the main problems."}
          </p>
        </>
      ) : (
        <p>{fallbackText}</p>
      )}
    </article>
  );
}
