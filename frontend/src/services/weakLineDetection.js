const DEFAULT_MIN_GAMES = 5;
const MAX_OPENING_PLIES = 8;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanMove(move) {
  return String(move || "")
    .replace(/[+#?!]+/g, "")
    .trim();
}

function getOpeningName(value) {
  return (
    value?.opening ||
    value?.openingName ||
    value?.opening_name ||
    value?.ecoName ||
    value?.eco_name ||
    value?.name ||
    value?.label ||
    "Unknown opening"
  );
}

function extractMovesFromPgn(pgnText) {
  return String(pgnText || "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ")
    .split(/\s+/)
    .map(cleanMove)
    .filter((move) => move && !move.startsWith("$"));
}

function getMoveList(game = {}) {
  const explicit =
    game.moves ||
    game.moveList ||
    game.move_list ||
    game.openingMoves ||
    game.opening_moves ||
    game.lineMoves ||
    game.line_moves;

  if (Array.isArray(explicit)) return explicit.map(cleanMove).filter(Boolean);
  if (typeof explicit === "string") return explicit.split(/\s+/).map(cleanMove).filter(Boolean);

  const moveLine =
    game.moveLine ||
    game.move_line ||
    game.openingLine ||
    game.opening_line ||
    game.line ||
    "";

  if (moveLine) return String(moveLine).split(/\s+/).map(cleanMove).filter(Boolean);

  return extractMovesFromPgn(game.pgn || game.PGN || game.rawPgn || game.raw_pgn || "");
}

function inferResult(game = {}) {
  const raw = String(
    game.result ||
      game.outcome ||
      game.playerResult ||
      game.player_result ||
      game.score ||
      ""
  ).toLowerCase();

  if (["win", "won", "1", "1-0"].includes(raw)) return "win";
  if (["loss", "lost", "lose", "0", "0-1"].includes(raw)) return "loss";
  if (["draw", "1/2", "1/2-1/2", "0.5"].includes(raw)) return "draw";

  const username = String(game.username || game.player || game.playerName || game.player_name || "").toLowerCase();
  const pgnResult = String(game.pgn || game.PGN || "").match(/\[Result\s+"([^"]+)"\]/i)?.[1] || "";
  const white = String(game.white?.username || game.white_username || game.white || "").toLowerCase();
  const black = String(game.black?.username || game.black_username || game.black || "").toLowerCase();

  if (!username || !pgnResult) return "unknown";
  if (pgnResult === "1/2-1/2") return "draw";
  if ((pgnResult === "1-0" && white === username) || (pgnResult === "0-1" && black === username)) return "win";
  if ((pgnResult === "1-0" && black === username) || (pgnResult === "0-1" && white === username)) return "loss";

  return "unknown";
}

function getRecentGames(data = {}) {
  return [
    ...(Array.isArray(data.recent_games) ? data.recent_games : []),
    ...(Array.isArray(data.recentGames) ? data.recentGames : []),
    ...(Array.isArray(data.opening_games) ? data.opening_games : []),
    ...(Array.isArray(data.openingGames) ? data.openingGames : []),
  ];
}

function lineKey(moves) {
  return moves.map((move) => move.toLowerCase()).join(" ");
}

function formatMoveSequence(moves) {
  return moves
    .reduce((parts, move, index) => {
      if (index % 2 === 0) parts.push(`${Math.floor(index / 2) + 1}.${move}`);
      else parts.push(move);
      return parts;
    }, [])
    .join(" ");
}

function getLossRate(line = {}) {
  const direct = line.lossRate ?? line.loss_rate;
  if (direct !== undefined && direct !== null && direct !== "") {
    const value = safeNumber(direct, 0);
    return Math.round(value <= 1 ? value * 100 : value);
  }

  const games = safeNumber(line.games ?? line.gamesPlayed ?? line.games_played, 0);
  const losses = safeNumber(line.losses, 0);
  return games ? Math.round((losses / games) * 100) : 0;
}

function getWinRate(line = {}) {
  const direct = line.winRate ?? line.win_rate ?? line.scorePct ?? line.score_pct ?? line.score;
  if (direct !== undefined && direct !== null && direct !== "") {
    const value = safeNumber(direct, 0);
    return Math.round(value <= 1 ? value * 100 : value);
  }

  const games = safeNumber(line.games ?? line.gamesPlayed ?? line.games_played, 0);
  const wins = safeNumber(line.wins, 0);
  const draws = safeNumber(line.draws, 0);
  return games ? Math.round(((wins + draws * 0.5) / games) * 100) : 0;
}

export function weakLineEvidence(line = {}) {
  const games = safeNumber(line.games ?? line.gamesPlayed ?? line.games_played, 0);
  const lossRate = getLossRate(line);
  const losses = safeNumber(line.losses, 0);
  const winRate = getWinRate(line);

  if (games >= 8 && (lossRate >= 55 || losses >= 4)) {
    return {
      level: "actionable",
      label: "Actionable pattern",
      summary: `${games} repeated games with a ${lossRate}% loss rate.`,
      rank: 3000 + games * 8 + lossRate * 3 + losses * 10,
    };
  }

  if (games >= 5 && (lossRate >= 45 || winRate <= 45)) {
    return {
      level: "useful",
      label: "Useful signal",
      summary: `${games} repeated games, enough to review before changing the whole opening.`,
      rank: 2000 + games * 7 + lossRate * 2 + Math.max(0, 50 - winRate) * 2,
    };
  }

  if (games >= 3) {
    return {
      level: "early",
      label: "Early signal",
      summary: `${games} repeated games. Treat this as a watch item, not proof.`,
      rank: 1000 + games * 6 + lossRate + Math.max(0, 50 - winRate),
    };
  }

  return {
    level: "thin",
    label: "Thin sample",
    summary: games
      ? `${games} game only. Collect more games before judging the line.`
      : "Game count is unavailable, so this should not drive a firm verdict.",
    rank: games * 4 + lossRate,
  };
}

function weakLineMoveArray(line = {}) {
  const direct =
    line.moves ||
    line.sanMoves ||
    line.san_moves ||
    line.sampleMoves ||
    line.sample_moves ||
    line.lineMoves ||
    line.line_moves;

  if (Array.isArray(direct)) return direct.map(cleanMove).filter(Boolean);
  if (typeof direct === "string") return direct.split(/\s+/).map(cleanMove).filter(Boolean);
  return [];
}

function normalizeWeakLine(line = {}) {
  if (!line || typeof line !== "object") return null;

  const moves = weakLineMoveArray(line);
  const moveLine =
    line.moveLine ||
    line.move_line ||
    line.linePgn ||
    line.line_pgn ||
    line.line ||
    (moves.length ? formatMoveSequence(moves.slice(0, MAX_OPENING_PLIES)) : "");
  const games = safeNumber(line.games ?? line.gamesPlayed ?? line.games_played, 0);
  const lossRate = getLossRate(line);
  const winRate = getWinRate(line);
  const evidence = weakLineEvidence({ ...line, games, lossRate, winRate });
  const reason =
    line.flagReason ||
    line.reason ||
    line.summary ||
    line.exactIssue ||
    line.exact_issue ||
    (evidence.level === "thin"
      ? evidence.summary
      : lossRate >= 55
        ? "This repeated variation is producing too many losses."
        : "This line is scoring below your broader opening results.");
  const opening = getOpeningName(line);

  return {
    ...line,
    opening,
    variation: line.variation || line.variationName || line.variation_name || line.line || moveLine,
    line: line.line || line.variation || line.variationName || line.variation_name || moveLine,
    moveLine,
    moves: moves.length ? moves : line.moves,
    games,
    winRate,
    lossRate,
    evidenceLevel: evidence.level,
    evidenceLabel: evidence.label,
    evidenceSummary: evidence.summary,
    evidenceRank: evidence.rank,
    flagReason: reason,
    reason,
    trainingTarget: line.trainingTarget || line.training_target || {
      opening,
      name: opening,
      variation: line.variation || line.line || moveLine,
      line: line.line || line.variation || moveLine,
      moveLine,
      moves,
      reason,
      flagReason: reason,
      weakLine: true,
      source: "weakest-line",
    },
  };
}

function collectExistingWeakLines(data = {}) {
  const retention = data.retentionMetrics || data.retention_metrics || {};
  const tracking =
    data.weakestLineTracking ||
    data.weakest_line_tracking ||
    retention.weakestLineTracking ||
    retention.weakest_line_tracking ||
    {};
  const currentWeakest = tracking.currentWeakestLine || tracking.current_weakest_line;
  const diagnostics = data.diagnosticSummary || data.diagnostic_summary || {};

  return [
    ...asArray(data.weak_lines),
    ...asArray(data.weakLines),
    ...asArray(data.problem_lines),
    ...asArray(data.problemLines),
    ...asArray(diagnostics.weak_variations),
    ...asArray(diagnostics.weakVariations),
    currentWeakest,
  ].filter(Boolean);
}

function buildContinuations(samples) {
  const counts = new Map();
  samples.forEach((game) => {
    const moves = getMoveList(game);
    const next = moves[MAX_OPENING_PLIES];
    if (next) counts.set(next, (counts.get(next) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([move, count]) => ({ move, count }));
}

export function buildWeakLines(data = {}, options = {}) {
  const minGames = Math.max(1, safeNumber(options.minGames, DEFAULT_MIN_GAMES));
  const groups = new Map();

  getRecentGames(data).forEach((game) => {
    const moves = getMoveList(game).slice(0, MAX_OPENING_PLIES);
    if (moves.length < 4) return;

    const key = `${getOpeningName(game).toLowerCase()}::${lineKey(moves)}`;
    const current = groups.get(key) || {
      opening: getOpeningName(game),
      variation: game.variation || game.variationName || game.openingVariation || game.opening_variation || "",
      moves,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      samples: [],
    };
    const result = inferResult(game);
    current.games += 1;
    current.samples.push(game);
    if (result === "win") current.wins += 1;
    if (result === "draw") current.draws += 1;
    if (result === "loss") current.losses += 1;
    groups.set(key, current);
  });

  return [...groups.values()]
    .filter((line) => line.games >= minGames)
    .map((line) => {
      const winRate = Math.round(((line.wins + line.draws * 0.5) / line.games) * 100);
      const lossRate = Math.round((line.losses / line.games) * 100);
      const moveLine = formatMoveSequence(line.moves);

      return {
        opening: line.opening,
        variation: line.variation || moveLine,
        line: line.variation || moveLine,
        moveLine,
        moves: line.moves,
        games: line.games,
        winRate,
        lossRate,
        wins: line.wins,
        draws: line.draws,
        losses: line.losses,
        context: lineKey(line.moves),
        contextLabel: "Repeated variation",
        colour: line.samples.find((sample) => sample?.colour || sample?.color)?.colour || line.samples.find((sample) => sample?.colour || sample?.color)?.color || "unknown",
        color: line.samples.find((sample) => sample?.colour || sample?.color)?.colour || line.samples.find((sample) => sample?.colour || sample?.color)?.color || "unknown",
        commonContinuations: buildContinuations(line.samples),
        flagReason:
          lossRate >= 55
            ? "This repeated variation is producing too many losses."
            : "This line is scoring below your broader opening results.",
        engineReady: {
          fen: null,
          pgnPrefix: moveLine,
          depth: null,
          evaluation: null,
        },
        trainingTarget: {
          opening: line.opening,
          name: line.opening,
          variation: line.variation || moveLine,
          line: line.variation || moveLine,
          moveLine,
          moves: line.moves,
          colour: line.samples.find((sample) => sample?.colour || sample?.color)?.colour || line.samples.find((sample) => sample?.colour || sample?.color)?.color || "unknown",
          color: line.samples.find((sample) => sample?.colour || sample?.color)?.colour || line.samples.find((sample) => sample?.colour || sample?.color)?.color || "unknown",
          reason: lossRate >= 55
            ? "This repeated variation is producing too many losses."
            : "This line is scoring below your broader opening results.",
          flagReason: lossRate >= 55
            ? "This repeated variation is producing too many losses."
            : "This line is scoring below your broader opening results.",
          weakLine: true,
          source: "weakest-line",
        },
      };
    })
    .filter((line) => line.lossRate >= 45 || line.winRate <= 45)
    .sort((a, b) => b.lossRate - a.lossRate || b.games - a.games)
    .slice(0, 8);
}

export function mergeWeakLines(data = {}, options = {}) {
  const existing = collectExistingWeakLines(data).map(normalizeWeakLine).filter(Boolean);
  const generated = buildWeakLines(data, options);
  const seen = new Set();

  return [...existing, ...generated]
    .map(normalizeWeakLine)
    .filter((line) => {
      const key = `${line?.opening || ""}::${line?.moveLine || line?.line || line?.variation || ""}`.toLowerCase();
      if (!key.trim() || seen.has(key)) return false;
      seen.add(key);
      return safeNumber(line?.games) >= Math.max(1, safeNumber(options.minGames, DEFAULT_MIN_GAMES));
    })
    .sort((a, b) => {
      const rankDelta = safeNumber(b.evidenceRank, 0) - safeNumber(a.evidenceRank, 0);
      if (rankDelta) return rankDelta;
      const lossDelta = getLossRate(b) - getLossRate(a);
      if (lossDelta) return lossDelta;
      return safeNumber(b.games, 0) - safeNumber(a.games, 0);
    });
}
