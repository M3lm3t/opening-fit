import { normaliseOpeningKey } from "../data/openings";

export const OPENING_HEALTH_TREND_STABLE_THRESHOLD = 4;
export const OPENING_HEALTH_TREND_MIN_DAYS_APART = 7;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  if (!Number.isFinite(number)) return fallback;
  return number <= 1 && number >= 0 ? Math.round(number * 100) : Math.round(number);
}

function openingName(item = {}) {
  if (typeof item === "string") return item;
  return item.name || item.opening || item.openingName || item.opening_name || item.ecoName || item.eco_name || "";
}

function isUnknownOpening(name = "") {
  const clean = String(name || "").trim().toLowerCase();
  return !clean || clean === "unknown" || clean === "unknown opening" || clean.includes("unclassified");
}

function scoreFor(item = {}) {
  return numberValue(
    item.fitScore ??
      item.fit_score ??
      item.openingRating ??
      item.opening_rating ??
      item.healthScore ??
      item.health_score ??
      item.masteryScore ??
      item.mastery_score ??
      item.score ??
      item.winRate ??
      item.win_rate ??
      item.scoreRate ??
      item.score_rate,
    null
  );
}

function gamesFor(item = {}) {
  return numberValue(item.games ?? item.gamesPlayed ?? item.games_played ?? item.count ?? item.total, null);
}

function dateFor(row = {}) {
  const summary = row.summary || row.snapshot || {};
  const report = row.report || row.data || row.last_report || {};
  const raw =
    row.created_at ||
    row.createdAt ||
    row.updated_at ||
    row.updatedAt ||
    row.analysis_date ||
    row.analysisDate ||
    summary.reportDate ||
    summary.createdAt ||
    summary.importedAt ||
    report.importedAt ||
    report.imported_at ||
    report.lastUpdated ||
    report.last_updated ||
    "";
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function extractReport(row = {}) {
  return row.report || row.data || row.last_report || row.summary?.report || {};
}

function extractSummary(row = {}) {
  return row.summary || row.snapshot || {};
}

function collectOpeningsFromReport(report = {}, summary = {}) {
  const metrics = report.retentionMetrics || report.retention_metrics || {};
  const openingFitMetrics = report.openingFitMetrics || report.opening_fit_metrics || {};
  const sources = [
    summary.topOpenings,
    summary.top_openings,
    report.best_openings,
    report.bestOpenings,
    report.top_openings,
    report.topOpenings,
    report.opening_stats,
    report.openingStats,
    report.openings,
    openingFitMetrics.openings,
    metrics.openingMastery,
    metrics.opening_mastery,
    report.openingMastery,
    report.opening_mastery,
  ];
  const merged = new Map();

  sources.flatMap(asArray).forEach((item) => {
    if (!item || typeof item !== "object") return;
    const name = openingName(item);
    if (isUnknownOpening(name)) return;
    const score = scoreFor(item);
    if (score === null) return;
    const key = normaliseOpeningKey(name);
    if (!key) return;
    const games = gamesFor(item);
    const row = {
      key,
      name,
      score,
      games,
      source: item,
    };
    const current = merged.get(key);
    if (!current || (games ?? -1) > (current.games ?? -1)) {
      merged.set(key, row);
    }
  });

  return [...merged.values()];
}

function normaliseReportRow(row = {}, index = 0) {
  const report = extractReport(row);
  const summary = extractSummary(row);
  const openings = collectOpeningsFromReport(report, summary);
  return {
    id: row.id || `${dateFor(row) || "undated"}-${index}`,
    date: dateFor(row),
    index,
    openings,
  };
}

function daysBetween(currentDate, previousDate) {
  const current = Date.parse(currentDate);
  const previous = Date.parse(previousDate);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return Math.abs(current - previous) / 86400000;
}

function directionFor(delta) {
  if (Math.abs(delta) < OPENING_HEALTH_TREND_STABLE_THRESHOLD) return "stable";
  return delta > 0 ? "improving" : "slipping";
}

function summaryFor({ direction, delta, current }) {
  const abs = Math.abs(delta);
  const games = current.games ? ` across ${current.games} recent game${current.games === 1 ? "" : "s"}` : "";
  if (direction === "stable") {
    return `${current.name} is essentially unchanged${games}; the score moved less than ${OPENING_HEALTH_TREND_STABLE_THRESHOLD} points.`;
  }
  if (direction === "improving") {
    return `${current.name} is scoring higher than the previous comparable report by ${abs} point${abs === 1 ? "" : "s"}.`;
  }
  return `${current.name} is scoring lower than the previous comparable report by ${abs} point${abs === 1 ? "" : "s"}.`;
}

function hasCompatibleOpening(latest, previous) {
  const previousKeys = new Set(previous.openings.map((opening) => opening.key));
  return latest.openings.some((opening) => previousKeys.has(opening.key));
}

function choosePreviousReport(latest, olderReports) {
  const compatible = olderReports.filter((report) => hasCompatibleOpening(latest, report));
  const dated = compatible.find((report) => {
    const gap = daysBetween(latest.date, report.date);
    return gap !== null && gap >= OPENING_HEALTH_TREND_MIN_DAYS_APART;
  });
  return dated || compatible[0] || null;
}

export function buildOpeningHealthTrends(reportHistory = [], { limit = 6 } = {}) {
  const reports = asArray(reportHistory)
    .map(normaliseReportRow)
    .filter((report) => report.openings.length)
    .sort((a, b) => {
      const aDate = Date.parse(a.date);
      const bDate = Date.parse(b.date);
      if (Number.isFinite(aDate) && Number.isFinite(bDate)) return bDate - aDate;
      if (Number.isFinite(aDate)) return -1;
      if (Number.isFinite(bDate)) return 1;
      return b.index - a.index;
    });

  if (reports.length < 2) {
    return {
      hasEnoughHistory: false,
      trends: [],
      comparedReports: reports.length,
    };
  }

  const latest = reports[0];
  const previous = choosePreviousReport(latest, reports.slice(1));
  if (!previous) {
    return {
      hasEnoughHistory: false,
      trends: [],
      comparedReports: reports.length,
    };
  }

  const previousByKey = new Map(previous.openings.map((opening) => [opening.key, opening]));
  const trends = latest.openings
    .map((current) => {
      const old = previousByKey.get(current.key);
      if (!old) return null;
      const delta = current.score - old.score;
      const direction = directionFor(delta);
      return {
        key: current.key,
        name: current.name,
        currentScore: current.score,
        previousScore: old.score,
        scoreChange: delta,
        direction,
        games: current.games,
        currentDate: latest.date,
        previousDate: previous.date,
        summary: summaryFor({ direction, delta, current, previous: old }),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.scoreChange) - Math.abs(a.scoreChange) || (b.games ?? 0) - (a.games ?? 0))
    .slice(0, limit);

  return {
    hasEnoughHistory: trends.length > 0,
    trends,
    comparedReports: reports.length,
    currentDate: latest.date,
    previousDate: previous.date,
  };
}
