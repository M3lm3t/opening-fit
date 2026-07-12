import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";
import { REPERTOIRE_PENDING_KEY, REPERTOIRE_STATUSES, REPERTOIRE_STORAGE_KEY, applyRepertoireAction, buildSuggestedWorkspace, reconcileWorkspace, workspaceSummary, workspaceWarnings } from "../lib/repertoireWorkspace";
import { analysisConfidence, fitBand, performanceSummary } from "../lib/fitTrustModel";
import { trackProductEvent } from "../lib/productAnalytics";
import "./MyRepertoire.css";

const sections = [["white", "White"], ["blackE4", "Black versus 1.e4"], ["blackD4", "Black versus 1.d4"], ["other", "Other"]];
const readLocal = () => { try { return JSON.parse(localStorage.getItem(REPERTOIRE_STORAGE_KEY) || "null"); } catch { return null; } };

function OpeningDetail({ item, onChange, onDelete, onPractice }) {
  const confidence = analysisConfidence(item.opening || item);
  const weakestLine = item.opening?.weakestLine || item.opening?.weakest_line || item.opening?.variation || item.opening?.line;
  const training = item.opening?.trainingProgress ?? item.opening?.training_progress;
  const guide = item.opening?.guideUrl || item.opening?.guide_url;
  const games = item.opening?.representativeGames || item.opening?.representative_games || item.opening?.exampleGames || item.opening?.example_games;
  return (
    <article className="workspaceOpening">
      <header><div><span>{item.role}</span><h3>{item.name}</h3></div><strong>{item.status}</strong></header>
      <p>{item.source === "manual" ? "Included because you selected it manually." : "Included from the latest report evidence."}</p>
      <dl>
        <div><dt>Fit</dt><dd>{item.fit !== null && item.fit !== undefined ? `${fitBand(item.fit, confidence)} · ${item.fit}/100` : "Unavailable"}</dd></div>
        <div><dt>Confidence</dt><dd>{confidence.label}</dd></div>
        <div><dt>Performance</dt><dd>{performanceSummary(item.opening || item)}</dd></div>
        <div><dt>Games</dt><dd>{item.games || 0}</dd></div>
        {weakestLine ? <div><dt>Weakest line</dt><dd>{weakestLine}</dd></div> : null}
        {training !== undefined ? <div><dt>Training</dt><dd>{training}</dd></div> : null}
        {guide ? <div><dt>Guide</dt><dd><a href={guide}>Opening guide</a></dd></div> : null}
        {Array.isArray(games) && games.length ? <div><dt>Representative games</dt><dd>{games.slice(0, 3).map((game, index) => <span key={game.id || game.url || index}>{game.url ? <a href={game.url}>Game {index + 1}</a> : `Game ${index + 1}`}{index < Math.min(2, games.length - 1) ? ", " : ""}</span>)}</dd></div> : null}
      </dl>
      <label>Status<select value={item.status} onChange={(event) => onChange({ status: event.target.value })}>{REPERTOIRE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label>Role<select value={item.role} onChange={(event) => onChange({ role: event.target.value })}><option>Main</option><option>Backup</option><option>Branch</option><option>Alternative</option></select></label>
      <label className="workspaceLock"><input type="checkbox" checked={Boolean(item.locked)} onChange={(event) => onChange({ locked: event.target.checked })} /> Lock this choice</label>
      <label>Notes<textarea value={item.notes || ""} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Plans, move orders, or reminders" /></label>
      <div className="workspaceOpeningActions"><button type="button" onClick={() => onPractice(item.opening || item)}>Start training</button><button type="button" onClick={onDelete}>Remove</button></div>
    </article>
  );
}

export default function MyRepertoire({ data, onAnalyse, onPractice, onReport }) {
  const { user, openingFitUserState = [], upsertUserData } = useAuth();
  const suggested = useMemo(() => buildSuggestedWorkspace(data || {}), [data]);
  const platform = data?.platform || data?.importPlatform || "unknown";
  const username = data?.username || data?.playerName || "guest";
  const cloudRow = openingFitUserState.find((row) => String(row.platform).toLowerCase() === String(platform).toLowerCase() && String(row.username).toLowerCase() === String(username).toLowerCase()) || openingFitUserState[0];
  const cloudWorkspace = cloudRow?.coach_progress?.repertoireWorkspace;
  const [workspace, setWorkspace] = useState(() => reconcileWorkspace(suggested, cloudWorkspace || readLocal() || {}));
  const [message, setMessage] = useState("");

  const persist = useCallback(async (next) => {
    const clean = { ...next, undo: undefined };
    localStorage.setItem(REPERTOIRE_STORAGE_KEY, JSON.stringify(clean));
    setWorkspace(next);
    if (!user?.id || !upsertUserData) { setMessage("Saved on this device. Sign in when you want to sync it."); return; }
    const saved = await upsertUserData("openingfit_user_state", { ...(cloudRow?.id ? { id: cloudRow.id } : {}), platform, username, last_report: cloudRow?.last_report || data || null, coach_progress: { ...(cloudRow?.coach_progress || {}), repertoireWorkspace: clean } }, { onConflict: "user_id,platform,username", required: false });
    setMessage(saved ? "Repertoire synced to your account." : "Saved on this device; cloud sync is unavailable.");
  }, [cloudRow, data, platform, upsertUserData, user?.id, username]);
  useEffect(() => setWorkspace(reconcileWorkspace(suggested, cloudWorkspace || readLocal() || {})), [suggested, cloudWorkspace]);
  useEffect(() => {
    try {
      const pending = JSON.parse(localStorage.getItem(REPERTOIRE_PENDING_KEY) || "null");
      if (!pending) return;
      localStorage.removeItem(REPERTOIRE_PENDING_KEY);
      void persist(applyRepertoireAction(reconcileWorkspace(suggested, cloudWorkspace || readLocal() || {}), pending));
    } catch { /* Ignore malformed legacy local state. */ }
  }, [cloudWorkspace, persist, suggested]);
  const summary = useMemo(() => workspaceSummary(workspace), [workspace]);
  const warnings = useMemo(() => workspaceWarnings(workspace), [workspace]);
  const act = (action) => { const item = workspace.items.find((row) => row.id === action.id) || action.item; const event = action.type === "add" ? "opening_added" : action.type === "replace" ? "opening_replaced" : action.type === "update" && action.changes?.locked ? "opening_locked" : null; if (event) void trackProductEvent(event, { authenticated: Boolean(user?.id), source: "repertoire_workspace", openingCategory: item?.section || "other" }); return persist(applyRepertoireAction(workspace, action)); };
  const undo = () => workspace.undo && persist(workspace.undo);

  if (!data && !workspace.items.length) return <section className="myRepertoireEmpty"><h1>Build your repertoire from one analysis.</h1><p>Your report will become a manageable White and Black workspace.</p><button className="primaryBtn" type="button" onClick={onAnalyse}>Analyse games</button></section>;
  return (
    <section className="myRepertoire repertoireWorkspace" id="my-repertoire" aria-labelledby="my-repertoire-title">
      <header className="myRepertoireHero"><div><span>Repertoire workspace</span><h1 id="my-repertoire-title">Your practical opening plan</h1><p>Manual and locked choices take priority when a new report arrives.</p></div><div className="myRepertoireActionCard"><span>Next action</span><strong>{summary.nextAction}</strong><button type="button" onClick={onReport}>Review evidence</button></div></header>
      <dl className="workspaceSummary"><div><dt>Coverage</dt><dd>{summary.coverage}</dd></div><div><dt>Active</dt><dd>{summary.active}</dd></div><div><dt>Learning</dt><dd>{summary.learning}</dd></div><div><dt>Repair</dt><dd>{summary.repair}</dd></div></dl>
      {warnings.length ? <aside className="workspaceWarnings" aria-label="Advisory repertoire warnings"><strong>Worth checking</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></aside> : null}
      {message ? <p role="status" className="repertoireSaveStatus">{message}</p> : null}
      {workspace.undo ? <button type="button" className="secondaryBtn" onClick={undo}>Undo last change</button> : null}
      <div className="workspaceSections">{sections.map(([key, label]) => { const rows = workspace.items.filter((item) => item.section === key); return <details key={key} open={key !== "other" || Boolean(rows.length)}><summary><span>{label}</span><strong>{rows.length} opening{rows.length === 1 ? "" : "s"}</strong></summary>{rows.length ? <div>{rows.map((item) => <OpeningDetail key={item.id} item={item} onPractice={onPractice} onChange={(changes) => act({ type: "update", id: item.id, changes })} onDelete={() => act({ type: "delete", id: item.id })} />)}</div> : <p>No dependable choice is selected here.</p>}<button type="button" onClick={() => act({ type: "reset_section", section: key })}>Reset this category</button></details>; })}</div>
    </section>
  );
}
