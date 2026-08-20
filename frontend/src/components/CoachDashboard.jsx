import { useEffect, useMemo, useState } from "react";
import RecommendationExplanationPanel from "./RecommendationExplanationPanel";
import MistakeBasedPractice from "./MistakeBasedPractice";
import { OpeningMilestones, OpeningScoreBreakdown } from "./OpeningScoreProgress";
import {
  buildRatingGoalModel,
  localDateKey,
} from "../services/todayRetention";
import { xpForEvent } from "../services/xpProgress";
import NextBestAction from "./NextBestAction";
import SessionSummary from "./SessionSummary";
import RatingGoalCard from "./RatingGoalCard.jsx";
import { buildReportDecisionModel } from "../lib/reportDecisionModel.js";
import { buildTodayExperienceAction, todayGoalContext } from "../lib/todayPrimaryAction.js";
import ChessPositionBoard from "./ChessPositionBoard.jsx";
import SinceLastReportSummary from "./SinceLastReportSummary.jsx";
import { useAuth } from "../context/AuthDataProvider.jsx";
import { QUALIFYING_STREAK_ACTIVITIES, recordQualifiedActivity } from "../services/trainingStreakService.js";
import { buildReportSnapshot } from "../lib/reportSnapshot.js";
import { buildPersonalTrainingItems, dueTrainingSession, evaluatePersonalTrainingOutcomes, mergeTrainingState } from "../lib/personalOpeningTraining.js";
import { buildEvidenceSufficiency } from "../lib/evidenceSufficiency.js";
import { countNewGamesSinceCheckpoint, getCoachingGameCheckpoint, getCurrentCoachingPriority, getWeeklyCoachingGoal, recordMeaningfulCoachingActivity } from "../services/coachingStateService.js";
import { trackProductEvent } from "../lib/productAnalytics.js";
import GameCheckPanel from "./GameCheckPanel.jsx";
import TrainingStreakCard from "./TrainingStreakCard.jsx";
import "./CoachDashboard.css";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = 0) {
  const number = Number(String(value ?? "").replace("%", ""));
  if (!Number.isFinite(number)) return fallback;
  if (number >= 0 && number <= 1) return Math.round(number * 100);
  return Math.round(number);
}

function openingName(opening, fallback = "No clear opening yet") {
  if (typeof opening === "string") return opening;
  return (
    opening?.name ||
    opening?.opening ||
    opening?.openingName ||
    opening?.opening_name ||
    opening?.ecoName ||
    opening?.eco_name ||
    fallback
  );
}

function openingGames(opening) {
  if (!opening || typeof opening === "string") return 0;
  return numberValue(opening.games ?? opening.count ?? opening.total ?? opening.sampleSize, 0);
}

