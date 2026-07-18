import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";

export const REPORT_COMPARISON_RULES = Object.freeze({
  minimumReportGames: 5,
  minimumOpeningGames: 5,
  minimumIssueGames: 2,
  openingChangePoints: 5,
  scoreChangePoints: 2,
  componentChangePoints: 2,
});

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

function canonicalOpening(name) {
  const raw = text(name);
  if (!raw) return { key: null, name: null };
  const known = findOpeningLine(raw);
  const canonicalName = known?.name || raw;
  return { key: normaliseOpeningKey(canonicalName), name: canonicalName };
}

function openingSide(opening = {}) {
  const value = String(opening.colour || opening.color || opening.side || opening.context || opening.section || opening.role || opening.slot || "").toLowerCase();
  if (value.includes("white") || value === "w") return "white";
  if (value.includes("black") || value === "b" || value.includes("vs_e4") || value.includes("vs_d4")) return "black";
  return "unknown";
}

function openingName(opening = {}) {
  return text(opening.name || opening.opening || opening.opening_name || opening.label);
}

function openingGames(opening = {}) {
  return Math.max(0, numberOrNull(opening.games ?? opening.count ?? opening.sample_size ?? opening.confidence?.sample_size) || 0);
}

function openingScore(opening = {}) {
  return numberOrNull(opening.win_rate ?? opening.winRate ?? opening.score_rate ?? opening.scoreRate ?? opening.score);
}

function confidenceRank(value, games = 0) {
  const label = String(value?.label || value || "").toLowerCase();
  if (label.includes("high")) return 3;
  if (label.includes("medium") || label.includes("developing")) return 2;
  if (label.includes("low") || label.includes("limited")) return 1;
  if (games >= 8) return 3;
  if (games >= 3) return 2;
  return games > 0 ? 1 : 0;
}

function statusForDelta(delta, threshold) {
  if (delta === null) return "insufficient evidence";
  if (delta >= threshold) return "improved";
  if (delta <= -threshold) return "declined";
  return "stable";
}

function openingMap(snapshot = {}) {
  const map = new Map();
  list(snapshot.opening_statistics).forEach((opening) => {
    const canonical = canonicalOpening(openingName(opening));
    const side = openingSide(opening);
    if (!canonical.key) return;
    const key = `${side}:${canonical.key}`;
    const candidate = {
      key,
      opening: canonical.name,
      displayName: openingName(opening),
      side,
      games: openingGames(opening),
      score: openingScore(opening),
      confidence: text(opening.confidence?.label || opening.confidence),
    };
    const existing = map.get(key);
    if (!existing || candidate.games > existing.games) map.set(key, candidate);
  });
  return map;
}

function compareOpenings(previous, current, comparablePlatform) {
  const before = openingMap(previous);
  const now = openingMap(current);
  const changes = [];
  [...new Set([...before.keys(), ...now.keys()])].sort().forEach((key) => {
    const oldOpening = before.get(key);
    const newOpening = now.get(key);
    if (!oldOpening || !newOpening) return;
    const enoughGames = oldOpening.games >= REPORT_COMPARISON_RULES.minimumOpeningGames && newOpening.games >= REPORT_COMPARISON_RULES.minimumOpeningGames;
    const delta = oldOpening.score !== null && newOpening.score !== null ? newOpening.score - oldOpening.score : null;
    const status = comparablePlatform && enoughGames
      ? statusForDelta(delta, REPORT_COMPARISON_RULES.openingChangePoints)
      : "insufficient evidence";
    changes.push({
      opening: newOpening.opening,
      previousDisplayName: oldOpening.displayName,
      currentDisplayName: newOpening.displayName,
      side: newOpening.side,
      status,
      scoreChange: status === "insufficient evidence" ? null : delta,
      previousScore: oldOpening.score,
      currentScore: newOpening.score,
      previousGames: oldOpening.games,
      currentGames: newOpening.games,
      previousConfidence: oldOpening.confidence,
      currentConfidence: newOpening.confidence,
    });
  });
  return changes.sort((a, b) => a.side.localeCompare(b.side) || a.opening.localeCompare(b.opening));
}

