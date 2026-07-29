import { countNoun } from "./reportGameCounts.js";

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const list = (value) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const integer = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;

export function evidenceFilterLabel(requirement = {}) {
  const controls = list(requirement.timeControls || requirement.time_controls);
  return controls.length ? controls.join(", ") : "the selected report time controls";
}

export function repertoireRoleEvidenceCopy(slot = {}) {
  const requirement = slot.evidenceRequirement || slot.evidence_requirement || {};
  const games = integer(slot.games ?? slot.evidenceCount ?? requirement.currentRelevantSample);
  const threshold = integer(requirement.threshold) || 5;
  const additional = integer(requirement.additionalRelevantGamesRequired ?? requirement.additional_relevant_games_required ?? Math.max(0, threshold - games));
  const firstMove = text(requirement.opponentFirstMove || requirement.opponent_first_move || (slot.key === "black_e4" ? "1.e4" : slot.key === "black_d4" ? "1.d4" : ""));
  const colour = text(requirement.requiredColour || requirement.required_colour || (slot.key?.startsWith("black") ? "black" : slot.key === "white" ? "white" : "")).toLowerCase();
  const opening = text(slot.opening || slot.openingName);
  const filters = evidenceFilterLabel(requirement);

  if (slot.status === "supported" || slot.complete) {
    return {
      statusLabel: "Supported",
      evidence: `${countNoun(games, "relevant game")} supports this role.`,
      requirement: `Current evidence threshold met (${games}/${threshold}).`,
      filters: `Counting ${filters} games that passed the report filters.`,
    };
  }

  const rolePhrase = colour === "black" && firstMove
    ? `as Black against ${firstMove}`
    : colour === "white" ? "as White" : `in ${text(slot.label || "this role")}`;
  const family = opening ? ` in the same ${opening} role` : "";
  const filteredGames = filters === "the selected report time controls" ? "games from the selected report time controls" : `${filters} games`;
  const requirementCopy = additional === 0
    ? `The ${threshold}-game threshold is met, but the evidence has not passed every confidence check yet.`
    : `Your next ${filteredGames} ${rolePhrase}${family} will add evidence. ${countNoun(additional, "more relevant example")} ${additional === 1 ? "is" : "are"} currently needed.`;
  return {
    statusLabel: slot.status === "tentative" || slot.tentative ? "Tentative" : "Not established yet",
    evidence: games ? `${countNoun(games, "relevant game")} ${games === 1 ? "is" : "are"} currently recorded for this exact role.` : "No qualifying game is currently recorded for this exact role.",
    requirement: requirementCopy,
    filters: `Only games that pass the report filters and contribute to this role reduce the requirement; arbitrary games do not guarantee a diagnosis.`,
  };
}
