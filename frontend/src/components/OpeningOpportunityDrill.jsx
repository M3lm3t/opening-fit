import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, RotateCcw } from "lucide-react";
import { Chess } from "chess.js";
import { useAuth } from "../context/AuthDataProvider.jsx";
import {
  answerOpeningConcept,
  attemptOpeningOpportunityMove,
  buildOpeningOpportunityDrill,
  createOpeningOpportunitySession,
  loadOpeningOpportunityProgress,
  revealOpeningOpportunityAnswer,
  saveOpeningOpportunityProgress,
  updateOpeningOpportunityProgress,
} from "../lib/openingOpportunityDrills.js";
import ChessPositionBoard from "./ChessPositionBoard.jsx";
import { TRAINING_TASK_COMPLETED_EVENT } from "../lib/trainingQueue.js";
import "./OpeningOpportunityDrill.css";

const TYPE_LABELS = { position_choice: "Position choice", line_replay: "Line replay", concept_check: "Concept check" };

function currentChess(fen) {
  try { return new Chess(fen); } catch { return null; }
}

export default function OpeningOpportunityDrill({ opportunity, report, onClose }) {
  const { recordActivity } = useAuth();
  const drill = useMemo(() => buildOpeningOpportunityDrill(opportunity, report), [opportunity, report]);
  const [progress, setProgress] = useState(() => loadOpeningOpportunityProgress());
  const [session, setSession] = useState(() => createOpeningOpportunitySession(drill, loadOpeningOpportunityProgress()[drill.id]));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [feedbackSquare, setFeedbackSquare] = useState(null);

  useEffect(() => {
    const saved = loadOpeningOpportunityProgress();
    setProgress(saved);
    setSession(createOpeningOpportunitySession(drill, saved[drill.id]));
    setSelectedSquare(null);
    setFeedbackSquare(null);
  }, [drill]);

  const chess = useMemo(() => currentChess(session.fen), [session.fen]);
  const userColour = drill.side === "black" ? "b" : "w";
  const canMove = Boolean(drill.valid && chess && chess.turn() === userColour && !session.completion && drill.type !== "concept_check");
  const currentExpectedMove = drill.type === "line_replay" ? drill.expectedMoves?.[session.lineIndex] : drill.recommendedMove;

  const persist = (next) => {
    const nextProgress = updateOpeningOpportunityProgress(progress, drill, next);
    setSession(next);
    setProgress(nextProgress);
    saveOpeningOpportunityProgress(nextProgress);
    if (next.completion && !session.completion) {
      window.dispatchEvent(new CustomEvent(TRAINING_TASK_COMPLETED_EVENT, { detail: { opening: drill.openingName, line: drill.opportunityId, result: next.repeatedFailure ? "repeated_failure" : "completed" } }));
      void recordActivity?.("opening_opportunity_drill_completed", {
        opportunityId: drill.opportunityId,
        openingId: drill.openingId,
        drillType: drill.type,
        attempts: next.attempts,
        success: next.success,
        completed: true,
      });
    }
  };

  const attemptMove = (move) => {
    const next = attemptOpeningOpportunityMove(drill, session, move);
    persist(next);
    setSelectedSquare(null);
    if (!next.feedback?.success && move?.to) {
      setFeedbackSquare(move.to);
      window.setTimeout(() => setFeedbackSquare(null), 650);
    }
  };

  const selectSquare = (square) => {
    if (!canMove || !chess) return;
    const piece = chess.get(square);
    if (!selectedSquare) {
      if (piece?.color === userColour) setSelectedSquare(square);
      return;
    }
    if (piece?.color === userColour) {
      setSelectedSquare(square);
      return;
    }
    attemptMove({ from: selectedSquare, to: square, promotion: "q" });
  };

  const reset = () => {
    setSession({ ...createOpeningOpportunitySession(drill), attempts: Number(progress[drill.id]?.attempts || 0) });
    setSelectedSquare(null);
  };

  if (!drill.valid) {
    return (
      <section className="openingOpportunityDrill openingOpportunityDrill--error" role="status">
        <AlertTriangle size={24} />
        <div><span>Practice unavailable</span><h2>This saved drill needs fresh analysis.</h2><p>{drill.error}</p><p>The rest of your report and opening practice remain available.</p></div>
        {onClose ? <button type="button" className="secondaryBtn" onClick={onClose}>Back to opening practice</button> : null}
      </section>
    );
  }

  return (
    <section className={`openingOpportunityDrill openingOpportunityDrill--${drill.type}`} aria-labelledby="opening-opportunity-title">
      <header className="openingOpportunityHeader">
        <div><span>{TYPE_LABELS[drill.type]} · Train as {drill.side === "black" ? "Black" : "White"}</span><h2 id="opening-opportunity-title">{drill.openingName}</h2><p>{drill.prompt}</p></div>
        <div className="openingOpportunityStats"><span>Attempts <strong>{session.attempts}</strong></span><span>Recurrence <strong>{drill.recurrenceCount}×</strong></span><span>Status <strong>{session.completion ? "Complete" : session.repeatedFailure ? "Repeat recommended" : "In progress"}</strong></span></div>
      </header>

      {drill.type === "concept_check" ? (
        <div className="openingConceptCheck">
          <div><span>Plan question</span><h3>{drill.prompt}</h3><p>{drill.evidence}</p></div>
          <div className="openingConceptOptions">
            {drill.conceptOptions.map((option) => <button type="button" key={option.id} disabled={session.completion} onClick={() => persist(answerOpeningConcept(drill, session, option.id))}>{option.label}</button>)}
          </div>
        </div>
      ) : (
        <div className="openingOpportunityBoardLayout">
          <div className="openingOpportunityBoard">
            <ChessPositionBoard
              position={session.fen}
              orientation={drill.orientation}
              interactive={canMove}
              draggableColor={userColour}
              selectedSquare={selectedSquare}
              feedbackSquare={feedbackSquare}
              onSquareClick={selectSquare}
              onPieceDrop={(from, to) => canMove && attemptMove({ from, to, promotion: "q" })}
            />
          </div>
          <aside className="openingOpportunityPrompt">
            <span>{session.completion ? "Drill complete" : canMove ? `Your move as ${drill.side === "black" ? "Black" : "White"}` : "Opponent response"}</span>
            <h3>{drill.prompt}</h3>
            <p>{drill.evidence}</p>
            {drill.type === "line_replay" ? <div className="openingReplayProgress"><span>Sequence progress</span><strong>{Math.min(session.lineIndex, drill.expectedMoves.length)}/{drill.expectedMoves.length}</strong>{session.opponentMoves?.length ? <small>OpeningFit replied automatically with {session.opponentMoves.join(", ")}.</small> : <small>You control only {drill.side === "black" ? "Black" : "White"}; OpeningFit plays the other side.</small>}</div> : null}
          </aside>
        </div>
      )}

      {session.feedback ? (
        <div className={`openingOpportunityFeedback ${session.feedback.success ? "openingOpportunityFeedback--success" : ""}`} role="status">
          {session.feedback.success ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}
          <dl>
            <div><dt>You played</dt><dd>{session.feedback.played}</dd></div>
            {(session.attempts > 0 || session.revealed) ? <div><dt>{drill.type === "concept_check" ? "Recommended plan" : "Recommended move or plan"}</dt><dd>{session.feedback.recommended || currentExpectedMove || drill.plan}</dd></div> : null}
            <div><dt>Why it matters</dt><dd>{session.feedback.why}</dd></div>
            {session.feedback.gameReference ? <div><dt>Your evidence</dt><dd>{session.feedback.gameReference}{drill.sourceGame?.url ? <> <a href={drill.sourceGame.url} target="_blank" rel="noreferrer">Open game</a></> : null}</dd></div> : null}
          </dl>
          {session.feedback.error ? <p>{session.feedback.error}</p> : session.feedback.transposition ? <p>That recognised transposition reaches a supported route, so it counts.</p> : <p>Good recall. Keep the position cue attached to the move.</p>}
        </div>
      ) : null}

      <footer className="openingOpportunityActions">
        {!session.revealed && !session.completion ? <button type="button" className="secondaryBtn" onClick={() => persist(revealOpeningOpportunityAnswer(drill, session))}><Eye size={16} /> Show answer</button> : null}
        {(session.completion || session.attempts > 0) ? <button type="button" className="secondaryBtn" onClick={reset}><RotateCcw size={16} /> Practise again</button> : null}
        {onClose ? <button type="button" className="secondaryBtn" onClick={onClose}>Choose another line</button> : null}
      </footer>
    </section>
  );
}
