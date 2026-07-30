import { buildReportGameCounts, reportCountSentence, reportExclusionSummary, reportSaveState, REPORT_COUNT_DEFINITIONS } from "../lib/reportGameCounts.js";
import { isSampleReport } from "../fixtures/sampleReport.js";

const labelForKey = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

export default function ReportGameCountSummary({ report, saveStatus = "", authenticated = false, onAccount }) {
  const counts = buildReportGameCounts(report);
  const sampleMode = isSampleReport(report);
  const save = reportSaveState(saveStatus, authenticated, sampleMode);
  const exclusions = reportExclusionSummary(report);
  return (
    <section className="reportGameCountSummary" aria-label="Import and save status">
      <div className="reportGameCountCompact">
        <span><strong>{counts.imported}</strong> imported</span>
        <span><strong>{counts.analysedGames}</strong> analysed</span>
        <span><strong>{counts.excludedGames}</strong> excluded</span>
        <span><strong>{save.label}</strong></span>
      </div>
      {counts.excludedGames ? <p className="reportGameExclusionSummary">{exclusions.summary}</p> : null}
      {exclusions.confidenceNote ? <p role="status" className="reportGameConfidenceNote">{exclusions.confidenceNote}</p> : null}
      <details>
        <summary>Import and exclusion details</summary>
        <p>{reportCountSentence(report)}</p>
        <dl>
          {Object.entries(REPORT_COUNT_DEFINITIONS).map(([key, definition]) => (
            <div key={key}><dt>{labelForKey(key)} · {counts[key] ?? "Unavailable"}</dt><dd>{definition}</dd></div>
          ))}
        </dl>
        {!counts.breakdownAvailable ? <p>Detailed processing-stage counts were not stored with this older report.</p> : null}
        {counts.excludedGames ? <div className="reportGameExclusions"><strong>Why games were not analysed</strong><ul>{counts.exclusionReasons.length ? counts.exclusionReasons.map((reason) => <li key={`${reason.key}-${reason.label}`}>{reason.label}{reason.count === null ? "" : `: ${reason.count}`}</li>) : <li>Reason unavailable: {counts.excludedGames}</li>}</ul></div> : null}
        <p><a href="/how-it-works">How filtering, limits and opening signals work</a></p>
      </details>
      <details>
        <summary>Save details</summary>
        <p>{save.detail}</p>
        {!sampleMode && (saveStatus === "local" || saveStatus === "failed" || !authenticated) && onAccount ? <button type="button" className="secondaryBtn" onClick={onAccount}>{authenticated ? "Open account" : "Log in to sync"}</button> : null}
      </details>
    </section>
  );
}
