import { Chess } from "chess.js";
import { normaliseOpeningKey } from "../data/openings";

export const COMMON_RESPONSE_THRESHOLDS = {
  minOpeningGames: 5,
  minResponseGames: 3,
  minResponseShare: 0.25,
  weaknessMinGames: 5,
  weakScoreMax: 45,
  weakLossRateMin: 50,
  maxPrefixPlies: 8,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanMove(value) {
  return String(value || "").replace(/[+#?!]+/g, "").trim();
}

function openingName(item = {}) {
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
    item.repertoire_context,
  ].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("black")) return "black";
  if (text.includes("white")) return "white";
  return "unknown";
}

function stripMoveText(value) {
  return String(value || "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");
}

function splitMoveText(value) {
  return stripMoveText(value).split(/\s+/).map(cleanMove).filter((move) => move && !move.startsWith("$"));
}

function moveList(item = {}) {
  const direct =
    item.moves ||
    item.sanMoves ||
    item.san_moves ||
    item.moveList ||
    item.move_list ||
    item.openingMoves ||
    item.opening_moves ||
    item.lineMoves ||
    item.line_moves;
  if (Array.isArray(direct)) return direct.map(cleanMove).filter(Boolean);
  if (typeof direct === "string") return splitMoveText(direct);

  const line =
    item.moveLine ||
    item.move_line ||
    item.openingLine ||
    item.opening_line ||
    item.line ||
    item.movesText ||
    item.moves_text;
  if (line) return splitMoveText(line);
  return splitMoveText(item.pgn || item.PGN || item.rawPgn || item.raw_pgn || "");
}

function legalPrefix(moves = []) {
  const game = new Chess();
  const legal = [];
  for (const move of moves.slice(0, COMMON_RESPONSE_THRESHOLDS.maxPrefixPlies)) {
    try {
      const played = game.move(move);
      if (!played) break;
      legal.push(played.san);
    } catch {
      break;
    }
  }
  return legal;
}

function inferResult(item = {}) {
  const raw = String(item.result || item.outcome || item.playerResult || item.player_result || "").toLowerCase();
  if (["win", "won", "1", "1-0"].includes(raw)) return "win";
  if (["loss", "lost", "lose", "0", "0-1"].includes(raw)) return "loss";
  if (["draw", "1/2", "1/2-1/2", "0.5"].includes(raw)) return "draw";
  return "unknown";
}

function gameRows(data = {}) {
  return [
    ...asArray(data.recent_games),
    ...asArray(data.recentGames),
    ...asArray(data.opening_games),
    ...asArray(data.openingGames),
    ...asArray(data.games),
    ...asArray(data.cloud_analysed_games),
    ...asArray(data.cloudAnalysedGames),
    ...asArray(data.restored_analysed_games),
    ...asArray(data.restoredAnalysedGames),
  ].filter(Boolean);
}

function responseIndexFor(colour, moves) {
  if (colour === "white") {
    if (moves.length > 5) return 5;
    if (moves.length > 3) return 3;
    return moves.length > 1 ? 1 : -1;
  }
  if (colour === "black") {
    if (moves.length > 2) return 2;
    return moves.length > 0 ? 0 : -1;
  }
  return -1;
}

function formatMoveAt(index, move) {
  const moveNumber = Math.floor(index / 2) + 1;
  return index % 2 === 0 ? `${moveNumber}.${move}` : `...${move}`;
}

function scoreFor(row) {
  if (!row.knownResults) return null;
  return Math.round(((row.wins + row.draws * 0.5) / row.knownResults) * 100);
}

function lossRateFor(row) {
  if (!row.knownResults) return null;
  return Math.round((row.losses / row.knownResults) * 100);
}

function makePracticeTarget(row) {
  if (!row.practiceMoves?.length || row.practiceMoves.length < 4) return null;
  const moveLine = row.practiceMoves.join(" ");
  return {
    opening: row.opening,
    name: row.opening,
    variation: row.responseLabel,
    line: row.responseLabel,
    moveLine,
    move_line: moveLine,
    moves: row.practiceMoves,
    practiceSide: row.colour,
    side: row.colour,
    colour: row.colour,
    color: row.colour,
    selectedReason: `This exact response appeared in ${row.games} analysed games.`,
    selected_reason: `This exact response appeared in ${row.games} analysed games.`,
    trainingSet: {
      openingName: row.opening,
      opening_name: row.opening,
      variationName: row.responseLabel,
      variation_name: row.responseLabel,
      lineName: row.responseLabel,
      line_name: row.responseLabel,
      startingMoveSequence: moveLine,
      starting_move_sequence: moveLine,
      side: row.colour,
      shortExplanation: `Practise the line after opponents choose ${row.responseLabel}.`,
      short_explanation: `Practise the line after opponents choose ${row.responseLabel}.`,
      source: "common-opponent-response",
    },
    source: "common-opponent-response",
  };
}

export function buildCommonOpponentResponseRecommendation(data = {}) {
  const openingTotals = new Map();
  const responseRows = new Map();

  gameRows(data).forEach((game) => {
    const opening = openingName(game);
    const openingKey = normaliseOpeningKey(opening);
    const colour = playerColour(game);
    if (!openingKey || openingKey.includes("unknown") || colour === "unknown") return;

    const moves = legalPrefix(moveList(game));
    const responseIndex = responseIndexFor(colour, moves);
    if (responseIndex < 0 || !moves[responseIndex]) return;

    const totalKey = `${openingKey}::${colour}`;
    openingTotals.set(totalKey, (openingTotals.get(totalKey) || 0) + 1);

    const responseMove = moves[responseIndex];
    const key = `${totalKey}::${responseIndex}::${responseMove.toLowerCase()}`;
    const current = responseRows.get(key) || {
      opening,
      openingKey,
      colour,
      responseMove,
      responseIndex,
      responseLabel: formatMoveAt(responseIndex, responseMove),
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      knownResults: 0,
      prefixes: new Map(),
    };

    current.games += 1;
    const result = inferResult(game);
    if (result !== "unknown") current.knownResults += 1;
    if (result === "win") current.wins += 1;
    if (result === "draw") current.draws += 1;
    if (result === "loss") current.losses += 1;

    const prefix = moves.slice(0, Math.min(moves.length, Math.max(responseIndex + 3, 4), COMMON_RESPONSE_THRESHOLDS.maxPrefixPlies));
    const prefixKey = prefix.join(" ");
    const prefixRow = current.prefixes.get(prefixKey) || { moves: prefix, count: 0 };
    prefixRow.count += 1;
    current.prefixes.set(prefixKey, prefixRow);
    responseRows.set(key, current);
  });

  const candidates = [...responseRows.values()]
    .map((row) => {
      const total = openingTotals.get(`${row.openingKey}::${row.colour}`) || row.games;
      const strongestPrefix = [...row.prefixes.values()].sort((a, b) => b.count - a.count)[0] || null;
      const enriched = {
        ...row,
        totalOpeningGames: total,
        share: total ? row.games / total : 0,
        score: scoreFor(row),
        lossRate: lossRateFor(row),
        practiceMoves: strongestPrefix?.moves || [],
      };
      return { ...enriched, practiceTarget: makePracticeTarget(enriched) };
    })
    .filter((row) => (
      row.totalOpeningGames >= COMMON_RESPONSE_THRESHOLDS.minOpeningGames &&
      row.games >= COMMON_RESPONSE_THRESHOLDS.minResponseGames &&
      row.share >= COMMON_RESPONSE_THRESHOLDS.minResponseShare
    ))
    .sort((a, b) => {
      const aWeak =
        a.games >= COMMON_RESPONSE_THRESHOLDS.weaknessMinGames &&
        ((a.lossRate !== null && a.lossRate >= COMMON_RESPONSE_THRESHOLDS.weakLossRateMin) ||
          (a.score !== null && a.score <= COMMON_RESPONSE_THRESHOLDS.weakScoreMax));
      const bWeak =
        b.games >= COMMON_RESPONSE_THRESHOLDS.weaknessMinGames &&
        ((b.lossRate !== null && b.lossRate >= COMMON_RESPONSE_THRESHOLDS.weakLossRateMin) ||
          (b.score !== null && b.score <= COMMON_RESPONSE_THRESHOLDS.weakScoreMax));
      if (aWeak !== bWeak) return bWeak - aWeak;
      return b.games - a.games || b.share - a.share;
    });

  const best = candidates[0] || null;
  if (!best) {
    return { status: "needs_more_data", recommendation: null };
  }

  const isWeak =
    best.games >= COMMON_RESPONSE_THRESHOLDS.weaknessMinGames &&
    ((best.lossRate !== null && best.lossRate >= COMMON_RESPONSE_THRESHOLDS.weakLossRateMin) ||
      (best.score !== null && best.score <= COMMON_RESPONSE_THRESHOLDS.weakScoreMax));

  return {
    status: best.practiceTarget ? "practice_supported" : "review_supported",
    recommendation: {
      ...best,
      isWeak,
      frequencyPct: Math.round(best.share * 100),
    },
  };
}
