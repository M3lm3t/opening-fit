import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import ChessPositionBoard from "./ChessPositionBoard";
import { BoardThemeStatusLabel, BoardThemeToggle, useBoardTheme } from "./boardThemes.jsx";
import { findOpeningPracticePack, openingPracticePacks } from "../data/openingPracticeLines";
import { OPENINGS, normaliseOpeningKey, searchOpenings } from "../data/openings";
import { fetchOpeningFitCloudState, saveOpeningFitCloudState } from "./openingFitCloudState";

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
  const openingName = getOpeningName(opening);
  const { boardTheme, setBoardTheme } = useBoardTheme();
  const [activeOpeningName, setActiveOpeningName] = useState(openingName);
  const pack = useMemo(() => findOpeningPracticePack(activeOpeningName), [activeOpeningName]);

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
  const feedbackTimerRef = useRef(null);

  const selectedLine = pack?.lines?.[selectedLineIndex];
  const moves = useMemo(() => selectedLine?.moves || [], [selectedLine]);
  const expectedMove = moves[moveIndex];
  const isComplete = Boolean(pack) && moveIndex >= moves.length;
  const progressPercent = moves.length ? Math.round((moveIndex / moves.length) * 100) : 0;
  const completedMoves = Math.min(moveIndex, moves.length);
  const currentGame = useMemo(() => new Chess(fen), [fen]);
  const currentTurn = currentGame.turn();
  const moveExplanation = useMemo(
    () =>
      !isComplete
        ? explainMove(selectedLine, moves, moveIndex)
        : selectedLine?.finishIdea || "You reached the target position. Review the plan, not just the move order.",
    [isComplete, moveIndex, moves, selectedLine]
  );
  const activeOpeningId = pack ? getOpeningId(pack, activeOpeningName) : normaliseOpeningKey(activeOpeningName);
  const currentLineKey = selectedLine ? lineKey(activeOpeningId, selectedLine.name) : null;
  const completedLineCount = Object.values(trainingProgress.completedLines || {}).filter(
    (item) => item?.openingId === activeOpeningId
  ).length;
  const isSelectedLineSaved = Boolean(currentLineKey && trainingProgress.completedLines?.[currentLineKey]);
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
    setMoveIndex(0);
    setFen(new Chess().fen());
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }, [activeOpeningName]);

  useEffect(() => {
    if (!pack?.lines?.length || !focusLine) return;
    setSelectedLineIndex(getBestLineIndex(pack.lines, focusLine));
    setMoveIndex(0);
    setFen(new Chess().fen());
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }, [focusLine, pack]);

  useEffect(() => {
    const game = buildGameToMove(moves, moveIndex);
    setFen(game.fen());
  }, [moves, moveIndex]);

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
              ? `Target weak line: ${focusLine}. Pick a working practice pack below while this exact variation is added.`
              : "Pick a working practice pack below. These boards are live now and cover common structures while this specific opening is added."}
          </p>

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
    setMoveIndex(0);
    setFen(new Chess().fen());
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

  async function saveTrainingProgress(nextProgress) {
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
        },
      });

      setProgressStatus("Progress synced to your OpeningFit account");
    } catch {
      setProgressStatus("Saved locally. Cloud sync failed.");
    }
  }

  function markLineComplete() {
    if (!pack || !selectedLine || isSelectedLineSaved) return;
    const nextProgress = buildTrainingProgress(
      trainingProgress,
      pack,
      activeOpeningName,
      selectedLine
    );
    saveTrainingProgress(nextProgress);
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
    setMoveIndex(0);
    setFen(new Chess().fen());
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }

  function playExpectedMove() {
    if (!expectedMove || isComplete) return;

    const game = buildGameToMove(moves, moveIndex);

    try {
      game.move(expectedMove);
      setFen(game.fen());
      setMoveIndex((current) => current + 1);
      setStatus(`Correct. ${explainMove(selectedLine, moves, moveIndex)}`);
      setShowHint(false);
      setSelectedSquare(null);
      setFeedbackSquare(null);
      if (moveIndex + 1 >= moves.length) markLineComplete();
    } catch {
      setStatus("This practice line could not play that move. Check the saved line.");
    }
  }

  function undoMove() {
    const nextIndex = Math.max(0, moveIndex - 1);
    const game = buildGameToMove(moves, nextIndex);

    setFen(game.fen());
    setMoveIndex(nextIndex);
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }

  function jumpToMove(index) {
    const game = buildGameToMove(moves, index);
    setFen(game.fen());
    setMoveIndex(index);
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }

  function handlePieceDrop(sourceSquare, targetSquare) {
    if (!expectedMove || isComplete) return false;

    const gameBeforeMove = new Chess(fen);
    const gameAfterExpectedMove = new Chess(fen);

    let expectedMoveObject = null;

    try {
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
          `Not quite. Hint: the move is ${formatMoveNumber(moveIndex)} ${expectedMove}. ${moveExplanation}`
        );
        setShowHint(true);
        setSelectedSquare(null);
        return false;
      }

      setFen(gameBeforeMove.fen());
      setMoveIndex((current) => current + 1);
      setStatus(`Correct. ${explainMove(selectedLine, moves, moveIndex)}`);
      setShowHint(false);
      setSelectedSquare(null);
      setFeedbackSquare(null);
      if (moveIndex + 1 >= moves.length) markLineComplete();
      return true;
    } catch {
      showIllegalFeedback(targetSquare, "That move is not legal.");
      setSelectedSquare(null);
      return false;
    }
  }

  function handleSquareClick(squareName) {
    if (!expectedMove || isComplete) return;

    const piece = currentGame.get(squareName);

    if (!selectedSquare) {
      if (!piece) {
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

    if (piece && piece.color === currentTurn) {
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
            {pack.opening?.ideas?.length ? (
              <ul className="practiceIdeaList">
                {pack.opening.ideas.slice(0, 3).map((idea) => (
                  <li key={idea}>{idea}</li>
                ))}
              </ul>
            ) : null}
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
                <span>Find the next move</span>
                <strong>
                  {formatMoveNumber(moveIndex)} {showHint ? expectedMove : "?"}
                </strong>
                <small>
                  {currentTurn === "w" ? "White" : "Black"} to move · Move {moveIndex + 1} of {moves.length}
                </small>
              </>
            )}
          </div>

          {status ? <div className="practiceStatus">{status}</div> : null}

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
            key={line.name}
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
            }`}
            onClick={() => jumpToMove(index)}
          >
            <span>{formatMoveNumber(index)}</span>
            {index < moveIndex || index === moveIndex || showHint ? move : "?"}
          </button>
        ))}
      </div>

      <div className="practiceMoveExplanationList">
        {moves.map((move, index) => (
          <article
            key={`${selectedLine.name}-${move}-${index}`}
            className={`practiceMoveExplanationItem ${
              index === moveIndex && !isComplete ? "current" : ""
            } ${index < moveIndex ? "done" : ""}`}
          >
            <strong>
              {formatMoveNumber(index)} {move}
            </strong>
            <p>{explainMove(selectedLine, moves, index)}</p>
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
