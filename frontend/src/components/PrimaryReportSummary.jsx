import { buildPrimaryReportSummary } from "../lib/primaryReportSummary.js";
import ChessPositionBoard from "./ChessPositionBoard.jsx";
import { isSampleReport } from "../fixtures/sampleReport.js";
import "./PrimaryReportSummary.css";

function DecisionEvidence({ evidence, confidence, compact = false }) {
  const rows = [evidence?.gamesLabel, evidence?.results, evidence?.scoreRate].filter(Boolean);
  const label = confidence && confidence !== "Unavailable" ? confidence : evidence?.confidence;
  if (!rows.length && (!label || label === "Unavailable")) return null;
  return <div className={`primaryReportDecisionEvidence ${compact ? "isCompact" : ""}`} aria-label="Decision evidence">{rows.length ? <p>{rows.join(" · ")}</p> : null}{label && label !== "Unavailable" ? <small>Evidence: {label}</small> : null}</div>;
}

export default function PrimaryReportSummary({ model, report, view: suppliedView = null, section = "summary", onTraining, onPractice, onEvidence, onAnalyse, onFullReport }) {
  const view = suppliedView || buildPrimaryReportSummary(model, report);
  const scoreView = view.health;
  const sampleMode = isSampleReport(report);
  const actionAvailable = (action) => Boolean(action && ((action.type === "practice" && onPractice) || (action.type === "evidence" && onEvidence) || (action.type === "training" && onTraining) || (action.type === "analyse" && onAnalyse)));
  const runAction = (action) => {
    if (action?.type === "practice") onPractice?.(action.target);
    else if (action?.type === "evidence") onEvidence?.(action.target);
    else if (action?.type === "analyse") onAnalyse?.();
    else if (action?.type === "training") onTraining?.(action.target);
  };
  const identityProps = { "data-canonical-decision-id": view.decisionId || undefined, "data-canonical-diagnosis-id": view.diagnosisId || undefined };

  if (section === "priorities") return (
    <section className="primaryReportPriorities" aria-labelledby="report-priorities-view-title" {...identityProps}>
      <header className="reportViewHeader"><span>Priorities</span><h2 id="report-priorities-view-title" tabIndex="-1">Repair, keep and optional experiment</h2><p>Every item below comes from the same canonical report decision.</p></header>
      <div className="primaryReportCommandGrid" aria-label="Repair, keep and optional experiment">
        <article className={`primaryReportCommand primaryReportCommand--repair ${view.repair.available ? "isActionable" : "isCautious"}`} data-command-role="repair"><span>Repair</span><h3>{view.repair.opening}</h3><strong>{view.repair.role}</strong><DecisionEvidence evidence={view.repair.observed} confidence={view.repair.confidence} />{view.repair.chessEvidence?.moveLine ? <div className="primaryReportMoveLine"><span>Recorded branch</span><code>{view.repair.chessEvidence.moveLine}</code></div> : null}<p>{view.repair.diagnosis}</p>{view.repair.available && onEvidence ? <button type="button" className="secondaryBtn" onClick={() => onEvidence(view.repair.source)}>View supporting games</button> : null}</article>
        <article className="primaryReportCommand primaryReportCommand--keep" data-command-role="keep"><span>{view.keep.label}</span><h3>{view.keep.opening}</h3><strong>{view.keep.role}</strong><DecisionEvidence evidence={view.keep.observed} confidence={view.keep.confidence} /><p>{view.keep.reason}</p>{view.keep.available && onEvidence ? <button type="button" className="secondaryBtn" onClick={() => onEvidence(view.keep.source)}>View supporting games</button> : null}</article>
        {view.experiment ? <article className="primaryReportCommand primaryReportCommand--experiment" data-command-role="experiment"><span>Optional experiment</span><h3>{view.experiment.opening}</h3><strong>{view.experiment.role}</strong><DecisionEvidence evidence={view.experiment.observed} confidence={view.experiment.confidence} compact /><p>{view.experiment.reason}</p><small>{view.experiment.hasPersonalEvidence ? "Separate experimental evidence" : "No personal game evidence yet"}</small></article> : null}
      </div>
    </section>
  );

  return (
    <section className="primaryReportSummary" aria-labelledby="primary-report-title" data-report-command-centre="true" {...identityProps}>
      {sampleMode ? <p className="primaryReportSampleLabel">Illustrative example · Fictional data · <a href="/how-it-works">How analysis works</a></p> : null}
      <section className="primaryReportHealth" aria-labelledby="primary-report-title"><div><span>Repertoire Health</span><h2 id="primary-report-title" tabIndex="-1">{scoreView.scoreDisplayLabel} — {scoreView.developmentState.label}</h2><p className="primaryReportHealthSummary">{scoreView.explanation}</p><strong>{view.completenessLabel} · {view.establishedRoleCount} of {view.totalRoleCount} roles established</strong></div><div className="primaryReportHealthExplanation">{sampleMode ? <p>Role completeness shows whether the fictional repertoire fills all three jobs.</p> : null}<p>{view.verdict}</p><small>{view.confidence}</small></div></section>
      <article className="primaryReportCommand primaryReportCommand--train primaryReportTrainNext" data-command-role="train-next"><span>Train next</span><h3>{view.trainNext.title}</h3><DecisionEvidence evidence={view.trainNext.observed} confidence={view.trainNext.confidence} compact />{view.trainNext.chessEvidence?.positionFen ? <div className="primaryReportPosition"><ChessPositionBoard position={view.trainNext.chessEvidence.positionFen} orientation={view.trainNext.chessEvidence.orientation} interactive={false} /><div><strong>Position to train</strong>{view.trainNext.chessEvidence.moveLine ? <code>{view.trainNext.chessEvidence.moveLine}</code> : null}</div></div> : null}<p>{view.trainNext.reason}</p>{view.trainNext.provenanceLimitation ? <details><summary>Why this task?</summary><p>{view.trainNext.provenanceLimitation} This is a general-setup rehearsal, not an engine-best line or a claim about a source game.</p></details> : null}<p><strong>Success:</strong> {view.trainNext.successCheck}</p><small>Approximately {view.trainNext.duration} minutes</small>{actionAvailable(view.trainNext.action) ? <button type="button" className="primaryBtn" data-primary-training-cta="true" data-decision-id={view.decisionId || undefined} data-diagnosis-id={view.diagnosisId || undefined} onClick={() => runAction(view.trainNext.action)}>{view.trainNext.action.label}</button> : null}</article>
      {view.confidenceWarning ? <aside className="primaryReportConfidence" role="status"><strong>Confidence is still developing</strong><p>{view.confidenceWarning}</p></aside> : null}
      <div className="primaryReportMore"><button type="button" className="secondaryBtn" onClick={onFullReport}>View evidence and methodology</button><small>Games, confidence, filters, exclusions and report tools remain in Evidence.</small></div>
    </section>
  );
}
