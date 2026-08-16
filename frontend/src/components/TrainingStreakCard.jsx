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
    const update = (event) => { if (active && event.detail) { setStreak(event.detail); setAvailable(true); } };
    window.addEventListener(TRAINING_STREAK_UPDATED_EVENT, update);
    return () => { active = false; window.removeEventListener(TRAINING_STREAK_UPDATED_EVENT, update); };
  }, [user?.id]);

  if (!user?.id || !available) return null;
  const days = streak.currentStreak;
  return (
    <aside className="trainingStreakCard" aria-label="Daily training streak">
      <Flame size={21} aria-hidden="true" />
      <div>
        <strong>{days} day streak</strong>
        <span>{streak.completedToday ? "Streak secured for today." : "Complete one training action today to keep it going."}</span>
      </div>
      <small>Best: {streak.longestStreak} days</small>
    </aside>
  );
}
