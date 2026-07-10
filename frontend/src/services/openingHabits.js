import { normaliseOpeningKey } from "../data/openings";
import { mergeWeakLines } from "./weakLineDetection";

export const OPENING_HABIT_THRESHOLDS = {
  weakLineMinGames: 3,
  regularOpeningMinGames: 5,
  strongHabitMinGames: 6,
  strongScoreMin: 58,
  highLossRateMin: 50,
  earlyLossRateMin: 38,
  lowPlanClarityMax: 52,
  strongPlanClarityMin: 62,
  overRelianceShareMin: 50,
  spreadThinOpeningCount: 6,
};

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
  return item.opening || item.name || item.openingName || item.opening_name || item.ecoName || item.eco_name || "";
}

function isUnknownOpening(name = "") {
  const clean = String(name || "").trim().toLowerCase();
  return !clean || clean === "unknown" || clean === "unknown opening" || clean.includes("unclassified");
}

function gamesFor(item = {}) {
  return numberValue(item.games ?? item.gamesPlayed ?? item.games_played ?? item.count ?? item.total, 0);
}

function winRateFor(item = {}) {
  return numberValue(item.winRate ?? item.win_rate ?? item.scoreRate ?? item.score_rate ?? item.score, null);
}

function lossRateFor(item = {}) {
  const direct = numberValue(item.lossRate ?? item.loss_rate, null);
  if (direct !== null) return direct;
  const games = gamesFor(item);
  const losses = numberValue(item.losses ?? item.l, null);
  return games && losses !== null ? Math.round((losses / games) * 100) : null;
}

function collectOpenings(data = {}) {
  data = data || {};
  const metrics = data.openingFitMetrics || data.opening_fit_metrics || {};
  const retention = data.retentionMetrics || data.retention_metrics || {};
  const sources = [
    data.best_openings,
    data.bestOpenings,
    data.top_openings,
    data.topOpenings,
    data.opening_stats,
    data.openingStats,
    data.openings,
    metrics.openings,
    retention.openingMastery,
    retention.opening_mastery,
    data.openingMastery,
    data.opening_mastery,
  ];
  const merged = new Map();

  sources.flatMap(asArray).forEach((item) => {
    if (!item || typeof item !== "object") return;
    const name = openingName(item);
    if (isUnknownOpening(name)) return;
    const key = normaliseOpeningKey(name);
    if (!key) return;
    const games = gamesFor(item);
    const row = {
      ...item,
      key,
      name,
      games,
      winRate: winRateFor(item),
      lossRate: lossRateFor(item),
      earlyLossRate: numberValue(item.earlyLossRate ?? item.early_loss_rate, null),
      planClarityScore: numberValue(item.planClarityScore ?? item.plan_clarity_score, null),
      planClarityStatus: item.planClarityStatus || item.plan_clarity_status || "",
      planClarityNote: item.planClarityNote || item.plan_clarity_note || "",
      weakLineCount: numberValue(item.weakLineCount ?? item.weak_line_count, 0),
    };
    const current = merged.get(key);
    if (!current || row.games > current.games) merged.set(key, row);
  });

  return [...merged.values()].sort((a, b) => b.games - a.games);
}

function totalAnalysedGames(data = {}, openings = []) {
  return (
    numberValue(
      data.gamesAnalysed ??
        data.gamesAnalyzed ??
        data.games_analyzed ??
        data.gamesImported ??
        data.games_imported ??
        data.totalGames ??
        data.total_games,
      null
    ) || openings.reduce((sum, opening) => sum + opening.games, 0)
  );
}

function makeCard({ slot, category, openingKey = "", title, openingName = "", source = null, evidence, action, howFound, rank }) {
  return { slot, category, openingKey, title, openingName: openingName || title, source, evidence, action, howFound, rank };
}

