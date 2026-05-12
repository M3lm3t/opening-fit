import { useMemo } from "react";

function getOpeningName(opening) {
  return (
    opening?.name ||
    opening?.opening ||
    opening?.eco_name ||
    opening?.label ||
    "Unknown opening"
  );
}

function getGames(opening) {
  return Number(opening?.games ?? opening?.count ?? opening?.total ?? 0);
}

function getWinRate(opening) {
  const direct = opening?.winRate ?? opening?.win_rate ?? opening?.score ?? opening?.percentage;

  if (typeof direct === "number") {
    return direct <= 1 ? Math.round(direct * 100) : Math.round(direct);
  }

  const wins = Number(opening?.wins ?? opening?.w ?? 0);
  const draws = Number(opening?.draws ?? opening?.d ?? 0);
  const games = getGames(opening);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function isKnownOpening(opening) {
  const name = getOpeningName(opening).toLowerCase();
  return !["unknown", "unknown opening", "uncommon opening", "other"].includes(name.trim());
}

function pickTopOpenings(data) {
  const candidates = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
  ].filter(isKnownOpening);

  const unique = [];
  const seen = new Set();

  for (const opening of candidates) {
    const name = getOpeningName(opening);
    if (!seen.has(name)) {
      seen.add(name);
      unique.push(opening);
    }
  }

  return unique;
}

