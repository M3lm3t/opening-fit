import { buildRepertoireMap, getRepertoireGames, getRepertoireOpeningName, getRepertoireScore, getRepertoireStatus } from "../services/repertoireStatus.js";

export const REPERTOIRE_STORAGE_KEY = "openingFit:repertoireWorkspace:v1";
export const REPERTOIRE_PENDING_KEY = "openingFit:repertoirePendingAction:v1";
export const REPERTOIRE_STATUSES = ["Current", "Keep", "Repair", "Considering", "Learning", "Paused", "Avoided", "Insufficient evidence"];

const keyFor = (section, name) => `${section}:${String(name || "").trim().toLowerCase().replace(/\s+/g, "-")}`;

function statusFor(opening, sectionCount) {
  const signal = getRepertoireStatus(opening, { sectionCount });
  if (signal.status === "Too little data") return "Insufficient evidence";
  if (["Weak", "Developing"].includes(signal.status)) return "Repair";
  if (["Strong", "Stable"].includes(signal.status)) return "Keep";
  return "Considering";
}

export function buildSuggestedWorkspace(report = {}) {
  const map = buildRepertoireMap(report);
  const groups = [
    ["white", "White", map.sections.white], ["blackE4", "Black versus 1.e4", map.sections.blackE4],
    ["blackD4", "Black versus 1.d4", map.sections.blackD4], ["other", "Other", map.sections.other || []],
  ];
  const items = groups.flatMap(([section, sectionLabel, rows]) => rows.map((opening, index) => ({
    id: keyFor(section, getRepertoireOpeningName(opening)), section, sectionLabel,
    name: getRepertoireOpeningName(opening), role: index === 0 ? "Main" : index === 1 ? "Backup" : "Branch",
    status: statusFor(opening, rows.length), locked: false, notes: "", source: "analysis",
    games: getRepertoireGames(opening), fit: getRepertoireScore(opening), opening,
  })));
  return { version: 1, items, dismissed: [], updatedAt: new Date().toISOString() };
}

export function reconcileWorkspace(suggested, saved = {}) {
  const savedItems = Array.isArray(saved.items) ? saved.items : [];
  const savedById = new Map(savedItems.map((item) => [item.id, item]));
  const merged = suggested.items.map((item) => {
    const prior = savedById.get(item.id);
    if (!prior) return item;
    return { ...item, ...prior, games: item.games, fit: item.fit, opening: item.opening, source: prior.source || item.source };
  });
  savedItems.filter((item) => !merged.some((next) => next.id === item.id) && (item.locked || item.source === "manual")).forEach((item) => merged.push(item));
  return { ...suggested, ...saved, items: merged, dismissed: [...new Set(saved.dismissed || [])], updatedAt: new Date().toISOString() };
}

export function applyRepertoireAction(workspace, action) {
  const previous = JSON.parse(JSON.stringify(workspace));
  let items = [...workspace.items];
  if (action.type === "add") {
    const id = action.item.id || keyFor(action.item.section, action.item.name);
    items = items.some((item) => item.id === id) ? items.map((item) => item.id === id ? { ...item, ...action.item, id } : item) : [...items, { status: "Considering", role: "Alternative", locked: false, notes: "", source: "manual", ...action.item, id }];
  } else if (action.type === "replace") {
    items = items.map((item) => item.section === action.item.section && item.role === "Main" && !item.locked ? { ...item, role: "Alternative", status: "Paused" } : item);
    return { ...applyRepertoireAction({ ...workspace, items }, { type: "add", item: { ...action.item, role: "Main", status: "Current", source: "manual" } }), undo: previous };
  } else if (action.type === "update") items = items.map((item) => item.id === action.id ? { ...item, ...action.changes, source: "manual" } : item);
  else if (action.type === "delete") items = items.filter((item) => item.id !== action.id);
  else if (action.type === "reset_section") items = items.filter((item) => item.section !== action.section || item.locked);
  return { ...workspace, items, dismissed: action.type === "dismiss" ? [...new Set([...(workspace.dismissed || []), action.id])] : workspace.dismissed, updatedAt: new Date().toISOString(), undo: previous };
}

export function workspaceSummary(workspace) {
  const active = workspace.items.filter((item) => !["Paused", "Avoided"].includes(item.status));
  const covered = new Set(active.map((item) => item.section));
  const core = ["white", "blackE4", "blackD4"];
  return {
    coverage: `${core.filter((key) => covered.has(key)).length} of ${core.length} core areas covered`,
    active: active.length, learning: active.filter((item) => item.status === "Learning").length,
    repair: active.filter((item) => item.status === "Repair").length,
    nextAction: active.find((item) => item.status === "Repair") ? `Repair ${active.find((item) => item.status === "Repair").name}` : core.find((key) => !covered.has(key)) ? "Choose an opening for the next uncovered area" : "Keep the core stable and train one recurring line",
  };
}

export function workspaceWarnings(workspace) {
  const warnings = [];
  ["white", "blackE4", "blackD4"].forEach((section) => {
    const rows = workspace.items.filter((item) => item.section === section && !["Paused", "Avoided"].includes(item.status));
    if (!rows.length) warnings.push(`No dependable answer is selected for ${section === "white" ? "White" : section === "blackE4" ? "Black versus 1.e4" : "Black versus 1.d4"}.`);
    if (rows.filter((item) => ["Main", "Current"].includes(item.role)).length > 1) warnings.push(`Several openings serve as the main choice in ${rows[0]?.sectionLabel || section}.`);
    if (rows.length > 4) warnings.push(`${rows[0]?.sectionLabel || section} contains ${rows.length} active choices, which may increase learning burden.`);
  });
  return warnings;
}
