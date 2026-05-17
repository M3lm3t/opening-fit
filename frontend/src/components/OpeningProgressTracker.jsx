import { useEffect, useMemo, useState } from "react";
import "./OpeningProgressTracker.css";

const MAX_HISTORY = 8;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getUsername(data) {
  return (
    data?.username ||
    data?.player ||
    data?.handle ||
    localStorage.getItem("openingFit:lastUsername") ||
    "guest"
  );
}

function getPlatform(data) {
  return (
    data?.platform ||
    data?.source ||
    localStorage.getItem("openingFit:lastPlatform") ||
    "unknown"
  );
}

function getRating(data) {
  return toNumber(
    data?.rating ??
      data?.chesscomRating ??
      data?.lichessRating ??
      data?.player_rating ??
      data?.currentRating,
    null
  );
}

function getGamesAnalysed(data) {
  return toNumber(
    data?.gamesAnalyzed ??
      data?.games_analyzed ??
      data?.gamesImported ??
      data?.games_imported ??
      data?.total_games ??
      data?.game_count ??
      data?.recentGames?.length ??
      data?.games?.length,
    0
  );
}

function openingName(item) {
  return (
    item?.name ||
    item?.opening ||
    item?.eco_name ||
    item?.label ||
    item?.title ||
    null
  );
}

function getWinRate(item) {
  const raw =
    item?.winRate ??
    item?.win_rate ??
    item?.winrate ??
    item?.score ??
    item?.successRate;

  const n = toNumber(raw, null);
  if (n === null) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function getOpeningGames(item) {
  return toNumber(item?.games ?? item?.count ?? item?.total ?? item?.played, 0);
}

function getOpenings(data) {
  const raw = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
  ];

  const byName = new Map();

  raw.forEach((item) => {
    const name = openingName(item);
    if (!name) return;

    const existing = byName.get(name);
    const currentGames = getOpeningGames(item);
    const currentWin = getWinRate(item);

    if (!existing || currentGames > existing.games) {
      byName.set(name, {
        name,
        games: currentGames,
        winRate: currentWin,
      });
    }
  });

  return Array.from(byName.values())
    .filter((item) => item.name)
    .sort((a, b) => b.games - a.games)
    .slice(0, 12);
}

function storageKey(data) {
  const platform = getPlatform(data);
  const username = getUsername(data);
  return `openingFit:progressHistory:${platform}:${username}`;
}

function makeSnapshot(data) {
  return {
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
    username: getUsername(data),
    platform: getPlatform(data),
    rating: getRating(data),
    gamesAnalysed: getGamesAnalysed(data),
    openings: getOpenings(data),
  };
}

function formatDate(iso) {
  if (!iso) return "Previous report";

  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return "Previous report";
  }
}

function signedNumber(value, suffix = "") {
  const n = toNumber(value, 0);
  if (n > 0) return `+${n}${suffix}`;
  if (n < 0) return `${n}${suffix}`;
  return `0${suffix}`;
}

