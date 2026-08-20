import { recommendationCopy } from "./reportCoachCopy.js";
import { analysisConfidence, OPENING_EVIDENCE_THRESHOLDS } from "./fitTrustModel.js";
import { formatTrainingPriorityTitle, TRAINING_SUBJECT_TYPES } from "./trainingPriority.js";
import { formatResultCounts } from "./reportGameCounts.js";
import { formatOpeningNameForDisplay } from "./openingNamePresentation.js";
import { buildAuthoritativeRoleViewModels } from "./authoritativeReportPresentation.js";
import { Chess } from "chess.js";
import { buildOpeningFitScoreTransparency } from "./openingFitScoreTransparency.js";

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export function canonicalChessEvidence(source) {
  if (!source || typeof source !== "object") return null;
  const diagnosis = source.openingDiagnosis || source.opening_diagnosis || {};
  const issue = source.recurringIssue || source.recurring_issue || source.issue || {};
  const fen = text(source.positionFen || source.position_fen || diagnosis.positionFen || diagnosis.position_fen);
  let positionFen = null;
  if (fen) {
    try {
      positionFen = new Chess(fen).fen();
    } catch {
      positionFen = null;
    }
  }
  const moveLine = text(
    source.recognisedLine || source.recognizedLine || source.recognised_line || source.recognized_line ||
    source.lineOrPosition || source.line_or_position || source.commonMovePrefix?.san || source.common_move_prefix?.san || diagnosis.commonMovePrefix?.san || diagnosis.common_move_prefix?.san ||
    issue.positionOrMoveSequence || issue.position_or_move_sequence || issue.moveLine || issue.move_line
  );
  if (!positionFen && !moveLine) return null;
  const colour = text(source.playerColour || source.player_color || diagnosis.playerColour || diagnosis.player_colour).toLowerCase();
  const role = text(source.repertoireRole || source.repertoire_role || diagnosis.repertoireRole || diagnosis.repertoire_role).toLowerCase();
  return { positionFen, moveLine: moveLine || null, orientation: colour === "black" || role.startsWith("black_") ? "black" : "white" };
}

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
  const opening = formatOpeningNameForDisplay(combined.opening || combined.openingName || combined.opening_name || combined.name);
  const detail = text(
    issue.variationName || issue.variation_name || combined.variationName || combined.variation_name ||
    combined.variation || combined.lineName || combined.line_name || training.variationName || training.variation_name ||
    issue.positionOrMoveSequence || issue.position_or_move_sequence || issue.moveLine || issue.move_line ||
    training.lineOrPosition || training.line_or_position
  );
  return { opening, detail };
}

function primaryActionCopy({ collectMoreGames, model, report, nextAction, training, problem, strength, priority, slots = [] }) {
  if (collectMoreGames) {
    const gap = slots.filter((slot) => !slot.complete).sort((left, right) => Number(left.additionalRelevantGamesRequired ?? 99) - Number(right.additionalRelevantGamesRequired ?? 99) || left.key.localeCompare(right.key))[0];
    return {
      title: gap?.requirement || moreGamesCopy(model, report, [nextAction, problem, strength].filter(Boolean), "can make another confident opening decision"),
      label: "Analyse more games",
      type: "analyse",
    };
  }
  const source = priority || training?.source || nextAction || problem || strength;
  const focus = explicitFocus(source);
  const opening = text(training?.opening || nextAction?.opening || focus.opening);
  const detail = text(training?.line || focus.detail);
  const namedFocus = [opening, detail && detail.toLowerCase() !== opening.toLowerCase() ? detail : ""].filter(Boolean).join(" — ");
  const duration = priority?.estimatedDurationMinutes || training?.durationMinutes || training?.estimatedMinutes || 10;
  return {
    title: priority
      ? formatTrainingPriorityTitle(priority)
      : namedFocus
      ? `This week: practise ${namedFocus} for approximately ${duration} minutes.`
      : `This week: review one recent analysed opening game for approximately ${duration} minutes.`,
    label: `Start ${duration}-minute practice`,
    type: "training",
    target: source || null,
  };
}

