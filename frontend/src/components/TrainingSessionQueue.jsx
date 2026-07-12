import { useEffect, useMemo, useState } from "react";
import { REPERTOIRE_STORAGE_KEY } from "../lib/repertoireWorkspace";
import { TRAINING_SESSION_KEY, TRAINING_TASK_COMPLETED_EVENT, buildFiniteSession, buildTrainingQueue } from "../lib/trainingQueue";
import { trackProductEvent } from "../lib/productAnalytics";

const OUTCOMES_KEY = "openingFit:trainingOutcomes:v1";
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; } };

export default function TrainingSessionQueue({ data, selectedTarget, onStart, onReport, onAnalyse }) {
  const [outcomes, setOutcomes] = useState(() => read(OUTCOMES_KEY, []));
  const repertoire = read(REPERTOIRE_STORAGE_KEY, { items: [] });
  const queue = useMemo(() => {
    const built = buildTrainingQueue(data || {}, repertoire, outcomes);
    if (!selectedTarget) return built;
    const title = selectedTarget.opening || selectedTarget.name || "Selected line";
    return [{ id: `selected:${title}`, priority: 2000, type: "Opened from your report or repertoire", title, reason: selectedTarget.reason || selectedTarget.selectedReason || "Train the line you selected.", target: selectedTarget }, ...built].filter((task, index, rows) => rows.findIndex((row) => row.id === task.id) === index);
  }, [data, outcomes, repertoire, selectedTarget]);
  const session = useMemo(() => buildFiniteSession(queue), [queue]);
  const [completed, setCompleted] = useState(() => read(TRAINING_SESSION_KEY, {}).completed || 0);

  useEffect(() => {
    localStorage.setItem(TRAINING_SESSION_KEY, JSON.stringify({ id: session.id, completed, currentTask: Math.min(completed, Math.max(0, session.tasks.length - 1)), updatedAt: new Date().toISOString() }));
  }, [completed, session]);
  useEffect(() => { if (session.tasks.length && completed >= session.tasks.length) void trackProductEvent("training_session_completed", { resultCategory: "completed", source: "personalised_queue" }, { onceKey: session.id }); }, [completed, session]);
  useEffect(() => {
    const handleCompletion = (event) => {
      const task = session.tasks[Math.min(completed, session.tasks.length - 1)];
      if (!task) return;
      const result = { taskId: task.id, opening: task.title, result: event.detail?.result || "completed", completedAt: new Date().toISOString() };
      const next = [result, ...outcomes].slice(0, 100);
      localStorage.setItem(OUTCOMES_KEY, JSON.stringify(next)); setOutcomes(next); setCompleted((value) => Math.min(session.tasks.length, value + 1));
    };
    window.addEventListener(TRAINING_TASK_COMPLETED_EVENT, handleCompletion);
    return () => window.removeEventListener(TRAINING_TASK_COMPLETED_EVENT, handleCompletion);
  }, [completed, outcomes, session.tasks]);

  if (!session.tasks.length) return <section className="trainingSessionQueue productEmptyState"><div><p className="eyebrow">Personal training</p><h2>No personalised position is ready yet.</h2><p>The report needs a repeated line, saved repertoire choice, or usable move sequence.</p></div><div className="productStateAction"><button type="button" onClick={onAnalyse}>Analyse more games</button><button type="button" onClick={() => onStart?.("Italian Game")}>Try a sample session</button></div></section>;
  if (completed >= session.tasks.length) return <section className="trainingSessionQueue trainingCompletion"><p className="eyebrow">Session complete</p><h2>{completed} tasks completed</h2><p><strong>Main lesson:</strong> {session.tasks[0]?.reason}</p><p><strong>Next-game objective:</strong> {session.objective}</p><div><button type="button" onClick={onReport}>Return to report</button><a href="https://www.chess.com/play/online" target="_blank" rel="noreferrer">Play a game</a></div></section>;
  return <section className="trainingSessionQueue" aria-labelledby="training-session-title"><header><div><p className="eyebrow">5–10 minute session</p><h2 id="training-session-title">Your personalised training queue</h2></div><strong>{completed}/{session.tasks.length} complete</strong></header><ol>{session.tasks.map((task, index) => <li key={task.id} className={index === completed ? "isCurrent" : index < completed ? "isComplete" : ""}><span>{index + 1}</span><div><small>{task.type}</small><h3>{task.title}</h3><p>{task.exercise}. {task.reason}</p></div><button type="button" onClick={() => onStart?.(task.target)} disabled={index > completed}>{index < completed ? "Review" : index === completed ? "Start task" : "Queued"}</button></li>)}</ol><p><strong>Next-game objective:</strong> {session.objective}</p></section>;
}
