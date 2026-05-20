import { useMemo, useState } from "react";
import "./PremiumDashboard.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";
const PREMIUM_DEMO_KEY = "openingFit:premiumDemo";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normaliseOpeningName(row) {
  return (
    row?.opening ||
    row?.name ||
    row?.ecoName ||
    row?.family ||
    row?.label ||
    "Unknown opening"
  );
}

function getGames(data) {
  return (
    asArray(data?.games).length
      ? asArray(data.games)
      : asArray(data?.recentGames).length
      ? asArray(data.recentGames)
      : asArray(data?.sampleGames).length
      ? asArray(data.sampleGames)
      : []
  );
}

function getOpeningRows(data) {
  const candidates = [
    data?.topOpenings,
    data?.openingStats,
    data?.openings,
    data?.openingWinRates,
    data?.openingBreakdown,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }

  if (data?.statsByOpening && typeof data.statsByOpening === "object") {
    return Object.entries(data.statsByOpening).map(([name, stats]) => ({
      name,
      ...stats,
    }));
  }

  return [];
}

function getWinRate(row) {
  if (row?.winRate !== undefined) return safeNumber(row.winRate);
  if (row?.win_rate !== undefined) return safeNumber(row.win_rate);
  if (row?.score !== undefined) return safeNumber(row.score);

  const wins = safeNumber(row?.wins ?? row?.W);
  const draws = safeNumber(row?.draws ?? row?.D);
  const losses = safeNumber(row?.losses ?? row?.L);
  const games = safeNumber(row?.games ?? row?.total ?? wins + draws + losses);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function getGameCount(row) {
  return safeNumber(row?.games ?? row?.total ?? row?.count ?? 0);
}

function buildRepertoire(data) {
  const rows = getOpeningRows(data)
    .map((row) => ({
      ...row,
      openingName: normaliseOpeningName(row),
      winRate: getWinRate(row),
      games: getGameCount(row),
    }))
    .filter((row) => row.openingName && !row.openingName.toLowerCase().includes("unknown"))
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.winRate - a.winRate;
    });

  const reliable = rows.filter((row) => row.games >= 3);
  const pool = reliable.length ? reliable : rows;

  const keep = [...pool]
    .filter((row) => row.winRate >= 55)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3);

  const improve = [...pool]
    .filter((row) => row.winRate > 35 && row.winRate < 55)
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);

  const avoid = [...pool]
    .filter((row) => row.winRate <= 35)
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);

  return {
    keep,
    improve,
    avoid,
    mainWhite: keep[0] || pool[0],
    backupWhite: keep[1] || pool[1],
    blackVsE4: pool.find((row) => /sicilian|caro|french|scandinavian|pirc|modern|e5/i.test(row.openingName)) || pool[2],
    blackVsD4: pool.find((row) => /queen|nimzo|king.?s indian|grunfeld|slav|dutch/i.test(row.openingName)) || pool[3],
  };
}

function gameResultScore(game) {
  const result = String(game?.result || game?.score || game?.outcome || "").toLowerCase();

  if (result.includes("win") || result === "1-0" || result === "1") return 1;
  if (result.includes("draw") || result === "1/2-1/2" || result === "0.5") return 0.5;
  if (result.includes("loss") || result === "0-1" || result === "0") return 0;

  return 0.5;
}

function extractMoves(game) {
  if (Array.isArray(game?.moves)) {
    return game.moves
      .map((move) => (typeof move === "string" ? move : move?.san || move?.move || ""))
      .filter(Boolean);
  }

  const pgn = String(game?.pgn || "");
  return pgn
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !/^\d+\./.test(token))
    .filter((token) => !["1-0", "0-1", "1/2-1/2", "*"].includes(token))
    .slice(0, 18);
}

