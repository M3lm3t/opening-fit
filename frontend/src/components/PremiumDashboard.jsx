import { useMemo, useState } from "react";
import "./PremiumDashboard.css";
import {
  canGiveAvoidVerdict,
  getSmartPlayerLevelProfile,
  isAdvancedOrStrongerLevel,
} from "./playerLevelLogic";
import { getOpeningRecommendationReason } from "./openingCopy";
import { buildApiUrl } from "../lib/apiBase";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function normaliseOpeningName(row) {
  return (
    row?.opening ||
    row?.name ||
    row?.ecoName ||
    row?.eco_name ||
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
      : asArray(data?.recent_games).length
      ? asArray(data.recent_games)
      : asArray(data?.sampleGames).length
      ? asArray(data.sampleGames)
      : []
  );
}

function getOpeningRows(data) {
  const candidates = [
    data?.topOpenings,
    data?.top_openings,
    data?.openingStats,
    data?.opening_stats,
    data?.openings,
    data?.openingWinRates,
    data?.opening_win_rates,
    data?.openingBreakdown,
    data?.opening_breakdown,
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
  const direct = row?.winRate ?? row?.win_rate ?? row?.score ?? row?.scoreRate ?? row?.score_rate;

  if (direct !== undefined && direct !== null && direct !== "") {
    const value = safeNumber(direct);
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
  }

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
  const level = getSmartPlayerLevelProfile(data).level;
  const advancedOrHigher = isAdvancedOrStrongerLevel(level);
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
    .filter((row) =>
      advancedOrHigher
        ? row.winRate < 55 && !canGiveAvoidVerdict({ level, games: row.games, score: row.winRate })
        : row.winRate > 35 && row.winRate < 55
    )
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);

  const avoid = [...pool]
    .filter((row) =>
      !advancedOrHigher && canGiveAvoidVerdict({ level, games: row.games, score: row.winRate })
    )
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


function LockedOverlay({ title = "Founder Pass unlock", children, onUnlock, actionLabel = "Pricing" }) {
  return (
    <div className="premiumLockedOverlay">
      <div className="premiumLockIcon">🔒</div>
      <strong>{title}</strong>
      <p>{children || "Save this analysis, compare progress, and turn weak lines into a clearer repertoire plan."}</p>
      <button className="premiumUnlockBtn" type="button" onClick={onUnlock}>
        {actionLabel}
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

function buildWeeklyPlan(repertoire, weakLines) {
  const best = repertoire.mainWhite?.openingName || repertoire.keep?.[0]?.openingName || "your most reliable opening";
  const weak = repertoire.avoid?.[0]?.openingName || repertoire.improve?.[0]?.openingName || "your weakest recurring opening";
  const line = weakLines?.[0]?.line || `the first 6 moves of ${weak}`;

  return [
    {
      day: "Day 1",
      title: `Lock in ${best}`,
      text: "Replay one clean win or high-scoring game and write down the setup you want to repeat.",
      opening: best,
    },
    {
      day: "Day 2",
      title: `Repair ${weak}`,
      text: "Review one loss and identify the first move where your position became hard to play.",
      opening: weak,
    },
    {
      day: "Day 3",
      title: "Drill the weak line",
      text: `Practise ${line}. Repeat it until the plan feels natural, not memorised.`,
      opening: weak,
    },
    {
      day: "Day 4",
      title: "Play a focused block",
      text: `Use ${best} only in the side/context where your report shows you actually play it, and avoid adding new sidelines for this session.`,
      opening: best,
    },
    {
      day: "Day 5",
      title: "Update the repertoire",
      text: "Keep one opening, repair one branch, and park one low-confidence experiment until you have more data.",
      opening: weak,
    },
  ];
}

function normaliseName(value) {
  return String(value || "openingfit")
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export default function PremiumDashboard({
  data,
  username,
  isPremium = false,
  onFounderPass,
  onUnlockDemo,
  onPractice,
}) {
  const [isPremiumPreview, setIsPremiumPreview] = useState(false);
  const [stockfishLoading, setStockfishLoading] = useState(false);
  const [stockfishResult, setStockfishResult] = useState(null);
  const [stockfishError, setStockfishError] = useState("");

  const repertoire = useMemo(() => buildRepertoire(data), [data]);
  const weakLines = useMemo(() => buildWeakLines(data), [data]);
  const games = useMemo(() => getGames(data), [data]);
  const weeklyPlan = useMemo(() => buildWeeklyPlan(repertoire, weakLines), [repertoire, weakLines]);
  const premiumActive = Boolean(isPremium);

  const totalGames =
    safeNumber(data?.gamesImported) ||
    safeNumber(data?.games_imported) ||
    safeNumber(data?.totalGames) ||
    safeNumber(data?.total_games) ||
    safeNumber(data?.gamesCount) ||
    safeNumber(data?.game_count) ||
    games.length;

  const openingRows = getOpeningRows(data);
  const trackedOpenings = openingRows.length;

  const bestOpening = repertoire.keep?.[0];
  const weakestOpening = repertoire.avoid?.[0] || repertoire.improve?.[0];

  const latestGameWithPgn = games.find((game) => game?.pgn);
  const openingIntelligence =
    stockfishResult?.openingIntelligence || stockfishResult?.suggestion?.openingIntelligence;
  const stockfishEngine = stockfishResult?.stockfishEngine || stockfishResult?.suggestion?.stockfishEngine;

  const togglePremiumDemo = () => {
    if (isPremium || !import.meta.env.DEV) return;
    setIsPremiumPreview((value) => !value);
  };

  const unlockAction = () => {
    if (typeof onFounderPass === "function") {
      onFounderPass();
      return;
    }

    if (typeof onUnlockDemo === "function") {
      onUnlockDemo();
      return;
    }

    togglePremiumDemo();
  };

  const buildPremiumReportText = () => {
    const lines = [
      `Opening Fit Premium Report`,
      `Player: ${username || data?.username || data?.playerName || "Unknown player"}`,
      `Games reviewed: ${totalGames || "Unknown"}`,
      ``,
      `Repertoire`,
      `- Main White weapon: ${repertoire.mainWhite?.openingName || "Needs more data"}`,
      `- Backup White option: ${repertoire.backupWhite?.openingName || "Needs more data"}`,
      `- Black vs 1.e4: ${repertoire.blackVsE4?.openingName || "Needs more black games"}`,
      `- Black vs 1.d4: ${repertoire.blackVsD4?.openingName || "Needs more black games"}`,
      ``,
      `Keep`,
      ...(repertoire.keep.length
        ? repertoire.keep.map((row) => `- ${row.openingName}: ${row.games} games, ${row.winRate}% score`)
        : ["- No clear keep list yet."]),
      ``,
      `Repair`,
      ...(repertoire.improve.length || repertoire.avoid.length
        ? [...repertoire.improve, ...repertoire.avoid].map((row) => `- ${row.openingName}: ${row.games} games, ${row.winRate}% score`)
        : ["- No clear repair target yet."]),
      ``,
      `Weekly plan`,
      ...weeklyPlan.map((step) => `- ${step.day}: ${step.title}. ${step.text}`),
    ];

    return lines.join("\n");
  };

  const downloadPremiumReport = () => {
    if (!premiumActive) {
      unlockAction();
      return;
    }

    const blob = new Blob([buildPremiumReportText()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `openingfit-premium-${normaliseName(username || data?.username)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const copyWeeklyPlan = async () => {
    if (!premiumActive) {
      unlockAction();
      return;
    }

    const text = weeklyPlan.map((step) => `${step.day}: ${step.title} - ${step.text}`).join("\n");

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.alert(text);
    }
  };

  const runStockfish = async () => {
    if (!premiumActive) {
      setStockfishError("Engine-assisted diagnosis is coming soon and only runs when backend support is available.");
      return;
    }

    setStockfishLoading(true);
    setStockfishError("");
    setStockfishResult(null);

    try {
      if (!latestGameWithPgn?.pgn) {
        throw new Error("No PGN game found yet. Import games first, then try Stockfish analysis.");
      }

      const response = await fetch(buildApiUrl("/api/openingfit/analyse-position"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pgn: latestGameWithPgn.pgn,
          depth: 8,
          maxMoves: 24,
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
    <section className="premiumDashboard" id="premium-workspace">
      <div className="premiumHero">
        <div>
          <span className="premiumEyebrow">
            {isPremium ? "Founder Pass active" : isPremiumPreview ? "Audit preview" : "Founder Pass"}
          </span>
          <h2>See which openings are improving.</h2>
          <p>Save reports, compare progress, track weak lines, and build a personal repertoire plan.</p>
        </div>

        <div className="premiumPriceCard">
          <span>{isPremium ? "Unlocked" : "Founder Pass"}</span>
          <strong>£8 one-time</strong>
          <small>
            {isPremium
              ? "Saved reports and progress tracking are active."
              : "Upgrade to save reports and compare progress."}
          </small>

          {!isPremium ? (
            <>
              <button className="premiumCheckoutButton" type="button" onClick={unlockAction}>
                Pricing
              </button>
              <small className="premiumActionMicrocopy">One-time Founder Pass. No subscription.</small>
              {import.meta.env.DEV ? <button className="premiumDemoToggle" type="button" onClick={togglePremiumDemo}>
                {isPremiumPreview ? "Preview on" : "Preview premium"}
              </button> : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="premiumCommandStrip">
        <button type="button" onClick={downloadPremiumReport}>
          Export study plan
        </button>
        <button type="button" onClick={copyWeeklyPlan}>
          Copy weekly plan
        </button>
        <button type="button" onClick={() => onPractice?.(repertoire.mainWhite?.openingName || repertoire.keep?.[0]?.openingName)}>
          Practise side-specific line
        </button>
        <button type="button" onClick={() => onPractice?.(repertoire.avoid?.[0]?.openingName || repertoire.improve?.[0]?.openingName)}>
          Drill repair target
        </button>
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
              <span className="premiumEyebrow">Repertoire plan</span>
              <h3>Your suggested opening setup</h3>
            </div>
            <span className="premiumBadge">Founder Pass</span>
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
              <span className="premiumEyebrow">Improve</span>
              <h3>Openings to review carefully</h3>
            </div>
          </div>

          <div className="premiumList">
            {repertoire.avoid.length ? (
              repertoire.avoid.map((row) => {
                const priorityReason = getOpeningRecommendationReason(row, row, data?.styleProfile || data?.style_profile || data || {}, {
                  averageOpeningScore: data?.averageOpeningScore || data?.average_opening_score,
                  alternatives: repertoire.keep,
                  activeOpenings: [...repertoire.keep, ...repertoire.improve],
                });

                return (
                  <div key={`avoid-${row.openingName}`} className="premiumListItem priority">
                    <strong>{row.openingName}</strong>
                    <span>{row.games} games · {row.winRate}% score</span>
                    <em>{priorityReason.label}</em>
                    <small>{priorityReason.reason}</small>
                    <small>{priorityReason.action}</small>
                  </div>
                );
              })
            ) : (
              <p className="premiumEmpty">No obvious avoid list yet.</p>
            )}
          </div>
        </div>

        <div className="premiumPanel">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Weak-line tracking</span>
              <h3>Lines to repair over time</h3>
            </div>
            <span className="premiumBadge">Pro</span>
          </div>

          <div className={`premiumLockedArea ${!premiumActive ? "isLocked" : ""}`}>
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
                  Repeated weak lines will appear here.
                </p>
              )}
            </div>

            {!premiumActive ? (
              <LockedOverlay title="Weak-line tracking" onUnlock={unlockAction}>
                Track repeated opening lines where your score drops and turn them into training targets.
              </LockedOverlay>
            ) : null}
          </div>
        </div>

        <div className="premiumPanel premiumWide">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Coming soon</span>
              <h3>Engine-assisted opening diagnosis</h3>
            </div>
            <button className="premiumActionBtn" onClick={runStockfish} disabled={stockfishLoading}>
              {stockfishLoading ? "Analysing..." : "Analyse latest game"}
            </button>
          </div>

          <div className={`premiumLockedArea ${!premiumActive ? "isLocked" : ""}`}>
            <p className="premiumPanelText">
              Coming soon: engine-assisted review for clearer opening diagnosis when backend support is available.
            </p>

            {stockfishError ? <div className="premiumError">{stockfishError}</div> : null}

            {stockfishResult ? (
              <div className="premiumStockfishResult">
                <strong>{stockfishResult.suggestion?.summary || stockfishResult.summary}</strong>

                {openingIntelligence ? (
                  <div className="premiumList">
                    <div className="premiumListItem">
                      <strong>Opening intelligence</strong>
                      <span>{openingIntelligence.summary}</span>
                    </div>
                    {(openingIntelligence.typicalPlans || []).slice(0, 3).map((plan) => (
                      <div key={plan} className="premiumListItem">
                        <strong>{openingIntelligence.repertoireBucket}</strong>
                        <span>{plan}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {stockfishEngine ? (
                  <div className="premiumList">
                    <div className="premiumListItem">
                      <strong>Stockfish engine</strong>
                      <span>{stockfishEngine.summary}</span>
                    </div>
                  </div>
                ) : stockfishResult.engineResult?.enabled === false ? (
                  <p>{stockfishResult.engineResult.reason}</p>
                ) : null}

                {!openingIntelligence && stockfishResult.openingFamily?.themes?.length ? (
                  <div className="premiumList">
                    {stockfishResult.openingFamily.themes.slice(0, 3).map((theme) => (
                      <div key={theme} className="premiumListItem">
                        <strong>{stockfishResult.openingFamily.family}</strong>
                        <span>{theme}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="premiumEmpty">No clear opening-family themes returned from the latest analysis.</p>
                )}
              </div>
            ) : null}

            {!premiumActive ? (
              <LockedOverlay title="Coming soon" onUnlock={unlockAction}>
                Founder Pass includes early access as deeper diagnosis tools are added.
              </LockedOverlay>
            ) : null}
          </div>
        </div>

        <div className="premiumPanel">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Personal opening coach</span>
              <h3>Weekly repertoire plan</h3>
            </div>
          </div>

          <div className={`premiumLockedArea ${!premiumActive ? "isLocked" : ""}`}>
            <div className="premiumWeeklyPlan">
              {weeklyPlan.map((step) => (
                <article key={step.day}>
                  <span>{step.day}</span>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                  {step.opening ? (
                    <button type="button" onClick={() => onPractice?.(step.opening)}>
                      Practise
                    </button>
                  ) : null}
                </article>
              ))}
            </div>

            {!premiumActive ? (
              <LockedOverlay title="Weekly repertoire plan" onUnlock={unlockAction}>
                Get a focused weekly plan built from your strengths, weak lines, and repertoire roles.
              </LockedOverlay>
            ) : null}
          </div>
        </div>

        <div className="premiumPanel">
          <div className="premiumPanelHeader">
            <div>
              <span className="premiumEyebrow">Reports</span>
              <h3>Saved opening report</h3>
            </div>
          </div>

          <div className={`premiumLockedArea ${!premiumActive ? "isLocked" : ""}`}>
            <div className="premiumChecklist">
              <span>Save every report and compare progress</span>
              <span>Repertoire summary and repair list</span>
              <span>Shareable weekly improvement plan</span>
              <button type="button" className="premiumActionBtn" onClick={downloadPremiumReport}>
                Export report
              </button>
            </div>

            {!premiumActive ? (
              <LockedOverlay title="Export reports" onUnlock={unlockAction}>
                Generate a clean report you can save, compare, or use as your weekly training plan.
              </LockedOverlay>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
