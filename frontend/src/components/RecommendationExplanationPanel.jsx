import { useMemo } from "react";
import InfoHint from "./InfoHint";
import MistakeBasedPractice from "./MistakeBasedPractice";
import { getRecommendationExplanation } from "../services/recommendationExplanations";
import "./RecommendationExplanationPanel.css";

export default function RecommendationExplanationPanel({
  recommendation,
  report,
  alternatives = [],
  category,
  compact = false,
  onAction,
  onPracticeTarget,
  className = "",
}) {
  const explanation = useMemo(
    () => getRecommendationExplanation({ recommendation, report, alternatives, category }),
    [recommendation, report, alternatives, category]
  );

  const classes = [
    "recommendationExplanationPanel",
    `recommendationExplanationPanel--${explanation.tone}`,
    compact ? "recommendationExplanationPanel--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} aria-label={`${explanation.title} explanation`}>
      <div className="recommendationExplanationPanel__header">
        <div>
          <span>{explanation.reasonCategory}</span>
          <h4>{explanation.title}</h4>
        </div>
        <InfoHint label={`Why am I seeing this recommendation for ${explanation.title}?`}>
          {explanation.coachingNote}
        </InfoHint>
      </div>

      <p>{explanation.reason}</p>

      {explanation.evidence.length ? (
        <div className="recommendationExplanationPanel__chips" aria-label="Recommendation evidence">
          {explanation.evidence.map((chip) => (
            <span key={`${chip.label}-${chip.value}`}>
              <b>{chip.label}</b>
              {chip.value}
            </span>
          ))}
        </div>
      ) : null}

      <details className="recommendationExplanationPanel__details">
        <summary>Why am I seeing this?</summary>
        <p>{explanation.coachingNote}</p>
      </details>

      <div className="recommendationExplanationPanel__next">
        <span>What to do next</span>
        {onAction ? (
          <button type="button" onClick={() => onAction(explanation)}>
            {explanation.actionLabel}
          </button>
        ) : (
          <strong>{explanation.actionLabel}</strong>
        )}
      </div>

      {onPracticeTarget ? (
        <MistakeBasedPractice
          data={report}
          opening={recommendation}
          compact
          showEmpty={false}
          onStart={onPracticeTarget}
        />
      ) : null}
    </section>
  );
}
