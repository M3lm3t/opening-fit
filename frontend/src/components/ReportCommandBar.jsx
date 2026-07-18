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

      <TabNavigation
        className="reportCommandBar__tabs"
        ariaLabel="Report sections"
        items={tabItems}
        onSelect={jumpToView}
      />
    </section>
  );
}