function weakLineHabit(data = {}) {
  const line = mergeWeakLines(data, { minGames: OPENING_HABIT_THRESHOLDS.weakLineMinGames })
    .filter((item) => gamesFor(item) >= OPENING_HABIT_THRESHOLDS.weakLineMinGames)
    .sort((a, b) => (lossRateFor(b) ?? 0) - (lossRateFor(a) ?? 0) || gamesFor(b) - gamesFor(a))[0];

  if (!line) return null;
  const name = openingName(line);
  const variation = line.variation || line.line || line.moveLine || line.move_line || "";
  const games = gamesFor(line);
  const lossRate = lossRateFor(line);
  return makeCard({
    slot: "Most costly habit",
    category: "repeated issue in a specific opening",
    openingKey: normaliseOpeningKey(name),
    openingName: name,
    title: variation && variation !== name ? `${name}: ${variation}` : name,
    source: line,
    evidence: `Across ${games} repeated ${name} game${games === 1 ? "" : "s"}, this branch has a ${lossRate ?? "high"}% loss rate.`,
    action: "Review this branch first before judging the whole opening.",
    howFound: "Found from saved weak-line or variation data already present in this report.",
    rank: 1000 + games * 10 + (lossRate ?? 0),
  });
}

function costlyOpeningHabit(openings = []) {
  const candidates = openings
    .filter((opening) => opening.games >= OPENING_HABIT_THRESHOLDS.regularOpeningMinGames)
    .map((opening) => {
      if (opening.earlyLossRate !== null && opening.earlyLossRate >= OPENING_HABIT_THRESHOLDS.earlyLossRateMin) {
        return makeCard({
          slot: "Most costly habit",
          category: "frequent early losses in a known opening",
          openingKey: opening.key,
          openingName: opening.name,
          title: opening.name,
          source: opening,
          evidence: `Across ${opening.games} ${opening.name} games, ${opening.earlyLossRate}% ended badly early.`,
          action: "Replay the first 10 moves of recent losses and look for the first repeated uncomfortable position.",
          howFound: "Used opening-level early loss rate and game count from the report.",
          rank: 800 + opening.games * 8 + opening.earlyLossRate,
        });
      }
      if (opening.planClarityScore !== null && opening.planClarityScore < OPENING_HABIT_THRESHOLDS.lowPlanClarityMax) {
        return makeCard({
          slot: "Most costly habit",
          category: "low consistency in an opening",
          openingKey: opening.key,
          openingName: opening.name,
          title: opening.name,
          source: opening,
          evidence: `Across ${opening.games} ${opening.name} games, plan clarity is ${opening.planClarityScore}/100.`,
          action: "Choose one simple setup and avoid adding new branches until it feels familiar.",
          howFound: "Used the report's plan clarity score for this opening.",
          rank: 700 + opening.games * 8 + (OPENING_HABIT_THRESHOLDS.lowPlanClarityMax - opening.planClarityScore),
        });
      }
      if (opening.lossRate !== null && opening.lossRate >= OPENING_HABIT_THRESHOLDS.highLossRateMin) {
        return makeCard({
          slot: "Most costly habit",
          category: "repeated issue in a specific opening",
          openingKey: opening.key,
          openingName: opening.name,
          title: opening.name,
          source: opening,
          evidence: `Across ${opening.games} ${opening.name} games, the loss rate is ${opening.lossRate}%.`,
          action: "Treat this as a review target, not a reason to abandon the opening immediately.",
          howFound: "Used opening-level loss rate and sample size from the report.",
          rank: 600 + opening.games * 8 + opening.lossRate,
        });
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.rank - a.rank);

  return candidates[0] || null;
}

function strongestHabit(openings = []) {
  return openings
    .filter((opening) => {
      if (opening.games < OPENING_HABIT_THRESHOLDS.strongHabitMinGames) return false;
      if (opening.winRate === null || opening.winRate < OPENING_HABIT_THRESHOLDS.strongScoreMin) return false;
      return (
        (opening.lossRate !== null && opening.lossRate <= 35) ||
        (opening.planClarityScore !== null && opening.planClarityScore >= OPENING_HABIT_THRESHOLDS.strongPlanClarityMin) ||
        String(opening.fitClassification || opening.fit_classification || "").toLowerCase() === "strong_keep"
      );
    })
    .map((opening) =>
      makeCard({
        slot: "Strongest habit",
        category: "an opening with strong, consistent results",
        openingKey: opening.key,
        openingName: opening.name,
        title: opening.name,
        source: opening,
        evidence: `Across ${opening.games} ${opening.name} games, this scores ${opening.winRate}% with ${
          opening.planClarityScore !== null ? `${opening.planClarityScore}/100 plan clarity` : "a low loss-rate signal"
        }.`,
        action: "Keep this as a reference opening while you repair weaker branches elsewhere.",
        howFound: "Used opening score plus either plan clarity, low loss rate, or a strong-keep classification.",
        rank: opening.games * 8 + opening.winRate + (opening.planClarityScore ?? 0),
      })
    )
    .sort((a, b) => b.rank - a.rank)[0] || null;
}

function focusHabit(openings = [], data = {}) {
  const totalGames = totalAnalysedGames(data, openings);
  const top = openings[0] || null;
  const regularOpenings = openings.filter((opening) => opening.games >= OPENING_HABIT_THRESHOLDS.regularOpeningMinGames);
  const topShare = top && totalGames ? Math.round((top.games / totalGames) * 100) : 0;

  if (top && top.games >= OPENING_HABIT_THRESHOLDS.regularOpeningMinGames && topShare >= OPENING_HABIT_THRESHOLDS.overRelianceShareMin) {
    return makeCard({
      slot: "One focus for next games",
      category: "over-reliance on a single opening",
      openingKey: top.key,
      openingName: top.name,
      title: top.name,
      source: top,
      evidence: `${top.name} appears in ${topShare}% of the analysed opening sample (${top.games} of ${totalGames || top.games} games).`,
      action: "Keep it, but make sure your Black and alternate White responses also get a few recent games.",
      howFound: "Compared the most-played opening's game count with the total analysed opening sample.",
      rank: 500 + topShare,
    });
  }

  if (openings.length >= OPENING_HABIT_THRESHOLDS.spreadThinOpeningCount && regularOpenings.length <= 1) {
    return makeCard({
      slot: "One focus for next games",
      category: "insufficient sample size / spread too thin across openings",
      openingKey: "spread-thin",
      title: "Too many small samples",
      evidence: `The report found ${openings.length} named openings, but only ${regularOpenings.length} has enough games for a regular-opening read.`,
      action: "Repeat one White opening and one Black defence for a few games before adding more choices.",
      howFound: "Counted named openings and checked how many meet the regular-opening sample threshold.",
      rank: 450 + openings.length,
    });
  }

  const weak = costlyOpeningHabit(openings);
  if (weak) {
    return {
      ...weak,
      slot: "One focus for next games",
      action: "For the next few games, keep the opening choice simple and write down where this position starts to feel unclear.",
      rank: 400,
    };
  }

  return null;
}

function dedupeCards(cards = []) {
  const usedSlots = new Set();
  const usedContradictions = new Set();
  const result = [];

  cards
    .filter(Boolean)
    .sort((a, b) => {
      const slotOrder = ["Most costly habit", "Strongest habit", "One focus for next games"];
      return slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot) || b.rank - a.rank;
    })
    .forEach((card) => {
      if (usedSlots.has(card.slot)) return;
      const contradictionKey = card.openingKey && card.slot !== "One focus for next games" ? card.openingKey : `${card.slot}:${card.openingKey}`;
      if (usedContradictions.has(contradictionKey)) return;
      usedSlots.add(card.slot);
      usedContradictions.add(contradictionKey);
      result.push(card);
    });

  return result.slice(0, 3);
}

export function buildRecurringOpeningHabits(data = {}) {
  const openings = collectOpenings(data);
  const cards = dedupeCards([
    weakLineHabit(data) || costlyOpeningHabit(openings),
    strongestHabit(openings),
    focusHabit(openings, data),
  ]);

  return {
    cards,
    hasHabits: cards.length > 0,
    openingCount: openings.length,
  };
}
