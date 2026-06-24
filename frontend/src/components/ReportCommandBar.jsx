import { TabNavigation } from "./ui/UiPrimitives.jsx";

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
  reportMode,
  onReportModeChange,
  onNavigate,
}) {
  if (!data) return null;

  const username = getUsername(data);
  const platform = getPlatform(data);
  const games = getGames(data);
  const focusOpening = findFocusOpening(data);

  const views = [
    { key: "verdict", label: "Verdict", mode: "summary", target: "report-verdict", activeViews: ["overview", "report", "verdict"] },
    {
      key: "repertoire",
      label: "Repertoire",
      mode: "full",
      target: "report-repertoire",
      activeViews: ["recommendations", "repertoire", "openings"],
    },
    { key: "weakspots", label: "Weaknesses", mode: "full", target: "report-fixes", activeViews: ["weakspots", "verdicts"] },
    { key: "training", label: "Training", mode: "full", target: "report-training-plan", activeViews: ["train", "training"] },
    { key: "games", label: "Games/Data", mode: "table", target: "report-recent-games", activeViews: ["games", "data"] },
  ];

  const jumpToView = (view) => {
    if (view.mode) onReportModeChange?.(view.mode);
    onNavigate?.({ path: "/report", target: view.target || view.key, reportMode: view.mode });
  };
  const tabItems = views.map((view) => ({
    ...view,
    active:
      activeView === view.key ||
      view.activeViews?.includes(activeView) ||
      (view.mode === "summary" && reportMode === "summary") ||
      (view.mode === "table" && reportMode === "table"),
  }));

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
        <span>Primary next action</span>
        <strong>
          {focusOpening?.name
            ? "Train this line"
            : "Review repertoire"}
        </strong>
      </div>

      <TabNavigation
        className="reportCommandBar__tabs"
        ariaLabel="Report sections"
        items={tabItems}
        onSelect={jumpToView}
      />
    </section>
  );
}
