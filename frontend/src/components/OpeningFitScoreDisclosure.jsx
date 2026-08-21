import { useState } from "react";
import { buildOpeningFitScoreTransparency } from "../lib/openingFitScoreTransparency.js";
import "./OpeningFitScoreDisclosure.css";

export default function OpeningFitScoreDisclosure({ model, report, previousReport }) {
  const [open, setOpen] = useState(false);
  const view = buildOpeningFitScoreTransparency({ model, report, previousReport });
  const contributionTotal = view.components.reduce((sum, component) => sum + Number(component.contribution || 0), 0);
  return (
    <details className="openingFitScoreDisclosure" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary id="repertoire-health-methodology-control" aria-label="Explain Repertoire Health calculation" aria-expanded={open} aria-controls="repertoire-health-methodology">How Repertoire Health is calculated</summary>
      <div className="openingFitScoreDisclosureBody" id="repertoire-health-methodology" role="region" aria-labelledby="repertoire-health-methodology-control">
        <p className="openingFitScoreMeaning">{view.meaning}</p>
        <dl className="openingFitScoreFacts">
          <div><dt>Current Repertoire Health</dt><dd>{view.scoreDisplayLabel}</dd></div>
          <div><dt>Previous score</dt><dd>{view.previousScore === null ? "No comparable previous score" : `${view.previousScore}/100`}</dd></div>
          <div><dt>Overall Evidence Confidence</dt><dd>{view.evidenceConfidence?.label || view.statusLabel}</dd></div>
          <div><dt>Games analysed</dt><dd>{view.games}</dd></div>
        </dl>
        {view.explanation ? <p><strong>{view.explanation}</strong></p> : null}
        <section><h3>Why Repertoire Health and the verdict can differ</h3><p>{view.weaknessContext}</p></section>
        {view.recentExperiments?.length ? <section><h3>Recent experiments</h3><ul>{view.recentExperiments.map((experiment) => <li key={`${experiment.repertoireRole}:${experiment.canonicalOpeningId}`}><strong>{experiment.opening}</strong> — {experiment.statusLabel || "developing evidence"}</li>)}</ul><p>Experiments may inform recommendations and training, but are not included in the primary Repertoire Health score.</p></section> : null}
        <section><h3>Historical comparison</h3><p>{view.reasonForChange}</p></section>
        {view.hasComponentData ? <section><h3>Inputs and arithmetic</h3><div className="openingFitScoreComponents">{view.components.map((component) => <article key={component.key}><header><strong>{component.title}</strong><span>{component.value} / 100 × {Number(component.weight).toFixed(2)}% effective weight = {component.contribution} points</span></header><p>{component.explanation}</p></article>)}</div><p><strong>Total:</strong> {contributionTotal.toFixed(2)} weighted points, displayed as {view.currentScore ?? "unavailable"}/100 Repertoire Health.</p></section> : <p className="openingFitScoreMissingComponents">Component data is unavailable for this report, so OpeningFit is not inventing a breakdown.</p>}
        {view.roleScores.length ? <section><h3>Role concentration</h3><p>A role is called scattered only when it has at least {view.concentrationRule?.minimumRoleGames ?? 10} games, at least {view.concentrationRule?.minimumDistinctOpenings ?? 3} distinct openings, and its leading opening is below {view.concentrationRule?.scatteredBelowTopOpeningShare ?? 50}%.</p><div className="openingFitScoreComponents">{view.roleScores.map((role) => <article key={role.key}><header><strong>{role.label}</strong><span>{role.scattered ? "Scattered by the documented rule" : "Not labelled scattered"}</span></header><p>{role.explanation}</p></article>)}</div></section> : null}
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
