import { buildOpeningFitScoreTransparency } from "../lib/openingFitScoreTransparency.js";
import "./OpeningFitScoreDisclosure.css";

export default function OpeningFitScoreDisclosure({ model, report, previousReport }) {
  const view = buildOpeningFitScoreTransparency({ model, report, previousReport });
  return (
    <details className="openingFitScoreDisclosure">
      <summary aria-label="Explain the OpeningFit Score">How this score works</summary>
      <div className="openingFitScoreDisclosureBody">
        <p className="openingFitScoreMeaning">{view.meaning}</p>
        <dl className="openingFitScoreFacts">
          <div><dt>Current score</dt><dd>{view.currentScore ?? "Unavailable"}{view.currentScore === null ? "" : " / 100"}</dd></div>
          <div><dt>Previous score</dt><dd>{view.previousScore === null ? "No previous score" : `${view.previousScore} / 100`}</dd></div>
          <div><dt>Data confidence</dt><dd>{view.statusLabel}</dd></div>
          <div><dt>Games used</dt><dd>{view.games}</dd></div>
        </dl>
        <section><h3>Main reason for change</h3><p>{view.reasonForChange}</p></section>
        {view.hasComponentData ? <section><h3>Inputs used by this calculation</h3><div className="openingFitScoreComponents">{view.components.map((component) => <article key={component.key}><header><strong>{component.title}</strong><span>{component.value} / 100 · {component.weight}% weight</span></header><p>{component.explanation}</p></article>)}</div></section> : <p className="openingFitScoreMissingComponents">Component data is unavailable for this report, so OpeningFit is not inventing a breakdown.</p>}
        <section className="openingFitScoreExplanationGrid">
          <div><h3>What affects it</h3><p>{view.affects}</p></div>
          <div><h3>What does not affect it</h3><p>{view.doesNotAffect}</p></div>
          <div><h3>Why it may change</h3><p>{view.whyChange}</p></div>
          <div><h3>Why sample size matters</h3><p>{view.smallSamples}</p></div>
        </section>
      </div>
    </details>
  );
}
