import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";
import { REPERTOIRE_STORAGE_KEY } from "../lib/repertoireWorkspace.js";
import { buildRepertoireWorkspaceView, legacyWorkspaceEntries } from "../lib/repertoireWorkspaceView.js";
import { trackProductEvent } from "../lib/productAnalytics.js";
import TrainingImpactSection from "./TrainingImpactSection.jsx";
import FeatureAccessPreview from "./FeatureAccessPreview.jsx";
import { canUseFeature, OPENINGFIT_FEATURES } from "../lib/premiumEntitlement.js";
import {
  acceptRepertoireRecommendation,
  getRepertoireEntries,
  initialiseRepertoireFromReport,
  rejectRepertoireRecommendation,
  updateRepertoireMetrics,
} from "../services/repertoireService.js";
import "./MyRepertoire.css";

function readLocalWorkspace() {
  try { return JSON.parse(localStorage.getItem(REPERTOIRE_STORAGE_KEY) || "null"); } catch { return null; }
}

function RepertoireCard({ card, onTrain, onEvidence }) {
  return (
    <article className={`permanentRepertoireCard ${card.lowSample ? "permanentRepertoireCard--low-sample" : ""}`}>
      <header>
        <div><span>{card.slot.replaceAll("_", " ")}</span><h3>{card.openingName}</h3></div>
        <strong>{card.confidenceLabel}</strong>
      </header>
      <dl className="repertoireCardMetrics">
        <div><dt>Games analysed</dt><dd>{card.gamesLabel}</dd></div>
        <div><dt>Recent result score</dt><dd>{card.scoreLabel}</dd></div>
      </dl>
      <p className={`repertoireProgress repertoireProgress--${card.progress.status.replaceAll(" ", "-")}`}>{card.progress.label}</p>
      <details className="repertoireCardDetails">
        <summary>Strength, weakness and training focus</summary>
        <dl>
          <div><dt>Main strength</dt><dd>{card.strengthLabel}</dd></div>
          <div><dt>Main recurring weakness</dt><dd>{card.weaknessLabel}</dd></div>
          <div><dt>Current training focus</dt><dd>{card.trainingLabel}</dd></div>
          <div><dt>Last reviewed</dt><dd>{card.reviewedLabel}</dd></div>
        </dl>
      </details>
      <div className="repertoireCardActions">
        <button type="button" className="primaryBtn" onClick={() => onTrain(card)}>Train now</button>
        <button type="button" className="secondaryBtn" onClick={() => onEvidence(card)}>View evidence</button>
      </div>
    </article>
  );
}

function SuggestedChange({ suggestion, busy, onKeep, onAccept }) {
  return (
    <article className="repertoireSuggestionCard">
      <header><div><span>Suggested change</span><h3>{suggestion.slot.replaceAll("_", " ")}</h3></div><strong>{suggestion.confidenceLabel}</strong></header>
      <dl>
        <div><dt>Current opening</dt><dd>{suggestion.currentOpening}</dd></div>
        <div><dt>Suggested replacement</dt><dd>{suggestion.openingName}</dd></div>
        <div><dt>Reason</dt><dd>{suggestion.reason}</dd></div>
        <div><dt>Evidence / sample</dt><dd>{suggestion.evidenceLabel}</dd></div>
        <div><dt>Expected benefit</dt><dd>{suggestion.expectedBenefit}</dd></div>
        <div><dt>Confidence</dt><dd>{suggestion.confidenceLabel}</dd></div>
      </dl>
      <div className="repertoireSuggestionActions">
        <button type="button" className="secondaryBtn" disabled={busy} onClick={() => onKeep(suggestion)}>Keep current</button>
        <button type="button" className="primaryBtn" disabled={busy} onClick={() => onAccept(suggestion)}>Accept change</button>
      </div>
    </article>
  );
}

