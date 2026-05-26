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
        colour: item?.colour || item?.color || item?.side || "mixed",
        verdict: item?.verdict || item?.fitVerdict || item?.status || "Track",
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

function confidenceLabel(value) {
  if (value >= 82) return "Trusted";
  if (value >= 64) return "Playable";
  if (value >= 46) return "Still forming";
  return "Thin signal";
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
    weekKey: weekKey(new Date()),
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
    improvedOpenings: changes.filter((item) => (item.masteryDelta ?? 0) > 0),
    declinedOpenings: changes.filter((item) => (item.masteryDelta ?? 0) < 0 || item.winRate < 45),
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

function weekKey(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy.toISOString().slice(0, 10);
}

function weeksBetween(a, b) {
  const start = new Date(`${a}T00:00:00`);
  const end = new Date(`${b}T00:00:00`);
  return Math.round((end - start) / (7 * 24 * 60 * 60 * 1000));
}

function calculateStreak(history, current) {
  const weeks = Array.from(
    new Set([current, ...history.map((item) => item.weekKey || weekKey(item.createdAt || new Date()))])
  ).sort((a, b) => (a < b ? 1 : -1));

  if (!weeks.length) return 1;

  let streak = 1;
  for (let i = 1; i < weeks.length; i += 1) {
    if (weeksBetween(weeks[i], weeks[i - 1]) === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function getRatingTrend(history, current, comparison) {
  const ratings = [current, ...history]
    .filter((item) => Number.isFinite(item.rating))
    .slice(0, 6)
    .map((item) => item.rating);

  if (comparison.ratingDelta === null) {
    return {
      label: "Rating trend",
      text: "Rating trend will appear after another saved import.",
      delta: null,
      direction: "stable",
    };
  }

  const oldest = ratings[ratings.length - 1];
  const longerDelta = Number.isFinite(oldest) ? current.rating - oldest : comparison.ratingDelta;

  if (comparison.ratingDelta > 0) {
    return {
      label: "Rating improving",
      text: `Rating up ${signed(comparison.ratingDelta)} since your last report${ratings.length > 2 ? `, ${signed(longerDelta)} across saved history` : ""}.`,
      delta: comparison.ratingDelta,
      direction: "up",
    };
  }

  if (comparison.ratingDelta < 0) {
    return {
      label: "Rating pressure",
      text: `Rating down ${signed(comparison.ratingDelta)} since your last report. Treat this week as a repair block.`,
      delta: comparison.ratingDelta,
      direction: "down",
    };
  }

  return {
    label: "Rating stable",
    text: "Rating stable since your last report. Look for opening-level movement rather than the headline number.",
    delta: 0,
    direction: "stable",
  };
}

function buildWeaknessUpdates(openings, comparison) {
  const declined = comparison.declinedOpenings || [];
  const weak = [...openings]
    .filter((item) => item.winRate < 50 || item.mastery < 55)
    .sort((a, b) => a.mastery - b.mastery);

  return [...declined, ...weak]
    .filter((item, index, list) => list.findIndex((other) => other.name === item.name) === index)
    .slice(0, 3)
    .map((item) => ({
      name: item.name,
      text:
        item.masteryDelta < 0
          ? `${item.name} dropped ${Math.abs(item.masteryDelta)} mastery points. Review the first repeated uncomfortable position.`
          : `${item.name} is still below ${Math.max(50, item.mastery + 8)}% mastery. Keep the repair task visible this week.`,
    }));
}

function buildIdentityLine(weekly) {
  if (weekly.mostImproved?.masteryDelta > 0) {
    return `Your ${weekly.mostImproved.name} mastery increased to ${weekly.mostImproved.mastery}%.`;
  }

  if (weekly.trendOpening?.name) {
    return `Your ${weekly.trendOpening.name} responses are becoming a clearer part of your repertoire.`;
  }

  return "Your opening identity baseline is saved. The next import will show what changed.";
}

function buildWeeklyReport(data, current, previous, history) {
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
    ? Math.max(0, Math.min(100, 45 + Math.min(35, Math.max(0, comparison.gamesDelta) * 2) + Math.min(20, comparison.changes.length * 4)))
    : Math.max(28, Math.min(68, openings.length * 8));
  const streak = calculateStreak(history, current.weekKey);
  const ratingTrend = getRatingTrend(history, current, comparison);
  const weaknessUpdates = buildWeaknessUpdates(openings, comparison);
  const identityLine = buildIdentityLine({
    mostImproved,
    trendOpening,
  });

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
    weaknessUpdates,
    identityLine,
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
  const weekly = buildWeeklyReport(data, currentSnapshot, previousSnapshot, history);
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
              ? `${weekRangeLabel()} compared with your previous saved report. ${weekly.identityLine}`
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
              ? `${weekly.trendOpening.name} gained ${weekly.trendOpening.gamesDelta > 0 ? weekly.trendOpening.gamesDelta : weekly.trendOpening.games} tracked games. Opponents may be steering you into this family more often.`
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
          <p>{weekly.ratingTrend.text}</p>
          <Meter value={weekly.studyConsistency} label="Study consistency" />
        </article>

        <article className="weeklyOpeningPanel">
          <div className="weeklyOpeningPanelTop">
            <span>Rating improvement trends</span>
            <strong>{weekly.ratingTrend.label}</strong>
          </div>
          <div className="weeklyRatingTrend">
            <strong>{currentSnapshot.rating || "—"}</strong>
            <span>{weekly.ratingTrend.delta === null ? "Save another report" : signed(weekly.ratingTrend.delta)}</span>
          </div>
          <p>{weekly.ratingTrend.text}</p>
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
            <Meter key={item.name} value={item.confidence} label={`${item.name} · ${confidenceLabel(item.confidence)}`} />
          ))}
        </article>
      </div>

      <div className="weeklyOpeningEvolution weeklyOpeningWeaknessUpdates">
        <div className="weeklyOpeningPanelTop">
          <span>Weakness detection updates</span>
          <strong>
            {weekly.weaknessUpdates.length
              ? `${weekly.weaknessUpdates.length} active repair signals`
              : "No urgent repair signal"}
          </strong>
        </div>

        {weekly.weaknessUpdates.length ? (
          <div className="weeklyEvolutionList">
            {weekly.weaknessUpdates.map((item) => (
              <article key={item.name}>
                <span>Repair signal</span>
                <strong>{item.name}</strong>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="weeklyOpeningMuted">
            No repeated weakness worsened this week. Keep reinforcing the openings that already feel like you.
          </p>
        )}
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
