import { useMemo } from "react";
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

function getBoard(chess, orientation) {
  const board = chess.board();

  if (orientation === "black") {
    return board.map((rank) => [...rank].reverse()).reverse();
  }

  return board;
}

function getSquareName(rowIndex, colIndex, orientation) {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

  if (orientation === "black") {
    return `${files[7 - colIndex]}${ranks[7 - rowIndex]}`;
  }

  return `${files[colIndex]}${ranks[rowIndex]}`;
}

function buildChess(position) {
  try {
    return position ? new Chess(position) : new Chess();
  } catch {
    return new Chess();
  }
}

export default function ChessPositionBoard({
  position,
  orientation = "white",
  interactive = false,
  selectedSquare = null,
  onSquareClick,
  onPieceDrop,
  showCoordinates = true,
  className = "",
}) {
  const chess = useMemo(() => buildChess(position), [position]);
  const board = useMemo(() => getBoard(chess, orientation), [chess, orientation]);

  const handleDragStart = (event, squareName, piece) => {
    if (!interactive || !piece) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData("text/plain", squareName);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event) => {
    if (!interactive) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event, targetSquare) => {
    if (!interactive) return;
    event.preventDefault();

    const sourceSquare = event.dataTransfer.getData("text/plain");
    if (sourceSquare && typeof onPieceDrop === "function") {
      onPieceDrop(sourceSquare, targetSquare);
    }
  };

  return (
    <div className={`cleanReplayBoard chessPositionBoard opening-board-shell ${className}`}>
      {board.map((rank, rowIndex) =>
        rank.map((piece, colIndex) => {
          const squareName = getSquareName(rowIndex, colIndex, orientation);
          const isLight = (rowIndex + colIndex) % 2 === 0;
          const pieceKey = piece
            ? piece.color === "w"
              ? piece.type.toUpperCase()
              : piece.type
            : null;
          const showRank =
            showCoordinates &&
            (orientation === "white" ? colIndex === 0 : colIndex === 7);
          const showFile =
            showCoordinates &&
            (orientation === "white" ? rowIndex === 7 : rowIndex === 0);

          const content = (
            <>
              {showRank ? (
                <span className="cleanReplayRank">{squareName[1]}</span>
              ) : null}

              {showFile ? (
                <span className="cleanReplayFile">{squareName[0]}</span>
              ) : null}

              {pieceKey ? (
                <span
                  draggable={interactive}
                  onDragStart={(event) => handleDragStart(event, squareName, piece)}
                  className={`cleanReplayPiece ${
                    piece.color === "w"
                      ? "cleanReplayWhitePiece"
                      : "cleanReplayBlackPiece"
                  } cleanReplayPiece-${piece.type}`}
                >
                  {PIECES[pieceKey]}
                </span>
              ) : null}
            </>
          );

          const squareClass = `cleanReplaySquare ${
            isLight ? "cleanReplayLight" : "cleanReplayDark"
          } ${selectedSquare === squareName ? "practiceSelectedSquare" : ""}`;

          if (interactive) {
            return (
              <button
                key={squareName}
                type="button"
                className={`${squareClass} chessBoardSquareButton`}
                draggable={Boolean(pieceKey)}
                onClick={() => onSquareClick?.(squareName)}
                onDragStart={(event) => handleDragStart(event, squareName, piece)}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, squareName)}
                aria-label={squareName}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={squareName} className={squareClass}>
              {content}
            </div>
          );
        })
      )}
    </div>
  );
}
