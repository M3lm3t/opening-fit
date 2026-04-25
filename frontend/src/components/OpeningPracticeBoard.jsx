import { useMemo, useState } from "react";
import { Chess } from "chess.js";

export const SUPPORTED_OPENINGS = [
  "Vienna Game",
  "Italian Game",
  "Scotch Game",
  "Ruy Lopez",
  "London System",
  "Queen's Gambit",
  "English Opening",
  "King's Indian Attack",
  "Scandinavian Defense",
  "Caro-Kann Defense",
  "French Defense",
  "Sicilian Defense",
  "Pirc Defense",
  "King's Indian Defense",
  "Queen's Gambit Declined",
  "Dutch Defense",
];

const OPENING_LINES = {
  "Vienna Game": {
    name: "Vienna Game",
    side: "white",
    moves: ["e4", "e5", "Nc3", "Nf6", "f4", "d5"],
  },
  "Italian Game": {
    name: "Italian Game",
    side: "white",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
  },
  "Scotch Game": {
    name: "Scotch Game",
    side: "white",
    moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4"],
  },
  "Ruy Lopez": {
    name: "Ruy Lopez",
    side: "white",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"],
  },
  "London System": {
    name: "London System",
    side: "white",
    moves: ["d4", "d5", "Bf4", "Nf6", "e3", "e6"],
  },
  "Queen's Gambit": {
    name: "Queen's Gambit",
    side: "white",
    moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6"],
  },
  "English Opening": {
    name: "English Opening",
    side: "white",
    moves: ["c4", "e5", "Nc3", "Nf6", "g3", "d5"],
  },
  "King's Indian Attack": {
    name: "King's Indian Attack",
    side: "white",
    moves: ["Nf3", "d5", "g3", "Nf6", "Bg2", "e6"],
  },
  "Scandinavian Defense": {
    name: "Scandinavian Defense",
    side: "black",
    moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5"],
  },
  "Caro-Kann Defense": {
    name: "Caro-Kann Defense",
    side: "black",
    moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4"],
  },
  "French Defense": {
    name: "French Defense",
    side: "black",
    moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"],
  },
  "Sicilian Defense": {
    name: "Sicilian Defense",
    side: "black",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4"],
  },
  "Pirc Defense": {
    name: "Pirc Defense",
    side: "black",
    moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"],
  },
  "King's Indian Defense": {
    name: "King's Indian Defense",
    side: "black",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"],
  },
  "Queen's Gambit Declined": {
    name: "Queen's Gambit Declined",
    side: "black",
    moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6"],
  },
  "Dutch Defense": {
    name: "Dutch Defense",
    side: "black",
    moves: ["d4", "f5", "c4", "Nf6", "g3", "e6"],
  },
};

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

