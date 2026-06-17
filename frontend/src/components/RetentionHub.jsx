import { useEffect, useMemo, useState } from "react";
import { logRetentionEvent } from "../services/retentionEvents";

const HISTORY_KEY = "openingFit:retentionHistory";
const GOALS_KEY = "openingFit:openingGoals";
const REPERTOIRE_KEY = "openingFit:repertoire";

function clampNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanOpeningName(name) {
  if (!name) return "Unknown opening";
  return String(name).trim() || "Unknown opening";
}

function getWinRate(item) {
  const direct =
    item?.winRate ??
    item?.win_rate ??
    item?.score ??
    item?.percentage ??
    item?.rate;

  if (direct !== undefined && direct !== null && direct !== "") {
    const value = clampNumber(String(direct).replace("%", ""), 0);
    return value > 1 ? value : value * 100;
  }

  const wins = clampNumber(item?.wins ?? item?.won ?? item?.w, 0);
  const draws = clampNumber(item?.draws ?? item?.drawn ?? item?.d, 0);
  const losses = clampNumber(item?.losses ?? item?.lost ?? item?.l, 0);
  const games = clampNumber(item?.games ?? item?.count ?? wins + draws + losses, 0);

  if (!games) return 0;

  return ((wins + draws * 0.5) / games) * 100;
}

function getGames(item) {
  return clampNumber(
    item?.games ??
      item?.count ??
      item?.total ??
      clampNumber(item?.wins, 0) +
        clampNumber(item?.draws, 0) +
        clampNumber(item?.losses, 0),
    0
  );
}

function normaliseOpening(item, index = 0) {
  if (typeof item === "string") {
    return {
      name: cleanOpeningName(item),
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: 0,
      verdict: "Track",
      index,
    };
  }

  const name = cleanOpeningName(
    item?.name ??
      item?.opening ??
      item?.openingName ??
      item?.ecoName ??
      item?.family ??
      item?.label
  );

  const wins = clampNumber(item?.wins ?? item?.won ?? item?.w, 0);
  const draws = clampNumber(item?.draws ?? item?.drawn ?? item?.d, 0);
  const losses = clampNumber(item?.losses ?? item?.lost ?? item?.l, 0);
  const games = getGames(item);
  const winRate = getWinRate(item);

  return {
    name,
    games,
    wins,
    draws,
    losses,
    winRate,
    verdict: item?.verdict ?? item?.status ?? item?.recommendation ?? "Track",
    index,
  };
}

function extractOpenings(data) {
  if (!data) return [];

  const possibleArrays = [
    data.openings,
    data.openingStats,
    data.topOpenings,
    data.top_openings,
    data.keepImproveAvoid,
    data.keep_improve_avoid,
    data.openingTable,
    data.opening_table,
    data.preferredOpenings,
    data.preferred_openings,
  ];

  const found = [];

  possibleArrays.forEach((value) => {
    if (Array.isArray(value)) {
      found.push(...value);
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([name, stats]) => {
        if (stats && typeof stats === "object") {
          found.push({ name, ...stats });
        }
      });
    }
  });

  if (data.recommendations) {
    const rec = data.recommendations;

    if (Array.isArray(rec.white)) found.push(...rec.white.map((name) => ({ name })));
    if (Array.isArray(rec.black)) found.push(...rec.black.map((name) => ({ name })));
    if (Array.isArray(rec.openings)) found.push(...rec.openings);
  }

  const normalised = found
    .map(normaliseOpening)
    .filter((opening) => opening.name && opening.name.toLowerCase() !== "unknown opening");

  const merged = new Map();

  normalised.forEach((opening) => {
    const key = opening.name.toLowerCase();

    if (!merged.has(key)) {
      merged.set(key, opening);
      return;
    }

    const existing = merged.get(key);
    const totalGames = existing.games + opening.games;

    merged.set(key, {
      ...existing,
      games: totalGames,
      wins: existing.wins + opening.wins,
      draws: existing.draws + opening.draws,
      losses: existing.losses + opening.losses,
      winRate:
        totalGames > 0
          ? ((existing.wins + opening.wins + (existing.draws + opening.draws) * 0.5) /
              totalGames) *
            100
          : Math.max(existing.winRate, opening.winRate),
    });
  });

  return Array.from(merged.values())
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.winRate - a.winRate;
    })
    .slice(0, 20);
}

function getUsername(data) {
  return (
    data?.username ??
    data?.playerName ??
    data?.player_name ??
    data?.profile?.username ??
    data?.profile?.name ??
    "Player"
  );
}

