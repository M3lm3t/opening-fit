import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ExternalLink, Play, RotateCcw } from "lucide-react";
import GameReplayBoard from "./GameReplayBoard.jsx";
import {
  loadOpeningOpportunityProgress,
  saveOpeningOpportunityProgress,
  updateOpeningOpportunityReviewProgress,
} from "../lib/openingOpportunityDrills.js";
import {
  buildTrainingReviewSelection,
  deriveKnownLineConcept,
  nextTrainingSessionStep,
  recentGamesReviewCopy,
  restoredTrainingSessionStep,
  trainingReviewFunnelCopy,
  trainingReviewRequirements,
} from "../lib/trainingGameReview.js";
import { formatOpeningNameForDisplay } from "../lib/openingNamePresentation.js";
import { useAuth } from "../context/AuthDataProvider.jsx";
import { canUseFeature, OPENINGFIT_FEATURES } from "../lib/premiumEntitlement.js";
import { buildTrainingResponsePlanRecord, trainingResponsePlans } from "../lib/premiumContinuity.js";
import { roleGapCopy, TRAINING_SUBJECT_TYPES } from "../lib/trainingPriority.js";
import "./TrainingGameReviewSession.css";

const STEPS = [
  { id: "focus", number: 1, label: "Focus" },
  { id: "review", number: 2, label: "Review" },
  { id: "concept", number: 3, label: "Concept" },
  { id: "commit", number: 4, label: "Commit" },
];

function displayDate(value) {
  const parsed = Date.parse(value);
  return parsed ? new Date(parsed).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Date not recorded";
}

function sourceType(exercise) {
  if (exercise?.kind === "role_gap_guidance") return "General repertoire guidance";
  if (exercise?.provenance?.fictional) return "Fictional example";
  if (exercise?.kind === "own_game_position") return "Own-game position";
  return exercise?.drill?.knownLine ? "General opening setup grounded in supplied game data" : "General opening setup";
}

function TrainingStep({ step, active, complete, onOpen, children }) {
  const headingId = `training-${step.id}-title`;
  return <section className={`trainingReviewStep ${active ? "trainingReviewStep--active" : ""} ${complete ? "trainingReviewStep--complete" : ""}`} aria-labelledby={headingId}>
    <button type="button" className="trainingReviewStep__toggle" onClick={onOpen} aria-expanded={active} aria-controls={`training-${step.id}-content`}>
      <span className="trainingReviewStep__number" aria-hidden="true">{complete ? <Check size={16} /> : step.number}</span>
      <span><strong id={headingId}>{step.label}</strong><small>{complete ? "Completed · reopen step" : active ? "Current step" : "Open step"}</small></span>
    </button>
    <div className="trainingReviewStep__content" id={`training-${step.id}-content`} hidden={!active}>{children}</div>
  </section>;
}

