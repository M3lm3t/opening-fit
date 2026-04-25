import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";

const PIECES = {
  p: "♟",
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
  P: "♙",
  R: "♖",
  N: "♘",
  B: "♗",
  Q: "♕",
  K: "♔",
};

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

function cleanMoveText(move) {
  return move
    .toString()
    .trim()
    .replace(/\{[^}]*\}/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\d+\.(\.\.)?/g, "")
    .replace(/[!?]+/g, "")
    .replace(/\s+/g, "");
}

function normaliseMove(move) {
  if (!move) return "";

  if (typeof move === "string") {
    return cleanMoveText(move);
  }

  if (typeof move === "object") {
    const possibleMove =
      move.san ||
      move.lan ||
      move.uci ||
      move.move ||
      move.notation ||
      move.text ||
      "";

    return cleanMoveText(possibleMove);
  }

  return "";
}

function tryApplyMove(chess, rawMove) {
  const move = normaliseMove(rawMove);

  if (!move) return false;

  try {
    chess.move(move);
    return true;
  } catch {
    // Try UCI format below, for example e2e4
  }

  try {
    if (/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(move)) {
      chess.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move[4] ? move[4].toLowerCase() : undefined,
      });
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function movesFromPgn(pgnText) {
  if (!pgnText || typeof pgnText !== "string") return [];

  try {
    const chess = new Chess();
    chess.loadPgn(pgnText);
    return chess.history();
  } catch {
    return [];
  }
}

function getGameMoves(game) {
  if (!game) return [];

  if (Array.isArray(game.moves) && game.moves.length > 0) {
    return game.moves.filter(Boolean);
  }

  if (Array.isArray(game.sanMoves) && game.sanMoves.length > 0) {
    return game.sanMoves.filter(Boolean);
  }

  if (Array.isArray(game.moveList) && game.moveList.length > 0) {
    return game.moveList.filter(Boolean);
  }

  if (Array.isArray(game.history) && game.history.length > 0) {
    return game.history.filter(Boolean);
  }

  if (typeof game.pgn === "string") {
    return movesFromPgn(game.pgn);
  }

  if (typeof game.pgnText === "string") {
    return movesFromPgn(game.pgnText);
  }

  return [];
}

function getMoveLabel(move) {
  if (!move) return "";

  if (typeof move === "string") {
    return move;
  }

  if (typeof move === "object") {
    return (
      move.san ||
      move.lan ||
      move.uci ||
      move.move ||
      move.notation ||
      move.text ||
      ""
    ).toString();
  }

  return "";
}

function fenToBoard(fen) {
  const boardPart = fen.split(" ")[0];
  const rows = boardPart.split("/");

  return rows.map((row) => {
    const squares = [];

    for (const char of row) {
      const emptyCount = Number(char);

      if (!Number.isNaN(emptyCount)) {
        for (let i = 0; i < emptyCount; i += 1) {
          squares.push("");
        }
      } else {
        squares.push(char);
      }
    }

    while (squares.length < 8) {
      squares.push("");
    }

    return squares.slice(0, 8);
  });
}

function ReplayBoard({ fen, orientation }) {
  const board = useMemo(() => {
    const parsed = fenToBoard(fen);

    if (orientation === "black") {
      return parsed.map((row) => [...row].reverse()).reverse();
    }

    return parsed;
  }, [fen, orientation]);

  const files =
    orientation === "white"
      ? ["a", "b", "c", "d", "e", "f", "g", "h"]
      : ["h", "g", "f", "e", "d", "c", "b", "a"];

  const ranks =
    orientation === "white"
      ? ["8", "7", "6", "5", "4", "3", "2", "1"]
      : ["1", "2", "3", "4", "5", "6", "7", "8"];

  return (
    <div className="cleanReplayBoard">
      {board.map((row, rowIndex) =>
        row.map((piece, colIndex) => {
          const isLight = (rowIndex + colIndex) % 2 === 0;
          const isWhitePiece = piece && piece === piece.toUpperCase();
          const isBottomRow = rowIndex === 7;
          const isLeftCol = colIndex === 0;

          return (
            <div
              key={`${fen}-${rowIndex}-${colIndex}-${piece}`}
              className={`cleanReplaySquare ${
                isLight ? "cleanReplayLight" : "cleanReplayDark"
              }`}
            >
              {isLeftCol ? (
                <span className="cleanReplayRank">{ranks[rowIndex]}</span>
              ) : null}

              {isBottomRow ? (
                <span className="cleanReplayFile">{files[colIndex]}</span>
              ) : null}

              {piece ? (
                <span
                  className={`cleanReplayPiece cleanReplayPiece-${piece.toLowerCase()} ${
                    isWhitePiece
                      ? "cleanReplayWhitePiece"
                      : "cleanReplayBlackPiece"
                  }`}
                >
                  {PIECES[piece]}
                </span>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
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
    setBoardOrientation(initialOrientation);
  }, [game, initialOrientation]);

  const moves = useMemo(() => getGameMoves(game), [game]);

  const replayState = useMemo(() => {
    const chess = new Chess();
    let appliedCount = 0;
    let failedMove = null;

    const safeMoveIndex = Math.max(0, Math.min(currentMoveIndex, moves.length));

    for (let i = 0; i < safeMoveIndex; i += 1) {
      const ok = tryApplyMove(chess, moves[i]);

      if (!ok) {
        failedMove = moves[i];
        break;
      }

      appliedCount += 1;
    }

    return {
      fen: chess.fen(),
      appliedCount,
      failedMove,
    };
  }, [moves, currentMoveIndex]);

  const moveRows = useMemo(() => chunkMoves(moves), [moves]);

  const canGoBack = currentMoveIndex > 0;
  const canGoForward = currentMoveIndex < moves.length;

  const goToStart = () => setCurrentMoveIndex(0);
  const goToPrev = () => setCurrentMoveIndex((n) => Math.max(0, n - 1));
  const goToNext = () =>
    setCurrentMoveIndex((n) => Math.min(moves.length, n + 1));
  const goToEnd = () => setCurrentMoveIndex(moves.length);

  const replayWarning =
    moves.length > 0 &&
    currentMoveIndex > 0 &&
    replayState.appliedCount < currentMoveIndex;

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
            setBoardOrientation((orientation) =>
              orientation === "white" ? "black" : "white"
            )
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
          The replay stopped at move {replayState.appliedCount}. Failed move:{" "}
          {getMoveLabel(replayState.failedMove)}
        </div>
      ) : null}

      <div className="replayLayout">
        <div className="replayBoardWrap">
          <div className="replayBoardBox">
            <ReplayBoard fen={replayState.fen} orientation={boardOrientation} />
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
                  {getMoveLabel(row.white)}
                </button>

                <button
                  type="button"
                  className={`moveBtn ${
                    currentMoveIndex === row.blackIndex ? "activeMove" : ""
                  }`}
                  onClick={() => setCurrentMoveIndex(row.blackIndex)}
                  disabled={!row.black}
                >
                  {getMoveLabel(row.black)}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}