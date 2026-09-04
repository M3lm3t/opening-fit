import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { useAuth } from "../context/AuthDataProvider.jsx";
import { useMissionFeatureState } from "../context/MissionFeatureProvider.jsx";
import ChessPositionBoard from "./ChessPositionBoard.jsx";
import { completeTrainingSession, dismissMission, getCurrentMission, getCurrentTrainingSession, listMissionHistory, missionActionKey, selectNextMission, startTrainingSession, submitTrainingAttempt } from "../services/missionApi.js";
import { confidenceCopy, missionAction, missionStatement, missionStatusLabel, normaliseMissionResponse, provenanceLabel, roleLabel } from "../lib/missionPresentation.js";
import { useAccessibleDialog } from "../lib/dialogAccessibility.js";
import { trackProductEvent } from "../lib/productAnalytics.js";
import "./MissionExperience.css";

function useMission(onAvailabilityChange) {
  const { user } = useAuth();
  const [state, setState] = useState({ kind: user?.id ? "loading" : "disabled", mission: null });
  const refresh = useCallback(async () => {
    if (!user?.id) { setState({ kind: "disabled", mission: null }); return; }
    try { const payload = await getCurrentMission({ dedupeKey: user.id }); setState((known) => normaliseMissionResponse(payload, known)); }
    catch (error) { if (error?.name !== "AbortError") setState((known) => normaliseMissionResponse({ reasonCode: error.code }, known)); }
  }, [user?.id]);
  useEffect(() => { let active = true; if (user?.id) getCurrentMission({ dedupeKey: user.id }).then((payload) => { if (active) setState((known) => normaliseMissionResponse(payload, known)); }).catch((error) => { if (active && error?.name !== "AbortError") setState((known) => normaliseMissionResponse({ reasonCode: error.code }, known)); }); return () => { active = false; }; }, [user?.id]);
  useEffect(() => { onAvailabilityChange?.(Boolean(state.mission)); }, [onAvailabilityChange, state.mission]);
  useEffect(() => { if (state.mission?.id) void trackProductEvent("mission_card_viewed", { surface: "home", tier: state.capabilities?.tier, cohort: state.rolloutCohort }, { onceKey: `home:${state.mission.id}` }); }, [state.capabilities?.tier, state.mission?.id, state.rolloutCohort]);
  return { state, refresh, setState, user };
}

function Evidence({ mission }) {
  const correction = mission.accepted_correction_moves?.map((move) => move.san || move.uci).join(" or ") || "Prepared response";
  return <div className="missionEvidenceGrid">
    <div className="missionEvidenceBoard"><ChessPositionBoard position={mission.position_fen} orientation={mission.player_turn} interactive={false} /></div>
    <dl><div><dt>Opening role</dt><dd>{mission.opening_name || mission.opening_id} · {roleLabel(mission.role)}</dd></div><div><dt>Repeated move</dt><dd>{mission.repeated_played_move_san || mission.repeated_played_move_uci}</dd></div><div><dt>Prepared response</dt><dd>{correction}</dd></div><div><dt>Supporting games</dt><dd>{mission.baseline_evidence_count || 0}</dd></div><div><dt>Source</dt><dd>{provenanceLabel(mission.correction_source)}</dd></div><div><dt>Confidence</dt><dd>{confidenceCopy(mission)}</dd></div></dl>
  </div>;
}

function ProgressCopy({ mission }) {
  const evidence = mission.evidence_summary || {};
  const correct = Number(evidence.correct ?? evidence.correctCount ?? 0);
  const repeated = Number(evidence.repeatedMistake ?? evidence.repeated_mistake ?? 0);
  const other = Number(evidence.otherLegal ?? evidence.other_legal ?? 0);
  if (mission.status === "awaiting_evidence") return <p>Now prove it in a real game. {correct + repeated + other ? `${correct} correct, ${repeated} repeated and ${other} other legal responses in new encounters.` : "Not seen again yet. That’s normal—your mission stays ready until the position returns."}</p>;
  if (mission.status === "improving") return <p>You found the prepared move in {correct} of {correct + repeated} qualifying new encounters. More evidence is needed.</p>;
  if (mission.status === "needs_review") return <p>This move appeared again. You repeated the old move in {repeated} new games.</p>;
  if (mission.status === "repaired") return <p>Opening leak repaired from future-game evidence{mission.repaired_at ? ` on ${new Date(mission.repaired_at).toLocaleDateString()}` : ""}.</p>;
  return <p>You reached this position in {mission.baseline_evidence_count || 0} analysed games and repeated the same move.</p>;
}

