import { useMemo } from "react";
import "./WhatChangedSinceLastAnalysis.css";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundValue(value, fallback = null) {
  const number = numberValue(value, fallback);
  return number === null || number === undefined ? fallback : Math.round(number);
}

function clampJourneyScore(value, fallback = null) {
  const number = numberValue(value, fallback);
  if (number === null || number === undefined) return fallback;
  if (number <= 100) return Math.round(number * 10);
  return Math.max(0, Math.min(1000, Math.round(number)));
}

function payload(row = {}) {
  const source = row || {};
  return source.snapshot || source.summary || source.retention_snapshot || source.retentionSnapshot || source;
}

function createdAt(row = {}) {
  const source = row || {};
  return source.created_at || source.createdAt || source.updated_at || source.updatedAt || "";
}

function retentionMetrics(source = {}) {
  source = source || {};
  const body = payload(source);
  return body.retentionMetrics || body.retention_metrics || {};
}

function openingFitScore(source = {}, fitData = null) {
  source = source || {};
  const body = payload(source);
  const metrics = retentionMetrics(source);
  const scoreObject =
    body.openingFitScoreV2 ||
    body.opening_fit_score_v2 ||
    body.openingfitScore ||
    body.openingfit_score ||
    metrics.openingFitScore ||
    metrics.opening_fit_score ||
    null;

  return clampJourneyScore(
    source.opening_fit_score ??
      source.openingFitScore ??
      body.opening_fit_score ??
      body.openingFitScore ??
      scoreObject?.score ??
      scoreObject?.scoreOutOf1000 ??
      scoreObject?.score_out_of_1000 ??
      fitData?.overallScore ??
      fitData?.score,
    null
  );
}

function repertoireHealthScore(source = {}) {
  source = source || {};
  const body = payload(source);
  const metrics = retentionMetrics(source);
  const health =
    body.repertoireHealth ||
    body.repertoire_health ||
    metrics.repertoireHealth ||
    metrics.repertoire_health ||
    {};

  return roundValue(
    source.repertoire_health_score ??
      source.repertoireHealthScore ??
      body.repertoire_health_score ??
      body.repertoireHealthScore ??
      health.score ??
      health.healthScore,
    null
  );
}

function masteryRows(source = {}) {
  source = source || {};
  const body = payload(source);
  const metrics = retentionMetrics(source);
  return asArray(
    source.top_opening_mastery ||
      source.topOpeningMastery ||
      body.top_opening_mastery ||
      body.topOpeningMastery ||
      body.openingMastery ||
      body.opening_mastery ||
      metrics.openingMastery ||
      metrics.opening_mastery
  ).filter(Boolean);
}

function masteryName(item = {}) {
  item = item || {};
  const opening = item.opening || item.name || "Opening";
  const variation = item.variation || item.line || "";
  return variation && variation !== opening ? `${opening}: ${variation}` : opening;
}

function normaliseKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function masteryScore(item = {}) {
  item = item || {};
  return roundValue(item.masteryScore ?? item.mastery_score, 0);
}

function masteryMove(current = [], previous = [], direction = "gain") {
  const previousByName = new Map(asArray(previous).filter(Boolean).map((item) => [masteryName(item).toLowerCase(), item]));
  const moves = asArray(current)
    .filter(Boolean)
    .map((item) => {
      const old = previousByName.get(masteryName(item).toLowerCase());
      if (!old) return null;
      return {
        name: masteryName(item),
        delta: masteryScore(item) - masteryScore(old),
      };
    })
    .filter(Boolean)
    .filter((item) => (direction === "gain" ? item.delta > 0 : item.delta < 0));

  if (!moves.length) return null;
  return moves.sort((a, b) => (direction === "gain" ? b.delta - a.delta : a.delta - b.delta))[0];
}

function weakLine(source = {}) {
  source = source || {};
  const body = payload(source);
  const metrics = retentionMetrics(source);
  const tracking =
    body.weakestLineTracking ||
    body.weakest_line_tracking ||
    metrics.weakestLineTracking ||
    metrics.weakest_line_tracking ||
    {};

  return (
    source.weakest_line ||
    source.weakestLine ||
    body.weakest_line ||
    body.weakestLine ||
    tracking.currentWeakestLine ||
    tracking.current_weakest_line ||
    null
  );
}

