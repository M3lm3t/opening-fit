import { buildPrimaryReportSummary } from "../lib/primaryReportSummary.js";
import { buildOpeningFitScoreTransparency } from "../lib/openingFitScoreTransparency.js";
import OpeningFitScoreDisclosure from "./OpeningFitScoreDisclosure.jsx";
import FeatureAccessPreview from "./FeatureAccessPreview.jsx";
import { canUseFeature, OPENINGFIT_FEATURES } from "../lib/premiumEntitlement.js";
import { isSampleReport } from "../fixtures/sampleReport.js";
import ReportGameCountSummary from "./ReportGameCountSummary.jsx";
import "./PrimaryReportSummary.css";

export default function PrimaryReportSummary({ model, report, previousReport = null, comparison = null, entitlement = null, onTraining, onFullReport, onUpgrade }) {
  const view = buildPrimaryReportSummary(model, report);
  const scoreView = buildOpeningFitScoreTransparency({ model, report, previousReport });
  const hasFullRepertoire = isSampleReport(report) || canUseFeature(entitlement, OPENINGFIT_FEATURES.FULL_REPERTOIRE);
  return (
    <section className="primaryReportSummary" aria-labelledby="primary-report-title">
      {isSampleReport(report) ? <p className="primaryReportSampleLabel">Sample report · Example data · <a href="/how-it-works">How analysis works</a></p> : null}
      <div className="primaryReportHero">
        <div className="primaryReportScore" aria-label={view.scoreLabel}>
          <span>{view.scoreLabel}</span><strong>{view.score ?? "—"}</strong><small>{view.score === null ? "Not enough evidence" : "/100"}</small><em>{scoreView.statusLabel}</em>
          <p>{scoreView.meaning}</p>
        </div>
        <div className="primaryReportVerdict">
          <span>Coach verdict</span><h1 id="primary-report-title">Your opening plan</h1><p>{view.verdict}</p>
          <small>{view.confidence}</small>
        </div>
      </div>

      <OpeningFitScoreDisclosure model={model} report={report} previousReport={previousReport} />
      <ReportGameCountSummary report={report} />

      {view.confidenceWarning ? <aside className="primaryReportConfidence" role="status"><strong>Confidence is still developing</strong><p>{view.confidenceWarning}</p></aside> : null}
      {hasFullRepertoire ? <section className="primaryReportRepertoire" id="report-repertoire" aria-labelledby="primary-repertoire-title">
        <header><div><span>Current repertoire</span><h2 id="primary-repertoire-title">Your three core slots</h2></div>{view.incompleteRepertoire ? <strong>Still building</strong> : <strong>Core slots covered</strong>}</header>
        <div>{view.slots.map((slot) => <article key={slot.key} className={!slot.complete ? "isIncomplete" : ""}><span>{slot.label}</span><h3>{slot.opening}</h3><p>{slot.confidence}</p></article>)}</div>
      </section> : <FeatureAccessPreview feature={OPENINGFIT_FEATURES.FULL_REPERTOIRE} title="Build your complete repertoire" onUpgrade={onUpgrade}>
        {view.slots[0]?.complete ? <article><strong>{view.slots[0].label}: {view.slots[0].opening}</strong><small>Your report remains useful; paid access saves and maintains every White and Black slot.</small></article> : null}
      </FeatureAccessPreview>}

      <section className="primaryReportProblem" aria-labelledby="primary-problem-title">
        <div><span>Primary problem</span><h2 id="primary-problem-title">{view.problem.title}</h2><p>{view.problem.reason}</p></div>
        <small>{view.problem.evidence}</small>
      </section>

      <section className="primaryReportTraining" aria-labelledby="primary-training-title">
        <div><span>Next training action</span><h2 id="primary-training-title">{view.training.title}</h2><p>{view.training.reason}</p></div>
        <button type="button" className="primaryBtn" onClick={() => onTraining?.(view.training.source)}>{view.training.cta}</button>
      </section>

      {comparison ? <div className="primaryReportComparison">{comparison}</div> : null}

      <div className="primaryReportMore"><button type="button" className="secondaryBtn" onClick={onFullReport}>View full report</button><small>Recommendations, evidence, detailed repertoire roles, sharing and report tools are preserved below.</small></div>
    </section>
  );
}