function buildWeakLines(data) {
  const games = getGames(data);
  const grouped = new Map();

  games.forEach((game) => {
    const moves = extractMoves(game);
    if (moves.length < 6) return;

    const key = moves.slice(0, 6).join(" ");
    const current = grouped.get(key) || {
      line: key,
      games: 0,
      score: 0,
      examples: [],
    };

    current.games += 1;
    current.score += gameResultScore(game);

    if (current.examples.length < 2) {
      current.examples.push(game);
    }

    grouped.set(key, current);
  });

  return [...grouped.values()]
    .map((line) => ({
      ...line,
      scoreRate: Math.round((line.score / line.games) * 100),
    }))
    .filter((line) => line.games >= 2)
    .sort((a, b) => {
      if (a.scoreRate !== b.scoreRate) return a.scoreRate - b.scoreRate;
      return b.games - a.games;
    })
    .slice(0, 5);
}


function LockedOverlay({ title = "Premium feature", children, onUnlock }) {
  return (
    <div className="premiumLockedOverlay">
      <div className="premiumLockIcon">🔒</div>
      <strong>{title}</strong>
      <p>{children || "Unlock the full version to use this feature."}</p>
      <button className="premiumUnlockBtn" type="button" onClick={onUnlock}>
        Preview premium
      </button>
    </div>
  );
}

