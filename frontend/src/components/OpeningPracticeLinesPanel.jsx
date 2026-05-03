import { useEffect, useMemo, useState } from "react";
import { findOpeningPracticePack } from "../data/openingPracticeLines";

function getOpeningName(opening) {
  return opening?.name || opening?.opening || opening?.label || "Unknown opening";
}

function formatMoveNumber(index) {
  const moveNumber = Math.floor(index / 2) + 1;
  return index % 2 === 0 ? `${moveNumber}.` : `${moveNumber}...`;
}

export default function OpeningPracticeLinesPanel({ opening, onClose }) {
  const openingName = getOpeningName(opening);
  const pack = useMemo(() => findOpeningPracticePack(openingName), [openingName]);

  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);

  useEffect(() => {
    setSelectedLineIndex(0);
    setMoveIndex(0);
  }, [openingName]);

  if (!opening) return null;

  if (!pack) {
    return (
      <section className="card practiceLinesPanel" id="practice-main-lines">
        <div className="practiceLinesHeader">
          <div>
            <p className="eyebrow">Practice pack</p>
            <h2>{openingName}</h2>
          </div>

          <button className="practiceCloseButton" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="practiceComingSoon">
          <h3>Practice pack coming soon</h3>
          <p>
            I have not added 3 main lines for this opening yet. Start with the common openings first,
            then we can keep expanding the library.
          </p>
        </div>
      </section>
    );
  }

  const selectedLine = pack.lines[selectedLineIndex];
  const moves = selectedLine?.moves || [];
  const currentMove = moves[moveIndex];
  const isComplete = moveIndex >= moves.length;

  return (
    <section className="card practiceLinesPanel" id="practice-main-lines">
      <div className="practiceLinesHeader">
        <div>
          <p className="eyebrow">Practice pack</p>
          <h2>{openingName}</h2>
        </div>

        <button className="practiceCloseButton" type="button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="practiceLineChoices">
        {pack.lines.map((line, index) => (
          <button
            key={line.name}
            type="button"
            className={`practiceLineChoice ${selectedLineIndex === index ? "active" : ""}`}
            onClick={() => {
              setSelectedLineIndex(index);
              setMoveIndex(0);
            }}
          >
            <span>Line {index + 1}</span>
            <strong>{line.name}</strong>
          </button>
        ))}
      </div>

      <div className="practiceTrainerBox">
        <div>
          <p className="eyebrow">Current line</p>
          <h3>{selectedLine.name}</h3>
          <p>{selectedLine.idea}</p>
        </div>

        <div className="practiceMovePrompt">
          {isComplete ? (
            <>
              <span>Complete</span>
              <strong>Line finished</strong>
              <small>Reset the line or choose another one.</small>
            </>
          ) : (
            <>
              <span>Next move</span>
              <strong>
                {formatMoveNumber(moveIndex)} {currentMove}
              </strong>
              <small>
                Move {moveIndex + 1} of {moves.length}
              </small>
            </>
          )}
        </div>
      </div>

      <div className="practiceMoveList">
        {moves.map((move, index) => (
          <button
            key={`${move}-${index}`}
            type="button"
            className={`practiceMoveChip ${index < moveIndex ? "done" : ""} ${
              index === moveIndex ? "current" : ""
            }`}
            onClick={() => setMoveIndex(index)}
          >
            <span>{formatMoveNumber(index)}</span>
            {move}
          </button>
        ))}
      </div>

      <div className="practiceControls">
        <button
          type="button"
          onClick={() => setMoveIndex((current) => Math.max(0, current - 1))}
          disabled={moveIndex === 0}
        >
          Back
        </button>

        <button type="button" onClick={() => setMoveIndex(0)}>
          Reset
        </button>

        <button
          type="button"
          className="primaryPracticeControl"
          onClick={() => setMoveIndex((current) => Math.min(moves.length, current + 1))}
          disabled={isComplete}
        >
          Next move
        </button>
      </div>
    </section>
  );
}
