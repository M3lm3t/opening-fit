import { Chess } from "chess.js";
import { findOpeningLine, normaliseOpeningKey } from "../data/openings.ts";
import { formatOpeningNameForDisplay } from "./openingNamePresentation.js";

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
  return "Platform not recorded";
}

function playerName(value) {
  if (value && typeof value === "object") return text(value.username || value.name || value.displayName || value.display_name);
  return text(value);
}

function whitePlayer(game, headers) {
  return playerName(game.white_username || game.whiteUsername || game.whitePlayer || game.white_player || game.players?.white || game.white) || text(headers.white);
}

function blackPlayer(game, headers) {
  return playerName(game.black_username || game.blackUsername || game.blackPlayer || game.black_player || game.players?.black || game.black) || text(headers.black);
}

function gameOpening(game, headers) {
  const value = game.opening || game.opening_name || game.openingName || game.name || headers.opening;
  return text(typeof value === "object" ? value?.name || value?.opening : value);
}

function playedAtValue(value) {
  const raw = text(value);
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw.replaceAll(".", "-");
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
  if (username && whitePlayer(game, headers).toLowerCase() === username) return "white";
  if (username && blackPlayer(game, headers).toLowerCase() === username) return "black";
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
  const opening = formatOpeningNameForDisplay(gameOpening(game, headers));
  const analysedUsername = text(report.username || report.playerName || report.player_name || report.playerProfile?.username || report.player_profile?.username).toLowerCase();
  const suppliedOpponent = playerName(game.opponent_username || game.opponentUsername || game.opponent);
  const structuredOpponent = suppliedOpponent.toLowerCase() !== analysedUsername ? suppliedOpponent : "";
  const suppliedHeaderOpponent = colour === "white" ? blackPlayer(game, headers) : colour === "black" ? whitePlayer(game, headers) : "";
  const headerOpponent = suppliedHeaderOpponent.toLowerCase() !== analysedUsername ? suppliedHeaderOpponent : "";
  const opponent = structuredOpponent || headerOpponent;
  const playedAt = playedAtValue(game.playedAt || game.played_at || game.playedDate || game.played_date || game.endTime || game.end_time || headers.date);
  const id = stableId(game, pgn, url, index);
  return {
    id, opening, openingKey: openingKey(opening), userColour: colour,
    opponent: opponent || "Opponent not recorded", result: relativeResult(game, headers, colour),
    playedAt, timeControl: text(game.timeControl || game.time_control || game.timeClass || game.time_class || headers.timecontrol) || "Time control not recorded",
    platform: platformFor(game, url), sourceUrl: url, pgn, moves: parsed?.moves || list(game.moves),
    event: text(game.event || headers.event) || "Event not recorded",
    white: whitePlayer(game, headers),
    black: blackPlayer(game, headers),
    raw: game,
  };
}

function mergeGame(existing, candidate) {
  if (!existing) return candidate;
  const richer = candidate.pgn || candidate.sourceUrl ? candidate : existing;
  const other = richer === candidate ? existing : candidate;
  return { ...other, ...richer, pgn: richer.pgn || other.pgn, moves: richer.moves?.length ? richer.moves : other.moves, sourceUrl: richer.sourceUrl || other.sourceUrl };
}

function trainingReviewCandidates(report = {}, priority = {}) {
  const targetOpening = openingKey(priority.openingKey || priority.openingName || "");
  const targetColour = text(priority.playerColour || priority.player_colour).toLowerCase();
  const byId = new Map();
  reportGames(report).forEach((game, index) => {
    const normalized = normaliseGame(game, report, index);
    byId.set(normalized.id, mergeGame(byId.get(normalized.id), normalized));
  });
  const openingMatches = [...byId.values()].filter((game) => !targetOpening || game.openingKey === targetOpening);
  const eligible = openingMatches.filter((game) => !targetColour || game.userColour === targetColour);
  return { eligible, openingMatches, targetColour };
}

export function buildTrainingReviewSelection(report = {}, priority = {}, priorityReason = null, limit = 3) {
  const { eligible, openingMatches } = trainingReviewCandidates(report, priority);
  const difficultReview = priorityReason?.kind === "reliable_weakness" || /repair|weak|problem/.test(text(priority.actionType || priority.action_type).toLowerCase());
  const resultRank = { Loss: 0, Draw: 1, Win: 2 };
  const ranked = eligible
    .sort((left, right) => {
      const usable = Number(Boolean(right.pgn || right.sourceUrl)) - Number(Boolean(left.pgn || left.sourceUrl));
      if (usable) return usable;
      if (difficultReview) {
        const result = (resultRank[left.result] ?? 3) - (resultRank[right.result] ?? 3);
        if (result) return result;
      }
      return (Date.parse(right.playedAt) || 0) - (Date.parse(left.playedAt) || 0) || left.id.localeCompare(right.id);
    })
  const recoverableRanked = ranked.filter((game) => Boolean(game.moves.length || game.sourceUrl));
  const selectedCandidates = recoverableRanked.length ? recoverableRanked : ranked;
  const games = selectedCandidates.slice(0, Math.max(0, Math.min(3, limit)))
    .map((game) => {
      const knownResult = ["Win", "Draw", "Loss"].includes(game.result) ? game.result.toLowerCase() : "analysed game";
      return {
        ...game,
        hasInternalReplay: game.moves.length > 0,
        whySelected: difficultReview
          ? `A recent ${knownResult} in the report's evidence-supported repair priority.`
          : `A recent analysed example matching ${game.opening || priority.openingName || "the selected opening"} as ${game.userColour || "the selected colour"}; it is not presented as proof of weakness.`,
      };
    });
  const suppliedRelevant = Number(priority.evidenceCount ?? priority.relevantGames);
  const relevantGamesFound = Number.isFinite(suppliedRelevant) && suppliedRelevant >= 0 ? Math.round(suppliedRelevant) : openingMatches.length;
  const validPgn = eligible.filter((game) => Boolean(parseReplayPgn(game.pgn))).length;
  const validExternalUrls = eligible.filter((game) => Boolean(game.sourceUrl)).length;
  const recoverable = recoverableRanked.length;
  return {
    games,
    funnel: {
      relevantGamesFound,
      usableOpeningAndColour: eligible.length,
      validPgn,
      validExternalUrls,
      recoverable,
      selected: recoverable ? games.length : 0,
      known: Number.isFinite(suppliedRelevant),
    },
  };
}

