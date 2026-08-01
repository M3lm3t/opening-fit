import { buildPrimaryReportSummary } from "../lib/primaryReportSummary.js";
import { buildOpeningFitScoreTransparency } from "../lib/openingFitScoreTransparency.js";
import OpeningFitScoreDisclosure from "./OpeningFitScoreDisclosure.jsx";
import { isSampleReport } from "../fixtures/sampleReport.js";
import "./PrimaryReportSummary.css";

export default function PrimaryReportSummary({ model, report, previousReport = null, onTraining, onPractice, onEvidence, onAnalyse, onFullReport }) {
  const view = buildPrimaryReportSummary(model, report);
  const scoreView = buildOpeningFitScoreTransparency({ model, report, previousReport });
  const sampleMode = isSampleReport(report);
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
    <section className="primaryReportSummary" aria-labelledby="primary-report-title" data-report-command-centre="true">
      {sampleMode ? <p className="primaryReportSampleLabel">Illustrative example · Fictional data · <a href="/how-it-works">How analysis works</a></p> : null}
      <section className="primaryReportHealth" aria-labelledby="primary-report-title">
        <div>
          <span>Repertoire Health</span>
          <h2 id="primary-report-title" tabIndex="-1">{scoreView.scoreDisplayLabel}</h2>
          <strong>{view.completenessLabel} · {view.establishedRoleCount} of {view.totalRoleCount} roles established</strong>
        </div>
        <div className="primaryReportHealthExplanation">
          {sampleMode ? <p>Role completeness shows whether the fictional repertoire fills all three jobs.</p> : null}
          <p>{scoreView.displayScore === null ? "The stored evidence cannot support a complete health calculation." : scoreView.explanation || scoreView.developmentState.label}</p>
          <p>{view.verdict}</p>
          <small>{view.confidence}</small>
        </div>
      </section>

      <div className="primaryReportCommandGrid" aria-label="Keep, repair and train next">
        <article className="primaryReportCommand primaryReportCommand--keep" data-command-role="keep">
          <span>Keep</span>
          <h3>{view.keep.opening}</h3>
          <strong>{view.keep.role}</strong>
          <p>{view.keep.reason}</p>
          {view.keep.observed.results || view.keep.observed.scoreRate ? <p className="primaryReportCommandMetric">{[view.keep.observed.results, view.keep.observed.scoreRate].filter(Boolean).join(" · ")}</p> : null}
          <small>Evidence Confidence: {view.keep.confidence}</small>
          {view.keep.available && onEvidence ? <button type="button" className="secondaryBtn" onClick={() => onEvidence(view.keep.source)}>View supporting games</button> : null}
        </article>

        <article className={`primaryReportCommand primaryReportCommand--repair ${view.repair.available ? "isActionable" : "isCautious"}`} data-command-role="repair">
          <span>Repair</span>
          <h3>{view.repair.opening}</h3>
          <strong>{view.repair.role}</strong>
          <p>{view.repair.diagnosis}</p>
          {view.repair.supportingGames > 0 ? <p className="primaryReportCommandMetric">{view.repair.supportingGames} supporting game{view.repair.supportingGames === 1 ? "" : "s"}</p> : null}
          <small>Evidence Confidence: {view.repair.confidence}</small>
          {view.repair.available && onEvidence ? <button type="button" className="secondaryBtn" onClick={() => onEvidence(view.repair.source)}>View supporting games</button> : null}
        </article>

        <article className="primaryReportCommand primaryReportCommand--train" data-command-role="train-next">
          <span>Train next</span>
          <h3>{view.trainNext.title}</h3>
          <p>{view.trainNext.reason}</p>
          <p><strong>Success:</strong> {view.trainNext.successCheck}</p>
          <small>Approximately {view.trainNext.duration} minutes</small>
          {actionAvailable(view.trainNext.action) ? <button type="button" className="primaryBtn" data-decision-id={view.decisionId || undefined} data-diagnosis-id={view.diagnosisId || undefined} onClick={() => runAction(view.trainNext.action)}>{view.trainNext.action.label}</button> : null}
        </article>
      </div>

      {view.experiment ? <aside className="primaryReportExperiment">
        <span>Optional experiment</span>
        <strong>{view.experiment.opening} · {view.experiment.role}</strong>
        <p>{view.experiment.reason}</p>
        <small>{view.experiment.hasPersonalEvidence ? "Separate experimental evidence" : "No personal game evidence yet"}</small>
      </aside> : null}

      {view.confidenceWarning ? <aside className="primaryReportConfidence" role="status"><strong>Confidence is still developing</strong><p>{view.confidenceWarning}</p></aside> : null}
      <OpeningFitScoreDisclosure model={model} report={report} previousReport={previousReport} />
      <div className="primaryReportMore"><button type="button" className="secondaryBtn" onClick={onFullReport}>Explore repertoire details</button><small>Rankings, role coverage, games, exclusions, history and report tools remain in the report views.</small></div>
    </section>
  );
}