function compareScoreComponents(previous = {}, current = {}, comparablePlatform) {
  const before = previous.score_components && typeof previous.score_components === "object" ? previous.score_components : {};
  const now = current.score_components && typeof current.score_components === "object" ? current.score_components : {};
  return [...new Set([...Object.keys(before), ...Object.keys(now)])].sort().map((component) => {
    const previousValue = numberOrNull(before[component]);
    const currentValue = numberOrNull(now[component]);
    const delta = previousValue !== null && currentValue !== null ? currentValue - previousValue : null;
    return {
      component,
      previousValue,
      currentValue,
      change: comparablePlatform ? delta : null,
      status: comparablePlatform ? statusForDelta(delta, REPORT_COMPARISON_RULES.componentChangePoints) : "insufficient evidence",
    };
  });
}

function repertoireItems(snapshot = {}) {
  const repertoire = snapshot.active_repertoire;
  const rows = Array.isArray(repertoire) ? repertoire : list(repertoire?.items || repertoire?.openings);
  const map = new Map();
  rows.forEach((item) => {
    const rawName = typeof item === "string" ? item : item?.opening || item?.name || item?.opening_name;
    const canonical = canonicalOpening(rawName);
    if (!canonical.key) return;
    const side = typeof item === "string" ? "unknown" : openingSide(item);
    map.set(`${side}:${canonical.key}`, { opening: canonical.name, side });
  });
  return map;
}

function recommendationValue(value, fallbackConfidence = null) {
  if (typeof value === "string") return { ...canonicalOpening(value), confidence: text(fallbackConfidence?.label || fallbackConfidence) };
  const canonical = canonicalOpening(value?.opening || value?.name);
  return { ...canonical, confidence: text(value?.confidence?.label || value?.confidence || fallbackConfidence?.label || fallbackConfidence) };
}

function compareRepertoire(previous = {}, current = {}) {
  const before = repertoireItems(previous);
  const now = repertoireItems(current);
  const changes = [];
  [...new Set([...before.keys(), ...now.keys()])].sort().forEach((key) => {
    const oldItem = before.get(key);
    const newItem = now.get(key);
    const item = newItem || oldItem;
    changes.push({
      type: oldItem && newItem ? "opening retained" : newItem ? "opening added" : "opening removed",
      opening: item.opening,
      side: item.side,
    });
  });

  const oldRecommendations = previous.recommendations || {};
  const newRecommendations = current.recommendations || {};
  const oldRecommendationConfidence = previous.recommendation_confidence || {};
  const newRecommendationConfidence = current.recommendation_confidence || {};
  ["white", "black_e4", "black_d4"].forEach((slot) => {
    const oldValue = recommendationValue(oldRecommendations[slot], oldRecommendationConfidence[slot]);
    const newValue = recommendationValue(newRecommendations[slot], newRecommendationConfidence[slot]);
    if (oldValue.key !== newValue.key && (oldValue.key || newValue.key)) {
      changes.push({
        type: "recommendation changed",
        slot,
        previousOpening: oldValue.name,
        currentOpening: newValue.name,
      });
    }
    const oldRank = confidenceRank(oldValue.confidence);
    const newRank = confidenceRank(newValue.confidence);
    if (oldValue.key && oldValue.key === newValue.key && oldRank !== newRank && oldRank > 0 && newRank > 0) {
      changes.push({
        type: newRank > oldRank ? "recommendation confidence increased" : "recommendation confidence decreased",
        slot,
        opening: newValue.name,
        previousConfidence: oldValue.confidence,
        currentConfidence: newValue.confidence,
      });
    }
  });
  return changes;
}

