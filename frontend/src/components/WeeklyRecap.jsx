import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, History, Sparkles, TrendingUp, Wrench, X } from "lucide-react";
import { useAuth } from "../context/AuthDataProvider.jsx";
import { adaptReportHistoryRow, buildReportSnapshot } from "../lib/reportSnapshot.js";
import { selectPreviousReportSnapshot } from "../lib/reportComparisonPresentation.js";
import { trackProductEvent } from "../lib/productAnalytics.js";
import { buildWeeklyRecap, mergeWeeklyRecapRecord, readLocalWeeklyRecaps, shouldAutoShowWeeklyRecap, weeklyRecapRecords, writeLocalWeeklyRecaps } from "../lib/weeklyRecap.js";
import { getCurrentWeeklyTrainingPlan } from "../services/weeklyTrainingPlanService.js";
import "./WeeklyRecap.css";

function formatWeek(value) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function RecapDetails({ recap }) {
  if (recap.type === "training_reminder") return (
    <div className="weeklyRecapReminder"><Clock3 size={20} /><div><strong>{recap.trainingCompletion}% of this week’s plan complete</strong>{recap.nextFocus ? <p>Next focus: {recap.nextFocus}</p> : null}</div></div>
  );
  return (
    <dl className="weeklyRecapGrid">
      <div><dt>New games analysed</dt><dd>{recap.newGames}</dd></div>
      {recap.score ? <div><dt>OpeningFit Score</dt><dd>{recap.score.label}</dd></div> : null}
      {recap.improvedArea ? <div><dt><TrendingUp size={16} /> Improved area</dt><dd><strong>{recap.improvedArea.label}</strong><span>{recap.improvedArea.detail}</span></dd></div> : null}
      {recap.repairArea ? <div><dt><Wrench size={16} /> Ongoing repair</dt><dd><strong>{recap.repairArea.label}</strong><span>{recap.repairArea.detail}</span></dd></div> : null}
      {recap.trainingCompletion !== null ? <div><dt><CheckCircle2 size={16} /> Training completion</dt><dd>{recap.trainingCompletion}%</dd></div> : null}
      {recap.nextFocus ? <div><dt>Next weekly focus</dt><dd>{recap.nextFocus}</dd></div> : null}
    </dl>
  );
}

