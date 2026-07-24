import { compareReportSnapshots } from "./reportComparison.js";

export const COMPARISON_STATUS_LABELS = Object.freeze({
  improved: "Improvement",
  declined: "Decline",
  stable: "Unchanged",
  changed: "Changed",
  sample: "New sample",
  "insufficient evidence": "Insufficient data",
  partially_improved: "Partial improvement",
  not_improved: "Not improved",
  not_encountered: "Not encountered",
  insufficient_data: "Insufficient data",
});

const rounded = (value) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : null);

function snapshotTime(snapshot = {}) {
  const parsed = Date.parse(snapshot.generated_at || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function comparisonSignature(snapshot = {}) {
  const openings = (Array.isArray(snapshot.opening_statistics) ? snapshot.opening_statistics : [])
    .map((opening) => `${opening.side || opening.colour || opening.color || ""}:${opening.name || opening.opening || ""}:${opening.games ?? ""}`)
    .sort()
    .join("|");
  return [
    snapshot.source_platform || "",
    String(snapshot.source_username || "").toLowerCase(),
    snapshot.total_games_analysed ?? "",
    snapshot.openingfit_score ?? "",
    openings,
  ].join("::");
}

function sameSnapshot(left = {}, right = {}) {
  if (left === right) return true;
  if (left.analysis_id && right.analysis_id && left.analysis_id === right.analysis_id) return true;
  if (left.report_id && right.report_id && left.report_id === right.report_id) return true;
  if (comparisonSignature(left) === comparisonSignature(right)) return true;
  return Boolean(
    snapshotTime(left) &&
    snapshotTime(left) === snapshotTime(right) &&
    left.source_platform === right.source_platform &&
    left.source_username === right.source_username &&
    left.total_games_analysed === right.total_games_analysed
  );
}

export function selectPreviousReportSnapshot(currentSnapshot, reportSnapshots = []) {
  if (!currentSnapshot) return null;
  const currentTime = snapshotTime(currentSnapshot);
  return (Array.isArray(reportSnapshots) ? reportSnapshots : [])
    .filter((snapshot) => snapshot && !sameSnapshot(snapshot, currentSnapshot))
    .filter((snapshot) => !currentTime || !snapshotTime(snapshot) || snapshotTime(snapshot) < currentTime)
    .sort((left, right) => snapshotTime(right) - snapshotTime(left))[0] || null;
}

function statusItem(item) {
  return {
    ...item,
    statusLabel: COMPARISON_STATUS_LABELS[item.status] || "Unchanged",
  };
}

function openingDetail(change) {
  const previousScore = rounded(change.previousScore);
  const currentScore = rounded(change.currentScore);
  return statusItem({
    key: `opening:${change.side}:${change.opening}`,
    title: `${change.opening} · ${change.side}`,
    text: previousScore === null || currentScore === null
      ? `${change.previousGames} games before · ${change.currentGames} games now`
      : `${previousScore}% chess score before · ${currentScore}% now · ${change.previousGames} vs ${change.currentGames} games`,
    status: change.status,
  });
}

export function buildReportComparisonView({ currentSnapshot, reportSnapshots = [], loading = false, error = "" } = {}) {
  if (loading) return { state: "loading", title: "Loading your previous report…", primaryHighlights: [], details: [], warnings: [], hasHistory: false };
  if (error) return { state: "error", title: "Comparison is temporarily unavailable", message: "Your current report is still available. Refresh later to compare it with report history.", primaryHighlights: [], details: [], warnings: [], hasHistory: reportSnapshots.length > 0 };

  try {
    const previousSnapshot = selectPreviousReportSnapshot(currentSnapshot, reportSnapshots);
    if (!previousSnapshot) {
      return {
        state: "first-report",
        title: "This is your first progress snapshot",
        message: "Future reports will compare your score, opening performance, and recurring weaknesses. Play more games, then refresh your analysis to see what changed.",
        primaryHighlights: [],
        details: [],
        warnings: [],
        hasHistory: reportSnapshots.length > 0,
      };
    }

    const comparison = compareReportSnapshots(previousSnapshot, currentSnapshot);
    const highlights = [];
    if (comparison.newGamesCount > 0) {
      highlights.push(statusItem({ type: "games", status: "sample", text: `${rounded(comparison.newGamesCount)} new game${rounded(comparison.newGamesCount) === 1 ? "" : "s"} analysed.` }));
    }
    comparison.summaryHighlights.forEach((item) => highlights.push(statusItem(item)));
    if (!comparison.summaryHighlights.length && comparison.scoreStatus === "stable") {
      highlights.push(statusItem({ type: "score", status: "stable", text: `OpeningFit Score remains broadly unchanged at ${rounded(comparison.currentScore)}.` }));
    }
    if (!highlights.length && comparison.confidenceWarnings.length) {
      highlights.push(statusItem({ type: "confidence", status: "insufficient evidence", text: "There is not enough comparable data to call a meaningful change yet." }));
    }

    const scoreDetail = comparison.previousScore === null || comparison.currentScore === null ? [] : [statusItem({
      key: "score",
      title: "OpeningFit Score",
      text: `${rounded(comparison.previousScore)} before · ${rounded(comparison.currentScore)} now`,
      status: comparison.scoreStatus,
    })];
    const componentDetails = comparison.scoreComponentChanges.map((change) => statusItem({
      key: `component:${change.component}`,
      title: change.component.replaceAll("_", " "),
      text: change.previousValue === null || change.currentValue === null ? "Comparable values unavailable" : `${rounded(change.previousValue)} before · ${rounded(change.currentValue)} now`,
      status: change.status,
    }));
    const weaknessDetails = [
      ...comparison.resolvedWeaknesses.map((item) => statusItem({ key: `resolved:${item.key}`, title: item.opening || item.title, text: item.evidence, status: "improved" })),
      ...comparison.newWeaknesses.map((item) => statusItem({ key: `new:${item.key}`, title: item.opening || item.title, text: `${item.frequency} supporting game${item.frequency === 1 ? "" : "s"} in this report`, status: "declined" })),
      ...comparison.continuedWeaknesses.map((item) => statusItem({ key: `continued:${item.key}`, title: item.opening || item.title, text: `${item.previousFrequency} before · ${item.frequency} now`, status: "stable" })),
    ];
    const repertoireDetails = comparison.repertoireChanges.map((item, index) => statusItem({
      key: `repertoire:${item.type}:${index}`,
      title: item.type.replaceAll("_", " "),
      text: item.previousOpening || item.currentOpening
        ? `${item.previousOpening || "Not set"} before · ${item.currentOpening || "Not set"} now`
        : `${item.opening}${item.previousConfidence || item.currentConfidence ? ` · ${item.previousConfidence || "Not set"} before · ${item.currentConfidence || "Not set"} now` : ""}`,
      status: item.type.includes("increased") ? "improved" : item.type.includes("decreased") || item.type.includes("removed") ? "declined" : item.type === "opening retained" ? "stable" : "changed",
    }));
    const trainingDetails = comparison.trainingProgress.map((item, index) => statusItem({
      key: `training:${item.opening}:${index}`,
      title: `${item.opening} training focus`,
      text: item.message,
      status: item.status,
    }));

    return {
      state: "ready",
      title: "Since your last report",
      primaryHighlights: highlights.slice(0, 5),
      details: [...scoreDetail, ...comparison.openingChanges.map(openingDetail), ...componentDetails, ...repertoireDetails, ...weaknessDetails, ...trainingDetails],
      warnings: comparison.confidenceWarnings.map((warning) => warning.message),
      hasHistory: reportSnapshots.length > 0,
      comparison,
    };
  } catch {
    return { state: "error", title: "Comparison is temporarily unavailable", message: "Your current report is still available. Refresh later to compare it with report history.", primaryHighlights: [], details: [], warnings: [], hasHistory: reportSnapshots.length > 0 };
  }
}