export default function TrainingGameReviewSession({ report, priority, exercise, taskId = "", planId = "", conceptEngaged, onReadinessChange, children }) {
  const { user, entitlement, settings, saveSettings } = useAuth();
  const fictional = Boolean(exercise?.provenance?.fictional);
  const canSyncPlan = Boolean(user?.id && canUseFeature(entitlement, OPENINGFIT_FEATURES.WEEKLY_PLAN));
  const cloudPlans = trainingResponsePlans(settings);
  const cloudPlan = taskId ? cloudPlans[taskId] : null;
  const roleGap = priority?.subjectType === TRAINING_SUBJECT_TYPES.ROLE_GAP;
  const roleCopy = roleGap ? roleGapCopy(priority.subjectRole) : null;
  const drillId = exercise?.drill?.id || `openingfit-training-review:${taskId || "unknown"}`;
  const opening = roleGap ? roleCopy.label : formatOpeningNameForDisplay(exercise?.drill?.openingName || priority?.openingName || "this opening");
  const selection = useMemo(() => roleGap ? { games: [], funnel: { relevantGamesFound: 0, usableOpeningAndColour: 0, validPgn: 0, validExternalUrls: 0, selected: 0 } } : buildTrainingReviewSelection(report || {}, priority || {}, exercise?.priorityReason), [exercise?.priorityReason, priority, report, roleGap]);
  const games = selection.games;
  const funnelCopy = trainingReviewFunnelCopy(selection.funnel, opening);
  const [activeGameId, setActiveGameId] = useState("");
  const initialSaved = useMemo(() => ({ ...(fictional ? {} : loadOpeningOpportunityProgress()[drillId] || {}), ...(cloudPlan?.responsePlan ? { responsePlan: cloudPlan.responsePlan } : {}) }), [cloudPlan, drillId, fictional]);
  const [saved, setSaved] = useState(initialSaved);
  const [responsePlan, setResponsePlan] = useState(() => initialSaved.responsePlan || exercise?.drill?.suggestedResponsePlan || "");
  const [saveStatus, setSaveStatus] = useState("");
  const [activeStep, setActiveStep] = useState("focus");
  const [focusComplete, setFocusComplete] = useState(false);
  const [reviewAgain, setReviewAgain] = useState(false);
  const stepRefs = useRef({});
  const reviewedGameIds = useMemo(() => Array.isArray(saved.reviewedGameIds) ? saved.reviewedGameIds : [], [saved.reviewedGameIds]);
  const conceptComplete = Boolean(conceptEngaged || saved.attempts > 0 || saved.completion || saved.revealed);
  const conceptAutoAdvancedRef = useRef(conceptComplete);
  const requirements = useMemo(() => trainingReviewRequirements({ games, reviewedGameIds, conceptEngaged: conceptComplete, responsePlan: saved.responsePlan }), [conceptComplete, games, reviewedGameIds, saved.responsePlan]);
  const hasActionableGames = games.some((game) => game.hasInternalReplay || game.sourceUrl);
  const activeGame = games.find((game) => game.id === activeGameId);
  const knownLine = activeGame ? deriveKnownLineConcept(activeGame, opening) : games.map((game) => deriveKnownLineConcept(game, opening)).find(Boolean);
  const diagnosis = priority?.openingDiagnosis || priority?.opening_diagnosis || null;
  const diagnosedPly = Number.isInteger(Number(diagnosis?.targetPly ?? priority?.classificationPly)) ? Number(diagnosis?.targetPly ?? priority?.classificationPly) : null;

  const openStep = (step) => {
    setActiveStep(step);
    window.setTimeout(() => stepRefs.current[step]?.focus?.(), 0);
  };

  useEffect(() => {
    setSaved(initialSaved);
    setResponsePlan(initialSaved.responsePlan || exercise?.drill?.suggestedResponsePlan || "");
    setActiveGameId("");
    setReviewAgain(false);
    setFocusComplete(Boolean(initialSaved.responsePlan || initialSaved.attempts > 0 || initialSaved.completion || initialSaved.revealed || initialSaved.reviewedGameIds?.length));
    setActiveStep(restoredTrainingSessionStep(initialSaved));
  }, [exercise?.drill?.suggestedResponsePlan, initialSaved]);

  useEffect(() => { onReadinessChange?.(requirements); }, [onReadinessChange, requirements]);
  useEffect(() => {
    if (!conceptComplete) {
      conceptAutoAdvancedRef.current = false;
      return;
    }
    if (activeStep === "concept" && !conceptAutoAdvancedRef.current) {
      conceptAutoAdvancedRef.current = true;
      setActiveStep(nextTrainingSessionStep("concept", "engaged"));
      window.setTimeout(() => stepRefs.current.commit?.focus?.(), 0);
    }
  }, [activeStep, conceptComplete]);

  const persist = (changes) => {
    const base = fictional ? { [drillId]: saved } : loadOpeningOpportunityProgress();
    const next = updateOpeningOpportunityReviewProgress(base, drillId, changes);
    if (!fictional) saveOpeningOpportunityProgress(next);
    setSaved(next[drillId]);
  };

  const markReviewed = (game) => {
    persist({ reviewedGameIds: [...reviewedGameIds, game.id] });
    openStep(nextTrainingSessionStep("review", "reviewed"));
  };

  const savePlan = async () => {
    const trimmed = responsePlan.trim();
    if (!trimmed) return;
    if (fictional) { setSaveStatus("Fictional example plans are not saved."); return; }
    const responsePlanMetadata = buildTrainingResponsePlanRecord({
      existing: cloudPlan || saved.responsePlanMetadata || {}, taskId, planId, responsePlan: trimmed, openingName: roleGap ? null : opening,
      priority: { ...priority, lineOrPosition: priority?.lineOrPosition || exercise?.drill?.positionFen || exercise?.drill?.line || null },
      sourceType: exercise?.kind === "own_game_position" ? "own game" : "general setup",
    });
    persist({ responsePlan: trimmed, responsePlanMetadata });
    setReviewAgain(false);
    if (!canSyncPlan || !taskId) { setSaveStatus("Plan saved on this device."); return; }
    setSaveStatus("Syncing response plan…");
    const savedSourceType = exercise?.kind === "own_game_position" ? "own game" : "general setup";
    try {
      await saveSettings?.({ preferences: { trainingResponsePlans: { ...cloudPlans, [taskId]: { ...responsePlanMetadata, sourceType: savedSourceType, synced: true } } } });
      setSaveStatus("Plan saved across your OpeningFit account.");
    } catch {
      setSaveStatus("Plan saved on this device. Cloud sync can be retried later.");
    }
  };

  const completed = requirements.complete && !reviewAgain;
  const stepComplete = {
    focus: roleGap ? focusComplete : focusComplete || requirements.reviewComplete || requirements.conceptComplete || requirements.planComplete,
    review: requirements.reviewComplete,
    concept: requirements.conceptComplete,
    commit: requirements.planComplete,
  };

  if (completed) {
    const reviewed = games.find((game) => reviewedGameIds.includes(game.id));
    return <section className="trainingReviewSession trainingReviewSession--complete" aria-labelledby="training-review-session-title" aria-live="polite">
      <CheckCircle2 size={30} aria-hidden="true" />
      <div><span>Session complete</span><h3 id="training-review-session-title">Plan saved for {opening}</h3><p>{roleGap ? "Use this choice in five correctly attributed games before rerunning the report." : "Check whether this opening recurs in a future comparable report."}</p></div>
      <dl className="trainingReviewCompletion">
        <div><dt>{roleGap ? "Repertoire role" : "Opening trained"}</dt><dd>{opening}</dd></div>
        {!roleGap ? <div><dt>Source game reviewed</dt><dd>{reviewed ? `${reviewed.opponent} · ${displayDate(reviewed.playedAt)}` : hasActionableGames ? "One supplied game" : "No recoverable source game required"}</dd></div> : null}
        <div><dt>Concept</dt><dd>Completed</dd></div>
        <div><dt>Saved response plan</dt><dd>{saved.responsePlan}</dd></div>
        <div><dt>Source type</dt><dd>{sourceType(exercise)}</dd></div>
      </dl>
      <p role="status">{saveStatus || "Plan saved on this device."}</p>
      <button type="button" className="secondaryBtn" onClick={() => { setReviewAgain(true); openStep("review"); }}><RotateCcw size={16} /> Review again</button>
    </section>;
  }

  return <section className="trainingReviewSession" aria-labelledby="training-review-session-title">
    <header className="trainingReviewSession__header"><span>Approximately 10 minutes</span><h3 id="training-review-session-title">One focused review session</h3></header>
    <nav className="trainingReviewProgress" aria-label="Training session steps"><ol>{STEPS.filter((step) => !roleGap || step.id !== "review").map((step) => <li key={step.id} data-active={activeStep === step.id} data-complete={stepComplete[step.id]}><button ref={(node) => { stepRefs.current[step.id] = node; }} type="button" onClick={() => setActiveStep(step.id)} aria-current={activeStep === step.id ? "step" : undefined}><span>{stepComplete[step.id] ? <Check size={14} aria-hidden="true" /> : step.number}</span>{step.label}<small className="srOnly">{stepComplete[step.id] ? " completed" : ""}</small></button></li>)}</ol></nav>
    <p className="srOnly" role="status" aria-live="polite">Current training step: {STEPS.find((step) => step.id === activeStep)?.label}.</p>

    <TrainingStep step={STEPS[0]} active={activeStep === "focus"} complete={stepComplete.focus} onOpen={() => setActiveStep("focus")}>
      <span>Approximately 30 seconds</span><h4>Why this topic was selected</h4><p>{roleGap ? `No correctly attributed opening is established for ${opening} yet.` : exercise?.priorityReason?.text || `This report selected ${opening} as a practical preparation topic; it is not automatically a diagnosed weakness.`}</p>
      {funnelCopy ? <p className="trainingReviewFunnelSummary">{funnelCopy}</p> : null}
      <button type="button" className="primaryBtn" onClick={() => { setFocusComplete(true); openStep(roleGap ? "concept" : nextTrainingSessionStep("focus", "continue")); }}>{roleGap ? "Continue to repertoire choice" : "Continue to game review"}</button>
    </TrainingStep>

    {!roleGap ? <TrainingStep step={STEPS[1]} active={activeStep === "review"} complete={stepComplete.review} onOpen={() => setActiveStep("review")}>
      <span>Approximately 6 minutes</span><h4>{recentGamesReviewCopy(games.length)}</h4>
      {funnelCopy ? <p>{funnelCopy}</p> : null}
      <details className="trainingReviewFunnel"><summary>Source-game availability</summary><dl><div><dt>Relevant games found</dt><dd>{selection.funnel.relevantGamesFound}</dd></div><div><dt>Usable opening and colour</dt><dd>{selection.funnel.usableOpeningAndColour}</dd></div><div><dt>Valid PGN</dt><dd>{selection.funnel.validPgn}</dd></div><div><dt>Valid external URL</dt><dd>{selection.funnel.validExternalUrls}</dd></div><div><dt>Selected for this session</dt><dd>{selection.funnel.selected}</dd></div></dl></details>
      {!hasActionableGames ? <p>{games.length ? "Matching metadata is retained, but no replay or validated source link is recoverable. Continue to the general concept." : "No matching source game is stored. Continue to the general concept."}</p> : null}
      {games.length ? <div className="trainingReviewGames">{games.map((game, index) => <article className="trainingReviewGame" key={game.id} aria-labelledby={`training-game-${index}`}>
        <header><div><span>{game.platform}</span><h5 id={`training-game-${index}`}>{game.opening || opening}</h5></div><strong>{game.result}</strong></header>
        <dl><div><dt>Opponent</dt><dd>{game.opponent}</dd></div><div><dt>Played as</dt><dd>{game.userColour || "Colour not recorded"}</dd></div><div><dt>Date</dt><dd>{displayDate(game.playedAt)}</dd></div><div><dt>Time control</dt><dd>{game.timeControl}</dd></div><div><dt>Event</dt><dd>{game.event}</dd></div></dl>
        <p><strong>Why selected:</strong> {game.whySelected}</p>
        <div className="trainingReviewGame__actions">{game.hasInternalReplay ? <button type="button" className="primaryBtn" onClick={() => setActiveGameId(activeGameId === game.id ? "" : game.id)}><Play size={16} /> {activeGameId === game.id ? "Collapse review" : "Review in OpeningFit"}</button> : null}{game.sourceUrl ? <a className="secondaryBtn" href={game.sourceUrl} target="_blank" rel="noreferrer">Open {game.platform} source game <ExternalLink size={15} aria-hidden="true" /><span className="srOnly"> (opens in a new tab)</span></a> : null}{!game.hasInternalReplay && game.sourceUrl ? <button type="button" className="primaryBtn" onClick={() => markReviewed(game)}>Mark source game reviewed and continue</button> : null}{!game.hasInternalReplay && !game.sourceUrl ? <span className="trainingReviewUnavailable">Replay and source link are not retained in this saved report.</span> : null}</div>
      </article>)}</div> : null}
      {activeGame ? <div className="trainingReviewReplay"><div className="trainingReviewReplay__cue"><strong>Opening decision point</strong>{diagnosis?.userFacingDiagnosis ? <p>{diagnosis.userFacingDiagnosis}</p> : knownLine?.line ? <p>Position selected for plan practice after: {knownLine.line}</p> : <p>Use the replay to review the early plan; no error position is claimed.</p>}</div><GameReplayBoard key={activeGame.id} game={activeGame} title={`Review position · ${activeGame.opening || opening}`} initialOrientation={diagnosis?.playerColour || activeGame.userColour || "white"} initialMoveIndex={diagnosedPly ?? knownLine?.moves?.length ?? 0} /><button type="button" className="primaryBtn" onClick={() => markReviewed(activeGame)}>Mark reviewed and continue</button></div> : null}
      {!hasActionableGames ? <button type="button" className="primaryBtn" onClick={() => openStep(nextTrainingSessionStep("review", "no_source"))}>Continue to concept</button> : null}
    </TrainingStep> : null}

    <TrainingStep step={STEPS[2]} active={activeStep === "concept"} complete={stepComplete.concept} onOpen={() => setActiveStep("concept")}>
      <span>Approximately 2 minutes</span><h4>Choose the plan to remember</h4>{children}
    </TrainingStep>

    <TrainingStep step={STEPS[3]} active={activeStep === "commit"} complete={stepComplete.commit} onOpen={() => setActiveStep("commit")}>
      <span>Approximately 1 minute</span><h4>Save your response plan</h4><p>The suggested starting point is editable and is not saved until you choose Save. {exercise?.kind === "own_game_position" ? "Its trigger comes from the supplied game position." : "It is general opening guidance, not a conclusion about a specific move in your games."}</p>
      <label htmlFor={`training-plan-${drillId}`}>When this position appears, what will you try to remember?</label>
      <textarea id={`training-plan-${drillId}`} value={responsePlan} maxLength={240} onChange={(event) => setResponsePlan(event.target.value)} placeholder="Write one short, practical cue." />
      <button type="button" className="primaryBtn" disabled={!responsePlan.trim()} onClick={savePlan}>Save my plan</button>{saveStatus ? <small role="status">{saveStatus}</small> : null}
    </TrainingStep>

    <div className="trainingReviewChecklist" aria-label="Session completion requirements"><strong>Complete when</strong>{!roleGap ? <span data-complete={requirements.reviewComplete}><Check size={15} /> {hasActionableGames ? "At least one supplied game explicitly reviewed" : "No source-game review required"}</span> : null}<span data-complete={requirements.conceptComplete}><Check size={15} /> {roleGap ? "Repertoire choice made" : "Concept attempted or answer revealed"}</span><span data-complete={requirements.planComplete}><Check size={15} /> Response plan saved</span></div>
  </section>;
}