function noWeaknessExplanation({ model, problem, problemCandidates, strength, slots }) {
  if (problem) return { kind: "reliable_weakness", title: formatOpeningNameForDisplay(problem.opening), text: formatOpeningNameForDisplay(recommendationCopy(problem, "repair")) };
  const candidate = problemCandidates[0];
  const candidateGames = openingGames(candidate);
  const confidenceStatus = text(model.authoritative?.confidence?.status || model.confidence?.status).toLowerCase();
  if (candidate && candidateGames >= OPENING_EVIDENCE_THRESHOLDS.minimum) {
    return { kind: "confidence_threshold", title: "No statistically reliable opening weakness was found", text: "A possible weak pattern exists, but its recorded confidence or evidence quality did not meet the threshold for a firm repair claim." };
  }
  if (/insufficient|small|limited/.test(confidenceStatus) || Number(model.health?.games || 0) < OPENING_EVIDENCE_THRESHOLDS.minimum) {
    return { kind: "insufficient_evidence", title: "No statistically reliable opening weakness was found", text: "The report has too little opening-specific evidence to name a weakness reliably. This means ‘not enough evidence’, not ‘all openings are strong’." };
  }
  if (strength) {
    const missingRoles = slots.filter((slot) => !slot.complete).map((slot) => slot.label);
    const elsewhere = missingRoles.length ? `${missingRoles.join(" and ")} still need more evidence.` : "Other roles did not produce one repeated weak pattern above the report threshold.";
    return { kind: "strong_results", title: "No statistically reliable opening weakness was found", text: `${formatOpeningNameForDisplay(strength.opening)} has enough evidence for a keep decision. ${elsewhere}` };
  }
  return { kind: "mixed_or_distributed", title: "No statistically reliable opening weakness was found", text: "The available weaker results are mixed across openings or roles, so no single repeated pattern supports a repair claim yet." };
}

function preparationReason({ problem, collectMoreGames, priority, training, nextAction, fallback }) {
  if (problem || collectMoreGames) return fallback;
  const opening = formatOpeningNameForDisplay(priority?.openingName || training?.opening || nextAction?.opening);
  const count = Number(priority?.evidenceCount ?? nextAction?.sample?.games ?? training?.source?.sample?.games ?? training?.source?.games);
  const role = text(priority?.role || nextAction?.role).toLowerCase();
  if (opening && Number.isFinite(count) && count > 0) {
    return role.startsWith("faced_")
      ? `No statistically reliable opening weakness was found. ${opening} is your best preparation opportunity because you faced it ${Math.round(count)} time${Math.round(count) === 1 ? "" : "s"}.`
      : `No statistically reliable opening weakness was found. ${opening} is your best preparation opportunity because it appeared in ${Math.round(count)} analysed game${Math.round(count) === 1 ? "" : "s"}.`;
  }
  return opening
    ? `No statistically reliable opening weakness was found. ${opening} is the best available preparation opportunity from this report.`
    : "No statistically reliable opening weakness was found. This review is the best available preparation opportunity from the current evidence.";
}

function recommendationContext(strength) {
  if (!strength) return null;
  const combined = { ...(strength.source || {}), ...strength };
  const sample = combined.sample || {};
  const games = openingGames(combined);
  const scoreRate = Number(sample.scoreRate ?? combined.scoreRate ?? combined.score);
  const wins = Number(sample.wins ?? combined.wins);
  const draws = Number(sample.draws ?? combined.draws);
  const losses = Number(sample.losses ?? combined.losses);
  const knownResults = Number(sample.knownResults ?? sample.known_results ?? wins + draws + losses);
  const explicit = [
    ...(Array.isArray(combined.fitReasonBullets) ? combined.fitReasonBullets : []),
    ...(Array.isArray(combined.fit_reason_bullets) ? combined.fit_reason_bullets : []),
  ].map(text).filter(Boolean);
  const reasons = [...explicit];
  if (games > 0 && [wins, draws, losses, knownResults].every(Number.isFinite) && wins + draws + losses === knownResults && knownResults <= games) {
    reasons.push(`${games} suitable games produced ${formatResultCounts({ wins, draws, losses })}.`);
  } else if (games > 0) {
    reasons.push(`${games} suitable games support this opening-specific decision.`);
  }
  if (Number.isFinite(scoreRate)) reasons.push(`Its current chess score is ${Math.round(scoreRate)}% in the analysed sample, with draws counting as half a point.`);
  return {
    title: `Why ${formatOpeningNameForDisplay(strength.opening)} fits your current repertoire`,
    reasons: [...new Set(reasons.map(formatOpeningNameForDisplay))].slice(0, 3),
  };
}

function roleLabel(value) {
  const clean = text(value).toLowerCase();
  return ({
    white: "White repertoire",
    black_vs_e4: "Black against 1.e4",
    black_vs_d4: "Black against 1.d4",
    black_other: "Other Black games",
  })[clean] || text(value).replaceAll("_", " ") || "Repertoire context unavailable";
}

