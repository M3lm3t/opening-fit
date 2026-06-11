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
    title: "Results need work",
    message:
      "Your results in this opening are currently weaker than your other options, so OpeningFit suggests improving the basics before making it a main weapon.",
    nextStep: "Review your first 6-8 moves and common early mistakes.",
  },
  too_many_openings: {
    title: "Too many openings right now",
    message:
      "You are already playing a wide mix of openings. OpeningFit suggests focusing on fewer systems first so your training is more effective.",
    nextStep: "Pick one main opening for White and one main reply against 1.e4 and 1.d4.",
  },
  not_enough_data: {
    title: "Not enough games yet",
    message:
      "You have not played this opening enough recently for a confident recommendation.",
    nextStep: "Play a few more games before deciding whether to study it deeply.",
  },
  style_mismatch: {
    title: "Style mismatch for now",
    message:
      "This opening may not match your current playing style as well as your stronger options. It is not bad, but it may be harder to get practical value from right now.",
    nextStep: "Focus on stronger or more natural options first.",
  },
  too_theoretical: {
    title: "Theory-heavy for now",
    message:
      "This opening can become theory-heavy. OpeningFit suggests building a simpler, more reliable repertoire first.",
    nextStep: "Come back to it after your core repertoire is stable.",
  },
  better_alternative: {
    title: "A similar option fits better",
    message:
      "OpeningFit found a similar option that currently fits your results or style better, so this is a lower priority for now.",
    nextStep: "Study the better-fitting alternative first.",
  },
  low_priority: {
    title: "Lower study priority",
    message:
      "This opening is not a problem, but it is not the best use of your study time right now.",
    nextStep: "Focus on your stronger or more common openings first.",
  },
};

function text(value) {
  return String(value || "").trim();
}

export function shouldShowRecommendationReason(item = {}, label = "") {
  if (
    item?.recommendationReason ||
    item?.recommendation_reason ||
    item?.recommendationReasonType ||
    item?.recommendation_reason_type
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
  const type = text(item.recommendationReasonType || item.recommendation_reason_type || "low_priority");
  const fallback = FALLBACK_REASONS[type] || FALLBACK_REASONS.low_priority;
  const title = text(item.recommendationReasonTitle || item.recommendation_reason_title) || fallback.title;
  const message = text(item.recommendationReason || item.recommendation_reason) || fallback.message;
  const tooltip =
    text(item.recommendationTooltip || item.recommendation_tooltip) ||
    "OpeningFit is not saying this opening is bad. It is explaining the best study priority right now.";
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
        <strong>Why this recommendation?</strong>
        <span>{reason.title}</span>
        <em>{reason.tooltip}</em>
        <span>{reason.message}</span>
        {reason.priority ? <small>Study priority: {reason.priority}</small> : null}
        <small>{reason.nextStep}</small>
      </span>
    </InfoHint>
  );
}
