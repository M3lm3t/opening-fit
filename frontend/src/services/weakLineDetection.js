const DEFAULT_MIN_GAMES = 5;
const MAX_OPENING_PLIES = 8;

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
  const existing = Array.isArray(data.weak_lines)
    ? data.weak_lines
    : Array.isArray(data.weakLines)
      ? data.weakLines
      : [];
  const generated = buildWeakLines(data, options);
  const seen = new Set();

  return [...existing, ...generated].filter((line) => {
    const key = `${line?.opening || ""}::${line?.moveLine || line?.line || line?.variation || ""}`.toLowerCase();
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return safeNumber(line?.games) >= Math.max(1, safeNumber(options.minGames, DEFAULT_MIN_GAMES));
  });
}