function rawWeaknesses(snapshot = {}) {
  const metadata = snapshot.analysis_metadata || {};
  if (Array.isArray(snapshot.weaknesses)) return snapshot.weaknesses;
  if (Array.isArray(metadata.weaknesses)) return metadata.weaknesses;
  if (Array.isArray(metadata.problem_lines)) return metadata.problem_lines;
  return list(snapshot.training_priorities);
}

function hasWeaknessDataset(snapshot = {}) {
  const metadata = snapshot.analysis_metadata || {};
  return Array.isArray(snapshot.weaknesses) || Array.isArray(metadata.weaknesses) || Array.isArray(metadata.problem_lines);
}

function issueKey(issue = {}) {
  const id = text(issue.issue_id || issue.issueId || issue.id || issue.key);
  if (id) return `id:${id.toLowerCase()}`;
  const opening = canonicalOpening(issue.opening || issue.opening_name || issue.name);
  const category = normaliseOpeningKey(issue.category || issue.type || issue.pattern || issue.title || "issue");
  return opening.key ? `opening:${opening.key}:${category}` : `text:${category}`;
}

function issueRows(snapshot = {}) {
  return rawWeaknesses(snapshot).map((issue) => {
    const value = typeof issue === "string" ? { title: issue } : issue;
    const games = Math.max(0, numberOrNull(value.frequency ?? value.issue_games ?? value.games ?? value.sample_size) || 0);
    return {
      key: issueKey(value),
      issueId: text(value.issue_id || value.issueId || value.id),
      title: text(value.title || value.label || value.pattern || value.type) || "Recurring issue",
      opening: canonicalOpening(value.opening || value.opening_name || value.name).name,
      frequency: games,
      confidence: text(value.confidence?.label || value.confidence),
      status: text(value.status),
    };
  }).filter((issue) => issue.key !== "text:");
}

function compareWeaknesses(previous = {}, current = {}, comparablePlatform) {
  const before = new Map(issueRows(previous).map((issue) => [issue.key, issue]));
  const now = new Map(issueRows(current).map((issue) => [issue.key, issue]));
  const currentHasEvidence = (numberOrNull(current.total_games_analysed) || 0) >= REPORT_COMPARISON_RULES.minimumOpeningGames;
  const resolvedWeaknesses = [];
  const newWeaknesses = [];
  const continuedWeaknesses = [];

  before.forEach((oldIssue, key) => {
    const currentIssue = now.get(key);
    if (!currentIssue) {
      if (comparablePlatform && hasWeaknessDataset(current) && currentHasEvidence && oldIssue.frequency >= REPORT_COMPARISON_RULES.minimumIssueGames) {
        resolvedWeaknesses.push({ ...oldIssue, currentFrequency: 0, evidence: "The available data suggests this issue is no longer recurring." });
      }
      return;
    }
    const reduced = currentIssue.status?.toLowerCase() === "resolved" || (
      oldIssue.frequency >= REPORT_COMPARISON_RULES.minimumIssueGames &&
      currentIssue.frequency <= Math.max(1, Math.floor(oldIssue.frequency / 2)) &&
      confidenceRank(currentIssue.confidence, currentIssue.frequency) >= 2
    );
    if (comparablePlatform && reduced) {
      resolvedWeaknesses.push({ ...currentIssue, previousFrequency: oldIssue.frequency, evidence: "The available data suggests improvement." });
    } else {
      continuedWeaknesses.push({ ...currentIssue, previousFrequency: oldIssue.frequency });
    }
  });
  now.forEach((currentIssue, key) => {
    if (!before.has(key) && comparablePlatform && currentHasEvidence && currentIssue.frequency >= REPORT_COMPARISON_RULES.minimumIssueGames) {
      newWeaknesses.push(currentIssue);
    }
  });
  const sort = (a, b) => a.key.localeCompare(b.key);
  return {
    resolvedWeaknesses: resolvedWeaknesses.sort(sort),
    newWeaknesses: newWeaknesses.sort(sort),
    continuedWeaknesses: continuedWeaknesses.sort(sort),
  };
}

