import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { ChevronLeft, ChevronRight, SkipBack, SkipForward } from "lucide-react";
import ChessPositionBoard from "./ChessPositionBoard";
import { BoardThemeStatusLabel, BoardThemeToggle, useBoardTheme } from "./boardThemes.jsx";

function buildPositionFromMoves(moves, moveIndex) {
  const chess = new Chess();

  try {
    for (let i = 0; i < moveIndex; i += 1) {
      chess.move(moves[i]);
    }
  } catch {
    return new Chess();
  }

  return chess;
}

function chunkMoves(moves) {
  const rows = [];

  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i] || "",
      black: moves[i + 1] || "",
      whiteIndex: i + 1,
      blackIndex: i + 2,
    });
  }

  return rows;
}

export default function GameReplayBoard({
  game,
  title = "Game Replay",
  initialOrientation = "white",
}) {
  const moves = useMemo(() => (Array.isArray(game?.moves) ? game.moves : []), [game]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [orientation, setOrientation] = useState(initialOrientation);
  const { boardTheme, setBoardTheme } = useBoardTheme();

  const chess = useMemo(() => {
    return buildPositionFromMoves(moves, moveIndex);
  }, [moves, moveIndex]);

  const moveRows = useMemo(() => {
    return chunkMoves(moves);
  }, [moves]);

  const canGoBack = moveIndex > 0;
  const canGoForward = moveIndex < moves.length;

  const goStart = () => setMoveIndex(0);
  const goBack = () => setMoveIndex((prev) => Math.max(prev - 1, 0));
  const goForward = () =>
    setMoveIndex((prev) => Math.min(prev + 1, moves.length));
  const goEnd = () => setMoveIndex(moves.length);

  const flipBoard = () => {
    setOrientation((prev) => (prev === "white" ? "black" : "white"));
  };
  const lastMove = moveIndex > 0 ? moves[moveIndex - 1] : "None";
  const handleReplayKeys = (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); goBack(); }
    if (event.key === "ArrowRight") { event.preventDefault(); goForward(); }
    if (event.key === "Home") { event.preventDefault(); goStart(); }
    if (event.key === "End") { event.preventDefault(); goEnd(); }
  };

  if (!game) {
    return (
      <section className="replayCard card">
        <div className="replayEmptyState">No game selected.</div>
      </section>
    );
  }

  return (
    <section className="replayCard card" onKeyDown={handleReplayKeys}>
      <div className="replayHeader">
        <div>
          <h3 className="replayTitle">{title}</h3>
          <p className="replayMeta">
            {game.white || "White"} vs {game.black || "Black"}
            {game.result ? ` · ${game.result}` : ""}
          </p>
        </div>

        <button className="secondaryBtn replayFlipBtn" type="button" onClick={flipBoard}>
          Flip board
        </button>
      </div>

      <div className="boardThemeControls">
        <BoardThemeToggle boardTheme={boardTheme} onChange={setBoardTheme} />
        <BoardThemeStatusLabel boardTheme={boardTheme} />
      </div>

      {moves.length === 0 ? (
        <div className="replayWarning">
          No moves were found for this game.
        </div>
      ) : null}

      <div className="replayLayout">
        <div className="replayBoardWrap">
          <div className="replayBoardBox game-replay-board-shell">
            <ChessPositionBoard position={chess.fen()} orientation={orientation} />
          </div>

          <div className="replayControls">
            <button
              className="controlBtn"
              type="button"
              onClick={goStart}
              disabled={!canGoBack}
              aria-label="Go to start of game"
            >
              <SkipBack size={18} aria-hidden="true" />
            </button>

            <button
              className="controlBtn"
              type="button"
              onClick={goBack}
              disabled={!canGoBack}
              aria-label="Previous move"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>

            <button
              className="controlBtn"
              type="button"
              onClick={goForward}
              disabled={!canGoForward}
              aria-label="Next move"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>

            <button
              className="controlBtn"
              type="button"
              onClick={goEnd}
              disabled={!canGoForward}
              aria-label="Go to end of game"
            >
              <SkipForward size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="replayStatus" role="status" aria-live="polite">
            Move {moveIndex} of {moves.length}. {chess.turn() === "w" ? "White" : "Black"} to move. Last move: {lastMove}.
          </div>
        </div>

        <div className="replayMovesWrap">
          <div className="replayMovesHeader">
            <span>#</span>
            <span>White</span>
            <span>Black</span>
          </div>

          {moveRows.map((row) => (
            <div className="replayMoveRow" key={row.moveNumber}>
              <div className="moveNumber">{row.moveNumber}.</div>

              <button
                className={`moveBtn ${
                  moveIndex === row.whiteIndex ? "activeMove" : ""
                }`}
                type="button"
                disabled={!row.white}
                onClick={() => setMoveIndex(row.whiteIndex)}
              >
                {row.white}
              </button>

              <button
                className={`moveBtn ${
                  moveIndex === row.blackIndex ? "activeMove" : ""
                }`}
                type="button"
                disabled={!row.black}
                onClick={() => setMoveIndex(row.blackIndex)}
              >
                {row.black}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