function StatTile({ label, value, helper }) {
  return (
    <div className="premiumStatTile">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function OpeningMiniCard({ title, row, fallback }) {
  return (
    <div className="premiumOpeningMiniCard">
      <span>{title}</span>
      <strong>{row?.openingName || fallback || "Needs more games"}</strong>
      {row ? (
        <small>
          {row.games || 0} games · {row.winRate || 0}% score
        </small>
      ) : (
        <small>Import more games to improve this recommendation.</small>
      )}
    </div>
  );
}

export default function PremiumDashboard({ data, username }) {
  const [isPremiumDemo, setIsPremiumDemo] = useState(() => {
    try {
      return localStorage.getItem(PREMIUM_DEMO_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [stockfishLoading, setStockfishLoading] = useState(false);
  const [stockfishResult, setStockfishResult] = useState(null);
  const [stockfishError, setStockfishError] = useState("");

  const repertoire = useMemo(() => buildRepertoire(data), [data]);
  const weakLines = useMemo(() => buildWeakLines(data), [data]);
  const games = useMemo(() => getGames(data), [data]);

  const totalGames =
    safeNumber(data?.gamesImported) ||
    safeNumber(data?.totalGames) ||
    safeNumber(data?.gamesCount) ||
    games.length;

  const openingRows = getOpeningRows(data);
  const trackedOpenings = openingRows.length;

  const bestOpening = repertoire.keep?.[0];
  const weakestOpening = repertoire.avoid?.[0] || repertoire.improve?.[0];

  const latestGameWithPgn = games.find((game) => game?.pgn);

  const togglePremiumDemo = () => {
    const next = !isPremiumDemo;
    setIsPremiumDemo(next);

    try {
      localStorage.setItem(PREMIUM_DEMO_KEY, String(next));
    } catch {
      // Ignore storage errors.
    }
  };

  const runStockfish = async () => {
    if (!isPremiumDemo) {
      setStockfishError("Stockfish coach is a premium feature. Turn on Premium demo to preview it.");
      return;
    }

    setStockfishLoading(true);
    setStockfishError("");
    setStockfishResult(null);

    try {
      if (!latestGameWithPgn?.pgn) {
        throw new Error("No PGN game found yet. Import games first, then try Stockfish analysis.");
      }

      const response = await fetch(`${API_BASE}/api/premium/stockfish-game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pgn: latestGameWithPgn.pgn,
          depth: 8,
          max_moves: 70,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.detail || "Stockfish analysis failed.");
      }

      setStockfishResult(json);
    } catch (error) {
      setStockfishError(error.message || "Could not run Stockfish analysis.");
    } finally {
      setStockfishLoading(false);
    }
  };

  return (
    <section className="premiumDashboard" id="premium">
      <div className="premiumHero">
        <div>
          <span className="premiumEyebrow">Premium preview</span>
          <h2>Your personal opening coach</h2>
          <p>
            Turn your imported games into a complete repertoire plan, weak-line tracker,
            training focus list, and optional engine-backed review when it is available.
          </p>
        </div>

        <div className="premiumPriceCard">
          <span>Early supporter idea</span>
          <strong>£8 one-time</strong>
          <small>Unlock deeper reports while the app is growing.</small>

          <button className="premiumDemoToggle" type="button" onClick={togglePremiumDemo}>
            {isPremiumDemo ? "Premium demo on" : "Preview premium"}
          </button>
        </div>
      </div>

      <div className="premiumStatsGrid">
        <StatTile label="Games reviewed" value={totalGames || "—"} helper="Used to shape your repertoire" />
        <StatTile label="Openings tracked" value={trackedOpenings || "—"} helper="Known patterns from your games" />
        <StatTile
          label="Best current weapon"
          value={bestOpening?.openingName || "Needs more data"}
          helper={bestOpening ? `${bestOpening.winRate}% score` : "Import games to unlock"}
        />
        <StatTile
          label="Biggest focus"
          value={weakestOpening?.openingName || "Needs more data"}
          helper={weakestOpening ? `${weakestOpening.winRate}% score` : "No clear weakness yet"}
        />
      </div>

      <div className="premiumGrid">
        <div className="premiumPanel premiumWide">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Repertoire builder</span>
              <h3>Your suggested opening setup</h3>
            </div>
            <span className="premiumBadge">Premium core</span>
          </div>

          <div className="premiumOpeningGrid">
            <OpeningMiniCard title="Main White weapon" row={repertoire.mainWhite} />
            <OpeningMiniCard title="Backup White option" row={repertoire.backupWhite} />
            <OpeningMiniCard title="Black vs 1.e4" row={repertoire.blackVsE4} fallback="Add more black games" />
            <OpeningMiniCard title="Black vs 1.d4" row={repertoire.blackVsD4} fallback="Add more black games" />
          </div>
        </div>

        <div className="premiumPanel">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Keep</span>
              <h3>Openings to trust</h3>
            </div>
          </div>

          <div className="premiumList">
            {repertoire.keep.length ? (
              repertoire.keep.map((row) => (
                <div key={`keep-${row.openingName}`} className="premiumListItem good">
                  <strong>{row.openingName}</strong>
                  <span>{row.games} games · {row.winRate}% score</span>
                </div>
              ))
            ) : (
              <p className="premiumEmpty">No clear keep list yet. Import more games.</p>
            )}
          </div>
        </div>

        <div className="premiumPanel">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Improve</span>
              <h3>Openings to repair</h3>
            </div>
          </div>

          <div className="premiumList">
            {repertoire.improve.length ? (
              repertoire.improve.map((row) => (
                <div key={`improve-${row.openingName}`} className="premiumListItem warning">
                  <strong>{row.openingName}</strong>
                  <span>{row.games} games · {row.winRate}% score</span>
                </div>
              ))
            ) : (
              <p className="premiumEmpty">No middle-ground openings found yet.</p>
            )}
          </div>
        </div>

        <div className="premiumPanel">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Avoid</span>
              <h3>Openings hurting results</h3>
            </div>
          </div>

          <div className="premiumList">
            {repertoire.avoid.length ? (
              repertoire.avoid.map((row) => (
                <div key={`avoid-${row.openingName}`} className="premiumListItem danger">
                  <strong>{row.openingName}</strong>
                  <span>{row.games} games · {row.winRate}% score</span>
                </div>
              ))
            ) : (
              <p className="premiumEmpty">No obvious avoid list yet.</p>
            )}
          </div>
        </div>

        <div className="premiumPanel">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Weak-line finder</span>
              <h3>Lines costing you points</h3>
            </div>
            <span className="premiumBadge">Pro</span>
          </div>

          <div className={`premiumLockedArea ${!isPremiumDemo ? "isLocked" : ""}`}>
            <div className="premiumList">
              {weakLines.length ? (
                weakLines.map((line) => (
                  <div key={line.line} className="premiumLineItem">
                    <strong>{line.line}</strong>
                    <span>{line.games} games · {line.scoreRate}% score</span>
                  </div>
                ))
              ) : (
                <p className="premiumEmpty">
                  Weak-line tracking unlocks properly once there are repeated lines in your imported games.
                </p>
              )}
            </div>

            {!isPremiumDemo ? (
              <LockedOverlay title="Weak-line finder" onUnlock={togglePremiumDemo}>
                Find repeated opening lines where your score drops and turn them into training targets.
              </LockedOverlay>
            ) : null}
          </div>
        </div>

        <div className="premiumPanel premiumWide">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Stockfish coach</span>
              <h3>Engine-backed game review</h3>
            </div>
            <button className="premiumActionBtn" onClick={runStockfish} disabled={stockfishLoading}>
              {stockfishLoading ? "Analysing..." : "Analyse latest game"}
            </button>
          </div>

          <div className={`premiumLockedArea ${!isPremiumDemo ? "isLocked" : ""}`}>
            <p className="premiumPanelText">
              This connects premium to Stockfish. Locally it should work once Stockfish is installed.
              On the live backend, set <code>STOCKFISH_PATH</code> if needed.
            </p>

            {stockfishError ? <div className="premiumError">{stockfishError}</div> : null}

            {stockfishResult ? (
              <div className="premiumStockfishResult">
                <strong>{stockfishResult.summary}</strong>

                {stockfishResult.enabled === false ? (
                  <p>{stockfishResult.summary}</p>
                ) : null}

                {stockfishResult.mistakes?.length ? (
                  <div className="premiumList">
                    {stockfishResult.mistakes.slice(0, 5).map((mistake) => (
                      <div key={`${mistake.ply}-${mistake.played}`} className="premiumListItem danger">
                        <strong>
                          Move {mistake.moveNumber} · {mistake.side} played {mistake.played}
                        </strong>
                        <span>
                          {mistake.severity} · {mistake.centipawnLoss} centipawn loss
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="premiumEmpty">No major mistakes returned from the latest analysis.</p>
                )}
              </div>
            ) : null}

            {!isPremiumDemo ? (
              <LockedOverlay title="Stockfish coach" onUnlock={togglePremiumDemo}>
                Preview the premium coach panel. Engine analysis activates when Stockfish is available on the backend.
              </LockedOverlay>
            ) : null}
          </div>
        </div>

        <div className="premiumPanel">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Practice Pro</span>
              <h3>Training plan</h3>
            </div>
          </div>

          <div className={`premiumLockedArea ${!isPremiumDemo ? "isLocked" : ""}`}>
            <div className="premiumChecklist">
              <span>Train your weakest opening line first</span>
              <span>Repeat missed moves until learned</span>
              <span>Track repertoire confidence over time</span>
            </div>

            {!isPremiumDemo ? (
              <LockedOverlay title="Practice Pro" onUnlock={togglePremiumDemo}>
                Turn your weak openings into focused drills and track what you have learned.
              </LockedOverlay>
            ) : null}
          </div>
        </div>

        <div className="premiumPanel">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Reports</span>
              <h3>Exportable opening report</h3>
            </div>
          </div>

          <div className={`premiumLockedArea ${!isPremiumDemo ? "isLocked" : ""}`}>
            <div className="premiumChecklist">
              <span>Monthly OpeningFit report</span>
              <span>Repertoire summary</span>
              <span>Shareable improvement plan</span>
            </div>

            {!isPremiumDemo ? (
              <LockedOverlay title="Export reports" onUnlock={togglePremiumDemo}>
                Generate a clean opening report you can save, share, or use as your monthly training plan.
              </LockedOverlay>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
