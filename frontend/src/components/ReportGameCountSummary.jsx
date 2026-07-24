import { buildReportGameCounts, reportCountSentence, REPORT_COUNT_DEFINITIONS } from "../lib/reportGameCounts.js";

export default function ReportGameCountSummary({ report }) {
  const counts = buildReportGameCounts(report);
  return (
    <section className="reportGameCountSummary" aria-label="Games used in this report">
      <p>{reportCountSentence(report)}</p>
      <details>
        <summary>What these counts mean{counts.excluded ? ` · ${counts.excluded} excluded` : ""}</summary>
        <dl>
          {Object.entries(REPORT_COUNT_DEFINITIONS).map(([key, definition]) => (
            <div key={key}><dt>{key[0].toUpperCase() + key.slice(1)} · {counts[key]}</dt><dd>{definition}</dd></div>
          ))}
        </dl>
        {counts.exclusionReasons.length ? <div className="reportGameExclusions"><strong>Why games were excluded</strong><ul>{counts.exclusionReasons.map((reason) => <li key={`${reason.key}-${reason.label}`}>{reason.label}{reason.count === null ? "" : `: ${reason.count}`}</li>)}</ul></div> : null}
      </details>
    </section>
  );
}
