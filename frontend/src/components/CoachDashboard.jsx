import { useMemo, useState } from "react";
import RecommendationExplanationPanel from "./RecommendationExplanationPanel";
import MistakeBasedPractice from "./MistakeBasedPractice";
import { OpeningMilestones, OpeningScoreBreakdown } from "./OpeningScoreProgress";
import {
  buildDailyProgress,
  buildRatingGoalModel,
  buildRecentActivity,
  buildStreak,
  buildTodayHeader,
  buildTodayTasks,
  buildWhatChanged,
  localDateKey,
} from "../services/todayRetention";
import { buildXpProgress, xpForEvent } from "../services/xpProgress";
import NextBestAction from "./NextBestAction";
import SessionSummary from "./SessionSummary";
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

function getReportGames(data = {}) {
  return [
    ...asArray(data.recent_games),
    ...asArray(data.recentGames),
    ...asArray(data.opening_games),
    ...asArray(data.openingGames),
  ];
}

function getGameCount(data = {}, openings = []) {
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

function getHealthScore(data = {}, fitData = null) {
  return numberValue(
    data.openingFitScore ??
      data.opening_fit_score ??
      data.opening_fit_score_v2 ??
      data.openingfit_score ??
      data.openingHealthScore ??
      data.opening_health_score ??
      fitData?.overallScore,
    null
  );
}

function reportTimestamp(row = {}) {
  const report = row.report || row.summary || row;
  return Date.parse(row.created_at || row.createdAt || report.importedAt || report.imported_at || report.lastUpdated || report.last_updated || "");
}

function reportScore(row = {}) {
  const report = row.report || row.summary || row;
  return numberValue(
    row.opening_fit_score ??
      row.openingFitScore ??
      row.snapshot?.healthScore ??
      report.openingFitScore ??
      report.opening_fit_score ??
      report.opening_fit_score_v2 ??
      report.openingHealth?.score ??
      report.opening_health?.score,
    null
  );
}

function getScoreTrend(reportHistory = [], currentScore = null) {
  const scored = asArray(reportHistory)
    .map((row) => ({ score: reportScore(row), time: reportTimestamp(row) }))
    .filter((row) => row.score !== null && Number.isFinite(row.time))
    .sort((a, b) => a.time - b.time);

  if (!scored.length || currentScore === null) return null;
  const previous = scored[scored.length - 1]?.score;
  if (previous === null || previous === undefined || previous === currentScore) return null;
  return currentScore - previous;
}

function getCoachInsights(data = {}) {
  return data.openingCoachInsights || data.opening_coach_insights || {};
}

function getFocusMission(data = {}) {
  const insights = getCoachInsights(data);
  return insights.focusMission || insights.focus_mission || {};
}

function getTrainingPlan(data = {}) {
  return asArray(data.training_plan).length ? asArray(data.training_plan) : asArray(data.trainingPlan);
}

function getRecommendationBuckets(data = {}) {
  const recs = data.opening_recommendations || data.openingRecommendations || data.recommendedOpenings || {};
  const sections = asArray(recs.sections).flatMap((section) => asArray(section.items));
  return [
    ...sections,
    ...asArray(recs.white_repertoire),
    ...asArray(recs.whiteDetailed),
    ...asArray(recs.black_vs_e4),
    ...asArray(recs.blackVsE4Detailed),
    ...asArray(recs.black_vs_d4),
    ...asArray(recs.blackVsD4Detailed),
  ];
}

function buildRepertoireFocus(openings = [], data = {}) {
  const known = openings.filter((opening) => opening.games > 0);
  const e4Defences = known.filter((opening) => /e4|black/i.test(opening.contextLabel));
  const white = known.filter((opening) => /white/i.test(opening.contextLabel));
  const d4 = known.filter((opening) => /d4/i.test(opening.contextLabel));

  if (known.length >= 8) {
    return {
      status: "Scattered",
      text: `You have ${known.length} recurring opening signals. Choose one White system and one main Black defence before adding more.`,
    };
  }

  if (e4Defences.length >= 4) {
    return {
      status: "Too many Black systems",
      text: `You are using ${e4Defences.length} different Black responses. Pick one primary defence against 1.e4 for the next month.`,
    };
  }

  if (!white.length || (!e4Defences.length && !d4.length)) {
    return {
      status: "Incomplete",
      text: "Your repertoire map has a gap. Build one reliable White choice and one main Black response before expanding.",
    };
  }

  const recommendations = getRecommendationBuckets(data);
  if (recommendations.length >= 3) {
    return {
      status: "Focused",
      text: "Your recommendations already point to a usable core. Train the priority opening before learning another system.",
    };
  }

  return {
    status: "Balanced",
    text: "Your repertoire is compact enough to improve. Keep the current core stable while you repair the biggest leak.",
  };
}

function buildDashboardModel({ data = {}, fitData = null, reportHistory = [], openingFitUserState = [] }) {
  const openings = collectOpenings(data, fitData);
  const gameCount = getGameCount(data, openings);
  const score = getHealthScore(data, fitData);
  const trend = getScoreTrend(reportHistory, score);
  const mission = getFocusMission(data);
  const plan = getTrainingPlan(data);
  const games = getReportGames(data);
  const strongest =
    openings
      .filter((opening) => opening.games >= 2 && opening.score !== null)
      .sort((a, b) => (b.score || 0) - (a.score || 0) || b.games - a.games)[0] ||
    openings.sort((a, b) => b.games - a.games)[0] ||
    fitData?.bestOpening ||
    null;
  const leak =
    openings
      .filter((opening) => opening.games >= 2 && opening.score !== null && openingName(opening) !== openingName(strongest))
      .sort((a, b) => (a.score || 100) - (b.score || 100) || b.games - a.games)[0] ||
    fitData?.weakestOpening ||
    null;
  const repertoire = buildRepertoireFocus(openings, data);
  const taskOpening = mission.opening || mission.name || openingName(leak || strongest, "");
  const taskText =
    mission.title ||
    mission.task ||
    (leak
      ? `Review one recent game in ${openingName(leak)} and practise the first 8 moves.`
      : strongest
        ? `Practise ${openingName(strongest)} for 10 minutes.`
        : plan[0] || "Analyse recent games to unlock today's opening task.");
  const taskWhy =
    mission.reason ||
    mission.why ||
    (leak
      ? `${openingName(leak)} is the clearest repeat issue in the current sample.`
      : strongest
        ? `${openingName(strongest)} is your best current opening signal, so make it more reliable.`
        : "OpeningFit needs a recent report before it can choose a precise training target.");
  const practiceSessions = asArray(openingFitUserState).filter((row) =>
    /practice|training|mission|drill/i.test(String(row.type || row.activity_type || row.event_type || ""))
  ).length;

  let verdict = "Your opening coach is ready for a fresh analysis.";
  let reason = "Import recent games and OpeningFit will choose the first priority from your own positions.";
  if (gameCount > 0 && leak && strongest) {
    verdict = `${openingName(strongest)} is a real strength. Your next gain is fixing ${openingName(leak)}.`;
    reason = `${openingName(strongest)} has the strongest current signal, while ${openingName(leak)} is holding the repertoire back.`;
  } else if (gameCount > 0 && repertoire.status === "Scattered") {
    verdict = "You are playing too many openings at once. A narrower repertoire will help you improve faster.";
    reason = repertoire.text;
  } else if (gameCount > 0 && strongest) {
    verdict = `${openingName(strongest)} is your clearest current strength. Build today's work around it.`;
    reason = `${openingName(strongest)} has the best available score/sample in this report.`;
  } else if (gameCount > 0) {
    verdict = "Your report is started, but the opening sample is still thin.";
    reason = "Play a few more games with one planned repertoire, then refresh the analysis.";
  }

  return {
    verdict,
    reason,
    score,
    trend,
    gameCount,
    strongest,
    leak,
    repertoire,
    task: {
      text: taskText,
      opening: taskOpening,
      minutes: leak ? 10 : 5,
      why: taskWhy,
      cta: leak || strongest ? "Start today's plan" : "Analyse games",
    },
    progress: {
      hasHistory: asArray(reportHistory).length >= 2 || trend !== null || practiceSessions > 0,
      trend,
      gameCount,
      practiceSessions,
      latestGames: games.length,
      mostImproved: null,
    },
  };
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
      <div className="coachScorePanel" aria-label="OpeningFit score">
        <span>Current streak</span>
        <strong className="todayStreakNumber">{header.streak.current}</strong>
        <small>Longest {header.streak.longest} day{header.streak.longest === 1 ? "" : "s"}</small>
        <div className="coachTrendLine">
          <span>OpeningFit Score</span>
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
      <div className="coachScorePanel" aria-label="OpeningFit score">
        <span>OpeningFit Score</span>
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

function RatingGoalCard({ goal, onSaveGoal, onProgress }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(goal.target || "");
  const [current, setCurrent] = useState(goal.current || "");

  const save = () => {
    onSaveGoal?.({
      targetRating: Number(target) || null,
      currentRating: Number(current) || null,
      startRating: goal.start || Number(current) || null,
    });
    setOpen(false);
  };

  return (
    <section className="coachDashboardCard ratingGoalCard">
      <div className="coachCardHeader">
        <span>Road to Rating Goal</span>
        <strong>{goal.hasGoal ? `${goal.progress}%` : "Not set"}</strong>
      </div>
      {goal.hasGoal ? (
        <>
          <p>
            Current {goal.current ?? "-"}{goal.ratingSourceLabel ? ` from ${goal.ratingSourceLabel}` : ""} to target {goal.target}. Keep the work opening-focused; no Elo gain is promised from one task.
          </p>
          <div className="todayProgressTrack" aria-hidden="true">
            <span style={{ width: `${goal.progress}%` }} />
          </div>
        </>
      ) : (
        <p>
          {goal.hasImportedRating
            ? `Detected ${goal.current} from ${goal.ratingSourceLabel || "your latest import"}. Set a target and OpeningFit will shape your training around it.`
            : "Set your next rating goal. OpeningFit will shape your training around it."}
        </p>
      )}
      <div className="coachCardActions">
        <button type="button" className="secondaryBtn" onClick={() => setOpen(true)}>
          {goal.hasGoal ? "Edit goal" : "Set goal"}
        </button>
        <button type="button" className="secondaryBtn" onClick={onProgress}>View improvement plan</button>
      </div>
      {open ? (
        <div className="ratingGoalEditor" role="dialog" aria-label="Set rating goal">
          <label>
            Current rating
            <input value={current} inputMode="numeric" onChange={(event) => setCurrent(event.target.value)} />
          </label>
          <label>
            Target rating
            <input value={target} inputMode="numeric" onChange={(event) => setTarget(event.target.value)} />
          </label>
          <div className="coachCardActions">
            <button type="button" className="primaryBtn" onClick={save}>Save goal</button>
            <button type="button" className="secondaryBtn" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
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
  user,
  reportHistory = [],
  openingFitUserState = [],
  activityHistory = [],
  profile = null,
  settings = null,
  onRecordActivity,
  onSaveSettings,
  onAnalyse,
  onPractice,
  onReport,
  onTraining,
  onRecommendations,
  onProgress,
  onJourney,
  onScoreAction,
}) {
  const openings = collectOpenings(data || {}, fitData);
  const gameCount = getGameCount(data || {}, openings);
  const partial = Boolean(data) && !openings.length;
  const insufficient = Boolean(data) && gameCount > 0 && gameCount < 5;
  const model = buildDashboardModel({ data, fitData, reportHistory, openingFitUserState });
  const [optimisticActivity, setOptimisticActivity] = useState([]);
  const [sessionSummary, setSessionSummary] = useState(null);
  const activity = useMemo(
    () => [...optimisticActivity, ...asArray(activityHistory), ...asArray(openingFitUserState)],
    [activityHistory, openingFitUserState, optimisticActivity]
  );
  const todayTasks = useMemo(
    () => buildTodayTasks({ data, fitData, reportHistory, activity }),
    [data, fitData, reportHistory, activity]
  );
  const dailyProgress = buildDailyProgress(todayTasks);
  const todayHeader = buildTodayHeader({ profile, data, reportHistory, activity });
  const streak = buildStreak(activity);
  const ratingGoal = buildRatingGoalModel({ profile, settings, activity, data });
  const changes = buildWhatChanged({ data, reportHistory });
  const recentActivity = buildRecentActivity(activity);
  const xp = buildXpProgress(activity);

  if (!data || partial || insufficient) {
    return (
      <EmptyCoachDashboard
        signedIn={Boolean(user)}
        partial={partial}
        insufficient={insufficient}
        onAnalyse={onAnalyse}
        onReport={onReport}
      />
    );
  }

  const startTask = (target = null) => {
    if (target) {
      onPractice?.(target);
      return;
    }
    if (model.task.opening) {
      onPractice?.(model.task.opening);
      return;
    }
    onAnalyse?.();
  };
  const handleTaskAction = (task) => {
    if (task?.route === "practice") {
      onPractice?.(task.opening || model.task.opening);
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
    const nextCompleted = todayTasks.filter((item) => item.completed || item.id === task.id).length;
    const willCompletePlan = nextCompleted >= todayTasks.length;
    const bonusEvent = willCompletePlan
      ? {
          id: `optimistic:today-plan:${localDateKey()}`,
          type: "today_plan_completed",
          created_at: new Date().toISOString(),
          points: xpForEvent("today_plan_completed"),
          payload: {
            training_date: localDateKey(),
            tasks_completed: todayTasks.length,
            points: xpForEvent("today_plan_completed"),
            dedupe_key: `today_plan_completed:${localDateKey()}`,
          },
        }
      : null;
    setOptimisticActivity((items) => [event, ...items.filter((item) => item.payload?.task_id !== task.id)]);
    try {
      await onRecordActivity?.("today_task_completed", {
        ...event.payload,
        points: xpForEvent("today_task_completed"),
      });
      if (bonusEvent) {
        setOptimisticActivity((items) => [bonusEvent, ...items.filter((item) => item.payload?.dedupe_key !== bonusEvent.payload.dedupe_key)]);
        await onRecordActivity?.("today_plan_completed", bonusEvent.payload);
        setSessionSummary({
          title: "Today's progress",
          lines: [`${todayTasks.length} tasks completed`, "Daily streak maintained", `${xpForEvent("today_plan_completed")} bonus XP earned`],
        });
      }
    } catch (error) {
      console.warn("OpeningFit could not save daily task completion.", error);
    }
  };
  const saveRatingGoal = async (goal) => {
    const payload = {
      ratingGoal: {
        ...goal,
        updatedAt: new Date().toISOString(),
      },
    };
    try {
      await onSaveSettings?.({ preferences: payload });
      await onRecordActivity?.("rating_goal_updated", {
        ...payload.ratingGoal,
        dedupe_key: `rating_goal_updated:${localDateKey()}`,
      });
    } catch (error) {
      console.warn("OpeningFit could not save rating goal.", error);
    }
  };

  return (
    <section className="coachDashboard" id="coach-dashboard" aria-label="OpeningFit Today">
      <TodayHeader
        header={{ ...todayHeader, streak }}
        xp={xp}
        onPrimary={() => handleTaskAction(todayTasks.find((task) => !task.completed) || todayTasks[0])}
        onAnalyse={onAnalyse}
      />
      <div className="coachDashboardLayout">
        <div className="coachDashboardMain">
          <TodayTrainingPlan
            tasks={todayTasks}
            progress={dailyProgress}
            data={data}
            onTaskAction={handleTaskAction}
            onCompleteTask={completeTask}
          />
          <DailyProgressCard progress={dailyProgress} />
          <WhatChangedCard changes={changes} />
          <WeeklyProgressCard progress={model.progress} onProgress={onProgress} />
          <NextBestAction
            title={dailyProgress.complete ? "Come back tomorrow for a fresh plan" : "Complete today's next useful action"}
            detail={dailyProgress.complete ? "Your daily plan is done. Review the report if you want more context." : "The next action updates as tasks are completed."}
            primary={{
              label: dailyProgress.complete ? "Open full report" : (todayTasks.find((task) => !task.completed)?.cta || "Continue"),
              onClick: dailyProgress.complete ? onReport : () => handleTaskAction(todayTasks.find((task) => !task.completed) || todayTasks[0]),
            }}
            secondary={[
              { label: "Practise", onClick: () => startTask() },
              { label: "Refresh analysis", onClick: onAnalyse },
            ]}
          />
        </div>
        <div className="coachDashboardSide">
          <RatingGoalCard goal={ratingGoal} onSaveGoal={saveRatingGoal} onProgress={onProgress} />
          <RecentActivityCard items={recentActivity} />
          <CoachVerdictCard model={model} onPrimary={startTask} />
          <OpeningStrengthCard opening={model.strongest} onPractice={onPractice} />
          <OpeningLeakCard opening={model.leak} onLearnMore={onReport} />
          <RepertoireFocusCard focus={model.repertoire} onOpen={onRecommendations} />
          <OpeningScoreBreakdown
            data={data}
            fitData={fitData}
            reportHistory={reportHistory}
            openingFitUserState={openingFitUserState}
            onAction={onScoreAction}
          />
          <OpeningMilestones
            data={data}
            fitData={fitData}
            reportHistory={reportHistory}
            openingFitUserState={openingFitUserState}
          />
        </div>
      </div>
      <div className="coachDashboardFooterActions" aria-label="Dashboard secondary actions">
        <button type="button" className="secondaryBtn" onClick={onReport}>Open full report</button>
        <button type="button" className="secondaryBtn" onClick={onTraining}>Training plan</button>
        {onJourney ? <button type="button" className="secondaryBtn" onClick={onJourney}>Journey</button> : null}
        <button type="button" className="secondaryBtn" onClick={onAnalyse}>Refresh analysis</button>
      </div>
      <SessionSummary
        summary={sessionSummary}
        onDismiss={() => setSessionSummary(null)}
        onToday={() => setSessionSummary(null)}
      />
    </section>
  );
}
