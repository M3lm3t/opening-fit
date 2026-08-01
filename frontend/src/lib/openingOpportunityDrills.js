import { Chess } from "chess.js";
import { findOpeningLine } from "../data/openings.ts";
import { formatOpeningNameForDisplay } from "./openingNamePresentation.js";

export const OPENING_OPPORTUNITY_PROGRESS_KEY = "openingFit:openingOpportunityProgress:v1";
export const OPENING_OPPORTUNITY_DRILL_TYPES = Object.freeze(["position_choice", "position_review", "line_replay", "concept_check"]);

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const text = (value) => String(value ?? "").trim();
const cleanSan = (value) => text(value).replace(/[!?+#]+$/g, "").replaceAll("0-0-0", "O-O-O").replaceAll("0-0", "O-O");

function openingLabel(opportunity = {}) {
  const known = findOpeningLine(opportunity.openingName || opportunity.openingId || "");
  if (known?.name) return formatOpeningNameForDisplay(known.name);
  return formatOpeningNameForDisplay(text(opportunity.openingName || opportunity.openingId || "Opening position")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()));
}

function conceptForIssue(issueType = "") {
  const concepts = {
    early_queen_movement: {
      plan: "Develop a new minor piece and keep the queen from becoming a tempo target.",
      distractors: ["Use another queen move to increase pressure on the centre", "Gain kingside space with a pawn move before developing another piece"],
    },
    delayed_castling: {
      plan: "Complete development and secure the king before starting a side operation.",
      distractors: ["Keep the king central while waiting for the centre to clarify", "Gain queenside space before connecting the rooks"],
    },
    missing_development_move: {
      plan: "Bring an undeveloped knight or bishop toward the centre.",
      distractors: ["Reposition an active piece to improve it further", "Clarify the central pawn tension before developing another piece"],
    },
    pawn_structure_mistake: {
      plan: "Preserve the intended pawn structure until the supported pawn break is ready.",
      distractors: ["Use the thematic pawn break immediately to gain space", "Release the central tension now to simplify the structure"],
    },
    unsuitable_opening_plan: {
      plan: "Complete development, keep the centre supported, and choose a pawn break only when the position justifies it.",
      distractors: ["Commit to a pawn break before finishing development", "Trade the centre immediately regardless of the piece placement"],
    },
    left_known_opening_territory: {
      plan: "Return to the familiar development plan and identify the first decision point.",
      distractors: ["Choose the most forcing continuation and calculate from there", "Simplify into a familiar structure even if it changes the opening plan"],
    },
    intended_repertoire_move_missed: {
      plan: "Recall the intended repertoire move and the position cue that triggers it.",
      distractors: ["Prefer a forcing alternative that creates an immediate threat", "Use a natural developing move and aim to transpose later"],
    },
  };
  return concepts[issueType] || {
    plan: "Develop the minor pieces, keep the centre supported, and secure the king before starting a flank operation.",
    distractors: ["Gain flank space first and delay castling until the structure is fixed", "Resolve the central tension first, then decide where each minor piece belongs"],
  };
}

function exerciseConcept(opportunity = {}, openingName = "", side = "white") {
  const known = opportunity.knownLineConcept || opportunity.known_line_concept;
  if (known?.line && known?.plan && known?.why && Array.isArray(known.alternatives) && known.alternatives.length >= 2) {
    return {
      plan: text(known.plan),
      question: text(known.prompt),
      explanation: text(known.why),
      watchFor: text(known.watchFor),
      knownLine: text(known.line),
      suggestedResponsePlan: text(known.suggestedResponsePlan || known.plan),
      distractors: known.alternatives.slice(0, 2).map(text),
      distractorExplanations: list(known.alternativeExplanations).slice(0, 2).map(text),
    };
  }
  if (/caro[- ]kann/i.test(openingName) && side === "white") {
    return {
      plan: "Develop the kingside, support the centre, and castle before committing to a variation-specific pawn break.",
      question: "With the precise Caro-Kann variation unknown, which White plan is the safest general setup priority?",
      explanation: "Because the exact variation is unknown, avoid committing to a pawn break that only works in one structure. Complete development, support the centre, and castle before choosing a variation-specific plan.",
      distractors: [
        "Prepare e5 immediately, regardless of Black's setup or White's development",
        "Exchange on d5 at once in every Caro-Kann position to simplify",
      ],
      distractorExplanations: [
        "An e5 break can be thematic in some structures, but it is not automatically sound before the variation and piece placement are known.",
        "Exchanging on d5 is a legitimate choice in some lines, but treating it as compulsory ignores the position and variation.",
      ],
    };
  }
  const base = conceptForIssue(text(opportunity.issueType || opportunity.issue_type));
  return {
    ...base,
    question: "Which plan best supports sound opening development in this setup?",
    explanation: "The best general plan coordinates development, central control, and king safety without claiming a variation-specific move is forced.",
    distractorExplanations: [
      "This can be playable in a specific position, but it commits before the development and centre are understood.",
      "This may suit another structure, but it is not a safe default without position-specific evidence.",
    ],
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

function reportGames(report = {}) {
  return [
    ...list(report.analysisGameIndex), ...list(report.analysis_game_index),
    ...list(report.recentGames), ...list(report.recent_games),
    ...list(report.openingGames), ...list(report.opening_games), ...list(report.games),
  ];
}

function sourceGame(opportunity, report = {}) {
  const gameId = text(opportunity.gameId || opportunity.game_id);
  const games = reportGames(report);
  const game = games.find((item) => [item?.gameId, item?.game_id, item?.id, item?.url].map(text).includes(gameId));
  return game ? { id: gameId, game } : null;
}

function normalizedFen(value) {
  return text(value).split(/\s+/).slice(0, 4).join(" ");
}

function normalizedPlayer(value) {
  return text(value).toLowerCase();
}

function pgnHeaders(pgn) {
  const headers = {};
  for (const match of text(pgn).matchAll(/^\[([^\s]+)\s+"([^"]*)"\]$/gm)) headers[match[1].toLowerCase()] = match[2];
  return headers;
}

function reconstructPosition(pgn, side, moveNumber) {
  try {
    const parsed = new Chess();
    parsed.loadPgn(pgn);
    const history = parsed.history();
    const targetPly = (moveNumber - 1) * 2 + (side === "black" ? 1 : 0);
    if (targetPly < 0 || targetPly >= history.length) return null;
    const replay = new Chess();
    for (let index = 0; index < targetPly; index += 1) replay.move(history[index]);
    return replay.fen();
  } catch {
    return null;
  }
}

function validatedSourceUrl(url, platform) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "";
    const host = parsed.hostname.toLowerCase();
    if (platform === "chess.com" && (host === "chess.com" || host.endsWith(".chess.com")) && /\/game\//.test(parsed.pathname)) return parsed.href;
    if (platform === "lichess" && (host === "lichess.org" || host.endsWith(".lichess.org")) && /^\/[a-zA-Z0-9]{8,12}/.test(parsed.pathname)) return parsed.href;
  } catch {
    return "";
  }
  return "";
}

export function normalizeExerciseProvenance(opportunity = {}, report = {}) {
  const fictional = Boolean(report.sampleMode || report.sample_mode || report.source === "sample_fixture" || report.isDemo);
  const general = {
    kind: "general_opening_setup",
    fictional,
    label: fictional ? "Fictional general opening setup" : "General opening setup",
    contextLabel: fictional ? "Illustrative example based on the fictional report's training priority" : "Based on your report's training priority",
    disclaimer: fictional
      ? "This illustrative position belongs to the fictional example, not to the visitor or a particular user game."
      : "This position is illustrative and is not claimed to come from a particular game of yours.",
    sourceGame: null,
  };
  if (fictional || opportunity.generalSetup === true || opportunity.general_setup === true) return general;

  const match = sourceGame(opportunity, report);
  const game = match?.game;
  const gameId = text(opportunity.gameId || opportunity.game_id);
  const fen = text(opportunity.positionFen || opportunity.position_fen);
  const moveNumber = Number(opportunity.moveNumber || opportunity.move_number);
  const side = text(opportunity.side).toLowerCase() === "black" ? "black" : "white";
  const pgn = text(game?.pgn || game?.PGN || game?.rawPgn || game?.raw_pgn);
  const reportUsername = normalizedPlayer(report.username || report.playerName || report.player_name || report.playerProfile?.username || report.player_profile?.username);
  const platformValue = text(report.platform || report.importPlatform || report.import_platform).toLowerCase();
  const platform = platformValue.includes("lichess") ? "lichess" : platformValue.includes("chess") ? "chess.com" : "";
  const headers = pgnHeaders(pgn);
  const expectedOwner = normalizedPlayer(side === "white" ? game?.white_username || game?.whiteUsername || headers.white : game?.black_username || game?.blackUsername || headers.black);
  const reconstructed = reconstructPosition(pgn, side, moveNumber);
  if (!gameId || !game || !pgn || !platform || !reportUsername || expectedOwner !== reportUsername || !Number.isInteger(moveNumber) || moveNumber < 1 || !fen || !reconstructed || normalizedFen(reconstructed) !== normalizedFen(fen)) return general;

  const opponent = text(side === "white" ? game.black_username || game.blackUsername || headers.black : game.white_username || game.whiteUsername || headers.white);
  const playedAt = text(game.played_at || game.playedAt || game.played_date || game.playedDate || game.end_time || game.endTime || headers.date);
  return {
    kind: "own_game_position",
    fictional: false,
    label: "From one of your analysed games",
    contextLabel: "Board position reconstructed from the recorded PGN",
    disclaimer: "",
    sourceGame: {
      id: gameId,
      url: validatedSourceUrl(text(game.url), platform),
      opponent: opponent || null,
      playedAt: playedAt || null,
      result: text(game.result || headers.result) || null,
      opening: text(game.opening || game.name || opportunity.openingName || opportunity.opening_name) || null,
      moveNumber,
      platform,
    },
  };
}

function lineMoves(opportunity = {}) {
  return list(opportunity.expectedMoves || opportunity.expected_moves || opportunity.lineMoves || opportunity.line_moves || opportunity.expectedLine || opportunity.expected_line).map(cleanSan).filter(Boolean).slice(0, 12);
}

export function buildOpeningOpportunityDrill(opportunity, report = {}) {
  if (!opportunity || !text(opportunity.opportunityId || opportunity.opportunity_id)) {
    return { valid: false, error: "This training opportunity is missing its identifier.", type: "concept_check" };
  }
  const side = text(opportunity.side).toLowerCase() === "black" ? "black" : "white";
  const provenance = normalizeExerciseProvenance(opportunity, report);
  const ownGamePosition = provenance.kind === "own_game_position";
  const fen = ownGamePosition ? text(opportunity.positionFen || opportunity.position_fen) : "";
  const moves = ownGamePosition ? lineMoves(opportunity) : [];
  const recommendedMove = ownGamePosition ? cleanSan(opportunity.recommendedMove || opportunity.recommended_move) : "";
  const acceptedMoves = ownGamePosition
    ? [...new Set([recommendedMove, ...list(opportunity.alternativeMoves || opportunity.alternative_moves), ...list(opportunity.recognisedTranspositions || opportunity.recognizedTranspositions || opportunity.acceptedMoves || opportunity.accepted_moves)].map(cleanSan).filter(Boolean))]
    : [];
  const resolvedOpeningName = openingLabel(opportunity);
  const concept = exerciseConcept(opportunity, resolvedOpeningName, side);
  const hasMoveAnswer = Boolean(recommendedMove);
  const diagnosisOwnedPosition = Boolean(opportunity.diagnosisId || opportunity.diagnosis_id);
  const type = moves.length >= 2 ? "line_replay" : hasMoveAnswer ? "position_choice" : ownGamePosition && fen && diagnosisOwnedPosition ? "position_review" : "concept_check";
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
  const generalSetup = provenance.kind === "general_opening_setup";
  return {
    valid: true,
    id: `opportunity-drill:${text(opportunity.opportunityId || opportunity.opportunity_id)}`,
    opportunityId: text(opportunity.opportunityId || opportunity.opportunity_id),
    type,
    openingId: text(opportunity.openingId || opportunity.opening_id),
    openingName: resolvedOpeningName,
    side,
    orientation: side,
    initialFen: position.chess?.fen() || null,
    prompt: type === "position_choice" ? "What would you play here?" : type === "position_review" ? "Choose one legal continuation to test from your repeated position." : type === "line_replay" ? `Replay the short line as ${side === "black" ? "Black" : "White"}.` : concept.question,
    explanation: text(opportunity.explanation) || "Review the opening decision shown by your analysed game.",
    evidence: text(opportunity.evidence),
    confidence: opportunity.confidence ?? null,
    recurrenceCount: Number(opportunity.recurrenceCount || opportunity.recurrence_count || 1),
    playedMove: cleanSan(opportunity.playedMove || opportunity.played_move),
    recommendedMove: recommendedMove || null,
    acceptedMoves,
    expectedMoves: moves,
    plan: concept.plan,
    answerExplanation: concept.explanation,
    knownLine: concept.knownLine || "",
    structureExplanation: concept.explanation,
    watchForNextTime: concept.watchFor || "Exact play depends on the resulting structure and piece placement.",
    suggestedResponsePlan: concept.suggestedResponsePlan || concept.plan,
    conceptOptions: [
      { id: correctOptionId, label: concept.plan, explanation: concept.explanation },
      { id: "alternative-a", label: concept.distractors[0], explanation: concept.distractorExplanations[0] },
      { id: "alternative-b", label: concept.distractors[1], explanation: concept.distractorExplanations[1] },
    ],
    correctOptionId,
    sourceGame: provenance.sourceGame,
    provenance,
    priorityReason: opportunity.trainingPriorityReason || opportunity.training_priority_reason || null,
    generalSetup,
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
  if (!drill?.valid || !["position_choice", "position_review", "line_replay"].includes(drill.type)) return { ...session, feedback: { success: false, error: drill?.error || "This move drill is not available." } };
  const position = safeChess(session.fen);
  if (!position.chess) return { ...session, feedback: { success: false, error: position.error } };
  const userColour = drill.side === "black" ? "b" : "w";
  if (position.chess.turn() !== userColour) return { ...session, feedback: { success: false, error: "OpeningFit is applying the opponent reply. Try again when it is your turn." } };
  const played = legalMove(position.chess, attempted);
  const attempts = session.attempts + 1;
  if (!played) return { ...session, attempts, repeatedFailure: attempts >= 3, feedback: feedbackFor(drill, attemptedLabel(attempted), false, { error: "That move is not legal in the saved position." }) };

  if (drill.type === "position_review") {
    position.chess.move({ from: played.from, to: played.to, promotion: played.promotion || undefined });
    return {
      ...session,
      fen: position.chess.fen(),
      attempts,
      success: true,
      completion: true,
      lastPlayed: played.san,
      feedback: feedbackFor(drill, played.san, true, {
        recommended: "Your chosen legal continuation",
        why: "OpeningFit recorded this as a legal move to test; it is not labelled best or objectively correct.",
      }),
    };
  }

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
  return { ...session, attempts, success, completion: success, repeatedFailure: Boolean(session.repeatedFailure || (!success && attempts >= 3)), lastPlayed: option?.label || "No answer selected", feedback: feedbackFor(drill, option?.label, success, { why: option?.explanation || drill.answerExplanation, error: success ? "" : option?.explanation || "That plan may fit another position, but it is not the supported focus here." }) };
}

export function revealOpeningOpportunityAnswer(drill, session) {
  const answer = drill.type === "line_replay" ? drill.expectedMoves?.[session.lineIndex] : drill.recommendedMove || drill.plan;
  return { ...session, revealed: true, feedback: feedbackFor(drill, session.lastPlayed || "Answer requested", false, { recommended: answer, why: drill.answerExplanation, revealed: true }) };
}

export function updateOpeningOpportunityProgress(progress = {}, drill, session, now = new Date()) {
  const current = progress[drill.id] || {};
  return {
    ...progress,
    [drill.id]: {
      attempts: Number(session.attempts || 0),
      success: Boolean(session.success || current.success),
      completion: Boolean(session.completion || current.completion),
      revealed: Boolean(session.revealed || current.revealed),
      lastPractised: new Date(now).toISOString(),
      repeatedFailure: Boolean(session.repeatedFailure),
      reviewedGameIds: Array.isArray(current.reviewedGameIds) ? current.reviewedGameIds : [],
      responsePlan: text(current.responsePlan),
    },
  };
}

export function updateOpeningOpportunityReviewProgress(progress = {}, drillId, changes = {}, now = new Date()) {
  const current = progress[drillId] || {};
  return {
    ...progress,
    [drillId]: {
      ...current,
      reviewedGameIds: [...new Set(list(changes.reviewedGameIds ?? current.reviewedGameIds).map(text))],
      responsePlan: text(changes.responsePlan ?? current.responsePlan),
      lastPractised: new Date(now).toISOString(),
    },
  };
}

export function loadOpeningOpportunityProgress(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem?.(OPENING_OPPORTUNITY_PROGRESS_KEY) || "{}") || {}; } catch { return {}; }
}

export function saveOpeningOpportunityProgress(progress, storage = globalThis.localStorage) {
  try { storage?.setItem?.(OPENING_OPPORTUNITY_PROGRESS_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
