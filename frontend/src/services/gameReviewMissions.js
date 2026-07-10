function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function openingName(value = {}) {
  if (typeof value === "string") return value;
  return value.name || value.opening || value.openingName || value.opening_name || value.ecoName || value.eco_name || "";
}

function resultText(game = {}) {
  return String(game.result || game.outcome || game.userResult || game.user_result || "").toLowerCase();
}

function gameDate(game = {}) {
  return game.date || game.end_time || game.endTime || game.playedAt || game.played_at || game.createdAt || game.created_at || "";
}

function hasReplayData(game = {}) {
  return asArray(game.moves).length > 0 || Boolean(game.pgn || game.PGN || game.rawPgn || game.raw_pgn);
}

function collectGames(data = {}) {
  const seen = new Set();
  return [
    ...asArray(data.recent_games),
    ...asArray(data.recentGames),
    ...asArray(data.opening_games),
    ...asArray(data.openingGames),
    ...asArray(data.analysed_games),
    ...asArray(data.analysedGames),
    ...asArray(data.restoredAnalysedGames),
    ...asArray(data.restored_analysed_games),
  ]
    .map((game, index) => ({ game, index }))
    .filter(Boolean)
    .filter(({ game, index }) => {
      const key =
        game.id ||
        game.url ||
        game.link ||
        game.pgn ||
        game.PGN ||
        game.rawPgn ||
        game.raw_pgn ||
        JSON.stringify([openingName(game), gameDate(game), game.result, asArray(game.moves).join(" "), index]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ game }) => game);
}

export function gamesForOpening(data = {}, opening = "") {
  const key = normalise(opening);
  if (!key) return [];
  return collectGames(data)
    .filter((game) => normalise(openingName(game)).includes(key) || key.includes(normalise(openingName(game))))
    .sort((a, b) => Date.parse(gameDate(b) || 0) - Date.parse(gameDate(a) || 0));
}

export function buildOpeningEvidence(data = {}, opening = {}) {
  const name = openingName(opening);
  const games = gamesForOpening(data, name);
  const wins = games.filter((game) => /win|won|1-0/.test(resultText(game))).slice(0, 3);
  const losses = games.filter((game) => /loss|lost|0-1/.test(resultText(game))).slice(0, 3);
  const representative = [...losses, ...wins, ...games].filter((game, index, list) => list.indexOf(game) === index).slice(0, 5);

  return {
    name,
    games,
    wins,
    losses,
    representative,
    replayable: representative.filter(hasReplayData),
  };
}

export function buildGameReviewMission(data = {}, opening = {}, completedIds = new Set()) {
  const evidence = buildOpeningEvidence(data, opening);
  const name = evidence.name || "this opening";
  const losses = evidence.losses;
  const wins = evidence.wins;
  const games = losses.length >= 2 ? losses : evidence.representative;
  const missionType = losses.length >= 2 ? "loss-review" : wins.length >= 2 ? "compare-wins" : "representative-review";
  const id = `review:${normalise(name).replace(/\s+/g, "-")}:${missionType}`;

  if (!evidence.representative.length) {
    return {
      id,
      available: false,
      opening: name,
      title: `Review ${name}`,
      why: "OpeningFit found the opening, but not enough replayable game records are available in this report.",
      games: [],
      estimatedTime: "3 minutes",
      completed: completedIds.has(id),
    };
  }

  return {
    id,
    available: true,
    opening: name,
    title:
      losses.length >= 2
        ? `Review your last ${Math.min(3, losses.length)} ${name} losses`
        : wins.length >= 2
          ? `Compare two recent ${name} wins`
          : `Review representative ${name} games`,
    why:
      losses.length >= 2
        ? "These games are useful evidence for whether the issue is the opening, move order, or the first plan afterwards."
        : "Use your own games to make the recommendation feel concrete before deciding what to practise.",
    games: games.slice(0, 3),
    estimatedTime: `${Math.max(3, Math.min(8, games.length * 3))} minutes`,
    completed: completedIds.has(id),
  };
}

export function completionSet(activity = []) {
  return new Set(
    asArray(activity)
      .filter((item) => item.type === "game_review_mission_completed" || item.action_type === "game_review_mission_completed")
      .map((item) => item.payload?.mission_id || item.payload?.missionId)
      .filter(Boolean)
  );
}
