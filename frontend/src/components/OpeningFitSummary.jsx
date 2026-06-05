import { useMemo } from "react";

function getOpeningName(item) {
  return (
    item?.opening ||
    item?.name ||
    item?.ecoName ||
    item?.opening_name ||
    item?.label ||
    "Unknown opening"
  );
}

function getGames(item) {
  return Number(item?.games ?? item?.count ?? item?.total ?? 0);
}

function getWinRate(item) {
  const direct = item?.winRate ?? item?.win_rate ?? item?.score;

  if (typeof direct === "number") {
    return direct > 1 ? Math.round(direct) : Math.round(direct * 100);
  }

  const games = getGames(item);
  const wins = Number(item?.wins ?? item?.w ?? 0);
  const draws = Number(item?.draws ?? item?.d ?? 0);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function collectOpenings(data) {
  const possible =
    data?.openingStats ||
    data?.openings ||
    data?.topOpenings ||
    data?.verdicts ||
    data?.opening_win_rates ||
    data?.openingWinRates ||
    [];

  if (Array.isArray(possible)) return possible;

  if (possible && typeof possible === "object") {
    return Object.entries(possible).map(([name, value]) => ({
      name,
      ...(typeof value === "object" ? value : { games: value }),
    }));
  }

  return [];
}

function cleanName(name) {
  if (!name) return "Unknown opening";
  return String(name).replace(/\s+/g, " ").trim();
}

function isUnknown(name) {
  const normalised = cleanName(name).toLowerCase();
  return (
    !normalised ||
    normalised === "unknown" ||
    normalised === "unknown opening" ||
    normalised.includes("uncommon opening")
  );
}

function getRecommendedAction(data, fallbackOpening) {
  const existing = data?.recommendedAction || data?.recommended_action || data?.nextAction || data?.next_action;
  if (typeof existing === "string" && existing.trim()) return existing.trim();

  if (fallbackOpening?.displayName) {
    if (Number(fallbackOpening.losses || 0) >= 3) {
      return `Review these 3 losses in ${fallbackOpening.displayName}.`;
    }
    return `Train this line: ${fallbackOpening.displayName}.`;
  }

  return "Play 5 games, then run a fresh analysis.";
}

function inferStyle(data, openings) {
  const existing =
    data?.styleProfile?.label ||
    data?.styleProfile?.style ||
    data?.style?.label ||
    data?.style ||
    data?.playerStyle ||
    data?.summary?.style;

  if (existing && typeof existing === "string") return existing;

  const openingNames = openings.map((item) => item.displayName.toLowerCase()).join(" ");

  if (
    openingNames.includes("vienna") ||
    openingNames.includes("king's gambit") ||
    openingNames.includes("sicilian") ||
    openingNames.includes("scotch")
  ) {
    return "Direct tactical player";
  }

  if (
    openingNames.includes("london") ||
    openingNames.includes("caro") ||
    openingNames.includes("queen's gambit") ||
    openingNames.includes("slav")
  ) {
    return "Solid structure-based player";
  }

  if (
    openingNames.includes("english") ||
    openingNames.includes("réti") ||
    openingNames.includes("reti") ||
    openingNames.includes("indian")
  ) {
    return "Flexible positional player";
  }

  return "Practical club player";
}

export default function OpeningFitSummary({ data, onPractice }) {
  const summary = useMemo(() => {
    if (!data) return null;

    const openings = collectOpenings(data)
      .map((item) => ({
        ...item,
        displayName: cleanName(getOpeningName(item)),
        games: getGames(item),
        winRate: getWinRate(item),
      }))
      .filter((item) => !isUnknown(item.displayName))
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        return b.winRate - a.winRate;
      });

    const reliable = openings.filter((item) => item.games >= 2);
    const strong = reliable.filter((item) => item.winRate >= 55).sort((a, b) => b.winRate - a.winRate);
    const weak = reliable.filter((item) => item.winRate < 45).sort((a, b) => a.winRate - b.winRate);

    const keep = strong[0] || reliable[0] || openings[0];
    const improve = weak[0] || reliable[1] || openings[1];
    const next = strong[1] || reliable[2] || openings[2] || keep;

    const gamesImported =
      data?.gamesImported ||
      data?.games_imported ||
      data?.totalGames ||
      data?.total_games ||
      data?.games?.length ||
      0;

    const username =
      data?.username ||
      data?.playerName ||
      data?.player ||
      data?.profile?.username ||
      "your account";

    const style = inferStyle(data, openings);

    return {
      username,
      gamesImported,
      style,
      keep,
      improve,
      next,
      recommendedAction: getRecommendedAction(data, improve || keep),
      openings,
    };
  }, [data]);

  if (!summary) return null;

  const keepName = summary.keep?.displayName || "your best performing opening";
  const improveName = summary.improve?.displayName || "your least consistent opening";
  const nextName = summary.next?.displayName || keepName;

  return (
    <section className="openingFitSummaryShell" id="openingfit-summary">
      <div className="openingFitSummaryHero">
        <div className="openingFitSummaryContent">
          <div className="summaryEyebrow">Your OpeningFit result</div>
          <h2>{summary.style}</h2>
          <p>{summary.gamesImported || "Imported"} games from <strong>{summary.username}</strong>. Keep the strength, repair the leak.</p>
        </div>

        <div className="summaryScoreCard">
          <span>Best current fit</span>
          <strong>{keepName}</strong>
          <small>
            {summary.keep?.winRate ? `${summary.keep.winRate}% score` : "Most reliable result"}
            {summary.keep?.games ? ` · ${summary.keep.games} games` : ""}
          </small>
        </div>
      </div>

      <div className="summaryActionGrid">
        <div className="summaryActionCard keep">
          <span>Keep</span>
          <h3>{keepName}</h3>
          <p>Build around this first.</p>
        </div>

        <div className="summaryActionCard improve">
          <span>Improve</span>
          <h3>{improveName}</h3>
          <p>Patch the early uncomfortable positions.</p>
        </div>

        <div className="summaryActionCard next">
          <span>Study next</span>
          <h3>{nextName}</h3>
          <p>Learn one short line, review losses, then test it.</p>
        </div>
      </div>

      <div className="summaryBottomStrip">
        <div>
          <strong>Recommended next step:</strong>{" "}
          {summary.recommendedAction}
        </div>

        {onPractice ? (
          <button type="button" onClick={onPractice}>
            Start practice
          </button>
        ) : null}
      </div>
    </section>
  );
}
