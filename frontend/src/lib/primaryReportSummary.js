const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

function oneSentence(model = {}) {
  const paragraph = text(model.verdict?.paragraph);
  if (/too small|not enough evidence/i.test(paragraph)) return paragraph || "There is not enough evidence yet for a confident repertoire verdict.";
  const strongest = text(model.verdict?.strongest);
  const weakness = text(model.verdict?.weakness);
  if (strongest && weakness) return `${strongest} is your clearest repertoire anchor; ${weakness} is the main area to repair.`;
  return paragraph.split(/(?<=[.!?])\s+/)[0] || "OpeningFit needs more games before making a confident verdict.";
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
      opening: item?.opening || "Not enough evidence yet",
      confidence: item?.confidence || "Insufficient data",
      games: Number.isFinite(Number(item?.games)) ? Math.max(0, Math.round(Number(item.games))) : null,
      complete: Boolean(item),
    };
  });
  const completion = Number(report.weeklyTrainingPlan?.completionPercent ?? report.weekly_training_plan?.completionPercent ?? report.weekly_training_plan?.completion_percent ?? 0) || 0;
  const lowConfidence = /low|insufficient|limited/i.test(text(model.health?.confidence)) || Number(model.health?.games || 0) < 5;
  const training = model.training;
  return {
    score: model.health?.score !== null && model.health?.score !== undefined && Number.isFinite(Number(model.health.score)) ? Math.round(Number(model.health.score)) : null,
    scoreLabel: model.health?.score === null || model.health?.score === undefined ? "Score pending" : "OpeningFit Score",
    verdict: oneSentence(model),
    confidence: text(model.health?.confidence) || "Insufficient data",
    confidenceWarning: lowConfidence ? `This report has ${model.health?.games || 0} analysed games, so recommendations are provisional. More games will improve confidence.` : "",
    slots,
    incompleteRepertoire: slots.some((slot) => !slot.complete),
    training: {
      title: training?.opening ? `Train ${training.opening}` : "Build one repeatable opening habit",
      reason: training?.objective || "Review one opening focus before your next games.",
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