function EnabledCurrentMissionCard({ onTrain, onReport, onAnalyse, onAvailabilityChange }) {
  const { state, refresh, setState, user } = useMission(onAvailabilityChange);
  const [pending, setPending] = useState(false); const [dismissOpen, setDismissOpen] = useState(false); const [error, setError] = useState("");
  const dismissKey = useRef(null);
  const dialogRef = useRef(null); const closeDismiss = useCallback(() => setDismissOpen(false), []);
  useAccessibleDialog(dialogRef, dismissOpen, closeDismiss);
  if (!user?.id || state.kind === "disabled" || (state.kind === "loading" && !state.mission)) return null;
  if (state.kind === "unavailable" && !state.mission) return <section className="missionCard missionCard--quiet" role="status"><strong>Your Mission is temporarily unavailable</strong><p>Your other OpeningFit tools are ready.</p><button type="button" onClick={refresh}>Try again</button></section>;
  if (!state.mission) {
    if (state.kind === "no_candidate") return <section className="missionCard missionCard--quiet"><h2>Current Mission</h2><p>No repeated opening leak is clear enough yet. Keep playing and OpeningFit will check again.</p></section>;
    if (state.kind === "analysis_required") return <section className="missionCard missionCard--quiet"><h2>Find your Mission</h2><p>Analyse your recent games to find a repeated opening leak.</p><button className="primaryBtn" onClick={onAnalyse}>Analyse games</button></section>;
    if (state.kind === "no_active_mission") { const limited = state.capabilities?.reasonCode === "free_allowance_exhausted"; return <section className="missionCard missionCard--quiet"><h2>Choose your next Mission</h2><p>{limited ? `Your current mission and its verification remain available.${state.capabilities?.nextMissionAvailableAt ? ` Your next free Mission is available ${new Date(state.capabilities.nextMissionAvailableAt).toLocaleDateString()}.` : ""}` : "OpeningFit can check your persisted trusted candidates without reanalysing your full history."}</p>{limited ? <><p>OpeningFit Plus unlocks continuous new missions and full mission history.</p><button className="secondaryBtn" onClick={() => void trackProductEvent("mission_upgrade_clicked", { surface: "mission_empty", tier: state.capabilities?.tier })}>View OpeningFit Plus</button></> : <button className="primaryBtn" disabled={pending} onClick={async () => { setPending(true); try { const result = await selectNextMission(missionActionKey("select-next")); if (result.reasonCode) setState(normaliseMissionResponse(result)); else await refresh(); } catch (e) { setError(e.message); } finally { setPending(false); } }}>Find my next Mission</button>}{error ? <p role="alert" className="missionError">{error}</p> : null}</section>; }
    return null;
  }
  const mission = state.mission;
  const act = async () => {
    if (["assigned", "learning", "needs_review"].includes(mission.status)) { onTrain?.(); return; }
    if (mission.status === "repaired") { setPending(true); try { await selectNextMission(missionActionKey("select-next")); await refresh(); } catch (e) { setError(e.message); } finally { setPending(false); } return; }
    onReport?.();
  };
  const confirmDismiss = async (reason) => { setPending(true); dismissKey.current ||= missionActionKey("dismiss"); try { await dismissMission(mission.id, reason, dismissKey.current); setDismissOpen(false); await refresh(); } catch (e) { setError(e.message); } finally { setPending(false); } };
  return <section className={`missionCard missionCard--${mission.status}`} aria-labelledby="current-mission-title">
    <div className="missionCardHeader"><div><p className="missionEyebrow">{missionStatusLabel(mission.status)}</p><h2 id="current-mission-title">{mission.opening_name || mission.opening_id} · {roleLabel(mission.role)}</h2></div></div>
    <h3>{missionStatement(mission)}</h3><ProgressCopy mission={mission} />
    {error ? <p role="alert" className="missionError">{error}</p> : null}
    <div className="missionActions"><button type="button" className="primaryBtn" disabled={pending} onClick={() => { void trackProductEvent("mission_start_clicked", { surface: "home", tier: state.capabilities?.tier }); void act(); }}>{missionAction(mission.status)}</button><button type="button" className="secondaryBtn" onClick={() => { void trackProductEvent("mission_why_opened", { surface: "home", tier: state.capabilities?.tier }, { onceKey: mission.id }); onReport?.(); }}>Why this?</button>{!["repaired", "dismissed", "superseded"].includes(mission.status) ? <button type="button" className="ghostBtn" onClick={() => { void trackProductEvent("mission_dismiss_opened", { surface: "home", tier: state.capabilities?.tier }, { onceKey: mission.id }); setDismissOpen(true); }}>Dismiss</button> : null}</div>
    {dismissOpen ? <div className="missionDialogBackdrop" role="presentation"><div ref={dialogRef} className="missionDialog" role="dialog" aria-modal="true" aria-labelledby="dismiss-mission-title"><h2 id="dismiss-mission-title">Dismiss this Mission?</h2><p>Choose the reason that best fits. This does not delete your report.</p>{[["wrong_opening", "Not part of my repertoire"], ["not_relevant", "I already know this"], ["prefer_another", "I don’t want to train this position"], ["other", "Other"]].map(([code, label]) => <button key={code} type="button" disabled={pending} onClick={() => confirmDismiss(code)}>{label}</button>)}<button type="button" onClick={closeDismiss}>Cancel</button></div></div> : null}
  </section>;
}

