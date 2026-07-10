import { normaliseOpeningKey } from "../data/openings";
import { findOpeningPracticePack } from "../data/openingPracticeLines";
import { buildOpeningRecommendationVerdict } from "./openingRecommendationVerdicts";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function numberValue(...values) {
  const value = firstValue(...values);
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function openingName(item) {
  if (typeof item === "string") return item;
  return firstValue(item?.name, item?.opening, item?.openingName, item?.label, "your repertoire");
}

function openingKey(item) {
  return normaliseOpeningKey(openingName(item));
}

function getGames(item = {}) {
  return numberValue(item.games, item.games_played, item.gamesPlayed, item.count, item.sampleSize, item.sample_size) || 0;
}

function getScore(item = {}) {
  return numberValue(item.fit_score, item.fitScore, item.openingFitScore, item.opening_fit_score, item.score, item.winRate, item.win_rate);
}

function reportDate(data = {}) {
  return firstValue(data.importedAt, data.imported_at, data.lastUpdated, data.last_updated, data.savedAt, data.createdAt);
}

function weekLabelFromDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return monday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function collectRecommendations(data = {}) {
  const groups = data.recommendedOpeningsByStyle || data.recommended_openings || {};
  const legacy = data.opening_recommendations || data.openingRecommendations || {};
  return [
    ...asArray(groups.white),
    ...asArray(groups.black_vs_e4 || groups.blackVsE4),
    ...asArray(groups.black_vs_d4 || groups.blackVsD4),
    ...asArray(groups.black_vs_other || groups.blackVsOther),
    ...asArray(legacy.white_repertoire || legacy.whiteDetailed),
    ...asArray(legacy.black_vs_e4 || legacy.blackVsE4Detailed),
    ...asArray(legacy.black_vs_d4 || legacy.blackVsD4Detailed),
    ...asArray(legacy.black_vs_other || legacy.blackVsOtherDetailed || legacy.blackVsD4Other),
    ...asArray(legacy.experimental_rare || legacy.experimentalRare),
  ];
}

function collectOpeningRows(data = {}, fitData = {}) {
  data = data || {};
  fitData = fitData || {};
  return [
    ...collectRecommendations(data),
    ...asArray(fitData.scoredOpenings),
    ...asArray(fitData.openings),
    ...asArray(data.opening_stats || data.openingStats),
    ...asArray(data.best_openings || data.bestOpenings || data.top_openings || data.topOpenings),
    ...asArray(data.weak_openings || data.weakOpenings || data.needs_work || data.needsWork),
  ].filter((item) => item && openingKey(item));
}

function collectWeakLines(data = {}) {
  data = data || {};
  return [
    ...asArray(data.weakLines),
    ...asArray(data.weak_lines),
    ...asArray(data.weakestLines),
    ...asArray(data.weakest_lines),
    ...asArray(data.lineWeaknesses),
    ...asArray(data.line_weaknesses),
  ].filter(Boolean);
}

function dedupeByOpening(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = openingKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function supportedPracticeTarget(item) {
  const name = openingName(item);
  return findOpeningPracticePack(name) ? name : "";
}

function targetPriority(item, alternatives, weakLines) {
  const verdict = buildOpeningRecommendationVerdict(item, alternatives);
  const label = String(firstValue(item.recommendation_label, item.recommendationLabel, item.reason_label, item.reasonLabel, "")).toLowerCase();
  const weakLineMatch = weakLines.some((line) => normaliseOpeningKey(firstValue(line.opening, line.name, line.openingName, "")) === openingKey(item));
  let priority = 0;

  if (verdict.verdict === "REPAIR") priority += 120;
  if (verdict.verdict === "REPLACE") priority += 95;
  if (weakLineMatch) priority += 80;
  if (/repair|improve|fix|weak|poor|cost/.test(label)) priority += 55;
  if (supportedPracticeTarget(item)) priority += 25;
  priority += Math.min(getGames(item), 20);
  priority += Math.max(0, 70 - (getScore(item) || 70)) / 4;

  return priority;
}

export function buildWeeklyOpeningSession(data, fitData = {}) {
  if (!data) {
    return {
      hasAnalysis: false,
      emptyTitle: "Your opening session appears after your first analysis.",
      emptyText: "Analyse recent games once, then OpeningFit can choose one review, one practice task, and one rapid-game objective.",
    };
  }

  const rows = dedupeByOpening(collectOpeningRows(data, fitData));
  const weakLines = collectWeakLines(data);
  const alternatives = collectRecommendations(data);
  const candidates = rows.length ? rows : alternatives;
  const target =
    [...candidates].sort((a, b) => targetPriority(b, alternatives, weakLines) - targetPriority(a, alternatives, weakLines))[0] ||
    fitData.weakestOpening ||
    fitData.bestOpening ||
    null;

  const name = target ? openingName(target) : "your current repertoire";
  const verdict = target ? buildOpeningRecommendationVerdict(target, alternatives) : { verdict: "WATCH", games: 0, score: null };
  const practiceTarget = target ? supportedPracticeTarget(target) : "";
  const weakLine = weakLines.find((line) => normaliseOpeningKey(firstValue(line.opening, line.name, line.openingName, "")) === normaliseOpeningKey(name));
  const issueText = firstValue(
    weakLine?.line,
    weakLine?.variation,
    weakLine?.name,
    weakLine?.reason,
    verdict.verdict === "REPAIR" ? `${name} repair signal` : `${name} games`
  );
  const weekStart = weekLabelFromDate(reportDate(data));
  const scoreText = verdict.score !== null ? `fit score ${verdict.score}/100` : `${verdict.games || getGames(target)} games`;
  const rationale =
    verdict.verdict === "REPAIR" || weakLine
      ? `Your latest report points to ${name} as the clearest repair target (${scoreText}). Keep this session narrow.`
      : target
        ? `Your latest report gives ${name} the clearest useful signal (${scoreText}). Use this session to maintain the line without adding theory.`
        : "Your latest report does not show one reliable weakness yet, so this is a simple repertoire-maintenance session.";

  const actions = [
    {
      key: "review",
      title: `Review ${issueText}`,
      time: "5 min",
      detail: weakLine ? "Use the existing weak-line or game-review view." : `Look at one recent ${name} game before changing anything.`,
      route: "weakspots",
    },
    practiceTarget
      ? {
          key: "practice",
          title: `Practise ${practiceTarget}`,
          time: "5 min",
          detail: "Use the existing opening practice board for one supported line.",
          practiceTarget,
        }
      : {
          key: "review-extra",
          title: `Review one more ${name} position`,
          time: "5 min",
          detail: "No supported practice pack was found, so keep this slot in review mode.",
          route: "games",
        },
    {
      key: "objective",
      title: `Play or review one rapid game with a ${name} focus`,
      time: "5 min",
      detail: "Aim for clean development and a familiar middlegame plan; do not treat this as completion tracking.",
      route: "training",
    },
  ];

  return {
    hasAnalysis: true,
    target,
    targetName: name,
    practiceTarget,
    rationale,
    actions,
    primaryRoute: actions[0].route || "weakspots",
    weekLabel: weekStart ? `Week of ${weekStart}` : "",
  };
}