function evidenceLabel(candidate) {
  const combined = { ...(candidate?.source || {}), ...(candidate || {}) };
  return text(combined.evidenceConfidence?.label || combined.evidence_confidence?.label || combined.confidence?.label || combined.confidenceLabel || combined.confidence_level) || "Unavailable";
}

function observedSummary(candidate) {
  const combined = { ...(candidate?.source || {}), ...(candidate || {}) };
  const sample = combined.sample || {};
  const observed = combined.observedPerformance || combined.observed_performance || {};
  const games = openingGames(combined);
  const wins = Number(observed.wins ?? sample.wins ?? combined.wins);
  const draws = Number(observed.draws ?? sample.draws ?? combined.draws);
  const losses = Number(observed.losses ?? sample.losses ?? combined.losses);
  const knownResults = Number(observed.knownResults ?? sample.knownResults ?? sample.known_results ?? wins + draws + losses);
  const scoreRate = Number(observed.scoreRate ?? observed.score_rate ?? sample.scoreRate ?? sample.score_rate ?? combined.scoreRate ?? combined.score_rate);
  const reconciled = games > 0 && [wins, draws, losses, knownResults].every(Number.isFinite) && wins + draws + losses === knownResults && knownResults <= games;
  return {
    games,
    gamesLabel: games > 0 ? `${games} qualifying game${games === 1 ? "" : "s"}` : null,
    wins: reconciled ? wins : null,
    draws: reconciled ? draws : null,
    losses: reconciled ? losses : null,
    results: reconciled ? `${wins} W · ${draws} D · ${losses} L` : null,
    scoreRate: Number.isFinite(scoreRate) ? `${Math.round(scoreRate * 10) / 10}% score` : null,
    confidence: evidenceLabel(combined),
  };
}

