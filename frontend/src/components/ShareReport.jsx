import { useMemo, useState } from "react";
import { buildShareReportModel } from "../lib/shareReportPresentation.js";
import OpeningVerdictSummary from "./OpeningVerdictSummary.jsx";

export default function ShareReport({ data }) {
  const [copied, setCopied] = useState(false);
  const report = useMemo(() => buildShareReportModel(data), [data]);

  if (!data || !report) return null;

  const encodedText = encodeURIComponent(report.text);
  const encodedUrl = encodeURIComponent("https://www.openingfit.com");

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert("Could not copy automatically. You can manually copy the report text.");
    }
  };

  const shareOnTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, "_blank", "noopener,noreferrer");
  };

  const shareOnReddit = () => {
    window.open(
      `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent("My OpeningFit chess opening report")}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <section className="shareReportShell" id="share-report">
      <div className="shareReportHeader">
        <div>
          <div className="shareReportEyebrow">Share your result</div>
          <h2>Share this report</h2>
          <p>
            Copy your result or share it to ask for feedback.
          </p>
        </div>

        <div className="shareReportActions">
          <button type="button" onClick={copyReport}>
            {copied ? "Copied!" : "Copy report"}
          </button>

          <button type="button" className="ghost" onClick={shareOnTwitter}>
            Share on X
          </button>

          <button type="button" className="ghost" onClick={shareOnReddit}>
            Share on Reddit
          </button>
        </div>
      </div>

      <div className="shareReportCard">
        <div className="shareReportTop">
          <span>{report.sample ? "Illustrative example ? Fictional data" : "OpeningFit report"}</span>
          <strong>{report.username}</strong>
        </div>

        <div className="shareReportMain">
          <div>
            <span>Style</span>
            <h3>{report.style}</h3>
          </div>

          <div>
            <span>Games analysed</span>
            <h3>{report.gamesImported || "Imported"}</h3>
          </div>
        </div>

        <div className="shareReportResultGrid">
          <div className="shareReportResult best">
            <span>Established strength</span>
            <h3>{report.best?.name || "Not enough evidence yet"}</h3>
            {report.best ? <OpeningVerdictSummary opening={report.best.source} verdict="keep" compact /> : <p>Not enough evidence yet</p>}
          </div>

          <div className="shareReportResult fix">
            <span>Primary problem</span>
            <h3>{report.weakest?.name || "No supported repair target yet"}</h3>
            {report.weakest ? <OpeningVerdictSummary opening={report.weakest.source} verdict="repair" compact /> : <p>No weakness claim is supported</p>}
          </div>
        </div>

        <div className="shareReportText">
          <pre>{report.text}</pre>
        </div>
      </div>
    </section>
  );
}
