import { useMemo } from "react";
import { buildMeaningfulProgressSummary } from "../lib/meaningfulProgressSummary.js";
import "./SinceLastReportSummary.css";

export default function SinceLastReportSummary({ currentSnapshot, reportSnapshots = [] }) {
  const view = useMemo(() => buildMeaningfulProgressSummary({ currentSnapshot, reportSnapshots }), [currentSnapshot, reportSnapshots]);
  if (view.state !== "ready") return null;
  return (
    <section className="sinceLastReportSummary" aria-labelledby="since-last-report-title">
      <header><p className="coachEyebrow">Progress</p><h2 id="since-last-report-title">Since your last report</h2></header>
      <ul>{view.rows.map((row) => <li key={row.key}><span>{row.category}</span><div><strong>{row.title}</strong><p>{row.text}</p></div></li>)}</ul>
    </section>
  );
}
