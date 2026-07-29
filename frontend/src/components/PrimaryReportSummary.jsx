import { buildPrimaryReportSummary } from "../lib/primaryReportSummary.js";
import { buildOpeningFitScoreTransparency } from "../lib/openingFitScoreTransparency.js";
import OpeningFitScoreDisclosure from "./OpeningFitScoreDisclosure.jsx";
import { isSampleReport } from "../fixtures/sampleReport.js";
import ReportGameCountSummary from "./ReportGameCountSummary.jsx";
import RecommendationEvidenceDisclosure from "./RecommendationEvidenceDisclosure.jsx";
import "./PrimaryReportSummary.css";

export default function PrimaryReportSummary({ model, report, previousReport = null, comparison = null, saveStatus = "", authenticated = false, onAccount, onTraining, onPractice, onEvidence, onAnalyse, onFullReport }) {
  const view = buildPrimaryReportSummary(model, report);
  const scoreView = buildOpeningFitScoreTransparency({ model, report, previousReport });
  const strengthEvidence = { ...(model.authoritative?.establishedStrength?.source || {}), ...(model.authoritative?.establishedStrength || model.establishedStrength || {}) };
  const problemEvidence = { ...(model.authoritative?.primaryProblem?.source || {}), ...(model.authoritative?.primaryProblem || model.primaryProblem || {}) };
  const trainingTarget = model.authoritative?.primaryProblem || model.authoritative?.establishedStrength || {};
  const trainingEvidence = {
    ...(trainingTarget.source || {}),
    ...trainingTarget,
    ...(model.authoritative?.nextTrainingAction || model.nextTrainingAction || {}),
    sample: model.authoritative?.nextTrainingAction?.sample || trainingTarget.sample,
    trainingPriority: model.authoritative?.trainingPriority || model.trainingPriority || null,
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
  const missingSlots = view.slots.filter((slot) => !slot.complete);
  return (
    <section className="primaryReportSummary" aria-labelledby="primary-report-title">
      {isSampleReport(report) ? <p className="primaryReportSampleLabel">Illustrative example · Fictional data · <a href="/how-it-works">How analysis works</a></p> : null}

      <div className="primaryReportVerdict">
        <span>Coach verdict</span>
        <h2 id="primary-report-title" tabIndex="-1">Your opening plan</h2>
        <p>{view.verdict}</p>
        <p className="primaryReportKeep"><strong>Keep playing</strong><span>{view.decisions[0].title}</span></p>
        <div className={`primaryReportEvidence primaryReportEvidence--${view.weaknessState}`}>
          <strong>{view.problem.title}</strong>
          <p>{view.evidenceExplanation}</p>
        </div>
        <small>{view.confidence}</small>
      </div>

      {missingSlots.length ? <section className="primaryReportBuilding" aria-labelledby="building-role-title">
        <span>Missing or building repertoire role</span>
        <h2 id="building-role-title">{missingSlots.map((slot) => slot.label).join(" · ")}</h2>
        <p>{missingSlots[0].explanation}</p>
      </section> : null}

      <section className="primaryReportNextAction" aria-labelledby="primary-action-title">
        <span>{view.decisions[2].label}</span>
        <div><h2 id="primary-action-title">{view.primaryAction.title}</h2><p>{view.decisions[2].reason}</p></div>
        {actionAvailable(view.primaryAction) ? <button type="button" className="primaryBtn" onClick={() => runAction(view.primaryAction)}>{view.primaryAction.label}</button> : null}
      </section>

      <div className="primaryReportMore"><button type="button" className="secondaryBtn" onClick={onFullReport}>View evidence and full report</button><small>Detailed repertoire roles, import counts, calculation, sharing and report tools are preserved below.</small></div>

      <ReportGameCountSummary report={report} saveStatus={saveStatus} authenticated={authenticated} onAccount={onAccount} />

      <section className="primaryReportScoreSection" aria-labelledby="repertoire-coverage-title">
        <div className="primaryReportScoreExplanation">
          <span>Repertoire completeness</span>
          <h2 id="repertoire-coverage-title">{view.establishedRoleCount} of {view.totalRoleCount} repertoire roles established</h2>
          <ul className="primaryReportRoleOverview">{view.slots.map((slot) => <li key={slot.key}><span>{slot.label}</span><strong>{slot.complete ? "Established" : "Building"}</strong></li>)}</ul>
          <p>Coverage measures how established and well-supported the three core repertoire roles are. It does not measure playing strength or opening quality.</p>
          <p className="primaryReportCoverageIndicator"><strong>{view.scoreLabel}:</strong> {view.score === null ? "Unavailable" : `${view.score}%`} · {scoreView.developmentState.label}</p>
        </div>
      </section>
      <OpeningFitScoreDisclosure model={model} report={report} previousReport={previousReport} />

      <details className="primaryReportSupportingDisclosure"><summary>Supporting decisions and evidence</summary><section className="primaryReportDecisions" aria-labelledby="primary-decisions-title">
        <header><span>Supporting decisions</span><h2 id="primary-decisions-title">Keep, assess, then train</h2></header>
        <div>{view.decisions.map((decision, index) => (
          <article className={`primaryReportDecision primaryReportDecision--${decision.key}`} key={decision.key}>
            <span>{index + 1}. {decision.label}</span><h3>{decision.title}</h3><p>{decision.reason}</p>
            {decision.key !== "train" && actionAvailable(decision.action) ? <button type="button" className="secondaryBtn" onClick={() => runAction(decision.action)}>{decision.action.label}</button> : null}
          </article>
        ))}</div>
        {view.recommendationContext?.reasons?.length ? <div className="primaryReportFitContext"><strong>{view.recommendationContext.title}</strong><ul>{view.recommendationContext.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div> : null}
        <details className="primaryReportDecisionEvidence">
          <summary>Why these decisions?</summary>
          <div>
            {view.decisions[0].source ? <RecommendationEvidenceDisclosure recommendation={strengthEvidence} report={report} interpretation={view.decisions[0].reason} label="Evidence for Keep" /> : null}
            {view.decisions[1].source ? <RecommendationEvidenceDisclosure recommendation={problemEvidence} report={report} interpretation={view.decisions[1].reason} label="Evidence for Repair" /> : null}
            <RecommendationEvidenceDisclosure recommendation={trainingEvidence} report={report} interpretation={view.decisions[2].reason} label="Evidence for Train next" />
          </div>
        </details>
      </section></details>

      {view.confidenceWarning ? <aside className="primaryReportConfidence" role="status"><strong>Confidence is still developing</strong><p>{view.confidenceWarning}</p></aside> : null}
      <details className="primaryReportRepertoireDisclosure"><summary>Detailed repertoire role evidence</summary><section className="primaryReportRepertoire" id="report-repertoire" aria-labelledby="primary-repertoire-title">
        <header><div><span>Current repertoire</span><h2 id="primary-repertoire-title">Your three core roles</h2></div>{view.incompleteRepertoire ? <strong>Still building</strong> : <strong>Core roles covered</strong>}</header>
        <div>{view.slots.map((slot) => <article key={slot.key} className={!slot.complete ? "isIncomplete" : ""}><span>{slot.label}</span><h3>{slot.opening}</h3><strong className="primaryReportRoleStatus">{slot.confidence}{slot.complete && slot.games !== null ? ` · ${slot.games} relevant game${slot.games === 1 ? "" : "s"}` : ""}</strong><p>{slot.explanation}</p>{!slot.complete ? <details><summary>Why isn&apos;t this established?</summary><p><code>{slot.reasonCode}</code></p>{slot.funnelRows.length ? <dl>{slot.funnelRows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl> : <p>Detailed role-stage counts were not stored with this report.</p>}<p>{slot.requirement}</p><small>{slot.filters}</small></details> : null}</article>)}</div>
      </section></details>

      {comparison ? <div className="primaryReportComparison">{comparison}</div> : null}
    </section>
  );
}
