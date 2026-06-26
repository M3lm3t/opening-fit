import { useMemo } from "react";
import { buildWeeklyOpeningSession } from "../services/weeklyOpeningSession";
import "./WeeklyOpeningSessionCard.css";

export default function WeeklyOpeningSessionCard({
  data,
  fitData,
  onReview,
  onPractice,
  onFullPlan,
  showEmptyState = false,
}) {
  const session = useMemo(() => buildWeeklyOpeningSession(data, fitData), [data, fitData]);

  if (!session.hasAnalysis && !showEmptyState) return null;

  if (!session.hasAnalysis) {
    return (
      <section className="weeklyOpeningSessionCard weeklyOpeningSessionCardEmpty" aria-label="Opening session">
        <p className="eyebrow">Opening session</p>
        <h2>Your first session starts after analysis</h2>
        <p>{session.emptyTitle}</p>
        <small>{session.emptyText}</small>
      </section>
    );
  }

  const startFirstAction = () => {
    onReview?.(session.primaryRoute, session);
  };

  const openAction = (action) => {
    if (action.practiceTarget) {
      onPractice?.(action.practiceTarget);
      return;
    }
    onReview?.(action.route || "training", session);
  };

  return (
    <section className="weeklyOpeningSessionCard" aria-labelledby="weekly-opening-session-title">
      <div className="weeklyOpeningSessionHeader">
        <div>
          <p className="eyebrow">{session.weekLabel || "Latest report"}</p>
          <h2 id="weekly-opening-session-title">Your 15-minute opening session</h2>
        </div>
        <span>{session.targetName}</span>
      </div>

      <p className="weeklyOpeningSessionRationale">{session.rationale}</p>

      <div className="weeklyOpeningSessionActions" aria-label="15-minute opening session actions">
        {session.actions.map((action) => (
          <button type="button" key={action.key} onClick={() => openAction(action)}>
            <strong>{action.title}</strong>
            <span>{action.time}</span>
            <small>{action.detail}</small>
          </button>
        ))}
      </div>

      <div className="weeklyOpeningSessionFooter">
        <button type="button" className="primaryBtn" onClick={startFirstAction}>
          Start with review
        </button>
        <button type="button" className="secondaryButton" onClick={() => onFullPlan?.(session)}>
          See full plan
        </button>
      </div>
    </section>
  );
}
