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
        <span><strong>{counts.fetchedGames ?? "Unavailable"}</strong> found</span>
        <span><strong>{counts.usedForOpeningStats ?? "Unavailable"}</strong> used</span>
        <span><strong>{counts.excludedGames ?? "Unavailable"}</strong> excluded</span>
        <span><strong>{save.label}</strong></span>
      </div>
      {counts.excludedGames ? <p className="reportGameExclusionSummary">{exclusions.summary}</p> : null}
      {exclusions.confidenceNote ? <p role="status" className="reportGameConfidenceNote">{exclusions.confidenceNote}</p> : null}
      <details>
        <summary>Import and exclusion details</summary>
        <p>{reportCountSentence(report)}</p>
        {counts.contractVersion >= 4 && counts.countStatus === "canonical" ? <ol className="reportGamePipeline">
          <li><strong>{counts.fetchedGames}</strong> Games fetched</li>
          <li><strong>{counts.eligibleGames}</strong> Eligible</li>
          <li><strong>{counts.pgnAvailableGames}</strong> PGN or moves available</li>
          <li><strong>{counts.parsedGames}</strong> Parsed</li>
          <li><strong>{counts.attributedGames}</strong> Attributed to the player</li>
          <li><strong>{counts.classifiedGames}</strong> Classified</li>
          <li><strong>{counts.usedForOpeningStats}</strong> Used in opening statistics</li>
          <li><strong>{counts.excludedGames}</strong> Excluded from opening statistics</li>
        </ol> : null}
        {counts.analysisLimit ? <p><strong>Maximum-game cap:</strong> {counts.analysisLimit}. {counts.analysisSelectionRule === "newest_first" ? "Matching games are selected newest first; capped games are not invalid." : "The stored report does not identify the selection order."}</p> : null}
        <dl>
          {Object.entries(REPORT_COUNT_DEFINITIONS).map(([key, definition]) => (
            <div key={key}><dt>{labelForKey(key)} · {counts[key] ?? "Unavailable"}</dt><dd>{definition}</dd></div>
          ))}
        </dl>
        {!counts.breakdownAvailable ? <p>Exact import breakdown unavailable for this older report.</p> : null}
        {counts.excludedGames ? <div className="reportGameExclusions"><strong>Why games were not used in opening statistics</strong><ul>{counts.exclusionReasons.length ? counts.exclusionReasons.map((reason) => <li key={`${reason.key}-${reason.label}`}>{reason.label}{reason.count === null ? "" : `: ${reason.count}`}</li>) : <li>Reason unavailable: {counts.excludedGames}</li>}</ul></div> : null}
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
