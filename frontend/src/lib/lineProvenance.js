const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const integer = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;

export function describeLineProvenance({ line, findingType = "", sampleSize = 0, sourceGameIds = [], illustrative = false } = {}) {
  if (!text(line)) return null;
  const games = Math.max(integer(sampleSize), Array.isArray(sourceGameIds) ? sourceGameIds.filter(Boolean).length : 0);
  const finding = text(findingType).toLowerCase();
  if (illustrative) return { key: "illustrative", label: "General illustrative line", note: "This line illustrates a general setup and is not claimed as evidence from your games." };
  if (["opponent_response_problem", "preparation_opportunity"].includes(finding)) {
    return { key: "opponent_response", label: "Opponent-response practice", note: games ? `Observed across ${games} game${games === 1 ? "" : "s"}.` : "Use this to prepare for an opponent continuation, not as a repertoire replacement." };
  }
  if (games > 0) {
    return {
      key: "observed",
      label: "Observed line from your games",
      note: games <= 2
        ? `Seen in ${games} game${games === 1 ? "" : "s"}—use as review evidence, not a repertoire recommendation.`
        : `Observed in ${games} supporting games.`,
    };
  }
  return { key: "recommended_setup", label: "Recommended setup", note: "This is a general practice setup; no source-game claim is made." };
}