function normaliseOpeningName(name) {
  const clean = (name || "").toLowerCase();

  if (clean.includes("vienna")) return "Vienna Game";
  if (clean.includes("italian")) return "Italian Game";
  if (clean.includes("scotch")) return "Scotch Game";
  if (clean.includes("ruy") || clean.includes("spanish")) return "Ruy Lopez";
  if (clean.includes("london")) return "London System";
  if (clean.includes("queen") && clean.includes("gambit") && clean.includes("declined")) return "Queen's Gambit Declined";
  if (clean.includes("queen") && clean.includes("gambit")) return "Queen's Gambit";
  if (clean.includes("english")) return "English Opening";
  if (clean.includes("king") && clean.includes("indian") && clean.includes("attack")) return "King's Indian Attack";
  if (clean.includes("scandinavian") || clean.includes("center counter")) return "Scandinavian Defense";
  if (clean.includes("caro")) return "Caro-Kann Defense";
  if (clean.includes("french")) return "French Defense";
  if (clean.includes("sicilian")) return "Sicilian Defense";
  if (clean.includes("pirc")) return "Pirc Defense";
  if (clean.includes("king") && clean.includes("indian")) return "King's Indian Defense";
  if (clean.includes("dutch")) return "Dutch Defense";

  return null;
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

export default function OpeningPracticeBoard({ openingName, onClose }) {
  const matchedName = normaliseOpeningName(openingName);
  const opening = matchedName ? OPENING_LINES[matchedName] : null;

  const [moveIndex, setMoveIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [message, setMessage] = useState("");
  const [chess, setChess] = useState(() => new Chess());

  const orientation = opening?.side === "black" ? "black" : "white";
  const board = useMemo(() => getBoard(chess, orientation), [chess, orientation]);

  const expectedMove = opening?.moves?.[moveIndex] || null;
  const isComplete = opening && moveIndex >= opening.moves.length;
  const progressPercent = opening
    ? Math.round((moveIndex / opening.moves.length) * 100)
    : 0;

  const resetPractice = () => {
    setChess(new Chess());
    setMoveIndex(0);
    setSelectedSquare(null);
    setMessage("");
  };

  const applyPracticeMove = (from, to) => {
    if (!opening || isComplete || !from || !to) return;

    const copy = new Chess(chess.fen());

    try {
      const move = copy.move({
        from,
        to,
        promotion: "q",
      });

      if (!move) {
        setMessage("That move is not legal in this position.");
        setSelectedSquare(null);
        return;
      }

      if (move.san === expectedMove) {
        setChess(copy);
        setMoveIndex((prev) => prev + 1);
        setSelectedSquare(null);

        if (moveIndex + 1 >= opening.moves.length) {
          setMessage("Correct. Line complete.");
        } else {
          setMessage("Correct move.");
        }
      } else {
        setMessage(`Not quite. The main line move is ${expectedMove}.`);
        setSelectedSquare(null);
      }
    } catch {
      setMessage("That move is not legal in this position.");
      setSelectedSquare(null);
    }
  };

  const handleSquareClick = (squareName) => {
    if (!opening || isComplete) return;

    const piece = chess.get(squareName);

    if (!selectedSquare) {
      if (!piece) return;

      setSelectedSquare(squareName);
      setMessage("Now choose the square to move to.");
      return;
    }

    if (selectedSquare === squareName) {
      setSelectedSquare(null);
      setMessage("");
      return;
    }

    applyPracticeMove(selectedSquare, squareName);
  };

  const handleDragStart = (event, squareName) => {
    if (!opening || isComplete) return;

    const piece = chess.get(squareName);

    if (!piece) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData("text/plain", squareName);
    event.dataTransfer.effectAllowed = "move";
    setSelectedSquare(squareName);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event, targetSquare) => {
    event.preventDefault();

    const sourceSquare = event.dataTransfer.getData("text/plain");

    if (!sourceSquare) return;

    applyPracticeMove(sourceSquare, targetSquare);
  };

  const playExpectedMove = () => {
    if (!opening || isComplete) return;

    const copy = new Chess(chess.fen());

    try {
      copy.move(expectedMove);
      setChess(copy);
      setMoveIndex((prev) => prev + 1);
      setSelectedSquare(null);
      setMessage("");
    } catch {
      setMessage("This opening line could not continue from the current position.");
    }
  };

  const jumpToMove = (targetIndex) => {
    if (!opening) return;

    const copy = new Chess();

    try {
      for (let i = 0; i <= targetIndex; i += 1) {
        copy.move(opening.moves[i]);
      }

      setChess(copy);
      setMoveIndex(targetIndex + 1);
      setSelectedSquare(null);
      setMessage("");
    } catch {
      setMessage("Could not jump to that move.");
    }
  };

  if (!opening) {
    return (
      <section className="card practiceCard">
        <div className="practiceTop">
          <div>
            <p className="eyebrow">Opening Practice</p>
            <h2>{openingName || "Opening line"}</h2>
          </div>

          <button className="secondaryBtn" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="practiceComingSoon">
          <h3>Practice line coming soon</h3>
          <p>
            This opening is not in the practice trainer yet. Supported lines are
            being added gradually so the practice board stays accurate and useful.
          </p>

          <div className="supportedOpeningGrid">
            {SUPPORTED_OPENINGS.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card practiceCard">
      <div className="practiceTop">
        <div>
          <p className="eyebrow">Opening Practice</p>
          <h2>{opening.name}</h2>
          <p className="subtext">
            You are practising as{" "}
            <strong>{opening.side === "black" ? "Black" : "White"}</strong>.
            Play through the first 6 moves of the main line.
          </p>
        </div>

        <div className="practiceActions">
          <button className="secondaryBtn" type="button" onClick={resetPractice}>
            Restart line
          </button>

          <button className="secondaryBtn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="practiceProgressBarWrap">
        <div
          className="practiceProgressBar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="practiceLayout">
        <div className="practiceBoardBox">
          <div className="cleanReplayBoard">
            {board.map((rank, rowIndex) =>
              rank.map((piece, colIndex) => {
                const squareName = getSquareName(rowIndex, colIndex, orientation);
                const isLight = (rowIndex + colIndex) % 2 === 0;
                const pieceKey = piece
                  ? piece.color === "w"
                    ? piece.type.toUpperCase()
                    : piece.type
                  : null;

                return (
                  <button
                    key={squareName}
                    type="button"
                    className={`cleanReplaySquare ${
                      isLight ? "cleanReplayLight" : "cleanReplayDark"
                    } ${
                      selectedSquare === squareName ? "practiceSelectedSquare" : ""
                    }`}
                    onClick={() => handleSquareClick(squareName)}
                    onDragOver={handleDragOver}
                    onDrop={(event) => handleDrop(event, squareName)}
                    aria-label={squareName}
                  >
                    {pieceKey ? (
                      <span
                        draggable
                        onDragStart={(event) =>
                          handleDragStart(event, squareName)
                        }
                        className={`cleanReplayPiece practiceDraggablePiece ${
                          piece.color === "w"
                            ? "cleanReplayWhitePiece"
                            : "cleanReplayBlackPiece"
                        } cleanReplayPiece-${piece.type}`}
                      >
                        {PIECES[pieceKey]}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="practicePanel">
          <div className="practiceProgress">
            <span>
              Move {Math.min(moveIndex + 1, opening.moves.length)} of{" "}
              {opening.moves.length}
            </span>
            <strong>{isComplete ? "Complete" : expectedMove}</strong>
          </div>

          <div className="practiceMoveLine">
            {opening.moves.map((move, index) => (
              <button
                key={`${move}-${index}`}
                type="button"
                className={`practiceMovePill ${
                  index < moveIndex ? "practiceMoveDone" : ""
                } ${index === moveIndex ? "practiceMoveCurrent" : ""}`}
                onClick={() => jumpToMove(index)}
              >
                {move}
              </button>
            ))}
          </div>

          {message ? <div className="practiceMessage">{message}</div> : null}

          {isComplete ? (
            <div className="practiceComplete">
              Nice. You completed the first 6 moves of the {opening.name}.
            </div>
          ) : (
            <button
              className="primaryBtn practiceHintBtn"
              type="button"
              onClick={playExpectedMove}
            >
              Show next move
            </button>
          )}

          <p className="smallText">
            Tip: click a piece, then click the target square. You can also drag
            and drop pieces on desktop.
          </p>
        </div>
      </div>
    </section>
  );
}