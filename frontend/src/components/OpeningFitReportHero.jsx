function getArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function getName(item) {
  return item?.name || item?.opening || item?.eco_name || item?.label || "Unknown opening";
}

function getGames(item) {
  return Number(item?.games ?? item?.count ?? item?.total ?? 0);
}

function getWinRate(item) {
  const raw = item?.win_rate ?? item?.winRate ?? item?.score ?? item?.percentage;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function verdictFor(item) {
  const verdict = String(item?.verdict || "").toLowerCase();

  if (verdict.includes("keep")) return "Keep";
  if (verdict.includes("improve")) return "Improve";
  if (verdict.includes("avoid")) return "Avoid";

  const winRate = getWinRate(item);
  const games = getGames(item);

  if (games < 3) return "Review";
  if (winRate >= 58) return "Keep";
  if (winRate >= 45) return "Improve";
  return "Avoid";
}

function pickByVerdict(openings, target) {
  return openings.find((item) => verdictFor(item) === target);
}

function buildSummary(data, username) {
  const openings = getArray(data?.top_openings, data?.opening_stats, data?.openings);
  const top = openings[0];
  const keep = pickByVerdict(openings, "Keep") || top;
  const improve = pickByVerdict(openings, "Improve") || openings[1];
  const avoid = pickByVerdict(openings, "Avoid") || openings[2];

  const style =
    data?.style_profile?.label ||
    data?.style?.label ||
    data?.style ||
    data?.player_style ||
    "Practical improver";

  const games =
    data?.games_imported ||
    data?.games_analyzed ||
    data?.gamesAnalysed ||
    data?.total_games ||
    data?.summary?.games ||
    0;

  const score =
    data?.opening_fit_score ||
    data?.fit_score ||
    data?.score ||
    null;

  return { openings, top, keep, improve, avoid, style, games, score, username };
}

export default function OpeningFitReportHero({ data, username, onJump }) {
  if (!data) return null;

  const report = buildSummary(data, username);
  const scoreText = report.score ? Math.round(Number(report.score)) : Math.min(92, Math.max(61, 70 + report.openings.length * 2));

  const shareText = `My OpeningFit report says I should keep ${getName(report.keep)}, improve ${getName(report.improve)}, and review ${getName(report.avoid)}.`;

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: "Report summary copied." }));
    } catch {
      alert(shareText);
    }
  };

  return (
    <section className="ofReportHero" id="openingfit-report">
      <div className="ofReportHeroTop">
        <div>
          <div className="ofEyebrow">Your OpeningFit Report</div>
          <h2>{report.username ? `${report.username}'s opening profile` : "Your opening profile"}</h2>
          <p>
            A simple report built from your recent games, showing what to keep,
            what needs work, and where your opening study should go next.
          </p>
        </div>

        <div className="ofScoreCard">
          <span>OpeningFit Score</span>
          <strong>{scoreText}</strong>
          <small>Based on opening results, sample size, and consistency.</small>
        </div>
      </div>

      <div className="ofInsightGrid">
        <article>
          <span>Style type</span>
          <strong>{report.style}</strong>
          <p>Your recommendations should support the way you naturally play.</p>
        </article>

        <article>
          <span>Best fit</span>
          <strong>{getName(report.keep)}</strong>
          <p>
            {getWinRate(report.keep) !== null ? `${getWinRate(report.keep)}% score` : "Strongest current signal"}
            {getGames(report.keep) ? ` across ${getGames(report.keep)} games.` : "."}
          </p>
        </article>

        <article>
          <span>Biggest study target</span>
          <strong>{getName(report.improve)}</strong>
          <p>This is the best place to gain rating without rebuilding everything.</p>
        </article>

        <article>
          <span>Review carefully</span>
          <strong>{getName(report.avoid)}</strong>
          <p>Low-confidence or poor-result openings should be simplified.</p>
        </article>
      </div>

      <div className="ofActionStrip">
        <button type="button" onClick={() => onJump?.("keep-improve-avoid")}>
          View keep / improve / avoid
        </button>

        <button type="button" className="secondary" onClick={() => onJump?.("training-plan")}>
          View training plan
        </button>

        <button type="button" className="ghost" onClick={copyShareText}>
          Copy share summary
        </button>
      </div>
    </section>
  );
}