function lineName(line) {
  if (!line) return "";
  const opening = line.opening || line.name || line.trainingTarget || "";
  const variation = line.variation || line.line || line.moveLine || line.move_line || "";
  if (!opening && !variation) return "";
  return variation && variation !== opening ? `${opening}: ${variation}` : opening || variation;
}

function weakLineRows(source = {}) {
  source = source || {};
  const body = payload(source);
  const metrics = body.openingFitMetrics || body.opening_fit_metrics || {};
  return [
    weakLine(source),
    ...asArray(body.problemLines || body.problem_lines),
    ...asArray(body.weakLines || body.weak_lines),
    ...asArray(metrics.weakLines || metrics.weak_lines),
  ].filter(Boolean);
}

function weakLineKeys(source = {}) {
  return new Set(weakLineRows(source).map(lineName).filter(Boolean).map(normaliseKey));
}

function openingFromLineName(value = "") {
  return String(value || "").split(":")[0].trim();
}

function currentEvidenceForFixedLine(data = {}, fixedLineName = "") {
  data = data || {};
  const openingKey = normaliseKey(openingFromLineName(fixedLineName));
  if (!openingKey) return null;

  const mastery = masteryRows(data).find((item) => {
    const itemKey = normaliseKey(item?.opening || item?.name);
    return itemKey && (itemKey.includes(openingKey) || openingKey.includes(itemKey));
  });

  if (mastery) {
    const games = numberValue(mastery.gamesPlayed ?? mastery.games_played, 0);
    const confidence = String(mastery.confidence || mastery.confidenceLevel || mastery.confidence_level || "").toLowerCase();
    const weakLines = numberValue(mastery.weakLineCount ?? mastery.weak_line_count, 0);
    const score = masteryScore(mastery);
    const lossRate = numberValue(mastery.lossRate ?? mastery.loss_rate, 0);
    const confidenceOk = confidence ? !confidence.includes("low") : games >= 10;
    const noLongerWeak = weakLines === 0 && score >= 45 && lossRate < 55;

    return {
      games,
      confidenceOk,
      noLongerWeak,
      masteryImproved: numberValue(mastery.recentTrend?.scoreDelta ?? mastery.recent_trend?.scoreDelta, 0) > 0,
    };
  }

  const rows = [
    ...asArray(data.top_openings || data.topOpenings),
    ...asArray(data.opening_stats || data.openingStats),
    ...asArray(data.best_openings || data.bestOpenings),
  ];
  const row = rows.find((item) => normaliseKey(item?.opening || item?.name).includes(openingKey));
  if (!row) return null;

  const games = numberValue(row.games ?? row.gamesPlayed ?? row.games_played, 0);
  const winRate = numberValue(row.winRate ?? row.win_rate, null);
  const lossRate = numberValue(row.lossRate ?? row.loss_rate, null);

  return {
    games,
    confidenceOk: games >= 10,
    noLongerWeak:
      games >= 10 &&
      (lossRate === null || lossRate < 55) &&
      (winRate === null || winRate >= 45),
    masteryImproved: false,
  };
}

function fixedLineEvidence(data = {}, previous = {}) {
  const currentWeakKeys = weakLineKeys(data);
  const previousLine = weakLineRows(previous)
    .map((line) => ({ line, name: lineName(line) }))
    .find((item) => item.name && !currentWeakKeys.has(normaliseKey(item.name)));

  if (!previousLine) return null;

  const evidence = currentEvidenceForFixedLine(data, previousLine.name);
  if (!evidence || evidence.games < 10 || !evidence.confidenceOk || !evidence.noLongerWeak) return null;

  return {
    name: previousLine.name,
    games: evidence.games,
    masteryImproved: evidence.masteryImproved,
  };
}

function staleOpening(source = {}) {
  return masteryRows(source).find((item) => {
    const risk = String(item.decayRisk || item.decay_risk || "none").toLowerCase();
    return risk === "medium" || risk === "high";
  });
}

