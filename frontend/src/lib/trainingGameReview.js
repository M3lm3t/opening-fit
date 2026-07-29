import { Chess } from "chess.js";
import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";

const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const text = (value) => String(value ?? "").trim();
const openingKey = (value) => normaliseOpeningKey(findOpeningLine(value)?.id || value).replace(/\bdefense\b/g, "defence");

function headersFromPgn(pgn) {
  const headers = {};
  for (const match of text(pgn).matchAll(/^\[([^\s]+)\s+"([^"]*)"\]$/gm)) headers[match[1].toLowerCase()] = match[2];
  return headers;
}

export function parseReplayPgn(pgn) {
  if (!text(pgn)) return null;
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const moves = chess.history();
    return moves.length ? { moves, headers: headersFromPgn(pgn) } : null;
  } catch {
    return null;
  }
}

export function validatedGameUrl(value) {
  try {
    const url = new URL(text(value));
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if ((host === "chess.com" || host.endsWith(".chess.com")) && /\/game\//.test(url.pathname)) return url.href;
    if ((host === "lichess.org" || host.endsWith(".lichess.org")) && /^\/[a-zA-Z0-9]{8,12}/.test(url.pathname)) return url.href;
  } catch {
    return "";
  }
  return "";
}

function platformFor(game, url) {
  const explicit = text(game.platform || game.source || game.provider).toLowerCase();
  if (explicit.includes("lichess") || url.includes("lichess.org")) return "Lichess";
  if (explicit.includes("chess") || url.includes("chess.com")) return "Chess.com";
  return "Platform unavailable";
}

function gameOpening(game, headers) {
  const value = game.opening || game.opening_name || game.openingName || game.name || headers.opening;
  return text(typeof value === "object" ? value?.name || value?.opening : value);
}

function playedAtValue(value) {
  const raw = text(value);
  const numeric = Number(raw);
  if (raw && Number.isFinite(numeric) && numeric > 0) {
    const date = new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric);
    return Number.isNaN(date.getTime()) ? raw : date.toISOString();
  }
  return raw;
}

function gameColour(game, headers, report) {
  const explicit = text(game.userColour || game.user_colour || game.colour || game.color).toLowerCase();
  if (["white", "black"].includes(explicit)) return explicit;
  const username = text(report.username || report.playerName || report.player_name || report.playerProfile?.username || report.player_profile?.username).toLowerCase();
  if (username && text(game.white_username || game.whiteUsername || headers.white).toLowerCase() === username) return "white";
  if (username && text(game.black_username || game.blackUsername || headers.black).toLowerCase() === username) return "black";
  return "";
}

function relativeResult(game, headers, colour) {
  const value = text(game.userResult || game.user_result || game.outcome || game.result || headers.result).toLowerCase();
  if (["win", "won", "loss", "lost", "draw"].includes(value)) return value.startsWith("w") ? "Win" : value.startsWith("l") ? "Loss" : "Draw";
  if (value === "1/2-1/2") return "Draw";
  if (value === "1-0") return colour === "white" ? "Win" : colour === "black" ? "Loss" : "1–0";
  if (value === "0-1") return colour === "black" ? "Win" : colour === "white" ? "Loss" : "0–1";
  return value ? text(game.result || headers.result) : "Result unavailable";
}

function stableTextId(value) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `report-game-${(hash >>> 0).toString(16)}`;
}

function stableId(game, pgn, url, index) {
  return text(game.gameId || game.game_id || game.id || url || headersFromPgn(pgn).site) || (pgn ? stableTextId(pgn) : `report-game-${index}`);
}

function reportGames(report) {
  return [
    ...list(report.openingGames), ...list(report.opening_games),
    ...list(report.recentGames), ...list(report.recent_games),
    ...list(report.savedGames), ...list(report.saved_games), ...list(report.games),
    ...list(report.analysisGameIndex), ...list(report.analysis_game_index),
  ];
}