function getTotalGames(data, openings) {
  return clampNumber(
    data?.gamesImported ??
      data?.games_imported ??
      data?.totalGames ??
      data?.total_games ??
      data?.gameCount ??
      data?.games?.length ??
      openings.reduce((sum, item) => sum + getGames(item), 0),
    0
  );
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser storage may be unavailable in rare cases.
  }
}

function getOpeningChange(current, previous) {
  if (!previous?.openings?.length) return null;

  const previousOpenings = Array.isArray(previous.openings) ? previous.openings : [];
  const previousByName = new Map(
    previousOpenings.map((opening) => [opening.name.toLowerCase(), opening])
  );

  let biggestImprovement = null;

  current.forEach((opening) => {
    const previousOpening = previousByName.get(opening.name.toLowerCase());
    if (!previousOpening) return;

    const change = opening.winRate - previousOpening.winRate;

    if (!biggestImprovement || change > biggestImprovement.change) {
      biggestImprovement = {
        name: opening.name,
        change,
        current: opening.winRate,
        previous: previousOpening.winRate,
      };
    }
  });

  return biggestImprovement;
}

function formatPercent(value) {
  return `${Math.round(clampNumber(value, 0))}%`;
}

function getDefaultRepertoire() {
  return {
    white: [],
    blackVsE4: [],
    blackVsD4: [],
  };
}

function getDefaultGoals(openings) {
  const best = openings.find((opening) => opening.games > 0);
  const weakest = [...openings]
    .filter((opening) => opening.games > 0)
    .sort((a, b) => a.winRate - b.winRate)[0];

  return [
    {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      text: best
        ? `Play 5 more games with ${best.name}`
        : "Import games and identify your best opening",
      done: false,
    },
    {
      id: `${Date.now()}-2`,
      text: weakest
        ? `Improve ${weakest.name} above ${formatPercent(weakest.winRate + 10)}`
        : "Build a small opening repertoire",
      done: false,
    },
  ];
}

function Pill({ children }) {
  return <span className="retentionPill">{children}</span>;
}