function openingScore(opening) {
  if (!opening || typeof opening === "string") return null;
  const direct =
    opening.fitScore ??
    opening.fit_score ??
    opening.openingFitScore ??
    opening.score ??
    opening.winRate ??
    opening.win_rate;
  if (direct !== undefined && direct !== null && direct !== "") return numberValue(direct, null);

  const games = openingGames(opening);
  const wins = Number(opening.wins ?? opening.w ?? 0) || 0;
  const draws = Number(opening.draws ?? opening.d ?? 0) || 0;
  if (!games) return null;
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function openingContext(opening) {
  const raw = String(
    opening?.context ||
      opening?.side ||
      opening?.colour ||
      opening?.color ||
      opening?.repertoireSide ||
      opening?.repertoire_side ||
      opening?.responseTo ||
      opening?.response_to ||
      ""
  ).toLowerCase();

  if (raw.includes("white")) return "White";
  if (raw.includes("e4")) return "Black vs 1.e4";
  if (raw.includes("d4")) return "Black vs 1.d4";
  if (raw.includes("black")) return "Black";
  return "Repertoire";
}

function isKnownOpening(opening) {
  const name = openingName(opening, "");
  const clean = String(name).trim().toLowerCase();
  return clean && !clean.includes("unknown") && !clean.includes("unclassified") && !clean.includes("uncommon");
}

function collectOpenings(data = {}, fitData = null) {
  data = data || {};
  const sources = [
    ...(asArray(data.best_openings).map((item) => ({ ...item, sourcePriority: 2 }))),
    ...(asArray(data.bestOpenings).map((item) => ({ ...item, sourcePriority: 2 }))),
    ...(asArray(data.top_openings).map((item) => ({ ...item, sourcePriority: 2 }))),
    ...(asArray(data.topOpenings).map((item) => ({ ...item, sourcePriority: 2 }))),
    ...(asArray(data.preferred_white).map((item) => ({ ...item, context: item?.context || "white", sourcePriority: 2 }))),
    ...(asArray(data.preferredWhite).map((item) => ({ ...item, context: item?.context || "white", sourcePriority: 2 }))),
    ...(asArray(data.preferred_black).map((item) => ({ ...item, context: item?.context || "black", sourcePriority: 2 }))),
    ...(asArray(data.preferredBlack).map((item) => ({ ...item, context: item?.context || "black", sourcePriority: 2 }))),
    ...(asArray(fitData?.scoredOpenings).map((item) => ({ ...item, sourcePriority: 1 }))),
    fitData?.bestOpening ? { ...fitData.bestOpening, sourcePriority: 1 } : null,
    fitData?.weakestOpening ? { ...fitData.weakestOpening, sourcePriority: 1 } : null,
  ].filter(Boolean);

  const merged = new Map();
  sources.forEach((opening) => {
    if (!opening || typeof opening !== "object" || !isKnownOpening(opening)) return;
    const name = openingName(opening);
    const context = openingContext(opening);
    const key = `${name.toLowerCase()}::${context.toLowerCase()}`;
    const score = openingScore(opening);
    const games = openingGames(opening);
    const row = { ...opening, name, contextLabel: context, score, games };
    const current = merged.get(key);
    if (
      !current ||
      row.sourcePriority > current.sourcePriority ||
      (row.sourcePriority === current.sourcePriority &&
        (games > current.games || (games === current.games && (score || 0) > (current.score || 0))))
    ) {
      merged.set(key, row);
    }
  });

  return [...merged.values()];
}

function getGameCount(data = {}, openings = []) {
  data = data || {};
  return (
    numberValue(
      data.gamesImported ??
        data.games_imported ??
        data.gamesAnalysed ??
        data.gamesAnalyzed ??
        data.games_analyzed ??
        data.totalGames ??
        data.total_games,
      0
    ) || openings.reduce((sum, opening) => sum + openingGames(opening), 0)
  );
}

function trendLabel(trend) {
  if (trend === null || trend === undefined) return "No trend yet";
  if (trend > 0) return `+${trend}`;
  return String(trend);
}

function TodayHeader({ header, xp, onPrimary, onAnalyse }) {
  return (
    <section className="coachVerdictCard todayHeaderCard" aria-label="Today overview">
      <div className="coachVerdictContent">
        <span className="coachEyebrow">Today</span>
        <h1>{header.greeting}</h1>
        <p>{header.summary}</p>
        <div className={`analysisFreshnessBadge ${header.analysisFreshness?.tone || "missing"}`}>
          <div>
            <span>Last analysed</span>
            <strong>{header.analysisFreshness?.label || "No saved analysis date"}</strong>
            <small>{header.analysisFreshness?.detail || "Refresh when you want OpeningFit to compare new games."}</small>
          </div>
          <button type="button" className="secondaryBtn" onClick={onAnalyse}>
            Refresh analysis
          </button>
        </div>
        <button type="button" className="primaryBtn coachPrimaryCta" onClick={onPrimary}>
          {header.primaryCta}
        </button>
      </div>
      <div className="coachScorePanel" aria-label="Repertoire Health">
        <span>Current streak</span>
        <strong className="todayStreakNumber">{header.streak.current}</strong>
        <small>Longest {header.streak.longest} day{header.streak.longest === 1 ? "" : "s"}</small>
        <div className="coachTrendLine">
          <span>Repertoire Health</span>
          <b className={header.scoreDelta > 0 ? "isPositive" : header.scoreDelta < 0 ? "isNegative" : ""}>
            {header.score ?? "-"}{header.scoreDelta !== null && header.scoreDelta !== undefined ? ` (${header.scoreDelta >= 0 ? "+" : ""}${header.scoreDelta})` : ""}
          </b>
        </div>
        <div className="coachTrendLine">
          <span>Level {xp.level}</span>
          <b>{xp.currentLevelXp}/{xp.nextLevelXp} XP</b>
        </div>
        <small>Levels reflect OpeningFit activity, not chess rating.</small>
      </div>
    </section>
  );
}

function CoachVerdictCard({ model, onPrimary }) {
  return (
    <section className="coachVerdictCard" aria-label="OpeningFit coach verdict">
      <div className="coachVerdictContent">
        <span className="coachEyebrow">Coach verdict</span>
        <h1>{model.verdict}</h1>
        <p>{model.reason}</p>
        <button type="button" className="primaryBtn coachPrimaryCta" onClick={onPrimary}>
          {model.task.cta}
        </button>
      </div>
      <div className="coachScorePanel" aria-label="Repertoire Health">
        <span>Repertoire Health</span>
        <strong>{model.score ?? "-"}</strong>
        <small>{model.score !== null && model.score !== undefined ? "/100" : "After analysis"}</small>
        <div className="coachTrendLine">
          <span>Trend</span>
          <b className={model.trend > 0 ? "isPositive" : model.trend < 0 ? "isNegative" : ""}>
            {trendLabel(model.trend)}
          </b>
        </div>
      </div>
    </section>
  );
}

function TodayTrainingPlan({ tasks, progress, data, onTaskAction, onCompleteTask }) {
  return (
    <article className="coachDashboardCard todayOpeningTask">
      <div className="coachCardHeader">
        <span>Today&apos;s Training Plan</span>
        <strong>{progress.label}</strong>
      </div>
      <div className="todayTaskList">
        {tasks.map((task, index) => (
          <article className={task.completed ? "todayTaskRow isComplete" : "todayTaskRow"} key={task.id}>
            <div className="todayTaskIndex" aria-hidden="true">{index + 1}</div>
            <div>
              <h3>{task.title}</h3>
              <p>{task.explanation}</p>
              <small>{task.duration}</small>
            </div>
            <div className="todayTaskActions">
              {task.completed ? (
                <span className="todayTaskDone">Completed</span>
              ) : (
                <>
                  <button type="button" className={index === 0 ? "primaryBtn" : "secondaryBtn"} onClick={() => onTaskAction(task)}>
                    {task.cta}
                  </button>
                  <button type="button" className="ghostBtn" onClick={() => onCompleteTask(task)}>
                    Mark done
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      <MistakeBasedPractice data={data} compact onStart={() => onTaskAction(tasks.find((task) => task.route === "practice") || tasks[0])} showEmpty={false} />
    </article>
  );
}

function RecurringOpeningHabits({ habits, onTrain }) {
  const rows = asArray(habits).filter((habit) => habit?.positionIdentity && habit?.playedMove);
  if (!rows.length) return null;
  const typeCopy = {
    RECURRING_MISTAKE: "It repeatedly leaves you worse.",
    RECURRING_INACCURACY: "This repeatedly gives away some of the position.",
    GOOD_HABIT: "This is a reliable decision worth keeping.",
    MIXED: "Your decision varies when this position returns.",
  };
  return (
    <section className="coachDashboardCard" aria-labelledby="recurring-opening-habits-title">
      <div className="coachCardHeader"><span>Recurring habit</span><strong>{rows.length}</strong></div>
      <h2 id="recurring-opening-habits-title">Repeated opening decisions</h2>
      {rows.slice(0, 3).map((habit) => (
        <article key={habit.habitId} className="todayTaskRow">
          <div>
            <strong>{habit.opening}</strong>
            <p>You played {habit.playedMove} in {habit.occurrenceCount} of {habit.eligibleOccurrenceCount} games reaching this position.</p>
            <p>{typeCopy[habit.habitType] || "This repeated decision has trustworthy evidence."}</p>
            {habit.recommendedMove && habit.recommendedMove !== habit.playedMove ? <p>Try {habit.recommendedMove} instead.</p> : null}
          </div>
          <button type="button" className="secondaryBtn" onClick={() => onTrain?.({ ...habit, opportunityId: habit.habitId, openingId: habit.canonicalOpeningId, positionKey: habit.positionIdentity, issueType: habit.habitType.toLowerCase(), reviewType: habit.recommendedMove ? "move_review" : "concept_review", recurrenceCount: habit.occurrenceCount })}>Train this position</button>
        </article>
      ))}
    </section>
  );
}

function TodayPrimaryAction({ action, goal, weeklyGoal, newGames, onAction, onComplete, trainingSession, onTraining }) {
  const goalContext = todayGoalContext(goal);
  if (action.completed) {
    return <section className="todayPrimaryAction isComplete" aria-labelledby="today-primary-title"><p className="coachEyebrow">Today</p><h1 id="today-primary-title">Session complete</h1><p>Your completion is saved. OpeningFit will not replace it until a genuinely relevant task is available.</p><button type="button" className="primaryBtn" onClick={() => onAction({ route: "analyse" })}>Check for new games</button></section>;
  }
  if (action.kind === "calm") {
    return <section className="todayPrimaryAction isCalm" aria-labelledby="today-primary-title"><p className="coachEyebrow">Today</p><h1 id="today-primary-title">{action.title}</h1><p>{action.explanation}</p>{action.cta ? <button type="button" className="primaryBtn" onClick={() => onAction(action)}>{action.cta}</button> : null}</section>;
  }
  return (
    <section className={`todayPrimaryAction todayPrimaryAction--${action.kind}`} aria-labelledby="today-primary-title">
      <header><p className="coachEyebrow">Today</p><h1 id="today-primary-title">{action.title}</h1>{action.opening ? <strong>{action.opening}</strong> : null}{action.role ? <small>{action.role}</small> : null}</header>
      <p>{action.explanation}</p>
      {action.chessEvidence?.positionFen ? <div className="todayPrimaryPosition"><ChessPositionBoard position={action.chessEvidence.positionFen} orientation={action.chessEvidence.orientation} interactive={false} /><div><strong>Position to train</strong>{action.chessEvidence.moveLine ? <code>{action.chessEvidence.moveLine}</code> : null}</div></div> : action.chessEvidence?.moveLine ? <code className="todayPrimaryMoveLine">{action.chessEvidence.moveLine}</code> : null}
      {action.why ? <details className="todayPrimaryWhy"><summary>Why this matters</summary><p>{action.why}</p></details> : null}
      <dl className="todayPrimaryContract">{action.durationMinutes || trainingSession?.estimatedMinutes ? <div><dt>Time</dt><dd>About {action.durationMinutes || trainingSession.estimatedMinutes} minutes</dd></div> : null}<div><dt>How improvement is checked</dt><dd>{action.improvementCheck}</dd></div></dl>
      {trainingSession?.dueCount ? <p className="todayTrainingDue"><strong>{trainingSession.dueCount} position{trainingSession.dueCount === 1 ? "" : "s"} due</strong> · about {trainingSession.estimatedMinutes} minute{trainingSession.estimatedMinutes === 1 ? "" : "s"} · {trainingSession.items.length} in this session</p> : null}
      <div className="todayStatusLine" aria-label="Coaching status"><span>{weeklyGoal ? `${weeklyGoal.completed} of ${weeklyGoal.target} meaningful sessions` : "Weekly progress will sync when available"}</span><span>{newGames === null ? "Game Check status unavailable" : `${newGames} new game${newGames === 1 ? "" : "s"} waiting`}</span>{goalContext ? <span>Rating goal: {goalContext}</span> : null}</div>
      <div className="todayPrimaryActions"><button type="button" className="primaryBtn" onClick={() => trainingSession?.dueCount ? onTraining?.() : onAction(action)}>{trainingSession?.dueCount ? "Start training" : action.cta}</button><button type="button" className="todayCompleteAction" onClick={() => onComplete(action)}>Mark complete</button></div>
    </section>
  );
}

function DailyProgressCard({ progress }) {
  return (
    <section className="coachDashboardCard dailyProgressCard" aria-label="Daily progress">
      <div className="coachCardHeader">
        <span>Daily Progress</span>
        <strong>{progress.label}</strong>
      </div>
      <div className="todayProgressTrack" aria-hidden="true">
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <p>
        {progress.complete
          ? "Nice work. Your plan is complete for today. Come back tomorrow for a fresh opening priority."
          : "Complete one meaningful training action today to protect your streak."}
      </p>
    </section>
  );
}

function WhatChangedCard({ changes }) {
  return (
    <section className="coachDashboardCard whatChangedCard">
      <div className="coachCardHeader">
        <span>Since your last analysis</span>
        <strong>{changes.hasComparison ? "Compared" : "Baseline"}</strong>
      </div>
      {changes.hasComparison ? (
        <div className="whatChangedList">
          {changes.rows.map((row) => (
            <article key={row.label} className={`whatChangedRow ${row.tone}`}>
              <span aria-hidden="true">{row.tone === "positive" ? "+" : row.tone === "negative" ? "!" : "="}</span>
              <div>
                <strong>{row.label}: {row.value}</strong>
                <p>{row.detail}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p>{changes.empty}</p>
      )}
    </section>
  );
}

function RecentActivityCard({ items }) {
  return (
    <section className="coachDashboardCard recentActivityCard">
      <div className="coachCardHeader">
        <span>Recent Activity</span>
        <strong>{items.length ? `${items.length} shown` : "Quiet"}</strong>
      </div>
      {items.length ? (
        <div className="recentActivityList">
          {items.map((item) => (
            <article key={item.id}>
              <strong>{item.label}</strong>
              <p>{item.detail || "OpeningFit activity saved."}</p>
            </article>
          ))}
        </div>
      ) : (
        <p>Complete a task, practise an opening, or run a new analysis and it will appear here.</p>
      )}
    </section>
  );
}

function OpeningStrengthCard({ opening, onPractice }) {
  const name = openingName(opening, "Not enough data yet");
  const score = openingScore(opening);
  const games = openingGames(opening);
  return (
    <article className="coachDashboardCard coachMiniCard">
      <span>Strongest Opening</span>
      <h3>{name}</h3>
      <p>
        {opening
          ? `${score ?? "Useful"}${score !== null ? "/100" : ""} from ${games || "a small sample"} game${games === 1 ? "" : "s"}. It is working because your results are strongest here.`
          : "Your strongest opening appears after OpeningFit sees a repeat sample."}
      </p>
      {opening ? <button type="button" onClick={() => onPractice?.(opening)}>Practise</button> : null}
    </article>
  );
}

function OpeningLeakCard({ opening, onLearnMore }) {
  const name = openingName(opening, "No repeat leak yet");
  const score = openingScore(opening);
  const games = openingGames(opening);
  return (
    <article className="coachDashboardCard coachMiniCard">
      <span>Biggest Leak</span>
      <h3>{name}</h3>
      <p>
        {opening
          ? `${games || "A few"} game${games === 1 ? "" : "s"} point to this as the priority repair. Current signal: ${score ?? "low confidence"}.`
          : "OpeningFit will call out a leak once a pattern repeats enough to be useful."}
      </p>
      {opening ? (
        <RecommendationExplanationPanel
          compact
          recommendation={{
            ...opening,
            name,
            fitScore: score,
            games,
            verdict: "Improve",
            reason_label: "Needs repair",
          }}
          category="Improve"
          onAction={onLearnMore}
        />
      ) : null}
      <button type="button" onClick={onLearnMore}>Review this leak</button>
    </article>
  );
}

function RepertoireFocusCard({ focus, onOpen }) {
  return (
    <article className="coachDashboardCard coachMiniCard">
      <span>Repertoire Focus</span>
      <h3>{focus.status}</h3>
      <p>{focus.text}</p>
      <button type="button" onClick={onOpen}>Open My Repertoire</button>
    </article>
  );
}

function WeeklyProgressCard({ progress, onProgress }) {
  if (!progress.hasHistory) {
    return (
      <section className="coachDashboardCard weeklyProgressCard">
        <div className="coachCardHeader">
          <span>This Week&apos;s Progress</span>
          <strong>Starting point</strong>
        </div>
        <p>
          Your progress story starts after your next few games. Keep using your recommended repertoire and
          OpeningFit will track what changes.
        </p>
        <button type="button" className="secondaryBtn" onClick={onProgress}>See what changes</button>
      </section>
    );
  }

  const metrics = [
    progress.trend !== null ? { label: "Score movement", value: trendLabel(progress.trend) } : null,
    progress.gameCount ? { label: "Games analysed", value: progress.gameCount } : null,
    progress.practiceSessions ? { label: "Practice sessions", value: progress.practiceSessions } : null,
    progress.latestGames ? { label: "Recent games available", value: progress.latestGames } : null,
  ].filter(Boolean).slice(0, 4);

  return (
    <section className="coachDashboardCard weeklyProgressCard">
      <div className="coachCardHeader">
        <span>This Week&apos;s Progress</span>
        <strong>{progress.trend > 0 ? "Improving" : "Tracking"}</strong>
      </div>
      <div className="coachProgressGrid">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
      <button type="button" className="secondaryBtn" onClick={onProgress}>See progress details</button>
    </section>
  );
}

function EmptyCoachDashboard({ signedIn, partial, insufficient, onAnalyse, onReport }) {
  const title = !signedIn
    ? "Create an account to keep your coach dashboard."
    : partial
      ? "Your dashboard has a partial report."
      : insufficient
        ? "Your opening sample is still small."
        : "Your coach dashboard starts with one analysis.";
  const text = !signedIn
    ? "You can analyse games first, then save the report when you sign in."
    : partial
      ? "Open the report to inspect what was found, or refresh analysis when you have more games."
      : insufficient
        ? "Play a few games with one planned repertoire, then re-import for sharper priorities."
        : "Import recent Chess.com or Lichess games and OpeningFit will choose your first priority.";

  return (
    <section className="emptyCoachDashboard">
      <span>Coach dashboard</span>
      <h1>{title}</h1>
      <p>{text}</p>
      <div className="coachCardActions">
        <button type="button" className="primaryBtn" onClick={onAnalyse}>Analyse games</button>
        {partial ? <button type="button" className="secondaryBtn" onClick={onReport}>Open report</button> : null}
      </div>
    </section>
  );
}

export default function CoachDashboard({
  data,
  fitData,
  reportHistory = [],
  openingFitUserState = [],
  activityHistory = [],
  profile = null,
  settings = null,
  loading = false,
  importStatus = null,
  username = "",
  platform = "",
  onRecordActivity,
  onAnalyse,
  onPractice,
  onReport,
  onRecommendations,
  onTraining,
}) {
  const { user } = useAuth();
  const openings = collectOpenings(data || {}, fitData);
  const gameCount = getGameCount(data || {}, openings);
  const partial = Boolean(data) && !openings.length;
  const insufficient = Boolean(data) && gameCount > 0 && gameCount < 5;
  const [optimisticActivity, setOptimisticActivity] = useState([]);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [canonicalPriority, setCanonicalPriority] = useState(null);
  const [weeklyGoal, setWeeklyGoal] = useState(null);
  const [newGames, setNewGames] = useState(null);
  const activity = useMemo(
    () => [...optimisticActivity, ...asArray(activityHistory), ...asArray(openingFitUserState)],
    [activityHistory, openingFitUserState, optimisticActivity]
  );
  const ratingGoal = buildRatingGoalModel({ profile, settings, activity, data });
  useEffect(() => {
    let active = true;
    if (!user?.id) return () => { active = false; };
    Promise.allSettled([
      getCurrentCoachingPriority(user.id),
      getWeeklyCoachingGoal(user.id),
      getCoachingGameCheckpoint(user.id, { platform: platform || data?.platform, username: username || data?.username }),
    ]).then(([priorityResult, goalResult, checkpointResult]) => {
      if (!active) return;
      if (priorityResult.status === "fulfilled") setCanonicalPriority(priorityResult.value);
      if (goalResult.status === "fulfilled") setWeeklyGoal(goalResult.value);
      if (checkpointResult.status === "fulfilled") setNewGames(countNewGamesSinceCheckpoint(data?.games || data?.analysedGames || data?.analysed_games, checkpointResult.value));
    });
    return () => { active = false; };
  }, [data, platform, user?.id, username]);
  const evidence = useMemo(() => buildEvidenceSufficiency(data || {}), [data]);
  const connected = Boolean(username || data?.username || data?.playerName || data?.player_name);
  const todayAction = useMemo(() => {
    return buildTodayExperienceAction({ connected, loading, importMessage: importStatus?.message, evidence, canonicalPriority, decisionModel: data && !partial && !insufficient ? buildReportDecisionModel(data, fitData || {}, reportHistory) : null, activity, hasReport: Boolean(data) });
  }, [activity, canonicalPriority, connected, data, evidence, fitData, importStatus?.message, insufficient, loading, partial, reportHistory]);
  const personalTrainingSession = useMemo(() => {
    const generated = buildPersonalTrainingItems({ report: data || {}, ownerId: user?.id || "anonymous-session" });
    const stored = user?.id ? settings?.preferences?.personalOpeningTraining?.items || [] : [];
    return dueTrainingSession(mergeTrainingState(generated.items, stored, user?.id || "anonymous-session"), { limit: 5 });
  }, [data, settings?.preferences?.personalOpeningTraining?.items, user?.id]);
  const trainingOutcomes = useMemo(() => evaluatePersonalTrainingOutcomes(settings?.preferences?.personalOpeningTraining?.items || [], data?.games || data?.analysedGames || data?.analysed_games || []), [data, settings?.preferences?.personalOpeningTraining?.items]);
  const retentionData = useMemo(() => data ? { ...data, trainingOutcomes } : data, [data, trainingOutcomes]);
  const currentProgressSnapshot = useMemo(() => retentionData ? buildReportSnapshot({ report: retentionData, defaultGeneratedAt: false }) : null, [retentionData]);
  const progressSnapshots = useMemo(() => asArray(reportHistory).map((row) => {
    if (row?.normalized_snapshot) return row.normalized_snapshot;
    if (Number(row?.snapshot?.report_schema_version) >= 2) return row.snapshot;
    const report = row?.data || row?.report || row?.summary;
    return report ? buildReportSnapshot({ report, summary: row?.snapshot || row?.summary || {}, reportId: row?.id, defaultGeneratedAt: false }) : null;
  }).filter(Boolean), [reportHistory]);
  const handleTaskAction = (task) => {
    if (task?.route === "repertoire") {
      onRecommendations?.();
      return;
    }
    if (task?.route === "practice") {
      onPractice?.(task.target || task.opening);
      return;
    }
    if (task?.route === "report") {
      onReport?.();
      return;
    }
    onAnalyse?.();
  };
  const completeTask = async (task) => {
    if (!task || task.completed) return;
    const event = {
      id: `optimistic:${task.id}`,
      type: "today_task_completed",
      created_at: new Date().toISOString(),
      payload: {
        task_id: task.id,
        task_type: task.type,
        task_title: task.title,
        opening: task.opening || "",
        training_date: localDateKey(),
        dedupe_key: `today_task_completed:${localDateKey()}:${task.id}`,
      },
    };
    const bonusEvent = {
          id: `optimistic:today-plan:${localDateKey()}`,
          type: "today_plan_completed",
          created_at: new Date().toISOString(),
          points: xpForEvent("today_plan_completed"),
          payload: {
            training_date: localDateKey(),
            tasks_completed: 1,
            points: xpForEvent("today_plan_completed"),
            dedupe_key: `today_plan_completed:${localDateKey()}`,
          },
        };
    setOptimisticActivity((items) => [event, ...items.filter((item) => item.payload?.task_id !== task.id)]);
    try {
      if (user?.id) await recordMeaningfulCoachingActivity({ userId: user.id, activityType: "training_session_completed", idempotencyKey: `today:${localDateKey()}:${task.id}`, payload: { task_id: task.id, report_id: task.identities?.reportId, diagnosis_id: task.identities?.diagnosisId } });
      await onRecordActivity?.("today_task_completed", {
        ...event.payload,
        points: xpForEvent("today_task_completed"),
      });
      setOptimisticActivity((items) => [bonusEvent, ...items.filter((item) => item.payload?.dedupe_key !== bonusEvent.payload.dedupe_key)]);
      await onRecordActivity?.("today_plan_completed", bonusEvent.payload);
      if (user?.id && typeof onRecordActivity === "function") {
        await recordQualifiedActivity({
          userId: user.id,
          activityType: QUALIFYING_STREAK_ACTIVITIES.TODAY_TRAINING_COMPLETED,
          sourceId: event.payload.dedupe_key,
        }).catch((streakError) => console.warn("OpeningFit could not update the training streak.", streakError));
      }
      setSessionSummary({ title: "Today's progress", lines: ["Current task completed", "Daily streak maintained", `${xpForEvent("today_plan_completed")} bonus XP earned`] });
      void trackProductEvent("today_primary_action_completed", { authenticated: Boolean(user?.id), source: "today" });
    } catch (error) {
      console.warn("OpeningFit could not save daily task completion.", error);
    }
  };
  useEffect(() => {
    void trackProductEvent("today_viewed", { authenticated: Boolean(user?.id), source: "dashboard" }, { onceKey: `${user?.id || "anonymous"}:${localDateKey()}` });
    if (todayAction.kind === "calm" && todayAction.title === "No supported session yet") void trackProductEvent("today_no_supported_task", { authenticated: Boolean(user?.id), source: "dashboard" }, { onceKey: todayAction.title });
    if (newGames > 0) void trackProductEvent("today_new_games_available", { authenticated: Boolean(user?.id), source: "dashboard", newGames }, { onceKey: String(newGames) });
  }, [newGames, todayAction.kind, todayAction.title, user?.id]);
  const startTodayAction = (action) => { void trackProductEvent("today_primary_action_started", { authenticated: Boolean(user?.id), source: "today" }); handleTaskAction(action); };
  const roles = ["White", "Black vs 1.e4", "Black vs 1.d4"].map((label) => openings.find((opening) => opening.contextLabel === label || (label === "Black vs 1.d4" && opening.contextLabel === "Black")) || null);
  return (
    <section className="coachDashboard" id="coach-dashboard" aria-label="OpeningFit Today">
      <header className="todayGreeting"><p className="coachEyebrow">Welcome back</p><h1>{profile?.display_name ? `Hello, ${profile.display_name}` : "Your opening work for today"}</h1><p>{openings.length >= 3 ? "Your three repertoire roles are represented in the current report." : openings.length ? `${openings.length} of 3 repertoire roles currently have recognised opening evidence.` : "Your current report does not yet support a complete repertoire summary."}</p></header>
      <TodayPrimaryAction action={todayAction} goal={ratingGoal} weeklyGoal={weeklyGoal} newGames={newGames} onAction={startTodayAction} onComplete={completeTask} trainingSession={personalTrainingSession} onTraining={onTraining} />
      <TrainingStreakCard />
      <section className="todaySecondary" aria-labelledby="today-journey-title"><div className="coachCardHeader"><h2 id="today-journey-title">Your repertoire journey</h2></div><GameCheckPanel report={data} platform={platform || data?.platform} username={username || data?.username} onReport={onReport} /><div className="todayRoleJourney">{roles.map((opening, index) => <article key={index}><span>{["White", "Black vs 1.e4", "Black vs 1.d4/other"][index]}</span><strong>{opening ? openingName(opening) : "Developing evidence"}</strong></article>)}</div><SinceLastReportSummary currentSnapshot={currentProgressSnapshot} reportSnapshots={progressSnapshots} /><div className="todaySecondaryActions"><button type="button" className="secondaryBtn" onClick={onReport}>Open full report</button><button type="button" className="ghostBtn" onClick={onReport}>Report history</button></div></section>
      <SessionSummary
        summary={sessionSummary}
        onDismiss={() => setSessionSummary(null)}
        onToday={() => setSessionSummary(null)}
      />
    </section>
  );
}
