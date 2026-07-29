import { countNoun } from "./reportGameCounts.js";
import { formatOpeningNameForDisplay } from "./openingNamePresentation.js";

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
  const slotLeading = slot.evidenceCount ?? slot.evidence_count ?? requirement.currentRelevantSample ?? requirement.current_relevant_sample
    ?? ((slot.opening || slot.openingName || slot.status === "tentative") ? slot.games : null);
  return {
    importedCandidates: optionalInteger(source.importedCandidates ?? source.imported_candidates),
    passedReportFilters: optionalInteger(source.passedReportFilters ?? source.passed_report_filters),
    correctlyAttributed: optionalInteger(source.correctlyAttributed ?? source.correctly_attributed),
    assignedToLeadingOpening: optionalInteger(source.assignedToLeadingOpening ?? source.assigned_to_leading_opening ?? slotLeading),
    distinctAttributedOpenings: optionalInteger(source.distinctAttributedOpenings ?? source.distinct_attributed_openings),
    outsideDateWindow: optionalInteger(source.outsideDateWindow ?? source.outside_date_window),
    filteredByTimeControl: optionalInteger(source.filteredByTimeControl ?? source.filtered_by_time_control),
    openingUnclassified: optionalInteger(source.openingUnclassified ?? source.opening_unclassified),
    openingBreakdown: Array.isArray(source.openingBreakdown || source.opening_breakdown)
      ? (source.openingBreakdown || source.opening_breakdown).map((item) => ({
        opening: formatOpeningNameForDisplay(item?.openingName ?? item?.opening_name ?? item?.opening),
        games: optionalInteger(item?.games ?? item?.count),
      })).filter((item) => item.opening && item.games !== null && item.games > 0).sort((left, right) => right.games - left.games || left.opening.localeCompare(right.opening))
      : [],
  };
}

function reasonCodeFor(slot, funnel, threshold, valid) {
  if (!valid) return "unsupported_or_unknown";
  const explicit = text(slot.evidenceReasonCode || slot.evidence_reason_code);
  const explicitIsSupported = {
    no_matching_games: funnel.importedCandidates === 0,
    filtered_by_time_control: funnel.importedCandidates > 0 && funnel.passedReportFilters !== null,
    outside_date_window: funnel.importedCandidates > 0 && funnel.passedReportFilters !== null,
    opening_unclassified: (funnel.passedReportFilters ?? funnel.openingUnclassified) > 0,
    split_across_openings: funnel.correctlyAttributed > 0 && funnel.distinctAttributedOpenings > 1 && funnel.assignedToLeadingOpening > 0 && funnel.assignedToLeadingOpening < threshold,
    below_evidence_threshold: funnel.assignedToLeadingOpening > 0 && funnel.assignedToLeadingOpening < threshold,
    unsupported_or_unknown: true,
  };
  if (REPERTOIRE_EVIDENCE_REASON_CODES.includes(explicit) && explicitIsSupported[explicit]) return explicit;
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
  if (colour === "black" && firstMove) return `Black-against-${firstMove}`;
  if (colour === "white") return "White";
  return text(slot.label || "this role");
}

function explanationFor(code, { funnel, role, leading, opening, additional }) {
  if (code === "no_matching_games") return `No qualifying ${role} games were found in this report window.`;
  if (code === "outside_date_window" || code === "filtered_by_time_control") return `${countNoun(funnel.importedCandidates, `${role} game`)} ${funnel.importedCandidates === 1 ? "was" : "were"} found, but only ${funnel.passedReportFilters ?? 0} matched the selected date and time-control filters.`;
  if (code === "opening_unclassified") {
    const qualifying = funnel.passedReportFilters ?? funnel.openingUnclassified;
    return `${countNoun(qualifying, "qualifying game")} ${qualifying === 1 ? "was" : "were"} found, but OpeningFit could not confidently attribute enough ${qualifying === 1 ? "of it" : "of them"} to a specific opening.`;
  }
  if (code === "split_across_openings") return `${countNoun(funnel.correctlyAttributed, "qualifying game")} ${funnel.correctlyAttributed === 1 ? "was" : "were"} distributed across ${countNoun(funnel.distinctAttributedOpenings, "opening")}. ${opening} currently has ${countNoun(leading, "relevant game")}; ${countNoun(additional, "more game")} ${additional === 1 ? "is" : "are"} needed to establish this role.`;
  if (code === "below_evidence_threshold") return `${opening || "The leading opening"} currently has ${countNoun(leading, "relevant game")}; ${countNoun(additional, "more game")} ${additional === 1 ? "is" : "are"} needed to establish this role.`;
  return "OpeningFit does not yet have enough correctly attributed evidence to establish this role.";
}

function funnelRows(funnel) {
  return [
    ["Imported candidates for this role", funnel.importedCandidates],
    ["Passed report filters", funnel.passedReportFilters],
    ["Correctly attributed", funnel.correctlyAttributed],
    ["Assigned to the leading opening", funnel.assignedToLeadingOpening],
  ].filter(([, value]) => value !== null).map(([label, value]) => ({ label, value }));
}

