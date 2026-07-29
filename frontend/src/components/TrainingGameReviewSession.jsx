import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Play } from "lucide-react";
import GameReplayBoard from "./GameReplayBoard.jsx";
import {
  loadOpeningOpportunityProgress,
  saveOpeningOpportunityProgress,
  updateOpeningOpportunityReviewProgress,
} from "../lib/openingOpportunityDrills.js";
import { selectTrainingReviewGames, trainingReviewRequirements } from "../lib/trainingGameReview.js";
import "./TrainingGameReviewSession.css";

function displayDate(value) {
  const parsed = Date.parse(value);
  return parsed ? new Date(parsed).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable";
}

export default function TrainingGameReviewSession({ report, priority, exercise, conceptEngaged, onReadinessChange, children }) {
  const drillId = exercise?.drill?.id || "openingfit-training-review";
  const games = useMemo(() => selectTrainingReviewGames(report || {}, priority || {}, exercise?.priorityReason), [exercise?.priorityReason, priority, report]);
  const [activeGameId, setActiveGameId] = useState("");
  const [saved, setSaved] = useState(() => loadOpeningOpportunityProgress()[drillId] || {});
  const [responsePlan, setResponsePlan] = useState(() => saved.responsePlan || "");
  const reviewedGameIds = useMemo(() => Array.isArray(saved.reviewedGameIds) ? saved.reviewedGameIds : [], [saved.reviewedGameIds]);
  const requirements = useMemo(() => trainingReviewRequirements({ games, reviewedGameIds, conceptEngaged: conceptEngaged || saved.attempts > 0 || saved.completion || saved.revealed, responsePlan: saved.responsePlan }), [conceptEngaged, games, reviewedGameIds, saved.attempts, saved.completion, saved.responsePlan, saved.revealed]);
  const hasActionableGames = games.some((game) => game.hasInternalReplay || game.sourceUrl);
  const activeGame = games.find((game) => game.id === activeGameId);

  useEffect(() => {
    const current = loadOpeningOpportunityProgress()[drillId] || {};
    setSaved(current);
    setResponsePlan(current.responsePlan || "");
    setActiveGameId("");
  }, [drillId]);

  useEffect(() => { onReadinessChange?.(requirements); }, [onReadinessChange, requirements]);

  const persist = (changes) => {
    const progress = loadOpeningOpportunityProgress();
    const next = updateOpeningOpportunityReviewProgress(progress, drillId, changes);
    saveOpeningOpportunityProgress(next);
    setSaved(next[drillId]);
  };

  const reviewGame = (game) => {
    setActiveGameId(game.id);
    persist({ reviewedGameIds: [...reviewedGameIds, game.id] });
  };

  const savePlan = () => persist({ responsePlan });
  const opening = exercise?.drill?.openingName || priority?.openingName || "this opening";

  return (
    <section className="trainingReviewSession" aria-labelledby="training-review-session-title">
      <header className="trainingReviewSession__header">
        <span>Approximately 10 minutes</span>
        <h3 id="training-review-session-title">One focused review session</h3>
      </header>

      <section className="trainingReviewStep" aria-labelledby="training-focus-title">
        <div className="trainingReviewStep__number">1</div>
        <div><span>Focus · 30 seconds</span><h4 id="training-focus-title">Why this topic was selected</h4><p>{exercise?.priorityReason?.text || `This report selected ${opening} as a practical preparation topic; it is not automatically a diagnosed weakness.`}</p></div>
      </section>

      <section className="trainingReviewStep" aria-labelledby="training-games-title">
        <div className="trainingReviewStep__number">2</div>
        <div className="trainingReviewStep__content">
          <span>Review · approximately 6 minutes</span>
          <h4 id="training-games-title">Review these games</h4>
          {hasActionableGames ? <p>Review these {games.length} recent {opening} game{games.length === 1 ? "" : "s"}. In each game, note the first position where you were unsure of your plan. Then compare your notes and choose one response to remember.</p> : games.length ? <p>This saved report retains matching game metadata, but no replay or validated source link. Continue with the concept and written plan; no game review is required.</p> : <p>This saved report does not contain matching source games. Continue with the general concept and written plan; no game review is required.</p>}
          {games.length ? <div className="trainingReviewGames">
            {games.map((game, index) => <article className="trainingReviewGame" key={game.id} aria-labelledby={`training-game-${index}`}>
              <header><div><span>{game.platform}</span><h5 id={`training-game-${index}`}>{game.opening || opening}</h5></div><strong>{game.result}</strong></header>
              <dl>
                <div><dt>Opponent</dt><dd>{game.opponent}</dd></div>
                <div><dt>Played as</dt><dd>{game.userColour || "Colour unavailable"}</dd></div>
                <div><dt>Date</dt><dd>{displayDate(game.playedAt)}</dd></div>
                <div><dt>Time control</dt><dd>{game.timeControl}</dd></div>
              </dl>
              <p><strong>Why selected:</strong> {game.whySelected}</p>
              <div className="trainingReviewGame__actions">
                {game.hasInternalReplay ? <button type="button" className="primaryBtn" onClick={() => reviewGame(game)}><Play size={16} /> {activeGameId === game.id ? "Reviewing in OpeningFit" : "Review in OpeningFit"}</button> : null}
                {game.sourceUrl ? <a className="secondaryBtn" href={game.sourceUrl} target="_blank" rel="noreferrer" onClick={() => persist({ reviewedGameIds: [...reviewedGameIds, game.id] })}>Open {game.platform} source game <ExternalLink size={15} aria-hidden="true" /><span className="srOnly"> (opens in a new tab)</span></a> : null}
                {!game.hasInternalReplay && !game.sourceUrl ? <span className="trainingReviewUnavailable">Replay and source link unavailable in this saved report.</span> : null}
              </div>
            </article>)}
          </div> : null}
          {activeGame ? <GameReplayBoard key={activeGame.id} game={activeGame} title={`Review: ${activeGame.opening || opening}`} initialOrientation={activeGame.userColour || "white"} /> : null}
        </div>
      </section>

      <section className="trainingReviewStep" aria-labelledby="training-concept-title">
        <div className="trainingReviewStep__number">3</div>
        <div className="trainingReviewStep__content"><span>Concept · approximately 2 minutes</span><h4 id="training-concept-title">Choose the plan to remember</h4>{children}</div>
      </section>

      <section className="trainingReviewStep" aria-labelledby="training-commit-title">
        <div className="trainingReviewStep__number">4</div>
        <div className="trainingReviewStep__content"><span>Commit · approximately 1 minute</span><h4 id="training-commit-title">Save your response plan</h4>
          <label htmlFor={`training-plan-${drillId}`}>Next time I reach this setup, I will…</label>
          <textarea id={`training-plan-${drillId}`} value={responsePlan} maxLength={240} onChange={(event) => setResponsePlan(event.target.value)} placeholder="Write one short, practical cue." />
          <button type="button" className="secondaryBtn" disabled={!responsePlan.trim()} onClick={savePlan}>Save my plan</button>
        </div>
      </section>

      <div className="trainingReviewChecklist" aria-label="Session completion requirements">
        <strong>Complete when</strong>
        <span data-complete={requirements.reviewComplete}><Check size={15} /> {hasActionableGames ? "At least one supplied game reviewed" : "No source-game review required"}</span>
        <span data-complete={requirements.conceptComplete}><Check size={15} /> Concept attempted or answer revealed</span>
        <span data-complete={requirements.planComplete}><Check size={15} /> Response plan saved</span>
      </div>
    </section>
  );
}
