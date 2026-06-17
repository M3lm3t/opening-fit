import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "openingFit:progressHistory";

function getOpeningName(item) {
  return (
    item?.opening ||
    item?.name ||
    item?.ecoName ||
    item?.opening_name ||
    item?.label ||
    "Unknown opening"
  );
}

function getGames(item) {
  return Number(item?.games ?? item?.count ?? item?.total ?? 0);
}

function getWinRate(item) {
  const direct = item?.winRate ?? item?.win_rate ?? item?.score;

  if (typeof direct === "number") {
    return direct > 1 ? Math.round(direct) : Math.round(direct * 100);
  }

  const games = getGames(item);
  const wins = Number(item?.wins ?? item?.w ?? 0);
  const draws = Number(item?.draws ?? item?.d ?? 0);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function collectOpenings(data) {
  const possible =
    data?.openingStats ||
    data?.openings ||
    data?.topOpenings ||
    data?.verdicts ||
    data?.opening_win_rates ||
    data?.openingWinRates ||
    [];

  if (Array.isArray(possible)) return possible;

  if (possible && typeof possible === "object") {
    return Object.entries(possible).map(([name, value]) => ({
      name,
      ...(typeof value === "object" ? value : { games: value }),
    }));
  }

  return [];
}

function isUnknownOpening(name) {
  const normalised = String(name || "").trim().toLowerCase();

  return (
    !normalised ||
    normalised === "unknown" ||
    normalised === "unknown opening" ||
    normalised.includes("uncommon opening")
  );
}

function getUsername(data) {
  return (
    data?.username ||
    data?.playerName ||
    data?.player ||
    data?.profile?.username ||
    "Unknown user"
  );
}

function getPlatform(data) {
  return (
    data?.platform ||
    data?.source ||
    data?.profile?.platform ||
    "chess"
  );
}

function getGamesImported(data) {
  return Number(
    data?.gamesImported ||
    data?.games_imported ||
    data?.totalGames ||
    data?.total_games ||
    data?.games?.length ||
    0
  );
}

function createSnapshot(data) {
  const openings = collectOpenings(data)
    .map((item) => ({
      name: getOpeningName(item),
      games: getGames(item),
      winRate: getWinRate(item),
    }))
    .filter((item) => !isUnknownOpening(item.name))
    .filter((item) => item.games > 0)
    .sort((a, b) => b.games - a.games)
    .slice(0, 30);

  const username = getUsername(data);
  const platform = getPlatform(data);
  const gamesImported = getGamesImported(data);

  return {
    id: `${platform}-${username}-${Date.now()}`,
    username,
    platform,
    gamesImported,
    openings,
    createdAt: new Date().toISOString(),
  };
}

function loadHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 12)));
}

function formatDate(value) {
  if (!value) return "Unknown date";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Unknown date";
  }
}

function compareSnapshots(current, previous) {
  if (!current || !previous) return null;

  const currentOpenings = Array.isArray(current.openings) ? current.openings : [];
  const previousOpenings = Array.isArray(previous.openings) ? previous.openings : [];
  const previousByName = new Map(
    previousOpenings.map((item) => [String(item.name).toLowerCase(), item])
  );

  const changes = currentOpenings
    .map((item) => {
      const old = previousByName.get(String(item.name).toLowerCase());
      if (!old) return null;

      return {
        name: item.name,
        currentWinRate: item.winRate,
        previousWinRate: old.winRate,
        difference: item.winRate - old.winRate,
        currentGames: item.games,
        previousGames: old.games,
      };
    })
    .filter(Boolean)
    .filter((item) => item.currentGames >= 2 || item.previousGames >= 2)
    .sort((a, b) => b.difference - a.difference);

  const bestImprovement = changes.find((item) => item.difference > 0);
  const biggestDrop = [...changes].reverse().find((item) => item.difference < 0);

  return {
    changes,
    bestImprovement,
    biggestDrop,
    gamesDifference: current.gamesImported - previous.gamesImported,
  };
}

