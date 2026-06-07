import { useMemo, useRef } from "react";
import { Chess } from "chess.js";
import { useBoardTheme } from "./boardThemes.jsx";

const PIECE_PATHS = {
  k: (
    <>
      <path d="M45 8v12M39 14h12" />
      <path d="M32 64h26l4 10H28l4-10Z" />
      <path d="M34 59h22c0-9-4-16-11-21-7 5-11 12-11 21Z" />
      <path d="M28 38c6-7 28-7 34 0-2 5-8 8-17 8s-15-3-17-8Z" />
      <path d="M31 31c2-9 9-14 14-14s12 5 14 14" />
    </>
  ),
  q: (
    <>
      <circle cx="24" cy="26" r="4" />
      <circle cx="34" cy="18" r="4" />
      <circle cx="45" cy="15" r="4" />
      <circle cx="56" cy="18" r="4" />
      <circle cx="66" cy="26" r="4" />
      <path d="M25 33l8 25h24l8-25-14 14-6-23-6 23-14-14Z" />
      <path d="M31 64h28l4 10H27l4-10Z" />
    </>
  ),
  r: (
    <>
      <path d="M28 18h10v8h14v-8h10v22H28V18Z" />
      <path d="M33 40h24v21H33V40Z" />
      <path d="M29 61h32l4 13H25l4-13Z" />
    </>
  ),
  b: (
    <>
      <path d="M45 14c9 8 14 16 14 27 0 10-6 18-14 18s-14-8-14-18c0-11 5-19 14-27Z" />
      <path d="M39 45l12-14" />
      <path d="M32 61h26l5 13H27l5-13Z" />
    </>
  ),
  n: (
    <>
      <path d="M30 70h34l-4-14c-2-8-4-17-2-27-6-8-17-12-27-8 5 4 5 8 2 12-3 3-7 5-9 10 5 1 9 0 13-3-2 7-5 13-7 30Z" />
      <path d="M42 25h.5" />
      <path d="M35 36c5 2 10 2 15 0" />
    </>
  ),
  p: (
    <>
      <circle cx="45" cy="25" r="10" />
      <path d="M35 45c0-7 5-12 10-12s10 5 10 12c0 6-3 11-7 14h9l5 15H28l5-15h9c-4-3-7-8-7-14Z" />
    </>
  ),
};

function ChessPiece({ piece, className = "" }) {
  if (!piece) return null;
  const tone = piece.color === "w" ? "white" : "black";

  return (
    <svg
      className={`cleanReplayPieceSvg cleanReplayPieceSvg-${tone} ${className}`.trim()}
      viewBox="0 0 90 90"
      aria-hidden="true"
      focusable="false"
    >
      <g>
        {PIECE_PATHS[piece.type]}
      </g>
    </svg>
  );
}

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

function getKingSquare(chess, color, orientation) {
  const board = getBoard(chess, orientation);

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < board[rowIndex].length; colIndex += 1) {
      const piece = board[rowIndex][colIndex];
      if (piece?.type === "k" && piece.color === color) {
        return getSquareName(rowIndex, colIndex, orientation);
      }
    }
  }

  return null;
}

export default function ChessPositionBoard({
  position,
  orientation = "white",
  interactive = false,
  selectedSquare = null,
  feedbackSquare = null,
  lastMoveSquares = [],
  legalMoveSquares = [],
  checkSquare = null,
  onSquareClick,
  onPieceDrop,
  showCoordinates = true,
  className = "",
}) {
  const { boardTheme, boardThemeVars } = useBoardTheme();
  const chess = useMemo(() => buildChess(position), [position]);
  const board = useMemo(() => getBoard(chess, orientation), [chess, orientation]);
  const computedLastMoveSquares = useMemo(() => {
    if (lastMoveSquares.length) return lastMoveSquares;
    const history = chess.history({ verbose: true });
    const lastMove = history[history.length - 1];
    return lastMove ? [lastMove.from, lastMove.to] : [];
  }, [chess, lastMoveSquares]);
  const computedLegalMoveSquares = useMemo(() => {
    if (legalMoveSquares.length || !interactive || !selectedSquare) return legalMoveSquares;
    try {
      return chess.moves({ square: selectedSquare, verbose: true }).map((move) => move.to);
    } catch {
      return [];
    }
  }, [chess, interactive, legalMoveSquares, selectedSquare]);
  const computedCheckSquare = useMemo(() => {
    if (checkSquare) return checkSquare;
    return chess.inCheck() ? getKingSquare(chess, chess.turn(), orientation) : null;
  }, [checkSquare, chess, orientation]);
  const pointerHandledRef = useRef(false);
  const draggingRef = useRef(false);
  const dragImageRef = useRef(null);

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
    activateSquare(squareName);
    event.dataTransfer.setData("text/plain", squareName);
    event.dataTransfer.effectAllowed = "move";
    const sourcePiece = event.currentTarget.classList?.contains("cleanReplayPiece")
      ? event.currentTarget
      : event.currentTarget.querySelector(".cleanReplayPiece");
    const dragImage = sourcePiece?.cloneNode(true);
    if (dragImage && event.dataTransfer.setDragImage) {
      dragImage.classList.add("cleanReplayDragImage");
      document.body.appendChild(dragImage);
      dragImageRef.current = dragImage;
      const size = dragImage.getBoundingClientRect().width || 56;
      event.dataTransfer.setDragImage(dragImage, size / 2, size / 2);
    }
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
    dragImageRef.current?.remove?.();
    dragImageRef.current = null;
    const sourceSquare = event.dataTransfer.getData("text/plain");
    if (sourceSquare && typeof onPieceDrop === "function") {
      onPieceDrop(sourceSquare, targetSquare);
    }
  };

  const handleDragEnd = () => {
    draggingRef.current = false;
    dragImageRef.current?.remove?.();
    dragImageRef.current = null;
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

          const isLastMove = computedLastMoveSquares.includes(squareName);
          const isLegalMove = computedLegalMoveSquares.includes(squareName);
          const isCheck = computedCheckSquare === squareName;
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
                  <ChessPiece piece={piece} />
                </span>
              ) : null}
            </>
          );

          const squareClass = `cleanReplaySquare ${
            isLight ? "cleanReplayLight" : "cleanReplayDark"
          } ${selectedSquare === squareName ? "practiceSelectedSquare" : ""} ${
            feedbackSquare === squareName ? "practiceInvalidSquare" : ""
          } ${isLastMove ? "practiceLastMove" : ""} ${
            isLegalMove ? "practiceLegalMove" : ""
          } ${isCheck ? "practiceCheckSquare" : ""
          }`;

          if (interactive) {
            return (
              <button
                key={squareName}
                type="button"
                className={`${squareClass} chessBoardSquareButton`}
                draggable={false}
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
