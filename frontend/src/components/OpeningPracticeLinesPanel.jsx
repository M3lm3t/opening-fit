import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { findOpeningPracticePack } from "../data/openingPracticeLines";

function getOpeningName(opening) {
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

export default function OpeningPracticeLinesPanel({ opening, onClose }) {
  const openingName = getOpeningName(opening);
  const pack = useMemo(() => findOpeningPracticePack(openingName), [openingName]);

  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [fen, setFen] = useState(new Chess().fen());
  const [status, setStatus] = useState("");
  const [showHint, setShowHint] = useState(false);

  const selectedLine = pack?.lines?.[selectedLineIndex];
  const moves = selectedLine?.moves || [];
  const expectedMove = moves[moveIndex];
  const isComplete = Boolean(pack) && moveIndex >= moves.length;
  const progressPercent = moves.length ? Math.round((moveIndex / moves.length) * 100) : 0;
  const completedMoves = Math.min(moveIndex, moves.length);

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
  }

  function chooseLine(index) {
    setSelectedLineIndex(index);
    setMoveIndex(0);
    setFen(new Chess().fen());
    setStatus("");
    setShowHint(false);
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
  }

  function jumpToMove(index) {
    const game = buildGameToMove(moves, index);
    setFen(game.fen());
    setMoveIndex(index);
    setStatus("");
    setShowHint(false);
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
        return false;
      }

      setFen(gameAfterExpectedMove.fen());
      setMoveIndex((current) => current + 1);
      setStatus("Correct.");
      setShowHint(false);
      return true;
    } catch {
      setStatus("That move is not legal.");
      return false;
    }
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
          <Chessboard
            key={`${selectedLineIndex}-${fen}`}
            id={`practice-board-${openingName}-${selectedLineIndex}`}
            position={fen}
            onPieceDrop={handlePieceDrop}
            arePiecesDraggable={!isComplete}
            animationDuration={200}
            boardWidth={360}
          />
        </div>

        <div className="practiceTrainerBox boardTrainerBox">
          <div>
            <p className="eyebrow">Current line</p>
            <h3>{selectedLine.name}</h3>
            <p>{selectedLine.idea}</p>
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
    </section>
  );
}
