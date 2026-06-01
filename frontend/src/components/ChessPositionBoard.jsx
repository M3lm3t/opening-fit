import { useMemo, useRef } from "react";
import { Chess } from "chess.js";
import { useBoardTheme } from "./boardThemes.jsx";

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
  onSquareClick,
  onPieceDrop,
  showCoordinates = true,
  className = "",
}) {
  const { boardTheme, boardThemeVars } = useBoardTheme();
  const chess = useMemo(() => buildChess(position), [position]);
  const board = useMemo(() => getBoard(chess, orientation), [chess, orientation]);
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
      className={`cleanReplayBoard chessPositionBoard opening-board-shell ${className}`}
      style={boardThemeVars}
      data-board-theme={boardTheme}
    >
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
                  onDragEnd={handleDragEnd}
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
          } ${selectedSquare === squareName ? "practiceSelectedSquare" : ""} ${
            feedbackSquare === squareName ? "practiceInvalidSquare" : ""
          }`;

          if (interactive) {
            return (
              <button
                key={squareName}
                type="button"
                className={`${squareClass} chessBoardSquareButton`}
                draggable={Boolean(pieceKey)}
                onPointerUp={(event) => handleSquarePointerUp(event, squareName)}
                onClick={() => handleSquareClick(squareName)}
                onDragStart={(event) => handleDragStart(event, squareName, piece)}
                onDragEnd={handleDragEnd}
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
