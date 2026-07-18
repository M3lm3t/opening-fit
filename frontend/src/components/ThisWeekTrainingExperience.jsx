import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Clock3, CloudOff, Play, RotateCcw, Target } from "lucide-react";
import { useAuth } from "../context/AuthDataProvider.jsx";
import { completeWeeklyTask, weeklyPlanWindow } from "../lib/weeklyTrainingPlan.js";
import { buildFoundationalWeeklyPlan, buildThisWeekTrainingView, openingForWeeklyTask } from "../lib/thisWeekTraining.js";
import { trackProductEvent } from "../lib/productAnalytics.js";
import { getOrCreateWeeklyTrainingPlan, setWeeklyTrainingTaskCompletion } from "../services/weeklyTrainingPlanService.js";
import { canUseFeature, OPENINGFIT_FEATURES } from "../lib/premiumEntitlement.js";
import { personaliseWeeklyTrainingPlan, readLocalTrainingPreferences, resolveTrainingPreferences } from "../lib/trainingPreferences.js";
import { TRAINING_PREFERENCES_EDIT_EVENT, TRAINING_PREFERENCES_UPDATED_EVENT } from "./PostReportOnboarding.jsx";
import FeatureAccessPreview from "./FeatureAccessPreview.jsx";
import "./ThisWeekTrainingExperience.css";
import "./ThisWeekTrainingCompletion.css";

const CACHE_PREFIX = "openingFit:thisWeekTraining";
const TASK_LABELS = {
  position_drill: "Position drill",
  line_replay: "Line replay",
  game_review: "Game review",
  concept_review: "Concept review",
};

function cacheKey(userId) {
  return `${CACHE_PREFIX}:${userId || "local"}`;
}

function readCache(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey(userId)) || "null");
    if (!value) return { plan: null, pendingTaskIds: [] };
    const entry = value.plan ? { plan: value.plan, pendingTaskIds: Array.isArray(value.pendingTaskIds) ? value.pendingTaskIds : [] } : { plan: value, pendingTaskIds: [] };
    if (entry.plan?.weekStart && entry.plan.weekStart !== weeklyPlanWindow().weekStart) return { plan: null, pendingTaskIds: [] };
    return entry;
  } catch {
    return { plan: null, pendingTaskIds: [] };
  }
}

function writeCache(userId, plan, pendingTaskIds = []) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify({ plan, pendingTaskIds: [...new Set(pendingTaskIds)] }));
  } catch {
    // The live plan remains usable when private storage is unavailable.
  }
}

function practiceTarget(task, plan) {
  const opening = openingForWeeklyTask(task, plan);
  return {
    id: opening.id,
    name: opening.name,
    opening: opening.name,
    practiceSide: opening.side,
    side: opening.side,
    positionFen: task.positionFen || null,
    expectedMoves: task.expectedMoves || [],
    sourceGameIds: task.sourceGameIds || [],
    trainingTarget: task,
  };
}

function TaskMeta({ task, plan }) {
  const opening = openingForWeeklyTask(task, plan);
  return (
    <div className="thisWeekTaskMeta" aria-label="Task details">
      <span>{TASK_LABELS[task.type] || "Training task"}</span>
      <span>{opening.name}</span>
      <span><Clock3 size={14} /> {task.estimatedMinutes || 5} min</span>
    </div>
  );
}

function PendingTaskCard({ task, plan, current, active, busy, onStart, onComplete }) {
  return (
    <article className={`thisWeekTaskCard ${current ? "thisWeekTaskCard--current" : ""}`} aria-current={current ? "step" : undefined}>
      <div className="thisWeekTaskOrder" aria-hidden="true">{task.order}</div>
      <div className="thisWeekTaskBody">
        <header>
          <div>{current ? <span className="thisWeekCurrentLabel">Up next</span> : <span>Later this week</span>}<h3>{task.title}</h3></div>
          <span className="thisWeekTaskState">Not completed</span>
        </header>
        <TaskMeta task={task} plan={plan} />
        <p className="thisWeekTaskExplanation">{task.explanation}</p>
        <details className="thisWeekSuccessCriteria">
          <summary>How to finish</summary>
          <p>{task.successCriteria}</p>
        </details>
        <div className="thisWeekTaskActions">
          <button type="button" className={current ? "primaryBtn" : "secondaryBtn"} onClick={() => onStart(task)}>
            <Play size={16} /> {active ? "Continue task" : "Start task"}
          </button>
          <button type="button" className="thisWeekCompleteButton" disabled={busy} onClick={() => onComplete(task)}>
            <Check size={16} /> {busy ? "Saving…" : "Mark complete"}
          </button>
        </div>
      </div>
    </article>
  );
}

