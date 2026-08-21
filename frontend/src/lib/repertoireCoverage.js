const CORE_ROLES = Object.freeze([
  { key: "white", label: "White" },
  { key: "black_e4", label: "Black against 1.e4" },
  { key: "black_d4", label: "Black against 1.d4" },
]);

export const REPERTOIRE_COVERAGE_STATES = Object.freeze({
  ESTABLISHED: "ESTABLISHED",
  NEEDS_REPAIR: "NEEDS_REPAIR",
  COVERAGE_GAP: "COVERAGE_GAP",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
});

const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

function stateFor(role = {}) {
  const games = finite(role.supportingGames ?? role.relevantGames ?? role.games) ? Number(role.supportingGames ?? role.relevantGames ?? role.games) : null;
  if (role.dataQuality === "inconsistent_evidence" || role.status === "unresolved") return REPERTOIRE_COVERAGE_STATES.LOW_CONFIDENCE;
  if (role.status === "established" || role.complete === true) return role.verdict === "repair" ? REPERTOIRE_COVERAGE_STATES.NEEDS_REPAIR : REPERTOIRE_COVERAGE_STATES.ESTABLISHED;
  return games !== null && games > 0 ? REPERTOIRE_COVERAGE_STATES.LOW_CONFIDENCE : REPERTOIRE_COVERAGE_STATES.COVERAGE_GAP;
}

const labelFor = (state) => ({ ESTABLISHED: "Established", NEEDS_REPAIR: "Needs repair", COVERAGE_GAP: "Coverage gap", LOW_CONFIDENCE: "Low confidence" })[state];

export function buildRepertoireCoverage(model = {}) {
  const supplied = Array.isArray(model.repertoire) ? model.repertoire : [];
  const byKey = new Map(supplied.filter((role) => CORE_ROLES.some(({ key }) => key === role?.key)).map((role) => [role.key, role]));
  const roles = CORE_ROLES.map((spec) => {
    const source = byKey.get(spec.key) || { ...spec };
    const state = stateFor(source);
    const games = finite(source.supportingGames ?? source.relevantGames ?? source.games) ? Number(source.supportingGames ?? source.relevantGames ?? source.games) : null;
    const opening = state === REPERTOIRE_COVERAGE_STATES.COVERAGE_GAP
      ? "No established response"
      : source.displayName && source.displayName !== "Not established yet" ? source.displayName : "Limited evidence";
    const explanation = state === REPERTOIRE_COVERAGE_STATES.NEEDS_REPAIR
      ? `${opening} is established in this role, but the report identifies a repair priority.`
      : state === REPERTOIRE_COVERAGE_STATES.ESTABLISHED
        ? `${opening} has enough role-specific evidence to count as established.`
        : state === REPERTOIRE_COVERAGE_STATES.LOW_CONFIDENCE
          ? "Some relevant games exist, but the evidence is not reliable enough to establish this role yet."
          : "No opening has enough reliable, role-specific evidence here yet.";
    const wins = finite(source.wins) ? Number(source.wins) : null;
    const draws = finite(source.draws) ? Number(source.draws) : null;
    const losses = finite(source.losses) ? Number(source.losses) : null;
    const performance = [wins, draws, losses].every((value) => value !== null) ? `${wins}W · ${draws}D · ${losses}L` : source.performanceLabel || source.performance || null;
    return { ...spec, opening, state, statusLabel: labelFor(state), games, performance, confidence: source.confidence?.label || null, evidence: source.confidenceExplanation || source.evidenceReason || null, explanation, source };
  });
  const establishedCount = roles.filter(({ state }) => state === REPERTOIRE_COVERAGE_STATES.ESTABLISHED || state === REPERTOIRE_COVERAGE_STATES.NEEDS_REPAIR).length;
  const repairCount = roles.filter(({ state }) => state === REPERTOIRE_COVERAGE_STATES.NEEDS_REPAIR).length;
  const gap = roles.find(({ state }) => state === REPERTOIRE_COVERAGE_STATES.COVERAGE_GAP);
  return {
    roles,
    establishedCount,
    complete: establishedCount === CORE_ROLES.length,
    summary: establishedCount === CORE_ROLES.length ? `All 3 core repertoire roles are established${repairCount ? `; ${repairCount} needs repair` : ""}.` : `${establishedCount} of 3 core repertoire roles are established.`,
    supportingPriority: gap ? model.coachingPriority?.subjectType === "role_gap" ? `Your current training priority already addresses the ${gap.label.toLowerCase()} gap.` : `Supporting context: build a reliable response for ${gap.label.toLowerCase()}.` : null,
  };
}
