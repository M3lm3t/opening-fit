const STATUS = { assigned: "New mission", learning: "In training", awaiting_evidence: "Waiting for a real game",
  improving: "Improving", needs_review: "Review needed", repaired: "Repaired", dismissed: "Dismissed", superseded: "Superseded", candidate: "Candidate" };

export function normaliseMissionResponse(payload, previous = null) {
  const reason = payload?.reasonCode || payload?.availability;
  if (reason === "missions_disabled") return { kind: "disabled", mission: null };
  if (["schema_unavailable", "training_schema_unavailable", "temporarily_unavailable", "database_unavailable", "unavailable", "offline"].includes(reason)) return { kind: "unavailable", mission: previous?.mission || null };
  if (reason === "no_trusted_candidate") return { kind: "no_candidate", mission: null };
  if (reason === "analysis_required") return { kind: "analysis_required", mission: null };
  if (!payload?.mission) return { kind: "no_active_mission", mission: null };
  return { kind: payload.mission.status || "assigned", mission: payload.mission };
}

export const missionStatusLabel = (status) => STATUS[status] || "Current mission";
export function roleLabel(role) { return ({ white_repertoire: "White", black_vs_e4: "Black vs 1.e4", black_vs_d4: "Black vs 1.d4" })[role] || String(role || "").replaceAll("_", " "); }
export function missionStatement(mission) { const move = mission?.repeated_played_move_san || mission?.repeated_played_move_uci || "the repeated move"; return `Replace ${move} with your prepared response`; }
export function confidenceCopy(mission) { const level = String(mission?.confidence?.level || "").toLowerCase(); return level === "high" ? "Repeated across several trusted games with a verified correction." : "Repeated in your games with enough evidence to train, but still based on a limited sample."; }
export function provenanceLabel(source) { return ({ active_repertoire_line: "From your active repertoire", opening_reference_line: "From OpeningFit’s trusted opening reference", opening_pack_continuation: "From OpeningFit’s trusted opening reference", canonical_report_decision: "From your report’s verified continuation" })[source] || "From a verified OpeningFit continuation"; }
export function missionAction(status) { if (status === "assigned") return "Start mission"; if (status === "learning") return "Continue training"; if (status === "needs_review") return "Review mission"; if (status === "repaired") return "Find my next mission"; return "View evidence"; }
