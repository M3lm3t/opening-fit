import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";
import { countNoun } from "./reportGameCounts.js";

export const TRAINING_PRIORITY_SCHEMA_VERSION = 3;

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const integer = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
};

function slug(value) {
  const normalized = normaliseOpeningKey(value);
  return text(normalized || value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
}

function reportDecision(report = {}, supplied = null) {
  return supplied || report.reportDecision || report.report_decision || {};
}

function prioritySource(report = {}, decision = {}) {
  // A decision-owned priority always wins. Top-level fields are compatibility
  // aliases and may be stale in older saved reports.
  const explicit = decision.trainingPriority || decision.training_priority || report.trainingPriority || report.training_priority;
  if (explicit && typeof explicit === "object") return explicit;
  const action = decision.primaryAction || decision.primary_action || decision.nextTrainingAction || decision.next_training_action || report.nextTrainingAction || report.next_training_action;
  if (action && typeof action === "object" && text(action.type || action.actionType || action.action_type).toLowerCase() !== "collect_more_games") return action;
  const legacy = list(report.nextTrainingActions || report.next_training_actions || report.trainingPlan || report.training_plan)[0];
  return legacy && typeof legacy === "object" ? legacy : null;
}

function targetFor(source, decision = {}) {
  const recommendationId = text(source?.recommendationId || source?.recommendation_id);
  return list(decision.recommendations).find((item) => text(item?.recommendationId || item?.recommendation_id) === recommendationId) || null;
}

function colourFor(source = {}, target = {}) {
  const explicit = text(source.playerColour || source.player_colour || source.colour || source.color || target?.playerColour || target?.player_colour).toLowerCase();
  if (["white", "black"].includes(explicit)) return explicit;
  const role = text(source.role || target?.role).toLowerCase();
  return role.endsWith("_black") ? "black" : role.endsWith("_white") ? "white" : null;
}

function taskTypeFor(source = {}) {
  const explicit = text(source.taskType || source.task_type);
  if (explicit) return explicit;
  const type = text(source.type).toLowerCase();
  if (source.lineOrPosition || source.line_or_position || source.positionFen || source.position_fen) return "position_drill";
  if (type === "collect_more_games") return "concept_review";
  if (["repair_repertoire", "prepare_against", "consolidate_strength", "repair", "keep"].includes(type)) return "game_review";
  return "concept_review";
}

function playerRoleFor(source = {}, target = {}) {
  const explicit = text(source.playerRole || source.player_role);
  if (["white_repertoire", "black_vs_e4", "black_vs_d4", "black_other", "unknown"].includes(explicit)) return explicit;
  const repertoireRole = text(source.repertoireRole || source.repertoire_role || target?.repertoireRole || target?.repertoire_role);
  if (repertoireRole === "white") return "white_repertoire";
  if (["black_vs_e4", "black_vs_d4"].includes(repertoireRole)) return repertoireRole;
  return colourFor(source, target) === "black" ? "black_other" : "unknown";
}

function canonicalPriority(source, report, decision) {
  if (!source || typeof source !== "object") return null;
  const diagnosis = source.openingDiagnosis || source.opening_diagnosis || decision.openingDiagnosis || decision.opening_diagnosis || null;
  const target = targetFor(source, decision);
  const sample = source.sample && typeof source.sample === "object" ? source.sample : target?.sample || {};
  const openingName = text(diagnosis?.opening || diagnosis?.openingFamily || target?.openingName || target?.opening || source.openingName || source.opening_name || source.opening) || null;
  const actionType = text(source.type || source.actionType || source.action_type || "review");
  const explicitFindingType = text(source.findingType || source.finding_type || target?.findingType || target?.finding_type);
  const findingType = explicitFindingType || (
    /prepare|explore/.test(actionType.toLowerCase()) ? "preparation_opportunity"
      : /repair|fix|weak/.test(actionType.toLowerCase()) ? "reliable_weakness"
        : /missing/.test(actionType.toLowerCase()) ? "missing_role"
          : /collect|fallback|insufficient/.test(actionType.toLowerCase()) ? "insufficient_evidence"
            : "preparation_opportunity"
  );
  const recommendationId = text(source.recommendationId || source.recommendation_id || target?.recommendationId);
  const openingKey = text(source.openingKey || source.opening_key || source.openingId || source.opening_id || target?.openingId) || (openingName ? slug(openingName) : null);
  const priorityId = text(source.priorityId || source.priority_id || source.taskId || source.task_id) || `training-${recommendationId || `${actionType}:${openingKey || "report"}`}`;
  const completion = source.completionTarget && typeof source.completionTarget === "object" ? source.completionTarget : {};
  const duration = Math.max(1, integer(source.estimatedDurationMinutes ?? source.estimated_duration_minutes ?? source.estimatedMinutes ?? source.estimated_minutes, 10));
  const fallback = source.fallback === true || source.isFallback === true || source.is_fallback === true;
  const title = text(source.trainingTitle || source.training_title || source.title) || (openingName ? `Practise ${openingName}` : text(source.label)) || "Review your current opening evidence";
  const evidenceGameIds = [...new Set(list(source.evidenceGameIds || source.evidence_game_ids || sample.gameIds || sample.game_ids || source.sourceGameIds || source.source_game_ids).map(text).filter(Boolean))];
  const evidenceSet = new Set(evidenceGameIds);
  const representativeGameIds = [...new Set(list(diagnosis?.representativeGameIds || diagnosis?.representative_game_ids || source.representativeGameIds || source.representative_game_ids).map(text).filter((id) => id && evidenceSet.has(id)))].slice(0, 3);
  const workflowSteps = list(source.sessionSteps || source.session_steps || source.workflowSteps || source.workflow_steps);
  return {
    schemaVersion: TRAINING_PRIORITY_SCHEMA_VERSION,
    decisionId: text(source.decisionId || source.decision_id || decision.decisionId || decision.decision_id) || null,
    actionId: text(source.actionId || source.action_id || decision.primaryAction?.actionId || decision.primary_action?.action_id) || null,
    priorityId,
    taskId: text(source.taskId || source.task_id) || priorityId,
    diagnosisId: text(diagnosis?.diagnosisId || diagnosis?.diagnosis_id || source.diagnosisId || source.diagnosis_id) || null,
    openingDiagnosis: diagnosis,
    recommendationId: recommendationId || null,
    openingName,
    openingKey,
    role: text(source.role || target?.role) || null,
    contextRole: text(source.contextRole || source.context_role || source.role || target?.role) || null,
    playerRole: playerRoleFor(source, target),
    relationship: ({ played: "played_by_user", faced: "faced_by_user" }[text(source.relationship || target?.relationship).toLowerCase()] || text(source.relationship || target?.relationship) || "unknown"),
    repertoireRole: text(diagnosis?.repertoireRole || diagnosis?.repertoire_role || source.repertoireRole || source.repertoire_role || target?.repertoireRole || target?.repertoire_role) || "unresolved",
    findingType,
    playerColour: text(diagnosis?.playerColour || diagnosis?.player_colour).toLowerCase() || colourFor(source, target),
    taskType: taskTypeFor(source),
    actionType,
    verdict: text(source.verdict || decision.primaryAction?.verdict || decision.primary_action?.verdict) || null,
    title,
    rationale: text(source.rationale || source.reason || source.explanation) || "Review the available report evidence before your next games.",
    reasonSelected: text(source.reasonSelected || source.reason_selected || source.rationale || source.reason || source.explanation) || "Review the available report evidence before your next games.",
    selectionCriteria: list(source.selectionCriteria || source.selection_criteria).map(text).filter(Boolean),
    selectionFactors: source.selectionFactors || source.selection_factors || target?.priorityFactors || target?.priority_factors || {},
    evidenceCount: integer(source.evidenceCount ?? source.evidence_count ?? sample.games ?? source.games),
    supportingGameCount: integer(source.supportingGameCount ?? source.supporting_game_count ?? source.evidenceCount ?? source.evidence_count ?? sample.games ?? source.games),
    evidenceGameIds,
    representativeGameIds,
    representativeGameStatus: representativeGameIds.length ? "verified" : "unavailable",
    representativeSelectionRequired: Number(source.schemaVersion || source.schema_version || 0) >= 2,
    estimatedDurationMinutes: duration,
    trainingDuration: source.trainingDuration && typeof source.trainingDuration === "object" ? source.trainingDuration : { minutes: duration },
    nextAction: text(diagnosis?.trainingTask || diagnosis?.training_task || source.nextAction || source.next_action || source.exercise || source.explanation) || null,
    successCheck: text(diagnosis?.successCheck || diagnosis?.success_check || source.successCheck || source.success_check || source.successCriteria || source.success_criteria || completion.label) || "Complete the practice and record one practical takeaway.",
    completionTarget: completion,
    confidenceStatus: text(source.confidenceStatus || source.confidence_status || target?.confidence?.level || source.confidence?.level || source.confidence) || "unknown",
    confidence: source.confidence && typeof source.confidence === "object" ? source.confidence : target?.confidence || { level: text(source.confidenceStatus || source.confidence_status) || "unknown" },
    sourceReportId: text(source.sourceReportId || source.source_report_id || report.analysisId || report.analysis_id || report.report_id || report.id) || null,
    lineOrPosition: text(diagnosis?.commonMovePrefix?.san || source.lineOrPosition || source.line_or_position || source.practiceLine || source.practice_line || source.recognisedLine || source.recognizedLine || source.line || source.moveLine || source.move_line) || null,
    recognisedLine: text(diagnosis?.commonMovePrefix?.san || source.recognisedLine || source.recognizedLine || source.recognised_line || source.recognized_line) || null,
    practiceLine: text(diagnosis?.commonMovePrefix?.san || source.practiceLine || source.practice_line) || null,
    classificationPly: integer(diagnosis?.targetPly ?? diagnosis?.target_ply ?? source.classificationPly ?? source.classification_ply, null),
    opponentContinuation: diagnosis ? null : source.opponentContinuation || source.opponent_continuation || null,
    playerResponse: diagnosis?.repeatedContinuation || diagnosis?.repeated_continuation || source.playerResponse || source.player_response || null,
    firstRepeatedDivergence: source.firstRepeatedDivergence || source.first_repeated_divergence || null,
    nextGameObjective: text(source.nextGameObjective || source.next_game_objective) || null,
    objectiveGameCount: integer(source.objectiveGameCount ?? source.objective_game_count, 5),
    workflowSteps,
    sessionSteps: workflowSteps,
    fallbackSetupDrill: source.fallbackSetupDrill || source.fallback_setup_drill || null,
    sourceGameAvailability: source.sourceGameAvailability || source.source_game_availability || null,
    positionFen: text(diagnosis?.positionFen || diagnosis?.position_fen || source.positionFen || source.position_fen) || null,
    expectedMoves: list(source.expectedMoves || source.expected_moves).map(text).filter(Boolean),
    fallback,
    fallbackReason: text(source.fallbackReason || source.fallback_reason) || null,
  };
}

function fallbackOpening(report = {}, decision = {}) {
  const strength = decision.establishedStrength || decision.established_strength;
  const candidates = [strength, ...list(report.topOpenings || report.top_openings || report.bestOpenings || report.best_openings || report.openings)];
  const source = candidates.find((item) => text(item?.opening || item?.openingName || item?.name)) || {};
  const rawName = text(source.opening || source.openingName || source.name) || "opening fundamentals";
  const known = findOpeningLine(rawName);
  return {
    name: known?.name || rawName,
    key: text(source.openingId || source.opening_id) || known?.id || slug(rawName),
    games: integer(source.sample?.games ?? source.games),
    colour: colourFor(source),
  };
}

function fallbackPriority(report, decision) {
  const opening = fallbackOpening(report, decision);
  const hasNamedOpening = opening.name !== "opening fundamentals";
  const evidence = opening.games > 0 ? `${countNoun(opening.games, "relevant game")} ${opening.games === 1 ? "supports" : "support"} ${opening.name} overall, but ` : "";
  const reason = hasNamedOpening
    ? `${evidence}not enough repeated examples of one ${opening.name} branch are available to recommend a narrower drill confidently.`
    : "The report does not contain enough repeated examples of one opening-specific branch to recommend a narrower drill confidently.";
  const priorityId = `training-fallback:${opening.key}`;
  return {
    schemaVersion: TRAINING_PRIORITY_SCHEMA_VERSION,
    priorityId,
    taskId: priorityId,
    openingName: hasNamedOpening ? opening.name : null,
    openingKey: hasNamedOpening ? opening.key : null,
    role: null,
    relationship: "unknown",
    repertoireRole: "unresolved",
    findingType: "insufficient_evidence",
    playerColour: opening.colour,
    taskType: "concept_review",
    actionType: "fallback",
    title: hasNamedOpening ? `Review one familiar ${opening.name} setup` : "Review one familiar opening setup",
    rationale: reason,
    reasonSelected: reason,
    evidenceCount: opening.games,
    evidenceGameIds: [],
    representativeGameIds: [],
    representativeGameStatus: "unavailable",
    supportingGameCount: opening.games,
    estimatedDurationMinutes: 10,
    successCheck: "Name one development cue and one practical response for your next game.",
    completionTarget: { type: "concept_and_future_evidence", count: 1, label: "Save one setup cue, then add relevant games before reassessing." },
    confidenceStatus: "insufficient_branch_evidence",
    confidence: { level: "insufficient_branch_evidence" },
    sourceReportId: text(report.analysisId || report.analysis_id || report.report_id || report.id) || null,
    lineOrPosition: null,
    recognisedLine: null,
    practiceLine: null,
    classificationPly: null,
    opponentContinuation: null,
    playerResponse: null,
    firstRepeatedDivergence: null,
    nextGameObjective: "In your next five relevant games, record the opening role and the first position where your plan became unclear.",
    objectiveGameCount: 5,
    workflowSteps: [
      { type: "setup_practice", label: "Review one clearly labelled general opening setup.", source: "general_guidance" },
      { type: "response_plan", label: "Save one practical cue for your next relevant game.", source: "general_guidance" },
      { type: "completion", label: "Add relevant games before changing your repertoire.", source: "completion_contract" },
    ],
    sessionSteps: [
      { type: "setup_practice", label: "Review one clearly labelled general opening setup.", source: "general_guidance" },
      { type: "response_plan", label: "Save one practical cue for your next relevant game.", source: "general_guidance" },
      { type: "next_game_objective", label: "In your next five relevant games, record the opening role and the first position where your plan became unclear.", source: "completion_contract" },
    ],
    fallbackSetupDrill: { source: "general_guidance", label: "General opening setup", instruction: "Complete development, support the centre and secure the king before choosing a structure-specific pawn break." },
    positionFen: null,
    expectedMoves: [],
    fallback: true,
    fallbackReason: reason,
    sourceGameAvailability: { supportingGames: opening.games, referencedGameIds: 0 },
  };
}

export function resolveTrainingPriority(report = {}, { decision: suppliedDecision = null, allowFallback = true } = {}) {
  const decision = reportDecision(report, suppliedDecision);
  const resolved = canonicalPriority(prioritySource(report, decision), report, decision);
  if (resolved) return resolved;
  return allowFallback ? fallbackPriority(report, decision) : null;
}

export function formatTrainingPriorityTitle(priority, { prefix = true } = {}) {
  const duration = integer(priority?.estimatedDurationMinutes, 10);
  const explicit = text(priority?.title).replace(/[.!]+$/, "");
  const focus = explicit ? `${explicit.charAt(0).toLowerCase()}${explicit.slice(1)}` : priority?.openingName ? `practise ${priority.openingName}` : "review one recent opening game";
  const sentence = `${focus || "review one recent opening game"} for approximately ${duration} minutes`;
  return `${prefix ? "This week: " : ""}${sentence}.`;
}

export function trainingTaskFromPriority(priority, order = 1) {
  if (!priority) return null;
  return {
    id: priority.taskId || priority.priorityId,
    type: priority.taskType,
    title: formatTrainingPriorityTitle(priority, { prefix: false }).replace(/\.$/, ""),
    explanation: priority.rationale,
    openingId: priority.openingKey,
    openingName: priority.openingName,
    trainingSide: priority.playerColour,
    playerRole: priority.playerRole,
    contextRole: priority.contextRole,
    relationship: priority.relationship,
    sourceGameIds: priority.evidenceGameIds,
    representativeGameIds: priority.representativeGameIds,
    positionFen: priority.positionFen,
    expectedMoves: priority.expectedMoves,
    successCriteria: priority.successCheck,
    estimatedMinutes: priority.estimatedDurationMinutes,
    order,
    status: "pending",
    trainingPriorityId: priority.priorityId,
    diagnosisId: priority.diagnosisId,
    openingDiagnosis: priority.openingDiagnosis,
    findingType: priority.findingType,
    repertoireRole: priority.repertoireRole,
    evidenceCount: priority.evidenceCount,
    evidenceSource: priority.evidenceGameIds?.length ? "user_games" : "general_guidance",
    evidenceSourceLabel: priority.evidenceGameIds?.length ? "Supported by your analysed games" : "General setup guidance; no recoverable source game is claimed",
    sourceReportId: priority.sourceReportId,
    lineOrPosition: priority.lineOrPosition,
    recognisedLine: priority.recognisedLine,
    practiceLine: priority.practiceLine,
    classificationPly: priority.classificationPly,
    opponentContinuation: priority.opponentContinuation,
    playerResponse: priority.playerResponse,
    firstRepeatedDivergence: priority.firstRepeatedDivergence,
    nextGameObjective: priority.nextGameObjective,
    completionTarget: priority.completionTarget,
    workflowSteps: priority.workflowSteps,
    fallbackSetupDrill: priority.fallbackSetupDrill,
    fallback: priority.fallback,
    fallbackReason: priority.fallbackReason,
    fixedDuration: true,
  };
}

export function trainingPlanMatchesPriority(plan, priority) {
  if (!plan || !priority) return false;
  const planPriorityId = text(plan.trainingPriorityId || plan.training_priority_id || plan.trainingPriority?.priorityId || plan.targetMetric?.trainingPriorityId || plan.target_metric?.trainingPriorityId);
  return Boolean(planPriorityId && planPriorityId === priority.priorityId);
}
