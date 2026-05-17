function getUsername(data) {
  return (
    data?.username ||
    data?.player ||
    data?.profile?.username ||
    data?.account?.username ||
    "your games"
  );
}

function getPlatform(data) {
  const raw = String(data?.platform || data?.source || "").toLowerCase();

  if (raw.includes("lichess")) return "Lichess";
  if (raw.includes("chess")) return "Chess.com";

  return "imported games";
}

function getGames(data) {
  return (
    Number(data?.games_analyzed) ||
    Number(data?.gamesImported) ||
    Number(data?.total_games) ||
    0
  );
}

function getOpeningName(opening) {
  return opening?.name || opening?.opening || opening?.eco || null;
}

function getOpenings(data) {
  return [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ].filter(Boolean);
}

function getWinRate(opening) {
  const raw = opening?.winRate ?? opening?.win_rate ?? opening?.score;
  const n = Number(raw);

  if (!Number.isFinite(n)) return null;

  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function findFocusOpening(data) {
  const openings = getOpenings(data)
    .map((opening) => ({
      ...opening,
      name: getOpeningName(opening),
      games: Number(opening?.games ?? opening?.count ?? opening?.total ?? 0),
      winRate: getWinRate(opening),
    }))
    .filter((opening) => opening.name && opening.games > 0);

  const weak = openings
    .filter((opening) => opening.games >= 3 && opening.winRate !== null)
    .sort((a, b) => a.winRate - b.winRate)[0];

  return weak || openings[0] || null;
}

export default function ReportCommandBar({
  data,
  activeView,
  onViewChange,
  isPremium,
  onUpgrade,
}) {
  if (!data) return null;

  const username = getUsername(data);
  const platform = getPlatform(data);
  const games = getGames(data);
  const focusOpening = findFocusOpening(data);

  const views = [
    { key: "overview", label: "Overview" },
    { key: "recommendations", label: "Recommendations" },
    { key: "training", label: "Training" },
    { key: "games", label: "Games" },
    { key: "data", label: "Data" },
  ];

  const jumpToView = (view) => {
    if (typeof onViewChange === "function") {
      onViewChange(view);
    }

    setTimeout(() => {
      const el =
        document.getElementById("app-results") ||
        document.getElementById("opening-diagnosis") ||
        document.getElementById("app-dashboard");

      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleUpgrade = () => {
    if (typeof onUpgrade === "function") {
      onUpgrade();
      return;
    }

    const el = document.getElementById("premium");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="reportCommandBar" aria-label="Report command bar">
      <div className="reportCommandBar__summary">
        <span className="reportCommandBar__status">Live report</span>
        <div>
          <strong>{username}</strong>
          <p>
            {platform}
            {games ? ` · ${games} games analysed` : ""}
          </p>
        </div>
      </div>

      <div className="reportCommandBar__next">
        <span>Next best action</span>
        <strong>
          {focusOpening?.name
            ? `Fix ${focusOpening.name} first`
            : "Open your training plan"}
        </strong>
      </div>

      <nav className="reportCommandBar__tabs" aria-label="Report sections">
        {views.map((view) => (
          <button
            key={view.key}
            type="button"
            className={activeView === view.key ? "is-active" : ""}
            onClick={() => jumpToView(view.key)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {!isPremium ? (
        <button
          type="button"
          className="reportCommandBar__upgrade"
          onClick={handleUpgrade}
        >
          Unlock full report
        </button>
      ) : null}
    </section>
  );
}
