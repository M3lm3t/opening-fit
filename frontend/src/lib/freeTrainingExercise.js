import { buildOpeningOpportunityDrill } from "./openingOpportunityDrills.js";
import { normaliseOpeningKey } from "../data/openings.ts";

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

function generalSetupOpportunity(priority = {}) {
  const opening = text(priority.openingName) || "Opening fundamentals";
  return {
    opportunityId: `free-general-setup:${text(priority.priorityId) || normaliseOpeningKey(opening) || "report"}`,
    openingId: text(priority.openingKey) || normaliseOpeningKey(opening),
    openingName: opening,
    side: priority.playerColour === "black" ? "black" : "white",
    issueType: "unsuitable_opening_plan",
    explanation: text(priority.rationale) || "Use a stable development plan before making an unsupported repertoire change.",
    evidence: "General setup task based on the report’s canonical training priority. This position is not claimed to come from one of your games.",
    confidence: null,
    recurrenceCount: 1,
    generalSetup: true,
  };
}

export function buildFreeTrainingExercise(report = {}, priority = null) {
  const opportunities = list(report.openingTrainingOpportunities || report.opening_training_opportunities)
    .map((opportunity) => ({ opportunity, drill: buildOpeningOpportunityDrill(opportunity, report) }))
    .filter((entry) => entry.drill.valid)
    .sort((left, right) => scoreOpportunity(right.opportunity, priority) - scoreOpportunity(left.opportunity, priority));
  const evidenceIds = new Set(list(priority?.evidenceGameIds).map(text));
  const matchesContext = (opportunity) => (
    (!priority?.openingName && !priority?.openingKey || opportunityOpening(opportunity) === normaliseOpeningKey(priority.openingKey || priority.openingName))
    && (!priority?.playerColour || text(opportunity.side).toLowerCase() === priority.playerColour)
  );
  const matched = opportunities.find(({ opportunity }) => evidenceIds.has(opportunityGameId(opportunity)) && matchesContext(opportunity))
    || opportunities.find(({ opportunity }) => matchesContext(opportunity));

  if (matched) {
    return {
      kind: "own_game",
      opportunity: matched.opportunity,
      drill: matched.drill,
      attribution: matched.drill.sourceGame?.url ? "Own-game position from this report" : "Own-game position from the analysed report evidence",
      sourceGameId: matched.drill.sourceGame?.id || opportunityGameId(matched.opportunity) || null,
    };
  }

  const opportunity = generalSetupOpportunity(priority || {});
  return {
    kind: "general_setup",
    opportunity,
    drill: buildOpeningOpportunityDrill(opportunity, report),
    attribution: "General setup exercise — not reconstructed from a user game",
    sourceGameId: null,
  };
}