function CompletedTask({ task, plan }) {
  return (
    <details className="thisWeekCompletedTask">
      <summary>
        <span className="thisWeekCompletedIcon"><Check size={15} /></span>
        <span><strong>{task.order}. {task.title}</strong><small>{TASK_LABELS[task.type] || "Training task"} · {task.estimatedMinutes || 5} min</small></span>
        <span>Completed</span>
      </summary>
      <div>
        <TaskMeta task={task} plan={plan} />
        <p>{task.explanation}</p>
      </div>
    </details>
  );
}

export default function ThisWeekTrainingExperience({ report, onPractice, onAnalyse, onReport, onUpgrade }) {
  const { user, entitlement, settings } = useAuth();
  const userId = user?.id || "";
  const [trainingPreferences, setTrainingPreferences] = useState(() => resolveTrainingPreferences({ authenticated: Boolean(user?.id), settings, localPreferences: readLocalTrainingPreferences() }));
  const hasWeeklyPlan = canUseFeature(entitlement, OPENINGFIT_FEATURES.WEEKLY_PLAN);
  const initial = useMemo(() => readCache(userId), [userId]);
  const [plan, setPlan] = useState(initial.plan);
  const [loading, setLoading] = useState(Boolean(userId && !initial.plan));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyTaskId, setBusyTaskId] = useState("");
  const [activeTaskId, setActiveTaskId] = useState("");
  const [pendingTaskIds, setPendingTaskIds] = useState(initial.pendingTaskIds);

  useEffect(() => {
    setTrainingPreferences(resolveTrainingPreferences({ authenticated: Boolean(userId), settings, localPreferences: readLocalTrainingPreferences() }));
  }, [settings, userId]);
  useEffect(() => {
    const update = (event) => setTrainingPreferences(event.detail || readLocalTrainingPreferences());
    window.addEventListener(TRAINING_PREFERENCES_UPDATED_EVENT, update);
    return () => window.removeEventListener(TRAINING_PREFERENCES_UPDATED_EVENT, update);
  }, []);

  const personalise = useCallback((value) => personaliseWeeklyTrainingPlan(value, trainingPreferences), [trainingPreferences]);
  const foundation = useCallback(() => buildFoundationalWeeklyPlan({ userId: userId || "local", report: report || {}, preferences: trainingPreferences }), [report, trainingPreferences, userId]);

  const loadPlan = useCallback(async () => {
    const cached = readCache(userId);
    if (!userId || !hasWeeklyPlan) {
      const localPlan = cached.plan ? personalise(cached.plan) : foundation();
      setPlan(localPlan);
      setPendingTaskIds([]);
      writeCache("", localPlan);
      setLoading(false);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const offlinePlan = cached.plan ? personalise(cached.plan) : foundation();
      setPlan(offlinePlan);
      setPendingTaskIds(cached.pendingTaskIds);
      setNotice("You are offline. This saved plan remains available and completed tasks will sync when you reconnect.");
      setLoading(false);
      return;
    }
    setLoading(!cached.plan);
    try {
      const result = await getOrCreateWeeklyTrainingPlan(userId, { preferences: trainingPreferences });
      let nextPlan = personalise(result.plan || cached.plan) || foundation();
      const pending = cached.pendingTaskIds.filter((taskId) => nextPlan.tasks?.some((task) => task.id === taskId));
      for (const taskId of pending) {
        nextPlan = personalise(await setWeeklyTrainingTaskCompletion(userId, nextPlan.id, taskId, true));
      }
      setPlan(nextPlan);
      setPendingTaskIds([]);
      writeCache(userId, nextPlan);
      setError("");
      setNotice(result.plan ? "" : "A lightweight foundation plan is ready while OpeningFit collects enough evidence for a personal weakness plan.");
    } catch (loadError) {
      const fallback = cached.plan ? personalise(cached.plan) : foundation();
      setPlan(fallback);
      setPendingTaskIds(cached.pendingTaskIds);
      setError(loadError?.message || "This week's saved plan could not be loaded.");
      setNotice("You can keep training with the on-device plan. Cloud progress will be retried when the connection is available.");
    } finally {
      setLoading(false);
    }
  }, [foundation, hasWeeklyPlan, personalise, trainingPreferences, userId]);

  useEffect(() => { void loadPlan(); }, [loadPlan]);
  useEffect(() => {
    const reconnect = () => { if (pendingTaskIds.length || error) void loadPlan(); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [error, loadPlan, pendingTaskIds.length]);

  const view = useMemo(() => buildThisWeekTrainingView(plan), [plan]);

  const startTask = (task) => {
    if (!task) return;
    setActiveTaskId(task.id);
    void trackProductEvent("weekly_plan_started", { authenticated: Boolean(userId), source: plan?.foundation ? "foundation_plan" : "weekly_plan" }, { onceKey: plan?.id });
    void trackProductEvent("training_task_started", { authenticated: Boolean(userId), source: "this_week", openingCategory: openingForWeeklyTask(task, plan).side }, { onceKey: `${plan?.id}:${task.id}` });
    onPractice?.(practiceTarget(task, plan));
    window.setTimeout(() => document.getElementById("opening-practice")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 40);
  };

  const completeTask = async (task) => {
    if (!plan || busyTaskId) return;
    setBusyTaskId(task.id);
    const optimistic = completeWeeklyTask(plan, task.id, true);
    const requiresCloudSave = Boolean(userId && !plan.foundation && plan.reportId);
    setPlan(optimistic);
    writeCache(userId, optimistic, pendingTaskIds);
    try {
      const saved = personalise(requiresCloudSave ? await setWeeklyTrainingTaskCompletion(userId, plan.id, task.id, true) : optimistic);
      setPlan(saved);
      setPendingTaskIds((current) => current.filter((id) => id !== task.id));
      writeCache(userId, saved, pendingTaskIds.filter((id) => id !== task.id));
      setError("");
      void trackProductEvent("training_task_completed", { authenticated: Boolean(userId), source: "this_week", openingCategory: openingForWeeklyTask(task, plan).side, resultCategory: "completed" });
      if (saved.status === "completed" || saved.completionPercent === 100) {
        void trackProductEvent("weekly_plan_completed", { authenticated: Boolean(userId), source: plan.foundation ? "foundation_plan" : "weekly_plan", resultCategory: "completed" }, { onceKey: plan.id });
      }
    } catch (saveError) {
      const queued = [...new Set([...pendingTaskIds, task.id])];
      setPendingTaskIds(queued);
      writeCache(userId, optimistic, queued);
      setError(saveError?.message || "That completion could not be synced.");
      setNotice("Completion is saved on this device and will sync when you reconnect.");
    } finally {
      setBusyTaskId("");
    }
  };

  if (loading && !plan) {
    return <section className="thisWeekTraining thisWeekTraining--loading" role="status" aria-live="polite"><div><span>This Week</span><h1>Loading your focused plan…</h1></div><div className="thisWeekLoadingBars" aria-hidden="true"><i /><i /><i /></div></section>;
  }

  if (!plan) {
    return <section className="thisWeekTraining thisWeekTraining--error" role="alert"><AlertTriangle size={22} /><div><span>This Week</span><h1>Your plan needs another try.</h1><p>{error || "OpeningFit could not prepare a weekly plan."}</p><button type="button" className="primaryBtn" onClick={loadPlan}>Try again</button></div></section>;
  }

  if (!hasWeeklyPlan) {
    const previewTask = plan.tasks?.[0];
    return <section className="thisWeekTraining" id="this-week-training"><div className="thisWeekHeroCopy"><span className="thisWeekEyebrow">This Week · Preview</span><h1>{plan.primaryGoal}</h1><p>{plan.reason}</p></div><FeatureAccessPreview feature={OPENINGFIT_FEATURES.WEEKLY_PLAN} title="Unlock the full weekly plan" onUpgrade={onUpgrade}>{previewTask ? <article><strong>{previewTask.title}</strong><small>{previewTask.explanation} · About {previewTask.estimatedMinutes || 5} minutes</small></article> : null}</FeatureAccessPreview></section>;
  }

  return (
    <section className={`thisWeekTraining thisWeekTraining--${view.state}`} id="this-week-training" aria-labelledby="this-week-training-title">
      {error ? <aside className="thisWeekNotice thisWeekNotice--error" role="status"><CloudOff size={18} /><div><strong>Cloud sync needs attention</strong><p>{error} {notice}</p></div><button type="button" onClick={loadPlan}>Retry</button></aside> : notice ? <aside className="thisWeekNotice" role="status"><CloudOff size={18} /><p>{notice}</p></aside> : null}

      <header className="thisWeekHero">
        <div className="thisWeekHeroCopy">
          <span className="thisWeekEyebrow">This Week {plan.foundation ? "· Foundation" : ""}</span>
          <h1 id="this-week-training-title">{plan.primaryGoal}</h1>
          <p>{plan.reason}</p>
        </div>
        <div className="thisWeekProgressCard" aria-label={`${view.completionPercent}% complete`}>
          <span>Weekly progress</span><strong>{view.completionPercent}%</strong>
          <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={view.completionPercent}><i style={{ width: `${view.completionPercent}%` }} /></div>
          <small>{view.completedTasks.length} of {view.tasks.length} tasks completed</small>
        </div>
      </header>

      <dl className="thisWeekSummary">
        <div><dt><Clock3 size={17} /> Estimated time</dt><dd>{plan.estimatedMinutes} minutes</dd></div>
        <div><dt><Target size={17} /> Target metric</dt><dd>{view.targetMetricLabel}</dd></div>
        <div><dt><RotateCcw size={17} /> Plan window</dt><dd>{plan.weekStart} – {plan.weekEnd}</dd></div>
      </dl>
      <button type="button" className="thisWeekPreferenceEdit" onClick={() => window.dispatchEvent(new Event(TRAINING_PREFERENCES_EDIT_EVENT))}>Edit weekly preferences</button>

      {view.state === "completed" ? (
        <section className="thisWeekCompletion" aria-labelledby="this-week-complete-title">
          <CheckCircle2 size={34} />
          <div><span>Week complete</span><h2 id="this-week-complete-title">Focused work finished.</h2><p>{view.completionMessage}</p></div>
          <div className="thisWeekCompletionGuidance"><p><strong>What to look for</strong>{view.futureCue}</p><p><strong>Next reassessment</strong>{view.reassessment}</p></div>
          <div className="thisWeekCompletionActions"><button type="button" className="primaryBtn" onClick={onAnalyse}>Play more, then refresh report</button><button type="button" className="secondaryBtn" onClick={onReport}>Back to report</button></div>
          <div className="thisWeekCompletionTasks"><h3>Completed tasks</h3>{view.completedTasks.map((task) => <CompletedTask key={task.id} task={task} plan={plan} />)}</div>
        </section>
      ) : (
        <>
          <div className="thisWeekContinueBar">
            <div><span>Current next action</span><strong>{view.nextTask?.title}</strong></div>
            <button type="button" className="primaryBtn" onClick={() => startTask(view.nextTask)}><Play size={17} /> {activeTaskId === view.nextTask?.id ? "Continue training" : "Continue training"}<ChevronRight size={17} /></button>
          </div>
          <section className="thisWeekTasks" aria-labelledby="this-week-tasks-title">
            <header><div><span>Ordered plan</span><h2 id="this-week-tasks-title">Your tasks</h2></div><small>One focus, completed in order where possible.</small></header>
            <div className="thisWeekPendingTasks">
              {view.pendingTasks.map((task) => <PendingTaskCard key={task.id} task={task} plan={plan} current={task.id === view.nextTask?.id} active={task.id === activeTaskId} busy={task.id === busyTaskId} onStart={startTask} onComplete={completeTask} />)}
            </div>
            {view.completedTasks.length ? <div className="thisWeekCompletedTasks"><h3>Completed tasks</h3>{view.completedTasks.map((task) => <CompletedTask key={task.id} task={task} plan={plan} />)}</div> : null}
          </section>
        </>
      )}
    </section>
  );
}
