import { useEffect, useMemo, useState } from "react";
import {
  WEAKEST_LINE_TRAINING_COMPLETED_EVENT,
  buildWeakestLineTrainingTarget,
  countWeakestLineCompletionsForOpening,
  readWeakestLineTrainingEvents,
} from "../services/weakestLineTraining";
import "./OpeningJourney.css";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function clampPercent(value, fallback = 0) {
  const number = numberValue(value, fallback);
  return Math.max(0, Math.min(100, Math.round(number <= 1 ? number * 100 : number)));
}

function clampJourneyScore(value, fallback = 0) {
  const number = numberValue(value, fallback);
  if (!Number.isFinite(number)) return fallback;
  if (number <= 100) return Math.round(number * 10);
  return Math.max(0, Math.min(1000, Math.round(number)));
}

function getRetentionMetrics(data = {}) {
  return data.retentionMetrics || data.retention_metrics || {};
}

function getOpeningFitScore(data, fitData) {
  const metrics = getRetentionMetrics(data);
  const scoreObject =
    data?.openingfitScore ||
    data?.openingfit_score ||
    data?.openingFitScoreV2 ||
    data?.opening_fit_score_v2 ||
    metrics.openingFitScore ||
    metrics.opening_fit_score ||
    null;

  return {
    value: clampJourneyScore(
      scoreObject?.score ??
        scoreObject?.scoreOutOf1000 ??
        scoreObject?.score_out_of_1000 ??
        data?.openingFitScore ??
        data?.opening_fit_score ??
        fitData?.overallScore ??
        fitData?.score,
      0
    ),
    explanation:
      scoreObject?.explanation ||
      "A practical opening progress score from repertoire health, mastery, weak lines, training, and consistency.",
  };
}

function getOpeningIdentity(data = {}) {
  const metrics = getRetentionMetrics(data);
  const identity =
    data.openingIdentityV2 ||
    data.opening_identity_v2 ||
    metrics.openingIdentity ||
    metrics.opening_identity ||
    data.openingIdentity ||
    data.opening_identity ||
    null;
  if (typeof identity === "string") {
    return {
      identity,
      confidence: 0,
      reasons: [],
      suggestedOpeningDirection: "",
    };
  }
  return identity;
}

function getRepertoireHealth(data = {}) {
  const metrics = getRetentionMetrics(data);
  return data.repertoireHealth || data.repertoire_health || metrics.repertoireHealth || metrics.repertoire_health || {};
}

function getOpeningMastery(data = {}) {
  const metrics = getRetentionMetrics(data);
  return asArray(data.openingMastery || data.opening_mastery || metrics.openingMastery || metrics.opening_mastery);
}

function getWeakestTracking(data = {}) {
  const metrics = getRetentionMetrics(data);
  return data.weakestLineTracking || data.weakest_line_tracking || metrics.weakestLineTracking || metrics.weakest_line_tracking || {};
}

function getOneThingToFix(data = {}) {
  const metrics = getRetentionMetrics(data);
  return data.oneThingToFix || data.one_thing_to_fix || metrics.oneThingToFix || metrics.one_thing_to_fix || null;
}

function getSnapshotPayload(row = {}) {
  const source = row || {};
  return source.snapshot || source.summary || source.retention_snapshot || source.retentionSnapshot || source;
}

function getSnapshotScore(row = {}) {
  row = row || {};
  const payload = getSnapshotPayload(row);
  const value = row.opening_fit_score ?? payload.opening_fit_score ?? payload.openingFitScore;
  if (value === null || value === undefined || value === "") return null;
  return clampJourneyScore(value, null);
}

function getPreviousSnapshot(retentionSnapshots = [], currentData = {}) {
  const currentDate = String(currentData.importedAt || currentData.imported_at || currentData.lastUpdated || "");
  const sorted = [...asArray(retentionSnapshots)]
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.created_at || b.createdAt || b.updated_at || 0) - Date.parse(a.created_at || a.createdAt || a.updated_at || 0));

  if (!sorted.length) return null;
  return sorted.find((row) => String(row.created_at || row.createdAt || "").slice(0, 19) !== currentDate.slice(0, 19)) || sorted[1] || null;
}

function scoreTrendText(currentScore, previousSnapshot) {
  const previousScore = getSnapshotScore(previousSnapshot);
  if (previousScore === null || previousScore === undefined || !Number.isFinite(Number(previousScore))) {
    return "Baseline for future reports";
  }
  const delta = currentScore - previousScore;
  if (Math.abs(delta) < 1) return "No major change since the last snapshot";
  return `${delta > 0 ? "+" : ""}${delta} vs previous snapshot`;
}