export default function MyRepertoire({ data, reportHistory = [], onAnalyse, onPractice, onReport, onAccount, onTrainingHistory, onUpgrade }) {
  const { user, entitlement, openingFitUserState = [] } = useAuth();
  const hasFullRepertoire = canUseFeature(entitlement, OPENINGFIT_FEATURES.FULL_REPERTOIRE);
  const cloudWorkspace = openingFitUserState.map((row) => row?.coach_progress?.repertoireWorkspace).find(Boolean) || null;
  const legacyEntries = useMemo(() => legacyWorkspaceEntries(cloudWorkspace || readLocalWorkspace() || {}), [cloudWorkspace]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(Boolean(user?.id));
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const syncedReportRef = useRef("");

  const refresh = useCallback(async () => {
    if (!user?.id || !hasFullRepertoire) { setEntries([]); setLoading(false); return []; }
    setLoading(true);
    try {
      const rows = await getRepertoireEntries(user.id);
      setEntries(rows);
      setLoadError("");
      return rows;
    } catch (error) {
      setLoadError(error.message || "Could not load your saved repertoire.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [hasFullRepertoire, user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const active = entries.some((entry) => entry.status === "active");
    if (!user?.id || !data || !active) return;
    const reportKey = String(data.analysisId || data.analysis_id || data.importedAt || data.imported_at || data.lastUpdated || data.last_updated || data.gamesImported || data.total_games || "current");
    if (syncedReportRef.current === reportKey) return;
    syncedReportRef.current = reportKey;
    void updateRepertoireMetrics(user.id, data).then(refresh).catch((error) => setLoadError(error.message));
  }, [data, entries, refresh, user?.id]);

  const view = useMemo(() => buildRepertoireWorkspaceView({ report: data, entries, legacyEntries, reportHistory, loading, error: loadError }), [data, entries, legacyEntries, loadError, loading, reportHistory]);

  const build = async () => {
    if (!user?.id) { onAccount?.(); return; }
    setBusyId("build"); setMessage("");
    try {
      await initialiseRepertoireFromReport(user.id, data);
      await refresh();
      setMessage("Your saved repertoire is ready.");
      void trackProductEvent("repertoire_created", { authenticated: true, source: "repertoire_workspace" });
    } catch (error) { setMessage(error.message); }
    finally { setBusyId(""); }
  };

  const resolveSuggestion = async (suggestion, accept) => {
    if (!user?.id) return;
    setBusyId(suggestion.id); setMessage("");
    try {
      if (accept) await acceptRepertoireRecommendation(user.id, suggestion.id);
      else await rejectRepertoireRecommendation(user.id, suggestion.id);
      await refresh();
      setMessage(accept ? "Repertoire change accepted." : "Suggestion dismissed. Your current opening is unchanged.");
      void trackProductEvent(accept ? "repertoire_change_accepted" : "repertoire_change_rejected", { authenticated: true, source: "repertoire_workspace", openingCategory: suggestion.slot });
    } catch (error) { setMessage(error.message); }
    finally { setBusyId(""); }
  };

  const train = (card) => {
    void trackProductEvent("repertoire_training_opened", { authenticated: Boolean(user?.id), source: "repertoire_workspace", openingCategory: card.slot });
    onPractice?.({ name: card.openingName, opening: card.openingName, slot: card.slot, section: card.slot });
  };

  if (data && !hasFullRepertoire) return <section className="myRepertoireEmpty" id="my-repertoire"><span>My Repertoire · Preview</span><h1>Your report has the foundations of a repertoire.</h1><p>Keep using your free score, style profile, Keep recommendation, Repair recommendation and next action.</p><FeatureAccessPreview feature={OPENINGFIT_FEATURES.FULL_REPERTOIRE} title="Save a permanent White and Black workspace" onUpgrade={onUpgrade} /></section>;

  if (view.state === "loading") return <section className="myRepertoireEmpty" role="status"><span>My Repertoire</span><h1>Loading your saved repertoire…</h1><div className="repertoireLoadingBars" aria-hidden="true"><i /><i /><i /></div></section>;
  if (view.state === "no-report") return <section className="myRepertoireEmpty" id="my-repertoire"><span>My Repertoire</span><h1>Your permanent repertoire starts with a report.</h1><p>{view.notice}</p><button className="primaryBtn" type="button" onClick={onAnalyse}>Analyse games</button></section>;
  if (view.state === "not-built") return <section className="myRepertoireEmpty" id="my-repertoire"><span>Report ready</span><h1>Build your saved repertoire when you are ready.</h1><p>{view.notice} Nothing will be created or replaced until you confirm.</p>{user?.id ? <button className="primaryBtn" type="button" disabled={busyId === "build"} onClick={build}>{busyId === "build" ? "Building…" : "Build my repertoire"}</button> : <button className="primaryBtn" type="button" onClick={onAccount}>Sign in to build</button>}{message ? <p role="status">{message}</p> : null}</section>;

  return (
    <section className="myRepertoire permanentRepertoireWorkspace" id="my-repertoire" aria-labelledby="my-repertoire-title">
      <header className="myRepertoireHero">
        <div><span>Permanent workspace</span><h1 id="my-repertoire-title">My Repertoire</h1><p>Your saved White and Black choices, current evidence, and next training focus.</p></div>
        <div className="myRepertoireActionCard"><span>Workspace status</span><strong>{view.suggestions.length ? `${view.suggestions.length} suggested change${view.suggestions.length === 1 ? "" : "s"} waiting for you` : "Your active choices stay in place"}</strong><button type="button" onClick={onReport}>Review latest report</button></div>
      </header>

      {view.notice || view.usingLegacy || view.lowSample ? <aside className="repertoireWorkspaceNotice" role="status"><strong>{view.usingLegacy ? "Legacy repertoire preserved" : view.lowSample ? "Low sample" : "Workspace note"}</strong><p>{view.notice || (view.usingLegacy ? "These saved choices remain available while the live repertoire migration completes." : "Not enough evidence yet for confident progress calls. Keep playing these openings and refresh your report later.")}</p></aside> : null}
      {message ? <p className="repertoireSaveStatus" role="status">{message}</p> : null}

      <TrainingImpactSection
        report={data}
        reportHistory={reportHistory}
        repertoireEntries={entries}
        source="repertoire"
        onViewHistory={onTrainingHistory}
        onAnalytics={(event, properties) => trackProductEvent(event, { authenticated: Boolean(user?.id), ...properties })}
      />

      <div className="permanentRepertoireSections">
        {view.sections.map((section) => (
          <section className="permanentRepertoireSlot" key={section.key} aria-labelledby={`repertoire-${section.key}`}>
            <header><div><span>Active slot</span><h2 id={`repertoire-${section.key}`}>{section.title}</h2></div><strong>{section.cards.length}</strong></header>
            {section.cards.length ? <div className="permanentRepertoireCards">{section.cards.map((card) => <RepertoireCard key={card.id || `${card.slot}:${card.openingName}`} card={card} onTrain={train} onEvidence={onReport} />)}</div> : <div className="repertoireSlotEmpty"><strong>{section.key === "white" ? "No White opening saved" : section.key.startsWith("black") ? "No Black opening saved for this response" : "No optional secondary choice"}</strong><p>{section.key === "optional" ? "Optional slots can stay empty." : "Not enough evidence yet to save a dependable choice here."}</p></div>}
          </section>
        ))}
      </div>

      <section className="repertoireSuggestions" aria-labelledby="repertoire-suggestions-title">
        <header><div><span>Explicit review required</span><h2 id="repertoire-suggestions-title">Suggested changes</h2></div><strong>{view.suggestions.length}</strong></header>
        {view.suggestions.length ? <div>{view.suggestions.map((suggestion) => <SuggestedChange key={suggestion.id} suggestion={suggestion} busy={busyId === suggestion.id} onKeep={(item) => resolveSuggestion(item, false)} onAccept={(item) => resolveSuggestion(item, true)} />)}</div> : <p className="repertoireSuggestionEmpty">No suggested changes are waiting. New report recommendations will appear here without altering your active repertoire.</p>}
      </section>
    </section>
  );
}
