import { formatRecommendationConfidence, missingSlotCopy, recommendationCopy } from "./reportCoachCopy.js";

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

function oneSentence(model = {}) {
  const paragraph = text(model.verdict?.paragraph);
  return paragraph || "There is not enough evidence yet for a confident repertoire verdict.";
}

export function buildPrimaryReportSummary(model = {}, report = {}) {
  const repertoire = new Map((Array.isArray(model.repertoire) ? model.repertoire : []).map((item) => [item.key, item]));
  const slots = [
    ["white", "White"],
    ["black_e4", "Black against 1.e4"],
    ["black_d4", "Black against 1.d4"],
  ].map(([key, label]) => {
    const item = repertoire.get(key);
    return {
      key,
      label,
      opening: item?.opening || missingSlotCopy(key),
      confidence: item ? formatRecommendationConfidence({ games: item.games, confidence: item.confidence }) : "More correctly attributed games are needed.",
      games: Number.isFinite(Number(item?.games)) ? Math.max(0, Math.round(Number(item.games))) : null,
      complete: Boolean(item),
    };
  });
  const completion = Number(report.weeklyTrainingPlan?.completionPercent ?? report.weekly_training_plan?.completionPercent ?? report.weekly_training_plan?.completion_percent ?? 0) || 0;
  const lowConfidence = /low|insufficient|limited/i.test(text(model.health?.confidence)) || Number(model.health?.games || 0) < 5;
  const training = model.training;
  const problem = model.primaryProblem || model.decisions?.find?.((item) => item.type === "repair") || null;
  return {
    score: model.health?.score !== null && model.health?.score !== undefined && Number.isFinite(Number(model.health.score)) ? Math.round(Number(model.health.score)) : null,
    scoreLabel: model.health?.score === null || model.health?.score === undefined ? "Score pending" : "OpeningFit Score",
    verdict: oneSentence(model),
    confidence: text(model.health?.confidence) || "Insufficient data",
    confidenceWarning: lowConfidence ? `This report has ${model.health?.games || 0} game${Number(model.health?.games || 0) === 1 ? "" : "s"} with enough opening information, so recommendations are provisional. More analysed games will improve confidence.` : "",
    slots,
    incompleteRepertoire: slots.some((slot) => !slot.complete),
    problem: {
      title: problem?.opening || "No reliable opening weakness found yet",
      reason: recommendationCopy(problem, "repair"),
      evidence: Array.isArray(problem?.evidence) && problem.evidence.length
        ? problem.evidence.slice(0, 2).join(" · ")
        : Array.isArray(model.supportingEvidence) && model.supportingEvidence.length
          ? model.supportingEvidence.find((item) => text(item).toLowerCase().includes(text(problem?.opening).toLowerCase())) || model.supportingEvidence[0]
        : problem?.games
          ? `${problem.games} analysed game${Number(problem.games) === 1 ? "" : "s"} support this decision.`
          : "No problem claim is made without sufficient evidence.",
    },
    training: {
      title: training?.label || (training?.opening ? `Train ${training.opening}` : "Collect more games before changing your repertoire"),
      reason: training?.objective || training?.reason || model.nextTrainingAction?.reason || "Review one opening focus before your next games.",
      source: training?.source || null,
      cta: completion > 0 && completion < 100 ? "Continue training" : "Start this week’s training",
    },
  };
}

export function primaryComparisonState({ authenticated = false, previousReport = null, loading = false, error = "" } = {}) {
  if (!authenticated) return "hidden";
  if (error) return "error";
  if (loading) return "loading";
  return previousReport ? "available" : "hidden";
}
