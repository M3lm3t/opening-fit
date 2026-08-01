import { TabNavigation } from "./ui/UiPrimitives.jsx";
import { isSampleReport } from "../fixtures/sampleReport.js";
import { buildReportGameCounts, reportSaveState } from "../lib/reportGameCounts.js";
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

function reportDate(data, model) {
  const value = model?.header?.date || data?.importedAt || data?.imported_at || data?.lastUpdated || data?.last_updated;
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

function evidenceConfidenceLabel(model) {
  const explicitLabel =
    model?.authoritative?.repertoireHealth?.confidence?.label ||
    model?.authoritative?.repertoireHealth?.confidenceLabel ||
    model?.authoritative?.confidence?.label;
  if (explicitLabel) return explicitLabel;

  const status = String(
    model?.authoritative?.repertoireHealth?.confidence?.status ||
    model?.authoritative?.confidence?.status ||
    "",
  ).trim().toLowerCase();
  const labels = {
    sufficient: "Sufficient evidence",
    high: "High confidence",
    high_sample: "High sample confidence",
    moderate: "Moderate confidence",
    moderate_sample: "Moderate sample confidence",
    low: "Low confidence",
    low_sample: "Low sample confidence",
    insufficient: "Insufficient evidence",
  };
  if (labels[status]) return labels[status];

  const fallback = String(model?.health?.confidence || "").trim();
  return /(?:confidence|insufficient|sufficient|uncertain)/i.test(fallback)
    ? fallback
    : "Unavailable";
}

export default function ReportCommandBar({
  data,
  model,
  activeSection = "summary",
  onSectionChange,
  saveStatus = "",
  authenticated = false,
}) {
  if (!data) return null;

  const username = getUsername(data);
  const platform = getPlatform(data);
  const games = getGames(data);
  const sampleMode = isSampleReport(data);
  const counts = buildReportGameCounts(data);
  const save = reportSaveState(saveStatus, authenticated, sampleMode);
  const confidence = evidenceConfidenceLabel(model);

  const tabItems = REPORT_VIEWS.map((view) => ({ ...view, active: view.key === activeSection, id: `report-tab-${view.key}`, controls: `report-${view.key}-view` }));

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

      <div className="reportCommandBar__context" aria-label="Report context">
        <span>{reportDate(data, model)}</span>
        <span>{counts.fetchedGames ?? "Unavailable"} found</span>
        <span>{counts.usedForOpeningStats ?? "Unavailable"} used</span>
        <span>{counts.excludedGames ?? "Unavailable"} excluded</span>
        <span>Evidence Confidence: {confidence}</span>
        <span>{save.label}</span>
      </div>

      <TabNavigation
        className="reportCommandBar__tabs"
        ariaLabel="Report sections"
        items={tabItems}
        activeKey={activeSection}
        semanticTabs
        onSelect={(view) => onSectionChange?.(view.key)}
      />
    </section>
  );
}
