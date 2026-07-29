import { countNoun } from "./reportGameCounts.js";

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const list = (value) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const optionalInteger = (value) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
  ? null
  : Math.max(0, Math.round(Number(value)));

export const REPERTOIRE_EVIDENCE_REASON_CODES = Object.freeze([
  "no_matching_games",
  "filtered_by_time_control",
  "outside_date_window",
  "opening_unclassified",
  "split_across_openings",
  "below_evidence_threshold",
  "unsupported_or_unknown",
]);

export function evidenceFilterLabel(requirement = {}) {
  const controls = list(requirement.timeControls || requirement.time_controls);
  return controls.length ? controls.join(", ") : "the selected report time controls";
}

function funnelFor(slot, requirement) {
  const source = slot.evidenceFunnel || slot.evidence_funnel || {};
  return {
    importedCandidates: optionalInteger(source.importedCandidates ?? source.imported_candidates),
    passedReportFilters: optionalInteger(source.passedReportFilters ?? source.passed_report_filters),
    correctlyAttributed: optionalInteger(source.correctlyAttributed ?? source.correctly_attributed),
    assignedToLeadingOpening: optionalInteger(source.assignedToLeadingOpening ?? source.assigned_to_leading_opening ?? slot.games ?? slot.evidenceCount ?? requirement.currentRelevantSample),
    distinctAttributedOpenings: optionalInteger(source.distinctAttributedOpenings ?? source.distinct_attributed_openings),
    outsideDateWindow: optionalInteger(source.outsideDateWindow ?? source.outside_date_window),
    filteredByTimeControl: optionalInteger(source.filteredByTimeControl ?? source.filtered_by_time_control),
    openingUnclassified: optionalInteger(source.openingUnclassified ?? source.opening_unclassified),
  };
}

function reasonCodeFor(slot, funnel, threshold) {
  const explicit = text(slot.evidenceReasonCode || slot.evidence_reason_code);
  if (REPERTOIRE_EVIDENCE_REASON_CODES.includes(explicit)) return explicit;
  const leading = funnel.assignedToLeadingOpening;
  if (funnel.importedCandidates === 0) return "no_matching_games";
  if (funnel.importedCandidates > 0 && funnel.passedReportFilters === 0) {
    if (funnel.outsideDateWindow > 0 && !funnel.filteredByTimeControl) return "outside_date_window";
    if (funnel.filteredByTimeControl > 0) return "filtered_by_time_control";
  }
  if (funnel.openingUnclassified > 0 && !funnel.correctlyAttributed) return "opening_unclassified";
  if (funnel.distinctAttributedOpenings > 1 && funnel.correctlyAttributed > leading) return "split_across_openings";
  if (leading !== null && leading > 0 && leading < threshold) return "below_evidence_threshold";
  return "unsupported_or_unknown";
}

function rolePhrase(slot, requirement) {
  const firstMove = text(requirement.opponentFirstMove || requirement.opponent_first_move || (slot.key === "black_e4" ? "1.e4" : slot.key === "black_d4" ? "1.d4" : ""));
  const colour = text(requirement.requiredColour || requirement.required_colour || (slot.key?.startsWith("black") ? "black" : slot.key === "white" ? "white" : "")).toLowerCase();
  if (colour === "black" && firstMove) return `Black-versus-${firstMove}`;
  if (colour === "white") return "White";
  return text(slot.label || "this role");
}

function explanationFor(code, { funnel, role, leading, opening, threshold, additional }) {
  if (code === "no_matching_games") return `No ${role} game was found in this report window.`;
  if (code === "outside_date_window") return `${countNoun(funnel.importedCandidates, `${role} game`)} ${funnel.importedCandidates === 1 ? "was" : "were"} found, but none fell inside the selected report window.`;
  if (code === "filtered_by_time_control") return `${countNoun(funnel.importedCandidates, `${role} game`)} ${funnel.importedCandidates === 1 ? "was" : "were"} found, but ${funnel.passedReportFilters === 0 ? "none" : `only ${funnel.passedReportFilters}`} matched the selected time-control filters.`;
  if (code === "opening_unclassified") return `${countNoun(funnel.openingUnclassified, "game")} could not be assigned confidently to an opening for this role.`;
  if (code === "split_across_openings") return `${countNoun(funnel.correctlyAttributed, "qualifying game")} ${funnel.correctlyAttributed === 1 ? "was" : "were"} split across ${countNoun(funnel.distinctAttributedOpenings, "opening")}; the leading opening${opening ? `, ${opening},` : ""} has ${leading ?? 0}, so ${countNoun(additional, "more game")} ${additional === 1 ? "is" : "are"} needed.`;
  if (code === "below_evidence_threshold") return `${opening || "The leading opening"} has ${leading} of the ${threshold} correctly attributed games required to establish this role. ${countNoun(additional, "more game")} ${additional === 1 ? "is" : "are"} needed.`;
  return "OpeningFit does not yet have enough correctly attributed games for this role.";
}

function funnelRows(funnel) {
  return [
    ["Imported candidates for this role", funnel.importedCandidates],
    ["Passed report filters", funnel.passedReportFilters],
    ["Correctly attributed", funnel.correctlyAttributed],
    ["Assigned to the leading opening", funnel.assignedToLeadingOpening],
  ].filter(([, value]) => value !== null).map(([label, value]) => ({ label, value }));
}

export function repertoireRoleEvidenceCopy(slot = {}) {
  const requirement = slot.evidenceRequirement || slot.evidence_requirement || {};
  const threshold = optionalInteger(requirement.threshold) || 5;
  const funnel = funnelFor(slot, requirement);
  const leading = funnel.assignedToLeadingOpening;
  const additional = optionalInteger(requirement.additionalRelevantGamesRequired ?? requirement.additional_relevant_games_required ?? (leading === null ? null : Math.max(0, threshold - leading))) ?? threshold;
  const opening = text(slot.opening || slot.openingName);
  const filters = evidenceFilterLabel(requirement);

  if (slot.status === "supported" || slot.complete) {
    return {
      statusLabel: "Established",
      reasonCode: null,
      explanation: `${countNoun(leading ?? 0, "correctly attributed game")} supports ${opening || "the leading opening"} in this role.`,
      evidence: `${countNoun(leading ?? 0, "relevant game")} supports this role.`,
      requirement: `Current evidence threshold met (${leading ?? 0}/${threshold}).`,
      filters: `Counting ${filters} games that passed the report filters.`,
      funnel,
      funnelRows: funnelRows(funnel),
    };
  }

  const reasonCode = reasonCodeFor(slot, funnel, threshold);
  const explanation = explanationFor(reasonCode, { funnel, role: rolePhrase(slot, requirement), leading, opening, threshold, additional });
  const role = rolePhrase(slot, requirement);
  return {
    statusLabel: slot.status === "tentative" || slot.tentative ? "Building" : "Not established yet",
    reasonCode,
    explanation,
    evidence: explanation,
    requirement: additional > 0 ? `For ${filters}, ${countNoun(additional, "more correctly attributed game")} ${additional === 1 ? "is" : "are"} required in the ${role} role for the leading opening to reach the ${threshold}-game threshold.` : `The ${threshold}-game threshold is met, but another evidence check is incomplete.`,
    filters: `Only games that pass the report filters and contribute to this exact role count toward establishment.`,
    funnel,
    funnelRows: funnelRows(funnel),
  };
}
