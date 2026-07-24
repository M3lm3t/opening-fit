export const REPORT_METRIC_DEFINITIONS = Object.freeze({
  openingFitScore: Object.freeze({
    label: "OpeningFit Score",
    scale: "0–100",
    purpose: "Primary coaching score for repertoire familiarity, White and Black results, recurring weaknesses and evidence confidence.",
    baselineAvailable: true,
    primary: true,
  }),
  repertoireHealth: Object.freeze({
    label: "Repertoire Health",
    scale: "0–100",
    purpose: "Secondary diagnostic for repertoire coverage and opening mastery; it overlaps the primary score and belongs in Progress details.",
    baselineAvailable: false,
    primary: false,
  }),
  openingJourney: Object.freeze({
    label: "Opening Journey",
    scale: "No separate score",
    purpose: "A history view for comparable report milestones, not another report score.",
    baselineAvailable: false,
    primary: false,
  }),
  repertoireConfidence: Object.freeze({
    label: "Evidence confidence",
    scale: "Insufficient / Low / Medium / High",
    purpose: "Describes sample support for a decision; it is not a second performance score.",
    baselineAvailable: true,
    primary: false,
  }),
  studyConsistency: Object.freeze({
    label: "Study consistency",
    scale: "Tracked activity, no report-score scale",
    purpose: "Shows repeated training activity only when history exists.",
    baselineAvailable: false,
    primary: false,
  }),
  xp: Object.freeze({
    label: "XP",
    scale: "Activity points, no fixed maximum",
    purpose: "Rewards tracked training activity; it does not measure repertoire quality.",
    baselineAvailable: false,
    primary: false,
  }),
});

export function reportMetricAvailability({ score = null, comparisonClaimsAllowed = false } = {}) {
  const scoreAvailable = score !== null && score !== undefined && score !== "" && Number.isFinite(Number(score));
  return Object.fromEntries(Object.entries(REPORT_METRIC_DEFINITIONS).map(([key, definition]) => [key, {
    ...definition,
    available: key === "openingFitScore" ? scoreAvailable : definition.baselineAvailable || comparisonClaimsAllowed,
    status: key === "openingFitScore" && !scoreAvailable
      ? "Unavailable: insufficient evidence"
      : definition.baselineAvailable || comparisonClaimsAllowed
        ? "Available"
        : "Unavailable on a baseline report",
  }]));
}
