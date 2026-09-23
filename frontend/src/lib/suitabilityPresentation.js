export function traitPresentation(fingerprint = {}, key, invert = false) {
  const raw = fingerprint.traits?.[key];
  const suppliedStatus = fingerprint.traitInputStatus?.[key];
  const valid = raw !== null && raw !== undefined && raw !== "" && typeof raw !== "boolean" && Number.isFinite(Number(raw)) && Number(raw) >= 0 && Number(raw) <= 100;
  const sample = fingerprint.sampleSize ?? fingerprint.sample_size;
  const status = suppliedStatus || (sample !== undefined && Number(sample) < 3 ? "defaulted" : "unverified");
  if (!valid || ["defaulted", "missing", "invalid", "partial"].includes(status)) return { value: null, label: "Not enough evidence", status: valid ? status : raw == null ? "missing" : "invalid" };
  return { value: invert ? 100 - Number(raw) : Number(raw), label: status === "unverified" ? "Stored estimate; provenance unavailable" : "Heuristic estimate", status };
}

export function suitabilityReason(item = {}) {
  const games = Number(item.games ?? item.gamesPlayed ?? item.games_played ?? 0);
  if (!games) return "A catalogue suggestion to explore, not a personally proven fit. Test a small sample before changing your repertoire.";
  return item.reason || "A heuristic repertoire estimate, not a measured preference or proof of opening quality.";
}
