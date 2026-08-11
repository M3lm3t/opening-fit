import { useEffect, useState } from "react";
import "./RatingGoalCard.css";

export default function RatingGoalCard({ goal, onSaveGoal, onProgress }) {
  const goalTarget = goal?.target || "";
  const goalCurrent = goal?.current || "";
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(goalTarget);
  const [current, setCurrent] = useState(goalCurrent);

  useEffect(() => {
    if (open) return;
    setTarget(goalTarget);
    setCurrent(goalCurrent);
  }, [goalCurrent, goalTarget, open]);

  const save = () => {
    onSaveGoal?.({
      targetRating: Number(target) || null,
      currentRating: Number(current) || null,
      startRating: goal?.start || Number(current) || null,
    });
    setOpen(false);
  };

  return (
    <section className="coachDashboardCard ratingGoalCard" aria-labelledby="rating-goal-title">
      <div className="coachCardHeader">
        <span id="rating-goal-title">Training goal</span>
        <strong>{goal?.hasGoal ? `${goal.progress}% tracked` : "Not set"}</strong>
      </div>
      {goal?.hasGoal ? (
        <>
          <p>Current {goal.current ?? "—"}{goal.ratingSourceLabel ? ` from ${goal.ratingSourceLabel}` : ""} · Target {goal.target}</p>
          <div className="todayProgressTrack" aria-label={`${goal.progress}% of rating goal tracked`}>
            <span style={{ width: `${goal.progress}%` }} />
          </div>
        </>
      ) : (
        <p>{goal?.hasImportedRating ? `Current rating ${goal.current} was detected from ${goal.ratingSourceLabel || "your latest import"}.` : "Add a personal rating target if it helps you track your longer-term goal."}</p>
      )}
      <p className="ratingGoalNote">This is a tracking goal. It does not change analysis or guarantee rating gains.</p>
      <div className="coachCardActions">
        <button type="button" className="secondaryBtn" onClick={() => setOpen(true)}>{goal?.hasGoal ? "Change goal" : "Set goal"}</button>
        {onProgress ? <button type="button" className="secondaryBtn" onClick={onProgress}>View progress</button> : null}
      </div>
      {open ? (
        <div className="ratingGoalEditor" role="dialog" aria-label="Set rating goal">
          <label>Current rating<input value={current} inputMode="numeric" onChange={(event) => setCurrent(event.target.value)} /></label>
          <label>Target rating<input value={target} inputMode="numeric" onChange={(event) => setTarget(event.target.value)} /></label>
          <div className="coachCardActions">
            <button type="button" className="primaryBtn" onClick={save}>Save goal</button>
            <button type="button" className="secondaryBtn" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
