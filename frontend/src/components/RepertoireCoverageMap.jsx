import { buildRepertoireCoverage } from "../lib/repertoireCoverage.js";

export default function RepertoireCoverageMap({ model, onEvidence, onManage }) {
  const coverage = buildRepertoireCoverage(model);
  return (
    <section className="decisionRepertoireMap" id="repertoire-map" aria-labelledby="decision-map-title">
      <header><p className="eyebrow">Repertoire coverage</p><h2 id="decision-map-title">Do you have a complete repertoire?</h2><p>{coverage.summary}</p></header>
      <div className="repertoireCoverageGrid">
        {coverage.roles.map((area) => <article key={area.key} data-role={area.key} data-decision-id={area.source?.decisionId || model.decisionId || undefined} data-diagnosis-id={area.source?.diagnosisId || undefined}>
          <div className="repertoireCoverageRole"><span>{area.label}</span><h3>{area.opening}</h3></div>
          <strong className={`repertoireCoverageStatus repertoireCoverageStatus--${area.state.toLowerCase()}`}>{area.statusLabel}</strong>
          <p>{area.performance || "Performance unavailable"}{area.confidence ? ` · ${area.confidence}` : ""}</p>
          <div className="repertoireCoverageActions"><button type="button" onClick={() => onManage?.(area.source)}>Edit or manage</button><details><summary>Evidence</summary><p>{area.explanation}</p>{area.games !== null ? <p>{area.games} supporting game{area.games === 1 ? "" : "s"}</p> : null}{area.evidence ? <p>{area.evidence}</p> : null}<button type="button" onClick={() => onEvidence?.(area.source)}>View detailed evidence</button></details></div>
        </article>)}
      </div>
      {coverage.supportingPriority ? <p className="repertoireCoveragePriority">{coverage.supportingPriority}</p> : null}
    </section>
  );
}
