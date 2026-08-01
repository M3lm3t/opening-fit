import { buildOpeningOpportunityDrill } from "./openingOpportunityDrills.js";
import { normaliseOpeningKey } from "../data/openings.ts";
import { buildTrainingReviewSelection, deriveKnownLineConcept } from "./trainingGameReview.js";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const text = (value) => String(value ?? "").trim();

function opportunityGameId(opportunity = {}) {
  return text(opportunity.gameId || opportunity.game_id);
}

function opportunityOpening(opportunity = {}) {
  return normaliseOpeningKey(opportunity.openingName || opportunity.opening_name || opportunity.openingId || opportunity.opening_id || "");
}

function scoreOpportunity(opportunity, priority) {
  const evidenceIds = new Set(list(priority?.evidenceGameIds).map(text));
  const exactGame = evidenceIds.has(opportunityGameId(opportunity));
  const sameOpening = Boolean(priority?.openingKey && opportunityOpening(opportunity) === normaliseOpeningKey(priority.openingKey || priority.openingName));
  const sameSide = !priority?.playerColour || text(opportunity.side).toLowerCase() === priority.playerColour;
  return (exactGame ? 100 : 0) + (sameOpening ? 20 : 0) + (sameSide ? 5 : 0) + Number(opportunity.recurrenceCount || opportunity.recurrence_count || 0);
}

function reportDecision(report = {}) {
  return report.reportDecision || report.report_decision || {};
}

function sameOpening(left, right) {
  return Boolean(left && right && normaliseOpeningKey(left) === normaliseOpeningKey(right));
}

export function explainTrainingPriority(report = {}, priority = null) {
  const opening = text(priority?.openingName) || "this opening";
  const games = Math.max(0, Number(priority?.evidenceCount || 0));
  const decision = reportDecision(report);
  const problem = decision.primaryProblem || decision.primary_problem || null;
  const confidence = text(priority?.confidenceStatus).toLowerCase();
  const role = text(priority?.role).toLowerCase();
  const actionType = text(priority?.actionType).toLowerCase();
  const problemGames = Number(problem?.sample?.games ?? problem?.games ?? games);
  const supportedProblem = problem && sameOpening(problem.opening || problem.openingName, opening) && problemGames >= 5;

  if (supportedProblem && /repair|weak|problem/.test(actionType)) {
    return {
      kind: "reliable_weakness",
      label: "Reliable weakness",
      text: `Selected because ${opening} is the report's evidence-supported repair priority across ${games || problemGames} analysed games.`,
    };
  }
  if (role.startsWith("faced_")) {
    return {
      kind: "preparation_opportunity",
      label: "Preparation opportunity",
      text: games
        ? `Selected because you faced ${opening} ${games} time${games === 1 ? "" : "s"} in this report; frequency supports preparation, not a weakness claim.`
        : `Selected as preparation for ${opening}; the report does not establish it as a weakness.`,
    };
  }
  if (/insufficient|limited|unknown/.test(confidence) || priority?.fallback) {
    return {
      kind: "insufficient_evidence",
      label: "Insufficient evidence",
      text: `Selected as a low-commitment review of ${opening}; the available evidence does not establish a reliable weakness.`,
    };
  }
  return {
    kind: "preparation_opportunity",
    label: "Preparation opportunity",
    text: games
      ? `Selected because ${opening} appears in ${games} relevant analysed game${games === 1 ? "" : "s"}; no reliable weakness is claimed.`
      : `Selected from the report's training priority as preparation; the evidence does not establish a weakness.`,
  };
}

function generalSetupOpportunity(priority = {}, priorityReason = null, report = {}, knownLineConcept = null) {
  const opening = text(priority.openingName) || "Opening fundamentals";
  const fictional = report.sampleMode || report.sample_mode || report.source === "sample_fixture";
  return {
    opportunityId: `free-general-setup:${text(priority.priorityId) || normaliseOpeningKey(opening) || "report"}`,
    openingId: text(priority.openingKey) || normaliseOpeningKey(opening),
    openingName: opening,
    side: priority.playerColour === "black" ? "black" : "white",
    issueType: "unsuitable_opening_plan",
    explanation: priorityReason?.text || text(priority.rationale) || "Use a stable development plan before making an unsupported repertoire change.",
    evidence: fictional
      ? "Fictional general setup based on the illustrative example report."
      : `${priorityReason?.label || "Preparation opportunity"}. Based on your report's training priority, not on a reconstructed position from a particular game.`,
    confidence: null,
    recurrenceCount: 1,
    generalSetup: true,
    knownLineConcept,
    trainingPriorityReason: priorityReason,
  };
}

