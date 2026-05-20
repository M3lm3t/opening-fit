import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import ChessPositionBoard from "./ChessPositionBoard";
import { findOpeningPracticePack } from "../data/openingPracticeLines";

function getOpeningName(opening) {
  if (typeof opening === "string") return opening;
  return opening?.name || opening?.opening || opening?.label || "Unknown opening";
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

export default function OpeningPracticeLinesPanel({ opening, onClose }) {
  const openingName = getOpeningName(opening);
  const pack = useMemo(() => findOpeningPracticePack(openingName), [openingName]);

  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [fen, setFen] = useState(new Chess().fen());
  const [status, setStatus] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState(null);

  const selectedLine = pack?.lines?.[selectedLineIndex];
  const moves = selectedLine?.moves || [];
  const expectedMove = moves[moveIndex];
  const isComplete = Boolean(pack) && moveIndex >= moves.length;
  const progressPercent = moves.length ? Math.round((moveIndex / moves.length) * 100) : 0;
  const completedMoves = Math.min(moveIndex, moves.length);
  const moveExplanation = !isComplete
    ? explainMove(selectedLine, moves, moveIndex)
    : selectedLine?.finishIdea || "You reached the target position. Review the plan, not just the move order.";

  useEffect(() => {
    setSelectedLineIndex(0);
    resetBoard();
  }, [openingName]);

  useEffect(() => {
    const game = buildGameToMove(moves, moveIndex);
    setFen(game.fen());
  }, [selectedLineIndex, moveIndex]);

  if (!opening) return null;

  if (!pack) {
    return (
      <section className="card practiceLinesPanel" id="practice-main-lines">
        <div className="practiceLinesHeader">
          <div>
            <p className="eyebrow">Practice pack</p>
            <h2>{openingName}</h2>
          </div>

          <button className="practiceCloseButton" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="practiceComingSoon">
          <h3>Practice pack coming soon</h3>
          <p>
            I have not added 3 main lines for this opening yet. Start with the common openings first,
            then we can keep expanding the library.
          </p>
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
  }

  function chooseLine(index) {
    setSelectedLineIndex(index);
    setMoveIndex(0);
    setFen(new Chess().fen());
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
  }

  function playExpectedMove() {
    if (!expectedMove || isComplete) return;

    const game = buildGameToMove(moves, moveIndex);

    try {
      game.move(expectedMove);
      setFen(game.fen());
      setMoveIndex((current) => current + 1);
      setStatus("Correct move played.");
      setShowHint(false);
      setSelectedSquare(null);
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
  }

  function jumpToMove(index) {
    const game = buildGameToMove(moves, index);
    setFen(game.fen());
    setMoveIndex(index);
    setStatus("");
    setShowHint(false);
    setSelectedSquare(null);
  }

  function handlePieceDrop(sourceSquare, targetSquare) {
    if (!expectedMove || isComplete) return false;

    const gameBeforeMove = buildGameToMove(moves, moveIndex);
    const gameAfterExpectedMove = buildGameToMove(moves, moveIndex);

    let expectedMoveObject = null;

    try {
      expectedMoveObject = gameAfterExpectedMove.move(expectedMove);
    } catch {
      setStatus("This practice line has a saved move that cannot be played.");
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
        setStatus("That move is not legal.");
        setSelectedSquare(null);
        return false;
      }

      const sameMove =
        attemptedMove.from === expectedMoveObject.from &&
        attemptedMove.to === expectedMoveObject.to &&
        cleanSan(attemptedMove.san) === cleanSan(expectedMoveObject.san);

      if (!sameMove) {
        setStatus(
          `Not quite. ${
            showHint
              ? `The move is ${formatMoveNumber(moveIndex)} ${expectedMove}.`
              : "Use Hint if you want to reveal the move."
          }`
        );
        setSelectedSquare(null);
        return false;
      }

      setFen(gameAfterExpectedMove.fen());
      setMoveIndex((current) => current + 1);
      setStatus("Correct.");
      setShowHint(false);
      setSelectedSquare(null);
      return true;
    } catch {
      setStatus("That move is not legal.");
      setSelectedSquare(null);
      return false;
    }
  }

  function handleSquareClick(squareName) {
    if (!expectedMove || isComplete) return;

    const game = buildGameToMove(moves, moveIndex);
    const piece = game.get(squareName);

    if (!selectedSquare) {
      if (!piece) return;

      setSelectedSquare(squareName);
      setStatus("Choose the square this piece should move to.");
      return;
    }

    if (selectedSquare === squareName) {
      setSelectedSquare(null);
      setStatus("");
      return;
    }

    handlePieceDrop(selectedSquare, squareName);
  }

  return (
    <section className="card practiceLinesPanel" id="practice-main-lines">
      <div className="practiceLinesHeader">
        <div>
          <p className="eyebrow">Practice pack</p>
          <h2>{openingName}</h2>
        </div>

        <button className="practiceCloseButton" type="button" onClick={onClose}>
          ×
        </button>
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

      <div className="practiceBoardLayout">
        <div className="practiceBoardWrap">
          <ChessPositionBoard
            position={fen}
            interactive={!isComplete}
            selectedSquare={selectedSquare}
            onPieceDrop={handlePieceDrop}
            onSquareClick={handleSquareClick}
          />
        </div>

        <div className="practiceTrainerBox boardTrainerBox">
          <div>
            <p className="eyebrow">Current line</p>
            <h3>{selectedLine.name}</h3>
            <p>{selectedLine.idea}</p>
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
                  {new Chess(fen).turn() === "w" ? "White" : "Black"} to move · Move {moveIndex + 1} of {moves.length}
                </small>
              </>
            )}
          </div>

          {status ? <div className="practiceStatus">{status}</div> : null}

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
    </section>
  );
}
