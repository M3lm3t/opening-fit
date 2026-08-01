const text = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function supportingIds(row) {
  const sample = row?.sample && typeof row.sample === "object" ? row.sample : {};
  return [...new Set([
    ...list(row?.supportingGameIds), ...list(row?.supporting_game_ids),
    ...list(row?.gameIds), ...list(row?.game_ids),
    ...list(sample.gameIds), ...list(sample.game_ids),
  ].map(text).filter(Boolean))];
}

function variationNames(row) {
  return [...new Set([
    ...list(row?.variationLabels), row?.variation, row?.openingVariation, row?.opening_variation,
  ].map(text).filter(Boolean))];
}

export function mergeOpeningContextRows(items, {
  getName = (row) => text(row?.openingName || row?.opening || row?.name),
  getContext = (row) => text(row?.context || row?.repertoireRole || row?.repertoire_role || "unknown"),
  getGames = (row) => number(row?.sampleSize ?? row?.sample?.games ?? row?.games),
  normaliseName = (name) => text(name).toLowerCase(),
  isUnknown = (name) => !text(name) || /^unknown\b/i.test(text(name)),
} = {}) {
  const rows = new Map();
  for (const item of list(items)) {
    const name = getName(item);
    if (isUnknown(name)) continue;
    const context = getContext(item);
    const relationship = text(item?.relationship || item?.openingRelationship || item?.opening_relationship);
    const role = text(item?.playerRole || item?.player_role || item?.repertoireRole || item?.repertoire_role);
    const colour = text(item?.playerColour || item?.player_color || item?.playerColor || item?.colour || item?.color);
    const key = [normaliseName(name), context, relationship, role, colour].join("::");
    const existing = rows.get(key);
    if (!existing) {
      rows.set(key, { ...item, supportingGameIds: supportingIds(item), variationLabels: variationNames(item) });
      continue;
    }
    const mergedIds = [...new Set([...supportingIds(existing), ...supportingIds(item)])];
    const richer = getGames(item) > getGames(existing) ? item : existing;
    const mergedGames = mergedIds.length || Math.max(getGames(existing), getGames(item));
    rows.set(key, {
      ...existing, ...richer, games: mergedGames, sampleSize: mergedGames,
      sample: richer?.sample && typeof richer.sample === "object"
        ? { ...richer.sample, games: mergedGames, gameIds: mergedIds }
        : richer?.sample,
      supportingGameIds: mergedIds,
      variationLabels: [...new Set([...variationNames(existing), ...variationNames(item)])],
    });
  }
  return [...rows.values()];
}

export function evidenceGapCategory(opening, {
  games = number(opening?.sampleSize ?? opening?.sample?.games ?? opening?.games),
  contextType = text(opening?.contextType || opening?.context_type),
  context = text(opening?.context || opening?.repertoireRole || opening?.repertoire_role),
  evidenceStatus = text(opening?.evidenceStatus || opening?.evidence_status).toLowerCase(),
  reasonCode = text(opening?.evidenceReasonCode || opening?.evidence_reason_code).toLowerCase(),
} = {}) {
  const issue = text(opening?.classificationIssue || opening?.classification_issue || reasonCode).toLowerCase();
  if (/missing.*(pgn|move)|opening_unclassified/.test(issue)) return "Missing move data";
  if (/transpos|mixed/.test(issue) || contextType === "mixed" || context === "unknown_mixed") return "Mixed/transpositional classification";
  if (/attribution|context/.test(issue) || evidenceStatus === "context_uncertain") return "Context uncertain";
  if (games <= 2 || (evidenceStatus === "insufficient" && games < 5)) return "Small sample";
  if (evidenceStatus === "insufficient") return "Context uncertain";
  if (games >= 5) return "Sufficient evidence but mixed performance";
  return "Small sample";
}

export function shouldShowEvidenceGap(opening, options = {}) {
  const relationship = text(options.relationship || opening?.relationship || opening?.openingRelationship || opening?.opening_relationship).toLowerCase();
  const games = number(options.games ?? opening?.sampleSize ?? opening?.sample?.games ?? opening?.games);
  const category = evidenceGapCategory(opening, { ...options, games });
  if (relationship.includes("faced") && category === "Sufficient evidence but mixed performance") return false;
  return games >= 1 && (games < 5 || category !== "Sufficient evidence but mixed performance" || options.mixedPerformance === true);
}
