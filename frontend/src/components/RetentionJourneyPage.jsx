import { useMemo, useState } from "react";
import {
  buildCoachSummary,
  buildJourneyEvents,
  buildNewSinceLastVisit,
  buildProgressCharts,
  buildWeeklyRecap,
  cohortComparisonState,
  evaluateAchievements,
  newlyUnlockedAchievements,
} from "../services/retentionJourney";
import { buildXpProgress } from "../services/xpProgress";
import "./RetentionJourneyPage.css";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recent";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function monthKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recent";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function MiniLineChart({ points, label }) {
  if (!points.length) {
    return <div className="journeyChartEmpty">Not enough saved history for this chart yet.</div>;
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 100;
  const height = 46;
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="journeyLineChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function BarChart({ bars }) {
  if (!bars.length) return <div className="journeyChartEmpty">Complete a task, review a game, or save a report to start this chart.</div>;
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  return (
    <div className="journeyActivityChart" role="img" aria-label={`Weekly training activity, ${total} meaningful actions shown`}>
      <div className="journeyActivitySummary">
        <span>{total}</span>
        <small>meaningful action{total === 1 ? "" : "s"} across {bars.length} week{bars.length === 1 ? "" : "s"}</small>
      </div>
      <div className="journeyBarChart">
        {bars.map((bar) => (
          <span key={bar.label} title={`${bar.label}: ${bar.value} meaningful action${bar.value === 1 ? "" : "s"}`}>
            <i style={{ height: `${Math.max(10, (bar.value / max) * 100)}%` }} />
            <b>{bar.value}</b>
            <em>{bar.label.slice(5)}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RetentionJourneyPage({
  data,
  reportHistory = [],
  activityHistory = [],
  settings = null,
  onRecordActivity,
  onSaveSettings,
  onNavigate,
}) {
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [notice, setNotice] = useState("");
  const activity = asArray(activityHistory);
  const achievements = useMemo(() => evaluateAchievements({ data, reportHistory, activity }), [data, reportHistory, activity]);
  const newAchievements = useMemo(() => newlyUnlockedAchievements({ data, reportHistory, activity }), [data, reportHistory, activity]);
  const recap = useMemo(() => buildWeeklyRecap({ data, reportHistory, activity }), [data, reportHistory, activity]);
  const coach = useMemo(() => buildCoachSummary({ data, reportHistory, activity }), [data, reportHistory, activity]);
  const timeline = useMemo(() => buildJourneyEvents({ data, reportHistory, activity, achievements }), [data, reportHistory, activity, achievements]);
  const charts = useMemo(() => buildProgressCharts({ reportHistory, activity }), [reportHistory, activity]);
  const xp = useMemo(() => buildXpProgress(activity), [activity]);
  const newItems = useMemo(() => buildNewSinceLastVisit({ reportHistory, activity, settings }), [reportHistory, activity, settings]);
  const comparison = cohortComparisonState();
  const filteredTimeline = timeline.filter((item) => filter === "all" || item.type === filter).slice(0, visibleCount);
  const grouped = filteredTimeline.reduce((map, item) => {
    const key = monthKey(item.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());

  const saveAchievements = async () => {
    if (!newAchievements.length) {
      setNotice("No new achievements to backfill right now.");
      return;
    }
    for (const achievement of newAchievements) {
      await onRecordActivity?.("achievement_unlocked", {
        achievement_key: achievement.key,
        title: achievement.title,
        unlocked_at: achievement.unlockedAt,
        points: 0,
        dedupe_key: `achievement_unlocked:${achievement.key}`,
      });
    }
    setNotice(`${newAchievements.length} achievement${newAchievements.length === 1 ? "" : "s"} saved.`);
  };

  const markRecapSeen = async () => {
    await onRecordActivity?.("weekly_recap_seen", {
      week_start: recap.weekStart,
      observation: recap.observation,
      dedupe_key: `weekly_recap_seen:${recap.weekStart}`,
    });
    setNotice("Weekly recap marked as seen.");
  };

  const dismissItem = async (key) => {
    const preferences = settings?.preferences || {};
    const dismissedJourneyEvents = [...new Set([...(preferences.dismissedJourneyEvents || []), key])].slice(-50);
    await onSaveSettings?.({ preferences: { ...preferences, dismissedJourneyEvents } });
  };

  const savePreference = async (key, value) => {
    const preferences = settings?.preferences || {};
    await onSaveSettings?.({
      preferences: {
        ...preferences,
        retentionNotifications: {
          ...(preferences.retentionNotifications || {}),
          [key]: value,
        },
      },
    });
  };

  return (
    <section className="retentionJourneyPage" id="journey-page" aria-labelledby="journey-title">
      <header className="journeyHero">
        <div>
          <p className="eyebrow">OpeningFit Journey</p>
          <h1 id="journey-title">Your long-term opening progress record</h1>
          <p>Milestones here come from saved reports and meaningful activity. They are not claims about chess rating strength.</p>
        </div>
        <div className="journeyLevelCard">
          <span>Level {xp.level}</span>
          <strong>{xp.currentLevelXp}/{xp.nextLevelXp} XP</strong>
          <small>OpeningFit activity level</small>
        </div>
      </header>

      {newItems.length ? (
        <section className="journeyCard newSinceVisit">
          <div className="journeySectionHeader">
            <div>
              <p className="eyebrow">New since your last visit</p>
              <h2>Useful updates</h2>
            </div>
          </div>
          <div className="journeyMiniGrid">
            {newItems.map((item) => (
              <article key={item.key}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <button type="button" onClick={() => dismissItem(item.key)}>Dismiss</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="journeyCard coachSummaryCard">
        <div className="journeySectionHeader">
          <div>
            <p className="eyebrow">Coach summary</p>
            <h2>What changed and what to do next</h2>
          </div>
          <span>{coach.confidence}</span>
        </div>
        <div className="journeyMiniGrid">
          <article><span>Going well</span><strong>{coach.goingWell}</strong></article>
          <article><span>Needs attention</span><strong>{coach.needsAttention}</strong></article>
          <article><span>Next step</span><strong>{coach.nextStep}</strong></article>
        </div>
      </section>

      <section className="journeyCard weeklyRecapCard">
        <div className="journeySectionHeader">
          <div>
            <p className="eyebrow">Weekly recap</p>
            <h2>Week starting {recap.weekStart}</h2>
          </div>
          <button type="button" className="secondaryBtn" onClick={markRecapSeen}>Mark seen</button>
        </div>
        {recap.hasData ? (
          <>
            <p>{recap.observation}</p>
            <div className="journeyMetricRow">
              {recap.metrics.map((metric) => (
                <span key={metric.label}><strong>{metric.value}</strong>{metric.label}</span>
              ))}
            </div>
            <p><strong>First task next week:</strong> {recap.firstTask}</p>
          </>
        ) : (
          <p>No meaningful activity this week yet. Complete one task or review one game to make the recap useful.</p>
        )}
      </section>

      <section className="journeyCard achievementsCard">
        <div className="journeySectionHeader">
          <div>
            <p className="eyebrow">Achievements</p>
            <h2>{achievements.filter((item) => item.unlocked).length} of {achievements.length} unlocked</h2>
          </div>
          <button type="button" className="secondaryBtn" onClick={saveAchievements}>Backfill real unlocks</button>
        </div>
        <div className="achievementGrid">
          {achievements.map((achievement) => (
            <article key={achievement.key} className={achievement.unlocked ? "isUnlocked" : ""}>
              <span>{achievement.unlocked ? "Unlocked" : "Locked"}</span>
              <strong>{achievement.title}</strong>
              <p>{achievement.requirement}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="journeyCard journeyChartsCard">
        <div className="journeySectionHeader">
          <div>
            <p className="eyebrow">Progress charts</p>
            <h2>Signals over time</h2>
          </div>
        </div>
        <div className="journeyChartGrid">
          <article>
            <strong>OpeningFit score history</strong>
            <MiniLineChart points={charts.scorePoints} label="OpeningFit score over time" />
            <p>{charts.scorePoints.length ? `${charts.scorePoints.length} saved score point${charts.scorePoints.length === 1 ? "" : "s"}.` : "Save more reports to see a trend."}</p>
          </article>
          <article>
            <strong>Weekly training activity</strong>
            <BarChart bars={charts.activityBars} />
            <p>Shows completed tasks, practice, reviewed games, saved reports, goals, achievements and recap check-ins.</p>
          </article>
        </div>
      </section>

      <section className="journeyCard comparisonCard">
        <div className="journeySectionHeader">
          <div>
            <p className="eyebrow">Anonymous comparisons</p>
            <h2>Privacy-safe cohorts</h2>
          </div>
        </div>
        <p>{comparison.reason}</p>
      </section>

      <section className="journeyCard timelineCard">
        <div className="journeySectionHeader">
          <div>
            <p className="eyebrow">Timeline</p>
            <h2>Meaningful events</h2>
          </div>
          <div className="journeyFilters">
            {["all", "progress", "openings", "milestones"].map((item) => (
              <button key={item} type="button" className={filter === item ? "isActive" : ""} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
        {filteredTimeline.length ? (
          <div className="journeyTimeline">
            {[...grouped.entries()].map(([month, events]) => (
              <section key={month}>
                <h3>{month}</h3>
                {events.map((event) => (
                  <article key={event.key}>
                    <time>{formatDate(event.date)}</time>
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.detail}</p>
                    </div>
                  </article>
                ))}
              </section>
            ))}
            {visibleCount < timeline.length ? <button type="button" className="secondaryBtn" onClick={() => setVisibleCount((count) => count + 12)}>Load older events</button> : null}
          </div>
        ) : (
          <p>Your Journey starts after your first analysis, completed task, or saved milestone.</p>
        )}
      </section>

      <section className="journeyCard retentionSettingsCard">
        <div className="journeySectionHeader">
          <div>
            <p className="eyebrow">Preferences</p>
            <h2>Retention settings</h2>
          </div>
        </div>
        <div className="settingsToggleGrid">
          {[
            ["dailyTraining", "Daily training reminder shown inside OpeningFit"],
            ["weeklyRecap", "Weekly recap prompt"],
            ["achievementNotifications", "Achievement notifications"],
            ["progressUpdates", "Progress update notifications"],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                defaultChecked={settings?.preferences?.retentionNotifications?.[key] !== false}
                onChange={(event) => savePreference(key, event.target.checked)}
              />
              <span className="settingsSwitch" aria-hidden="true" />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <p>These are in-app preferences only. Browser push or email reminders are not enabled.</p>
      </section>

      {notice ? <p className="journeyNotice">{notice}</p> : null}

      <div className="journeyFooterActions">
        <button type="button" className="primaryBtn" onClick={() => onNavigate?.("today")}>Back to Today</button>
        <button type="button" className="secondaryBtn" onClick={() => onNavigate?.("report")}>Open report</button>
      </div>
    </section>
  );
}