function healthStatus(health = {}) {
  const score = clampPercent(health.score ?? health.repertoireHealthScore ?? health.repertoire_health_score, 0);
  const unstable = numberValue(health.unstableWeakLines ?? health.unstable_weak_lines, 0);
  const improvement = numberValue(health.recentImprovement ?? health.recent_improvement, 50);

  if (score >= 78 && unstable <= 1) return "Healthy";
  if (improvement >= 62 && score >= 55) return "Improving";
  if (unstable >= 2 || score < 45) return "Unstable";
  return "Needs attention";
}

function trendLabel(trend) {
  const label = typeof trend === "string" ? trend : trend?.label || trend?.status || "";
  const clean = String(label || "Stable");
  if (/improv/i.test(clean)) return "Up - improving";
  if (/declin|down|worse/i.test(clean)) return "Down - needs review";
  return "Stable";
}

function weaknessText(item = {}) {
  const weakLines = numberValue(item.weakLineCount ?? item.weak_line_count, 0);
  if (weakLines > 0) return `${weakLines} weak line${weakLines === 1 ? "" : "s"}`;
  const lossRate = clampPercent(item.lossRate ?? item.loss_rate, 0);
  if (lossRate >= 55) return "High loss rate";
  if (clampPercent(item.consistencyScore ?? item.consistency_score, 100) < 55) return "Inconsistent plans";
  return "No clear weakness";
}

function decayText(item = {}) {
  const risk = String(item.decayRisk || item.decay_risk || "none").toLowerCase();
  if (risk === "high") return "Needs refresh";
  if (risk === "medium" || risk === "low") return "Getting stale";
  return "Fresh";
}

function lineName(line) {
  if (!line) return "";
  const opening = line.opening || line.name || line.trainingTarget || "Unknown line";
  const variation = line.variation || line.line || line.moveLine || line.move_line || "";
  return variation && variation !== opening ? `${opening}: ${variation}` : opening;
}

function weakestLineText(data = {}) {
  const tracking = getWeakestTracking(data);
  const current = tracking.currentWeakestLine || tracking.current_weakest_line;
  const previous = tracking.previousWeakestLine || tracking.previous_weakest_line;
  const changed = Boolean(tracking.changedSinceLastAnalysis ?? tracking.changed_since_last_analysis);
  const currentName = lineName(current) || "not enough repeated lines yet";
  const previousName = lineName(previous);

  if (changed && previousName) return `Your weakest line changed from ${previousName} to ${currentName}`;
  return `Your current weakest line is still ${currentName}`;
}

function fixText(fix) {
  return fix?.shortDisplayText || fix?.short_display_text || fix?.exactIssue || fix?.exact_issue || "Review one repeated opening line from this report.";
}

