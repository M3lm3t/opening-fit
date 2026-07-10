import { useMemo } from "react";
import {
  buildMistakePracticeTarget,
  hasUsableMistakePracticeData,
} from "../services/mistakeBasedPractice";
import "./MistakeBasedPractice.css";

export default function MistakeBasedPractice({
  data,
  opening,
  compact = false,
  onStart,
  onReviewGame,
  onDashboard,
  showEmpty = true,
  className = "",
}) {
  const target = useMemo(() => buildMistakePracticeTarget({ data, opening }), [data, opening]);
  const usable = hasUsableMistakePracticeData(target);
  const meta = target?.practiceMeta || {};
  const classes = ["mistakePracticeCard", compact ? "mistakePracticeCard--compact" : "", className]
    .filter(Boolean)
    .join(" ");

  if (!target || !usable) {
    if (!showEmpty) return null;

    return (
      <section className={classes} aria-label="Mistake based practice">
        <div>
          <span>Targeted practice</span>
          <h3>More game data needed</h3>
          <p>
            We have identified the opening to work on. Play a few more games or refresh your analysis and
            OpeningFit will turn your recurring positions into targeted practice.
          </p>
        </div>
        {onDashboard ? (
          <button type="button" onClick={onDashboard}>Return to dashboard</button>
        ) : null}
      </section>
    );
  }

  return (
    <section className={classes} aria-label={`Practice ${target.name}`}>
      <div className="mistakePracticeCard__main">
        <span>Targeted practice - {meta.estimatedMinutes || 5} minutes</span>
        <h3>{meta.title || `Practice your ${target.name}`}</h3>
        <p>{meta.explanation}</p>
      </div>

      <div className="mistakePracticeCard__meta" aria-label="Practice details">
        <span>{target.practiceSide === "black" ? "You play Black" : "You play White"}</span>
        <span>{meta.skill || "move order"}</span>
        <span>{meta.hasExactMoves ? "Real move sequence" : "Safe opening fallback"}</span>
      </div>

      <div className="mistakePracticeCard__actions">
        <button type="button" onClick={() => onStart?.(target)}>
          Practice this position
        </button>
        {meta.relatedGame && onReviewGame ? (
          <button type="button" onClick={() => onReviewGame(meta.relatedGame)}>
            Review related game
          </button>
        ) : null}
      </div>
    </section>
  );
}

