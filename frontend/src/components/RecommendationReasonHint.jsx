import InfoHint from "./InfoHint";

const HELPFUL_LABELS = [
  "avoid",
  "do not learn",
  "do not study",
  "not currently recommended",
  "not a priority",
  "low priority",
  "lower priority",
  "improve first",
  "needs review",
  "replace",
  "bad fit",
  "style mismatch",
];

const FALLBACK_REASONS = {
  poor_results: {
    title: "Poor results",
    message: "Your results in this opening are currently weaker than your other options.",
    nextStep: "Review the first recurring mistake before making it a main weapon.",
  },
  low_sample: {
    title: "Low sample",
    message: "You have not played this enough for a confident recommendation yet.",
    nextStep: "Play a few more games before changing your repertoire.",
  },
  style_mismatch: {
    title: "Style mismatch",
    message: "The positions from this opening may not match where your recent results are strongest.",
    nextStep: "Keep it as a side option while prioritising better-fitting openings.",
  },
  repertoire_overload: {
    title: "Repertoire overload",
    message: "You may be spreading your opening study across too many lines.",
    nextStep: "Pick one main opening for White and one main reply against 1.e4 and 1.d4.",
  },
  needs_repair: {
    title: "Needs repair",
    message: "This may still be playable, but one or two recurring mistakes need fixing first.",
    nextStep: "Train one repeated branch before adding more theory.",
  },
  not_urgent: {
    title: "Not urgent",
    message: "This is not a priority compared with openings you play more often.",
    nextStep: "Focus on your higher-volume or clearer repair targets first.",
  },
  better_alternative: {
    title: "A similar option fits better",
    message:
      "OpeningFit found a similar option that currently fits your results or style better, so this is a lower priority for now.",
    nextStep: "Study the better-fitting alternative first.",
  },
};

const REASON_ALIASES = {
  below_average: "poor_results",
  early_losses: "poor_results",
  low_sample_size: "low_sample",
  not_enough_data: "low_sample",
  too_little_data: "low_sample",
  too_many_openings: "repertoire_overload",
  too_theoretical: "repertoire_overload",
  theory_heavy: "repertoire_overload",
  low_priority: "not_urgent",
  fallback: "not_urgent",
  repair: "needs_repair",
  improve: "needs_repair",
};

function text(value) {
  return String(value || "").trim();
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function getGames(item = {}) {
  return numberValue(item.games ?? item.games_played ?? item.gamesPlayed ?? item.count ?? item.total, 0);
}

function getScore(item = {}) {
  const direct =
    item.winRate ??
    item.win_rate ??
    item.score ??
    item.scoreRate ??
    item.score_rate ??
    item.fit_score ??
    item.fitScore ??
    item.percentage;
  const score = numberValue(direct);
  if (score !== null) return score <= 1 ? Math.round(score * 100) : Math.round(score);
  return null;
}

function activeOpeningCount(item = {}) {
  const active = item.activeOpenings || item.active_openings || item.repertoire || item.repertoireOpenings;
  if (Array.isArray(active)) return active.length;
  return numberValue(item.activeRepertoireCount ?? item.active_repertoire_count, 0);
}

function normaliseReasonType(type) {
  const key = text(type).toLowerCase().replace(/\s+/g, "_");
  return REASON_ALIASES[key] || key;
}

function inferReasonType(item = {}, label = "") {
  const explicit = normaliseReasonType(
    item.recommendationReasonType ||
      item.recommendation_reason_type ||
      item.reasonType ||
      item.reason_type ||
      item.reason_label ||
      item.reasonLabel
  );
  if (FALLBACK_REASONS[explicit]) return explicit;

  const games = getGames(item);
  const score = getScore(item);
  const haystack = [
    label,
    item.label,
    item.recommendation,
    item.verdict,
    item.fitVerdict,
    item.fit_verdict,
    item.reason,
    item.short_reason,
    item.shortReason,
    item.risk_level,
    item.riskLevel,
    item.learning_cost,
    item.learningCost,
    item.theory_load,
    item.theoryLoad,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  if (games > 0 && games < 4) return "low_sample";
  if (score !== null && games >= 4 && score < 45) return "poor_results";
  if (activeOpeningCount(item) >= 4 || /overload|too many|high theory|theory-heavy|high effort/.test(haystack)) {
    return "repertoire_overload";
  }
  if (/style mismatch|poor fit|bad fit|does not match|different type of middlegame/.test(haystack)) {
    return "style_mismatch";
  }
  if (/repair|improve|review|recurring mistake|needs work|unstable/.test(haystack)) {
    return "needs_repair";
  }
  return "not_urgent";
}

export function shouldShowRecommendationReason(item = {}, label = "") {
  if (
    item?.recommendationReason ||
    item?.recommendation_reason ||
    item?.recommendationReasonType ||
    item?.recommendation_reason_type ||
    item?.reason_label ||
    item?.reasonLabel
  ) {
    return true;
  }

  const haystack = [
    label,
    item?.label,
    item?.recommendation,
    item?.verdict,
    item?.fitVerdict,
    item?.fit_verdict,
    item?.reason,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return HELPFUL_LABELS.some((needle) => haystack.includes(needle));
}

export function recommendationReasonDetails(item = {}, label = "") {
  const type = inferReasonType(item, label);
  const fallback = FALLBACK_REASONS[type] || FALLBACK_REASONS.not_urgent;
  const title = text(item.recommendationReasonTitle || item.recommendation_reason_title) || fallback.title;
  const message = text(item.recommendationReason || item.recommendation_reason) || fallback.message;
  const tooltip =
    text(item.recommendationTooltip || item.recommendation_tooltip) ||
    "This is based on your current game sample, not a verdict on the opening itself.";
  const nextStep = text(
    item.recommendationReasonNextStep ||
      item.recommendation_reason_next_step ||
      item.nextStep ||
      item.next_step
  ) || fallback.nextStep;
  const priority = text(item.studyPriority || item.study_priority);

  return {
    type,
    title,
    message,
    tooltip,
    nextStep,
    priority,
    label: label || item.label || item.recommendation || item.verdict || "recommendation",
  };
}

export default function RecommendationReasonHint({ item, label = "", className = "" }) {
  if (!shouldShowRecommendationReason(item, label)) return null;
  const reason = recommendationReasonDetails(item, label);

  return (
    <InfoHint label={`Why this recommendation for ${reason.label}`} className={className}>
      <span className="recommendationReasonHint">
        <strong>Why this?</strong>
        <span>{reason.title}</span>
        <em>{reason.tooltip}</em>
        <span>{reason.message}</span>
        {reason.priority ? <small>Study priority: {reason.priority}</small> : null}
        <small>{reason.nextStep}</small>
      </span>
    </InfoHint>
  );
}
