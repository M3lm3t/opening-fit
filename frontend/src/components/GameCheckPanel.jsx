import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthDataProvider.jsx";
import { completeGameCheck, getActiveCoachingResponsePlan, getCoachingGameCheckpoint, getCurrentCoachingPriority } from "../services/coachingStateService.js";
import { evaluateGameCheck } from "../services/gameCheckService.js";
import "./GameCheckPanel.css";

export default function GameCheckPanel({ report, platform, username, onReport }) {
  const { user } = useAuth();
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    if (!user?.id || !platform || !username || state === "checking" || state === "saving") return;
    abortRef.current?.abort(); abortRef.current = new AbortController();
    setState("checking"); setError("");
    try {
      const [checkpoint, priority, responsePlan] = await Promise.all([
        getCoachingGameCheckpoint(user.id, { platform, username }), getCurrentCoachingPriority(user.id), getActiveCoachingResponsePlan(user.id),
      ]);
      const baseline = report?.reportDecision?.baseline || report?.report_decision?.baseline || {};
      const checked = await evaluateGameCheck({ report, checkpoint, priority, responsePlan, comparable: baseline.comparisonClaimsAllowed === true, signal: abortRef.current.signal });
      if (checked.status === "complete") {
        setState("saving");
        const allIds = [...new Set([...(checkpoint?.checked_game_ids || []), ...checked.checkedGameIds])];
        const key = `game-check:${String(platform).toLowerCase()}:${String(username).toLowerCase()}:${[...checked.checkedGameIds].sort().join(",")}`;
        await completeGameCheck({ userId: user.id, platform, username, checkedGameIds: allIds, idempotencyKey: key, latestPlatformGameId: checked.checkedGameIds.at(-1) || null, lastImportedAt: report?.importedAt || report?.imported_at || null, payload: { newGameCount: checked.newGameCount, outcomeTypes: checked.outcomes.map((row) => row.type), evidenceRefs: { gameIds: checked.checkedGameIds } } });
      }
      setResult(checked); setState("complete");
    } catch (caught) {
      if (caught?.name === "AbortError") return;
      setError(caught?.message || "Game Check was interrupted before anything was saved."); setState("error");
    }
  };

  if (!user?.id) return null;
  return <section className="gameCheckPanel" aria-labelledby="game-check-title" aria-busy={["checking", "saving"].includes(state)}>
    <header><div><p className="eyebrow">Game Check</p><h2 id="game-check-title">What changed in your new games?</h2></div>{result ? <strong>{result.newGameCount} new</strong> : null}</header>
    {state === "idle" ? <><p>Check genuinely new games against your current priority and saved response plan.</p><button type="button" className="secondaryBtn" onClick={run}>Check new games</button></> : null}
    {state === "checking" ? <p role="status">Comparing stable game IDs and canonical evidence…</p> : null}
    {state === "saving" ? <p role="status">Saving this completed check…</p> : null}
    {state === "error" ? <><p role="alert">{error} The checkpoint was not advanced.</p><button type="button" className="secondaryBtn" onClick={run}>Retry Game Check</button></> : null}
    {state === "complete" && result ? <><p className="gameCheckLead">{result.lead}</p>{result.outcomes.length ? <ol>{result.outcomes.slice(0, 3).map((outcome, index) => <li key={`${outcome.type}-${index}`}><strong>{outcome.wording}</strong><small>{outcome.relevantGameCount} relevant game{outcome.relevantGameCount === 1 ? "" : "s"}</small>{outcome.evidenceReferences?.length ? <details><summary>Inspect evidence</summary><ul>{outcome.evidenceReferences.map((reference) => <li key={reference}><code>{reference}</code></li>)}</ul></details> : null}</li>)}</ol> : null}<button type="button" className="secondaryBtn" onClick={result.nextAction?.type === "review_evidence" ? onReport : run}>{result.nextAction?.label || "Done"}</button></> : null}
  </section>;
}
