const text = (value) => String(value ?? "").trim();
const list = (value) => Array.isArray(value) ? value : [];

function gameMoves(game = {}) {
  if (Array.isArray(game.moves)) return game.moves.map(text).filter(Boolean);
  const raw = text(game.movesText || game.moves_text || game.moves || game.pgn);
  if (!raw) return [];
  return raw
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((token) => token && !/^\d+\.(\.\.)?$/.test(token) && !["1-0", "0-1", "1/2-1/2", "*"].includes(token));
}

function perspective(game = {}) {
  return game.perspective && typeof game.perspective === "object" ? game.perspective : {};
}

function playerColour(game = {}) {
  return text(game.playerColour || game.player_color || perspective(game).userColour || game.colour || game.color).toLowerCase();
}

function openingName(game = {}) {
  return text(game.openingName || game.opening || game.name || game.openingFamily);
}

function resultScore(game = {}) {
  const result = text(game.playerResult || game.player_result || game.result).toLowerCase();
  if (result.includes("win")) return 1;
  if (result.includes("draw")) return 0.5;
  if (result.includes("loss")) return 0;
  return null;
}

function gameId(game = {}) {
  return text(game.gameId || game.game_id || game.id || game.url);
}

export function meaningfulOpponentContinuation(game = {}) {
  const moves = gameMoves(game);
  const colour = playerColour(game);
  const classificationPly = Number(game.classificationPly ?? game.classification_ply);
  if (!moves.length || !["white", "black"].includes(colour) || !Number.isInteger(classificationPly) || classificationPly < 1) return null;

  const opponentParity = colour === "white" ? 1 : 0;
  let moveIndex = classificationPly;
  while (moveIndex < moves.length && moveIndex % 2 !== opponentParity) moveIndex += 1;
  if (moveIndex >= moves.length) return null;
  return {
    reply: moves[moveIndex],
    moveIndex,
    branch: moves.slice(0, Math.min(moves.length, moveIndex + 3)).join(" "),
  };
}

export function buildMeaningfulOpponentResponsePrep(games = [], { normaliseName = (value) => text(value).toLowerCase() } = {}) {
  const uniqueGames = new Map();
  list(games).forEach((game, index) => {
    const id = gameId(game) || `unidentified:${index}`;
    if (!uniqueGames.has(id)) uniqueGames.set(id, game);
  });

  const grouped = new Map();
  for (const game of uniqueGames.values()) {
    const opening = openingName(game);
    const continuation = meaningfulOpponentContinuation(game);
    if (!opening || !continuation) continue;
    const context = [
      text(perspective(game).role || game.openingRole || game.opening_role),
      text(perspective(game).repertoireRole || game.repertoireRole || game.repertoire_role),
      text(perspective(game).relationship || game.relationship),
    ].join(":");
    const key = `${normaliseName(opening)}::${context}::${continuation.reply}`;
    const row = grouped.get(key) || { openingName: opening, context, ...continuation, games: 0, scoreSum: 0, scoredGames: 0, gameIds: [] };
    row.games += 1;
    row.gameIds.push(gameId(game));
    const score = resultScore(game);
    if (score !== null) {
      row.scoreSum += score;
      row.scoredGames += 1;
    }
    grouped.set(key, row);
  }

  const byContext = new Map();
  for (const row of grouped.values()) {
    if (row.games < 2) continue;
    const score = row.scoredGames ? Math.round((row.scoreSum / row.scoredGames) * 100) : null;
    const key = `${normaliseName(row.openingName)}::${row.context}`;
    byContext.set(key, [...(byContext.get(key) || []), { ...row, score }]);
  }

  return [...byContext.values()].map((branches) => {
    const sorted = [...branches].sort((left, right) => right.games - left.games || (left.score ?? 100) - (right.score ?? 100));
    const hardest = branches.filter((branch) => branch.games >= 3 && branch.score !== null).sort((left, right) => left.score - right.score || right.games - left.games)[0];
    const common = sorted[0];
    return {
      ...common,
      isHardest: Boolean(hardest && hardest.reply === common.reply),
      hardestReply: hardest?.reply || "",
      recommendation: hardest && hardest.reply === common.reply
        ? `Practise the recorded branch after ${common.reply}; this is both common and your hardest later response.`
        : `Practise the recorded branch after ${common.reply} so this later response feels routine.`,
    };
  }).sort((left, right) => right.games - left.games).slice(0, 4);
}