export function buildPrimaryReportSummary(model = {}, report = {}) {
  const healthContract = report.repertoireHealth || report.repertoire_health || model.authoritative?.repertoireHealth || model.authoritative?.repertoireCoverageScore || null;
  const suppliedRoles = Array.isArray(model.repertoire) ? model.repertoire : [];
  const roleModels = suppliedRoles.length && suppliedRoles.every((item) => ["established", "building", "insufficient", "unresolved"].includes(item.status))
    ? suppliedRoles
    : buildAuthoritativeRoleViewModels({ baseRoles: suppliedRoles, candidates: suppliedRoles.map((item) => item.source).filter(Boolean) });
  const slots = roleModels.map((item) => ({
    key: item.key,
    label: item.label,
    opening: item.displayName || "Not established yet",
    confidence: item.confidence?.label || "Evidence unavailable",
    evidence: item.evidenceReason,
    requirement: item.evidenceRequirementCopy || item.evidenceRequirement?.whyNeeded || item.evidenceReason,
    filters: item.evidenceFilters || item.evidenceRequirement?.nonGuarantee || "Only correctly attributed games in this role count toward establishment.",
    games: item.relevantGames,
    status: item.status,
    statusLabel: item.statusLabel,
    verdict: item.verdict,
    verdictLabel: item.verdictLabel,
    complete: item.status === "established",
    tentative: item.status === "building",
    reasonCode: item.evidenceReasonCode || item.dataQuality,
    explanation: item.evidenceReason,
    funnelRows: item.evidenceFunnelRows || [],
    evidenceRequirement: item.evidenceRequirement,
    additionalRelevantGamesRequired: item.gamesNeeded,
    evidenceDiagnostics: item.evidenceDiagnostics || [],
    supportingGames: item.supportingGames,
    rawGames: item.rawGames,
    requiredGames: item.requiredGames,
    confidenceCounts: item.confidenceCounts,
    confidenceExplanation: item.confidenceExplanation,
    contextualAction: item.contextualAction,
    compatibleAlternative: item.compatibleAlternative,
  }));
  const lowConfidence = /low|insufficient|limited/i.test(text(model.health?.confidence)) || Number(model.health?.games || 0) < 5;
  const training = model.training;
  const strengthCandidates = [model.authoritative?.establishedStrength, model.establishedStrength, model.decisions?.find?.((item) => item.type === "keep")].filter(Boolean);
  const problemCandidates = [model.authoritative?.primaryProblem, model.primaryProblem, model.decisions?.find?.((item) => item.type === "repair")].filter(Boolean);
  const strength = decisionWithEvidence(strengthCandidates[0]);
  const problem = decisionWithEvidence(problemCandidates[0]);
  const nextAction = model.authoritative?.nextTrainingAction || model.nextTrainingAction || null;
  const trainingPriority = model.authoritative?.trainingPriority || model.trainingPriority || null;
  const hasExplicitTrainingAction = Boolean(nextAction?.type || training?.type || training?.opening || training?.source);
  const collectMoreGames = (nextAction?.type === "collect_more_games" || !hasExplicitTrainingAction) && trainingPriority?.subjectType !== TRAINING_SUBJECT_TYPES.ROLE_GAP;
  const keepFallback = moreGamesCopy(model, report, strengthCandidates, "makes a confident keep recommendation");
  const trainingTitle = formatOpeningNameForDisplay(training?.label || (training?.opening ? `Train ${training.opening}` : "Collect more games before changing your repertoire"));
  const rawTrainingReason = trainingPriority?.rationale || training?.objective || training?.reason || model.nextTrainingAction?.reason || "Review one opening focus before your next games.";
  const weakness = noWeaknessExplanation({ model, problem, problemCandidates, strength, slots });
  if (!problem && healthContract?.weaknessExplanation) weakness.text = text(healthContract.weaknessExplanation);
  const fitContext = recommendationContext(strength);
  const primaryAction = primaryActionCopy({ collectMoreGames, model, report, nextAction, training, problem, strength, priority: trainingPriority, slots });
  primaryAction.title = formatOpeningNameForDisplay(primaryAction.title);
  const trainingReason = formatOpeningNameForDisplay(trainingPriority?.fallbackSetupDrill?.instruction || preparationReason({ problem, collectMoreGames, priority: trainingPriority, training, nextAction, fallback: rawTrainingReason }));
  const establishedRoleCount = slots.filter((slot) => slot.complete).length;
  const completenessLabel = ({ 0: "Repertoire not established yet", 1: "Building repertoire", 2: "Nearly complete", 3: "Complete repertoire" })[establishedRoleCount] || "Repertoire status unavailable";
  const reportConfidenceStatus = text(healthContract?.confidence?.status || model.authoritative?.confidence?.status || model.confidence?.status).toLowerCase();
  const reportEvidenceSufficient = /sufficient|strong|high/.test(reportConfidenceStatus) && !/insufficient|limited|low/.test(reportConfidenceStatus);
  const scoreView = buildOpeningFitScoreTransparency({ model, report });
  const overallSummary = establishedRoleCount === 3 && reportEvidenceSufficient
    ? scoreView.currentScore !== null && scoreView.currentScore >= 78
      ? "Your repertoire is complete and performing well overall."
      : "Your repertoire covers all three core roles with sufficient overall evidence."
    : establishedRoleCount < slots.length
      ? `${completenessLabel}. ${slots.length - establishedRoleCount} core role${slots.length - establishedRoleCount === 1 ? " needs" : "s need"} more trustworthy role-specific evidence.`
      : oneSentence(model);
  const diagnosis = trainingPriority?.openingDiagnosis || trainingPriority?.opening_diagnosis || null;
  const experiment = model.authoritative?.experiment || model.experiment || null;
  const keepDisplay = strength || strengthCandidates[0] || null;
  const trainEvidenceCandidates = [nextAction, trainingPriority, training?.source, problem, strength].filter(Boolean);
  const trainEvidenceSource = trainEvidenceCandidates.find((candidate) => openingGames(candidate) > 0) || trainEvidenceCandidates[0] || null;
  const trainingChessEvidence = canonicalChessEvidence(trainingPriority || training?.source || nextAction);
  const repairChessEvidence = canonicalChessEvidence(diagnosis || problem);
  return {
    score: model.health?.score !== null && model.health?.score !== undefined && Number.isFinite(Number(model.health.score)) ? Math.round(Number(model.health.score)) : null,
    scoreLabel: model.health?.score === null || model.health?.score === undefined ? "Repertoire Health pending" : "Repertoire Health",
    establishedRoleCount,
    completenessLabel,
    health: { ...scoreView, overallSummary },
    totalRoleCount: slots.length,
    verdict: formatOpeningNameForDisplay(overallSummary || oneSentence(model)),
    evidenceExplanation: weakness.text,
    weaknessState: weakness.kind,
    recommendationContext: fitContext,
    trainingPriority,
    primaryAction,
    confidence: healthContract?.confidence?.label ? `Overall Evidence Confidence: ${healthContract.confidence.label}` : text(model.health?.confidence) || "Insufficient data",
    confidenceWarning: lowConfidence && !reportEvidenceSufficient ? `This report has ${model.health?.games || 0} game${Number(model.health?.games || 0) === 1 ? "" : "s"} with enough opening information, so recommendations are provisional. More analysed games will improve confidence.` : "",
    decisionId: model.authoritative?.decisionId || model.decisionId || null,
    diagnosisId: diagnosis?.diagnosisId || diagnosis?.diagnosis_id || trainingPriority?.diagnosisId || null,
    keep: {
      available: Boolean(strength),
      label: strength ? "Keep" : keepDisplay ? "Not enough evidence" : "Keep",
      opening: formatOpeningNameForDisplay(keepDisplay?.opening || keepDisplay?.openingName) || "No supported Keep decision yet",
      role: roleLabel(keepDisplay?.repertoireRole || keepDisplay?.repertoire_role),
      reason: strength ? formatOpeningNameForDisplay(recommendationCopy(strength, "keep")) : keepFallback,
      confidence: evidenceLabel(keepDisplay),
      observed: observedSummary(keepDisplay),
      source: strength,
    },
    repair: {
      available: Boolean(problem),
      opening: formatOpeningNameForDisplay(diagnosis?.variation || diagnosis?.opening || problem?.opening) || "No reliable repair target",
      role: roleLabel(diagnosis?.repertoireRole || diagnosis?.repertoire_role || problem?.repertoireRole || problem?.repertoire_role),
      diagnosis: text(diagnosis?.userFacingDiagnosis || diagnosis?.user_facing_diagnosis) || weakness.text,
      supportingGames: Array.isArray(diagnosis?.supportingGameIds) ? diagnosis.supportingGameIds.length : openingGames(problem),
      confidence: text(diagnosis?.confidence?.label || diagnosis?.confidenceLabel || diagnosis?.confidence_label) || evidenceLabel(problem),
      observed: observedSummary(problem),
      chessEvidence: repairChessEvidence,
      source: problem,
    },
    trainNext: {
      title: primaryAction.title,
      reason: trainingReason,
      duration: trainingPriority?.estimatedDurationMinutes || training?.durationMinutes || 10,
      successCheck: text(trainingPriority?.successCheck || trainingPriority?.success_check) || "Complete the task and record one practical takeaway.",
      action: primaryAction,
      priorityId: trainingPriority?.priorityId || null,
      opening: formatOpeningNameForDisplay(trainingPriority?.openingName || nextAction?.opening || training?.opening) || null,
      role: roleLabel(trainingPriority?.repertoireRole || nextAction?.repertoireRole || nextAction?.repertoire_role),
      observed: observedSummary(trainEvidenceSource),
      confidence: evidenceLabel(trainEvidenceSource),
      chessEvidence: trainingChessEvidence,
      provenanceLimitation: trainingPriority?.fallbackSetupDrill ? text(trainingPriority.fallbackReason) : "",
    },
    experiment: experiment ? {
      opening: formatOpeningNameForDisplay(experiment.openingName || experiment.opening || experiment.name) || "Optional opening experiment",
      role: roleLabel(experiment.repertoireRole || experiment.repertoire_role),
      reason: text(experiment.reason || experiment.explanation) || "This is an optional comparison, not a conclusion from your games.",
      hasPersonalEvidence: openingGames(experiment) > 0,
      observed: observedSummary(experiment),
      confidence: evidenceLabel(experiment),
    } : null,
    slots,
    incompleteRepertoire: slots.some((slot) => !slot.complete),
    decisions: [
      { key: "keep", label: "Keep", title: formatOpeningNameForDisplay(strength?.opening) || "your current choices while evidence builds", reason: strength ? formatOpeningNameForDisplay(recommendationCopy(strength, "keep")) : keepFallback, source: strength, action: branchAction(strength) },
      { key: "repair", label: problem ? "Repair" : "Weakness check", title: formatOpeningNameForDisplay(problem?.opening) || "No reliable repair target", reason: problem ? formatOpeningNameForDisplay(recommendationCopy(problem, "repair")) : weakness.text, source: problem, action: branchAction(problem) },
      { key: "train", label: problem ? "Train next" : collectMoreGames ? "Build evidence" : "Best preparation opportunity", title: primaryAction.title, reason: trainingReason, source: training?.source || problem || strength || null, action: primaryAction.type === "analyse" ? { label: primaryAction.label, type: primaryAction.type } : { label: primaryAction.label, type: primaryAction.type, target: primaryAction.target }, primary: true },
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
      trainingPriorityId: trainingPriority?.priorityId || null,
      openingName: formatOpeningNameForDisplay(trainingPriority?.openingName || training?.opening) || null,
      estimatedDurationMinutes: trainingPriority?.estimatedDurationMinutes || training?.durationMinutes || 10,
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
