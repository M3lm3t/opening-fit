import { useMemo, useRef } from "react";
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
  feedbackSquare = null,
  legalSquares = [],
  lastMoveSquares = [],
  onSquareClick,
  onPieceDrop,
  showCoordinates = true,
  className = "",
  "aria-label": ariaLabel = "Chess position board",
}) {
  const chess = useMemo(() => buildChess(position), [position]);
  const board = useMemo(() => getBoard(chess, orientation), [chess, orientation]);
  const legalSquareSet = useMemo(() => new Set(legalSquares), [legalSquares]);
  const lastMoveSquareSet = useMemo(() => new Set(lastMoveSquares), [lastMoveSquares]);
  const pointerHandledRef = useRef(false);
  const draggingRef = useRef(false);

  const activateSquare = (squareName) => {
    if (!interactive || typeof onSquareClick !== "function") return;
    onSquareClick(squareName);
  };

  const handleSquarePointerUp = (event, squareName) => {
    if (!interactive) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (draggingRef.current) return;

    pointerHandledRef.current = true;
    event.preventDefault();
    activateSquare(squareName);
  };

  const handleSquareClick = (squareName) => {
    if (pointerHandledRef.current) {
      pointerHandledRef.current = false;
      return;
    }

    activateSquare(squareName);
  };

  const handleDragStart = (event, squareName, piece) => {
    if (!interactive || !piece) {
      event.preventDefault();
      return;
    }

    draggingRef.current = true;
    pointerHandledRef.current = true;
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

    draggingRef.current = false;
    const sourceSquare = event.dataTransfer.getData("text/plain");
    if (sourceSquare && typeof onPieceDrop === "function") {
      onPieceDrop(sourceSquare, targetSquare);
    }
  };

  const handleDragEnd = () => {
    draggingRef.current = false;
  };

  return (
    <div
      className={`of-board cleanReplayBoard chessPositionBoard opening-board-shell ${className}`}
      role="grid"
      aria-label={ariaLabel}
    >
      {board.map((rank, rowIndex) =>
        rank.map((piece, colIndex) => {
          const squareName = getSquareName(rowIndex, colIndex, orientation);
          const isLight = (rowIndex + colIndex) % 2 === 0;
          const isSelected = selectedSquare === squareName;
          const isInvalid = feedbackSquare === squareName;
          const isLegal = legalSquareSet.has(squareName);
          const isLastMove = lastMoveSquareSet.has(squareName);
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
                <span className="of-board-coord of-board-coord--rank cleanReplayRank">
                  {squareName[1]}
                </span>
              ) : null}

              {showFile ? (
                <span className="of-board-coord of-board-coord--file cleanReplayFile">
                  {squareName[0]}
                </span>
              ) : null}

              {pieceKey ? (
                <span
                  draggable={interactive}
                  onDragStart={(event) => handleDragStart(event, squareName, piece)}
                  onDragEnd={handleDragEnd}
                  className={`of-board-piece cleanReplayPiece ${
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

          const squareClass = `of-board-square cleanReplaySquare ${
            isLight
              ? "of-board-square--light cleanReplayLight"
              : "of-board-square--dark cleanReplayDark"
          } ${isSelected ? "of-board-square--selected practiceSelectedSquare" : ""} ${
            isInvalid ? "of-board-square--invalid practiceInvalidSquare" : ""
          } ${isLegal ? "of-board-square--legal legalMove" : ""} ${
            isLastMove ? "of-board-square--last-move lastMove" : ""
          }`;

          if (interactive) {
            return (
              <button
                key={squareName}
                type="button"
                className={`${squareClass} chessBoardSquareButton`}
                role="gridcell"
                draggable={Boolean(pieceKey)}
                onPointerUp={(event) => handleSquarePointerUp(event, squareName)}
                onClick={() => handleSquareClick(squareName)}
                onDragStart={(event) => handleDragStart(event, squareName, piece)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, squareName)}
                aria-label={`${squareName}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                aria-pressed={isSelected}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={squareName} className={squareClass} role="gridcell" aria-label={squareName}>
              {content}
            </div>
          );
        })
      )}
    </div>
  );
}
