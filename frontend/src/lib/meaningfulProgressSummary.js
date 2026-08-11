import { compareReportSnapshots, REPORT_COMPARISON_RULES } from "./reportComparison.js";
import { selectPreviousReportSnapshot } from "./reportComparisonPresentation.js";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

function recommendationMap(snapshot = {}) {
  const decision = snapshot.report_decision || snapshot.reportDecision || {};
  return new Map(list(decision.recommendations).map((item) => {
    const opening = text(item.opening || item.openingName);
    const role = text(item.repertoireRole || item.repertoire_role || item.role);
    const id = text(item.recommendationId || item.recommendation_id || item.openingId || item.opening_id)
      || `${opening.toLowerCase()}::${role.toLowerCase()}`;
    const sample = item.sample || {};
    return [id, {
      opening,
      verdict: text(item.verdict || item.decision).toLowerCase(),
      games: Number(sample.games ?? item.games) || 0,
      score: Number(sample.scoreRate ?? sample.score_rate ?? item.scoreRate ?? item.score_rate),
      confidence: text(item.confidence?.label || item.confidence || item.confidenceLabel),
    }];
  }).filter(([, item]) => item.opening && item.verdict));
}

function confidenceIsUsable(label, games) {
  return games >= REPORT_COMPARISON_RULES.minimumOpeningGames
    && !/low|limited|insufficient|unavailable/i.test(label || "");
}

function decisionChanges(previous, current) {
  const before = recommendationMap(previous);
  const now = recommendationMap(current);
  const rows = [];
  now.forEach((currentItem, id) => {
    const old = before.get(id);
    if (!old || old.verdict === currentItem.verdict) return;
    if (!confidenceIsUsable(old.confidence, old.games) || !confidenceIsUsable(currentItem.confidence, currentItem.games)) return;
    if (![["keep", "repair"], ["repair", "keep"]].some(([from, to]) => old.verdict === from && currentItem.verdict === to)) return;
    const additional = Math.max(0, currentItem.games - old.games);
    const scoreChanged = Number.isFinite(old.score) && Number.isFinite(currentItem.score);
    const evidence = [
      additional ? `${additional} additional qualifying game${additional === 1 ? "" : "s"}` : "a stronger comparable sample",
      scoreChanged ? `score ${Math.round(old.score * 10) / 10}% to ${Math.round(currentItem.score * 10) / 10}%` : "",
    ].filter(Boolean).join("; ");
    rows.push({
      key: `decision:${id}`,
      category: currentItem.verdict === "keep" ? "RESOLVED" : "NEW ISSUE",
      title: currentItem.opening,
      text: `${old.verdict.toUpperCase()} to ${currentItem.verdict.toUpperCase()} after ${evidence}.`,
    });
  });
  return rows;
}

export function buildMeaningfulProgressSummary({ currentSnapshot = null, reportSnapshots = [] } = {}) {
  if (!currentSnapshot) return { state: "no-current", rows: [], previousSnapshot: null };
  const previousSnapshot = selectPreviousReportSnapshot(currentSnapshot, reportSnapshots);
  if (!previousSnapshot) return { state: "no-previous", rows: [], previousSnapshot: null };
  const comparison = compareReportSnapshots(previousSnapshot, currentSnapshot);
  if (comparison.comparisonState === "reports_not_comparable") {
    return { state: "not-comparable", rows: [], previousSnapshot, comparison };
  }

  const rows = [...decisionChanges(previousSnapshot, currentSnapshot)];
  comparison.resolvedWeaknesses.forEach((item) => rows.push({
    key: `resolved:${item.key}`,
    category: "RESOLVED",
    title: item.opening || item.title,
    text: "The previous repair signal is no longer recurring with sufficient comparable evidence.",
  }));
  comparison.newWeaknesses.forEach((item) => rows.push({
    key: `new:${item.key}`,
    category: "NEW ISSUE",
    title: item.opening || item.title,
    text: `${item.frequency} supporting game${item.frequency === 1 ? "" : "s"} established this as a new repair signal.`,
  }));
  comparison.repertoireChanges
    .filter((item) => item.type === "role establishment changed" && item.currentEstablished)
    .forEach((item) => rows.push({
      key: `coverage:${item.slot}`,
      category: "COVERAGE CHANGE",
      title: text(item.slot).replaceAll("_", " "),
      text: `${item.previousGames} supporting games to ${item.currentGames}; this role is now established.`,
    }));
  comparison.repertoireChanges
    .filter((item) => item.type === "recommendation confidence increased")
    .forEach((item) => rows.push({
      key: `confidence:${item.slot}:${item.opening}`,
      category: "MORE EVIDENCE",
      title: item.opening,
      text: `${item.previousConfidence} to ${item.currentConfidence}.`,
    }));
  comparison.openingChanges
    .filter((item) => item.status === "improved")
    .forEach((item) => rows.push({
      key: `opening:${item.side}:${item.opening}`,
      category: "IMPROVED",
      title: item.opening,
      text: `Score ${Math.round(item.previousScore * 10) / 10}% to ${Math.round(item.currentScore * 10) / 10}% across comparable samples of ${item.previousGames} and ${item.currentGames} games.`,
    }));

  const unique = [...new Map(rows.map((row) => [text(row.title).toLowerCase(), row])).values()].slice(0, 4);
  return { state: unique.length ? "ready" : "no-meaningful-change", rows: unique, previousSnapshot, comparison };
}
