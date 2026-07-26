import { buildRecommendationExplanation } from "../lib/recommendationExplanation.js";
import "./RecommendationEvidenceDisclosure.css";

export default function RecommendationEvidenceDisclosure({ recommendation, report, interpretation = "", illustrative = false, label = "Why this recommendation?", onToggle }) {
  const totalGames = report?.counts?.eligible ?? report?.gameCounts?.eligible ?? report?.game_counts?.eligible ?? report?.gamesEligible ?? report?.games_eligible ?? null;
  const view = buildRecommendationExplanation(recommendation || {}, {
    totalGames,
    interpretation,
    illustrative: illustrative || Boolean(report?.sampleMode || report?.sample_mode || report?.source === "sample_fixture"),
  });

  return (
    <details className="recommendationEvidenceDisclosure" onToggle={(event) => onToggle?.(event.currentTarget.open)}>
      <summary aria-label={label}><span aria-hidden="true">i</span>{label}</summary>
      <div className="recommendationEvidenceBody">
        {view.illustrative ? <p className="recommendationEvidenceSample">Illustrative example evidence</p> : null}
        {view.hasEvidence ? (
          <section aria-label="Observed evidence">
            <h4>Observed evidence</h4>
            <dl>{view.rows.map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
          </section>
        ) : <p>{view.fallback}</p>}
        {view.warning ? <p className="recommendationEvidenceWarning">{view.warning}</p> : null}
        {view.interpretation ? <section aria-label="Interpretation"><h4>Interpretation</h4><p>{view.interpretation}</p></section> : null}
      </div>
    </details>
  );
}
