import { buildPrimaryReportSummary } from "../lib/primaryReportSummary.js";
import { buildOpeningFitScoreTransparency } from "../lib/openingFitScoreTransparency.js";
import OpeningFitScoreDisclosure from "./OpeningFitScoreDisclosure.jsx";
import { canUseFeature, OPENINGFIT_FEATURES } from "../lib/premiumEntitlement.js";
import { isSampleReport } from "../fixtures/sampleReport.js";
import ReportGameCountSummary from "./ReportGameCountSummary.jsx";
import RecommendationEvidenceDisclosure from "./RecommendationEvidenceDisclosure.jsx";
import "./PrimaryReportSummary.css";

export default function PrimaryReportSummary({ model, report, previousReport = null, comparison = null, entitlement = null, saveStatus = "", authenticated = false, onAccount, onTraining, onPractice, onEvidence, onAnalyse, onFullReport }) {
  const view = buildPrimaryReportSummary(model, report);
  const scoreView = buildOpeningFitScoreTransparency({ model, report, previousReport });
  const hasFullRepertoire = isSampleReport(report) || canUseFeature(entitlement, OPENINGFIT_FEATURES.FULL_REPERTOIRE);
  const strengthEvidence = { ...(model.authoritative?.establishedStrength?.source || {}), ...(model.authoritative?.establishedStrength || model.establishedStrength || {}) };
  const problemEvidence = { ...(model.authoritative?.primaryProblem?.source || {}), ...(model.authoritative?.primaryProblem || model.primaryProblem || {}) };
  const trainingTarget = model.authoritative?.primaryProblem || model.authoritative?.establishedStrength || {};
  const trainingEvidence = {
    ...(trainingTarget.source || {}),
    ...trainingTarget,
    ...(model.authoritative?.nextTrainingAction || model.nextTrainingAction || {}),
    sample: model.authoritative?.nextTrainingAction?.sample || trainingTarget.sample,
  };
  const actionAvailable = (action) => Boolean(action && (
    (action.type === "practice" && onPractice) ||
    (action.type === "evidence" && onEvidence) ||
    (action.type === "training" && onTraining) ||
    (action.type === "analyse" && onAnalyse)
  ));
  const runAction = (action) => {
    if (action?.type === "practice") onPractice?.(action.target);
    else if (action?.type === "evidence") onEvidence?.(action.target);
    else if (action?.type === "analyse") onAnalyse?.();
    else if (action?.type === "training") onTraining?.(action.target);
  };
  return (
    <section className="primaryReportSummary" aria-labelledby="primary-report-title">
      {isSampleReport(report) ? <p className="primaryReportSampleLabel">Example report · Fictional data · <a href="/how-it-works">How analysis works</a></p> : null}

      <div className="primaryReportVerdict">
        <span>Coach verdict</span>
        <h1 id="primary-report-title">Your opening plan</h1>
        <p>{view.verdict}</p>
        <div className={`primaryReportEvidence primaryReportEvidence--${view.weaknessState}`}>
          <strong>{view.problem.title}</strong>
          <p>{view.evidenceExplanation}</p>
        </div>
        <small>{view.confidence}</small>
      </div>

      <section className="primaryReportNextAction" aria-labelledby="primary-action-title">
        <span>One next action</span>
        <h2 id="primary-action-title">{view.primaryAction.title}</h2>
        {actionAvailable(view.primaryAction) ? <button type="button" className="primaryBtn" onClick={() => runAction(view.primaryAction)}>{view.primaryAction.label}</button> : null}
      </section>

      <ReportGameCountSummary report={report} saveStatus={saveStatus} authenticated={authenticated} onAccount={onAccount} />

      <section className="primaryReportScoreSection" aria-labelledby="repertoire-coverage-title">
        <div className="primaryReportScore" aria-label={view.scoreLabel}>
          <span>{view.scoreLabel}</span><strong>{view.score ?? "—"}</strong><small>{view.score === null ? "Not enough evidence" : "/100"}</small><em>{scoreView.statusLabel}</em>
        </div>
        <div className="primaryReportScoreExplanation">
          <h2 id="repertoire-coverage-title">What this number means</h2>
          <p>{scoreView.meaning}</p><p>{scoreView.whyChange}</p><p>{scoreView.weaknessContext}</p>
        </div>
      </section>
      <OpeningFitScoreDisclosure model={model} report={report} previousReport={previousReport} />

      <section className="primaryReportDecisions" aria-labelledby="primary-decisions-title">
        <header><span>Supporting decisions</span><h2 id="primary-decisions-title">Keep, repair, then train</h2></header>
        <div>{view.decisions.map((decision, index) => (
          <article className={`primaryReportDecision primaryReportDecision--${decision.key}`} key={decision.key}>
            <span>{index + 1}. {decision.label}</span><h3>{decision.title}</h3><p>{decision.reason}</p>
            {decision.key !== "train" && actionAvailable(decision.action) ? <button type="button" className="secondaryBtn" onClick={() => runAction(decision.action)}>{decision.action.label}</button> : null}
          </article>
        ))}</div>
        <details className="primaryReportDecisionEvidence">
          <summary>Why these decisions?</summary>
          <div>
            {view.decisions[0].source ? <RecommendationEvidenceDisclosure recommendation={strengthEvidence} report={report} interpretation={view.decisions[0].reason} label="Evidence for Keep" /> : null}
            {view.decisions[1].source ? <RecommendationEvidenceDisclosure recommendation={problemEvidence} report={report} interpretation={view.decisions[1].reason} label="Evidence for Repair" /> : null}
            <RecommendationEvidenceDisclosure recommendation={trainingEvidence} report={report} interpretation={view.decisions[2].reason} label="Evidence for Train next" />
          </div>
        </details>
      </section>

      {view.confidenceWarning ? <aside className="primaryReportConfidence" role="status"><strong>Confidence is still developing</strong><p>{view.confidenceWarning}</p></aside> : null}
      {hasFullRepertoire ? <section className="primaryReportRepertoire" id="report-repertoire" aria-labelledby="primary-repertoire-title">
        <header><div><span>Current repertoire</span><h2 id="primary-repertoire-title">Your three core slots</h2></div>{view.incompleteRepertoire ? <strong>Still building</strong> : <strong>Core slots covered</strong>}</header>
        <div>{view.slots.map((slot) => <article key={slot.key} className={!slot.complete ? "isIncomplete" : ""}><span>{slot.label}</span><h3>{slot.opening}</h3><p>{slot.confidence}</p></article>)}</div>
      </section> : view.slots.some((slot) => slot.complete) ? <section className="primaryReportRepertoire" id="report-repertoire" aria-labelledby="primary-repertoire-title">
        <header><div><span>Current repertoire</span><h2 id="primary-repertoire-title">Your supported repertoire role</h2></div><strong>From this report</strong></header>
        <div>{view.slots.filter((slot) => slot.complete).slice(0, 1).map((slot) => <article key={slot.key}><span>{slot.label}</span><h3>{slot.opening}</h3><p>{slot.confidence}</p></article>)}</div>
      </section> : null}

      {comparison ? <div className="primaryReportComparison">{comparison}</div> : null}
      <div className="primaryReportMore"><button type="button" className="secondaryBtn" onClick={onFullReport}>View full report</button><small>Recommendations, evidence, detailed repertoire roles, sharing and report tools are preserved below.</small></div>
    </section>
  );
}