export default function WeeklyRecap({ data, fitData, reportHistory = [], active = false, onTraining, onReport }) {
  const { user, settings, saveSettings, profileLoading, hydrated } = useAuth();
  const [plan, setPlan] = useState(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [localRecords, setLocalRecords] = useState(() => readLocalWeeklyRecaps());
  const attemptedWeek = useRef("");

  useEffect(() => {
    let cancelled = false;
    if (!active || !user?.id) { setPlan(null); return undefined; }
    getCurrentWeeklyTrainingPlan(user.id).then((value) => { if (!cancelled) setPlan(value); }).catch(() => { if (!cancelled) setPlan(null); });
    return () => { cancelled = true; };
  }, [active, user?.id]);

  const currentSnapshot = useMemo(() => data ? buildReportSnapshot({ report: data, summary: fitData || {} }) : null, [data, fitData]);
  const snapshots = useMemo(() => reportHistory.map((item) => adaptReportHistoryRow(item)), [reportHistory]);
  const previousSnapshot = useMemo(() => selectPreviousReportSnapshot(currentSnapshot, snapshots), [currentSnapshot, snapshots]);
  const recap = useMemo(() => buildWeeklyRecap({ currentSnapshot, previousSnapshot, plan }), [currentSnapshot, plan, previousSnapshot]);
  const records = useMemo(() => weeklyRecapRecords({ settings, localRecords }), [localRecords, settings]);
  const history = useMemo(() => Object.entries(records).filter(([, record]) => record?.recap).sort(([left], [right]) => right.localeCompare(left)), [records]);

  const persist = useCallback(async (weekStart, patch) => {
    const next = mergeWeeklyRecapRecord(records, weekStart, patch);
    setLocalRecords(next);
    writeLocalWeeklyRecaps(next);
    if (user?.id && saveSettings) await saveSettings({ preferences: { weeklyRecaps: next } });
  }, [records, saveSettings, user?.id]);

  useEffect(() => {
    if (!active || !hydrated || (user?.id && profileLoading) || !recap) return;
    if (attemptedWeek.current === recap.weekStart || !shouldAutoShowWeeklyRecap(recap, records[recap.weekStart])) return;
    attemptedWeek.current = recap.weekStart;
    setVisible(true);
    const shownAt = new Date().toISOString();
    void persist(recap.weekStart, { recap, shownAt }).catch(() => {});
    void trackProductEvent("weekly_recap_shown", { authenticated: Boolean(user?.id), source: recap.type, games: recap.newGames }, { onceKey: recap.id });
  }, [active, hydrated, persist, profileLoading, recap, records, user?.id]);

  const openRecap = (fromHistory = false) => {
    setVisible(true);
    setExpanded(true);
    setHistoryOpen(fromHistory);
    if (recap) void persist(recap.weekStart, { recap, openedAt: new Date().toISOString() }).catch(() => {});
    void trackProductEvent("weekly_recap_opened", { authenticated: Boolean(user?.id), source: fromHistory ? "history" : "dashboard" });
  };

  const dismiss = () => {
    setVisible(false);
    setExpanded(false);
    setHistoryOpen(false);
    if (recap) void persist(recap.weekStart, { recap, dismissedAt: new Date().toISOString() }).catch(() => {});
    void trackProductEvent("weekly_recap_dismissed", { authenticated: Boolean(user?.id), source: recap?.type || "history" });
  };

  const action = () => {
    const destination = (recap?.nextFocus || recap?.type === "training_reminder") ? "training" : "report";
    void trackProductEvent("weekly_recap_action_clicked", { authenticated: Boolean(user?.id), source: recap?.type || "history", resultCategory: destination });
    if (destination === "training") onTraining?.(); else onReport?.();
  };

  if (!active || (!recap && !history.length)) return null;
  if (!visible) return <button type="button" className="weeklyRecapLauncher" onClick={() => openRecap(true)}><History size={17} /> Weekly recap history</button>;

  return (
    <section className="weeklyRecap" aria-labelledby="weekly-recap-title">
      <header><div><span><Sparkles size={16} /> Week of {formatWeek(recap?.weekStart || history[0]?.[0])}</span><h2 id="weekly-recap-title">{recap?.title || "Weekly recap history"}</h2></div><button type="button" aria-label="Dismiss weekly recap" onClick={dismiss}><X size={19} /></button></header>
      {recap ? <>
        <button type="button" className="weeklyRecapOpen" onClick={() => openRecap(false)} aria-expanded={expanded}>{expanded ? "Recap details" : recap.type === "training_reminder" ? "Open training reminder" : `${recap.newGames} new games are ready to review`}</button>
        {expanded ? <RecapDetails recap={recap} /> : null}
        <div className="weeklyRecapActions"><button type="button" className="primaryBtn" onClick={action}>{(recap.nextFocus || recap.type === "training_reminder") ? "Continue training" : "View report"}<ArrowRight size={17} /></button>{history.length ? <button type="button" className="secondaryButton" onClick={() => { setHistoryOpen((value) => !value); void trackProductEvent("weekly_recap_opened", { authenticated: Boolean(user?.id), source: "history" }); }}><History size={16} /> Recap history</button> : null}</div>
      </> : null}
      {historyOpen ? <div className="weeklyRecapHistory"><h3>Recent recaps</h3>{history.map(([week, record]) => <details key={week}><summary>Week of {formatWeek(week)}</summary><RecapDetails recap={record.recap} /></details>)}</div> : null}
    </section>
  );
}
