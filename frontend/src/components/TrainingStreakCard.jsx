import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { useAuth } from "../context/AuthDataProvider.jsx";
import { emptyTrainingStreak, getTrainingStreak, TRAINING_STREAK_UPDATED_EVENT } from "../services/trainingStreakService.js";
import "./TrainingStreakCard.css";

export default function TrainingStreakCard() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(emptyTrainingStreak);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!user?.id) { setAvailable(false); setStreak(emptyTrainingStreak()); return undefined; }
    let active = true;
    getTrainingStreak(user.id).then((value) => { if (active) { setStreak(value); setAvailable(true); } }).catch(() => { if (active) setAvailable(false); });
    const update = (event) => { if (!active) return; if (event.detail) { setStreak(event.detail); setAvailable(true); return; } getTrainingStreak(user.id).then((value) => { if (active) { setStreak(value); setAvailable(true); } }).catch(() => {}); };
    window.addEventListener(TRAINING_STREAK_UPDATED_EVENT, update);
    return () => { active = false; window.removeEventListener(TRAINING_STREAK_UPDATED_EVENT, update); };
  }, [user?.id]);

  if (!user?.id || !available) return null;
  const days = streak.currentStreak;
  const statusCopy = { active: "A meaningful action was completed today.", resting: "Resting today. Your two-day grace period is intact.", at_risk: "Today is the final grace day before a reset.", reset: `Start again with your next meaningful session. Previous best: ${streak.longestStreak} days.`, recovered: "Your permitted recovery kept this run active." };
  return (
    <aside className={`trainingStreakCard trainingStreakCard--${streak.status}`} aria-label="Meaningful coaching consistency">
      <Flame size={21} aria-hidden="true" />
      <div>
        <strong>{days} meaningful day{days === 1 ? "" : "s"}</strong>
        <span>{statusCopy[streak.status] || statusCopy.reset}</span>
      </div>
      <small>{streak.weeklyCompleted} of {streak.weeklyTarget} this week</small>
      <details><summary>What counts?</summary><p>Completed training sessions, source-game or position reviews, saved or recalled response plans, and completed Game Checks. Opening the app or viewing a report does not count.</p></details>
      {streak.latestMilestone && streak.currentStreak === streak.latestMilestone ? <p className="trainingStreakMilestone" role="status">{streak.latestMilestone} meaningful days</p> : null}
    </aside>
  );
}
