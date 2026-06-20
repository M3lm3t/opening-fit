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

function getSnapshotDate(row = {}) {
  return row?.created_at || row?.createdAt || row?.updated_at || getSnapshotPayload(row)?.source_summary?.imported_at || "";
}

function formatEarnedDate(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(parsed));
}

function getSnapshotHealthScore(row = {}) {
  row = row || {};
  const payload = getSnapshotPayload(row);
  const value = row.repertoire_health_score ?? row.repertoireHealthScore ?? payload.repertoire_health_score ?? payload.repertoireHealthScore;
  if (value === null || value === undefined || value === "") return null;
  return clampPercent(value, null);
}

function getSnapshotMastery(row = {}) {
  row = row || {};
  const payload = getSnapshotPayload(row);
  const metrics = payload.retentionMetrics || payload.retention_metrics || {};
  return asArray(
    row.top_opening_mastery ||
      row.topOpeningMastery ||
      payload.top_opening_mastery ||
      payload.topOpeningMastery ||
      payload.openingMastery ||
      payload.opening_mastery ||
      metrics.openingMastery ||
      metrics.opening_mastery
  );
}

function getSnapshotWeakestLine(row = {}) {
  row = row || {};
  const payload = getSnapshotPayload(row);
  const metrics = payload.retentionMetrics || payload.retention_metrics || {};
  const tracking = payload.weakestLineTracking || payload.weakest_line_tracking || metrics.weakestLineTracking || metrics.weakest_line_tracking || {};
  return (
    row.weakest_line ||
    row.weakestLine ||
    payload.weakest_line ||
    payload.weakestLine ||
    tracking.currentWeakestLine ||
    tracking.current_weakest_line ||
    null
  );
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

function confidenceText(item = {}) {
  const games = numberValue(item.confidenceGames ?? item.confidence_games ?? item.gamesPlayed ?? item.games_played, 0);
  const level = item.confidenceLevel || item.confidence_level || item.confidence || (games >= 30 ? "High" : games >= 10 ? "Medium" : "Low");
  return item.confidenceText || item.confidence_text || `${level} confidence - based on ${games} game${games === 1 ? "" : "s"}`;
}

function confidenceLevel(item = {}) {
  const games = numberValue(item.confidenceGames ?? item.confidence_games ?? item.gamesPlayed ?? item.games_played, 0);
  const level = String(item.confidenceLevel || item.confidence_level || item.confidence || (games >= 30 ? "High" : games >= 10 ? "Medium" : "Low")).toLowerCase();
  if (level.includes("high")) return "high";
  if (level.includes("medium")) return "medium";
  return "low";
}

function confidenceWeight(level) {
  if (level === "high") return 28;
  if (level === "medium") return 16;
  return 0;
}

function masteryScore(item = {}) {
  item = item || {};
  return clampPercent(item.masteryScore ?? item.mastery_score, 0);
}

function masteryGames(item = {}) {
  item = item || {};
  return numberValue(item.gamesPlayed ?? item.games_played ?? item.games, 0);
}

function weakLineCount(item = {}) {
  item = item || {};
  return numberValue(item.weakLineCount ?? item.weak_line_count, 0);
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

function sameOpeningName(a = "", b = "") {
  const cleanA = String(a || "").toLowerCase();
  const cleanB = String(b || "").toLowerCase();
  return cleanA && cleanB && (cleanA.includes(cleanB) || cleanB.includes(cleanA));
}

function buildRepertoireCoach(masteryItems = [], oneFix = null, weakestTraining = null) {
  const trainingTarget = weakestTraining?.target || null;
  const candidates = asArray(masteryItems)
    .filter(Boolean)
    .map((item) => {
      const games = numberValue(item.gamesPlayed ?? item.games_played, 0);
      const level = confidenceLevel(item);
      const weakLines = numberValue(item.weakLineCount ?? item.weak_line_count, 0);
      const lossRate = clampPercent(item.lossRate ?? item.loss_rate, 0);
      const winRate = clampPercent(item.winRate ?? item.win_rate, 0);
      const masteryScore = clampPercent(item.masteryScore ?? item.mastery_score, 0);
      const decayRisk = String(item.decayRisk || item.decay_risk || "none").toLowerCase();
      const hasTraining = Boolean(trainingTarget && sameOpeningName(trainingTarget.opening || trainingTarget.name, item.opening || item.name));
      const matchesFix = oneFix && sameOpeningName(oneFix.opening || oneFix.name, item.opening || item.name);
      const weaknessSeverity =
        weakLines * 24 +
        Math.max(0, 55 - winRate) +
        Math.max(0, lossRate - 42) +
        Math.max(0, 58 - masteryScore);
      const staleBoost = decayRisk === "high" ? 16 : decayRisk === "medium" ? 10 : decayRisk === "low" ? 4 : 0;
      const score =
        weaknessSeverity +
        Math.min(26, games * 0.8) +
        confidenceWeight(level) +
        staleBoost +
        (hasTraining ? 14 : 0) +
        (matchesFix ? 16 : 0);

      return {
        ...item,
        games,
        level,
        weakLines,
        lossRate,
        winRate,
        masteryScore,
        decayRisk,
        hasTraining,
        score,
      };
    })
    .filter((item) => item.games >= 10 && item.level !== "low")
    .filter((item) => item.weakLines > 0 || item.lossRate >= 50 || item.winRate <= 45 || item.masteryScore < 55 || ["medium", "high"].includes(item.decayRisk));

  const pick = candidates.sort((a, b) => b.score - a.score)[0];
  if (!pick) return null;

  const variation = pick.variation || pick.line || "";
  const reasons = [
    Number.isFinite(pick.winRate) ? `${pick.winRate}% score` : null,
    `reached in ${pick.games} games`,
    `${pick.level}-confidence ${pick.weakLines > 0 || pick.lossRate >= 50 ? "weakness" : "opening signal"}`,
    pick.hasTraining ? "training is available" : null,
    ["medium", "high"].includes(pick.decayRisk) ? "may need a refresh" : null,
  ].filter(Boolean).slice(0, 4);

  return {
    opening: pick.opening || pick.name,
    variation,
    reasons,
    suggestedAction: variation
      ? `Practise ${variation}, then replay one recent game in ${pick.opening || pick.name}.`
      : `Practise one focused line in ${pick.opening || pick.name}, then replay one recent game from that opening.`,
    trainingTarget: pick.hasTraining ? trainingTarget : null,
  };
}

function openingStoryName(item = {}) {
  item = item || {};
  const name = item.opening || item.name || "";
  return name && name !== "Opening" && name !== "Unknown line" ? name : "";
}

function articleForPhrase(value = "") {
  return /^[aeiou]/i.test(String(value).trim()) ? "an" : "a";
}

function buildPersonalOpeningStory({ identity, healthScore, masteryItems = [], oneFix } = {}) {
  const sentences = [];
  const identityName = identity?.identity || identity?.label || "";
  const topOpening = asArray(masteryItems).find((item) => openingStoryName(item) && numberValue(item.gamesPlayed ?? item.games_played, 0) > 0);
  const weakestOpening = openingStoryName(oneFix);
  const weakestVariation = oneFix?.variation || oneFix?.line || oneFix?.moveLine || oneFix?.move_line || "";
  const weakestName = weakestVariation && weakestVariation !== weakestOpening ? `${weakestOpening}: ${weakestVariation}` : weakestOpening;
  const improving = asArray(masteryItems).find((item) => /improv|up/i.test(trendLabel(item.recentTrend || item.recent_trend)));
  const stale = asArray(masteryItems).find((item) => ["medium", "high"].includes(String(item.decayRisk || item.decay_risk || "none").toLowerCase()));

  if (identityName) {
    sentences.push(`Your current opening profile looks like ${articleForPhrase(identityName)} ${identityName}.`);
  } else if (healthScore >= 70) {
    sentences.push("Your repertoire is starting to look stable.");
  } else if (healthScore > 0) {
    sentences.push("Your repertoire has useful signs, but a few opening lines still need cleaner plans.");
  }

  if (openingStoryName(topOpening)) {
    const confidence = confidenceLevel(topOpening);
    const confidencePhrase = confidence === "high" ? "a strong signal" : confidence === "medium" ? "a useful signal" : "an early signal";
    sentences.push(`${openingStoryName(topOpening)} is currently ${confidencePhrase} in your opening mix.`);
  }

  if (weakestName) {
    sentences.push(`The line to watch is ${weakestName}, because it is still the clearest repair target.`);
  }

  if (openingStoryName(improving)) {
    sentences.push(`${openingStoryName(improving)} shows the clearest recent improvement.`);
  } else if (openingStoryName(stale)) {
    sentences.push(`${openingStoryName(stale)} may need a short refresh before you rely on it again.`);
  }

  return sentences.slice(0, 4);
}

function lineKey(line) {
  return `${openingStoryName(line)} ${line?.variation || line?.line || line?.moveLine || line?.move_line || ""}`.trim().toLowerCase();
}

function sideValue(item = {}) {
  item = item || {};
  return String(item.side || item.colour || item.color || item.playerSide || item.player_side || "").toLowerCase();
}

function hasBalancedRepertoire(masteryItems = []) {
  const hasWhite = asArray(masteryItems).some((item) => sideValue(item).includes("white") && masteryGames(item) >= 10 && masteryScore(item) >= 50);
  const hasBlack = asArray(masteryItems).some((item) => sideValue(item).includes("black") && masteryGames(item) >= 10 && masteryScore(item) >= 50);
  return hasWhite && hasBlack;
}

function entryForSnapshot(row = {}) {
  return {
    createdAt: getSnapshotDate(row),
    score: getSnapshotScore(row),
    healthScore: getSnapshotHealthScore(row),
    masteryItems: getSnapshotMastery(row),
    weakestLine: getSnapshotWeakestLine(row),
  };
}

function buildMilestones({ data, healthScore, masteryItems = [], previousSnapshot, retentionSnapshots = [] } = {}) {
  if (!asArray(masteryItems).length && !asArray(retentionSnapshots).length) return [];

  const currentEntry = {
    createdAt: data?.importedAt || data?.imported_at || data?.lastUpdated || new Date().toISOString(),
    score: getOpeningFitScore(data).value,
    healthScore,
    masteryItems,
    weakestLine: getWeakestTracking(data).currentWeakestLine || getWeakestTracking(data).current_weakest_line || null,
    current: true,
  };
  const history = asArray(retentionSnapshots)
    .map(entryForSnapshot)
    .filter((entry) => entry.createdAt || entry.healthScore !== null || entry.masteryItems.length)
    .sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
  const entries = [...history, currentEntry];

  const findEarned = (predicate) => entries.find(predicate);
  const currentWeakLines = asArray(masteryItems).filter(Boolean).reduce((total, item) => total + weakLineCount(item), 0);
  const previousWeakest = getSnapshotWeakestLine(previousSnapshot);
  const previousWeakestKey = lineKey(previousWeakest);
  const fixedPreviousWeakest =
    previousWeakestKey &&
    asArray(masteryItems).filter(Boolean).some(
      (item) =>
        lineKey(item) === previousWeakestKey &&
        masteryGames(item) >= 10 &&
        confidenceLevel(item) !== "low" &&
        weakLineCount(item) === 0 &&
        masteryScore(item) >= 50
    );
  const previousScore = getSnapshotScore(previousSnapshot);
  const previousHealth = getSnapshotHealthScore(previousSnapshot);
  const weeklyImproved =
    (Number.isFinite(previousScore) && currentEntry.score - previousScore >= 15) ||
    (Number.isFinite(previousHealth) && healthScore - previousHealth >= 5) ||
    asArray(masteryItems).filter(Boolean).some((item) => /improv|up/i.test(trendLabel(item.recentTrend || item.recent_trend)));

  const definitions = [
    {
      key: "stable-opening",
      title: "First Stable Opening",
      explanation: "One opening has enough games, no weak-line flag, and a useful mastery score.",
      earnedEntry: findEarned((entry) => asArray(entry.masteryItems).filter(Boolean).some((item) => masteryGames(item) >= 10 && masteryScore(item) >= 60 && weakLineCount(item) === 0)),
    },
    {
      key: "mastery-50",
      title: "First Mastery 50",
      explanation: "One opening reached 50% mastery.",
      earnedEntry: findEarned((entry) => asArray(entry.masteryItems).filter(Boolean).some((item) => masteryScore(item) >= 50)),
    },
    {
      key: "mastery-75",
      title: "First Mastery 75",
      explanation: "One opening reached 75% mastery.",
      earnedEntry: findEarned((entry) => asArray(entry.masteryItems).filter(Boolean).some((item) => masteryScore(item) >= 75)),
    },
    {
      key: "health-70",
      title: "Repertoire Health 70",
      explanation: "Your repertoire health reached 70 out of 100.",
      earnedEntry: findEarned((entry) => numberValue(entry.healthScore, 0) >= 70),
    },
    {
      key: "health-80",
      title: "Repertoire Health 80",
      explanation: "Your repertoire health reached 80 out of 100.",
      earnedEntry: findEarned((entry) => numberValue(entry.healthScore, 0) >= 80),
    },
    {
      key: "no-critical-weak-lines",
      title: "No Critical Weak Lines",
      explanation: "Your current mastery list is not showing a critical repeated weak line.",
      earnedEntry: masteryItems.length && currentWeakLines === 0 ? currentEntry : null,
    },
    {
      key: "fixed-first-weak-line",
      title: "Fixed First Weak Line",
      explanation: "A previous weak line is no longer showing as a major weakness.",
      earnedEntry: fixedPreviousWeakest ? currentEntry : null,
    },
    {
      key: "hundred-games",
      title: "100 Games In One Opening",
      explanation: "One opening has reached 100 analysed games.",
      earnedEntry: findEarned((entry) => asArray(entry.masteryItems).filter(Boolean).some((item) => masteryGames(item) >= 100)),
    },
    {
      key: "balanced-repertoire",
      title: "Balanced White and Black Repertoire",
      explanation: "You have at least one stable White opening and one stable Black opening.",
      earnedEntry: hasBalancedRepertoire(masteryItems) ? currentEntry : null,
    },
    {
      key: "weekly-improvement",
      title: "Weekly Improvement",
      explanation: "Your latest report improved from the previous snapshot.",
      earnedEntry: weeklyImproved ? currentEntry : null,
    },
  ].map((item) => ({
    ...item,
    earned: Boolean(item.earnedEntry),
    earnedAt: item.earnedEntry?.createdAt || "",
  }));

  const earned = definitions
    .filter((item) => item.earned)
    .sort((a, b) => Date.parse(b.earnedAt || 0) - Date.parse(a.earnedAt || 0));
  const unearned = definitions.filter((item) => !item.earned);
  if (!earned.length && !asArray(retentionSnapshots).length) return [];
  return [...earned, ...unearned].slice(0, 3);
}

export default function OpeningJourney({ data, fitData, retentionSnapshots = [] }) {
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
    const allMastery = getOpeningMastery(data)
      .filter(Boolean)
      .map((item) => ({
        ...item,
        opening: item.opening || item.name || "Opening",
        localWeakestLineTrainingCount: countWeakestLineCompletionsForOpening(item.opening || item.name || "", weakestLineTrainingEvents),
        masteryScore: clampPercent(item.masteryScore ?? item.mastery_score, 0),
        masteryLevel: Math.max(1, Math.min(10, Math.round(numberValue(item.masteryLevel ?? item.mastery_level, 1)))),
        confidenceText: confidenceText(item),
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
      .sort((a, b) => b.masteryScore - a.masteryScore);
    const oneFix = getOneThingToFix(data);
    const weakestTraining = buildWeakestLineTrainingTarget(data);
    const repertoireCoach = buildRepertoireCoach(allMastery, oneFix, weakestTraining);
    const personalStory = buildPersonalOpeningStory({
      identity,
      healthScore,
      masteryItems: allMastery,
      oneFix,
    });
    const milestones = buildMilestones({
      data,
      healthScore,
      masteryItems: allMastery,
      previousSnapshot,
      retentionSnapshots,
    });
    return {
      openingFitScore,
      previousSnapshot,
      health,
      identity,
      healthScore,
      mastery: allMastery.slice(0, 3),
      oneFix,
      weakestTraining,
      repertoireCoach,
      personalStory,
      milestones,
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
          <small>{journey.weakestTraining.available ? "The primary action card handles this line." : journey.weakestTraining.message}</small>
        </article>
      </div>

      {journey.personalStory.length ? (
        <article className="openingJourneyStory">
          <span>Personal Opening Story</span>
          <p>{journey.personalStory.join(" ")}</p>
        </article>
      ) : null}

      {journey.milestones.length ? (
        <article className="openingJourneyMilestones">
          <div>
            <span>Milestones</span>
            <strong>Opening progress markers</strong>
          </div>
          <ul>
            {journey.milestones.map((milestone) => (
              <li key={milestone.key} className={milestone.earned ? "earned" : "unearned"}>
                <div>
                  <strong>{milestone.title}</strong>
                  <p>{milestone.explanation}</p>
                </div>
                <small>
                  {milestone.earned
                    ? milestone.earnedAt
                      ? `Earned ${formatEarnedDate(milestone.earnedAt)}`
                      : "Earned"
                    : "Not earned yet"}
                </small>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

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
              <p>{item.confidenceText}</p>
              <p>{trendLabel(item.recentTrend || item.recent_trend)}</p>
              <small>
                {weaknessText(item)} - {decayText(item)}
                {item.localTrainingAdded ? ` - ${item.localTrainingAdded} weakest-line session${item.localTrainingAdded === 1 ? "" : "s"} saved` : ""}
              </small>
            </article>
          ))}
        </div>
      ) : null}

      <article className="openingJourneyCoach">
        <div>
          <span>Repertoire Coach</span>
          {journey.repertoireCoach ? (
            <>
              <strong>
                If you improve one line this week, make it: {journey.repertoireCoach.opening}
                {journey.repertoireCoach.variation ? ` - ${journey.repertoireCoach.variation}` : ""}.
              </strong>
              <ul>
                {journey.repertoireCoach.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p>{journey.repertoireCoach.suggestedAction}</p>
            </>
          ) : (
            <p>Analyse more games to unlock a reliable repertoire coach recommendation.</p>
          )}
        </div>
      </article>

      {!journey.repertoireCoach ? (
        <article className="openingJourneyFix">
          <div>
            <span>One Thing To Fix</span>
            <strong>{fixText(journey.oneFix)}</strong>
            {journey.oneFix ? <small>{confidenceText(journey.oneFix)}</small> : null}
            <p>{journey.oneFix?.whyItMatters || journey.oneFix?.why_it_matters || "Fix one repeated opening problem before adding more theory."}</p>
          </div>
        </article>
      ) : null}
    </section>
  );
}
