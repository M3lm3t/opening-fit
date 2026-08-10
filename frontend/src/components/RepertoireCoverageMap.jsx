import { buildRepertoireCoverage } from "../lib/repertoireCoverage.js";

export default function RepertoireCoverageMap({ model, onEvidence }) {
  const coverage = buildRepertoireCoverage(model);
  return (
    <section className="decisionRepertoireMap" id="repertoire-map" aria-labelledby="decision-map-title">
      <header><p className="eyebrow">Repertoire coverage</p><h2 id="decision-map-title">Do you have a complete repertoire?</h2><p>{coverage.summary}</p></header>
      <div className="repertoireCoverageGrid">
        {coverage.roles.map((area) => <article key={area.key}>
          <div className="repertoireCoverageRole"><span>{area.label}</span><h3>{area.opening}</h3></div>
          <strong className={`repertoireCoverageStatus repertoireCoverageStatus--${area.state.toLowerCase()}`}>{area.statusLabel}</strong>
          <details><summary>Evidence</summary><p>{area.explanation}</p>{area.games !== null ? <p>{area.games} supporting game{area.games === 1 ? "" : "s"}</p> : null}{area.confidence ? <p>Confidence: {area.confidence}</p> : null}{area.evidence ? <p>{area.evidence}</p> : null}<button type="button" onClick={() => onEvidence?.(area.source)}>View detailed evidence</button></details>
        </article>)}
      </div>
      {coverage.supportingPriority ? <p className="repertoireCoveragePriority">{coverage.supportingPriority}</p> : null}
    </section>
  );
}
