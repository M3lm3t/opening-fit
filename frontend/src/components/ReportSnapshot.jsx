import "./ReportSnapshot.css";
import { getPlayerLevelText } from "./playerLevelLogic";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getOpeningName(item, fallback = "Not enough data yet") {
  return (
    item?.name ||
    item?.opening ||
    item?.eco_name ||
    item?.label ||
    item?.title ||
    fallback
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

function getGames(item) {
  return toNumber(item?.games ?? item?.count ?? item?.total ?? item?.played, 0);
}

function sortByGamesAndWinRate(openings = []) {
  return [...openings].sort((a, b) => {
    const gameDiff = getGames(b) - getGames(a);
    if (gameDiff !== 0) return gameDiff;

    const aWin = getWinRate(a) ?? 0;
    const bWin = getWinRate(b) ?? 0;
    return bWin - aWin;
  });
}

function findBestFit(data) {
  const candidates = [
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
  ];

  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const aWin = getWinRate(a) ?? 0;
    const bWin = getWinRate(b) ?? 0;
    const aGames = getGames(a);
    const bGames = getGames(b);
    return bWin + Math.min(aGames, 20) - (aWin + Math.min(bGames, 20));
  })[0];
}

function findWeakSpot(data) {
  const candidates = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
  ].filter((item) => getGames(item) >= 2);

  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const aWin = getWinRate(a) ?? 50;
    const bWin = getWinRate(b) ?? 50;
    const aGames = getGames(a);
    const bGames = getGames(b);

    if (aWin !== bWin) return aWin - bWin;
    return bGames - aGames;
  })[0];
}

function findMainOpening(data) {
  const openings = sortByGamesAndWinRate(
    Array.isArray(data?.top_openings) ? data.top_openings : []
  );

  return openings[0] || null;
}

function getRecommendation(data) {
  const recommendations = Array.isArray(data?.recommendations)
    ? data.recommendations
    : [];

  const first = recommendations[0];

  if (typeof first === "string") return first;

  return (
    first?.title ||
    first?.summary ||
    first?.reason ||
    first?.text ||
    first?.message ||
    null
  );
}

function formatMeta(item) {
  if (!item) return "Import more games to sharpen this.";
  const games = getGames(item);
  const winRate = getWinRate(item);

  const bits = [];
  if (winRate !== null) bits.push(`${winRate}% score`);
  if (games > 0) bits.push(`${games} game${games === 1 ? "" : "s"}`);

  return bits.length ? bits.join(" · ") : "Pattern found in your games";
}

export default function ReportSnapshot({ data, onViewChange }) {
  if (!data) return null;

  const reportMode = data?.reportMode || data?.report_mode || "normal_user";
  const publicMode = reportMode !== "normal_user";
  const bestFit = findBestFit(data);
  const weakSpot = findWeakSpot(data);
  const mainOpening = findMainOpening(data);
  const recommendation = getRecommendation(data);

  const playerLevel = getPlayerLevelText(data, "");
  const rating = data?.rating || data?.chesscomRating || data?.lichessRating;
  const profileDetail = [
    playerLevel || (rating ? "Current level" : ""),
    rating ? `${rating} rating` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const cards = [
    {
      eyebrow: publicMode ? "Recent strength" : "Best fit",
      title: getOpeningName(bestFit || mainOpening, "Your strongest opening"),
      detail: formatMeta(bestFit || mainOpening),
      note: publicMode
        ? "A higher-scoring recent online sample, not a judgement of full opening knowledge."
        : "Keep this in your repertoire and build around it.",
      action: "See recommendations",
      view: "recommendations",
    },
    {
      eyebrow: publicMode ? "Lower-scoring sample" : "Needs work",
      title: getOpeningName(weakSpot, publicMode ? "Recent underperformer" : "Your weakest recurring opening"),
      detail: formatMeta(weakSpot),
      note: publicMode
        ? "Compare by time control, opponent pool, and whether the games were experimental."
        : "This is the fastest place to gain practical rating points.",
      action: "Open study plan",
      view: "training",
    },
    {
      eyebrow: "Next focus",
      title: recommendation || "Review your most repeated opening mistakes",
      detail: profileDetail || "Based on your imported games",
      note: publicMode
        ? "OpeningFit is analysing recent online results only."
        : "One focused study session beats ten random opening videos.",
      action: publicMode ? "Review trends" : "Start training",
      view: "training",
    },
  ];

  return (
    <section className="reportSnapshot" aria-label="OpeningFit report snapshot">
      <div className="reportSnapshotHeader">
        <div>
          <p className="reportSnapshotKicker">Report snapshot</p>
          <h2>Your opening profile at a glance</h2>
          <p>
            {publicMode
              ? "The quick version of recent online performance trends. This is not a judgement of the player's actual opening knowledge."
              : "The quick version of what OpeningFit found in your games — what to keep, what to improve, and what to study next."}
          </p>
        </div>

        <div className="reportSnapshotBadge">
          <span>Personalised</span>
          <strong>from your games</strong>
        </div>
      </div>

      <div className="reportSnapshotGrid">
        {cards.map((card) => (
          <article className="reportSnapshotCard" key={card.eyebrow}>
            <p className="reportSnapshotEyebrow">{card.eyebrow}</p>
            <h3>{card.title}</h3>
            <p className="reportSnapshotDetail">{card.detail}</p>
            <p className="reportSnapshotNote">{card.note}</p>

            {typeof onViewChange === "function" ? (
              <button
                type="button"
                className="reportSnapshotButton"
                onClick={() => onViewChange(card.view)}
              >
                {card.action}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
