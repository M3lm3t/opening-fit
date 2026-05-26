import { useMemo } from "react";
import {
  collectOpenings,
  collectRatings,
  getOpeningGames,
  getOpeningScore,
  safeNumber,
} from "./playerLevelLogic";
import "./WeeklyOpeningReport.css";

const MAX_HISTORY = 16;

function getUsername(data) {
  return (
    data?.username ||
    data?.playerName ||
    data?.player_name ||
    data?.requestedUsername ||
    "Player"
  );
}

function getPlatform(data) {
  return data?.platform || data?.importPlatform || data?.source || "chess";
}

function getGamesImported(data, openings) {
  return (
    safeNumber(data?.gamesImported, null) ??
    safeNumber(data?.games_imported, null) ??
    safeNumber(data?.totalGames, null) ??
    safeNumber(data?.total_games, null) ??
    openings.reduce((sum, item) => sum + getOpeningGames(item), 0)
  );
}

function openingName(item) {
  return item?.name || item?.opening || item?.openingName || "Opening";
}

function normaliseOpenings(data) {
  const byName = new Map();

  collectOpenings(data, { includeUnknown: false }).forEach((item) => {
    const name = openingName(item);
    const key = String(name).toLowerCase();
    const games = getOpeningGames(item);
    const score = getOpeningScore(item);

    if (!name || !games || score === null) return;

    const current = byName.get(key);
    if (!current || games > current.games) {
      byName.set(key, {
        name,
        games,
        winRate: score,
        mastery: calculateMastery(score, games),
        confidence: calculateConfidence(score, games),
      });
    }
  });

  return Array.from(byName.values())
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.winRate - a.winRate;
    })
    .slice(0, 24);
}

function calculateMastery(winRate, games) {
  const sample = Math.min(24, games) / 24;
  const result = Math.max(0, Math.min(100, winRate));
  return Math.round(result * 0.68 + sample * 32);
}

function calculateConfidence(winRate, games) {
  const sample = Math.min(30, games) / 30;
  const stability = 1 - Math.min(35, Math.abs(50 - winRate)) / 70;
  return Math.round(Math.max(18, Math.min(100, sample * 62 + stability * 38)));
}

function masteryLevel(value) {
  if (value >= 85) return "Identity weapon";
  if (value >= 70) return "Reliable";
  if (value >= 55) return "Developing";
  if (value >= 40) return "Unstable";
  return "Needs repair";
}

function storageKey(data) {
  return `openingFit:weeklyOpeningReport:${getPlatform(data)}:${getUsername(data)}`;
}

function reportFingerprint(snapshot) {
  return [
    snapshot.username,
    snapshot.platform,
    snapshot.gamesImported,
    snapshot.rating || "no-rating",
    ...snapshot.openings
      .slice(0, 10)
      .map((item) => `${item.name}:${item.games}:${item.winRate}`),
  ].join("|");
}

function makeSnapshot(data) {
  const openings = normaliseOpenings(data);
  const rating = collectRatings(data);
  const gamesImported = getGamesImported(data, openings);

  const snapshot = {
    createdAt: new Date().toISOString(),
    username: getUsername(data),
    platform: getPlatform(data),
    rating,
    gamesImported,
    openings,
  };

  return {
    ...snapshot,
    id: reportFingerprint(snapshot),
  };
}

