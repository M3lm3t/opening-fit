import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { setReportPilot, REPORT_ONLY_MESSAGE } from "../lib/reportRollout.js";
import { loadPilotEligibility, loadPilotHistory, confirmedPilotReport } from "../lib/reportPilot.js";
import { importGames } from "../lib/importClient.js";
import { buildReportDecisionModel } from "../lib/reportDecisionModel.js";
import PrimaryReportSummary from "./PrimaryReportSummary.jsx";
import ReportGameCountSummary from "./ReportGameCountSummary.jsx";

function PilotWorkspace({ session, eligibility }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [platform, setPlatform] = useState("lichess");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Loading saved reports…");
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => {
    const initial = new AbortController();
    loadPilotHistory(session, initial.signal).then((saved) => {
      if (initial.signal.aborted) return;
      setRows(saved); setSelected(saved[0] || null); setNotice(saved.length ? "Saved reports loaded." : "No saved reports yet.");
    }).catch((failure) => { if (!initial.signal.aborted) { setError(failure.message); setNotice(""); } });
    return () => { initial.abort(); controller.current?.abort(); };
  }, [session]);

  async function importReport(event) {
    event.preventDefault();
    if (busy || !eligibility.creationEnabled) return;
    const current = new AbortController(); controller.current = current;
    setBusy(true); setError(""); setNotice("Importing and analysing games…");
    try {
      const { data } = await importGames({ platform, username, months: 1, accessToken: session.access_token, stage6: true, controller: current });
      const saved = await loadPilotHistory(session, current.signal);
      const confirmed = confirmedPilotReport(saved, data);
      if (!current.signal.aborted) { setRows(saved); setSelected(confirmed); setNotice("Report saved to your private pilot history."); }
    } catch (failure) {
      if (!current.signal.aborted) { setError(failure.message); setNotice(""); }
    } finally { if (!current.signal.aborted) setBusy(false); }
  }
  const report = selected?.report;
  return <>
    <p>Signed in as {session.user.email || session.user.id}. Only this account can read its pilot reports.</p>
    {!eligibility.creationEnabled ? <p role="status">New report creation is disabled. Your saved reports remain readable.</p> : null}
    <form onSubmit={importReport}>
      <label>Platform <select value={platform} onChange={(event) => setPlatform(event.target.value)} disabled={busy}><option value="lichess">Lichess</option><option value="chess.com">Chess.com</option></select></label>{" "}
      <label>Chess username <input required maxLength={80} value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} /></label>{" "}
      <button type="submit" className="primaryBtn" disabled={busy || !eligibility.creationEnabled}>{busy ? "Analysing…" : "Import last month"}</button>
    </form>
    <p role="status">{notice}</p>{error ? <p role="alert">{error}</p> : null}
    <button type="button" disabled={busy} onClick={() => window.location.reload()}>Reload saved reports</button>
    {rows.length ? <label>Saved reports <select aria-label="Saved reports" value={selected?.id || ""} onChange={(event) => setSelected(rows.find((row) => row.id === event.target.value) || null)}>
      {rows.map((row) => <option key={row.id} value={row.id}>{row.report?.reportGeneration === "stage6_v1" ? "Pilot" : "Legacy"} · {row.username || row.report?.username || "Report"} · {row.created_at || row.id}</option>)}
    </select></label> : null}
    {report ? <>
      <ReportGameCountSummary report={report} showSaveStatus={false} />
      <PrimaryReportSummary report={report} model={buildReportDecisionModel(report)} onFullReport={() => document.getElementById("pilot-evidence")?.scrollIntoView()} />
      <PrimaryReportSummary report={report} model={buildReportDecisionModel(report)} section="priorities" />
      <details id="pilot-evidence"><summary>Saved report evidence and methodology</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(report, null, 2)}</pre></details>
    </> : null}
  </>;
}

export default function ReportPilot() {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let generation = 0;
    let active = true;
    let pending;
    function resolve(session) {
      const ticket = ++generation;
      pending?.abort(); pending = new AbortController();
      setReportPilot(false);
      setState({ status: session ? "loading" : "signed-out" });
      if (!session) return;
      loadPilotEligibility(session, pending.signal).then((eligibility) => {
        if (!active || ticket !== generation) return;
        setReportPilot(eligibility.allowed);
        setState({ status: eligibility.allowed ? "ready" : "denied", session, eligibility });
      }).catch((error) => { if (active && ticket === generation) setState({ status: "error", message: error.message }); });
    }
    if (!supabase) { setState({ status: "error", message: "Account service is unavailable." }); return; }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => resolve(session));
    const initialGeneration = generation;
    supabase.auth.getSession().then(({ data: current, error }) => {
      if (!active || generation !== initialGeneration) return;
      if (error) setState({ status: "error", message: "Could not verify your session. Sign in again." });
      else resolve(current?.session);
    }).catch(() => { if (active && generation === initialGeneration) setState({ status: "error", message: "Could not verify your session." }); });
    return () => { active = false; ++generation; pending?.abort(); data.subscription.unsubscribe(); setReportPilot(false); };
  }, []);
  return <main className="reportPilot" style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
    <h1>OpeningFit report pilot</h1>
    <p role="note">{REPORT_ONLY_MESSAGE}</p>
    <p><a href="/">Return to the standard app</a> — the standard app and Android continue using legacy reports.</p>
    {state.status === "loading" ? <p role="status">Checking pilot access…</p> : null}
    {state.status === "signed-out" ? <p>Sign in through the standard app, then return to /report-pilot.</p> : null}
    {state.status === "denied" ? <p>This account is not enabled for the pilot. Use the standard app to continue with legacy reports.</p> : null}
    {state.status === "error" ? <><p role="alert">{state.message}</p><button type="button" onClick={() => window.location.reload()}>Retry access check</button></> : null}
    {state.status === "ready" ? <PilotWorkspace key={`${state.session.user.id}:${state.session.access_token}`} session={state.session} eligibility={state.eligibility} /> : null}
  </main>;
}
