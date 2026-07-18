import { adaptReportHistoryRow } from "./reportSnapshot.js";

export const TRAINING_IMPACT_STATES = Object.freeze(["first-use", "no-new-games", "ready", "insufficient-data"]);

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const count = (value) => Math.max(0, Math.round(Number(value) || 0));
const text = (value) => String(value ?? "").trim();

function snapshotTime(value = {}) {
  const parsed = Date.parse(value.generated_at || value.created_at || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function outcomeSource(report = {}, reportHistory = [], repertoireEntries = []) {
  const direct = list(report.trainingOutcomes || report.training_outcomes);
  if (direct.length) return { outcomes: direct, context: report.trainingOutcomeContext || report.training_outcome_context || {} };
  const entryOutcomes = list(repertoireEntries).flatMap((entry) => entry.training_outcome ? [{ outcome: entry.training_outcome, entry }] : []);
  if (entryOutcomes.length) return {
    outcomes: entryOutcomes.map((item) => item.outcome),
    context: Object.fromEntries(entryOutcomes.map(({ outcome, entry }) => [outcome.trainingFocusId, {
      openingName: entry.display_name || entry.canonical_name,
      title: entry.current_training_focus || "Completed training focus",
      completedAt: entry.training_outcome?.completedAt || null,
    }])),
  };
  const saved = list(reportHistory).map((row) => adaptReportHistoryRow(row)).sort((left, right) => snapshotTime(right) - snapshotTime(left)).find((snapshot) => list(snapshot.training_outcomes).length);
  return saved ? { outcomes: list(saved.training_outcomes), context: saved.training_outcome_context || {} } : { outcomes: [], context: {} };
}

function applicationText(outcome, context) {
  const later = count(outcome.laterGameCount);
  const correct = count(outcome.correctApplicationCount);
  const repeated = count(outcome.repeatedMistakeCount);
  if (outcome.status === "not_encountered") return "This position has not appeared again yet.";
  if (outcome.status === "insufficient_data") return "Not enough evidence yet.";
  if (outcome.status === "not_improved") {
    const issue = text(context.title).toLowerCase().includes("development") ? "development issue" : "issue";
    return `The same ${issue} occurred in ${repeated} later game${repeated === 1 ? "" : "s"}.`;
  }
  if (outcome.status === "improved") return `Applied successfully in ${correct} of ${later} later game${later === 1 ? "" : "s"}.`;
  return `Applied in ${correct} of ${later} later game${later === 1 ? "" : "s"}; more consistency evidence is needed.`;
}

function resultText(outcome) {
  const metric = outcome.afterMetric || {};
  const result = Number(metric.openingResultPercent);
  const games = count(metric.openingResultGameCount);
  if (!Number.isFinite(result) || games < 5) return "Not enough same-opening games for a broader result trend.";
  return `${Math.round(result)}% opening-result score across ${games} later games. This is an observed trend, not proof that training caused it.`;
}

function confidenceLabel(outcome) {
  const confidence = text(outcome.confidence) || "low";
  const later = count(outcome.laterGameCount);
  const relevant = count(outcome.relevantPositionCount);
  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)} confidence · ${later} later game${later === 1 ? "" : "s"} · ${relevant} relevant position${relevant === 1 ? "" : "s"}`;
}

function value(outcome, context) {
  return {
    id: outcome.trainingFocusId,
    status: outcome.status,
    openingName: text(context.openingName) || "Opening focus",
    taskTitle: text(context.title) || "Completed training focus",
    completionText: context.completedAt ? `Task completed ${new Date(context.completedAt).toLocaleDateString()}. Completion records practice, not proof of improvement.` : "Task completed. Completion records practice, not proof of improvement.",
    applicationText: applicationText(outcome, context),
    resultText: resultText(outcome),
    confidenceLabel: confidenceLabel(outcome),
  };
}

export function buildTrainingImpactView({ report = {}, reportHistory = [], repertoireEntries = [], limit = 3 } = {}) {
  const source = outcomeSource(report, reportHistory, repertoireEntries);
  if (!source.outcomes.length) return {
    state: "first-use",
    title: "Training impact",
    message: "Complete a training focus, then analyse later games to see whether the same opening idea appears again.",
    outcomes: [],
    hasHistory: false,
  };
  const ranked = [...source.outcomes].sort((left, right) => {
    const priority = { improved: 5, not_improved: 4, partially_improved: 3, insufficient_data: 2, not_encountered: 1 };
    return (priority[right.status] || 0) - (priority[left.status] || 0) || count(right.relevantPositionCount) - count(left.relevantPositionCount);
  });
  const noNewGames = ranked.every((outcome) => count(outcome.laterGameCount) === 0);
  const insufficient = !noNewGames && ranked.every((outcome) => outcome.status === "insufficient_data" || outcome.status === "not_encountered");
  return {
    state: noNewGames ? "no-new-games" : insufficient ? "insufficient-data" : "ready",
    title: "Training impact",
    message: noNewGames
      ? "Your training is recorded, but no eligible later games are available yet. Play more games and refresh your report."
      : insufficient ? "Later games are available, but there is not enough matching opening evidence for a progress judgment yet." : "Later-game evidence from completed opening focuses.",
    outcomes: ranked.slice(0, Math.max(1, Math.min(3, limit))).map((outcome) => value(outcome, source.context[outcome.trainingFocusId] || {})),
    hasHistory: true,
  };
}
