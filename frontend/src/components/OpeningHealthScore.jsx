import { useMemo } from "react";
import { buildOpeningHealthSnapshot, formatOpeningHealthDelta } from "../services/openingHealth";
import "./OpeningHealthScore.css";

function labelForContext(context) {
  const labels = {
    white: "White",
    blackVsE4: "Black vs e4",
    blackVsD4: "Black vs d4",
  };
  return labels[context] || "Overall";
}

function TrendGraph({ points = [] }) {
  const cleanPoints = points.slice(-8);
  if (cleanPoints.length < 2) {
    return (
      <div className="openingHealthTrendEmpty">
        Save another report to start the trend graph.
      </div>
    );
  }

  return (
    <div className="openingHealthTrendGraph" aria-label="Opening Health score history">
      {cleanPoints.map((point, index) => {
        const height = Math.max(12, Math.min(100, point.score));
        return (
          <span
            key={`${point.date || "point"}-${index}`}
            style={{ "--bar-height": `${height}%` }}
            title={`${point.score}/100`}
          >
            <em>{point.score}</em>
          </span>
        );
      })}
    </div>
  );
}

export default function OpeningHealthScore({ data, fitData, history = [] }) {
  const health = useMemo(
    () => (data ? buildOpeningHealthSnapshot(data, fitData, history) : null),
    [data, fitData, history]
  );

  if (!data || !health) return null;

  const breakdownRows = [
    ["White Repertoire", health.breakdown.whiteRepertoire],
    ["Black vs e4", health.breakdown.blackVsE4],
    ["Black vs d4", health.breakdown.blackVsD4],
    ["Recent Form", health.breakdown.recentForm],
  ];
  const topRatings = health.openingRatings.slice(0, 6);

  return (
    <section className="openingHealthScore" id="opening-health">
      <div className="healthScoreMain">
        <div>
          <p className="eyebrow">Opening Health</p>
          <h2>Opening Health: {health.score}/100</h2>
          <p>
            A repeatable score built from win rate, consistency, repertoire diversity,
            recent form, and the number of games analysed.
          </p>
          <strong className={health.monthlyChange >= 0 ? "healthDeltaPositive" : "healthDeltaNegative"}>
            {formatOpeningHealthDelta(health.monthlyChange)}
          </strong>
        </div>

        <div className="healthScoreDial" aria-label={`Opening Health score ${health.score} out of 100`}>
          <strong>{health.score}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="healthMetricGrid">
        {breakdownRows.map(([label, score]) => (
          <div key={label}>
            <strong>{score}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="openingHealthDetailGrid">
        <article className="openingHealthPanel">
          <div className="openingHealthPanelHeader">
            <span>Opening ratings</span>
            <strong>Top tracked lines</strong>
          </div>
          <div className="openingHealthRatings">
            {topRatings.length ? (
              topRatings.map((opening) => (
                <div key={`${opening.context}-${opening.name}`} className="openingHealthRatingRow">
                  <div>
                    <strong>{opening.name}</strong>
                    <span>{labelForContext(opening.context)} · {opening.games || "Recent"} games</span>
                  </div>
                  <div>
                    <strong>{opening.rating}</strong>
                    <span className={opening.monthlyChange >= 0 ? "healthDeltaPositive" : "healthDeltaNegative"}>
                      {formatOpeningHealthDelta(opening.monthlyChange)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p>Import more games to rate individual openings.</p>
            )}
          </div>
        </article>

        <article className="openingHealthPanel">
          <div className="openingHealthPanelHeader">
            <span>Score history</span>
            <strong>Trend</strong>
          </div>
          <TrendGraph points={health.historyPoints} />
          <div className="openingHealthFactors">
            <span>Win rate {health.factors.winRate}</span>
            <span>Consistency {health.factors.consistency}</span>
            <span>Diversity {health.factors.diversity}</span>
            <span>{health.factors.gamesAnalysed || "Recent"} games</span>
          </div>
        </article>
      </div>
    </section>
  );
}
