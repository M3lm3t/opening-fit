import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";
import { compareReportSnapshots } from "./reportComparison.js";
import { selectPreviousReportSnapshot } from "./reportComparisonPresentation.js";
import { adaptReportHistoryRow, buildReportSnapshot } from "./reportSnapshot.js";

export const REPERTOIRE_WORKSPACE_SECTIONS = Object.freeze([
  { key: "white", title: "White", slots: ["white_primary"] },
  { key: "black-e4", title: "Black against 1.e4", slots: ["black_vs_e4"] },
  { key: "black-d4", title: "Black against 1.d4", slots: ["black_vs_d4"] },
  { key: "optional", title: "Optional secondary choices", slots: ["white_secondary", "black_other"] },
]);

const evidence = "Not enough evidence yet";
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const openingKey = (entry = {}) => {
  const name = entry.canonical_name || entry.display_name || entry.name || "";
  return entry.canonical_opening_id || findOpeningLine(name)?.id || normaliseOpeningKey(name);
};

export function repertoireProgressMap(report, reportHistory = []) {
  if (!report) return new Map();
  try {
    const current = buildReportSnapshot({ report });
    const history = (Array.isArray(reportHistory) ? reportHistory : []).map((row) => adaptReportHistoryRow(row));
    const previous = selectPreviousReportSnapshot(current, history);
    if (!previous) return new Map();
    const comparison = compareReportSnapshots(previous, current);
    return new Map(comparison.openingChanges.map((change) => {
      const key = findOpeningLine(change.opening)?.id || normaliseOpeningKey(change.opening);
      const label = change.status === "improved"
        ? "Improved since the previous report"
        : change.status === "declined"
          ? "Declined since the previous report"
          : change.status === "stable"
            ? "Unchanged since the previous report"
            : evidence;
      return [key, { status: change.status, label }];
    }));
  } catch {
    return new Map();
  }
}

export function legacyWorkspaceEntries(workspace = {}) {
  const slotFor = (item) => item.section === "white"
    ? (["Backup", "Alternative"].includes(item.role) ? "white_secondary" : "white_primary")
    : item.section === "blackE4" ? "black_vs_e4"
      : item.section === "blackD4" ? "black_vs_d4"
        : item.section === "other" ? "black_other" : null;
  return (Array.isArray(workspace.items) ? workspace.items : []).flatMap((item) => {
    const slot = slotFor(item);
    if (!slot || ["Paused", "Avoided"].includes(item.status)) return [];
    return [{
      id: item.id,
      slot,
      display_name: item.name,
      canonical_name: item.name,
      source: item.source === "manual" ? "user_selected" : "imported",
      status: "active",
      confidence: item.confidence || item.opening?.confidence?.label || item.opening?.confidence,
      sample_size: item.games ?? item.opening?.games,
      recent_score: item.fit ?? item.opening?.score,
      key_strength: item.opening?.keyStrength || item.opening?.strength,
      key_weakness: item.opening?.keyWeakness || item.opening?.weakness || item.opening?.weakestLine,
      current_training_focus: item.opening?.trainingFocus,
      last_reviewed_at: workspace.updatedAt,
      legacy: true,
    }];
  });
}

function card(entry, progress) {
  const sample = finite(entry.sample_size) ? Math.max(0, Math.round(Number(entry.sample_size))) : null;
  const score = finite(entry.recent_score) ? Math.round(Number(entry.recent_score)) : null;
  return {
    ...entry,
    openingName: entry.display_name || entry.canonical_name || "Unnamed opening",
    confidenceLabel: entry.confidence || evidence,
    gamesLabel: sample === null ? evidence : `${sample} game${sample === 1 ? "" : "s"}`,
    scoreLabel: score === null ? evidence : `${score}%`,
    strengthLabel: entry.key_strength || evidence,
    weaknessLabel: entry.key_weakness || evidence,
    trainingLabel: entry.current_training_focus || evidence,
    reviewedLabel: entry.last_reviewed_at ? new Date(entry.last_reviewed_at).toLocaleDateString() : evidence,
    progress: progress.get(openingKey(entry)) || { status: "insufficient evidence", label: evidence },
    lowSample: sample === null || sample < 5,
  };
}

export function buildRepertoireWorkspaceView({ report = null, entries = [], legacyEntries = [], reportHistory = [], loading = false, error = "" } = {}) {
  if (loading) return { state: "loading", sections: [], suggestions: [], notice: "Loading your saved repertoire…" };
  const activeRows = entries.filter((entry) => entry.status === "active");
  const usingLegacy = !activeRows.length && legacyEntries.length > 0;
  const active = usingLegacy ? legacyEntries : activeRows;
  if (!report && !active.length) return { state: "no-report", sections: [], suggestions: [], notice: "Analyse your games to create the report that powers your repertoire." };
  if (report && !active.length) return { state: "not-built", sections: [], suggestions: [], notice: "Your report is ready, but no repertoire has been saved yet." };

  const progress = repertoireProgressMap(report, reportHistory);
  const sections = REPERTOIRE_WORKSPACE_SECTIONS.map((section) => ({
    ...section,
    cards: active.filter((entry) => section.slots.includes(entry.slot)).map((entry) => card(entry, progress)),
  }));
  const suggestions = entries.filter((entry) => entry.status === "considering" && entry.source === "recommended").map((entry) => {
    const current = active.find((item) => item.slot === entry.slot);
    return {
      ...card(entry, progress),
      currentOpening: current?.display_name || current?.canonical_name || evidence,
      reason: entry.recommendation_reason || entry.key_weakness || evidence,
      expectedBenefit: entry.expected_benefit || entry.key_strength || evidence,
      evidenceLabel: finite(entry.sample_size)
        ? `${Math.round(Number(entry.sample_size))} supporting game${Number(entry.sample_size) === 1 ? "" : "s"}${finite(entry.recent_score) ? ` · ${Math.round(Number(entry.recent_score))}% recent score` : ""}`
        : evidence,
    };
  });
  const hasWhite = sections[0].cards.length > 0;
  const hasBlack = sections[1].cards.length > 0 || sections[2].cards.length > 0;
  return {
    state: "ready",
    sections,
    suggestions,
    usingLegacy,
    lowSample: active.every((entry) => !finite(entry.sample_size) || Number(entry.sample_size) < 5),
    coverage: !hasWhite && hasBlack ? "only-black" : hasWhite && !hasBlack ? "only-white" : "mixed",
    notice: error || (!report ? "Your saved repertoire is available. Analyse again to refresh its evidence." : ""),
  };
}
