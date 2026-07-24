import "./ReportSnapshot.css";
import { getPlayerLevelText } from "./playerLevelLogic";
import { getOpeningContext, getOpeningSignal } from "./OpeningEvidence";
import { normaliseReportDecision } from "../lib/recommendationEvidence.js";
import { formatRecommendationConfidence, recommendationCopy, trainingActionCopy } from "../lib/reportCoachCopy.js";

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
    item?.sample?.scoreRate ??
    item?.scoreRate ??
    item?.score_rate ??
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
  return toNumber(item?.sample?.games ?? item?.games ?? item?.count ?? item?.total ?? item?.played, 0);
}

function openingContextTitle(item, fallback = "Opening signal") {
  if (!item) return fallback;

  const name = getOpeningName(item, fallback);
  const context = getOpeningContext(item);

  if (context.type === "white") return `${name} as White`;
  if (context.type === "black") return `${name} as Black`;
  if (context.type === "faced") {
    if (String(context.detail || "").toLowerCase().includes("white")) {
      return `Facing ${name} as White`;
    }
    if (String(context.detail || "").toLowerCase().includes("black")) {
      return `Facing ${name} as Black`;
    }
    return `${name} you faced`;
  }

  return `${name} (mixed signal)`;
}

function canUseAsRepertoire(item) {
  if (!item) return false;
  const context = getOpeningContext(item);
  const signal = getOpeningSignal(item);
  return context.canRecommend && signal.canBePrimary;
}

function findBestFit(data) {
  const candidates = [
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
  ];

  if (!candidates.length) return null;

  const sorted = [...candidates].sort((a, b) => {
    const aWin = getWinRate(a) ?? 0;
    const bWin = getWinRate(b) ?? 0;
    const aGames = getGames(a);
    const bGames = getGames(b);
    return bWin + Math.min(aGames, 20) - (aWin + Math.min(bGames, 20));
  });

  return sorted.find(canUseAsRepertoire) || sorted[0];
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

export default function ReportSnapshot({ data, onViewChange }) {
  if (!data) return null;

  const reportMode = data?.reportMode || data?.report_mode || "normal_user";
  const publicMode = reportMode !== "normal_user";
  const decision = normaliseReportDecision(data.reportDecision || data.report_decision);
  const bestFit = publicMode ? findBestFit(data) : decision?.establishedStrength || null;
  const weakSpot = publicMode ? findWeakSpot(data) : decision?.primaryProblem || null;
  const recommendation = publicMode ? getRecommendation(data) : decision?.nextTrainingAction?.label;

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
      title: openingContextTitle(bestFit, "No established strength yet"),
      detail: bestFit ? formatRecommendationConfidence(bestFit) : "Not enough opening-specific evidence",
      note: publicMode
        ? "A higher-scoring recent online sample, not a judgement of full opening knowledge."
        : canUseAsRepertoire(bestFit)
          ? recommendationCopy(bestFit, "keep")
          : "This is not clean enough to treat as a repertoire recommendation yet.",
      action: "See recommendations",
      view: "repertoire",
    },
    {
      eyebrow: publicMode ? "Lower-scoring sample" : "Needs work",
      title: openingContextTitle(weakSpot, publicMode ? "Recent underperformer" : "No reliable opening weakness found yet"),
      detail: weakSpot ? formatRecommendationConfidence(weakSpot) : "No weakness claim is supported",
      note: publicMode
        ? "Compare by time control, opponent pool, and whether the games were experimental."
        : canUseAsRepertoire(weakSpot)
          ? recommendationCopy(weakSpot, "repair")
          : "Separate played and faced games before calling this a weakness.",
      action: "Open study plan",
      view: "training",
    },
    {
      eyebrow: "Next focus",
      title: trainingActionCopy(decision?.nextTrainingAction || { title: recommendation }, weakSpot || bestFit).title,
      detail: profileDetail || "Based on your imported games",
      note: publicMode
        ? "OpeningFit is analysing recent online results only."
        : trainingActionCopy(decision?.nextTrainingAction || { title: recommendation }, weakSpot || bestFit).explanation,
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