export default function OpeningJourney({ data, fitData, retentionSnapshots = [], onPractice, onNavigate }) {
  const [weakestLineTrainingEvents, setWeakestLineTrainingEvents] = useState(() => readWeakestLineTrainingEvents());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleCompletion = (event) => {
      setWeakestLineTrainingEvents(event.detail?.events || readWeakestLineTrainingEvents());
    };

    window.addEventListener(WEAKEST_LINE_TRAINING_COMPLETED_EVENT, handleCompletion);
    return () => window.removeEventListener(WEAKEST_LINE_TRAINING_COMPLETED_EVENT, handleCompletion);
  }, []);

  const journey = useMemo(() => {
    if (!data) return null;
    const openingFitScore = getOpeningFitScore(data, fitData);
    const previousSnapshot = getPreviousSnapshot(retentionSnapshots, data);
    const health = getRepertoireHealth(data);
    const identity = getOpeningIdentity(data);
    const healthScore = clampPercent(health.score ?? health.repertoireHealthScore ?? health.repertoire_health_score, Math.round(openingFitScore.value / 10));
    const mastery = getOpeningMastery(data)
      .map((item) => ({
        ...item,
        opening: item.opening || item.name || "Opening",
        localWeakestLineTrainingCount: countWeakestLineCompletionsForOpening(item.opening || item.name || "", weakestLineTrainingEvents),
        masteryScore: clampPercent(item.masteryScore ?? item.mastery_score, 0),
        masteryLevel: Math.max(1, Math.min(10, Math.round(numberValue(item.masteryLevel ?? item.mastery_level, 1)))),
      }))
      .map((item) => {
        const boostedScore = Math.min(100, item.masteryScore + Math.min(8, item.localWeakestLineTrainingCount * 2));
        const boostedLevel = Math.max(item.masteryLevel, Math.min(10, Math.ceil(boostedScore / 10)));
        return {
          ...item,
          displayMasteryScore: boostedScore,
          displayMasteryLevel: boostedLevel,
          localTrainingAdded: item.localWeakestLineTrainingCount,
        };
      })
      .sort((a, b) => b.masteryScore - a.masteryScore)
      .slice(0, 3);
    const oneFix = getOneThingToFix(data);
    const weakestTraining = buildWeakestLineTrainingTarget(data);
    return {
      openingFitScore,
      previousSnapshot,
      health,
      identity,
      healthScore,
      mastery,
      oneFix,
      weakestTraining,
      fixOpening: oneFix?.opening || oneFix?.trainingTarget || oneFix?.training_target || "",
    };
  }, [data, fitData, retentionSnapshots, weakestLineTrainingEvents]);

  if (!data || !journey) return null;

  return (
    <section className="openingJourney" id="opening-journey" aria-labelledby="opening-journey-title">
      <div className="openingJourneyHeader">
        <div>
          <p className="eyebrow">Opening Journey</p>
          <h2 id="opening-journey-title">Opening Journey</h2>
        </div>
        <span>{scoreTrendText(journey.openingFitScore.value, journey.previousSnapshot)}</span>
      </div>

      <div className="openingJourneyGrid">
        <article className="openingJourneyScore">
          <span>OpeningFit Score</span>
          <strong>{journey.openingFitScore.value}</strong>
          <p>{journey.openingFitScore.explanation}</p>
        </article>

        <article className="openingJourneyHealth">
          <span>Repertoire Health</span>
          <strong>{journey.healthScore}/100</strong>
          <p>{healthStatus(journey.health)}</p>
        </article>

        <article className="openingJourneyWeakLine">
          <span>Weakest Line Changed</span>
          <p>{weakestLineText(data)}</p>
          {journey.weakestTraining.available ? (
            <button type="button" onClick={() => onPractice?.(journey.weakestTraining.target)}>
              Train my weakest line
            </button>
          ) : (
            <small>{journey.weakestTraining.message}</small>
          )}
        </article>
      </div>

      {journey.identity ? (
        <article className="openingJourneyIdentity">
          <div>
            <span>Opening Identity</span>
            <strong>{journey.identity.identity || journey.identity.label || "Opening profile"}</strong>
            <small>{clampPercent(journey.identity.confidencePercentage ?? journey.identity.confidence_percentage ?? journey.identity.confidence, 0)}% confidence</small>
          </div>
          {asArray(journey.identity.reasons).length ? (
            <ul>
              {asArray(journey.identity.reasons).slice(0, 2).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {journey.identity.suggestedOpeningDirection || journey.identity.suggested_opening_direction ? (
            <p>{journey.identity.suggestedOpeningDirection || journey.identity.suggested_opening_direction}</p>
          ) : null}
        </article>
      ) : null}

      {journey.mastery.length ? (
        <div className="openingJourneyMastery" aria-label="Opening mastery">
          {journey.mastery.map((item) => (
            <article key={`${item.opening}-${item.variation || item.masteryScore}`}>
              <div>
                <span>{item.variation || "Opening mastery"}</span>
                <h3>{item.opening}</h3>
              </div>
              <div className="openingJourneyMasteryStats">
                <strong>Level {item.displayMasteryLevel}/10</strong>
                <em>{item.displayMasteryScore}%</em>
              </div>
              <p>{trendLabel(item.recentTrend || item.recent_trend)}</p>
              <small>
                {weaknessText(item)} - {decayText(item)}
                {item.localTrainingAdded ? ` - ${item.localTrainingAdded} weakest-line session${item.localTrainingAdded === 1 ? "" : "s"} saved` : ""}
              </small>
            </article>
          ))}
        </div>
      ) : null}

      <article className="openingJourneyFix">
        <div>
          <span>One Thing To Fix</span>
          <strong>{fixText(journey.oneFix)}</strong>
          <p>{journey.oneFix?.whyItMatters || journey.oneFix?.why_it_matters || "Fix one repeated opening problem before adding more theory."}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (journey.weakestTraining.available && onPractice) onPractice(journey.weakestTraining.target);
            else if (journey.fixOpening && onPractice) onPractice(journey.fixOpening);
            else onNavigate?.({ view: "train", path: "/train", target: "training-plan" });
          }}
        >
          Train my weakest line
        </button>
      </article>
    </section>
  );
}
