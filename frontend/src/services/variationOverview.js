export const VARIATION_EVIDENCE_THRESHOLDS = {
  watchGames: 1,
  earlySignalMaxGames: 2,
  weaknessMinGames: 3,
  meaningfulShare: 0.25,
  weakLossRate: 50,
  weakScoreMax: 45,
  strongScoreMin: 55,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function openingName(item = {}) {
  if (typeof item === "string") return item;
  return item.opening || item.name || item.openingName || item.opening_name || item.ecoName || item.eco_name || "";
}

function playerColour(item = {}) {
  const text = [
    item.colour,
    item.color,
    item.side,
    item.player_color,
    item.playerColor,
    item.context,
    item.repertoireContext,
    item.contextLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("black")) return "black";
  if (text.includes("white")) return "white";
  return "unknown";
}

function cleanMoveToken(value) {
  return String(value || "")
    .replace(/[+#?!]+/g, "")
    .trim();
}

function moveText(item = {}) {
  const direct =
    item.moveLine ||
    item.move_line ||
    item.linePgn ||
    item.line_pgn ||
    item.openingLine ||
    item.opening_line ||
    item.movesText ||
    item.moves_text;

  if (direct) return String(direct).trim();

  const moves = item.moves || item.sanMoves || item.san_moves || item.sampleMoves || item.sample_moves;
  if (Array.isArray(moves)) return moves.map(cleanMoveToken).filter(Boolean).slice(0, 10).join(" ");
  if (typeof moves === "string") return moves.split(/\s+/).map(cleanMoveToken).filter(Boolean).slice(0, 10).join(" ");
  return "";
}

function variationName(item = {}) {
  return (
    item.variation ||
    item.variationName ||
    item.variation_name ||
    item.lineName ||
    item.line_name ||
    item.line ||
    moveText(item) ||
    "Main line"
  );
}

function inferResult(item = {}) {
  const raw = String(item.result || item.outcome || item.playerResult || item.player_result || "").toLowerCase();
  if (["win", "won", "1", "1-0"].includes(raw)) return "win";
  if (["loss", "lost", "lose", "0", "0-1"].includes(raw)) return "loss";
  if (["draw", "1/2", "1/2-1/2", "0.5"].includes(raw)) return "draw";
  return "unknown";
}

function collectGameRows(data = {}) {
  return [
    ...asArray(data.opening_games),
    ...asArray(data.openingGames),
    ...asArray(data.recent_games),
    ...asArray(data.recentGames),
    ...asArray(data.games),
    ...asArray(data.saved_games),
    ...asArray(data.savedGames),
    ...asArray(data.cloudAnalysedGames),
    ...asArray(data.cloud_analysed_games),
    ...asArray(data.restoredAnalysedGames),
    ...asArray(data.restored_analysed_games),
  ].filter(Boolean);
}

function collectWeakRows(data = {}) {
  const diagnostics = data.diagnosticSummary || data.diagnostic_summary || {};
  const retention = data.retentionMetrics || data.retention_metrics || {};
  const tracking = data.weakestLineTracking || data.weakest_line_tracking || retention.weakestLineTracking || retention.weakest_line_tracking || {};
  return [
    ...asArray(data.weak_lines),
    ...asArray(data.weakLines),
    ...asArray(data.problem_lines),
    ...asArray(data.problemLines),
    ...asArray(diagnostics.weak_variations),
    ...asArray(diagnostics.weakVariations),
    tracking.currentWeakestLine || tracking.current_weakest_line,
  ].filter(Boolean);
}

function scoreFor(row) {
  if (!row.games) return 0;
  return Math.round(((row.wins + row.draws * 0.5) / row.games) * 100);
}

function lossRateFor(row) {
  if (!row.games) return 0;
  return Math.round((row.losses / row.games) * 100);
}

function labelForBranch(row, totalGames) {
  const share = totalGames ? row.games / totalGames : 0;
  const score = scoreFor(row);
  const lossRate = lossRateFor(row);

  if (row.games <= VARIATION_EVIDENCE_THRESHOLDS.earlySignalMaxGames) {
    return "Watch this variation";
  }

  if (
    row.games >= VARIATION_EVIDENCE_THRESHOLDS.weaknessMinGames &&
    (lossRate >= VARIATION_EVIDENCE_THRESHOLDS.weakLossRate || score <= VARIATION_EVIDENCE_THRESHOLDS.weakScoreMax)
  ) {
    return share >= VARIATION_EVIDENCE_THRESHOLDS.meaningfulShare ? "Main weakness" : "Most difficult branch";
  }

  if (score >= VARIATION_EVIDENCE_THRESHOLDS.strongScoreMin) return "Stronger branch";
  return "Main line";
}

function formatBranchName(row = {}) {
  const label = row.variation && row.variation !== "Main line" ? row.variation : row.moveLine;
  return label || row.variation || "Main line";
}

export function buildOpeningVariationOverview(data = {}, opening = {}) {
  const targetName = normaliseKey(openingName(opening));
  if (!targetName) {
    return {
      status: "needs_more_evidence",
      displayStatus: "Needs more evidence",
      summary: "OpeningFit needs more opening data before separating branches.",
      branches: [],
      totalGames: 0,
    };
  }

  const targetColour = playerColour(opening);
  const grouped = new Map();
  const addRow = (item, source = "game") => {
    if (!item || normaliseKey(openingName(item)) !== targetName) return;
    const colour = playerColour(item);
    if (targetColour !== "unknown" && colour !== "unknown" && colour !== targetColour) return;

    const variation = variationName(item);
    const moveLine = moveText(item);
    const key = `${targetName}::${colour}::${normaliseKey(variation || moveLine || "main")}`;
    const row = grouped.get(key) || {
      opening: openingName(item) || openingName(opening),
      colour,
      variation,
      moveLine,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      sources: new Set(),
    };

    const games = Math.max(1, numberValue(item.games ?? item.gamesPlayed ?? item.games_played, source === "game" ? 1 : 0));
    const result = inferResult(item);
    row.games += games;
    row.sources.add(source);

    if (source === "game") {
      if (result === "win") row.wins += 1;
      else if (result === "draw") row.draws += 1;
      else if (result === "loss") row.losses += 1;
    } else {
      row.wins += numberValue(item.wins, 0);
      row.draws += numberValue(item.draws, 0);
      row.losses += numberValue(item.losses, 0);
      const winRate = numberValue(item.winRate ?? item.win_rate ?? item.scorePct ?? item.score, NaN);
      const lossRate = numberValue(item.lossRate ?? item.loss_rate, NaN);
      if (!row.wins && !row.draws && !row.losses && Number.isFinite(winRate)) {
        row.wins = Math.round((winRate / 100) * games);
      }
      if (!row.losses && Number.isFinite(lossRate)) {
        row.losses = Math.round((lossRate / 100) * games);
      }
    }

    grouped.set(key, row);
  };

  collectGameRows(data).forEach((item) => addRow(item, "game"));
  collectWeakRows(data).forEach((item) => addRow(item, "weak-line"));

  const branches = [...grouped.values()]
    .filter((row) => row.games > 0)
    .map((row) => ({
      ...row,
      score: scoreFor(row),
      lossRate: lossRateFor(row),
      sourceTypes: [...row.sources],
    }));
  const totalGames = branches.reduce((total, row) => total + row.games, 0);

  const labelled = branches
    .map((row) => ({
      ...row,
      label: labelForBranch(row, totalGames),
      name: formatBranchName(row),
      share: totalGames ? row.games / totalGames : 0,
    }))
    .sort((a, b) => {
      const priority = { "Main weakness": 0, "Most difficult branch": 1, "Watch this variation": 2, "Stronger branch": 3, "Main line": 4 };
      return (priority[a.label] ?? 5) - (priority[b.label] ?? 5) || b.games - a.games;
    });

  const weakBranches = labelled.filter((row) => row.label === "Main weakness" || row.label === "Most difficult branch");
  const strongBranches = labelled.filter((row) => row.label === "Stronger branch");
  const earlyBranches = labelled.filter((row) => row.label === "Watch this variation");
  const mainLine = [...labelled].sort((a, b) => b.games - a.games)[0] || null;
  const mainWeakness = weakBranches[0] || null;

  if (!labelled.length || totalGames < VARIATION_EVIDENCE_THRESHOLDS.weaknessMinGames) {
    return {
      status: "needs_more_evidence",
      displayStatus: "Needs more evidence",
      summary: "There are not enough repeated games yet to separate the opening from its branches.",
      branches: labelled,
      mainLine,
      strongBranches,
      weakBranches,
      earlyBranches,
      totalGames,
    };
  }

  const openingScore = numberValue(opening.winRate ?? opening.win_rate ?? opening.score, null);
  const generallySolid =
    mainWeakness &&
    openingScore !== null &&
    openingScore >= 48 &&
    mainWeakness.share < 0.5 &&
    (strongBranches.length > 0 || labelled.some((row) => row !== mainWeakness && row.score >= 50));

  const displayStatus = mainWeakness
    ? generallySolid
      ? `Generally solid - main weakness: ${mainWeakness.name}`
      : `Main weakness: ${mainWeakness.name}`
    : earlyBranches[0]
      ? `Watch this variation: ${earlyBranches[0].name}`
      : "Generally solid";

  return {
    status: mainWeakness ? (generallySolid ? "generally_solid_branch_weakness" : "branch_weakness") : "generally_solid",
    displayStatus,
    summary: mainWeakness
      ? generallySolid
        ? `Your overall results in ${openingName(opening)} are stable, but you struggle more often after ${mainWeakness.name}.`
        : `The clearest issue is concentrated in ${mainWeakness.name}, so review that branch before judging the whole opening.`
      : "No single branch is dragging this opening down in the current sample.",
    branches: labelled,
    mainLine,
    strongBranches,
    weakBranches,
    earlyBranches,
    totalGames,
  };
}