export function selectTrainingReviewGames(report = {}, priority = {}, priorityReason = null, limit = 3) {
  return buildTrainingReviewSelection(report, priority, priorityReason, limit).games;
}

export function trainingReviewFunnelCopy(funnel = {}, openingName = "this opening") {
  if (!funnel.known) return "";
  const relevant = Number(funnel.relevantGamesFound || 0);
  const recoverable = Number(funnel.recoverable || 0);
  const opening = formatOpeningNameForDisplay(openingName);
  if (relevant <= 0) return "";
  if (recoverable === 1) return `OpeningFit found ${relevant} relevant ${opening} game${relevant === 1 ? "" : "s"}. One contained enough recoverable move or source data for this review.`;
  if (recoverable > 1) return `OpeningFit found ${relevant} relevant ${opening} game${relevant === 1 ? "" : "s"}. ${recoverable} contained enough recoverable move or source data; up to three are supplied here.`;
  return `OpeningFit found ${relevant} relevant ${opening} game${relevant === 1 ? "" : "s"}, but this saved report does not retain recoverable move or source data for them.`;
}

export function recentGamesReviewCopy(count) {
  const total = Math.max(0, Number(count) || 0);
  if (total === 1) return "Review this recent game";
  return `Review these ${total} recent games`;
}

function numberedLine(moves, limit = 8) {
  return moves.slice(0, limit).map((move, index) => `${index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : ""}${move}`).join(" ");
}

export function deriveKnownLineConcept(game = {}, openingName = "") {
  const parsed = parseReplayPgn(game.pgn);
  if (!parsed?.moves?.length || parsed.moves.length < 4) return null;
  const moves = parsed.moves;
  const line = numberedLine(moves);
  const opening = formatOpeningNameForDisplay(openingName || game.opening);
  const caroKann = /caro[- ]kann/i.test(opening) && moves[0] === "e4" && moves[1] === "c6";
  const exchangeStructure = caroKann && moves.includes("exd5") && moves.includes("cxd5");
  const plan = exchangeStructure
    ? "Develop the light-squared bishop actively, support the centre, and castle before committing to a pawn break."
    : "Complete development, support the centre, and castle before committing to a structure-specific pawn break.";
  return {
    line,
    moves: moves.slice(0, 8),
    prompt: `In the supplied game, the opening began ${line}. Which plan is the most reliable next priority?`,
    plan,
    why: exchangeStructure
      ? "After the central exchange, piece activity and king safety are reliable priorities because the pawn structure alone does not justify an immediate universal break."
      : "The recorded moves establish the line, but not a forced continuation. Coordinating development and king safety keeps the plan valid across several resulting structures.",
    watchFor: exchangeStructure
      ? "Watch whether the light-squared bishop can develop outside the pawn chain before choosing a central or kingside break."
      : "Watch how the centre and piece placement develop before choosing a variation-specific pawn break.",
    alternatives: [
      "Play e5 immediately regardless of development or Black's setup",
      "Start a flank pawn attack before completing development",
    ],
    alternativeExplanations: [
      "An e5 break can be thematic, but the supplied moves do not show that it is ready without preparation.",
      "A flank attack commits time before the centre, development and king safety are settled.",
    ],
    suggestedResponsePlan: plan,
  };
}

export function trainingReviewRequirements({ games = [], reviewedGameIds = [], conceptEngaged = false, responsePlan = "" } = {}) {
  const actionableGames = games.filter((game) => game.hasInternalReplay || game.sourceUrl);
  const reviewComplete = actionableGames.length === 0 || reviewedGameIds.some((id) => actionableGames.some((game) => game.id === id));
  const planComplete = Boolean(text(responsePlan));
  return { reviewComplete, conceptComplete: Boolean(conceptEngaged), planComplete, complete: reviewComplete && Boolean(conceptEngaged) && planComplete };
}

export function restoredTrainingSessionStep(progress = {}) {
  if (text(progress.responsePlan) || Number(progress.attempts) > 0 || progress.completion || progress.revealed) return "commit";
  if (Array.isArray(progress.reviewedGameIds) && progress.reviewedGameIds.length) return "concept";
  return "focus";
}

export function nextTrainingSessionStep(current, event) {
  const transitions = {
    "focus:continue": "review",
    "review:reviewed": "concept",
    "review:no_source": "concept",
    "concept:engaged": "commit",
  };
  return transitions[`${current}:${event}`] || current;
}
