import { getPlayerLevelText } from "./playerLevelLogic";
import { getOpeningSignal } from "./OpeningEvidence";

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

function getRating(data) {
  const values = [
    data?.rating,
    data?.chesscomRating,
    data?.chesscom_rating,
    data?.lichessRating,
    data?.lichess_rating,
    data?.rapidRating,
    data?.rapid_rating,
    data?.blitzRating,
    data?.blitz_rating,
    data?.player_level?.rating,
    data?.playerLevel?.rating,
  ]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 100 && value < 3500);

  return values.length ? Math.max(...values) : 0;
}

function getPlayerTier(data) {
  const rating = getRating(data);
  const level = getPlayerLevelText(data).toLowerCase();
  const title = String(
    data?.title ??
      data?.chessTitle ??
      data?.chess_title ??
      data?.fideTitle ??
      data?.fide_title ??
      data?.playerTitle ??
      data?.player_title ??
      data?.profile?.title ??
      ""
  )
    .trim()
    .toLowerCase();

  return (
    rating >= 2500 ||
    ["gm", "im", "fm", "cm", "wgm", "wim", "wfm", "wcm"].includes(title) ||
    level.includes("master") ||
    level.includes("elite")
  )
    ? "elite"
    : rating >= 2200 || level.includes("expert")
    ? "strong"
    : rating >= 1600 || level.includes("advanced")
    ? "club"
    : "developing";
}

function isStrongProfile(data) {
  const tier = getPlayerTier(data);
  return tier === "elite" || tier === "strong";
}

function getReportMode(data) {
  const direct = data?.reportMode || data?.report_mode;
  if (["normal_user", "high_rated_user", "public_account_possible"].includes(direct)) return direct;
  if (isStrongProfile(data)) return "high_rated_user";
  return "normal_user";
}

function isPublicMode(data) {
  return getReportMode(data) !== "normal_user";
}

function publicCaution(data) {
  return (
    data?.publicAccountCaution ||
    data?.public_account_caution ||
    "This appears to be a high-level or public account. OpeningFit is analysing recent online results only, not judging the player's actual opening knowledge."
  );
}

function verdictFor(item, data, index = 0) {
  const verdict = String(item?.verdict || "").toLowerCase();
  const tier = getPlayerTier(data);
  const publicMode = isPublicMode(data);
  const strongProfile = tier === "elite" || tier === "strong";
  const games = getGames(item);
  const winRate = getWinRate(item);
  const signal = getOpeningSignal(item);
  const mainOpening = index <= 2 && signal.tier === "strong";

  if (publicMode && !signal.canBePrimary) return "Not enough context to judge";
  if (publicMode && (verdict.includes("avoid") || verdict.includes("review"))) return "Recent underperformer";
  if (publicMode && (verdict.includes("improve") || verdict.includes("promising"))) return "Lower-scoring sample";
  if (publicMode && (verdict.includes("keep") || verdict.includes("reliable"))) return "Recent strength";

  if (verdict.includes("main weapon") || verdict.includes("core") || verdict.includes("trusted")) return "Main weapon";
  if (verdict.includes("keep") || verdict.includes("reliable")) return "Reliable choice";
  if (verdict.includes("promising") || verdict.includes("fine") || verdict.includes("improve")) return "Promising but unstable";
  if (verdict.includes("review") || verdict.includes("performance") || verdict.includes("avoid")) return "Needs review";

  if (signal.tier === "none") return "No reliable data";
  if (signal.tier === "low") return "Too few games";

  if ((tier === "elite" || tier === "strong") && mainOpening && winRate >= 45) return "Main weapon";
  if (strongProfile && mainOpening && winRate >= 35) return publicMode ? "Lower-scoring sample" : "Promising but unstable";
  if (strongProfile && winRate < 45) return publicMode ? "Recent underperformer" : "Needs review";
  if (strongProfile) return publicMode ? "Recent strength" : "Reliable choice";

  if (winRate >= 58) return "Reliable choice";
  if (winRate >= 45) return "Promising but unstable";
  return "Needs review";
}

function pickByVerdict(openings, target, data) {
  return openings.find((item, index) => verdictFor(item, data, index) === target);
}

function buildSummary(data, username) {
  const openings = getArray(data?.top_openings, data?.opening_stats, data?.openings);
  const top = openings[0];
  const strongProfile = isStrongProfile(data);
  const publicMode = isPublicMode(data);
  const keep = pickByVerdict(openings, "Main weapon", data) || pickByVerdict(openings, "Reliable choice", data) || top;
  const improve =
    pickByVerdict(openings, "Lower-scoring sample", data) ||
    pickByVerdict(openings, "Recent underperformer", data) ||
    pickByVerdict(openings, "Promising but unstable", data) ||
    pickByVerdict(openings, "Needs review", data) ||
    openings[1];
  const avoid = pickByVerdict(openings, "Needs review", data) || openings[2];

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

  return { openings, top, keep, improve, avoid, style, games, score, username, strongProfile, publicMode };
}

export default function OpeningFitReportHero({ data, username, onJump }) {
  if (!data) return null;

  const report = buildSummary(data, username);
  const scoreText = report.score ? Math.round(Number(report.score)) : Math.min(92, Math.max(61, 70 + report.openings.length * 2));

  const shareText = report.publicMode
    ? `OpeningFit flags ${getName(report.keep)} as a recent strength and ${getName(report.improve)} as a lower-scoring recent sample.`
    : report.strongProfile
    ? `My OpeningFit report says ${getName(report.keep)} is a core opening and ${getName(report.improve)} is worth reviewing.`
    : `My OpeningFit report says I should keep ${getName(report.keep)}, improve ${getName(report.improve)}, and review ${getName(report.avoid)}.`;

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
            {report.publicMode
              ? publicCaution(data)
              : report.strongProfile
              ? "A repertoire audit built from recent games, highlighting core weapons, trend changes, and lines worth reviewing."
              : "A simple report built from your recent games, showing what to keep, what needs work, and where your opening study should go next."}
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
          <span>{report.publicMode ? "Recent strength" : "Best fit"}</span>
          <strong>{getName(report.keep)}</strong>
          <p>
            {getWinRate(report.keep) !== null ? `${getWinRate(report.keep)}% score` : "Strongest current signal"}
            {getGames(report.keep) ? ` across ${getGames(report.keep)} games.` : "."}
          </p>
        </article>

        <article>
          <span>{report.publicMode ? "Lower-scoring sample" : report.strongProfile ? "Review target" : "Biggest study target"}</span>
          <strong>{getName(report.improve)}</strong>
          <p>
            {report.strongProfile
              ? "Compare the trend by time control, opponent pool, and game context before drawing conclusions."
              : "This is the best place to gain rating without rebuilding everything."}
          </p>
        </article>

        <article>
          <span>{report.publicMode ? "Experimental/content-game possible" : "Review carefully"}</span>
          <strong>{getName(report.avoid)}</strong>
          <p>
            {report.strongProfile
              ? "Treat this as a recent online trend signal, not a hard opening verdict."
              : "Low-confidence or poor-result openings should be simplified."}
          </p>
        </article>
      </div>

      <div className="ofActionStrip">
        <button type="button" onClick={() => onJump?.("keep-improve-avoid")}>
          {report.publicMode ? "View recent trends" : "View keep / improve / avoid"}
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
