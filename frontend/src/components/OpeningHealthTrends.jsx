import { useMemo } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { buildOpeningHealthTrends } from "../services/openingHealthTrends";
import "./OpeningHealthTrends.css";

function formatDelta(value) {
  if (!Number.isFinite(Number(value))) return "0";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${value}`;
}

function directionIcon(direction) {
  if (direction === "improving") return <ArrowUpRight size={16} aria-hidden="true" />;
  if (direction === "slipping") return <ArrowDownRight size={16} aria-hidden="true" />;
  return <ArrowRight size={16} aria-hidden="true" />;
}

function directionLabel(direction) {
  if (direction === "improving") return "Improving";
  if (direction === "slipping") return "Slipping";
  return "Stable";
}

export default function OpeningHealthTrends({ reportHistory = [], className = "" }) {
  const health = useMemo(() => buildOpeningHealthTrends(reportHistory), [reportHistory]);

  return (
    <section className={`openingHealthTrends ${className}`.trim()} aria-labelledby="opening-health-trends-title">
      <div className="openingHealthTrendsHeader">
        <div>
          <p className="eyebrow">Opening Health</p>
          <h2 id="opening-health-trends-title">Opening Health Trends</h2>
          <p>Compared only from saved reports that contain matching opening scores.</p>
        </div>
        <span className="openingHealthTrendsBadge">
          <Activity size={15} aria-hidden="true" />
          Saved history
        </span>
      </div>

      {!health.hasEnoughHistory ? (
        <div className="openingHealthTrendsEmpty">
          <strong>Your opening trends will appear after your next analysis.</strong>
          <span>OpeningFit needs at least two saved reports with compatible opening data before it shows trend direction.</span>
        </div>
      ) : (
        <div className="openingHealthTrendsGrid">
          {health.trends.map((trend) => (
            <article className={`openingHealthTrendCard openingHealthTrendCard--${trend.direction}`} key={trend.key}>
              <div className="openingHealthTrendTop">
                <div>
                  <span>{trend.name}</span>
                  <strong>{trend.currentScore}/100</strong>
                </div>
                <em>
                  {directionIcon(trend.direction)}
                  {directionLabel(trend.direction)}
                </em>
              </div>
              <dl>
                <div>
                  <dt>Previous</dt>
                  <dd>{trend.previousScore}/100</dd>
                </div>
                <div>
                  <dt>Change</dt>
                  <dd>{formatDelta(trend.scoreChange)}</dd>
                </div>
                <div>
                  <dt>Recent games</dt>
                  <dd>{trend.games ?? "Unknown"}</dd>
                </div>
              </dl>
              <p>{trend.summary}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