function previousSnapshot(retentionSnapshots = [], currentData = {}) {
  const sorted = [...asArray(retentionSnapshots)]
    .filter(Boolean)
    .sort((a, b) => Date.parse(createdAt(b) || 0) - Date.parse(createdAt(a) || 0));

  if (!sorted.length) return null;

  const currentDate = Date.parse(
    currentData.importedAt ||
      currentData.imported_at ||
      currentData.lastUpdated ||
      currentData.last_updated ||
      ""
  );
  const latestDate = Date.parse(createdAt(sorted[0]) || 0);
  const latestLooksCurrent = Number.isFinite(currentDate) && Number.isFinite(latestDate) && Math.abs(latestDate - currentDate) < 5 * 60 * 1000;

  return latestLooksCurrent ? sorted[1] || null : sorted[0];
}

function deltaText(label, current, previous, suffix = "") {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  const delta = current - previous;
  if (!delta) return null;
  const direction = delta > 0 ? "increased" : "decreased";
  return `${label} ${direction} by ${Math.abs(delta)}${suffix}.`;
}

function buildInsights(data, fitData, previous, fixedLine) {
  const currentScore = openingFitScore(data, fitData);
  const previousScore = openingFitScore(previous);
  const currentHealth = repertoireHealthScore(data);
  const previousHealth = repertoireHealthScore(previous);
  const currentMastery = masteryRows(data);
  const previousMastery = masteryRows(previous);
  const currentWeak = lineName(weakLine(data));
  const previousWeak = lineName(weakLine(previous));
  const gain = masteryMove(currentMastery, previousMastery, "gain");
  const drop = masteryMove(currentMastery, previousMastery, "drop");
  const currentWeakKeys = weakLineKeys(data);
  const previousWeakKeys = weakLineKeys(previous);
  const fixedWeakLine = fixedLine ? null : [...previousWeakKeys].find((key) => !currentWeakKeys.has(key));
  const newWeakLine = [...currentWeakKeys].find((key) => !previousWeakKeys.has(key));
  const stale = staleOpening(data);

  return [
    deltaText("OpeningFit Score", currentScore, previousScore),
    deltaText("Repertoire Health", currentHealth, previousHealth, "/100"),
    currentWeak && previousWeak && currentWeak !== previousWeak
      ? `Weakest line changed from ${previousWeak} to ${currentWeak}.`
      : null,
    gain ? `${gain.name} had the biggest mastery gain: +${gain.delta}.` : null,
    drop ? `${drop.name} had the biggest mastery drop: ${drop.delta}.` : null,
    fixedWeakLine ? `A previous weak line is no longer showing as a current weak line: ${fixedWeakLine}.` : null,
    newWeakLine ? `A new weak line appeared: ${newWeakLine}.` : null,
    stale ? `${masteryName(stale)} may need a refresh soon.` : null,
  ].filter(Boolean).slice(0, 5);
}

export default function WhatChangedSinceLastAnalysis({ data, fitData, retentionSnapshots = [] }) {
  const summary = useMemo(() => {
    const previous = previousSnapshot(retentionSnapshots, data);
    const fixedLine = previous ? fixedLineEvidence(data || {}, previous) : null;
    return {
      previous,
      fixedLine,
      insights: previous ? buildInsights(data || {}, fitData, previous, fixedLine) : [],
    };
  }, [data, fitData, retentionSnapshots]);

  if (!data) return null;

  return (
    <section className="whatChangedSinceLastAnalysis" aria-labelledby="what-changed-title">
      <div className="whatChangedSinceLastAnalysisHeader">
        <div>
          <p className="eyebrow">Since last analysis</p>
          <h2 id="what-changed-title">What changed since last analysis</h2>
        </div>
      </div>

      {summary.previous ? (
        summary.fixedLine || summary.insights.length ? (
          <>
            {summary.fixedLine ? (
              <article className="youFixedItCard">
                <span>You fixed it</span>
                <strong>
                  Your previous weak line, {summary.fixedLine.name}, is no longer showing as a major weakness.
                </strong>
                <p>
                  This is based on {summary.fixedLine.games} current games. Keep checking it, but it no longer needs to be treated as the main repair job.
                </p>
              </article>
            ) : null}
            {summary.insights.length ? (
              <ul>
                {summary.insights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p>No clear opening change stood out against the previous snapshot.</p>
        )
      ) : (
        <p>Analyse again after playing more games to see what changed.</p>
      )}
    </section>
  );
}
