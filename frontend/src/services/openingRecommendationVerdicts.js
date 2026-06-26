import { normaliseOpeningKey } from "../data/openings";
import {
  OPENING_RECOMMENDATION_VERDICT_ACTIONS,
  OPENING_RECOMMENDATION_VERDICT_THRESHOLDS,
} from "./openingRecommendationVerdictConfig";

const VERDICT_LABELS = {
  KEEP: "KEEP",
  REPAIR: "REPAIR",
  REPLACE: "REPLACE",
  WATCH: "WATCH",
};

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function numberValue(...values) {
  const value = firstValue(...values);
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function openingRecommendationName(item) {
  if (typeof item === "string") return item;
  return firstValue(item?.name, item?.opening, item?.openingName, "Recommended opening");
}

function openingKey(item) {
  return normaliseOpeningKey(openingRecommendationName(item));
}

function gamesFor(item = {}) {
  return numberValue(item.games, item.games_played, item.gamesPlayed, item.count, item.sampleSize, item.sample_size) || 0;
}

function scoreFor(item = {}) {
  return clampScore(
    firstValue(item.fit_score, item.fitScore, item.openingFitScore, item.opening_fit_score, item.score, item.winRate, item.win_rate)
  );
}

function lossRateFor(item = {}) {
  return numberValue(item.lossRate, item.loss_rate, item.lossPct, item.loss_pct);
}

function weakLineCountFor(item = {}) {
  const direct = numberValue(item.weakLineCount, item.weak_line_count, item.weakLinesCount, item.problemLineCount);
  if (direct !== null) return direct;
  const weakLines = firstValue(item.weakLines, item.weak_lines, item.problemLines, item.problem_lines);
  return Array.isArray(weakLines) ? weakLines.length : 0;
}

function planClarityFor(item = {}) {
  return numberValue(item.planClarityScore, item.plan_clarity_score, item.planClarity, item.plan_clarity);
}

function confidenceText(item = {}) {
  return String(firstValue(item.confidence, item.confidence_label, item.confidenceLabel, item.confidence_level, item.confidenceLevel, "")).toLowerCase();
}

function hasLimitedConfidence(item = {}, games = gamesFor(item)) {
  const confidence = confidenceText(item);
  return games <= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.watchMaxGames || /low|none|limited|thin|small/.test(confidence);
}

function isCredibleAlternative(candidate, current, currentScore) {
  if (!candidate || candidate === current) return false;
  if (openingKey(candidate) === openingKey(current)) return false;

  const score = scoreFor(candidate);
  if (score === null) return false;
  if (score < OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.credibleAlternativeMinScore) return false;
  if (currentScore !== null && score - currentScore < OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.credibleAlternativeScoreGap) return false;

  const label = String(firstValue(candidate.recommendation_label, candidate.recommendationLabel, candidate.label, "")).toLowerCase();
  const reason = String(firstValue(candidate.reason_label, candidate.reasonLabel, "")).toLowerCase();
  if (/avoid|too little|not urgent|watch/.test(`${label} ${reason}`)) return false;

  return true;
}

function bestCredibleAlternative(current, alternatives = [], currentScore) {
  return alternatives
    .filter((candidate) => isCredibleAlternative(candidate, current, currentScore))
    .sort((a, b) => (scoreFor(b) || 0) - (scoreFor(a) || 0))[0] || null;
}

function strongestRepairSignal({ lossRate, weakLineCount, planClarity, score }) {
  if (lossRate !== null && lossRate >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.replaceLossRateMin) {
    return `loss rate is ${Math.round(lossRate)}%`;
  }
  if (weakLineCount >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.weakLineCountMin) {
    return weakLineCount === 1 ? "one weak line is flagged" : `${weakLineCount} weak lines are flagged`;
  }
  if (planClarity !== null && planClarity <= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.planClarityLowMax) {
    return `plan clarity is ${Math.round(planClarity)}/100`;
  }
  if (score !== null && score <= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.repairScoreMax) {
    return `fit score is ${score}/100`;
  }
  if (lossRate !== null && lossRate >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.repairLossRateMin) {
    return `loss rate is ${Math.round(lossRate)}%`;
  }
  return "the report shows a repair signal";
}

function sentenceFor(verdict, { name, games, score, lossRate, weakLineCount, planClarity, alternative }) {
  const scoreText = score === null ? "without a comparable score" : `with a fit score of ${score}/100`;
  if (verdict === "KEEP") {
    return `Across ${games} games, ${name} is performing reliably ${scoreText}. No clear repair flag is stronger than the keep signal in this report.`;
  }
  if (verdict === "REPLACE") {
    return `Across ${games} games, ${name} is currently not serving you well ${scoreText}. ${openingRecommendationName(alternative)} is already a stronger fit in this report.`;
  }
  if (verdict === "REPAIR") {
    return `Across ${games} games, ${name} is worth keeping for now, but ${strongestRepairSignal({ lossRate, weakLineCount, planClarity, score })}. Repair the weak area before making a repertoire switch.`;
  }
  if (games > 0) {
    return `Across ${games} games, the evidence for ${name} is still limited or mixed. Treat this as a watch item, not a repertoire decision.`;
  }
  return `${name} does not have enough played games in this report for a repertoire verdict. Treat this as a watch item for now.`;
}

export function buildOpeningRecommendationVerdict(item = {}, alternatives = []) {
  const name = openingRecommendationName(item);
  const games = gamesFor(item);
  const score = scoreFor(item);
  const lossRate = lossRateFor(item);
  const weakLineCount = weakLineCountFor(item);
  const planClarity = planClarityFor(item);
  const alternative = bestCredibleAlternative(item, alternatives, score);
  const limited = hasLimitedConfidence(item, games) || score === null;

  let verdict = "WATCH";
  if (!limited) {
    const replacementSignal =
      games >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.replaceMinGames &&
      ((score !== null && score <= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.replaceScoreMax) ||
        (lossRate !== null && lossRate >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.replaceLossRateMin));
    const repairSignal =
      games >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.repairMinGames &&
      ((score !== null && score <= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.repairScoreMax) ||
        (lossRate !== null && lossRate >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.repairLossRateMin) ||
        weakLineCount >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.weakLineCountMin ||
        (planClarity !== null && planClarity <= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.planClarityLowMax));
    const keepSignal =
      games >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.keepMinGames &&
      score !== null &&
      score >= OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.keepScoreMin &&
      (lossRate === null || lossRate < OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.repairLossRateMin) &&
      weakLineCount < OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.weakLineCountMin &&
      (planClarity === null || planClarity > OPENING_RECOMMENDATION_VERDICT_THRESHOLDS.planClarityLowMax);

    if (replacementSignal && alternative) {
      verdict = "REPLACE";
    } else if (repairSignal || replacementSignal) {
      verdict = "REPAIR";
    } else if (keepSignal) {
      verdict = "KEEP";
    }
  }

  return {
    verdict,
    label: VERDICT_LABELS[verdict],
    evidence: sentenceFor(verdict, { name, games, score, lossRate, weakLineCount, planClarity, alternative }),
    action: OPENING_RECOMMENDATION_VERDICT_ACTIONS[verdict],
    alternativeName: alternative ? openingRecommendationName(alternative) : null,
    score,
    games,
  };
}
