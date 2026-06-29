import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import ChessPositionBoard from "./ChessPositionBoard";
import { BoardThemeStatusLabel, BoardThemeToggle, useBoardTheme } from "./boardThemes.jsx";
import { findOpeningPracticePack, openingPracticePacks } from "../data/openingPracticeLines";
import { OPENINGS, normaliseOpeningKey, searchOpenings } from "../data/openings";
import { fetchOpeningFitCloudState, saveOpeningFitCloudState } from "./openingFitCloudState";
import { useAuth } from "../context/AuthDataProvider";
import {
  buildWeakestLineTrainingCompletionEvent,
  saveWeakestLineTrainingEvent,
} from "../services/weakestLineTraining";

const TRAINING_PROGRESS_KEY = "openingFit:openingTrainingProgress";

const OPENING_FILTERS = [
  { key: "white", label: "White openings" },
  { key: "black", label: "Black openings" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
  { key: "e4", label: "Against e4" },
  { key: "d4", label: "Against d4" },
  { key: "solid", label: "Solid" },
  { key: "attacking", label: "Attacking" },
  { key: "system", label: "System openings" },
];

function getOpeningName(opening) {
  if (typeof opening === "string") return opening;
  return opening?.name || opening?.opening || opening?.label || "Unknown opening";
}

function normaliseLineSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBestLineIndex(lines = [], focusLine = "") {
  const query = normaliseLineSearch(focusLine);
  if (!query) return 0;

  const exactIndex = lines.findIndex((line) => {
    const haystack = normaliseLineSearch([line.name, line.moves?.join(" "), line.idea].filter(Boolean).join(" "));
    return haystack.includes(query) || query.includes(normaliseLineSearch(line.name));
  });

  return exactIndex >= 0 ? exactIndex : 0;
}

function hasMatchingLine(lines = [], focusLine = "") {
  const query = normaliseLineSearch(focusLine);
  if (!query) return true;

  return lines.some((line) => {
    const haystack = normaliseLineSearch([line.name, line.moves?.join(" "), line.idea].filter(Boolean).join(" "));
    return haystack.includes(query) || query.includes(normaliseLineSearch(line.name));
  });
}

function formatMoveNumber(index) {
  const moveNumber = Math.floor(index / 2) + 1;
  return index % 2 === 0 ? `${moveNumber}.` : `${moveNumber}...`;
}

function cleanSan(value) {
  return String(value)
    .replace(/[+#?!]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function stripMoveNumbers(value) {
  return String(value || "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");
}

function splitMoveText(value) {
  return stripMoveNumbers(value)
    .split(/\s+/)
    .map((move) => move.trim())
    .filter((move) => move && !move.startsWith("$"));
}

function normaliseMoveToken(token, game) {
  const clean = String(token || "").trim();
  if (!clean) return null;

  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(clean)) {
    const move = game.move({
      from: clean.slice(0, 2).toLowerCase(),
      to: clean.slice(2, 4).toLowerCase(),
      promotion: clean[4]?.toLowerCase() || "q",
    });
    return move?.san || null;
  }

  const move = game.move(clean);
  return move?.san || null;
}

function parseExactMoveSequence(opening = {}, trainingSet = null) {
  const rawMoves = [
    ...(Array.isArray(opening.moves) ? opening.moves : []),
    ...(Array.isArray(opening.sanMoves) ? opening.sanMoves : []),
    ...(Array.isArray(opening.san_moves) ? opening.san_moves : []),
    ...(Array.isArray(opening.uciMoves) ? opening.uciMoves : []),
    ...(Array.isArray(opening.uci_moves) ? opening.uci_moves : []),
  ].filter(Boolean);
  const rawText = [
    trainingSet?.startingMoveSequence,
    trainingSet?.starting_move_sequence,
    opening.moveLine,
    opening.move_line,
    opening.lineMoves,
    opening.line_moves,
    opening.movesText,
    opening.moves_text,
  ].filter(Boolean).join(" ");
  const tokens = rawMoves.length ? rawMoves.map(String) : splitMoveText(rawText);
  const game = new Chess();
  const moves = [];

  for (const token of tokens) {
    try {
      const san = normaliseMoveToken(token, game);
      if (!san) break;
      moves.push(san);
    } catch {
      break;
    }
  }

  return moves;
}

function exactLineName(opening = {}, trainingSet = null, fallbackName = "") {
  return (
    trainingSet?.lineName ||
    trainingSet?.line_name ||
    trainingSet?.variationName ||
    trainingSet?.variation_name ||
    opening.variation ||
    opening.line ||
    fallbackName ||
    "Exact weak line"
  );
}

function buildGameToMove(moves, moveCount) {
  const game = new Chess();

  moves.slice(0, moveCount).forEach((move) => {
    try {
      game.move(move);
    } catch {
      // Ignore broken saved move.
    }
  });

  return game;
}

function inferPracticeSide(pack, line) {
  const explicitSide =
    line?.practiceSide ||
    line?.side ||
    pack?.practiceSide ||
    pack?.opening?.practiceSide ||
    pack?.opening?.playerColor;

  if (explicitSide === "black" || explicitSide === "white") return explicitSide;
  if (pack?.opening?.color === "black") return "black";
  if (pack?.opening?.color === "white") return "white";

  const text = [pack?.key, ...(pack?.aliases || []), line?.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    /\b(defen[cs]e|sicilian|french|caro|scandinavian|pirc|dutch)\b/.test(text) ||
    text.includes("king's indian")
  ) {
    return "black";
  }

  return "white";
}

function inferPracticeSideFromOpening(opening) {
  const text = [
    opening?.practiceSide,
    opening?.side,
    opening?.colour,
    opening?.color,
    opening?.slotKey,
    opening?.slotLabel,
    opening?.context,
    opening?.contextLabel,
    opening?.repertoireContext,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("black")) return "black";
  if (text.includes("white")) return "white";
  return null;
}

function userColorForPracticeSide(practiceSide) {
  return practiceSide === "black" ? "b" : "w";
}

function buildPracticeState(moves, moveCount, practiceSide, stopOnUserTurn = false) {
  const game = buildGameToMove(moves, moveCount);
  let nextIndex = Math.min(moveCount, moves.length);
  const userColor = userColorForPracticeSide(practiceSide);

  if (stopOnUserTurn) {
    while (moves[nextIndex] && game.turn() !== userColor) {
      try {
        const opponentMove = game.move(moves[nextIndex]);
        if (!opponentMove) break;
        nextIndex += 1;
      } catch {
        break;
      }
    }
  }

  return {
    fen: game.fen(),
    moveIndex: nextIndex,
  };
}

function loadLocalTrainingProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRAINING_PROGRESS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalTrainingProgress(progress) {
  try {
    localStorage.setItem(TRAINING_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Practice should keep working even when browser storage is unavailable.
  }
}

function lineKey(openingId, lineName) {
  return `${openingId}:${normaliseOpeningKey(lineName)}`;
}

function getOpeningId(pack, fallbackName) {
  return pack?.opening?.id || normaliseOpeningKey(fallbackName || pack?.key || "opening");
}

function buildTrainingProgress(progress, pack, activeOpeningName, selectedLine) {
  const openingId = getOpeningId(pack, activeOpeningName);
  const key = lineKey(openingId, selectedLine.name);
  const completedLines = {
    ...(progress.completedLines || {}),
    [key]: {
      openingId,
      openingName: pack?.opening?.name || activeOpeningName,
      lineName: selectedLine.name,
      completedAt: new Date().toISOString(),
    },
  };
  const completedForOpening = Object.values(completedLines).filter(
    (item) => item?.openingId === openingId
  ).length;

  return {
    ...progress,
    completedLines,
    progressByOpening: {
      ...(progress.progressByOpening || {}),
      [openingId]: {
        openingId,
        openingName: pack?.opening?.name || activeOpeningName,
        completed: completedForOpening,
        total: pack?.lines?.length || 1,
        lastPracticedAt: new Date().toISOString(),
      },
    },
  };
}

function isWeakestLineTraining(opening) {
  return opening?.source === "weakest-line" || opening?.trainingSet?.source === "weakest-line" || opening?.training_set?.source === "weakest-line";
}

function getMasteryRows(data = {}) {
  const metrics = data.retentionMetrics || data.retention_metrics || {};
  const rows = data.openingMastery || data.opening_mastery || metrics.openingMastery || metrics.opening_mastery;
  return Array.isArray(rows) ? rows : [];
}

function masteryScoreForOpening(data = {}, openingName = "") {
  const target = normaliseOpeningKey(openingName);
  if (!target) return null;
  const row = getMasteryRows(data).find((item) => normaliseOpeningKey(item?.opening || item?.name || "") === target);
  const value = row?.masteryScore ?? row?.mastery_score;
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
}

function matchesFilter(opening, filter) {
  if (filter === "white") return opening.color === "white" || opening.color === "both";
  if (filter === "black") return opening.color === "black" || opening.color === "both";
  if (["beginner", "intermediate", "advanced"].includes(filter)) {
    return opening.difficulty === filter;
  }
  if (filter === "e4") return opening.tags.includes("e4-response") || opening.tags.includes("e4");
  if (filter === "d4") return opening.tags.includes("d4-response") || opening.tags.includes("d4");
  return opening.tags.includes(filter);
}

function explainMove(line, moves, index) {
  if (line?.moveIdeas?.[index]) return line.moveIdeas[index];

  const game = buildGameToMove(moves, index);

  try {
    const move = game.move(moves[index]);
    const piece = move?.piece;
    const san = move?.san || moves[index];

    if (index === 0 && san === "e4") {
      return "Best practical first move for many open games: it claims central space, opens the bishop and queen, and asks Black to solve the centre immediately.";
    }
    if (index === 0 && san === "d4") {
      return "Takes central space with a protected pawn and usually leads to stable structures where your pieces can develop naturally.";
    }
    if (index === 0 && san === "c4") {
      return "Controls d5 from the side, keeps the centre flexible, and often gives you a reversed-Sicilian style setup with an extra tempo.";
    }
    if (index === 0 && san === "Nf3") {
      return "Develops a piece, controls e5 and d4, and keeps your central pawn choice flexible until you see Black's setup.";
    }
    if (move?.captured) {
      return "This capture resolves central tension or wins time. It works when the recapture still leaves your pieces active and your king safe.";
    }
    if (san.includes("+")) {
      return "The check gains forcing value: your opponent must respond, which can help you develop or win time for the next part of the plan.";
    }
    if (move?.flags?.includes("k") || san === "O-O" || san === "O-O-O") {
      return "Gets the king safe and connects the rooks, so the next moves can focus on the centre instead of emergency defence.";
    }
    if (piece === "p" && ["e", "d", "c", "f"].includes(move?.to?.[0])) {
      return "Changes the central structure. This is best when it controls key squares, supports development, or prepares a useful pawn break.";
    }
    if (piece === "n" || piece === "b") {
      return "Develops a piece toward useful central or attacking squares, which is usually stronger than moving the same piece twice early.";
    }
    if (piece === "q") {
      return "Uses the queen for a concrete purpose. It works only if the queen creates pressure without becoming an easy target for tempo-gaining moves.";
    }
    if (piece === "r") {
      return "Places a rook where an open file, pawn break, or central tension can matter, instead of leaving it passive in the corner.";
    }
  } catch {
    // Fall through to generic guidance.
  }

  return "This is the main-line move because it supports the opening plan. Check the centre, development, and king safety before moving on.";
}

function sideLabel(side) {
  return side === "black" ? "Black" : "White";
}

function firstMoveForSide(moves = [], side = "white") {
  const parity = side === "black" ? 1 : 0;
  return moves.find((_, index) => index % 2 === parity) || "";
}

function moveRoleLabel(line, moves, index) {
  const explanation = explainMove(line, moves, index).toLowerCase();
  const move = String(moves[index] || "");

  if (line?.moveLabels?.[index]) return line.moveLabels[index];
  if (explanation.includes("castle") || move.includes("O-O")) return "Key idea";
  if (explanation.includes("capture") || explanation.includes("resolves central tension")) return "Decision point";
  if (explanation.includes("centre") || explanation.includes("central") || explanation.includes("pawn break")) return "Key idea";
  if (explanation.includes("queen") || explanation.includes("target")) return "Decision point";
  if (explanation.includes("develop")) return "Key idea";
  return "Why this move?";
}

function buildLinePlan({ line, pack, moves, practiceSide, focusLine, trainingSet, usingExactWeakLine }) {
  const userSide = sideLabel(practiceSide);
  const opponentSide = practiceSide === "black" ? "White" : "Black";
  const userFirstMove = firstMoveForSide(moves, practiceSide);
  const opponentFirstMove = firstMoveForSide(moves, practiceSide === "black" ? "white" : "black");
  const openingIdeas = Array.isArray(pack?.opening?.ideas) ? pack.opening.ideas.filter(Boolean) : [];
  const trap = Array.isArray(pack?.opening?.traps) ? pack.opening.traps[0] : null;
  const lineIdea = line?.idea || trainingSet?.shortExplanation || trainingSet?.short_explanation || "";
  const weakLineReason =
    trainingSet?.shortExplanation ||
    trainingSet?.short_explanation ||
    line?.flagReason ||
    line?.reason ||
    "";

  return {
    whitePlan:
      practiceSide === "white"
        ? lineIdea || openingIdeas[0] || `Use ${userFirstMove || "the first moves"} to develop, fight for the centre, and reach a familiar setup.`
        : `Expect White to use ${opponentFirstMove || "the first moves"} to claim space, develop quickly, and ask Black to solve the centre.`,
    blackPlan:
      practiceSide === "black"
        ? lineIdea || openingIdeas[0] || `Use ${userFirstMove || "your first moves"} to challenge White's centre, complete development, and reach a playable structure.`
        : `Black is trying to challenge the centre, develop safely, and avoid giving White an easy attack.`,
    whyItMatters:
      weakLineReason ||
      (usingExactWeakLine || focusLine
        ? "This is where your games most often move away from your intended setup."
        : "This line gives you a repeatable plan before the middlegame starts."),
    turningPoint:
      trap?.warning ||
      line?.finishIdea ||
      trainingSet?.recommendedCorrectContinuation ||
      trainingSet?.recommended_correct_continuation ||
      `The key decision is when ${userSide} chooses whether to keep developing or change the centre.`,
    userSide,
    opponentSide,
  };
}

export default function OpeningPracticeLinesPanel({
  opening,
  onClose,
  user = null,
  data = null,
  featured = false,
  showBrowser = true,
  heading = "",
  focusLine = "",
}) {
  const { recordActivity } = useAuth();
  const openingName = getOpeningName(opening);
  const trainingSet = opening?.trainingSet || opening?.training_set || null;
  const { boardTheme, setBoardTheme } = useBoardTheme();
  const [activeOpeningName, setActiveOpeningName] = useState(openingName);
  const basePack = useMemo(() => findOpeningPracticePack(activeOpeningName), [activeOpeningName]);
  const exactMoves = useMemo(() => parseExactMoveSequence(opening, trainingSet), [opening, trainingSet]);
  const exactPracticePack = useMemo(() => {
    if (activeOpeningName !== openingName || exactMoves.length < 2) return null;

    const lineName = exactLineName(opening, trainingSet, focusLine);
    return {
      key: `exact-${normaliseOpeningKey(openingName)}-${normaliseOpeningKey(lineName)}`,
      opening: {
        id: `exact-${normaliseOpeningKey(openingName)}`,
        name: openingName,
        color: inferPracticeSideFromOpening(opening) || basePack?.opening?.color || "white",
        difficulty: trainingSet?.difficulty || basePack?.opening?.difficulty || "custom",
        ideas: [
          trainingSet?.shortExplanation ||
            trainingSet?.short_explanation ||
            opening.selectedReason ||
            opening.selected_reason ||
            opening.reason ||
            opening.flagReason ||
            "This is the exact weak line selected from your report.",
        ].filter(Boolean),
        traps: [],
      },
      practiceSide: inferPracticeSideFromOpening(opening) || basePack?.practiceSide,
      lines: [
        {
          name: lineName,
          moves: exactMoves,
          idea:
            trainingSet?.shortExplanation ||
            trainingSet?.short_explanation ||
            opening.selectedReason ||
            opening.selected_reason ||
            opening.reason ||
            opening.flagReason ||
            "This exact move sequence came from your weak-line data.",
          finishIdea:
            trainingSet?.recommendedCorrectContinuation ||
            trainingSet?.recommended_correct_continuation ||
            "You reached the saved weak-line position. Review the plan from here.",
          side: inferPracticeSideFromOpening(opening) || undefined,
          practiceSide: inferPracticeSideFromOpening(opening) || undefined,
          source: "exact-weak-line",
        },
      ],
    };
  }, [activeOpeningName, basePack, exactMoves, focusLine, opening, openingName, trainingSet]);
  const pack = exactPracticePack || basePack;
  const usingExactWeakLine = Boolean(exactPracticePack);
  const fallbackExplanation = useMemo(() => {
    if (!trainingSet && !focusLine && !opening?.weakLine) return "";
    if (usingExactWeakLine) return "";
    if (!exactMoves.length) {
      return "Exact moves were not saved for this weak line, so OpeningFit loaded the closest available opening practice instead.";
    }
    return "The saved weak-line moves could not be played legally from the starting position, so OpeningFit loaded the closest available opening practice instead.";
  }, [exactMoves.length, focusLine, opening?.weakLine, trainingSet, usingExactWeakLine]);

  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [fen, setFen] = useState(new Chess().fen());
  const [status, setStatus] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [feedbackSquare, setFeedbackSquare] = useState(null);
  const [openingSearch, setOpeningSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [trainingProgress, setTrainingProgress] = useState(() => loadLocalTrainingProgress());
  const [progressStatus, setProgressStatus] = useState(user?.id ? "Syncing practice progress..." : "Progress saved on this device");
  const [completionNotice, setCompletionNotice] = useState("");
  const feedbackTimerRef = useRef(null);

  const selectedLine = pack?.lines?.[selectedLineIndex];
  const moves = useMemo(() => selectedLine?.moves || [], [selectedLine]);
  const exactFocusLineFound = useMemo(
    () => usingExactWeakLine || hasMatchingLine(pack?.lines || [], focusLine),
    [focusLine, pack, usingExactWeakLine]
  );
  const requestedPracticeSide = useMemo(() => inferPracticeSideFromOpening(opening), [opening]);
  const practiceSide = useMemo(() => {
    if (requestedPracticeSide && activeOpeningName === openingName) return requestedPracticeSide;
    return inferPracticeSide(pack, selectedLine);
  }, [activeOpeningName, openingName, pack, requestedPracticeSide, selectedLine]);
  const userColor = userColorForPracticeSide(practiceSide);
  const expectedMove = moves[moveIndex];
  const isComplete = Boolean(pack) && moveIndex >= moves.length;
  const progressPercent = moves.length ? Math.round((moveIndex / moves.length) * 100) : 0;
  const completedMoves = Math.min(moveIndex, moves.length);
  const currentGame = useMemo(() => new Chess(fen), [fen]);
  const currentTurn = currentGame.turn();
  const isUsersTurn = currentTurn === userColor;
  const moveExplanation = useMemo(
    () =>
      !isComplete
        ? explainMove(selectedLine, moves, moveIndex)
        : selectedLine?.finishIdea || "You reached the target position. Review the plan, not just the move order.",
    [isComplete, moveIndex, moves, selectedLine]
  );
  const linePlan = useMemo(
    () => buildLinePlan({ line: selectedLine, pack, moves, practiceSide, focusLine, trainingSet, usingExactWeakLine }),
    [focusLine, moves, pack, practiceSide, selectedLine, trainingSet, usingExactWeakLine]
  );
  const criticalMoveIndex = useMemo(() => {
    if (!moves.length) return -1;
    const explicit = Number(selectedLine?.criticalMoveIndex ?? selectedLine?.critical_move_index);
    if (Number.isFinite(explicit) && explicit >= 0 && explicit < moves.length) return explicit;
    if (usingExactWeakLine) return Math.max(0, moves.length - 1);
    return Math.min(moves.length - 1, Math.max(2, Math.floor(moves.length * 0.6)));
  }, [moves.length, selectedLine, usingExactWeakLine]);
  const activeOpeningId = pack ? getOpeningId(pack, activeOpeningName) : normaliseOpeningKey(activeOpeningName);
  const currentLineKey = selectedLine ? lineKey(activeOpeningId, selectedLine.name) : null;
  const completedLineCount = Object.values(trainingProgress.completedLines || {}).filter(
    (item) => item?.openingId === activeOpeningId
  ).length;
  const isSelectedLineSaved = Boolean(currentLineKey && trainingProgress.completedLines?.[currentLineKey]);
  const nextCompletedLineCount = Math.min(pack?.lines?.length || 0, completedLineCount + (isSelectedLineSaved ? 0 : 1));
  const filteredOpenings = useMemo(() => {
    const searched = searchOpenings(openingSearch, OPENINGS).filter(
      (item) => item.appearsInTraining !== false
    );

    if (!activeFilters.length) return searched.slice(0, 24);

    return searched
      .filter((item) => activeFilters.every((filter) => matchesFilter(item, filter)))
      .slice(0, 24);
  }, [activeFilters, openingSearch]);

  useEffect(() => {
    setActiveOpeningName(openingName);
  }, [openingName]);

  useEffect(() => {
    return () => window.clearTimeout(feedbackTimerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      const localProgress = loadLocalTrainingProgress();
      setTrainingProgress(localProgress);

      if (!user?.id) {
        setProgressStatus("Progress saved on this device");
        return;
      }

      try {
        const state = await fetchOpeningFitCloudState(user, data || {});
        if (cancelled) return;

        const cloudProgress = state?.coach_progress?.openingTraining;
        if (cloudProgress && typeof cloudProgress === "object") {
          const merged = {
            ...localProgress,
            ...cloudProgress,
            completedLines: {
              ...(localProgress.completedLines || {}),
              ...(cloudProgress.completedLines || {}),
            },
            progressByOpening: {
              ...(localProgress.progressByOpening || {}),
              ...(cloudProgress.progressByOpening || {}),
            },
          };
          setTrainingProgress(merged);
          saveLocalTrainingProgress(merged);
        }

        setProgressStatus("Progress synced to your OpeningFit account");
      } catch {
        if (!cancelled) setProgressStatus("Using local practice progress until sync reconnects");
      }
    }

    loadProgress();

    return () => {
      cancelled = true;
    };
  }, [user, data]);

  useEffect(() => {
    setSelectedLineIndex(0);
    const initialState = buildPracticeState(pack?.lines?.[0]?.moves || [], 0, inferPracticeSide(pack, pack?.lines?.[0]), true);
    setMoveIndex(initialState.moveIndex);
    setFen(initialState.fen);
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }, [activeOpeningName, pack]);

  useEffect(() => {
    if (!pack?.lines?.length || !focusLine) return;
    const nextLineIndex = getBestLineIndex(pack.lines, focusLine);
    const nextLine = pack.lines[nextLineIndex];
    const initialState = buildPracticeState(nextLine?.moves || [], 0, inferPracticeSide(pack, nextLine), true);
    setSelectedLineIndex(nextLineIndex);
    setMoveIndex(initialState.moveIndex);
    setFen(initialState.fen);
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }, [focusLine, pack]);

  useEffect(() => {
    const state = buildPracticeState(moves, moveIndex, practiceSide, true);
    if (state.moveIndex !== moveIndex) {
      setMoveIndex(state.moveIndex);
      setFen(state.fen);
      return;
    }

    setFen(state.fen);
  }, [moves, moveIndex, practiceSide]);

  if (!opening) return null;

  if (!pack) {
    const suggestedPacks = openingPracticePacks.slice(0, 8);

    return (
      <section
        className={`card practiceLinesPanel ${featured ? "trainPracticePanel" : ""}`}
        id="practice-main-lines"
      >
        <div className="practiceLinesHeader">
          <div>
            <p className="eyebrow">{featured ? "Train your next move" : "Practice pack"}</p>
            <h2>{featured ? heading || "Practice this line" : openingName}</h2>
            {featured ? <p className="practiceOpeningMeta">{openingName}</p> : null}
          </div>

          {onClose ? (
            <button className="practiceCloseButton" type="button" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>

        <div className="practiceComingSoon">
          <h3>No exact pack for {openingName} yet</h3>
          <p>
            {focusLine
              ? `Practice mode is ready for this opening, but no exact move line was found yet. Target line: ${focusLine}.`
              : "Practice mode is ready for this opening, but no exact move line was found yet."}
          </p>
          {trainingSet ? (
            <div className="weakestLineTrainingSet">
              <span>Weakest-line training set</span>
              <strong>{trainingSet.lineName || trainingSet.line_name || trainingSet.variationName || trainingSet.variation_name || openingName}</strong>
              <p>{trainingSet.shortExplanation || trainingSet.short_explanation}</p>
              <small>
                {trainingSet.side ? `${trainingSet.side} side` : "Side unknown"} · {trainingSet.difficulty || "easy"} · {trainingSet.source || "report"}
              </small>
            </div>
          ) : null}

          <div className="supportedOpeningGrid">
            {suggestedPacks.map((suggestedPack) => {
              const label = suggestedPack.aliases?.[0] || suggestedPack.key;

              return (
                <button
                  type="button"
                  key={suggestedPack.key}
                  onClick={() => setActiveOpeningName(label)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  function resetBoard() {
    const initialState = buildPracticeState(moves, 0, practiceSide, true);
    setMoveIndex(initialState.moveIndex);
    setFen(initialState.fen);
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }

  function showIllegalFeedback(squareName, message) {
    setFeedbackSquare(squareName);
    setStatus(message);

    window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackSquare(null);
    }, 260);
  }

  async function saveTrainingProgress(nextProgress, completionEvent = null) {
    setTrainingProgress(nextProgress);
    saveLocalTrainingProgress(nextProgress);

    if (!user?.id) {
      setProgressStatus("Progress saved on this device");
      return;
    }

    setProgressStatus("Saving practice progress...");

    try {
      const state = await fetchOpeningFitCloudState(user, data || {});
      const coachProgress =
        state?.coach_progress && typeof state.coach_progress === "object"
          ? state.coach_progress
          : {};

      await saveOpeningFitCloudState(user, data || {}, {
        coach_progress: {
          ...coachProgress,
          openingTraining: nextProgress,
          weakestLineTrainingHistory: completionEvent
            ? [completionEvent, ...(coachProgress.weakestLineTrainingHistory || [])].slice(0, 25)
            : coachProgress.weakestLineTrainingHistory,
        },
      });

      setProgressStatus("Progress synced to your OpeningFit account");
    } catch {
      setProgressStatus("Saved locally. Cloud sync failed.");
    }
  }

  async function recordWeakestLineCompletion() {
    if (!isWeakestLineTraining(opening)) return null;

    const event = buildWeakestLineTrainingCompletionEvent(opening, selectedLine);
    const beforeScore = masteryScoreForOpening(data, event.opening);
    const afterScore = beforeScore === null ? null : Math.min(100, beforeScore + 2);
    const eventWithUser = {
      ...event,
      ...(user?.id ? { user_id: user.id, profile_id: user.id } : {}),
      mastery_before: beforeScore,
      mastery_after: afterScore,
    };

    saveWeakestLineTrainingEvent(eventWithUser);

    const trainingSet = opening?.trainingSet || opening?.training_set || {};
    const startPoint = opening?.moveLine || opening?.move_line || trainingSet.startingMoveSequence || trainingSet.starting_move_sequence || selectedLine?.moves?.join(" ") || selectedLine?.name || "this key position";
    const nextFocus =
      trainingSet.recommendedCorrectContinuation ||
      trainingSet.recommended_correct_continuation ||
      selectedLine?.finishIdea ||
      "repeat the plan once more before judging the results";
    setCompletionNotice(`You practised the key position after ${startPoint}. Next time, focus on ${nextFocus}.`);

    if (user?.id && recordActivity) {
      try {
        await recordActivity("weakest_line_training_completed", {
          created_at: eventWithUser.created_at,
          opening: eventWithUser.opening,
          variation: eventWithUser.variation,
          training_type: "weakest-line",
          completed: true,
          user_id: user.id,
          profile_id: user.id,
          points: 80,
          dedupe_key: eventWithUser.key,
        });
      } catch (error) {
        console.warn("OpeningFit could not save weakest-line completion activity.", error);
        if (!completionNotice) setCompletionNotice("Training saved.");
      }
    }

    return eventWithUser;
  }

  async function markLineComplete() {
    if (!pack || !selectedLine || isSelectedLineSaved) return;
    const nextProgress = buildTrainingProgress(
      trainingProgress,
      pack,
      activeOpeningName,
      selectedLine
    );
    const completionEvent = await recordWeakestLineCompletion();
    const targetDrills = Number(opening?.targetDrills || opening?.target_drills || opening?.trainingTarget?.targetDrills || 3) || 3;
    const completedForMission = Math.min(targetDrills, nextCompletedLineCount);
    if (!completionEvent) {
      setCompletionNotice(
        `Nice - you completed ${completedForMission} of ${targetDrills} drills. Next: play a rapid game and revisit this position.`
      );
    }
    saveTrainingProgress(nextProgress, completionEvent);
  }

  function toggleFilter(filter) {
    setActiveFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter]
    );
  }

  function chooseLine(index) {
    setSelectedLineIndex(index);
    const nextLine = pack?.lines?.[index];
    const initialState = buildPracticeState(nextLine?.moves || [], 0, inferPracticeSide(pack, nextLine), true);
    setMoveIndex(initialState.moveIndex);
    setFen(initialState.fen);
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }

  function playExpectedMove() {
    if (!expectedMove || isComplete) return;

    const game = buildGameToMove(moves, moveIndex);

    try {
      const move = game.move(expectedMove);
      let nextIndex = moveIndex + 1;
      while (moves[nextIndex] && game.turn() !== userColor) {
        const opponentMove = game.move(moves[nextIndex]);
        if (!opponentMove) break;
        nextIndex += 1;
      }

      setFen(game.fen());
      setMoveIndex(nextIndex);
      setStatus(`Correct. ${explainMove(selectedLine, moves, moveIndex)}`);
      setShowHint(false);
      setSelectedSquare(null);
      setFeedbackSquare(null);
      if (move && nextIndex >= moves.length) markLineComplete();
    } catch {
      setStatus("This practice line could not play that move. Check the saved line.");
    }
  }

  function undoMove() {
    let nextIndex = Math.max(0, moveIndex - 1);
    while (nextIndex > 0) {
      const game = buildGameToMove(moves, nextIndex);
      if (game.turn() === userColor) break;
      nextIndex -= 1;
    }

    const state = buildPracticeState(moves, nextIndex, practiceSide, true);

    setFen(state.fen);
    setMoveIndex(state.moveIndex);
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }

  function jumpToMove(index) {
    const state = buildPracticeState(moves, index, practiceSide, true);
    setFen(state.fen);
    setMoveIndex(state.moveIndex);
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }

  function handlePieceDrop(sourceSquare, targetSquare) {
    if (!expectedMove || isComplete) return false;

    const gameBeforeMove = new Chess(fen);
    if (gameBeforeMove.turn() !== userColor) {
      showIllegalFeedback(sourceSquare, `OpeningFit will play ${practiceSide === "black" ? "White" : "Black"}'s replies.`);
      setSelectedSquare(null);
      return false;
    }

    const sourcePiece = gameBeforeMove.get(sourceSquare);
    if (!sourcePiece || sourcePiece.color !== userColor) {
      showIllegalFeedback(sourceSquare, `Move only your ${practiceSide === "black" ? "Black" : "White"} pieces.`);
      setSelectedSquare(null);
      return false;
    }

    let expectedMoveObject = null;

    try {
      const gameAfterExpectedMove = new Chess(fen);
      expectedMoveObject = gameAfterExpectedMove.move(expectedMove);
    } catch {
      showIllegalFeedback(sourceSquare, "This practice line has a saved move that cannot be played.");
      setSelectedSquare(null);
      return false;
    }

    try {
      const attemptedMove = gameBeforeMove.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!attemptedMove) {
        showIllegalFeedback(targetSquare, "That move is not legal.");
        setSelectedSquare(null);
        return false;
      }

      const sameMove =
        attemptedMove.from === expectedMoveObject.from &&
        attemptedMove.to === expectedMoveObject.to &&
        cleanSan(attemptedMove.san) === cleanSan(expectedMoveObject.san);

      if (!sameMove) {
        showIllegalFeedback(
          targetSquare,
          `Not quite — try the repertoire move here. Hint: ${formatMoveNumber(moveIndex)} ${expectedMove}. ${moveExplanation}`
        );
        setShowHint(true);
        setSelectedSquare(null);
        return false;
      }

      let nextIndex = moveIndex + 1;
      while (moves[nextIndex] && gameBeforeMove.turn() !== userColor) {
        const opponentMove = gameBeforeMove.move(moves[nextIndex]);
        if (!opponentMove) break;
        nextIndex += 1;
      }

      setFen(gameBeforeMove.fen());
      setMoveIndex(nextIndex);
      setStatus(`Correct. ${explainMove(selectedLine, moves, moveIndex)}`);
      setShowHint(false);
      setSelectedSquare(null);
      setFeedbackSquare(null);
      if (nextIndex >= moves.length) markLineComplete();
      return true;
    } catch {
      showIllegalFeedback(targetSquare, "That move is not legal.");
      setSelectedSquare(null);
      return false;
    }
  }

  function handleSquareClick(squareName) {
    if (!expectedMove || isComplete) return;
    if (!isUsersTurn) {
      setStatus(`OpeningFit will play ${practiceSide === "black" ? "White" : "Black"}'s replies.`);
      return;
    }

    const piece = currentGame.get(squareName);

    if (!selectedSquare) {
      if (!piece || piece.color !== userColor) {
        setStatus("");
        return;
      }

      setSelectedSquare(squareName);
      setStatus("Choose the square this piece should move to.");
      return;
    }

    if (selectedSquare === squareName) {
      setSelectedSquare(null);
      setStatus("");
      return;
    }

    if (piece && piece.color === userColor) {
      setSelectedSquare(squareName);
      setStatus("Choose the square this piece should move to.");
      return;
    }

    handlePieceDrop(selectedSquare, squareName);
  }

  return (
    <section
      className={`card practiceLinesPanel ${featured ? "trainPracticePanel" : ""}`}
      id="practice-main-lines"
    >
      <div className="practiceLinesHeader">
        <div>
          <p className="eyebrow">{featured ? "Train your next move" : "Practice pack"}</p>
          <h2>{featured ? heading || "Practice this line" : pack.opening?.name || activeOpeningName}</h2>
          {pack.opening ? (
            <p className="practiceOpeningMeta">
              {featured ? `${pack.opening.name} · ` : ""}
              {pack.opening.eco ? `${pack.opening.eco} · ` : ""}
              {pack.opening.color} · {pack.opening.difficulty} · {completedLineCount}/{pack.lines.length} lines complete
              {focusLine ? ` · focus: ${focusLine}` : ""}
            </p>
          ) : null}
          <p className="practiceSideInstruction">
            {practiceSide === "black"
              ? "You play Black. The board is flipped and White will move first."
              : "You play White. Follow your recommended opening moves."}
          </p>
          {usingExactWeakLine ? (
            <p className="practiceExactLineNotice">
              Loaded the exact weak-line move sequence from your report.
            </p>
          ) : null}
          {fallbackExplanation ? (
            <p className="practiceMissingLineNotice">
              {fallbackExplanation}
            </p>
          ) : !exactFocusLineFound ? (
            <p className="practiceMissingLineNotice">
              Practice mode is ready for this opening, but no exact move line was found yet.
            </p>
          ) : null}
          {trainingSet ? (
            <div className="weakestLineTrainingSet">
              <span>Weakest-line training set</span>
              <strong>{trainingSet.lineName || trainingSet.line_name || selectedLine?.name || openingName}</strong>
              <p>{trainingSet.shortExplanation || trainingSet.short_explanation}</p>
              <small>
                {trainingSet.recommendedCorrectContinuation || trainingSet.recommended_correct_continuation
                  ? `Continue with ${trainingSet.recommendedCorrectContinuation || trainingSet.recommended_correct_continuation} · `
                  : ""}
                {trainingSet.difficulty || "easy"} · {trainingSet.source || "report"}
              </small>
            </div>
          ) : null}
        </div>

        {onClose ? (
          <button className="practiceCloseButton" type="button" onClick={onClose}>
            ×
          </button>
        ) : null}
      </div>

      <div className="practiceBoardLayout">
        <div className="practiceBoardColumn">
          <div className="boardThemeControls">
            <BoardThemeToggle boardTheme={boardTheme} onChange={setBoardTheme} />
            <BoardThemeStatusLabel boardTheme={boardTheme} />
          </div>
          <div className="practiceBoardWrap practice-board-shell">
            <ChessPositionBoard
              position={fen}
              orientation={practiceSide === "black" ? "black" : "white"}
              interactive={!isComplete}
              selectedSquare={selectedSquare}
              feedbackSquare={feedbackSquare}
              onPieceDrop={handlePieceDrop}
              onSquareClick={handleSquareClick}
            />
          </div>
        </div>

        <div className="practiceTrainerBox boardTrainerBox">
          <div>
            <p className="eyebrow">Current line</p>
            <h3>{selectedLine.name}</h3>
            <p>{selectedLine.idea}</p>
            <div className="lineSideBadge" aria-label={`You are practising as ${linePlan.userSide}`}>
              <span>You play {linePlan.userSide}</span>
              <small>{linePlan.opponentSide} replies are included</small>
            </div>
            {pack.opening?.ideas?.length ? (
              <ul className="practiceIdeaList">
                {pack.opening.ideas.slice(0, 3).map((idea) => (
                  <li key={idea}>{idea}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="positionPlanPanel" aria-label="Plan of the position">
            <div className="positionPlanHeader">
              <span>Plan of the position</span>
              <strong>{selectedLine.name}</strong>
            </div>
            <div className="positionPlanGrid">
              <article>
                <span>White's plan</span>
                <p>{linePlan.whitePlan}</p>
              </article>
              <article>
                <span>Black's plan</span>
                <p>{linePlan.blackPlan}</p>
              </article>
              <article>
                <span>Why this line matters</span>
                <p>{linePlan.whyItMatters}</p>
              </article>
              <article>
                <span>Critical decision</span>
                <p>{linePlan.turningPoint}</p>
              </article>
            </div>
          </div>

          <div className="practiceMoveWhy">
            <span>{isComplete ? "Target position" : "Why this move works"}</span>
            <p>{moveExplanation}</p>
          </div>

          <div className="practiceMovePrompt">
            {isComplete ? (
              <>
                <span>Complete</span>
                <strong>Line finished ✅</strong>
                <small>Nice work — you completed this practice line.</small>
              </>
            ) : (
              <>
                <span>{isUsersTurn ? `Your move as ${practiceSide === "black" ? "Black" : "White"}` : "OpeningFit reply"}</span>
                <strong>
                  {formatMoveNumber(moveIndex)} {showHint ? expectedMove : "?"}
                </strong>
                <small>
                  OpeningFit will play {practiceSide === "black" ? "White" : "Black"}'s replies. Move {moveIndex + 1} of {moves.length}
                </small>
              </>
            )}
          </div>

          {status ? <div className="practiceStatus">{status}</div> : null}
          {completionNotice ? <div className="practiceStatus practiceCompletionNotice">{completionNotice}</div> : null}

          {pack.opening?.traps?.length ? (
            <div className="practiceTrapBox">
              <span>Trap / mistake watch</span>
              <strong>{pack.opening.traps[0].name}</strong>
              <p>{pack.opening.traps[0].warning}</p>
            </div>
          ) : null}

          <div className="practiceControls boardPracticeControls">
            <button type="button" onClick={undoMove} disabled={moveIndex === 0}>
              Back
            </button>

            <button type="button" onClick={resetBoard}>
              Reset
            </button>

            <button type="button" onClick={() => setShowHint(true)} disabled={isComplete}>
              Hint
            </button>

            <button
              type="button"
              className="primaryPracticeControl"
              onClick={playExpectedMove}
              disabled={isComplete}
            >
              Show move
            </button>

            <button
              type="button"
              className="nextLineControl"
              onClick={() => {
                const nextIndex = selectedLineIndex + 1 >= pack.lines.length ? 0 : selectedLineIndex + 1;
                chooseLine(nextIndex);
              }}
            >
              Next line
            </button>
          </div>
        </div>
      </div>

      <div className="practiceLineChoices">
        {pack.lines.map((line, index) => (
          <button
            key={`${line.name}-${line.moves?.join("-") || index}`}
            type="button"
            className={`practiceLineChoice ${selectedLineIndex === index ? "active" : ""}`}
            onClick={() => chooseLine(index)}
          >
            <span>Line {index + 1}</span>
            <strong>{line.name}</strong>
            {trainingProgress.completedLines?.[lineKey(activeOpeningId, line.name)] ? (
              <small>Completed</small>
            ) : null}
          </button>
        ))}
      </div>

      <div className="practiceProgressBox">
        <div className="practiceProgressTop">
          <span>Practice progress</span>
          <strong>{completedMoves}/{moves.length} moves</strong>
        </div>

        <div className="practiceProgressTrack">
          <div
            className="practiceProgressFill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="practiceMoveList">
        {moves.map((move, index) => (
          <button
            key={`${move}-${index}`}
            type="button"
            className={`practiceMoveChip ${index < moveIndex ? "done" : ""} ${
              index === moveIndex ? "current" : ""
            } ${index === criticalMoveIndex ? "critical" : ""}`}
            onClick={() => jumpToMove(index)}
            aria-label={`${formatMoveNumber(index)} ${move}. ${index === criticalMoveIndex ? "Critical decision point. " : ""}${moveRoleLabel(selectedLine, moves, index)}`}
          >
            <span>{formatMoveNumber(index)}</span>
            {index < moveIndex || index === moveIndex || showHint ? move : "?"}
            {index === criticalMoveIndex ? <small>Decision</small> : null}
          </button>
        ))}
      </div>

      <div className="practiceMoveExplanationList">
        {moves.map((move, index) => (
          <article
            key={`${selectedLine.name}-${move}-${index}`}
            className={`practiceMoveExplanationItem ${
              index === moveIndex && !isComplete ? "current" : ""
            } ${index < moveIndex ? "done" : ""} ${index === criticalMoveIndex ? "critical" : ""}`}
          >
            <span className="moveIdeaTag">
              {index === criticalMoveIndex ? "Decision point" : moveRoleLabel(selectedLine, moves, index)}
            </span>
            <strong>
              {formatMoveNumber(index)} {move}
            </strong>
            <details>
              <summary>Why this move?</summary>
              <p>{explainMove(selectedLine, moves, index)}</p>
            </details>
          </article>
        ))}
      </div>

      {showBrowser ? (
        <div className="practiceOpeningBrowser">
          <div className="practiceSearchRow">
            <label>
              <span>Search openings</span>
              <input
                value={openingSearch}
                onChange={(event) => setOpeningSearch(event.target.value)}
                placeholder="Search name, ECO, tag, or moves..."
              />
            </label>
            <p>{progressStatus}</p>
          </div>

          <div className="practiceFilterRow" aria-label="Opening filters">
            {OPENING_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.key}
                className={activeFilters.includes(filter.key) ? "active" : ""}
                onClick={() => toggleFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="practiceOpeningGrid">
            {filteredOpenings.map((item) => {
              const progress = trainingProgress.progressByOpening?.[item.id];

              return (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === activeOpeningId ? "active" : ""}
                  onClick={() => setActiveOpeningName(item.name)}
                >
                  <span>{item.eco || item.color}</span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.difficulty} · {progress ? `${progress.completed}/${progress.total} complete` : item.tags.slice(0, 2).join(", ")}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
