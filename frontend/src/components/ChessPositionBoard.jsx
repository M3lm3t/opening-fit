import { useMemo, useRef } from "react";
import { Chess } from "chess.js";
import { useBoardTheme } from "./boardThemes.jsx";
import classicBlackBishop from "../assets/chess-pieces/classic/bB.svg";
import classicBlackKing from "../assets/chess-pieces/classic/bK.svg";
import classicBlackKnight from "../assets/chess-pieces/classic/bN.svg";
import classicBlackPawn from "../assets/chess-pieces/classic/bP.svg";
import classicBlackQueen from "../assets/chess-pieces/classic/bQ.svg";
import classicBlackRook from "../assets/chess-pieces/classic/bR.svg";
import classicWhiteBishop from "../assets/chess-pieces/classic/wB.svg";
import classicWhiteKing from "../assets/chess-pieces/classic/wK.svg";
import classicWhiteKnight from "../assets/chess-pieces/classic/wN.svg";
import classicWhitePawn from "../assets/chess-pieces/classic/wP.svg";
import classicWhiteQueen from "../assets/chess-pieces/classic/wQ.svg";
import classicWhiteRook from "../assets/chess-pieces/classic/wR.svg";

const PIECE_ASSETS = {
  wK: classicWhiteKing,
  wQ: classicWhiteQueen,
  wR: classicWhiteRook,
  wB: classicWhiteBishop,
  wN: classicWhiteKnight,
  wP: classicWhitePawn,
  bK: classicBlackKing,
  bQ: classicBlackQueen,
  bR: classicBlackRook,
  bB: classicBlackBishop,
  bN: classicBlackKnight,
  bP: classicBlackPawn,
};

function ChessPiece({ piece, className = "" }) {
  if (!piece) return null;
  const pieceCode = `${piece.color}${piece.type.toUpperCase()}`;
  const pieceAsset = PIECE_ASSETS[pieceCode];

  return (
    <img
      className={`chess-piece cleanReplayPieceImage ${className}`.trim()}
      src={pieceAsset}
      alt=""
      draggable={false}
      aria-hidden="true"
    />
  );
}

const PIECE_NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };

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
  draggableColor = null,
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
  const positionSummary = useMemo(() => {
    const pieces = chess.board().flat().filter(Boolean);
    const white = pieces.filter((piece) => piece.color === "w").length;
    const black = pieces.length - white;
    return `${orientation === "black" ? "Black" : "White"} perspective. ${chess.turn() === "w" ? "White" : "Black"} to move${chess.inCheck() ? " and in check" : ""}. ${white} White pieces and ${black} Black pieces remain.`;
  }, [chess, orientation]);

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
    if (!interactive || !piece || (draggableColor && piece.color !== draggableColor)) {
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
      role={interactive ? "group" : "img"}
      aria-label={positionSummary}
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
                  draggable={interactive && (!draggableColor || piece.color === draggableColor)}
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
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, squareName)}
                aria-label={piece ? `${piece.color === "w" ? "White" : "Black"} ${PIECE_NAMES[piece.type]} on ${squareName}` : `Empty square ${squareName}`}
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
