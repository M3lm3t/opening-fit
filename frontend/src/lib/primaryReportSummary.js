import { formatRecommendationConfidence, missingSlotCopy, recommendationCopy } from "./reportCoachCopy.js";
import { analysisConfidence, OPENING_EVIDENCE_THRESHOLDS } from "./fitTrustModel.js";

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

function oneSentence(model = {}) {
  const paragraph = text(model.verdict?.paragraph);
  return paragraph || "There is not enough evidence yet for a confident repertoire verdict.";
}

function decisionWithEvidence(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const combined = { ...(candidate.source || {}), ...candidate };
  const explicitStatus = text(combined.sampleSizeStatus || combined.sample_size_status || combined.confidence?.status).toLowerCase();
  if (/insufficient|too[_ -]?small|one[_ -]?game/.test(explicitStatus)) return null;
  return analysisConfidence(combined).level === "insufficient" ? null : candidate;
}

function openingGames(candidate) {
  if (!candidate || typeof candidate !== "object") return 0;
  const value = Number(candidate.sample?.games ?? candidate.games ?? candidate.source?.sample?.games ?? candidate.source?.games ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function moreGamesCopy(model, report, candidates, purpose) {
  const mostRelevantGames = Math.max(0, ...candidates.map(openingGames));
  const needed = Math.max(1, OPENING_EVIDENCE_THRESHOLDS.minimum - mostRelevantGames);
  const format = text(model.header?.timeControl || report.effectiveTimeFormatLabel || report.effective_time_format_label || report.analysisTimeFormatLabel || report.analysis_time_format_label).toLowerCase();
  const gameType = format ? `${format} game${needed === 1 ? "" : "s"}` : `eligible game${needed === 1 ? "" : "s"}`;
  return `Play ${needed} more ${gameType} before OpeningFit ${purpose}.`;
}

function branchAction(source) {
  if (!source || typeof source !== "object") return null;
  const combined = { ...(source.source || {}), ...source };
  const issue = combined.recurringIssue || combined.recurring_issue || combined.issue || {};
  const training = combined.trainingAction || combined.training_action || {};
  const position = text(
    issue.positionOrMoveSequence || issue.position_or_move_sequence || issue.moveLine || issue.move_line ||
    training.lineOrPosition || training.line_or_position
  );
  if (position) return { label: "Practise this position", type: "practice", target: combined };
  const branch = text(
    issue.variationName || issue.variation_name || combined.variationName || combined.variation_name ||
    combined.variation || combined.lineName || combined.line_name || training.variationName || training.variation_name
  );
  return branch ? { label: "Review this branch", type: "evidence", target: combined } : null;
}

function explicitFocus(source) {
  if (!source || typeof source !== "object") return { opening: "", detail: "" };
  const combined = { ...(source.source || {}), ...source };
  const issue = combined.recurringIssue || combined.recurring_issue || combined.issue || {};
  const training = combined.trainingAction || combined.training_action || {};
  const opening = text(combined.opening || combined.openingName || combined.opening_name || combined.name);
  const detail = text(
    issue.variationName || issue.variation_name || combined.variationName || combined.variation_name ||
    combined.variation || combined.lineName || combined.line_name || training.variationName || training.variation_name ||
    issue.positionOrMoveSequence || issue.position_or_move_sequence || issue.moveLine || issue.move_line ||
    training.lineOrPosition || training.line_or_position
  );
  return { opening, detail };
}

function primaryActionCopy({ collectMoreGames, model, report, nextAction, training, problem, strength }) {
  if (collectMoreGames) {
    return {
      title: moreGamesCopy(model, report, [nextAction, problem, strength].filter(Boolean), "can make another confident opening decision"),
      label: "Analyse more games",
      type: "analyse",
    };
  }
  const source = training?.source || nextAction || problem || strength;
  const focus = explicitFocus(source);
  const opening = text(training?.opening || nextAction?.opening || focus.opening);
  const detail = text(training?.line || focus.detail);
  const namedFocus = [opening, detail && detail.toLowerCase() !== opening.toLowerCase() ? detail : ""].filter(Boolean).join(" — ");
  return {
    title: namedFocus
      ? `This week: practise ${namedFocus} for approximately 10 minutes.`
      : "This week: review one recent analysed opening game for approximately 10 minutes.",
    label: "Start 10-minute practice",
    type: "training",
    target: source || null,
  };
}

function noWeaknessExplanation({ model, problem, problemCandidates, strength, slots }) {
  if (problem) return { kind: "reliable_weakness", title: problem.opening, text: recommendationCopy(problem, "repair") };
  const candidate = problemCandidates[0];
  const candidateGames = openingGames(candidate);
  const confidenceStatus = text(model.authoritative?.confidence?.status || model.confidence?.status).toLowerCase();
  if (candidate && candidateGames >= OPENING_EVIDENCE_THRESHOLDS.minimum) {
    return { kind: "confidence_threshold", title: "No reliable opening weakness found yet", text: "A possible weak pattern exists, but its recorded confidence or evidence quality did not meet the threshold for a firm repair claim." };
  }
  if (/insufficient|small|limited/.test(confidenceStatus) || Number(model.health?.games || 0) < OPENING_EVIDENCE_THRESHOLDS.minimum) {
    return { kind: "insufficient_evidence", title: "No reliable opening weakness found yet", text: "The report has too little opening-specific evidence to name a weakness reliably. This means ‘not enough evidence’, not ‘all openings are strong’." };
  }
  if (strength) {
    const missingRoles = slots.filter((slot) => !slot.complete).map((slot) => slot.label);
    const elsewhere = missingRoles.length ? `${missingRoles.join(" and ")} still need more evidence.` : "Other roles did not produce one repeated weak pattern above the report threshold.";
    return { kind: "strong_results", title: "No reliable opening weakness found yet", text: `${strength.opening} has enough evidence for a keep decision. ${elsewhere}` };
  }
  return { kind: "mixed_or_distributed", title: "No reliable opening weakness found yet", text: "The available weaker results are mixed across openings or roles, so no single repeated pattern supports a repair claim yet." };
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
  const lowConfidence = /low|insufficient|limited/i.test(text(model.health?.confidence)) || Number(model.health?.games || 0) < 5;
  const training = model.training;
  const strengthCandidates = [model.authoritative?.establishedStrength, model.establishedStrength, model.decisions?.find?.((item) => item.type === "keep")].filter(Boolean);
  const problemCandidates = [model.authoritative?.primaryProblem, model.primaryProblem, model.decisions?.find?.((item) => item.type === "repair")].filter(Boolean);
  const strength = decisionWithEvidence(strengthCandidates[0]);
  const problem = decisionWithEvidence(problemCandidates[0]);
  const nextAction = model.authoritative?.nextTrainingAction || model.nextTrainingAction || null;
  const hasExplicitTrainingAction = Boolean(nextAction?.type || training?.type || training?.opening || training?.source);
  const collectMoreGames = nextAction?.type === "collect_more_games" || !hasExplicitTrainingAction;
  const keepFallback = moreGamesCopy(model, report, strengthCandidates, "makes a confident keep recommendation");
  const repairFallback = moreGamesCopy(model, report, problemCandidates, "identifies a confident repair target");
  const trainingTitle = training?.label || (training?.opening ? `Train ${training.opening}` : "Collect more games before changing your repertoire");
  const trainingReason = training?.objective || training?.reason || model.nextTrainingAction?.reason || "Review one opening focus before your next games.";
  const weakness = noWeaknessExplanation({ model, problem, problemCandidates, strength, slots });
  const primaryAction = primaryActionCopy({ collectMoreGames, model, report, nextAction, training, problem, strength });
  return {
    score: model.health?.score !== null && model.health?.score !== undefined && Number.isFinite(Number(model.health.score)) ? Math.round(Number(model.health.score)) : null,
    scoreLabel: model.health?.score === null || model.health?.score === undefined ? "Coverage pending" : "Repertoire coverage",
    verdict: oneSentence(model),
    evidenceExplanation: weakness.text,
    weaknessState: weakness.kind,
    primaryAction,
    confidence: text(model.health?.confidence) || "Insufficient data",
    confidenceWarning: lowConfidence ? `This report has ${model.health?.games || 0} game${Number(model.health?.games || 0) === 1 ? "" : "s"} with enough opening information, so recommendations are provisional. More analysed games will improve confidence.` : "",
    slots,
    incompleteRepertoire: slots.some((slot) => !slot.complete),
    decisions: [
      { key: "keep", label: "Keep", title: strength?.opening || "No established strength yet", reason: strength ? recommendationCopy(strength, "keep") : keepFallback, source: strength, action: branchAction(strength) },
      { key: "repair", label: "Repair", title: problem?.opening || "No reliable repair target yet", reason: problem ? recommendationCopy(problem, "repair") : repairFallback, source: problem, action: branchAction(problem) },
      { key: "train", label: "Train next", title: primaryAction.title, reason: trainingReason, source: training?.source || problem || strength || null, action: primaryAction.type === "analyse" ? { label: primaryAction.label, type: primaryAction.type } : { label: primaryAction.label, type: primaryAction.type, target: primaryAction.target }, primary: true },
    ],
    problem: {
      title: weakness.title,
      reason: weakness.text,
      evidence: Array.isArray(problem?.evidence) && problem.evidence.length
        ? problem.evidence.slice(0, 2).join(" · ")
        : Array.isArray(model.supportingEvidence) && model.supportingEvidence.length
          ? model.supportingEvidence.find((item) => text(item).toLowerCase().includes(text(problem?.opening).toLowerCase())) || model.supportingEvidence[0]
        : problem?.games
          ? `${problem.games} analysed game${Number(problem.games) === 1 ? "" : "s"} support this decision.`
          : "No problem claim is made without sufficient evidence.",
    },
    training: {
      title: trainingTitle,
      reason: trainingReason,
      source: training?.source || null,
      cta: primaryAction.label,
      actionType: collectMoreGames ? "analyse" : "training",
    },
  };
}

export function primaryComparisonState({ authenticated = false, previousReport = null, loading = false, error = "" } = {}) {
  if (!authenticated) return "hidden";
  if (error) return "error";
  if (loading) return "loading";
  return previousReport ? "available" : "hidden";
}
