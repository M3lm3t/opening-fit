const integer = (value, fallback = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
};

const firstInteger = (...values) => {
  for (const value of values) {
    const parsed = integer(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const REASON_LABELS = Object.freeze({
  bullet: "Unsupported time control (bullet)",
  unsupportedTimeControl: "Unsupported time control",
  variants: "Unsupported chess variant",
  veryShort: "Insufficient opening moves",
  tooFewLegalMoves: "Insufficient opening moves",
  abandoned: "Incomplete or abandoned game",
  earlyTimeout: "Incomplete or abandoned game",
  oneMoveResignation: "Incomplete or abandoned game",
  missingOpening: "Missing or invalid PGN/opening data",
  invalidPgn: "Missing or invalid PGN/opening data",
  outsideWindow: "Outside selected date range",
  reportFilters: "Outside the selected report filters",
  analysisLimit: "Outside the current analysis limit",
});

function reasonRows(report = {}) {
  const summary = report.gameCounts || report.game_counts || report.importSummary || report.import_summary || {};
  const source = summary.exclusionReasons || summary.exclusion_reasons || report.skippedGameReasons || report.skipped_game_reasons || [];
  if (Array.isArray(source)) {
    return source.map((row) => typeof row === "string" ? { key: row, label: REASON_LABELS[row] || row, count: null } : {
      key: row?.key || row?.reason || "other",
      label: row?.label || REASON_LABELS[row?.key] || "Other excluded games",
      count: integer(row?.count ?? row?.games),
    }).filter((row) => row.label && (row.count === null || row.count > 0));
  }
  if (source && typeof source === "object") {
    return Object.entries(source).flatMap(([key, value]) => {
      const count = integer(value, 0);
      return count ? [{ key, label: REASON_LABELS[key] || key, count }] : [];
    });
  }
  return [];
}

function mergeReasons(rows) {
  const merged = new Map();
  rows.forEach((row) => {
    const current = merged.get(row.label);
    if (!current) merged.set(row.label, { ...row });
    else if (current.count !== null && row.count !== null) current.count += row.count;
    else current.count = null;
  });
  return [...merged.values()];
}

export function buildReportGameCounts(report = {}) {
  const source = report.gameCounts || report.game_counts || report.importSummary || report.import_summary || {};
  const reasons = mergeReasons(reasonRows(report));
  const classified = firstInteger(source.classified, source.classifiedGames, source.classified_games, report.gamesClassified, report.games_classified, report.gamesEligible, report.games_eligible, report.gamesAnalysed, report.gamesAnalyzed, report.games_analyzed, report.totalGames, report.total_games, report.gamesImported, report.games_imported) ?? 0;
  const explicitExcluded = firstInteger(source.excluded, source.excludedGames, source.excluded_games, report.gamesExcluded, report.games_excluded, report.skippedGames, report.skipped_games);
  const imported = firstInteger(source.imported, source.importedGames, source.imported_games, report.gamesFound, report.games_found, explicitExcluded === null ? null : classified + explicitExcluded, report.gamesImported, report.games_imported, classified) ?? classified;
  const filterExcluded = reasons.filter((row) => ["bullet", "unsupportedTimeControl", "outsideWindow", "reportFilters"].includes(row.key)).reduce((sum, row) => sum + (row.count || 0), 0);
  const eligible = firstInteger(source.eligible, source.eligibleGames, source.eligible_games, report.gamesEligible, report.games_eligible) ?? Math.max(classified, imported - filterExcluded);
  const reconciledImported = Math.max(imported, eligible, classified + (explicitExcluded ?? 0));
  return {
    imported: reconciledImported,
    eligible: Math.min(reconciledImported, Math.max(classified, eligible)),
    classified: Math.min(reconciledImported, classified),
    excluded: Math.max(0, reconciledImported - classified),
    exclusionReasons: reasons,
  };
}

export function countNoun(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function reportCountSentence(report = {}) {
  const counts = buildReportGameCounts(report);
  return `We imported ${countNoun(counts.imported, "game")}. Your selected time-control and date filters left ${countNoun(counts.eligible, "eligible game")}. We found ${countNoun(counts.classified, "usable opening signal")}.`;
}

export const REPORT_COUNT_DEFINITIONS = Object.freeze({
  imported: "Game records received from the selected chess platform for the requested import window.",
  eligible: "Imported games left after the selected date and supported time-control filters.",
  classified: "Eligible games with enough valid move and opening information to support the report.",
  excluded: "Imported games that did not produce a usable opening signal; categories are shown when available.",
});