function buildTrainingProgress(previous, openingChanges, weaknesses) {
  const focusOpenings = new Map(list(previous.training_priorities).map((item) => ({
    ...item,
    opening: canonicalOpening(item?.opening || item?.name).name,
  })).filter((item) => item.opening).map((item) => [canonicalOpening(item.opening).key, item]));
  return openingChanges.filter((change) => focusOpenings.has(canonicalOpening(change.opening).key)).map((change) => ({
    opening: change.opening,
    side: change.side,
    status: change.status,
    message: change.status === "improved"
      ? "Performance improved after this became a training focus."
      : change.status === "insufficient evidence"
        ? "There is not yet enough evidence to assess this training focus."
        : change.status === "declined"
          ? "The available data does not yet suggest improvement in this training focus."
          : "There was no meaningful performance change after this became a training focus.",
  })).concat(weaknesses.resolvedWeaknesses.filter((issue) => issue.opening).map((issue) => ({
    opening: issue.opening,
    status: "improved",
    message: "The available data suggests improvement after this became a training focus.",
  })));
}

function measuredTrainingProgress(current = {}) {
  return list(current.training_outcomes).map((outcome) => ({
    trainingFocusId: outcome.trainingFocusId,
    opening: text(current.training_outcome_context?.[outcome.trainingFocusId]?.openingName) || "Completed training focus",
    status: outcome.status,
    message: text(outcome.explanation) || "There is not enough evidence to judge this.",
    beforeMetric: outcome.beforeMetric ?? null,
    afterMetric: outcome.afterMetric ?? null,
    confidence: outcome.confidence,
    laterGameCount: outcome.laterGameCount,
    relevantPositionCount: outcome.relevantPositionCount,
  }));
}

function summaryHighlights(scoreStatus, scoreChange, previousScore, currentScore, openingChanges, repertoireChanges, weaknesses) {
  const highlights = [];
  if (["improved", "declined"].includes(scoreStatus)) {
    highlights.push({
      type: "score",
      status: scoreStatus,
      text: `OpeningFit Score ${scoreStatus === "improved" ? "increased" : "decreased"} from ${Math.round(previousScore)} to ${Math.round(currentScore)}.`,
      previousValue: previousScore,
      currentValue: currentScore,
      change: scoreChange,
    });
  }
  const meaningfulOpening = openingChanges.find((change) => change.status === "improved" || change.status === "declined");
  if (meaningfulOpening) highlights.push({ type: "opening", status: meaningfulOpening.status, text: `${meaningfulOpening.opening} performance ${meaningfulOpening.status} in the available ${meaningfulOpening.side} sample.` });
  const recommendation = repertoireChanges.find((change) => change.type === "recommendation changed");
  if (recommendation) highlights.push({ type: "repertoire", status: "changed", text: `${recommendation.slot.replaceAll("_", " ")} recommendation changed.` });
  if (weaknesses.resolvedWeaknesses.length) highlights.push({ type: "weakness", status: "improved", text: `${weaknesses.resolvedWeaknesses.length} recurring weakness signal${weaknesses.resolvedWeaknesses.length === 1 ? "" : "s"} improved.` });
  if (weaknesses.continuedWeaknesses.length) {
    const issue = weaknesses.continuedWeaknesses[0];
    highlights.push({ type: "weakness", status: "stable", text: `${issue.opening || issue.title} remains your main repair area.` });
  }
  if (weaknesses.newWeaknesses.length) {
    const issue = weaknesses.newWeaknesses[0];
    highlights.push({ type: "weakness", status: "declined", text: `One new weakness was detected${issue.opening ? ` against ${issue.opening}` : ""}.` });
  }
  return highlights;
}

