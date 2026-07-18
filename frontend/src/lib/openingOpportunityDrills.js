import { Chess } from "chess.js";
import { findOpeningLine } from "../data/openings.ts";

export const OPENING_OPPORTUNITY_PROGRESS_KEY = "openingFit:openingOpportunityProgress:v1";
export const OPENING_OPPORTUNITY_DRILL_TYPES = Object.freeze(["position_choice", "line_replay", "concept_check"]);

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const text = (value) => String(value ?? "").trim();
const cleanSan = (value) => text(value).replace(/[!?+#]+$/g, "").replaceAll("0-0-0", "O-O-O").replaceAll("0-0", "O-O");

function openingLabel(opportunity = {}) {
  const known = findOpeningLine(opportunity.openingName || opportunity.openingId || "");
  if (known?.name) return known.name;
  return text(opportunity.openingName || opportunity.openingId || "Opening position")
    .replaceAll("-", " ")
    .replace(/\bdefense\b/i, "Defence")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function conceptForIssue(issueType = "") {
  const concepts = {
    early_queen_movement: {
      plan: "Develop a new minor piece and keep the queen from becoming a tempo target.",
      distractors: ["Move the queen again to create a threat", "Start a wing pawn attack before development"],
    },
    delayed_castling: {
      plan: "Complete development and secure the king before starting a side operation.",
      distractors: ["Keep the king central so both rooks stay flexible", "Make another pawn move regardless of the centre"],
    },
    missing_development_move: {
      plan: "Bring an undeveloped knight or bishop toward the centre.",
      distractors: ["Move an already-developed piece again", "Look for an immediate queen raid"],
    },
    pawn_structure_mistake: {
      plan: "Preserve the intended pawn structure until the supported pawn break is ready.",
      distractors: ["Push the nearest pawn immediately", "Trade pawns only to simplify"],
    },
    unsuitable_opening_plan: {
      plan: "Follow the opening's recorded development plan before changing the structure.",
      distractors: ["Create threats with the queen first", "Copy the opponent's last move"],
    },
    left_known_opening_territory: {
      plan: "Return to the familiar development plan and identify the first decision point.",
      distractors: ["Memorise every possible opponent move", "Abandon the opening after this game"],
    },
    intended_repertoire_move_missed: {
      plan: "Recall the intended repertoire move and the position cue that triggers it.",
      distractors: ["Choose a new opening immediately", "Play the most forcing-looking move without checking the plan"],
    },
  };
  return concepts[issueType] || {
    plan: "Finish development, protect the king, and follow the recorded opening plan.",
    distractors: ["Move the queen until a tactic appears", "Push several pawns before developing"],
  };
}

function safeChess(fen) {
  try {
    return { chess: new Chess(fen), error: "" };
  } catch {
    return { chess: null, error: "The saved position is not valid enough to load on the board." };
  }
}

function legalMove(chess, candidate) {
  if (!chess || !candidate) return null;
  const copy = new Chess(chess.fen());
  try {
    const move = typeof candidate === "object" ? copy.move(candidate) : copy.move(text(candidate));
    return move ? { from: move.from, to: move.to, promotion: move.promotion || "", san: move.san } : null;
  } catch {
    return null;
  }
}

function sameMove(left, right) {
  return Boolean(left && right && left.from === right.from && left.to === right.to && (left.promotion || "") === (right.promotion || ""));
}

function sourceGame(opportunity, report = {}) {
  const gameId = text(opportunity.gameId || opportunity.game_id);
  const games = [...list(report.recentGames), ...list(report.recent_games), ...list(report.openingGames), ...list(report.opening_games)];
  const game = games.find((item) => [item?.gameId, item?.game_id, item?.id, item?.url].map(text).includes(gameId));
  return game ? { id: gameId, url: text(game.url), opening: text(game.opening || game.name) } : gameId ? { id: gameId, url: "", opening: "" } : null;
}

function lineMoves(opportunity = {}) {
  return list(opportunity.expectedMoves || opportunity.expected_moves || opportunity.lineMoves || opportunity.line_moves || opportunity.expectedLine || opportunity.expected_line).map(cleanSan).filter(Boolean).slice(0, 12);
}

export function buildOpeningOpportunityDrill(opportunity, report = {}) {
  if (!opportunity || !text(opportunity.opportunityId || opportunity.opportunity_id)) {
    return { valid: false, error: "This training opportunity is missing its identifier.", type: "concept_check" };
  }
  const side = text(opportunity.side).toLowerCase() === "black" ? "black" : "white";
  const fen = text(opportunity.positionFen || opportunity.position_fen);
  const moves = lineMoves(opportunity);
  const recommendedMove = cleanSan(opportunity.recommendedMove || opportunity.recommended_move);
  const acceptedMoves = [...new Set([recommendedMove, ...list(opportunity.alternativeMoves || opportunity.alternative_moves), ...list(opportunity.recognisedTranspositions || opportunity.recognizedTranspositions || opportunity.acceptedMoves || opportunity.accepted_moves)].map(cleanSan).filter(Boolean))];
  const concept = conceptForIssue(text(opportunity.issueType || opportunity.issue_type));
  const hasMoveAnswer = Boolean(recommendedMove);
  const type = moves.length >= 2 ? "line_replay" : hasMoveAnswer ? "position_choice" : "concept_check";
  const position = fen ? safeChess(fen) : { chess: null, error: "The saved opportunity does not include a board position." };
  if (type !== "concept_check" && !position.chess) {
    return { valid: false, error: position.error, type, opportunityId: text(opportunity.opportunityId || opportunity.opportunity_id), side, orientation: side };
  }
  if (position.chess && position.chess.turn() !== (side === "black" ? "b" : "w") && type !== "concept_check") {
    return { valid: false, error: `The saved position does not have ${side === "black" ? "Black" : "White"} to move.`, type, opportunityId: text(opportunity.opportunityId || opportunity.opportunity_id), side, orientation: side };
  }
  if (type === "position_choice" && !legalMove(position.chess, recommendedMove)) {
    return { valid: false, error: "The saved recommended move is not legal in this position.", type, opportunityId: text(opportunity.opportunityId || opportunity.opportunity_id), side, orientation: side };
  }
  if (type === "line_replay") {
    const validation = new Chess(position.chess.fen());
    for (const move of moves) {
      if (!legalMove(validation, move)) return { valid: false, error: "The saved replay line contains a move that is not legal from this position.", type, opportunityId: text(opportunity.opportunityId || opportunity.opportunity_id), side, orientation: side };
      validation.move(move);
    }
  }
  const correctOptionId = "plan";
  return {
    valid: true,
    id: `opportunity-drill:${text(opportunity.opportunityId || opportunity.opportunity_id)}`,
    opportunityId: text(opportunity.opportunityId || opportunity.opportunity_id),
    type,
    openingId: text(opportunity.openingId || opportunity.opening_id),
    openingName: openingLabel(opportunity),
    side,
    orientation: side,
    initialFen: position.chess?.fen() || null,
    prompt: type === "position_choice" ? "Play the best supported repertoire move." : type === "line_replay" ? `Replay the short line as ${side === "black" ? "Black" : "White"}.` : "Which plan best fits this position?",
    explanation: text(opportunity.explanation) || "Review the opening decision shown by your analysed game.",
    evidence: text(opportunity.evidence),
    confidence: opportunity.confidence ?? null,
    recurrenceCount: Number(opportunity.recurrenceCount || opportunity.recurrence_count || 1),
    playedMove: cleanSan(opportunity.playedMove || opportunity.played_move),
    recommendedMove: recommendedMove || null,
    acceptedMoves,
    expectedMoves: moves,
    plan: concept.plan,
    conceptOptions: [
      { id: correctOptionId, label: concept.plan },
      { id: "alternative-a", label: concept.distractors[0] },
      { id: "alternative-b", label: concept.distractors[1] },
    ],
    correctOptionId,
    sourceGame: sourceGame(opportunity, report),
  };
}

export function createOpeningOpportunitySession(drill, previous = {}) {
  return {
    drillId: drill?.id || "",
    fen: drill?.initialFen || null,
    lineIndex: 0,
    attempts: Number(previous.attempts || 0),
    success: Boolean(previous.success),
    completion: Boolean(previous.completion),
    repeatedFailure: Boolean(previous.repeatedFailure),
    revealed: false,
    lastPlayed: null,
    opponentMoves: [],
    feedback: null,
  };
}

function feedbackFor(drill, played, success, extra = {}) {
  return {
    success,
    played: played || "No move recorded",
    recommended: drill.recommendedMove || drill.plan,
    why: drill.explanation,
    gameReference: drill.sourceGame?.id ? `This position came from your analysed game ${drill.sourceGame.id}.` : "",
    ...extra,
  };
}

function attemptedLabel(attempted) {
  if (typeof attempted === "string") return attempted;
  if (attempted?.from && attempted?.to) return `${attempted.from}–${attempted.to}`;
  return "Move not recorded";
}

export function attemptOpeningOpportunityMove(drill, session, attempted) {
  if (!drill?.valid || !["position_choice", "line_replay"].includes(drill.type)) return { ...session, feedback: { success: false, error: drill?.error || "This move drill is not available." } };
  const position = safeChess(session.fen);
  if (!position.chess) return { ...session, feedback: { success: false, error: position.error } };
  const userColour = drill.side === "black" ? "b" : "w";
  if (position.chess.turn() !== userColour) return { ...session, feedback: { success: false, error: "OpeningFit is applying the opponent reply. Try again when it is your turn." } };
  const played = legalMove(position.chess, attempted);
  const attempts = session.attempts + 1;
  if (!played) return { ...session, attempts, repeatedFailure: attempts >= 3, feedback: feedbackFor(drill, attemptedLabel(attempted), false, { error: "That move is not legal in the saved position." }) };

  const expectedText = drill.type === "line_replay" ? drill.expectedMoves[session.lineIndex] : drill.recommendedMove;
  const expected = legalMove(position.chess, expectedText);
  const alternatives = drill.acceptedMoves.map((move) => legalMove(position.chess, move)).filter(Boolean);
  const transposition = !sameMove(played, expected) && alternatives.some((move) => sameMove(played, move));
  if (!sameMove(played, expected) && !transposition) {
    return { ...session, attempts, lastPlayed: played.san, repeatedFailure: attempts >= 3, feedback: feedbackFor(drill, played.san, false, { recommended: expectedText || drill.plan, error: "That is legal, but it does not match the supported repertoire move or recognised transposition yet." }) };
  }

  position.chess.move({ from: played.from, to: played.to, promotion: played.promotion || undefined });
  if (drill.type === "position_choice" || transposition) {
    return { ...session, fen: position.chess.fen(), attempts, success: true, completion: true, repeatedFailure: Boolean(session.repeatedFailure || attempts >= 3), lastPlayed: played.san, feedback: feedbackFor(drill, played.san, true, { recommended: expectedText || drill.plan, transposition }) };
  }

  let lineIndex = session.lineIndex + 1;
  const opponentMoves = [];
  while (drill.expectedMoves[lineIndex] && position.chess.turn() !== userColour) {
    const opponent = legalMove(position.chess, drill.expectedMoves[lineIndex]);
    if (!opponent) return { ...session, fen: position.chess.fen(), attempts, lastPlayed: played.san, feedback: feedbackFor(drill, played.san, false, { error: "The saved opponent continuation could not be played legally." }) };
    position.chess.move({ from: opponent.from, to: opponent.to, promotion: opponent.promotion || undefined });
    opponentMoves.push(opponent.san);
    lineIndex += 1;
  }
  const complete = lineIndex >= drill.expectedMoves.length;
  return { ...session, fen: position.chess.fen(), lineIndex, attempts, success: complete, completion: complete, repeatedFailure: Boolean(session.repeatedFailure || attempts >= 3), lastPlayed: played.san, opponentMoves, feedback: feedbackFor(drill, played.san, true, { recommended: expectedText || drill.plan, opponentMoves, stepComplete: !complete }) };
}

export function answerOpeningConcept(drill, session, optionId) {
  if (!drill?.valid || drill.type !== "concept_check") return { ...session, feedback: { success: false, error: drill?.error || "This concept drill is not available." } };
  const attempts = session.attempts + 1;
  const option = drill.conceptOptions.find((item) => item.id === optionId);
  const success = optionId === drill.correctOptionId;
  return { ...session, attempts, success, completion: success, repeatedFailure: Boolean(session.repeatedFailure || (!success && attempts >= 3)), lastPlayed: option?.label || "No answer selected", feedback: feedbackFor(drill, option?.label, success, { error: success ? "" : "That plan is possible in other positions, but it is not the supported focus here." }) };
}

export function revealOpeningOpportunityAnswer(drill, session) {
  const answer = drill.type === "line_replay" ? drill.expectedMoves?.[session.lineIndex] : drill.recommendedMove || drill.plan;
  return { ...session, revealed: true, feedback: feedbackFor(drill, session.lastPlayed || "Answer requested", false, { recommended: answer, revealed: true }) };
}

export function updateOpeningOpportunityProgress(progress = {}, drill, session, now = new Date()) {
  const current = progress[drill.id] || {};
  return {
    ...progress,
    [drill.id]: {
      attempts: Number(session.attempts || 0),
      success: Boolean(session.success || current.success),
      completion: Boolean(session.completion || current.completion),
      lastPractised: new Date(now).toISOString(),
      repeatedFailure: Boolean(session.repeatedFailure),
    },
  };
}

export function loadOpeningOpportunityProgress(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem?.(OPENING_OPPORTUNITY_PROGRESS_KEY) || "{}") || {}; } catch { return {}; }
}

export function saveOpeningOpportunityProgress(progress, storage = globalThis.localStorage) {
  try { storage?.setItem?.(OPENING_OPPORTUNITY_PROGRESS_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
