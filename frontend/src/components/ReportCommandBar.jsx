import { TabNavigation } from "./ui/UiPrimitives.jsx";
import { isSampleReport } from "../fixtures/sampleReport.js";
import { buildReportGameCounts } from "../lib/reportGameCounts.js";
import { REPORT_VIEWS } from "../lib/reportViews.js";

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
  return buildReportGameCounts(data).analysedGames;
}

export default function ReportCommandBar({
  data,
  activeSection = "summary",
  onSectionChange,
}) {
  if (!data) return null;

  const username = getUsername(data);
  const platform = getPlatform(data);
  const games = getGames(data);
  const sampleMode = isSampleReport(data);

  const tabItems = REPORT_VIEWS.map((view) => ({ ...view, active: view.key === activeSection }));

  return (
    <section className="reportCommandBar" aria-label="Report command bar" data-app-action-router-ignore="true">
      <div className="reportCommandBar__summary">
        <span className="reportCommandBar__status">{sampleMode ? "Illustrative example" : "Live report"}</span>
        <div>
          <strong>{username}</strong>
          <p>
            {sampleMode ? "Fictional data" : platform}
            {games ? ` · ${games} game${games === 1 ? "" : "s"} analysed` : ""}
          </p>
        </div>
      </div>

      <TabNavigation
        className="reportCommandBar__tabs"
        ariaLabel="Report sections"
        items={tabItems}
        activeKey={activeSection}
        onSelect={(view) => onSectionChange?.(view.key)}
      />
    </section>
  );
}
