import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { useAuth } from "../context/AuthDataProvider.jsx";
import ChessPositionBoard from "./ChessPositionBoard.jsx";
import TrainingStreakCard from "./TrainingStreakCard.jsx";
import {
  COACHING_SESSION_STEPS,
  PERSONAL_TRAINING_STORAGE_KEY,
  buildCoachingSessionContent,
  buildPersonalTrainingItems,
  dueTrainingSession,
  evaluatePersonalTrainingMove,
  mergeTrainingState,
} from "../lib/personalOpeningTraining.js";
import { recordMeaningfulCoachingActivity, saveCoachingResponsePlan } from "../services/coachingStateService.js";
import "./PersonalOpeningTrainer.css";

const readLocal = () => { try { return JSON.parse(localStorage.getItem(PERSONAL_TRAINING_STORAGE_KEY) || "{}") || {}; } catch { return {}; } };
const writeLocal = (value) => { try { localStorage.setItem(PERSONAL_TRAINING_STORAGE_KEY, JSON.stringify(value)); } catch { /* Authenticated cloud persistence may still succeed. */ } };
const anonymousOwner = () => { const state = readLocal(); if (state.anonymousOwnerId) return state.anonymousOwnerId; const id = `anonymous:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; writeLocal({ ...state, anonymousOwnerId: id }); return id; };
const STEP_LABELS = { recall: "Recall", decision: "Decision", reveal: "Reveal", rehearse: "Rehearse", commit: "Commit" };

export default function PersonalOpeningTrainer({ report, onAnalyse, onReport }) {
  const { user, settings, saveSettings } = useAuth();
  const ownerId = useMemo(() => user?.id || anonymousOwner(), [user?.id]);
  const cloudState = user?.id ? settings?.preferences?.personalOpeningTraining : null;
  const stored = useMemo(() => user?.id ? cloudState?.items || [] : readLocal().items || [], [cloudState?.items, user?.id]);
  const generated = useMemo(() => buildPersonalTrainingItems({ report: report || {}, ownerId }), [ownerId, report]);
  const initialItems = useMemo(() => mergeTrainingState(generated.items, stored, ownerId), [generated.items, ownerId, stored]);
  const due = useMemo(() => dueTrainingSession(initialItems, { limit: 1 }).items[0] || null, [initialItems]);
  const content = useMemo(() => {
    const next = buildCoachingSessionContent({ item: due, report: report || {} });
    if (due || !next.item) return next;
    const prior = stored.find((row) => row.ownerId === ownerId && row.itemId === next.item.itemId);
    return prior ? { ...next, item: { ...next.item, state: prior.state, createdAt: prior.createdAt, updatedAt: prior.updatedAt } } : next;
  }, [due, ownerId, report, stored]);
  const [item, setItem] = useState(content.item || null);
  const [step, setStep] = useState(content.item?.state?.sessionStep || "recall");
  const [position, setPosition] = useState(content.item?.startingFen || "");
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [plan, setPlan] = useState(content.item?.state?.responsePlan || content.draft || "");
  const [saving, setSaving] = useState(false);
  const [reviewCompleted, setReviewCompleted] = useState(false);
  const completionStarted = useRef(false);

  useEffect(() => {
    setItem(content.item || null);
    setStep(content.item?.state?.sessionStep || "recall");
    setPosition(content.item?.startingFen || "");
    setPlan(content.item?.state?.responsePlan || content.draft || "");
  }, [content]);

  const persistItem = async (nextItem) => {
    if (!nextItem) return;
    setItem(nextItem);
    const nextItems = initialItems.some((row) => row.itemId === nextItem.itemId) ? initialItems.map((row) => row.itemId === nextItem.itemId ? nextItem : row) : [nextItem, ...initialItems];
    const payload = { version: 2, ownerId, items: nextItems, activeItemId: nextItem.itemId, updatedAt: new Date().toISOString() };
    if (user?.id) await saveSettings?.({ preferences: { personalOpeningTraining: payload } });
    else writeLocal({ ...readLocal(), ...payload });
  };

  const goTo = (nextStep) => {
    if (!item) return;
    const nextItem = { ...item, state: { ...item.state, sessionStep: nextStep, responsePlan: plan }, updatedAt: new Date().toISOString() };
    setStep(nextStep); setFeedback(""); setSelected(null); setPosition(item.startingFen || "");
    void persistItem(nextItem);
  };

  const attempt = async (from, to) => {
    if (!item?.startingFen || !["decision", "rehearse"].includes(step)) return;
    const result = evaluatePersonalTrainingMove(item, { from, to, promotion: "q" });
    if (!result.trustworthy || result.reason === "illegal_move") { setFeedback("That move is not legal in this position."); return; }
    setPosition(result.resultingFen); setSelected(null);
    if (!result.accepted) { setFeedback(`${result.san} is legal, but it is not one of the supported responses for this task.`); return; }
    setFeedback(result.alternative ? `${result.san} is also a supported continuation.` : `${result.san} matches the supported response.`);
    const nextItem = { ...item, state: { ...item.state, sessionStep: step, decisionCompleted: true, rehearsalCompleted: step === "rehearse" || item.state?.rehearsalCompleted }, updatedAt: new Date().toISOString() };
    await persistItem(nextItem);
  };

  const squareClick = (square) => {
    if (!item?.startingFen || !["decision", "rehearse"].includes(step)) return;
    const chess = new Chess(position || item.startingFen); const piece = chess.get(square);
    if (!selected) { if (piece?.color === (item.playerColour === "black" ? "b" : "w")) setSelected(square); return; }
    if (selected === square) { setSelected(null); return; }
    void attempt(selected, square);
  };

  const complete = async () => {
    if (!item || !plan.trim() || completionStarted.current || item.state?.sessionCompleted) return;
    completionStarted.current = true; setSaving(true);
    try {
      if (user?.id) {
        await saveCoachingResponsePlan({ userId: user.id, repertoireRole: item.repertoireRole, openingId: item.openingId, diagnosisId: item.diagnosisId, reportId: item.sourceReportId, taskId: item.trainingSubjectId || item.itemId, planText: plan });
        await recordMeaningfulCoachingActivity({ userId: user.id, activityType: "training_session_completed", idempotencyKey: `coaching-session:${item.itemId}`, payload: { task_id: item.trainingSubjectId || item.itemId, report_id: item.sourceReportId, diagnosis_id: item.diagnosisId, opening_id: item.openingId, repertoire_role: item.repertoireRole } });
      }
      await persistItem({ ...item, state: { ...item.state, sessionStep: "commit", responsePlan: plan.trim(), sessionCompleted: true, completedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() });
    } catch (error) { completionStarted.current = false; setFeedback(error?.message || "OpeningFit could not save this session yet."); }
    finally { setSaving(false); }
  };

  if (!content.available || !item) return <section className="personalTrainer personalTrainer--empty"><p className="eyebrow">Personal training</p><h2>No safe coaching task is ready</h2><p>{content.recoveryAction}</p><button type="button" className="primaryBtn" onClick={report ? onReport : onAnalyse}>{report ? "Review source games" : "Import games"}</button></section>;
  if (item.state?.sessionCompleted && !reviewCompleted) return <section className="personalTrainer personalTrainer--complete" aria-live="polite"><p className="eyebrow">Session complete</p><h2>{item.openingName}</h2><p>Your response plan and completion are saved. You can review this session without earning another completion.</p><TrainingStreakCard /><button type="button" onClick={() => setReviewCompleted(true)}>Review session</button><button type="button" onClick={onReport}>Return to report</button></section>;
  if (item.state?.sessionCompleted && reviewCompleted) return <section className="personalTrainer" aria-labelledby="completed-session-review"><p className="eyebrow">Completed session review</p><h1 id="completed-session-review">{item.openingName}</h1><p>{content.reveal}</p><h2>Your response plan</h2><p>{item.state.responsePlan}</p><details><summary>Why this task?</summary><p>{content.provenance.replaceAll("_", " ")}</p></details><button type="button" onClick={() => setReviewCompleted(false)}>Back to completion</button></section>;

  const interactive = content.interactive && ["decision", "rehearse"].includes(step);
  const canAdvanceDecision = !content.interactive || item.state?.decisionCompleted;
  const canAdvanceRehearsal = !content.interactive || item.state?.rehearsalCompleted;
  return <main className="personalTrainer" aria-labelledby="personal-training-title">
    <header><div><p className="eyebrow">Today&apos;s session</p><h1 id="personal-training-title">{item.openingName}</h1><p>{item.repertoireRole.replaceAll("_", " ")} · {content.provenance === "general_setup" ? "General setup rehearsal" : "Recovered position"}</p></div></header>
    <ol className="personalTrainer__steps" aria-label="Coaching session progress">{COACHING_SESSION_STEPS.map((id) => <li key={id} data-active={step === id} data-complete={COACHING_SESSION_STEPS.indexOf(id) < COACHING_SESSION_STEPS.indexOf(step)}>{STEP_LABELS[id]}</li>)}</ol>
    <div className={`personalTrainer__layout ${content.interactive ? "" : "personalTrainer__layout--plan"}`}>
      {content.interactive ? <div className="personalTrainer__board"><ChessPositionBoard position={position || item.startingFen} orientation={content.orientation} interactive={interactive} draggableColor={item.playerColour === "black" ? "b" : "w"} selectedSquare={selected} onSquareClick={squareClick} onPieceDrop={(from, to) => void attempt(from, to)} /></div> : null}
      <section className="personalTrainer__content" aria-live="polite">
        <p className="personalTrainer__mode">{STEP_LABELS[step]}</p>
        {step === "recall" ? <><h2>{content.prompt}</h2><p>Pause and say the plan in your own words before continuing.</p><button type="button" className="primaryBtn" onClick={() => goTo("decision")}>I have my plan</button></> : null}
        {step === "decision" ? <><h2>{content.interactive ? "Choose the supported response" : "Choose the practical plan"}</h2>{content.choices.length > 1 ? <div className="personalTrainer__choices">{content.choices.map((choice) => <button type="button" key={choice} onClick={() => { const accepted = choice === item.expectedMove; setFeedback(`${choice} is ${accepted ? "the primary" : "an accepted"} supported continuation.`); void persistItem({ ...item, state: { ...item.state, decisionCompleted: true, sessionStep: "decision" } }); }}>{choice}</button>)}</div> : content.interactive ? <p>Play the response on the board. OpeningFit will only accept moves retained by the task.</p> : <p>No legal move contract is available, so this remains a plan-level question.</p>}{feedback ? <p className="personalTrainer__feedback" role="status">{feedback}</p> : null}<button type="button" className="primaryBtn" disabled={!canAdvanceDecision} onClick={() => goTo("reveal")}>Reveal the idea</button></> : null}
        {step === "reveal" ? <><h2>The practical idea</h2><p>{content.reveal}</p><details><summary>Why this task?</summary><p>{content.provenance === "verified_source_position" ? `This legal position is retained from source game ${item.sourceGameId}.` : content.provenance === "recognised_opening_pack_line" ? "This uses a recognised opening-pack line; it is not an engine-best-move claim." : content.provenance === "verified_position" ? "This legal position and response are retained by the canonical diagnosis; no source-game result is claimed." : "This is a general setup based on the canonical opening and role. No exact source position or engine evaluation is claimed."}</p><p>{item.evidence?.occurrences || 0} supporting occurrence{item.evidence?.occurrences === 1 ? "" : "s"} · {item.evidence?.confidence || "unknown"} confidence</p></details><button type="button" className="primaryBtn" onClick={() => goTo("rehearse")}>Rehearse</button></> : null}
        {step === "rehearse" ? <><h2>{content.interactive ? "Play it once more" : "Rehearse the setup aloud"}</h2><p>{content.interactive ? "Use the board from your side. The orientation and side to move come from the validated task." : content.reveal}</p>{feedback ? <p className="personalTrainer__feedback" role="status">{feedback}</p> : null}{!content.interactive ? <button type="button" className="secondaryBtn" onClick={() => void persistItem({ ...item, state: { ...item.state, rehearsalCompleted: true, sessionStep: "rehearse" } })}>I rehearsed this plan</button> : null}<button type="button" className="primaryBtn" disabled={!canAdvanceRehearsal} onClick={() => goTo("commit")}>Write my response plan</button></> : null}
        {step === "commit" ? <><h2>Commit your response plan</h2><label htmlFor="personal-response-plan">Your editable plan</label><textarea id="personal-response-plan" value={plan} maxLength={4000} rows={4} onChange={(event) => setPlan(event.target.value)} /><small>The starting draft comes only from the supported task. Edit it into words you will remember.</small>{feedback ? <p className="personalTrainer__feedback" role="status">{feedback}</p> : null}<button type="button" className="primaryBtn" disabled={!plan.trim() || saving} onClick={complete}>{saving ? "Saving…" : "Save plan and complete"}</button></> : null}
      </section>
    </div>
  </main>;
}
