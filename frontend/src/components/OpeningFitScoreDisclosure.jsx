import { buildOpeningFitScoreTransparency } from "../lib/openingFitScoreTransparency.js";
import "./OpeningFitScoreDisclosure.css";

export default function OpeningFitScoreDisclosure({ model, report, previousReport }) {
  const view = buildOpeningFitScoreTransparency({ model, report, previousReport });
  const contributionTotal = view.components.reduce((sum, component) => sum + Number(component.contribution || 0), 0);
  return (
    <details className="openingFitScoreDisclosure">
      <summary aria-label="Explain repertoire coverage calculation">How this is calculated</summary>
      <div className="openingFitScoreDisclosureBody">
        <p className="openingFitScoreMeaning">{view.meaning}</p>
        <dl className="openingFitScoreFacts">
          <div><dt>Current coverage indicator</dt><dd>{view.scoreDisplayLabel}</dd></div>
          <div><dt>Previous coverage indicator</dt><dd>{view.previousScore === null ? "No previous indicator" : `${view.previousScore}%`}</dd></div>
          <div><dt>Evidence state</dt><dd>{view.statusLabel}</dd></div>
          <div><dt>Games analysed</dt><dd>{view.games}</dd></div>
        </dl>
        <section><h3>Why coverage and the verdict can differ</h3><p>{view.weaknessContext}</p></section>
        <section><h3>Historical comparison</h3><p>{view.reasonForChange}</p></section>
        {view.hasComponentData ? <section><h3>Inputs and arithmetic</h3><div className="openingFitScoreComponents">{view.components.map((component) => <article key={component.key}><header><strong>{component.title}</strong><span>{component.value} / 100 × {component.weight}% = {component.contribution} points</span></header><p>{component.explanation}</p></article>)}</div><p><strong>Total:</strong> {contributionTotal.toFixed(2)} weighted points, displayed as a {view.currentScore ?? "unavailable"}% coverage indicator.</p></section> : <p className="openingFitScoreMissingComponents">Component data is unavailable for this report, so OpeningFit is not inventing a breakdown.</p>}
        {view.repairStatus ? <section><h3>Repair status is separate</h3><p><strong>{view.repairStatus.label}.</strong> {view.repairStatus.explanation}</p></section> : null}
        <section className="openingFitScoreExplanationGrid">
          <div><h3>What affects it</h3><p>{view.affects}</p></div>
          <div><h3>What does not affect it</h3><p>{view.doesNotAffect}</p></div>
          <div><h3>Why it may change</h3><p>{view.whyChange}</p></div>
          <div><h3>Why role samples matter</h3><p>{view.smallSamples}</p></div>
        </section>
        <p><a href="/how-it-works">Read the full analysis methodology and limitations</a></p>
      </div>
    </details>
  );
}