function compareOpenings(previous, current) {
  if (!previous || !current) return [];

  const previousMap = new Map(
    (previous.openings || []).map((item) => [item.name, item])
  );

  return (current.openings || [])
    .map((item) => {
      const old = previousMap.get(item.name);
      if (!old) {
        return {
          name: item.name,
          type: "new",
          currentWinRate: item.winRate,
          previousWinRate: null,
          delta: null,
          games: item.games,
        };
      }

      if (item.winRate === null || old.winRate === null) return null;

      return {
        name: item.name,
        type: item.winRate - old.winRate >= 0 ? "improved" : "dropped",
        currentWinRate: item.winRate,
        previousWinRate: old.winRate,
        delta: item.winRate - old.winRate,
        games: item.games,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const absA = Math.abs(a.delta ?? 0);
      const absB = Math.abs(b.delta ?? 0);
      return absB - absA;
    })
    .slice(0, 5);
}

export default function OpeningProgressTracker({ data, compact = false }) {
  const key = useMemo(() => storageKey(data || {}), [data]);
  const currentSnapshot = useMemo(() => makeSnapshot(data || {}), [data]);

  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      setHistory(Array.isArray(saved) ? saved : []);
    } catch {
      setHistory([]);
    }
  }, [key]);

  const previousSnapshot = history[0] || null;
  const openingChanges = compareOpenings(previousSnapshot, currentSnapshot);

  const ratingDelta =
    previousSnapshot?.rating !== null && currentSnapshot.rating !== null
      ? currentSnapshot.rating - previousSnapshot.rating
      : null;

  const gamesDelta = previousSnapshot
    ? currentSnapshot.gamesAnalysed - previousSnapshot.gamesAnalysed
    : null;

  const saveSnapshot = () => {
    const next = [
      currentSnapshot,
      ...history.filter((item) => {
        const sameRating = item.rating === currentSnapshot.rating;
        const sameGames = item.gamesAnalysed === currentSnapshot.gamesAnalysed;
        const sameOpenings =
          JSON.stringify(item.openings || []) ===
          JSON.stringify(currentSnapshot.openings || []);

        return !(sameRating && sameGames && sameOpenings);
      }),
    ].slice(0, MAX_HISTORY);

    setHistory(next);

    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Local progress should never break the app.
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore localStorage failures.
    }
  };

  const hasPrevious = Boolean(previousSnapshot);

  return (
    <section className={`openingProgressTracker ${compact ? "openingProgressTracker--compact" : ""}`}>
      <div className="openingProgressHeader">
        <div>
          <p className="openingProgressKicker">Progress tracker</p>
          <h2>Compare after re-import</h2>
          <p>
            Save today’s report, then re-import after study or a playing session
            to see what changed in your openings.
          </p>
        </div>

        <div className="openingProgressActions">
          <button type="button" onClick={saveSnapshot}>
            Save current report
          </button>
          {history.length ? (
            <button type="button" className="openingProgressGhost" onClick={clearHistory}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="openingProgressStats">
        <article>
          <span>Previous</span>
          <strong>{hasPrevious ? formatDate(previousSnapshot.createdAt) : "Not saved yet"}</strong>
          <p>
            {hasPrevious
              ? `${previousSnapshot.gamesAnalysed || 0} games${previousSnapshot.rating ? ` · ${previousSnapshot.rating} rating` : ""}`
              : "Save this report once to start tracking."}
          </p>
        </article>

        <article>
          <span>Current</span>
          <strong>{formatDate(currentSnapshot.createdAt)}</strong>
          <p>
            {`${currentSnapshot.gamesAnalysed || 0} games${currentSnapshot.rating ? ` · ${currentSnapshot.rating} rating` : ""}`}
          </p>
        </article>

        <article>
          <span>Change</span>
          <strong>
            {hasPrevious && ratingDelta !== null ? signedNumber(ratingDelta) : "—"}
          </strong>
          <p>
            {hasPrevious
              ? `${gamesDelta !== null ? signedNumber(gamesDelta) : "0"} games analysed`
              : "Re-import later to compare."}
          </p>
        </article>
      </div>

      {!hasPrevious ? (
        <div className="openingProgressEmpty">
          <h3>Start your baseline</h3>
          <p>
            Click “Save current report” today. After you finish your 7-day plan,
            re-import and OpeningFit will compare the new report against this one.
          </p>
        </div>
      ) : (
        <div className="openingProgressChanges">
          {(compact ? openingChanges.slice(0, 3) : openingChanges).map((item) => (
            <article
              className={`openingProgressChange openingProgressChange--${item.type}`}
              key={item.name}
            >
              <div>
                <span>
                  {item.type === "new"
                    ? "New"
                    : item.type === "improved"
                      ? "Improved"
                      : "Needs attention"}
                </span>
                <h3>{item.name}</h3>
                <p>
                  {item.type === "new"
                    ? `${item.currentWinRate ?? "—"}% score · ${item.games} games`
                    : `${item.previousWinRate}% → ${item.currentWinRate}% · ${item.games} games`}
                </p>
              </div>

              <strong>
                {item.delta === null ? "New" : signedNumber(item.delta, "%")}
              </strong>
            </article>
          ))}

          {!openingChanges.length ? (
            <div className="openingProgressEmpty">
              <h3>No opening movement yet</h3>
              <p>
                Your current report is very close to the saved report. Play more
                games, then re-import for a clearer comparison.
              </p>
            </div>
          ) : null}
        </div>
      )}

      <div className="openingProgressFooter">
        <p>
          Progress is saved on this device for {currentSnapshot.platform}/{currentSnapshot.username}.
        </p>
      </div>
    </section>
  );
}