export default function RetentionHub({ data }) {
  const openings = useMemo(() => extractOpenings(data), [data]);
  const username = getUsername(data);
  const totalGames = getTotalGames(data, openings);

  const [history, setHistory] = useState(() => loadJson(HISTORY_KEY, []));
  const [goals, setGoals] = useState(() => loadJson(GOALS_KEY, []));
  const [newGoal, setNewGoal] = useState("");
  const [repertoire, setRepertoire] = useState(() =>
    loadJson(REPERTOIRE_KEY, getDefaultRepertoire())
  );

  const latestSnapshot = useMemo(() => {
    if (!data || !openings.length) return null;

    return {
      id: `${username}-${totalGames}-${openings
        .slice(0, 8)
        .map((opening) => `${opening.name}:${Math.round(opening.winRate)}:${opening.games}`)
        .join("|")}`,
      date: new Date().toISOString(),
      username,
      totalGames,
      openings: openings.slice(0, 12),
    };
  }, [data, openings, totalGames, username]);

  useEffect(() => {
    if (!latestSnapshot) return;

    setHistory((currentHistory) => {
      const alreadySaved = currentHistory.some((item) => item.id === latestSnapshot.id);
      if (alreadySaved) return currentHistory;

      const nextHistory = [latestSnapshot, ...currentHistory].slice(0, 20);
      saveJson(HISTORY_KEY, nextHistory);
      return nextHistory;
    });
  }, [latestSnapshot]);

  useEffect(() => {
    if (!goals.length && openings.length) {
      const defaultGoals = getDefaultGoals(openings);
      setGoals(defaultGoals);
      saveJson(GOALS_KEY, defaultGoals);
    }
  }, [goals.length, openings]);

  const previousSnapshot = useMemo(() => {
    if (!latestSnapshot) return null;
    return history.find((item) => item.id !== latestSnapshot.id && item.username === username);
  }, [history, latestSnapshot, username]);

  const bestOpening = openings
    .filter((opening) => opening.games > 0)
    .sort((a, b) => b.winRate - a.winRate)[0];

  const mostPlayedOpening = openings
    .filter((opening) => opening.games > 0)
    .sort((a, b) => b.games - a.games)[0];

  const weakestOpening = openings
    .filter((opening) => opening.games > 0)
    .sort((a, b) => a.winRate - b.winRate)[0];

  const improvement = getOpeningChange(openings, previousSnapshot);

  const trackedNames = [
    ...repertoire.white,
    ...repertoire.blackVsE4,
    ...repertoire.blackVsD4,
  ].map((name) => name.toLowerCase());

  const repertoireMatches = openings.filter((opening) =>
    trackedNames.includes(opening.name.toLowerCase())
  );

  const repertoireGames = repertoireMatches.reduce((sum, opening) => sum + opening.games, 0);

  const repertoireScore =
    totalGames > 0 ? Math.round((repertoireGames / totalGames) * 100) : 0;

  const challenge = useMemo(() => {
    if (weakestOpening && weakestOpening.games >= 2) {
      return `Review one recent loss in ${weakestOpening.name} and note where the opening went wrong.`;
    }

    if (bestOpening) {
      return `Play 3 more games with ${bestOpening.name} and see if the win rate holds.`;
    }

    return "Import your latest games to generate your next opening challenge.";
  }, [bestOpening, weakestOpening]);

  const shareText = useMemo(() => {
    const lines = [
      "My Opening Fit report:",
      bestOpening ? `Best opening: ${bestOpening.name} (${formatPercent(bestOpening.winRate)})` : null,
      weakestOpening
        ? `Needs work: ${weakestOpening.name} (${formatPercent(weakestOpening.winRate)})`
        : null,
      mostPlayedOpening ? `Most played: ${mostPlayedOpening.name}` : null,
      totalGames ? `Games analysed: ${totalGames}` : null,
      "Try yours at Opening Fit",
    ].filter(Boolean);

    return lines.join("\n");
  }, [bestOpening, weakestOpening, mostPlayedOpening, totalGames]);

  function addGoal() {
    const text = newGoal.trim();
    if (!text) return;
    const goalId = crypto.randomUUID?.() ?? `${Date.now()}`;

    const nextGoals = [
      ...goals,
      {
        id: goalId,
        text,
        done: false,
      },
    ];

    setGoals(nextGoals);
    saveJson(GOALS_KEY, nextGoals);
    setNewGoal("");
    logRetentionEvent(
      "goal_created",
      {
        source: "retention_hub",
        text,
      },
      { dedupeKey: goalId }
    );
  }

  function toggleGoal(id) {
    const currentGoal = goals.find((goal) => goal.id === id);
    const nextGoals = goals.map((goal) =>
      goal.id === id ? { ...goal, done: !goal.done } : goal
    );

    setGoals(nextGoals);
    saveJson(GOALS_KEY, nextGoals);

    if (currentGoal && !currentGoal.done) {
      logRetentionEvent(
        "goal_completed",
        {
          source: "retention_hub",
          text: currentGoal.text,
        },
        { dedupeKey: id }
      );
    }
  }

  function removeGoal(id) {
    const nextGoals = goals.filter((goal) => goal.id !== id);
    setGoals(nextGoals);
    saveJson(GOALS_KEY, nextGoals);
  }

  function addToRepertoire(section, openingName) {
    if (!openingName) return;

    const current = repertoire[section] ?? [];
    if (current.some((name) => name.toLowerCase() === openingName.toLowerCase())) return;

    const nextRepertoire = {
      ...repertoire,
      [section]: [...current, openingName],
    };

    setRepertoire(nextRepertoire);
    saveJson(REPERTOIRE_KEY, nextRepertoire);
  }

  function removeFromRepertoire(section, openingName) {
    const nextRepertoire = {
      ...repertoire,
      [section]: repertoire[section].filter((name) => name !== openingName),
    };

    setRepertoire(nextRepertoire);
    saveJson(REPERTOIRE_KEY, nextRepertoire);
  }

  async function copyShareText() {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  if (!data) return null;

  return (
    <section className="card retentionHub">
      <div className="retentionHeader">
        <div>
          <p className="eyebrow">Comeback Hub</p>
          <h2>Your next reason to return</h2>
          <p>
            Track progress, set opening goals, build a repertoire, and re-import after
            your next games to see what changed.
          </p>
        </div>

        <div className="retentionHeaderStat">
          <strong>{totalGames || "—"}</strong>
          <span>games analysed</span>
        </div>
      </div>

      <div className="retentionGrid">
        <div className="retentionPanel highlightPanel">
          <div className="retentionPanelTop">
            <h3>Weekly review</h3>
            <Pill>Refresh after new games</Pill>
          </div>

          <div className="retentionList">
            <div>
              <span>Best opening</span>
              <strong>
                {bestOpening
                  ? `${bestOpening.name} · ${formatPercent(bestOpening.winRate)}`
                  : "Not enough data yet"}
              </strong>
            </div>

            <div>
              <span>Most played</span>
              <strong>
                {mostPlayedOpening
                  ? `${mostPlayedOpening.name} · ${mostPlayedOpening.games} games`
                  : "Not enough data yet"}
              </strong>
            </div>

            <div>
              <span>Needs work</span>
              <strong>
                {weakestOpening
                  ? `${weakestOpening.name} · ${formatPercent(weakestOpening.winRate)}`
                  : "Not enough data yet"}
              </strong>
            </div>

            <div>
              <span>Progress since last import</span>
              <strong>
                {improvement
                  ? `${improvement.name} ${improvement.change >= 0 ? "+" : ""}${Math.round(
                      improvement.change
                    )}%`
                  : "Import again later to compare"}
              </strong>
            </div>
          </div>
        </div>

        <div className="retentionPanel">
          <div className="retentionPanelTop">
            <h3>Opening streaks</h3>
            <Pill>Gamified</Pill>
          </div>

          <div className="streakCards">
            <div>
              <strong>{bestOpening ? formatPercent(bestOpening.winRate) : "—"}</strong>
              <span>best opening score</span>
            </div>

            <div>
              <strong>{mostPlayedOpening ? mostPlayedOpening.games : "—"}</strong>
              <span>games in top opening</span>
            </div>

            <div>
              <strong>{repertoireScore}%</strong>
              <span>played from repertoire</span>
            </div>
          </div>

          <p className="retentionSmall">
            Re-import after another batch of games to turn these into real progress
            streaks.
          </p>
        </div>

        <div className="retentionPanel">
          <div className="retentionPanelTop">
            <h3>Opening challenge</h3>
            <Pill>Next task</Pill>
          </div>

          <p className="challengeText">{challenge}</p>
        </div>

        <div className="retentionPanel">
          <div className="retentionPanelTop">
            <h3>Shareable progress card</h3>
            <Pill>Copy text</Pill>
          </div>

          <pre className="shareBox">{shareText}</pre>

          <button className="secondaryAction" type="button" onClick={copyShareText}>
            Copy share text
          </button>
        </div>
      </div>

      <div className="retentionSplit">
        <div className="retentionPanel">
          <div className="retentionPanelTop">
            <h3>Opening goals</h3>
            <Pill>{goals.filter((goal) => !goal.done).length} active</Pill>
          </div>

          <div className="goalInputRow">
            <input
              value={newGoal}
              onChange={(event) => setNewGoal(event.target.value)}
              placeholder="Add a goal, e.g. Get Vienna above 60%"
            />
            <button type="button" onClick={addGoal}>
              Add
            </button>
          </div>

          <div className="goalList">
            {goals.map((goal) => (
              <div className={`goalItem ${goal.done ? "done" : ""}`} key={goal.id}>
                <button type="button" onClick={() => toggleGoal(goal.id)}>
                  {goal.done ? "✓" : ""}
                </button>
                <span>{goal.text}</span>
                <button
                  className="goalRemove"
                  type="button"
                  onClick={() => removeGoal(goal.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="retentionPanel">
          <div className="retentionPanelTop">
            <h3>Repertoire tracker</h3>
            <Pill>{repertoireGames} tracked games</Pill>
          </div>

          <div className="repertoireQuickAdd">
            {openings.slice(0, 6).map((opening) => (
              <div key={opening.name}>
                <span>{opening.name}</span>
                <div>
                  <button type="button" onClick={() => addToRepertoire("white", opening.name)}>
                    White
                  </button>
                  <button
                    type="button"
                    onClick={() => addToRepertoire("blackVsE4", opening.name)}
                  >
                    vs e4
                  </button>
                  <button
                    type="button"
                    onClick={() => addToRepertoire("blackVsD4", opening.name)}
                  >
                    vs d4
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="repertoireColumns">
            <RepertoireColumn
              title="White"
              items={repertoire.white}
              onRemove={(name) => removeFromRepertoire("white", name)}
            />
            <RepertoireColumn
              title="Black vs e4"
              items={repertoire.blackVsE4}
              onRemove={(name) => removeFromRepertoire("blackVsE4", name)}
            />
            <RepertoireColumn
              title="Black vs d4"
              items={repertoire.blackVsD4}
              onRemove={(name) => removeFromRepertoire("blackVsD4", name)}
            />
          </div>
        </div>
      </div>

      <div className="retentionPanel historyPanel">
        <div className="retentionPanelTop">
          <h3>Saved import history</h3>
          <Pill>{history.length} saved</Pill>
        </div>

        <div className="historyList">
          {history.slice(0, 5).map((item) => (
            <div key={item.id}>
              <strong>{new Date(item.date).toLocaleDateString()}</strong>
              <span>{item.totalGames} games</span>
              <span>
                {item.openings?.[0]
                  ? `${item.openings[0].name} · ${formatPercent(item.openings[0].winRate)}`
                  : "No opening data"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RepertoireColumn({ title, items, onRemove }) {
  return (
    <div className="repertoireColumn">
      <strong>{title}</strong>

      {items.length ? (
        items.map((item) => (
          <button type="button" key={item} onClick={() => onRemove(item)}>
            {item}
            <span>×</span>
          </button>
        ))
      ) : (
        <p>No openings yet</p>
      )}
    </div>
  );
}