export function compareReportSnapshots(previousReport, currentReport) {
  const current = currentReport && typeof currentReport === "object" ? currentReport : {};
  const previous = previousReport && typeof previousReport === "object" ? previousReport : null;
  const empty = {
    hasPreviousReport: Boolean(previous),
    newGamesCount: numberOrNull(current.new_games_since_previous),
    previousScore: null,
    currentScore: numberOrNull(current.openingfit_score),
    scoreChange: null,
    scoreStatus: "insufficient evidence",
    scoreComponentChanges: [],
    openingChanges: [],
    repertoireChanges: [],
    resolvedWeaknesses: [],
    newWeaknesses: [],
    continuedWeaknesses: [],
    trainingProgress: [],
    summaryHighlights: [],
    confidenceWarnings: [],
  };
  if (!previous) return empty;

  const previousPlatform = text(previous.source_platform)?.toLowerCase();
  const currentPlatform = text(current.source_platform)?.toLowerCase();
  const comparablePlatform = !previousPlatform || !currentPlatform || previousPlatform === currentPlatform;
  const previousScore = numberOrNull(previous.openingfit_score);
  const currentScore = numberOrNull(current.openingfit_score);
  const previousGames = numberOrNull(previous.total_games_analysed);
  const currentGames = numberOrNull(current.total_games_analysed);
  const enoughReportGames = previousGames >= REPORT_COMPARISON_RULES.minimumReportGames && currentGames >= REPORT_COMPARISON_RULES.minimumReportGames;
  const scoreChange = comparablePlatform && enoughReportGames && previousScore !== null && currentScore !== null ? currentScore - previousScore : null;
  const scoreStatus = scoreChange === null ? "insufficient evidence" : statusForDelta(scoreChange, REPORT_COMPARISON_RULES.scoreChangePoints);
  const inferredNewGames = previousGames !== null && currentGames !== null && currentGames >= previousGames ? currentGames - previousGames : null;
  const openingChanges = compareOpenings(previous, current, comparablePlatform);
  const repertoireChanges = compareRepertoire(previous, current);
  const weaknesses = compareWeaknesses(previous, current, comparablePlatform);
  const confidenceWarnings = [];
  if (!comparablePlatform) confidenceWarnings.push({ code: "platform_changed", message: "The source platform changed, so performance changes are not treated as directly comparable." });
  if (comparablePlatform && !enoughReportGames) confidenceWarnings.push({ code: "small_report_sample", message: `At least ${REPORT_COMPARISON_RULES.minimumReportGames} games in each report are required before OpeningFit calls an overall score change an improvement or decline.` });
  openingChanges.filter((change) => change.status === "insufficient evidence" && (
    change.previousGames < REPORT_COMPARISON_RULES.minimumOpeningGames || change.currentGames < REPORT_COMPARISON_RULES.minimumOpeningGames
  )).forEach((change) => {
    confidenceWarnings.push({ code: "small_opening_sample", opening: change.opening, side: change.side, message: `At least ${REPORT_COMPARISON_RULES.minimumOpeningGames} games in each report are required for a meaningful opening comparison.` });
  });
  const measuredProgress = measuredTrainingProgress(current);
  const trainingProgress = measuredProgress.length ? measuredProgress : buildTrainingProgress(previous, openingChanges, weaknesses);
  const highlights = summaryHighlights(scoreStatus, scoreChange, previousScore, currentScore, openingChanges, repertoireChanges, weaknesses);
  const measuredHighlight = measuredProgress.find((item) => ["improved", "partially_improved", "not_improved", "not_encountered", "insufficient_data"].includes(item.status));
  if (measuredHighlight) highlights.unshift({ type: "training outcome", status: measuredHighlight.status, text: measuredHighlight.message });

  return {
    ...empty,
    newGamesCount: empty.newGamesCount ?? inferredNewGames,
    previousScore,
    currentScore,
    scoreChange,
    scoreStatus,
    scoreComponentChanges: compareScoreComponents(previous, current, comparablePlatform),
    openingChanges,
    repertoireChanges,
    ...weaknesses,
    trainingProgress,
    summaryHighlights: highlights,
    confidenceWarnings,
  };
}