export function normaliseRepertoireRoleEvidence(slot = {}) {
  const requirement = slot.evidenceRequirement || slot.evidence_requirement || {};
  const threshold = optionalInteger(requirement.threshold) || 5;
  const funnel = funnelFor(slot, requirement);
  const breakdownTotal = funnel.openingBreakdown.reduce((sum, item) => sum + item.games, 0);
  const breakdownLeading = funnel.openingBreakdown[0] || null;
  if (breakdownLeading && funnel.correctlyAttributed === null) funnel.correctlyAttributed = breakdownTotal;
  if (breakdownLeading && funnel.distinctAttributedOpenings === null) funnel.distinctAttributedOpenings = funnel.openingBreakdown.length;
  const leading = funnel.assignedToLeadingOpening ?? breakdownLeading?.games ?? null;
  const storedOpening = formatOpeningNameForDisplay(slot.opening || slot.openingName || slot.opening_name);
  const opening = breakdownLeading?.opening || storedOpening;
  const diagnostics = [];
  if (funnel.correctlyAttributed !== null && leading !== null && leading > funnel.correctlyAttributed) diagnostics.push("leading_exceeds_attributed");
  if (funnel.correctlyAttributed !== null && funnel.distinctAttributedOpenings !== null && funnel.distinctAttributedOpenings > funnel.correctlyAttributed) diagnostics.push("opening_count_exceeds_attributed_games");
  if (funnel.correctlyAttributed > 0 && funnel.distinctAttributedOpenings > 0 && !(leading > 0)) diagnostics.push("attributed_openings_missing_leading_count");
  if (funnel.passedReportFilters !== null && funnel.correctlyAttributed !== null && funnel.correctlyAttributed > funnel.passedReportFilters) diagnostics.push("attributed_exceeds_filtered");
  if (funnel.importedCandidates !== null && funnel.passedReportFilters !== null && funnel.passedReportFilters > funnel.importedCandidates) diagnostics.push("filtered_exceeds_candidates");
  if (funnel.importedCandidates !== null && breakdownTotal > funnel.importedCandidates) diagnostics.push("breakdown_exceeds_candidates");
  if (funnel.correctlyAttributed !== null && breakdownTotal > funnel.correctlyAttributed) diagnostics.push("breakdown_exceeds_attributed");
  if (breakdownLeading && leading !== null && breakdownLeading.games !== leading) diagnostics.push("leading_count_disagrees_with_breakdown");
  if (breakdownLeading && storedOpening && breakdownLeading.opening.toLowerCase() !== storedOpening.toLowerCase()) diagnostics.push("leading_opening_disagrees_with_breakdown");
  const declaredEstablished = slot.status === "supported" || slot.complete === true;
  if (!declaredEstablished && leading !== null && leading >= threshold) diagnostics.push("unestablished_role_meets_threshold");
  if (declaredEstablished && leading !== null && leading < threshold) diagnostics.push("established_role_below_threshold");
  const suppliedAdditional = optionalInteger(requirement.additionalRelevantGamesRequired ?? requirement.additional_relevant_games_required);
  const gamesNeeded = declaredEstablished ? 0 : leading === null ? null : Math.max(0, threshold - leading);
  if (suppliedAdditional !== null && gamesNeeded !== null && suppliedAdditional !== gamesNeeded) diagnostics.push("remaining_requirement_disagrees_with_threshold");
  return {
    threshold, funnel: { ...funnel, assignedToLeadingOpening: leading }, leading, opening,
    gamesNeeded, established: declaredEstablished, valid: diagnostics.length === 0, diagnostics,
  };
}

export function repertoireRoleEvidenceCopy(slot = {}) {
  const requirement = slot.evidenceRequirement || slot.evidence_requirement || {};
  const normalized = normaliseRepertoireRoleEvidence(slot);
  const { threshold, funnel, leading, opening, gamesNeeded: additional, established, valid, diagnostics } = normalized;
  const filters = evidenceFilterLabel(requirement);

  if (established) {
    const explanation = valid && leading !== null
      ? `${countNoun(leading, "correctly attributed game")} supports ${opening || "the leading opening"} in this role.`
      : `This saved report marks ${opening || "this role"} as established, but detailed attributed counts are unavailable.`;
    return {
      established: true,
      statusLabel: "Established",
      reasonCode: null,
      explanation,
      evidence: explanation,
      requirement: valid && leading !== null ? `Current evidence threshold met (${leading}/${threshold}).` : "No remaining-game requirement is shown for this established role.",
      filters: `Counting ${filters} games that passed the report filters.`,
      funnel,
      funnelRows: valid ? funnelRows(funnel) : [],
      diagnostics,
    };
  }

  const reasonCode = reasonCodeFor(slot, funnel, threshold, valid);
  const explanation = explanationFor(reasonCode, { funnel, role: rolePhrase(slot, requirement), leading, opening, additional });
  const role = rolePhrase(slot, requirement);
  return {
    established: false,
    statusLabel: slot.status === "tentative" || slot.tentative ? "Building" : "Not established yet",
    reasonCode,
    explanation,
    evidence: explanation,
    requirement: additional > 0 ? `For ${filters}, ${countNoun(additional, "more correctly attributed game")} ${additional === 1 ? "is" : "are"} required in the ${role} role for the leading opening to reach the ${threshold}-game threshold.` : "OpeningFit cannot calculate a precise remaining-game requirement from this saved evidence.",
    filters: `Only games that pass the report filters and contribute to this exact role count toward establishment.`,
    funnel,
    funnelRows: valid ? funnelRows(funnel) : [],
    diagnostics,
  };
}
