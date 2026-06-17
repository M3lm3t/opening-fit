import { useMemo } from "react";
import "./WeeklyOpeningSummary.css";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function scoreValue(value, fallback = null) {
  const number = numberValue(value, fallback);
  if (number === null || number === undefined) return fallback;
  return Math.round(number);
}

function snapshotPayload(row = {}) {
  return row.snapshot || row.summary || row;
}

function snapshotCreatedAt(row = {}) {
  return row.created_at || row.createdAt || row.updated_at || row.updatedAt || "";
}

function getOpeningFitScore(row = {}) {
  const payload = snapshotPayload(row);
  const direct =
    row.opening_fit_score ??
    row.openingFitScore ??
    payload.opening_fit_score ??
    payload.openingFitScore ??
    payload.openingfitScore?.score ??
    payload.openingfit_score?.score;
  return scoreValue(direct, null);
}

function getHealthScore(row = {}) {
  const payload = snapshotPayload(row);
  const direct =
    row.repertoire_health_score ??
    row.repertoireHealthScore ??
    payload.repertoire_health_score ??
    payload.repertoireHealthScore ??
    payload.repertoireHealth?.score ??
    payload.repertoire_health?.score;
  return scoreValue(direct, null);
}

function getMastery(row = {}) {
  const payload = snapshotPayload(row);
  return asArray(
    row.top_opening_mastery ||
      row.topOpeningMastery ||
      payload.top_opening_mastery ||
      payload.topOpeningMastery ||
      payload.openingMastery ||
      payload.opening_mastery
  );
}

function masteryName(item = {}) {
  const opening = item.opening || item.name || "Opening";
  const variation = item.variation || "";
  return variation && variation !== opening ? `${opening}: ${variation}` : opening;
}

function masteryScore(item = {}) {
  return scoreValue(item.mastery_score ?? item.masteryScore, 0);
}

function getWeakestLine(row = {}) {
  const payload = snapshotPayload(row);
  return row.weakest_line || row.weakestLine || payload.weakest_line || payload.weakestLine || null;
}

function lineName(line) {
  if (!line) return "not enough repeated lines yet";
  const opening = line.opening || line.name || line.trainingTarget || "Unknown line";
  const variation = line.variation || line.line || line.moveLine || line.move_line || "";
  return variation && variation !== opening ? `${opening}: ${variation}` : opening;
}

function getOneThingToFix(row = {}) {
  const payload = snapshotPayload(row);
  return row.one_thing_to_fix || row.oneThingToFix || payload.one_thing_to_fix || payload.oneThingToFix || null;
}

function fixText(fix) {
  return (
    fix?.shortDisplayText ||
    fix?.short_display_text ||
    fix?.exactIssue ||
    fix?.exact_issue ||
    "Review the clearest weak line from your latest report."
  );
}

function signedDelta(current, previous, suffix = "") {
  if (current === null || current === undefined || previous === null || previous === undefined) return "New";
  const delta = current - previous;
  if (delta === 0) return `No change${suffix}`;
  return `${delta > 0 ? "+" : ""}${delta}${suffix}`;
}

function biggestMasteryMove(current = [], previous = [], direction = "gain") {
  const previousByName = new Map(previous.map((item) => [masteryName(item).toLowerCase(), item]));
  const moves = current
    .map((item) => {
      const old = previousByName.get(masteryName(item).toLowerCase());
      if (!old) return null;
      return {
        name: masteryName(item),
        delta: masteryScore(item) - masteryScore(old),
      };
    })
    .filter(Boolean);

  if (!moves.length) return null;
  return [...moves].sort((a, b) => (direction === "gain" ? b.delta - a.delta : a.delta - b.delta))[0];
}

function newestSnapshots(retentionSnapshots = []) {
  return [...asArray(retentionSnapshots)]
    .filter(Boolean)
    .sort((a, b) => Date.parse(snapshotCreatedAt(b) || 0) - Date.parse(snapshotCreatedAt(a) || 0));
}

export default function WeeklyOpeningSummary({ retentionSnapshots = [], onAnalyse }) {
  const weekly = useMemo(() => {
    const [latest, previous] = newestSnapshots(retentionSnapshots);
    if (!latest || !previous) return { latest, previous };

    const latestScore = getOpeningFitScore(latest);
    const previousScore = getOpeningFitScore(previous);
    const latestHealth = getHealthScore(latest);
    const previousHealth = getHealthScore(previous);
    const latestMastery = getMastery(latest);
    const previousMastery = getMastery(previous);
    const gain = biggestMasteryMove(latestMastery, previousMastery, "gain");
    const drop = biggestMasteryMove(latestMastery, previousMastery, "drop");
    const latestWeakest = lineName(getWeakestLine(latest));
    const previousWeakest = lineName(getWeakestLine(previous));
    const oneFix = getOneThingToFix(latest);

    return {
      latest,
      previous,
      latestScore,
      previousScore,
      latestHealth,
      previousHealth,
      gain,
      drop,
      latestWeakest,
      previousWeakest,
      weakestChanged: latestWeakest !== previousWeakest,
      oneFix,
    };
  }, [retentionSnapshots]);

  if (!weekly.latest || !weekly.previous) {
    return (
      <section className="weeklyOpeningSummary weeklyOpeningSummaryEmpty">
        <div>
          <p className="eyebrow">Weekly Opening Report</p>
          <h2>Weekly Opening Report</h2>
          <p>Play and analyse more games to unlock your weekly Opening Report.</p>
        </div>
        <button type="button" onClick={onAnalyse}>
          Analyse new games to update your report
        </button>
      </section>
    );
  }

  return (
    <section className="weeklyOpeningSummary">
      <div className="weeklyOpeningSummaryHeader">
        <div>
          <p className="eyebrow">Weekly Opening Report</p>
          <h2>Weekly Opening Report</h2>
          <p>Newest snapshot compared with your previous saved opening snapshot.</p>
        </div>
        <button type="button" onClick={onAnalyse}>
          Analyse new games to update your report
        </button>
      </div>

      <div className="weeklyOpeningSummaryGrid">
        <article>
          <span>OpeningFit Score</span>
          <strong>{signedDelta(weekly.latestScore, weekly.previousScore)}</strong>
          <small>{weekly.latestScore ?? "No score"} now</small>
        </article>
        <article>
          <span>Repertoire Health</span>
          <strong>{signedDelta(weekly.latestHealth, weekly.previousHealth, "/100")}</strong>
          <small>{weekly.latestHealth ?? "No health score"} now</small>
        </article>
        <article>
          <span>Biggest mastery gain</span>
          <strong>{weekly.gain && weekly.gain.delta > 0 ? weekly.gain.name : "No clear gain yet"}</strong>
          <small>{weekly.gain ? signedDelta(weekly.gain.delta, 0, "%") : "Analyse again after more games"}</small>
        </article>
        <article>
          <span>Biggest mastery drop</span>
          <strong>{weekly.drop && weekly.drop.delta < 0 ? weekly.drop.name : "No clear drop"}</strong>
          <small>{weekly.drop ? signedDelta(weekly.drop.delta, 0, "%") : "Stable against last snapshot"}</small>
        </article>
      </div>

      <div className="weeklyOpeningSummaryBottom">
        <p>
          <strong>Weakest line:</strong>{" "}
          {weekly.weakestChanged
            ? `Changed from ${weekly.previousWeakest} to ${weekly.latestWeakest}.`
            : `Still ${weekly.latestWeakest}.`}
        </p>
        <p>
          <strong>One thing to fix this week:</strong> {fixText(weekly.oneFix)}
        </p>
      </div>
    </section>
  );
}
