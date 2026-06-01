function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function openingName(opening) {
  if (typeof opening === "string") return opening;
  return (
    opening?.name ||
    opening?.opening ||
    opening?.openingName ||
    opening?.ecoName ||
    "Unknown Opening"
  );
}

function openingGames(opening) {
  if (typeof opening === "string") return 0;
  return safeNumber(opening?.games ?? opening?.count ?? opening?.total, 0);
}

function openingWinRate(opening) {
  if (!opening || typeof opening === "string") return 0;

  if (opening.win_rate !== undefined) return safeNumber(opening.win_rate, 0);
  if (opening.winRate !== undefined) return safeNumber(opening.winRate, 0);

  const games = safeNumber(opening.games, 0);
  const wins = safeNumber(opening.wins ?? opening.w, 0);
  const draws = safeNumber(opening.draws ?? opening.d, 0);

  if (!games) return 0;
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function isUnknownOpening(name = "") {
  const lower = String(name).toLowerCase().trim();
  return !lower || lower.includes("unknown") || lower.includes("uncommon");
}

function getOpenings(data) {
  const sources = [
    data?.top_openings,
    data?.best_openings,
    data?.preferred_white,
    data?.preferred_black,
  ];

  const merged = new Map();

  sources.forEach((source) => {
    if (!Array.isArray(source)) return;

    source.forEach((opening) => {
      const name = openingName(opening);
      if (isUnknownOpening(name)) return;

      const key = name.toLowerCase();
      const current = merged.get(key);
      const games = openingGames(opening);
      const winRate = openingWinRate(opening);

      if (!current || games > current.games || winRate > current.winRate) {
        merged.set(key, {
          name,
          games,
          winRate,
          wins: safeNumber(opening?.wins ?? opening?.w, 0),
          draws: safeNumber(opening?.draws ?? opening?.d, 0),
          losses: safeNumber(opening?.losses ?? opening?.l, 0),
        });
      }
    });
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.games - a.games;
  });
}

function buildShareText({ data, styleTitle, bestOpening, weakOpening }) {
  return [
    "My Opening Fit report:",
    data?.username ? `Player: ${data.username}` : null,
    styleTitle ? `Style: ${styleTitle}` : null,
    bestOpening ? `Best opening: ${bestOpening.name} (${bestOpening.winRate}%)` : null,
    weakOpening ? `Needs work: ${weakOpening.name} (${weakOpening.winRate}%)` : null,
    data?.total_games ? `Games analysed: ${data.total_games}` : null,
    "Try yours at Opening Fit",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function DashboardHome({
  data,
  fitData,
  onPractice,
  onViewChange,
  onFeedback,
}) {
  if (!data) return null;

  const openings = getOpenings(data);
  const bestOpening = fitData?.bestOpening
    ? {
        name: openingName(fitData.bestOpening),
        winRate: openingWinRate(fitData.bestOpening),
        games: openingGames(fitData.bestOpening),
      }
    : openings[0];

  const weakOpening = fitData?.weakestOpening
    ? {
        name: openingName(fitData.weakestOpening),
        winRate: openingWinRate(fitData.weakestOpening),
        games: openingGames(fitData.weakestOpening),
      }
    : [...openings].filter((item) => item.games > 0).sort((a, b) => a.winRate - b.winRate)[0];

  const styleTitle = fitData?.playerStyle?.title || data?.style_profile?.labels?.[0] || "Opening improver";

  const nextFocus = bestOpening
    ? `Build around ${bestOpening.name}, then repair your weakest recurring opening.`
    : "Import more games to unlock a stronger focus.";

  const nextChallenge = weakOpening
    ? `Review one recent loss in ${weakOpening.name}, then practise the first 6 moves.`
    : bestOpening
    ? `Play 5 more games using ${bestOpening.name} and re-import to check progress.`
    : "Import more games to generate your next challenge.";

  async function copyReport() {
    const text = buildShareText({ data, styleTitle, bestOpening, weakOpening });

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  return (
    <section className="dashboardHome">
      <div className="dashboardHeroTile">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Your Opening Fit home</h2>
          <p>
            Here is what Opening Fit found, what to practise next, and where to go
            after importing your games.
          </p>
        </div>

        <div className="dashboardHeroScore">
          <strong>{fitData?.overallScore || "—"}</strong>
          <span>fit score</span>
        </div>
      </div>

      <div className="dashboardTileGrid">
        <article className="dashboardTile primaryDashboardTile">
          <span className="dashboardTileLabel">Your style</span>
          <h3>{styleTitle}</h3>
          <p>
            {fitData?.playerStyle?.description ||
              data?.style_profile?.summary ||
              "Opening Fit will build a clearer style profile as you import more games."}
          </p>
        </article>

        <article className="dashboardTile">
          <span className="dashboardTileLabel">Best opening</span>
          <h3>{bestOpening?.name || "Not enough data"}</h3>
          <p>
            {bestOpening
              ? `${bestOpening.winRate}% score from ${bestOpening.games} games.`
              : "Your strongest opening will appear here after import."}
          </p>

          {bestOpening ? (
            <button type="button" onClick={() => onPractice(bestOpening.name)}>
              Practise best opening
            </button>
          ) : null}
        </article>

        <article className="dashboardTile">
          <span className="dashboardTileLabel">Weak spot</span>
          <h3>{weakOpening?.name || "Not enough data"}</h3>
          <p>
            {weakOpening
              ? `${weakOpening.winRate}% score. This is a good candidate for review.`
              : "Your weakest recurring opening will appear here."}
          </p>

          {weakOpening ? (
            <button type="button" onClick={() => onPractice(weakOpening.name)}>
              Practise weak spot
            </button>
          ) : null}
        </article>

        <article className="dashboardTile">
          <span className="dashboardTileLabel">Next focus</span>
          <h3>What to do next</h3>
          <p>{nextFocus}</p>

          <button type="button" onClick={() => onViewChange("repertoire")}>
            Open interactive tools
          </button>
        </article>
      </div>

      <div className="dashboardActionStrip">
        <div>
          <span>Next challenge</span>
          <strong>{nextChallenge}</strong>
        </div>

        <div className="dashboardActionButtons">
          {bestOpening ? (
            <button type="button" onClick={() => onPractice(bestOpening.name)}>
              Practise now
            </button>
          ) : null}

          <button type="button" onClick={() => onViewChange("train")}>
            Training plan
          </button>

          <button type="button" onClick={copyReport}>
            Copy report
          </button>

          <button type="button" onClick={onFeedback}>
            Send feedback
          </button>
        </div>
      </div>
    </section>
  );
}
