import { useMemo } from "react";
import InfoHint from "./InfoHint";
import { buildOpeningScorePresentation } from "../services/openingScorePresentation";
import "./OpeningScoreProgress.css";

const SCORE_COPY =
  "The OpeningFit Score is a coaching score based on your analysed games. It looks at how consistently you reach playable positions, how focused your repertoire is, and where recurring opening problems appear. It is designed to track your personal progress, not compare you with titled players.";

function formatDate(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Recent";
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function modelFor(props) {
  return buildOpeningScorePresentation(props);
}

export function OpeningScoreBreakdown({ data, fitData, reportHistory = [], openingFitUserState = [], onAction }) {
  const model = useMemo(
    () => modelFor({ data: data || {}, fitData, reportHistory, openingFitUserState }),
    [data, fitData, reportHistory, openingFitUserState]
  );

  if (!data) {
    return (
      <section className="openingScoreBreakdown openingScoreEmpty">
        <span>OpeningFit Score</span>
        <h2>Your score appears after one analysis.</h2>
        <p>Analyse recent games and OpeningFit will explain what is helping or holding back the score.</p>
      </section>
    );
  }

  return (
    <section className="openingScoreBreakdown" aria-labelledby="opening-score-breakdown-title">
      <div className="openingScoreBreakdownHeader">
        <div>
          <p className="eyebrow">OpeningFit Score</p>
          <div className="openingScoreTitleRow">
            <h2 id="opening-score-breakdown-title">{model.score ?? "-"} / 100</h2>
            <InfoHint label="How is the OpeningFit Score calculated?">{SCORE_COPY}</InfoHint>
          </div>
          <p>{model.label} - {model.trend}</p>
        </div>
        <div className="openingScoreTrendBadge">
          <span>Trend</span>
          <strong>{model.delta === null ? "New" : `${model.delta > 0 ? "+" : ""}${model.delta}`}</strong>
        </div>
      </div>

      <div className="openingScoreFactorGrid">
        {model.factors.map((factor) => (
          <article key={factor.key} className="openingScoreFactor">
            <div>
              <span>{factor.title}</span>
              <strong>{factor.status}</strong>
            </div>
            <p>{factor.text}</p>
            {onAction ? (
              <button type="button" onClick={() => onAction(factor.action)}>
                Go to priority
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function OpeningProgressTimeline({ data, fitData, reportHistory = [], openingFitUserState = [], onAction }) {
  const model = useMemo(
    () => modelFor({ data: data || {}, fitData, reportHistory, openingFitUserState }),
    [data, fitData, reportHistory, openingFitUserState]
  );

  return (
    <section className="openingProgressTimeline" aria-labelledby="opening-progress-timeline-title">
      <div className="openingScoreSectionHeader">
        <div>
          <p className="eyebrow">Am I improving?</p>
          <h2 id="opening-progress-timeline-title">How your opening profile is changing</h2>
        </div>
        {onAction ? <button type="button" onClick={() => onAction("analyse")}>Refresh analysis</button> : null}
      </div>

      {!model.timeline.length ? (
        <div className="openingProgressEmpty">
          <strong>Your progress story starts after your next analysis.</strong>
          <span>OpeningFit will show score changes, repertoire milestones, and completed training here once there is history.</span>
        </div>
      ) : (
        <ol className="openingProgressTimelineList">
          {model.timeline.map((item, index) => (
            <li key={`${item.title}-${item.date}-${index}`} className={`openingProgressTimelineItem openingProgressTimelineItem--${item.type}`}>
              <time>{formatDate(item.date)}</time>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function OpeningMilestones({ data, fitData, reportHistory = [], openingFitUserState = [] }) {
  const model = useMemo(
    () => modelFor({ data: data || {}, fitData, reportHistory, openingFitUserState }),
    [data, fitData, reportHistory, openingFitUserState]
  );

  return (
    <section className="openingMilestones" aria-labelledby="opening-milestones-title">
      <div className="openingScoreSectionHeader">
        <div>
          <p className="eyebrow">Milestones</p>
          <h2 id="opening-milestones-title">Quiet signs of progress</h2>
        </div>
      </div>
      <div className="openingMilestoneGrid">
        {model.milestones.slice(0, 6).map((milestone) => (
          <article key={milestone.title} className={milestone.done ? "openingMilestoneDone" : ""}>
            <span>{milestone.done ? "Reached" : "Next"}</span>
            <strong>{milestone.title}</strong>
            <p>{milestone.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MonthlyRecapCard({ data, fitData, reportHistory = [], openingFitUserState = [] }) {
  const model = useMemo(
    () => modelFor({ data: data || {}, fitData, reportHistory, openingFitUserState }),
    [data, fitData, reportHistory, openingFitUserState]
  );

  return (
    <section className="monthlyRecapCard" aria-labelledby="monthly-recap-title">
      <div>
        <p className="eyebrow">Monthly recap</p>
        <h2 id="monthly-recap-title">OpeningFit recap</h2>
        <p>{model.recap.verdict}</p>
      </div>
      <dl>
        <div>
          <dt>Score movement</dt>
          <dd>{model.recap.scoreMovement}</dd>
        </div>
        <div>
          <dt>Most improved opening</dt>
          <dd>{model.recap.mostImprovedOpening}</dd>
        </div>
        <div>
          <dt>Current focus</dt>
          <dd>{model.recap.biggestFocus}</dd>
        </div>
        <div>
          <dt>Games analysed</dt>
          <dd>{model.recap.gamesAnalysed || "More needed"}</dd>
        </div>
      </dl>
    </section>
  );
}

