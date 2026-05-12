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
    { key: "overview", label: "Overview" },
    { key: "recommendations", label: "Repertoire" },
    { key: "training", label: "Training" },
    { key: "games", label: "Games" },
    { key: "data", label: "Progress" },
    { key: "feedback", label: "Feedback" },
  ];

  if (typeof onViewChange !== "function") return null;

  return (
    <nav className="seriousTabs" aria-label="Opening Fit app sections">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`seriousTab ${activeView === tab.key ? "seriousTabActive" : ""}`}
          onClick={() => onViewChange(tab.key)}
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
