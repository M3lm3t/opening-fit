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

function isUnknownOpening(name) {
  const normalised = String(name || "").trim().toLowerCase();

  return (
    !normalised ||
    normalised === "unknown" ||
    normalised === "unknown opening" ||
    normalised.includes("uncommon opening")
  );
}

function getUsername(data) {
  return (
    data?.username ||
    data?.playerName ||
    data?.player ||
    data?.profile?.username ||
    "your account"
  );
}

function getGamesImported(data) {
  return Number(
    data?.gamesImported ||
    data?.games_imported ||
    data?.totalGames ||
    data?.total_games ||
    data?.games?.length ||
    0
  );
}

function scrollToSection(id) {
  const element = document.getElementById(id);
  if (!element) return;

  element.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export default function ResultsCommandCenter({ data, onPractice }) {
  const result = useMemo(() => {
    if (!data) return null;

    const openings = collectOpenings(data)
      .map((item) => ({
        name: getOpeningName(item),
        games: getGames(item),
        winRate: getWinRate(item),
      }))
      .filter((item) => !isUnknownOpening(item.name))
      .filter((item) => item.games > 0)
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        return b.winRate - a.winRate;
      });

    const reliable = openings.filter((item) => item.games >= 2);
    const strong = reliable.filter((item) => item.winRate >= 55).sort((a, b) => b.winRate - a.winRate);
    const weak = reliable.filter((item) => item.winRate < 45).sort((a, b) => a.winRate - b.winRate);

    const best = strong[0] || reliable[0] || openings[0];
    const fix = weak[0] || reliable[1] || openings[1] || best;

    return {
      username: getUsername(data),
      gamesImported: getGamesImported(data),
      best,
      fix,
      openingsCount: openings.length,
    };
  }, [data]);

  if (!data || !result) return null;

  const bestName = result.best?.name || "your strongest opening";
  const fixName = result.fix?.name || "your weakest opening area";

  return (
    <section className="resultsCommandShell" id="start-here">
      <div className="resultsCommandHero">
        <div>
          <div className="resultsCommandEyebrow">Start here</div>
          <h2>Your next move is clear.</h2>
          <p>
            OpeningFit found <strong>{result.openingsCount}</strong> openings from{" "}
            <strong>{result.gamesImported || "your imported"}</strong> games. Build around{" "}
            <strong>{bestName}</strong>, then fix <strong>{fixName}</strong>.
          </p>
        </div>

        <div className="resultsCommandScore">
          <span>Best fit</span>
          <strong>{bestName}</strong>
          <small>
            {result.best?.winRate ? `${result.best.winRate}% score` : "Top recommendation"}
            {result.best?.games ? ` · ${result.best.games} games` : ""}
          </small>
        </div>
      </div>

      <div className="resultsCommandActions">
        <button type="button" onClick={() => scrollToSection("progress-tracker")}>
          <span>1</span>
          Save progress
          <small>Track improvement over time</small>
        </button>

        <button type="button" onClick={() => scrollToSection("my-repertoire")}>
          <span>2</span>
          Build repertoire
          <small>Save your White and Black plan</small>
        </button>

        <button type="button" onClick={() => scrollToSection("coach-plan")}>
          <span>3</span>
          Follow coach plan
          <small>Use the 7-day study path</small>
        </button>
      </div>

      <div className="resultsCommandSecondary">
        <button type="button" onClick={() => scrollToSection("share-report")}>
          Share report
        </button>

        <button type="button" onClick={() => scrollToSection("premium")}>
          View Premium
        </button>

        {onPractice ? (
          <button type="button" onClick={() => onPractice(result.best?.name || result.fix?.name)}>
            Start practice
          </button>
        ) : null}
      </div>
    </section>
  );
}