function EnabledMissionEvidencePanel() {
  const { state, user } = useMission(); const [history, setHistory] = useState([]); const [cursor, setCursor] = useState(null); const [open, setOpen] = useState(false);
  if (!user?.id || state.kind === "disabled" || !state.mission) return null;
  const loadHistory = async () => { const result = await listMissionHistory({ limit: 10, cursor }); setHistory((rows) => [...rows, ...(result.missions || [])]); setCursor(result.nextCursor || null); setOpen(true); };
  return <section className="missionEvidencePanel" id="mission-evidence"><p className="missionEyebrow">Why this Mission</p><h2>{missionStatement(state.mission)}</h2><p>{confidenceCopy(state.mission)}</p><Evidence mission={state.mission} /><button type="button" className="secondaryBtn" onClick={loadHistory}>{open ? "Load more past Missions" : "Past Missions"}</button>{open ? <ul className="missionHistory">{history.map((item) => <li key={item.id}><strong>{item.opening_name || item.opening_id}</strong><span>{roleLabel(item.role)} · {missionStatusLabel(item.status)}</span><small>{item.repaired_at || item.dismissed_at || item.superseded_at || item.assigned_at || item.created_at ? new Date(item.repaired_at || item.dismissed_at || item.superseded_at || item.assigned_at || item.created_at).toLocaleDateString() : ""}</small></li>)}</ul> : null}{open && cursor ? <button type="button" onClick={loadHistory}>Load more</button> : null}</section>;
}

