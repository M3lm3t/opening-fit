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
    return Array.isArray(game.moves) ? game.moves : [];
  }, [game]);

  const chess = useMemo(() => {
    const instance = new Chess();

    for (let i = 0; i < currentMoveIndex; i += 1) {
      const move = moves[i];
      if (!move) break;

      try {
        instance.move(move);
      } catch {
        break;
      }
    }

    return instance;
  }, [moves, currentMoveIndex]);

  const fen = chess.fen();
  const moveRows = useMemo(() => chunkMoves(moves), [moves]);

  const canGoBack = currentMoveIndex > 0;
  const canGoForward = currentMoveIndex < moves.length;

  const goToStart = () => setCurrentMoveIndex(0);
  const goToPrev = () => setCurrentMoveIndex((n) => Math.max(0, n - 1));
  const goToNext = () => setCurrentMoveIndex((n) => Math.min(moves.length, n + 1));
  const goToEnd = () => setCurrentMoveIndex(moves.length);

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

      <div className="replayLayout">
        <div className="replayBoardWrap">
          <Chessboard
            id={`replay-board-${game?.id || "default"}`}
            position={fen}
            boardOrientation={boardOrientation}
            arePiecesDraggable={false}
            boardWidth={420}
          />

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