export function buildFreeTrainingExercise(report = {}, priority = null) {
  const priorityReason = explainTrainingPriority(report, priority);
  const selectedReview = buildTrainingReviewSelection(report, priority || {}, priorityReason);
  const knownLineConcept = selectedReview.games.map((game) => deriveKnownLineConcept(game, priority?.openingName)).find(Boolean) || null;
  const diagnosis = priority?.openingDiagnosis || priority?.opening_diagnosis || null;
  const diagnosisOpportunity = diagnosis?.positionFen && diagnosis?.representativeGameId ? {
    opportunityId: `diagnosis:${diagnosis.diagnosisId}`,
    diagnosisId: diagnosis.diagnosisId,
    gameId: diagnosis.representativeGameId,
    openingId: priority?.openingKey,
    openingName: diagnosis.opening,
    side: diagnosis.playerColour,
    positionFen: diagnosis.positionFen,
    moveNumber: diagnosis.targetMoveNumber,
    playedMove: diagnosis.repeatedContinuation?.move || null,
    recommendedMove: diagnosis.authoritativeContinuation?.move || null,
    expectedMoves: diagnosis.authoritativeContinuation?.move ? [diagnosis.authoritativeContinuation.move] : [],
    source: diagnosis.authoritativeContinuation?.source || "repeated_personal_continuation",
    issueType: "repeated_personal_decision",
    explanation: diagnosis.userFacingDiagnosis,
    evidence: diagnosis.evidenceSummary,
    confidence: diagnosis.confidence,
    recurrenceCount: list(diagnosis.supportingGameIds).length,
    trainingPriorityReason: priorityReason,
  } : null;
  const opportunities = [diagnosisOpportunity, ...list(report.openingTrainingOpportunities || report.opening_training_opportunities)]
    .filter(Boolean)
    .map((opportunity) => ({ opportunity, drill: buildOpeningOpportunityDrill(opportunity, report) }))
    .filter((entry) => entry.drill.valid && entry.drill.provenance?.kind === "own_game_position")
    .sort((left, right) => scoreOpportunity(right.opportunity, priority) - scoreOpportunity(left.opportunity, priority));
  const evidenceIds = new Set(list(priority?.evidenceGameIds).map(text));
  const representativeIds = new Set(list(priority?.representativeGameIds).map(text));
  const allowedIds = priority?.representativeSelectionRequired || Number(priority?.schemaVersion || 0) >= 2 ? representativeIds : evidenceIds;
  const matchesContext = (opportunity) => (
    (!priority?.openingName && !priority?.openingKey || opportunityOpening(opportunity) === normaliseOpeningKey(priority.openingKey || priority.openingName))
    && (!priority?.playerColour || text(opportunity.side).toLowerCase() === priority.playerColour)
  );
  const matched = opportunities.find(({ opportunity }) => allowedIds.has(opportunityGameId(opportunity)) && matchesContext(opportunity));

  if (matched) {
    const opportunity = { ...matched.opportunity, knownLineConcept, trainingPriorityReason: priorityReason };
    const drill = buildOpeningOpportunityDrill(opportunity, report);
    return {
      kind: "own_game_position",
      opportunity,
      drill,
      provenance: drill.provenance,
      priorityReason,
      attribution: "From one of your analysed games",
      sourceGameId: drill.sourceGame?.id || opportunityGameId(opportunity) || null,
    };
  }

  const opportunity = generalSetupOpportunity(priority || {}, priorityReason, report, knownLineConcept);
  const drill = buildOpeningOpportunityDrill(opportunity, report);
  return {
    kind: "general_opening_setup",
    opportunity,
    drill,
    provenance: drill.provenance,
    priorityReason,
    attribution: drill.provenance.label,
    sourceGameId: null,
  };
}
