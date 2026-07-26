import { useEffect, useState } from "react";
import { fetchGamesAnalysedMetric } from "../lib/homepageMetrics.js";
import "./PublicGamesAnalysedMetric.css";

export default function PublicGamesAnalysedMetric() {
  const [metric, setMetric] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchGamesAnalysedMetric().then((value) => {
      if (!active) return;
      setMetric(value);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="publicGamesMetricSlot" aria-hidden={loading || !metric ? "true" : undefined}>
      {!loading && metric ? <p className="publicGamesMetric" aria-label={metric.label}>{metric.label}</p> : null}
    </div>
  );
}