function EnabledMissionTrainingPanel({ onHome, onAnalyse, onReport }) {
  const { state, refresh, user } = useMission(); const [session, setSession] = useState(null); const [phase, setPhase] = useState("idle"); const [selected, setSelected] = useState(null); const [feedback, setFeedback] = useState(null); const [lastMove, setLastMove] = useState([]); const [error, setError] = useState(""); const startKey = useRef(null); const completeKey = useRef(null); const attemptKey = useRef(null);
  const mission = state.mission;
  useEffect(() => { if (!user?.id || !mission?.id || !["learning", "needs_review"].includes(mission.status)) return; const controller = new AbortController(); getCurrentTrainingSession(mission.id, { signal: controller.signal }).then((result) => { if (result.session) { setSession(result.session); setPhase("active"); } }).catch(() => {}); return () => controller.abort(); }, [mission?.id, mission?.status, user?.id]);
  if (!user?.id || state.kind === "disabled" || !mission) return null;
  if (["awaiting_evidence", "improving"].includes(mission.status)) return <section className="missionTraining missionTraining--waiting"><p className="missionEyebrow">Mission training</p><h2>Now prove it in a real game</h2><p>Training complete. OpeningFit will check for this position in newly analysed games.</p><div><button className="primaryBtn" onClick={onAnalyse}>Analyse new games</button><button className="secondaryBtn" onClick={onReport}>Review what you learned</button></div></section>;
  if (mission.status === "repaired") return <section className="missionTraining missionTraining--complete"><p className="missionEyebrow">Opening leak repaired</p><h2>{mission.opening_name}</h2><button className="primaryBtn" onClick={onHome}>Back to Home</button></section>;
  const start = async () => { setPhase("creating"); setError(""); startKey.current ||= missionActionKey("start-session"); try { const result = await startTrainingSession(mission.id, startKey.current); setSession(result.session); setPhase("active"); await refresh(); } catch (e) { setError(e.message); setPhase("error"); } };
  const exercise = session?.currentExercise;
  const attempt = async (from, to) => { if (!exercise || ["submitting", "completing"].includes(phase)) return; if (typeof navigator !== "undefined" && navigator.onLine === false) { setError("Reconnect to submit this training move."); return; } let move; try { const chess = new Chess(exercise.fen); move = chess.moves({ square: from, verbose: true }).find((row) => row.to === to); } catch { move = null; } if (!move) { setError("That move is not legal in this position."); setSelected(null); return; } const uci = `${move.from}${move.to}${move.promotion || ""}`; setPhase("submitting"); setError(""); if (attemptKey.current?.uci !== uci) attemptKey.current = { uci, key: missionActionKey("attempt") }; try { const result = await submitTrainingAttempt(mission.id, session.id, exercise.exerciseId, uci, attemptKey.current.key); attemptKey.current = null; setFeedback(result); setLastMove([move.from, move.to]); setSession(result.session); setPhase("feedback"); } catch (e) { setError(e.message); setPhase("active"); } finally { setSelected(null); } };
  const squareClick = (square) => { if (!exercise || phase === "submitting") return; const chess = new Chess(exercise.fen); const piece = chess.get(square); const colour = exercise.sideToMove === "black" ? "b" : "w"; if (!selected) { if (piece?.color === colour) setSelected(square); return; } if (selected === square) { setSelected(null); return; } void attempt(selected, square); };
  const complete = async () => { setPhase("completing"); completeKey.current ||= missionActionKey("complete"); try { const result = await completeTrainingSession(mission.id, session.id, completeKey.current); setSession(result.session); setPhase(result.completed ? "completed" : "incomplete"); await refresh(); } catch (e) { setError(e.message); setPhase("error"); } };
  if (!session) return <section className="missionTraining"><p className="missionEyebrow">{mission.status === "needs_review" ? "Review needed" : "Your current Mission"}</p><h2>{missionStatement(mission)}</h2><p>This uses the exact position OpeningFit found in your games.</p>{error ? <p role="alert" className="missionError">{error}</p> : null}<button type="button" className="primaryBtn" disabled={phase === "creating"} onClick={start}>{phase === "creating" ? "Preparing…" : mission.status === "needs_review" ? "Review Mission" : "Start Mission"}</button></section>;
  if (phase === "completed" || session.status === "completed") return <section className="missionTraining missionTraining--complete" aria-live="polite"><p className="missionEyebrow">Training complete</p><h2>{missionStatement(mission)}</h2><p>OpeningFit will now watch your newly analysed games for this position.</p><button className="primaryBtn" onClick={onHome}>Back to Home</button></section>;
  return <section className="missionTraining" aria-labelledby="mission-training-title"><header><div><p className="missionEyebrow">Mission training</p><h2 id="mission-training-title">{mission.opening_name} · {roleLabel(mission.role)}</h2><p>{session.exerciseCount === 1 ? "Your key position — the exact position OpeningFit found in your games." : `${session.progress?.solvedCount || 0} solved of ${session.exerciseCount}`}</p></div></header>{exercise ? <div className="missionTrainingLayout"><div className="missionBoard"><ChessPositionBoard position={exercise.fen} orientation={exercise.boardOrientation} interactive={phase !== "submitting"} draggableColor={exercise.sideToMove === "black" ? "b" : "w"} selectedSquare={selected} lastMoveSquares={lastMove} onSquareClick={squareClick} onPieceDrop={attempt} /></div><div className="missionTrainingPrompt" aria-live="polite"><h3>{exercise.prompt || "Find your prepared move."}</h3><p>{phase === "submitting" ? "Checking your move…" : "Play your move on the board. OpeningFit validates it on the server."}</p>{feedback ? <div className={`missionFeedback missionFeedback--${feedback.result}`} role="status"><strong>{feedback.feedback}</strong>{feedback.acceptedMoves?.length ? <p>Prepared response: {feedback.acceptedMoves.map((move) => move.san).join(" or ")}</p> : null}</div> : null}{error ? <p className="missionError" role="alert">{error}</p> : null}{feedback?.progress?.eligible ? <button className="primaryBtn" disabled={phase === "completing"} onClick={complete}>{phase === "completing" ? "Completing…" : "Complete session"}</button> : feedback ? <button className="secondaryBtn" onClick={() => { setFeedback(null); setLastMove([]); setPhase("active"); }}>Try again</button> : null}</div></div> : <div className="missionTrainingPrompt"><h3>All positions attempted</h3>{session.progress?.eligible ? <button className="primaryBtn" onClick={complete}>Complete session</button> : <><p>One or more positions still need the prepared response.</p><button className="secondaryBtn" onClick={() => setPhase("active")}>Continue</button></>}</div>}</section>;
}

export function CurrentMissionCard(props) {
  return useMissionFeatureState() === "enabled" ? <EnabledCurrentMissionCard {...props} /> : null;
}

export function MissionEvidencePanel(props) {
  return useMissionFeatureState() === "enabled" ? <EnabledMissionEvidencePanel {...props} /> : null;
}

export function MissionTrainingPanel(props) {
  return useMissionFeatureState() === "enabled" ? <EnabledMissionTrainingPanel {...props} /> : null;
}