function normaliseGame(game, report, index) {
  const pgn = text(game.pgn || game.PGN || game.rawPgn || game.raw_pgn);
  const parsed = parseReplayPgn(pgn);
  const headers = parsed?.headers || headersFromPgn(pgn);
  const url = validatedGameUrl(game.url || game.gameUrl || game.game_url || headers.site);
  const colour = gameColour(game, headers, report);
  const opening = gameOpening(game, headers);
  const opponent = colour === "white"
    ? text(game.black_username || game.blackUsername || game.black || headers.black)
    : colour === "black" ? text(game.white_username || game.whiteUsername || game.white || headers.white) : "";
  const playedAt = playedAtValue(game.playedAt || game.played_at || game.playedDate || game.played_date || game.endTime || game.end_time || headers.date);
  const id = stableId(game, pgn, url, index);
  return {
    id, opening, openingKey: openingKey(opening), userColour: colour,
    opponent: opponent || "Opponent unavailable", result: relativeResult(game, headers, colour),
    playedAt, timeControl: text(game.timeControl || game.time_control || game.timeClass || game.time_class) || "Time control unavailable",
    platform: platformFor(game, url), sourceUrl: url, pgn, moves: parsed?.moves || list(game.moves),
    white: text(game.white_username || game.whiteUsername || game.white || headers.white),
    black: text(game.black_username || game.blackUsername || game.black || headers.black),
    raw: game,
  };
}

function mergeGame(existing, candidate) {
  if (!existing) return candidate;
  const richer = candidate.pgn || candidate.sourceUrl ? candidate : existing;
  const other = richer === candidate ? existing : candidate;
  return { ...other, ...richer, pgn: richer.pgn || other.pgn, moves: richer.moves?.length ? richer.moves : other.moves, sourceUrl: richer.sourceUrl || other.sourceUrl };
}

export function selectTrainingReviewGames(report = {}, priority = {}, priorityReason = null, limit = 3) {
  const targetOpening = openingKey(priority.openingKey || priority.openingName || "");
  const targetColour = text(priority.playerColour || priority.player_colour).toLowerCase();
  const byId = new Map();
  reportGames(report).forEach((game, index) => {
    const normalized = normaliseGame(game, report, index);
    byId.set(normalized.id, mergeGame(byId.get(normalized.id), normalized));
  });
  const difficultReview = priorityReason?.kind === "reliable_weakness" || /repair|weak|problem/.test(text(priority.actionType || priority.action_type).toLowerCase());
  const resultRank = { Loss: 0, Draw: 1, Win: 2 };
  return [...byId.values()]
    .filter((game) => (!targetOpening || game.openingKey === targetOpening) && (!targetColour || game.userColour === targetColour))
    .sort((left, right) => {
      const usable = Number(Boolean(right.pgn || right.sourceUrl)) - Number(Boolean(left.pgn || left.sourceUrl));
      if (usable) return usable;
      if (difficultReview) {
        const result = (resultRank[left.result] ?? 3) - (resultRank[right.result] ?? 3);
        if (result) return result;
      }
      return (Date.parse(right.playedAt) || 0) - (Date.parse(left.playedAt) || 0) || left.id.localeCompare(right.id);
    })
    .slice(0, Math.max(0, Math.min(3, limit)))
    .map((game) => {
      const knownResult = ["Win", "Draw", "Loss"].includes(game.result) ? game.result.toLowerCase() : "analysed game";
      return {
        ...game,
        hasInternalReplay: game.moves.length > 0,
        whySelected: difficultReview
          ? `A recent ${knownResult} in the report's evidence-supported repair priority.`
          : `A recent analysed example matching ${game.opening || priority.openingName || "the selected opening"} as ${game.userColour || targetColour || "the selected colour"}; it is not presented as proof of weakness.`,
      };
    });
}

export function trainingReviewRequirements({ games = [], reviewedGameIds = [], conceptEngaged = false, responsePlan = "" } = {}) {
  const actionableGames = games.filter((game) => game.hasInternalReplay || game.sourceUrl);
  const reviewComplete = actionableGames.length === 0 || reviewedGameIds.some((id) => actionableGames.some((game) => game.id === id));
  const planComplete = Boolean(text(responsePlan));
  return { reviewComplete, conceptComplete: Boolean(conceptEngaged), planComplete, complete: reviewComplete && Boolean(conceptEngaged) && planComplete };
}