export default function ProgressTracker({ data }) {
  const [history, setHistory] = useState(() => loadHistory());
  const [savedMessage, setSavedMessage] = useState("");

  const currentSnapshot = useMemo(() => {
    if (!data) return null;
    return createSnapshot(data);
  }, [data]);

  const relevantHistory = useMemo(() => {
    if (!currentSnapshot) return [];

    return history.filter(
      (item) =>
        String(item.username).toLowerCase() === String(currentSnapshot.username).toLowerCase() &&
        String(item.platform).toLowerCase() === String(currentSnapshot.platform).toLowerCase()
    );
  }, [history, currentSnapshot]);

  const previousSnapshot = relevantHistory[0] || null;

  const comparison = useMemo(() => {
    return compareSnapshots(currentSnapshot, previousSnapshot);
  }, [currentSnapshot, previousSnapshot]);

  useEffect(() => {
    setHistory(loadHistory());
  }, [data]);

  if (!data || !currentSnapshot) return null;

  const saveCurrentProgress = () => {
    const freshHistory = loadHistory();

    const latestForUser = freshHistory.find(
      (item) =>
        String(item.username).toLowerCase() === String(currentSnapshot.username).toLowerCase() &&
        String(item.platform).toLowerCase() === String(currentSnapshot.platform).toLowerCase()
    );

    const isSameImport =
      latestForUser &&
      latestForUser.gamesImported === currentSnapshot.gamesImported &&
      JSON.stringify((latestForUser.openings || []).slice(0, 8)) ===
        JSON.stringify((currentSnapshot.openings || []).slice(0, 8));

    if (isSameImport) {
      setSavedMessage("This import is already saved.");
      setTimeout(() => setSavedMessage(""), 1800);
      return;
    }

    const nextHistory = [currentSnapshot, ...freshHistory].slice(0, 12);
    saveHistory(nextHistory);
    setHistory(nextHistory);
    setSavedMessage("Progress saved.");
    setTimeout(() => setSavedMessage(""), 1800);
  };

  const clearProgress = () => {
    const freshHistory = loadHistory();

    const nextHistory = freshHistory.filter(
      (item) =>
        !(
          String(item.username).toLowerCase() === String(currentSnapshot.username).toLowerCase() &&
          String(item.platform).toLowerCase() === String(currentSnapshot.platform).toLowerCase()
        )
    );

    saveHistory(nextHistory);
    setHistory(nextHistory);
    setSavedMessage("Progress history cleared.");
    setTimeout(() => setSavedMessage(""), 1800);
  };

  const best = comparison?.bestImprovement;
  const drop = comparison?.biggestDrop;
  const hasPrevious = Boolean(previousSnapshot);

  return (
    <section className="progressTrackerShell" id="progress-tracker">
      <div className="progressTrackerHeader">
        <div>
          <div className="progressTrackerEyebrow">Free progress tracking</div>
          <h2>Track whether your openings are actually improving.</h2>
          <p>
            Save your current import, come back later, re-import your games, and OpeningFit
            will compare your opening results over time.
          </p>
        </div>

        <div className="progressTrackerActions">
          <span>{savedMessage || `${relevantHistory.length} saved imports`}</span>

          <button type="button" onClick={saveCurrentProgress}>
            Save current progress
          </button>

          <button type="button" className="ghost" onClick={clearProgress}>
            Clear history
          </button>
        </div>
      </div>

      <div className="progressTrackerGrid">
        <div className="progressMainCard">
          <span>Current import</span>
          <h3>{currentSnapshot.username}</h3>
          <p>
            {currentSnapshot.gamesImported || "Imported"} games ·{" "}
            {currentSnapshot.openings.length} openings detected
          </p>
          <small>{formatDate(currentSnapshot.createdAt)}</small>
        </div>

        <div className="progressMainCard">
          <span>Previous saved import</span>
          {hasPrevious ? (
            <>
              <h3>{previousSnapshot.gamesImported || "Saved"} games</h3>
              <p>{(previousSnapshot.openings || []).length} openings tracked</p>
              <small>{formatDate(previousSnapshot.createdAt)}</small>
            </>
          ) : (
            <>
              <h3>No previous import yet</h3>
              <p>Save this result now, then re-import after more games.</p>
              <small>Free feature</small>
            </>
          )}
        </div>

        <div className="progressMainCard highlight">
          <span>Games difference</span>
          <h3>
            {hasPrevious && comparison
              ? comparison.gamesDifference >= 0
                ? `+${comparison.gamesDifference}`
                : comparison.gamesDifference
              : "—"}
          </h3>
          <p>More games since your last saved import</p>
          <small>Best after 10+ new games</small>
        </div>
      </div>

      <div className="progressResultGrid">
        <div className="progressResultCard positive">
          <span>Best improvement</span>

          {best ? (
            <>
              <h3>{best.name}</h3>
              <p>
                Improved from {best.previousWinRate}% to {best.currentWinRate}%.
              </p>
              <strong>+{best.difference}%</strong>
            </>
          ) : (
            <>
              <h3>Not enough history yet</h3>
              <p>Save this import, play more games, then compare again.</p>
              <strong>—</strong>
            </>
          )}
        </div>

        <div className="progressResultCard negative">
          <span>Biggest drop</span>

          {drop ? (
            <>
              <h3>{drop.name}</h3>
              <p>
                Dropped from {drop.previousWinRate}% to {drop.currentWinRate}%.
              </p>
              <strong>{drop.difference}%</strong>
            </>
          ) : (
            <>
              <h3>No major drop found</h3>
              <p>Good. Your saved openings have not clearly declined yet.</p>
              <strong>Stable</strong>
            </>
          )}
        </div>
      </div>

      <div className="progressHistoryCard">
        <div className="progressHistoryHeader">
          <span>Recent saved imports</span>
          <strong>{relevantHistory.length}</strong>
        </div>

        {relevantHistory.length ? (
          <div className="progressHistoryList">
            {relevantHistory.slice(0, 5).map((item) => (
              <div className="progressHistoryRow" key={item.id}>
                <div>
                  <strong>{formatDate(item.createdAt)}</strong>
                  <span>
                    {item.gamesImported || "Imported"} games · {(item.openings || []).length} openings
                  </span>
                </div>

                <small>{item.platform}</small>
              </div>
            ))}
          </div>
        ) : (
          <p>
            No saved history yet. Save the current result, then come back after more games to
            track your progress.
          </p>
        )}
      </div>
    </section>
  );
}
