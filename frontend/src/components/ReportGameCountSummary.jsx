import { buildReportGameCounts, reportCountSentence, REPORT_COUNT_DEFINITIONS } from "../lib/reportGameCounts.js";

const labelForKey = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

export default function ReportGameCountSummary({ report }) {
  const counts = buildReportGameCounts(report);
  return (
    <section className="reportGameCountSummary" aria-label="Games used in this report">
      <p>{reportCountSentence(report)}</p>
      <details>
        <summary>What these counts mean{counts.excludedGames ? ` · ${counts.excludedGames} not analysed` : ""}</summary>
        <dl>
          {Object.entries(REPORT_COUNT_DEFINITIONS).map(([key, definition]) => (
            <div key={key}><dt>{labelForKey(key)} · {counts[key] ?? "Unavailable"}</dt><dd>{definition}</dd></div>
          ))}
        </dl>
        {!counts.breakdownAvailable ? <p>Detailed processing-stage counts were not stored with this older report.</p> : null}
        {counts.exclusionReasons.length ? <div className="reportGameExclusions"><strong>Why games were not analysed</strong><ul>{counts.exclusionReasons.map((reason) => <li key={`${reason.key}-${reason.label}`}>{reason.label}{reason.count === null ? "" : `: ${reason.count}`}</li>)}</ul></div> : null}
      </details>
    </section>
  );
}