export function SeriousAppTabs({ activeView, onViewChange }) {
  const tabs = [
    { key: "overview", label: "Overview", target: "coach-summary" },
    { key: "recommendations", label: "Repertoire", target: "premium-value" },
    { key: "training", label: "Training", target: "next-actions" },
    { key: "games", label: "Games", target: "game-replay" },
    { key: "data", label: "Progress", target: "report-history" },
    { key: "feedback", label: "Feedback", target: "feedback" },
  ];

  const handleTabClick = (tab) => {
    if (typeof onViewChange === "function") {
      onViewChange(tab.key);
    }

    setTimeout(() => {
      const target =
        document.getElementById(tab.target) ||
        document.querySelector(`[data-section="${tab.key}"]`) ||
        document.querySelector(`#${tab.key}`);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 80);
  };

  return (
    <nav className="seriousTabs" aria-label="Opening Fit app sections">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`seriousTab ${activeView === tab.key ? "seriousTabActive" : ""}`}
          onClick={() => handleTabClick(tab)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function CoachSummaryCard({ data, onViewChange }) {
  const summary = useMemo(() => {
    const openings = pickTopOpenings(data);
    const sortedByGames = [...openings].sort((a, b) => getGames(b) - getGames(a));
    const sortedByWinRate = [...openings]
      .filter((opening) => getGames(opening) >= 2)
      .sort((a, b) => getWinRate(b) - getWinRate(a));

    const best = sortedByWinRate[0] || sortedByGames[0];
    const worst = [...sortedByWinRate].reverse()[0] || sortedByGames[1] || sortedByGames[0];
    const main = sortedByGames[0] || best;

    const gamesImported =
      data?.games_imported ||
      data?.gamesImported ||
      data?.total_games ||
      data?.game_count ||
      data?.games?.length ||
      0;

    const username =
      data?.username ||
      data?.player ||
      data?.player_name ||
      data?.profile?.username ||
      "your games";

    const styleLabel =
      data?.style_profile?.label ||
      data?.style?.label ||
      data?.player_style ||
      data?.styleProfile?.label ||
      "Practical improver";

    return {
      openings,
      best,
      worst,
      main,
      gamesImported,
      username,
      styleLabel,
    };
  }, [data]);

  if (!data) return null;

  const bestName = summary.best ? getOpeningName(summary.best) : "Not enough data yet";
  const worstName = summary.worst ? getOpeningName(summary.worst) : "Not enough data yet";
  const mainName = summary.main ? getOpeningName(summary.main) : "your current repertoire";
  const bestRate = summary.best ? getWinRate(summary.best) : 0;
  const worstRate = summary.worst ? getWinRate(summary.worst) : 0;

  return (
    <section className="coachSummaryShell" id="coach-summary">
      <div className="coachSummaryHero">
        <div>
          <p className="eyebrow">Opening Fit Report</p>
          <h2>Your personal opening coach</h2>
          <p>
            Based on {summary.gamesImported || "your recent"} games for{" "}
            <strong>{summary.username}</strong>, your current profile looks like a{" "}
            <strong>{summary.styleLabel}</strong>. The next step is to stop treating all
            openings equally and focus on the ones that actually move your results.
          </p>
        </div>

        <div className="coachScoreCard">
          <span>Opening focus</span>
          <strong>{mainName}</strong>
          <small>Start here before adding more theory.</small>
        </div>
      </div>

      <div className="coachInsightGrid">
        <article className="coachInsightCard positive">
          <span>Keep</span>
          <h3>{bestName}</h3>
          <p>
            Your strongest current signal. {bestRate ? `Approx. ${bestRate}% score.` : "Needs more games to confirm."}
          </p>
        </article>

        <article className="coachInsightCard warning">
          <span>Improve</span>
          <h3>{worstName}</h3>
          <p>
            This is the first area to review. {worstRate ? `Approx. ${worstRate}% score.` : "The sample is still small."}
          </p>
        </article>

        <article className="coachInsightCard premium">
          <span>Next action</span>
          <h3>Build a tighter repertoire</h3>
          <p>
            Pick one White system, one answer to 1.e4, and one answer to 1.d4. Do not add
            more openings until these improve.
          </p>
        </article>
      </div>

      <div className="coachActionRow">
        <button
          type="button"
          className="primaryCoachButton"
          onClick={() => typeof onViewChange === "function" && onViewChange("recommendations")}
        >
          View repertoire plan
        </button>

        <button
          type="button"
          className="secondaryCoachButton"
          onClick={() => typeof onViewChange === "function" && onViewChange("training")}
        >
          Start training focus
        </button>
      </div>
    </section>
  );
}

export function SeriousPremiumStrip() {
  return (
    <section className="seriousPremiumStrip" id="premium-value">
      <div>
        <p className="eyebrow">Premium direction</p>
        <h2>Make premium feel like a training system, not extra charts.</h2>
      </div>

      <div className="premiumMiniGrid">
        <div>
          <strong>Saved history</strong>
          <span>Track reports over time.</span>
        </div>
        <div>
          <strong>Weakness diagnosis</strong>
          <span>Know what is costing points.</span>
        </div>
        <div>
          <strong>Repertoire builder</strong>
          <span>White, vs 1.e4, vs 1.d4.</span>
        </div>
        <div>
          <strong>Export report</strong>
          <span>Shareable training PDF later.</span>
        </div>
      </div>
    </section>
  );
}


export function NextBestActions({ data, onViewChange }) {
  if (!data) return null;

  const openings = pickTopOpenings(data);
  const sortedByGames = [...openings].sort((a, b) => getGames(b) - getGames(a));
  const sortedByWinRate = [...openings]
    .filter((opening) => getGames(opening) >= 2)
    .sort((a, b) => getWinRate(a) - getWinRate(b));

  const mostPlayed = sortedByGames[0];
  const weakest = sortedByWinRate[0];
  const strongest = [...sortedByWinRate].reverse()[0];

  const mostPlayedName = mostPlayed ? getOpeningName(mostPlayed) : "your most common opening";
  const weakestName = weakest ? getOpeningName(weakest) : "your lowest scoring opening";
  const strongestName = strongest ? getOpeningName(strongest) : "your strongest opening";

  const actionCards = [
    {
      label: "Step 1",
      title: `Review ${weakestName}`,
      text: "This is the first place to look for free rating gains. Check whether you are losing early, drifting into bad structures, or simply playing unfamiliar positions.",
      button: "Open training",
      view: "training",
      target: "next-actions",
    },
    {
      label: "Step 2",
      title: `Keep building around ${strongestName}`,
      text: "Do not abandon what is working. Your best openings should become the spine of your repertoire before adding new theory.",
      button: "View repertoire",
      view: "recommendations",
      target: "premium-value",
    },
    {
      label: "Step 3",
      title: `Simplify ${mostPlayedName}`,
      text: "Your most played opening needs a clear plan: main idea, common pawn breaks, typical piece setup, and one fallback line.",
      button: "Check progress",
      view: "data",
      target: "report-history",
    },
  ];

  const handleAction = (action) => {
    if (typeof onViewChange === "function") {
      onViewChange(action.view);
    }

    setTimeout(() => {
      const target = document.getElementById(action.target);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
  };

  return (
    <section className="nextBestActions" id="next-actions">
      <div className="nextBestHeader">
        <div>
          <p className="eyebrow">Next best actions</p>
          <h2>What you should do next</h2>
          <p>
            A serious chess tool should not just show numbers. It should turn your games
            into a small, clear training plan.
          </p>
        </div>
      </div>

      <div className="nextActionGrid">
        {actionCards.map((action) => (
          <article className="nextActionCard" key={action.label}>
            <span>{action.label}</span>
            <h3>{action.title}</h3>
            <p>{action.text}</p>
            <button type="button" onClick={() => handleAction(action)}>
              {action.button}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
