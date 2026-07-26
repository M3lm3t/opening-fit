import InfoHint from "./InfoHint.jsx";
import { buildOpeningVerdictPresentation } from "../lib/fitTrustModel.js";
import "./OpeningVerdictSummary.css";

export default function OpeningVerdictSummary({ opening, verdict = "Review", showRecommendation = true, compact = false }) {
  const model = buildOpeningVerdictPresentation(opening || {}, { verdict });
  const metrics = [
    ["Fit", model.fit],
    ["Performance", model.performance],
    ["Confidence", model.confidence],
  ];
  const numericDetails = [
    model.fit.score !== null ? `Fit signal ${model.fit.score}/100` : "",
    model.performance.score !== null ? `Chess score ${model.performance.score}%` : "",
    model.confidence.games ? `${model.confidence.games} relevant game${model.confidence.games === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return (
    <div className={`openingVerdictSummary ${compact ? "openingVerdictSummary--compact" : ""}`}>
      <div className="openingVerdictBands" aria-label="Opening fit, current performance and evidence confidence">
        {metrics.map(([label, metric]) => (
          <span className={`openingVerdictBand openingVerdictBand--${String(metric.label).toLowerCase().replaceAll(" ", "-")}`} key={label}>
            <small>{label}</small><strong>{metric.label}</strong>
            <InfoHint label={`What ${label.toLowerCase()} means`}>{metric.definition}</InfoHint>
          </span>
        ))}
      </div>
      {showRecommendation ? <p className="openingVerdictRecommendation"><strong>Verdict:</strong> {model.recommendation}</p> : null}
      {numericDetails.length ? <details className="openingVerdictNumbers"><summary>Underlying numbers</summary><p>{numericDetails.join(" · ")}</p><small>{model.confidence.detail}</small></details> : null}
    </div>
  );
}
