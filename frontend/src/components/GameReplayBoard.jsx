import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

function chunkMoves(moves) {
  const rows = [];

  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i] || null,
      whiteIndex: i + 1,
      black: moves[i + 1] || null,
      blackIndex: i + 2,
    });
  }

  return rows;
}

function normaliseMove(move) {
  if (!move || typeof move !== "string") return "";

  return move
    .trim()
    .replace(/\s+/g, "")
    .replace(/[!?]+/g, "");
}

function tryApplyMove(chess, rawMove) {
  const move = normaliseMove(rawMove);
  if (!move) return false;

  try {
    chess.move(move);
    return true;
  } catch {
    try {
      chess.move(move, { sloppy: true });
      return true;
    } catch {
      try {
        if (/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(move)) {
          chess.move({
            from: move.slice(0, 2),
            to: move.slice(2, 4),
            promotion: move[4]?.toLowerCase(),
          });
          return true;
        }
      } catch {
        return false;
      }
    }
  }

  return false;
}

export default function GameReplayBoard({
  game,
  title = "Game Replay",
  initialOrientation = "white",
}) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState(initialOrientation);

  useEffect(() => {
    setCurrentMoveIndex(0);
  }, [game]);

  const moves = useMemo(() => {
    if (!game?.moves) return [];
    return Array.isArray(game.moves) ? game.moves.filter(Boolean) : [];
  }, [game]);

  const replayState = useMemo(() => {
    const chess = new Chess();
    let appliedCount = 0;

    for (let i = 0; i < currentMoveIndex; i += 1) {
      const ok = tryApplyMove(chess, moves[i]);
      if (!ok) break;
      appliedCount += 1;
    }

    return {
      fen: chess.fen(),
      appliedCount,
    };
  }, [moves, currentMoveIndex]);

  const moveRows = useMemo(() => chunkMoves(moves), [moves]);

  const canGoBack = currentMoveIndex > 0;
  const canGoForward = currentMoveIndex < moves.length;

  const goToStart = () => setCurrentMoveIndex(0);
  const goToPrev = () => setCurrentMoveIndex((n) => Math.max(0, n - 1));
  const goToNext = () => setCurrentMoveIndex((n) => Math.min(moves.length, n + 1));
  const goToEnd = () => setCurrentMoveIndex(moves.length);

  const replayWarning =
    moves.length > 0 && currentMoveIndex > 0 && replayState.appliedCount === 0;

  return (
    <section className="replayCard">
      <div className="replayHeader">
        <div>
          <h3 className="replayTitle">{title}</h3>
          {game?.white || game?.black ? (
            <p className="replayMeta">
              {game?.white || "White"} vs {game?.black || "Black"}
              {game?.result ? ` • ${game.result}` : ""}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="secondaryBtn"
          onClick={() =>
            setBoardOrientation((o) => (o === "white" ? "black" : "white"))
          }
        >
          Flip board
        </button>
      </div>

      {moves.length === 0 ? (
        <div className="replayEmptyState">
          No replayable moves were found for this game.
        </div>
      ) : null}

      {replayWarning ? (
        <div className="replayWarning">
          Moves were found, but this game format is not being replayed correctly yet.
        </div>
      ) : null}

      <div className="replayLayout">
        <div className="replayBoardWrap">
          <div className="replayBoardBox">
            <Chessboard
              id={`replay-board-${game?.id || "default"}`}
              position={replayState.fen}
              boardOrientation={boardOrientation}
              arePiecesDraggable={false}
              boardWidth={360}
            />
          </div>

          <div className="replayControls">
            <button
              type="button"
              className="controlBtn"
              onClick={goToStart}
              disabled={!canGoBack}
            >
              ⏮
            </button>
            <button
              type="button"
              className="controlBtn"
              onClick={goToPrev}
              disabled={!canGoBack}
            >
              ◀
            </button>
            <button
              type="button"
              className="controlBtn"
              onClick={goToNext}
              disabled={!canGoForward}
            >
              ▶
            </button>
            <button
              type="button"
              className="controlBtn"
              onClick={goToEnd}
              disabled={!canGoForward}
            >
              ⏭
            </button>
          </div>

          <div className="replayStatus">
            Move {currentMoveIndex} / {moves.length}
          </div>
        </div>

        <div className="replayMovesWrap">
          <div className="replayMovesHeader">
            <span>#</span>
            <span>White</span>
            <span>Black</span>
          </div>

          <div className="replayMovesList">
            {moveRows.map((row) => (
              <div key={row.moveNumber} className="replayMoveRow">
                <div className="moveNumber">{row.moveNumber}.</div>

                <button
                  type="button"
                  className={`moveBtn ${
                    currentMoveIndex === row.whiteIndex ? "activeMove" : ""
                  }`}
                  onClick={() => setCurrentMoveIndex(row.whiteIndex)}
                  disabled={!row.white}
                >
                  {row.white || ""}
                </button>

                <button
                  type="button"
                  className={`moveBtn ${
                    currentMoveIndex === row.blackIndex ? "activeMove" : ""
                  }`}
                  onClick={() => setCurrentMoveIndex(row.blackIndex)}
                  disabled={!row.black}
                >
                  {row.black || ""}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}