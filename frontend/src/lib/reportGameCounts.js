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

const firstStrictNonNegativeInteger = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return null;
    return parsed;
  }
  return null;
};

export const EXCLUSION_REASON_LABELS = Object.freeze({
  outsideDateWindow: "Outside selected date window",
  outsideDateRange: "Outside selected date window",
  outsideWindow: "Outside selected date window",
  beyondMaximumGameCap: "Beyond configured maximum-game cap",
  analysisLimit: "Beyond configured maximum-game cap",
  unsupportedTimeControl: "Unsupported time control",
  bullet: "Unsupported time control",
  unsupportedGameType: "Unsupported chess variant",
  variants: "Unsupported chess variant",
  incompleteGame: "Incomplete or abandoned game",
  abandoned: "Incomplete or abandoned game",
  earlyTimeout: "Incomplete or abandoned game",
  oneMoveResignation: "Incomplete or abandoned game",
  duplicate: "Duplicate",
  missingPgnMoves: "Missing PGN or moves",
  missingOpening: "Missing PGN or moves",
  invalidPgn: "Missing PGN or moves",
  insufficientOpeningPlies: "Insufficient opening plies",
  veryShort: "Insufficient opening plies",
  tooFewLegalMoves: "Insufficient opening plies",
  parseFailure: "PGN or moves could not be parsed",
  attributionFailed: "Requested player could not be attributed to one side",
  unclassifiedOpening: "Opening family could not be classified",
  notUsedForOpeningStats: "Classified game was not usable in opening statistics",
  missingOpeningSignal: "Reason unavailable",
  reportFilters: "Outside the selected report filters",
  other: "Reason unavailable",
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
  if (knownTotal < excluded) return [...rows, { key: "unavailable", label: "Reason unavailable", count: excluded - knownTotal }];
  return rows;
}

export function buildReportGameCounts(report = {}) {
  const source = report.gameCounts || report.game_counts || report.importSummary || report.import_summary || {};
  const contractVersion = integer(source.contractVersion ?? source.contract_version) ?? 0;
  const isCanonical = contractVersion >= 2 || firstInteger(source.fetchedGames, source.fetched_games) !== null;

  if (contractVersion >= 4) {
    const fetchedGames = firstStrictNonNegativeInteger(source.gamesFetched, source.fetchedGames);
    const eligibleGames = firstStrictNonNegativeInteger(source.eligible, source.gamesEligible);
    const pgnAvailableGames = firstStrictNonNegativeInteger(source.gamesPgnAvailable, source.pgnAvailable);
    const parsedGames = firstStrictNonNegativeInteger(source.gamesParsed, source.parsed);
    const attributedGames = firstStrictNonNegativeInteger(source.gamesAttributed, source.attributed);
    const classifiedGames = firstStrictNonNegativeInteger(source.gamesClassified, source.classified);
    const usedForOpeningStats = firstStrictNonNegativeInteger(source.gamesUsedForOpeningStats, source.usedForOpeningStats);
    const excludedGames = firstStrictNonNegativeInteger(source.gamesExcluded, source.excludedGames, source.excluded);
    const stages = [fetchedGames, eligibleGames, pgnAvailableGames, parsedGames, attributedGames, classifiedGames, usedForOpeningStats];
    const rawReasons = source.exclusionReasons || source.exclusion_reasons || {};
    const reasonValues = Array.isArray(rawReasons)
      ? rawReasons.map((row) => typeof row === "object" ? row?.count ?? row?.games : null).filter((value) => value !== null)
      : Object.values(rawReasons);
    const reasonsValid = reasonValues.every((value) => firstStrictNonNegativeInteger(value) !== null);
    const rows = mergeReasons(reasonRows(report, source));
    const reasonsTotal = rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
    const valid = stages.every((value) => value !== null)
      && reasonsValid
      && stages.every((value, index) => index === 0 || stages[index - 1] >= value)
      && excludedGames === fetchedGames - usedForOpeningStats
      && reasonsTotal === excludedGames;
    if (!valid) {
      return {
        fetchedGames: null, eligibleGames: null, structurallyUsableGames: null, pgnAvailableGames: null,
        parsedGames: null, attributedGames: null, classifiedGames: null, usedForOpeningStats: null,
        unclassifiedGames: null, excludedGames: null, exclusionReasons: [], analysisLimit: null,
        analysisSelectionRule: null, duplicateGamesRemoved: null, breakdownAvailable: false,
        contractVersion, countStatus: "invalid_current_contract", imported: null, eligible: null,
        classified: null, excluded: null, analysedGames: null, usableOpeningSignals: null,
      };
    }
    return {
      fetchedGames, eligibleGames, structurallyUsableGames: eligibleGames, pgnAvailableGames,
      parsedGames, attributedGames, classifiedGames, usedForOpeningStats,
      unclassifiedGames: attributedGames - classifiedGames, excludedGames, exclusionReasons: rows,
      dateRangeEligibleGames: firstInteger(source.dateRangeEligibleGames),
      timeControlEligibleGames: firstInteger(source.timeControlEligibleGames),
      analysisCandidateGames: firstInteger(source.analysisCandidateGames),
      analysisLimit: firstInteger(source.analysisLimit, source.analysis_limit),
      analysisSelectionRule: source.analysisSelectionRule || source.analysis_selection_rule || null,
      duplicateGamesRemoved: firstInteger(source.duplicateGamesRemoved, source.duplicate_games_removed) ?? 0,
      breakdownAvailable: true, contractVersion, countStatus: "canonical",
      analysedGames: parsedGames, usableOpeningSignals: usedForOpeningStats,
      imported: fetchedGames, eligible: eligibleGames, classified: classifiedGames, excluded: excludedGames,
    };
  }

  if (isCanonical) {
    const fetchedGames = firstInteger(source.gamesFetched, source.fetchedGames, source.fetched_games, source.imported) ?? 0;
    const structurallyUsableGames = Math.min(fetchedGames, firstInteger(source.gamesStructurallyUsable, source.analysedGames, source.analyzedGames, source.analysed_games, source.classified) ?? 0);
    const classifiedGames = Math.min(structurallyUsableGames, firstInteger(source.gamesClassified, source.classified, source.classifiedGames) ?? structurallyUsableGames);
    const unclassifiedGames = Math.min(structurallyUsableGames, firstInteger(source.gamesUnclassified) ?? Math.max(0, structurallyUsableGames - classifiedGames));
    const usedForOpeningStats = Math.min(classifiedGames, firstInteger(source.gamesUsedForOpeningStats, source.usableOpeningSignals, source.usable_opening_signals) ?? classifiedGames);
    const explicitExcluded = firstInteger(source.gamesExcluded, source.excludedGames, source.excluded_games, source.excluded);
    const excludedGames = explicitExcluded ?? Math.max(0, fetchedGames - structurallyUsableGames);
    const analysedGames = structurallyUsableGames;
    const dateRangeEligibleGames = Math.min(fetchedGames, firstInteger(source.dateRangeEligibleGames, source.date_range_eligible_games) ?? fetchedGames);
    const timeControlEligibleGames = Math.min(dateRangeEligibleGames, firstInteger(source.timeControlEligibleGames, source.time_control_eligible_games, source.eligible) ?? dateRangeEligibleGames);
    const analysisCandidateGames = Math.min(timeControlEligibleGames, Math.max(analysedGames, firstInteger(source.analysisCandidateGames, source.analysis_candidate_games) ?? timeControlEligibleGames));
    const usableOpeningSignals = usedForOpeningStats;
    const rows = reconciledReasons(mergeReasons(reasonRows(report, source)), excludedGames, true);
    return {
      fetchedGames, dateRangeEligibleGames, timeControlEligibleGames, analysisCandidateGames,
      structurallyUsableGames, analysedGames, classifiedGames, usedForOpeningStats,
      unclassifiedGames, usableOpeningSignals, excludedGames,
      exclusionReasons: rows,
      analysisLimit: firstInteger(source.analysisLimit, source.analysis_limit),
      analysisSelectionRule: source.analysisSelectionRule || source.analysis_selection_rule || null,
      breakdownAvailable: true,
      countStatus: "historical_contract",
      contractVersion: Math.max(2, contractVersion),
      imported: fetchedGames,
      eligible: contractVersion >= 3 ? structurallyUsableGames : timeControlEligibleGames,
      classified: classifiedGames,
      excluded: excludedGames,
    };
  }

  // Legacy reports did not preserve every processing stage. Keep the totals we
  // can prove and explicitly mark the unavailable breakdown instead of deriving
  // fake date/time-control precision from truncated evidence arrays.
  const analysedGames = firstInteger(source.classified, source.classifiedGames, report.gamesClassified, report.gamesAnalysed, report.gamesAnalyzed, report.totalGames, report.total_games);
  const explicitExcluded = firstInteger(source.excluded, report.gamesExcluded, report.skippedGames);
  const fetchedGames = firstInteger(source.imported, report.gamesFound, report.gamesImported, explicitExcluded === null || analysedGames === null ? null : analysedGames + explicitExcluded);
  const excludedGames = explicitExcluded ?? (fetchedGames === null || analysedGames === null ? null : fetchedGames - analysedGames);
  const rows = excludedGames === null ? mergeReasons(reasonRows(report, source)) : reconciledReasons(mergeReasons(reasonRows(report, source)), excludedGames, true);
  return {
    fetchedGames,
    dateRangeEligibleGames: null,
    timeControlEligibleGames: null,
    analysisCandidateGames: null,
    analysedGames,
    usableOpeningSignals: null,
    excludedGames,
    exclusionReasons: rows,
    analysisLimit: null,
    breakdownAvailable: false,
    contractVersion: 1,
    countStatus: "legacy_incomplete",
    imported: fetchedGames,
    eligible: null,
    classified: analysedGames,
    excluded: excludedGames,
  };
}

export function countNoun(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatResultCounts({ wins = 0, draws = 0, losses = 0 } = {}) {
  return `${countNoun(Number(wins) || 0, "win")}, ${countNoun(Number(draws) || 0, "draw")} and ${countNoun(Number(losses) || 0, "loss", "losses")}`;
}

export function reportCountSentence(report = {}) {
  const counts = buildReportGameCounts(report);
  if (counts.contractVersion >= 4 && counts.countStatus === "canonical") {
    return `${countNoun(counts.fetchedGames, "game")} found · ${countNoun(counts.usedForOpeningStats, "game")} used · ${countNoun(counts.excludedGames, "game")} excluded`;
  }
  if (counts.contractVersion >= 3) {
    const unclassified = counts.unclassifiedGames
      ? ` ${countNoun(counts.unclassifiedGames, "structurally usable game")} could not be assigned an opening family.`
      : "";
    return `${countNoun(counts.fetchedGames, "public game")} found. ${countNoun(counts.classifiedGames, "game")} classified.${unclassified} ${countNoun(counts.excludedGames, "game")} excluded.`;
  }
  if (counts.fetchedGames === null || counts.analysedGames === null || counts.excludedGames === null) {
    return "Exact import breakdown unavailable for this older report.";
  }
  return `${countNoun(counts.fetchedGames, "public game")} found. ${analysedGameSentence(counts.analysedGames)} ${countNoun(counts.excludedGames, "game")} not analysed.`;
}

export function reportExclusionSummary(report = {}) {
  const counts = buildReportGameCounts(report);
  if (counts.excludedGames === null) return { summary: "Exact import breakdown unavailable for this older report.", confidenceNote: "", detailed: false };
  if (!counts.excludedGames) return { summary: "No imported games were excluded.", confidenceNote: "", detailed: counts.breakdownAvailable };
  const known = counts.exclusionReasons.filter((row) => row.count !== null && row.count > 0);
  const summary = !counts.breakdownAvailable
    ? "A detailed exclusion breakdown is unavailable for this older report."
    : known.length
      ? `${counts.excludedGames} excluded: ${known.sort((a, b) => b.count - a.count).slice(0, 3).map((row) => `${row.count} ${row.label.toLowerCase()}`).join(", ")}.`
      : `${counts.excludedGames} excluded. Reason unavailable.`;
  const confidenceNote = counts.fetchedGames > 0 && counts.excludedGames / counts.fetchedGames > 0.5
    ? "More than half of the imported games could not support this report, so opening-specific confidence may be limited even when the public-game total is large."
    : "";
  return { summary, confidenceNote, detailed: counts.breakdownAvailable };
}

export const REPORT_COUNT_DEFINITIONS = Object.freeze({
  fetchedGames: "Unique public games returned by the selected chess platform for the requested import period; repeated platform records are counted separately.",
  dateRangeEligibleGames: "Returned games inside the selected import period.",
  timeControlEligibleGames: "Games in that period matching the selected time control.",
  analysisCandidateGames: "Most recent matching, unique games selected within the configured maximum-game cap.",
  structurallyUsableGames: "Fetched games passing platform, time-control, deduplication, cap and basic validity checks.",
  pgnAvailableGames: "Eligible games containing usable PGN or move data.",
  parsedGames: "Games whose PGN or moves were successfully parsed.",
  attributedGames: "Parsed games confidently matched to the requested player with one explicit colour.",
  classifiedGames: "Attributed games assigned to one recognised primary opening family.",
  usedForOpeningStats: "Classified games with trusted player colour and repertoire-role attribution used in opening statistics.",
  unclassifiedGames: "Attributed games that could not be assigned to a recognised opening family.",
  analysedGames: "Legacy alias for successfully parsed games in current reports.",
  excludedGames: "Fetched games not used in opening statistics; every current-report game has one primary recorded reason.",
  duplicateGamesRemoved: "Repeated platform records removed before the unique fetched total and opening aggregation.",
});

export function reportSaveState(status = "", authenticated = false, sampleMode = false) {
  if (sampleMode) return { label: "Example only · Not saved", detail: "Fictional example data is not stored locally or synced to an account." };
  if (status === "saving") return { label: "Saving", detail: "Syncing this report to your account." };
  if (status === "saved") return { label: "Saved to cloud", detail: "This report is synced to your OpeningFit account." };
  if (status === "failed") return { label: "Saved locally", detail: "Cloud save failed, but this report remains available on this device." };
  if (status === "local" || !authenticated) return { label: "Saved locally", detail: "This report stays in this browser. Log in to sync it across devices." };
  return { label: "Save state unavailable", detail: "No save confirmation was recorded for this report." };
}
import { analysedGameSentence } from "./reportCoachCopy.js";
