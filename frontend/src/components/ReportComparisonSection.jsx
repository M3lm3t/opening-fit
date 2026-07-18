import { useEffect, useMemo, useRef } from "react";
import { buildReportComparisonView } from "../lib/reportComparisonPresentation.js";

export default function ReportComparisonSection({
  currentSnapshot,
  reportSnapshots = [],
  loading = false,
  error = "",
  onViewHistory,
  onAnalytics,
}) {
  const view = useMemo(
    () => buildReportComparisonView({ currentSnapshot, reportSnapshots, loading, error }),
    [currentSnapshot, error, loading, reportSnapshots]
  );
  const viewedStateRef = useRef("");

  useEffect(() => {
    if (!["ready", "first-report"].includes(view.state)) return;
    if (viewedStateRef.current === view.state) return;
    viewedStateRef.current = view.state;
    void onAnalytics?.("report_comparison_viewed", {
      source: "report",
      reportCount: reportSnapshots.length,
    });
  }, [onAnalytics, reportSnapshots.length, view.state]);

  const openHistory = () => {
    void onAnalytics?.("report_history_opened", {
      source: "report_comparison",
      reportCount: reportSnapshots.length,
    });
    onViewHistory?.();
  };

  return (
    <section className={`reportComparisonSection reportComparisonSection--${view.state}`} aria-labelledby="report-comparison-title" aria-busy={view.state === "loading"}>
      <header className="reportComparisonHeader">
        <div>
          <p className="eyebrow">Progress comparison</p>
          <h2 id="report-comparison-title">{view.title}</h2>
        </div>
        {view.hasHistory && onViewHistory ? <button type="button" className="secondaryBtn" onClick={openHistory}>View report history</button> : null}
      </header>

      {view.message ? <p className="reportComparisonMessage" role={view.state === "error" ? "alert" : "status"}>{view.message}</p> : null}
      {view.state === "loading" ? <div className="reportComparisonSkeleton" role="status"><span /><span /><span /></div> : null}

      {view.primaryHighlights.length ? (
        <ul className="reportComparisonHighlights">
          {view.primaryHighlights.map((highlight, index) => (
            <li key={`${highlight.type || "highlight"}:${index}`} className={`reportComparisonHighlight reportComparisonHighlight--${highlight.status.replaceAll(" ", "-")}`}>
              <span>{highlight.statusLabel}</span>
              <p>{highlight.text}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {view.state === "ready" && (view.details.length || view.warnings.length) ? (
        <details className="reportComparisonDetails">
          <summary>View full comparison details</summary>
          <div className="reportComparisonDetailBody">
            {view.details.length ? (
              <dl className="reportComparisonDetailList">
                {view.details.map((detail) => (
                  <div key={detail.key}>
                    <dt><strong>{detail.title}</strong><span className={`reportComparisonStatus reportComparisonStatus--${detail.status.replaceAll(" ", "-")}`}>{detail.statusLabel}</span></dt>
                    <dd>{detail.text}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {view.warnings.length ? <aside className="reportComparisonWarnings" aria-label="Comparison confidence warnings"><strong>Confidence and sample notes</strong><ul>{view.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></aside> : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}
