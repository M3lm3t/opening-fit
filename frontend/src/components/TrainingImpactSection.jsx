import { useEffect, useMemo, useRef } from "react";
import { buildTrainingImpactView } from "../lib/trainingImpactPresentation.js";
import "./TrainingImpactSection.css";

export default function TrainingImpactSection({ report, reportHistory = [], repertoireEntries = [], source = "report", onViewHistory, onAnalytics }) {
  const view = useMemo(() => buildTrainingImpactView({ report, reportHistory, repertoireEntries, limit: 3 }), [report, reportHistory, repertoireEntries]);
  const viewedRef = useRef("");

  useEffect(() => {
    const signature = `${source}:${view.state}:${view.outcomes.map((item) => item.id).join(",")}`;
    if (viewedRef.current === signature) return;
    viewedRef.current = signature;
    void onAnalytics?.("training_impact_viewed", { source, resultCategory: view.state, games: view.outcomes.length });
  }, [onAnalytics, source, view.outcomes, view.state]);

  const openHistory = () => {
    void onAnalytics?.("training_history_opened", { source, resultCategory: view.state });
    onViewHistory?.();
  };

  return (
    <section className={`trainingImpact trainingImpact--${view.state}`} aria-labelledby={`training-impact-title-${source}`}>
      <header className="trainingImpactHeader">
        <div><span>Later-game follow-through</span><h2 id={`training-impact-title-${source}`}>{view.title}</h2></div>
        {view.hasHistory && onViewHistory ? <button type="button" className="secondaryBtn" onClick={openHistory}>View training history</button> : null}
      </header>
      <p className="trainingImpactMessage" role={view.state === "first-use" || view.state === "no-new-games" ? "status" : undefined}>{view.message}</p>
      {view.outcomes.length ? <div className="trainingImpactGrid">{view.outcomes.map((outcome) => (
        <article className={`trainingImpactCard trainingImpactCard--${outcome.status}`} key={outcome.id}>
          <header><div><span>{outcome.openingName}</span><h3>{outcome.applicationText}</h3></div><strong>{outcome.confidenceLabel}</strong></header>
          <dl>
            <div><dt>Task completion</dt><dd>{outcome.completionText}</dd></div>
            <div><dt>Later-game application</dt><dd>{outcome.applicationText}</dd></div>
            <div><dt>Broader opening results</dt><dd>{outcome.resultText}</dd></div>
          </dl>
        </article>
      ))}</div> : null}
    </section>
  );
}
