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

export const EXCLUSION_REASON_LABELS = Object.freeze({
  outsideDateRange: "Outside the selected period",
  outsideWindow: "Outside the selected period",
  unsupportedTimeControl: "Did not match the selected time controls",
  bullet: "Did not match the selected time controls",
  unsupportedGameType: "Unsupported chess variant",
  variants: "Unsupported chess variant",
  incompleteGame: "Incomplete or abandoned game",
  abandoned: "Incomplete or abandoned game",
  earlyTimeout: "Incomplete or abandoned game",
  oneMoveResignation: "Incomplete or abandoned game",
  duplicate: "Duplicate game record",
  analysisLimit: "Outside the current analysis limit",
  missingOpeningSignal: "Did not contain enough opening information",
  missingOpening: "Did not contain enough opening information",
  invalidPgn: "Did not contain enough opening information",
  veryShort: "Did not contain enough opening information",
  tooFewLegalMoves: "Did not contain enough opening information",
  reportFilters: "Outside the selected report filters",
  other: "Other",
});

function reasonRows(report = {}, source = {}) {
  const raw = source.exclusionReasonItems || source.exclusion_reason_items ||
    source.exclusionReasons || source.exclusion_reasons ||
    report.skippedGameReasons || report.skipped_game_reasons || [];
  if (Array.isArray(raw)) {
    return raw.map((row) => typeof row === "string" ? { key: row, label: EXCLUSION_REASON_LABELS[row] || row, count: null } : {
      key: row?.key || row?.reason || "other",
      label: row?.label || EXCLUSION_REASON_LABELS[row?.key] || "Other",
      count: integer(row?.count ?? row?.games),
    }).filter((row) => row.label && (row.count === null || row.count > 0));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw).flatMap(([key, value]) => {
      const count = integer(value, 0);
      return count ? [{ key, label: EXCLUSION_REASON_LABELS[key] || key, count }] : [];
    });
  }
  return [];
}

function mergeReasons(rows) {
  const merged = new Map();
  rows.forEach((row) => {
    const canonicalKey = Object.keys(EXCLUSION_REASON_LABELS).find((key) => EXCLUSION_REASON_LABELS[key] === row.label) || row.key;
    const current = merged.get(row.label);
    if (!current) merged.set(row.label, { ...row, key: canonicalKey });
    else if (current.count !== null && row.count !== null) current.count += row.count;
    else current.count = null;
  });
  return [...merged.values()];
}

function reconciledReasons(rows, excluded, precise) {
  const knownTotal = rows.reduce((sum, row) => sum + (row.count || 0), 0);
  if (!precise || rows.some((row) => row.count === null)) return rows;
  if (knownTotal < excluded) return [...rows, { key: "other", label: "Other or unavailable reason", count: excluded - knownTotal }];
  return rows;
}

export function buildReportGameCounts(report = {}) {
  const source = report.gameCounts || report.game_counts || report.importSummary || report.import_summary || {};
  const isCanonical = integer(source.contractVersion ?? source.contract_version) >= 2 || firstInteger(source.fetchedGames, source.fetched_games) !== null;

  if (isCanonical) {
    const fetchedGames = firstInteger(source.fetchedGames, source.fetched_games, source.imported) ?? 0;
    const analysedGames = Math.min(fetchedGames, firstInteger(source.analysedGames, source.analyzedGames, source.analysed_games, source.classified) ?? 0);
    const dateRangeEligibleGames = Math.min(fetchedGames, firstInteger(source.dateRangeEligibleGames, source.date_range_eligible_games) ?? fetchedGames);
    const timeControlEligibleGames = Math.min(dateRangeEligibleGames, firstInteger(source.timeControlEligibleGames, source.time_control_eligible_games, source.eligible) ?? dateRangeEligibleGames);
    const analysisCandidateGames = Math.min(timeControlEligibleGames, Math.max(analysedGames, firstInteger(source.analysisCandidateGames, source.analysis_candidate_games) ?? timeControlEligibleGames));
    const usableOpeningSignals = Math.min(analysedGames, firstInteger(source.usableOpeningSignals, source.usable_opening_signals) ?? analysedGames);
    const excludedGames = fetchedGames - analysedGames;
    const rows = reconciledReasons(mergeReasons(reasonRows(report, source)), excludedGames, true);
    return {
      fetchedGames, dateRangeEligibleGames, timeControlEligibleGames, analysisCandidateGames,
      analysedGames, usableOpeningSignals, excludedGames,
      exclusionReasons: rows,
      analysisLimit: firstInteger(source.analysisLimit, source.analysis_limit),
      breakdownAvailable: true,
      contractVersion: 2,
      imported: fetchedGames,
      eligible: timeControlEligibleGames,
      classified: analysedGames,
      excluded: excludedGames,
    };
  }

  // Legacy reports did not preserve every processing stage. Keep the totals we
  // can prove and explicitly mark the unavailable breakdown instead of deriving
  // fake date/time-control precision from truncated evidence arrays.
  const analysedGames = firstInteger(source.classified, source.classifiedGames, report.gamesClassified, report.gamesAnalysed, report.gamesAnalyzed, report.totalGames, report.total_games) ?? 0;
  const explicitExcluded = firstInteger(source.excluded, report.gamesExcluded, report.skippedGames);
  const fetchedGames = Math.max(analysedGames, firstInteger(source.imported, report.gamesFound, report.gamesImported, explicitExcluded === null ? null : analysedGames + explicitExcluded) ?? analysedGames);
  const excludedGames = fetchedGames - analysedGames;
  const rows = mergeReasons(reasonRows(report, source));
  return {
    fetchedGames,
    dateRangeEligibleGames: null,
    timeControlEligibleGames: null,
    analysisCandidateGames: null,
    analysedGames,
    usableOpeningSignals: analysedGames,
    excludedGames,
    exclusionReasons: rows,
    analysisLimit: null,
    breakdownAvailable: false,
    contractVersion: 1,
    imported: fetchedGames,
    eligible: analysedGames,
    classified: analysedGames,
    excluded: excludedGames,
  };
}

export function countNoun(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function reportCountSentence(report = {}) {
  const counts = buildReportGameCounts(report);
  return `${countNoun(counts.fetchedGames, "public game")} found. ${countNoun(counts.analysedGames, "game")} with enough opening information analysed. ${countNoun(counts.excludedGames, "game")} not analysed.`;
}

export const REPORT_COUNT_DEFINITIONS = Object.freeze({
  fetchedGames: "Public game records returned by the selected chess platform for the requested import period.",
  dateRangeEligibleGames: "Returned games inside the selected import period.",
  timeControlEligibleGames: "Games in that period matching the selected time control.",
  analysisCandidateGames: "Most recent matching, unique games selected within the 300-game service limit.",
  analysedGames: "Candidate games with enough valid opening information to contribute to this report.",
  excludedGames: "Fetched games not analysed; the available reasons reconcile to this total.",
});