function loadHistory(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(key, history) {
  try {
    localStorage.setItem(key, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // Local storage should not interrupt the report.
  }
}

function compareSnapshots(current, previous) {
  if (!current || !previous) {
    return {
      changes: [],
      newOpenings: [],
      ratingDelta: null,
      gamesDelta: null,
    };
  }

  const previousMap = new Map(
    previous.openings.map((item) => [String(item.name).toLowerCase(), item])
  );

  const changes = current.openings
    .map((item) => {
      const old = previousMap.get(String(item.name).toLowerCase());

      if (!old) {
        return {
          ...item,
          type: "new",
          winRateDelta: null,
          masteryDelta: null,
          gamesDelta: item.games,
        };
      }

      return {
        ...item,
        type: item.winRate >= old.winRate ? "improved" : "declined",
        previousWinRate: old.winRate,
        previousMastery: old.mastery,
        winRateDelta: item.winRate - old.winRate,
        masteryDelta: item.mastery - old.mastery,
        gamesDelta: item.games - old.games,
      };
    })
    .sort((a, b) => {
      const aDelta = a.masteryDelta ?? (a.type === "new" ? 4 : 0);
      const bDelta = b.masteryDelta ?? (b.type === "new" ? 4 : 0);
      return bDelta - aDelta;
    });

  return {
    changes,
    newOpenings: changes.filter((item) => item.type === "new"),
    ratingDelta:
      current.rating !== null && previous.rating !== null
        ? current.rating - previous.rating
        : null,
    gamesDelta: current.gamesImported - previous.gamesImported,
  };
}

function formatPercent(value) {
  return `${Math.round(safeNumber(value, 0))}%`;
}

function signed(value, suffix = "") {
  const number = Math.round(safeNumber(value, 0));
  if (number > 0) return `+${number}${suffix}`;
  if (number < 0) return `${number}${suffix}`;
  return `0${suffix}`;
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function weekRangeLabel() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function buildWeeklyReport(data, current, previous) {
  const comparison = compareSnapshots(current, previous);
  const openings = current.openings;
  const mostImproved =
    comparison.changes.find((item) => (item.masteryDelta ?? 0) > 0) ||
    [...openings].sort((a, b) => b.mastery - a.mastery)[0] ||
    null;
  const biggestWeakness =
    comparison.changes
      .filter((item) => item.winRate < 48 || (item.masteryDelta ?? 0) < 0)
      .sort((a, b) => {
        const dropA = a.masteryDelta ?? 0;
        const dropB = b.masteryDelta ?? 0;
        if (dropA !== dropB) return dropA - dropB;
        return a.mastery - b.mastery;
      })[0] ||
    [...openings].sort((a, b) => a.mastery - b.mastery)[0] ||
    null;
  const trendOpening =
    comparison.newOpenings[0] ||
    [...comparison.changes].sort((a, b) => b.gamesDelta - a.gamesDelta)[0] ||
    openings[0] ||
    null;
  const coach = data?.ai_chess_coach || data?.aiChessCoach || {};
  const studyFocus =
    coach.headline ||
    coach.recommendations?.[0]?.title ||
    (biggestWeakness ? `Repair ${biggestWeakness.name}` : "Save this report as your weekly baseline");
  const repertoireConfidence = average(openings.slice(0, 8).map((item) => item.confidence));
  const studyConsistency = previous
    ? Math.max(0, Math.min(100, 45 + Math.min(35, comparison.gamesDelta * 2) + Math.min(20, comparison.changes.length * 4)))
    : Math.max(28, Math.min(68, openings.length * 8));
  const streak = previous ? Math.max(2, Math.min(12, Math.round((comparison.gamesDelta || 1) / 5) + 1)) : 1;
  const ratingTrend =
    comparison.ratingDelta === null
      ? "Rating trend will appear after another saved import"
      : comparison.ratingDelta > 0
        ? `Rating up ${signed(comparison.ratingDelta)} since your last report`
        : comparison.ratingDelta < 0
          ? `Rating down ${signed(comparison.ratingDelta)} since your last report`
          : "Rating stable since your last report";

  return {
    comparison,
    mostImproved,
    biggestWeakness,
    trendOpening,
    studyFocus,
    repertoireConfidence,
    studyConsistency,
    streak,
    ratingTrend,
  };
}

function Meter({ value, label }) {
  return (
    <div className="weeklyOpeningMeter">
      <div>
        <span>{label}</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div className="weeklyOpeningMeterTrack">
        <i style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export default function WeeklyOpeningReport({ data }) {
  const key = useMemo(() => storageKey(data || {}), [data]);
  const currentSnapshot = useMemo(() => makeSnapshot(data || {}), [data]);
  const history = useMemo(() => {
    const saved = loadHistory(key);

    if (!currentSnapshot.openings.length) return saved;

    const alreadySaved = saved.some((item) => item.id === currentSnapshot.id);
    if (alreadySaved) return saved;

    const nextHistory = [currentSnapshot, ...saved].slice(0, MAX_HISTORY);
    saveHistory(key, nextHistory);
    return nextHistory;
  }, [key, currentSnapshot]);

  if (!data || !currentSnapshot.openings.length) return null;

  const previousSnapshot =
    history.find((item) => item.id !== currentSnapshot.id) || null;
  const weekly = buildWeeklyReport(data, currentSnapshot, previousSnapshot);
  const topMastery = [...currentSnapshot.openings]
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 4);
  const confidenceOpenings = currentSnapshot.openings.slice(0, 4);
  const evolution = weekly.comparison.changes.slice(0, 4);

  return (
    <section className="weeklyOpeningReport" id="weekly-opening-report">
      <div className="weeklyOpeningHeader">
        <div>
          <p className="weeklyOpeningKicker">Weekly Opening Report</p>
          <h2>Your chess identity is evolving over time.</h2>
          <p>
            {previousSnapshot
              ? `${weekRangeLabel()} compared with your previous saved report.`
              : "This report starts your baseline. Re-import next week to see what changed."}
          </p>
        </div>

        <div className="weeklyOpeningScore">
          <span>Repertoire confidence</span>
          <strong>{weekly.repertoireConfidence}%</strong>
          <small>{previousSnapshot ? "Updated from saved history" : "Baseline score"}</small>
        </div>
      </div>

      <div className="weeklyOpeningGrid">
        <article className="weeklyOpeningCard weeklyOpeningCard--positive">
          <span>Most improved opening</span>
          <h3>{weekly.mostImproved?.name || "No movement yet"}</h3>
          <p>
            {weekly.mostImproved
              ? `${weekly.mostImproved.name} mastery ${weekly.mostImproved.masteryDelta !== null && weekly.mostImproved.masteryDelta !== undefined ? signed(weekly.mostImproved.masteryDelta, "%") : "is"} now at ${weekly.mostImproved.mastery}%.`
              : "Save this report, play more games, then return for a weekly comparison."}
          </p>
        </article>

        <article className="weeklyOpeningCard weeklyOpeningCard--warning">
          <span>Biggest weakness this week</span>
          <h3>{weekly.biggestWeakness?.name || "Not enough data"}</h3>
          <p>
            {weekly.biggestWeakness
              ? `${weekly.biggestWeakness.name} is at ${weekly.biggestWeakness.mastery}% mastery with a ${weekly.biggestWeakness.winRate}% score.`
              : "No repeated weakness has emerged yet."}
          </p>
        </article>

        <article className="weeklyOpeningCard">
          <span>New opponent trends</span>
          <h3>{weekly.trendOpening?.name || "Trend baseline"}</h3>
          <p>
            {weekly.trendOpening
              ? `${weekly.trendOpening.name} is showing up as a key pattern. Track whether opponents keep steering you there.`
              : "New opponent trends will appear once another import is saved."}
          </p>
        </article>

        <article className="weeklyOpeningCard weeklyOpeningCard--focus">
          <span>Recommended study focus</span>
          <h3>{weekly.studyFocus}</h3>
          <p>Keep this week narrow: one opening repair, one repeatable plan, then another import.</p>
        </article>
      </div>

      <div className="weeklyOpeningLoopGrid">
        <article className="weeklyOpeningPanel">
          <div className="weeklyOpeningPanelTop">
            <span>Streaks</span>
            <strong>{weekly.streak} week identity streak</strong>
          </div>
          <p>{weekly.ratingTrend}</p>
          <Meter value={weekly.studyConsistency} label="Study consistency" />
        </article>

        <article className="weeklyOpeningPanel">
          <div className="weeklyOpeningPanelTop">
            <span>Opening mastery progression</span>
            <strong>{topMastery[0] ? `${topMastery[0].name} ${topMastery[0].mastery}%` : "Baseline"}</strong>
          </div>
          <div className="weeklyMasteryList">
            {topMastery.map((item) => (
              <div key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{masteryLevel(item.mastery)}</span>
                </div>
                <em>{item.mastery}%</em>
              </div>
            ))}
          </div>
        </article>

        <article className="weeklyOpeningPanel">
          <div className="weeklyOpeningPanelTop">
            <span>Opening confidence meters</span>
            <strong>{weekly.repertoireConfidence}% repertoire confidence</strong>
          </div>
          {confidenceOpenings.map((item) => (
            <Meter key={item.name} value={item.confidence} label={item.name} />
          ))}
        </article>
      </div>

      <div className="weeklyOpeningEvolution">
        <div className="weeklyOpeningPanelTop">
          <span>Repertoire evolution tracking</span>
          <strong>
            {previousSnapshot
              ? `${weekly.comparison.changes.length} opening updates detected`
              : "Baseline saved for the next weekly report"}
          </strong>
        </div>

        {evolution.length ? (
          <div className="weeklyEvolutionList">
            {evolution.map((item) => (
              <article key={item.name}>
                <span>{item.type === "new" ? "New pattern" : item.type === "improved" ? "Improved" : "Needs attention"}</span>
                <strong>{item.name}</strong>
                <p>
                  {item.type === "new"
                    ? `${item.games} games added to your identity map.`
                    : `${formatPercent(item.previousWinRate)} to ${formatPercent(item.winRate)} score, mastery ${signed(item.masteryDelta, "%")}.`}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="weeklyOpeningMuted">
            Your next import will unlock changes like “Your London mastery increased to 78%”
            and “Your Sicilian responses improved this week.”
          </p>
        )}
      </div>
    </section>
  );
}
