import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";
import { adaptReportHistoryRow } from "../lib/reportSnapshot";

const HISTORY_KEY = "openingFit:reportHistory:v1";
const TIME_FORMAT_LABELS = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Classical",
  daily: "Daily / Correspondence",
  custom: "All Time Controls",
};

function timeFormatLabel(value) {
  return TIME_FORMAT_LABELS[String(value || "").toLowerCase()] || value || "All Time Controls";
}

function safeDate(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

function getUsername(data) {
  return (
    data?.username ||
    data?.player ||
    data?.playerName ||
    data?.player_name ||
    data?.profile?.username ||
    data?.imported_username ||
    "Unknown player"
  );
}

function getPlatform(data) {
  return data?.platform || data?.source || data?.importPlatform || data?.profile?.platform || "chess";
}

function getGameCount(data) {
  return (
    data?.gamesAnalysed ||
    data?.gamesAnalyzed ||
    data?.gamesImported ||
    data?.games_imported ||
    data?.totalGames ||
    data?.total_games ||
    data?.game_count ||
    0
  );
}

function getImportMonths(data) {
  return data?.monthsChecked || data?.months_checked || data?.importMonths || data?.import_months || "Recent";
}

function getAnalysisTimeFormat(data) {
  return {
    key: data?.analysisTimeFormat || data?.analysis_time_format || "custom",
    label:
      data?.analysisTimeFormatLabel ||
      data?.analysis_time_format_label ||
      timeFormatLabel(data?.analysisTimeFormat || data?.analysis_time_format),
    effectiveLabel:
      data?.effectiveTimeFormatLabel ||
      data?.effective_time_format_label ||
      timeFormatLabel(data?.effectiveTimeFormat || data?.effective_time_format),
    detected: data?.detectedTimeFormat || data?.detected_time_format || null,
  };
}

function openingName(item) {
  return item?.name || item?.opening || item?.eco_name || item?.label || "Unknown opening";
}

function openingScore(item) {
  const raw = item?.winRate ?? item?.win_rate ?? item?.score ?? item?.scoreRate ?? item?.score_rate;
  const number = Number(String(raw ?? "").replace("%", ""));
  if (!Number.isFinite(number)) return null;
  return number <= 1 ? Math.round(number * 100) : Math.round(number);
}

function openingConfidence(item) {
  return item?.fitConfidence || item?.confidenceLabel || item?.confidence || item?.signal || "Unlabelled";
}

function openingVerdict(item) {
  return item?.fitDisplayVerdict || item?.fitVerdict || item?.verdict || item?.recommendation || "Tracked";
}

function getTopOpenings(data, limit = 6) {
  const openings =
    data?.top_openings ||
    data?.topOpenings ||
    data?.best_openings ||
    data?.bestOpenings ||
    data?.opening_stats ||
    data?.openings ||
    [];

  if (!Array.isArray(openings)) return [];

  return openings
    .filter((item) => openingName(item) && !String(openingName(item)).toLowerCase().includes("unknown"))
    .slice(0, limit)
    .map((item) => ({
      name: openingName(item),
      games: Number(item?.games ?? item?.count ?? item?.total ?? 0) || 0,
      score: openingScore(item),
      verdict: openingVerdict(item),
      confidence: openingConfidence(item),
    }));
}

function inferStudyTarget(data, topOpenings) {
  const explicit =
    data?.studyTarget ||
    data?.study_target ||
    data?.nextStudyTarget ||
    data?.next_study_target ||
    data?.recommendedStudyTarget;

  if (typeof explicit === "string") return explicit;
  if (explicit?.name || explicit?.opening) return explicit.name || explicit.opening;

  const weak = [...topOpenings]
    .filter((item) => item.score !== null)
    .sort((a, b) => a.score - b.score)[0];

  return weak?.name || topOpenings[0]?.name || "No clear target yet";
}

function createReportSnapshot(data, fitData = null) {
  const scoredOpenings = Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : [];
  const fitRows = scoredOpenings.slice(0, 8).map((item) => ({
    name: openingName(item),
    games: Number(item?.games ?? 0) || 0,
    score: openingScore(item),
    verdict: openingVerdict(item),
    confidence: openingConfidence(item),
  }));
  const topOpenings = fitRows.length ? fitRows : getTopOpenings(data);
  const studyTarget = inferStudyTarget(data, topOpenings);
  const healthScore =
    fitData?.overallScore ??
    data?.openingFitScore ??
    data?.opening_fit_score ??
    data?.healthScore ??
    data?.opening_health_score ??
    null;
  const timeFormat = getAnalysisTimeFormat(data);

  return {
    reportDate: new Date().toISOString(),
    username: getUsername(data),
    platform: getPlatform(data),
    importMonths: getImportMonths(data),
    analysisTimeFormat: timeFormat.key,
    analysisTimeFormatLabel: timeFormat.label,
    effectiveTimeFormatLabel: timeFormat.effectiveLabel,
    detectedTimeFormat: timeFormat.detected,
    games: getGameCount(data),
    topOpening: topOpenings[0]?.name || "No clear top opening yet",
    topOpenings,
    verdicts: Object.fromEntries(topOpenings.map((item) => [item.name, item.verdict])),
    confidenceLevels: Object.fromEntries(topOpenings.map((item) => [item.name, item.confidence])),
    studyTarget,
    healthScore,
  };
}

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

function normalizeHistoryItem(item) {
  if (!item || typeof item !== "object") {
    if (import.meta.env.DEV) {
      console.warn("OpeningFit skipped malformed report history item", item);
    }
    return null;
  }

  const summary = item.summary || item.snapshot || {};
  const normalized = adaptReportHistoryRow(item);
  const normalizedOpenings = (normalized.opening_statistics || []).map((opening) => ({
    name: opening.name,
    games: opening.games || 0,
    score: opening.win_rate ?? opening.score ?? null,
    verdict: "Tracked",
    confidence: opening.confidence?.label || "insufficient data",
  }));

  return {
    id: item.id || `${summary.username || item.username}-${summary.platform || item.platform}-${item.created_at || item.createdAt}`,
    createdAt: normalized.generated_at || item.created_at || item.createdAt || summary.reportDate,
    username: normalized.source_username || summary.username || item.username || "Unknown player",
    platform: normalized.source_platform || summary.platform || item.platform || "chess",
    analysisTimeFormat: summary.analysisTimeFormat || item.analysisTimeFormat || "custom",
    analysisTimeFormatLabel:
      summary.analysisTimeFormatLabel ||
      item.analysisTimeFormatLabel ||
      timeFormatLabel(summary.analysisTimeFormat || item.analysisTimeFormat),
    effectiveTimeFormatLabel:
      summary.effectiveTimeFormatLabel ||
      item.effectiveTimeFormatLabel ||
      timeFormatLabel(summary.effectiveTimeFormat || item.effectiveTimeFormat),
    games: normalized.total_games_analysed ?? summary.games ?? item.games ?? 0,
    topOpening: summary.topOpening || item.topOpening || "No clear top opening yet",
    snapshot: {
      ...summary,
      topOpenings: summary.topOpenings || normalizedOpenings,
      healthScore: summary.healthScore ?? normalized.openingfit_score ?? null,
    },
    normalizedSnapshot: normalized,
    data: item.report || item.data,
  };
}

function scoreTrend(previous, current) {
  if (previous === null || previous === undefined || current === null || current === undefined) {
    return "new signal";
  }

  const delta = current - previous;
  if (delta >= 4) return "improving";
  if (delta <= -4) return "declining";
  if (current < 50) return "still weak";
  return "stable";
}

function compareSnapshots(previous, current) {
  if (!previous || !current) return [];

  return current.topOpenings.slice(0, 5).map((item) => {
    const old = previous.topOpenings?.find(
      (candidate) => String(candidate.name).toLowerCase() === String(item.name).toLowerCase()
    );

    return {
      name: item.name,
      previousScore: old?.score ?? null,
      currentScore: item.score,
      trend: scoreTrend(old?.score, item.score),
      previousVerdict: old?.verdict || "Not in previous report",
      currentVerdict: item.verdict,
      confidence: item.confidence,
    };
  });
}

function safeNumber(value, fallback = null) {
  const number = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function snapshotFromHistoryItem(item) {
  if (!item) return null;
  const snapshot = item.snapshot || {};
  const data = item.data || {};
  const topOpenings = Array.isArray(snapshot.topOpenings) && snapshot.topOpenings.length
    ? snapshot.topOpenings
    : getTopOpenings(data);
  const healthScore =
    snapshot.healthScore ??
    data?.openingFitScore ??
    data?.opening_fit_score ??
    data?.retentionMetrics?.repertoireHealth?.score ??
    data?.retention_metrics?.repertoire_health?.score ??
    null;

  return {
    ...snapshot,
    reportDate: snapshot.reportDate || item.createdAt,
    username: snapshot.username || item.username,
    platform: snapshot.platform || item.platform,
    games: safeNumber(snapshot.games ?? item.games ?? getGameCount(data), 0),
    topOpening: snapshot.topOpening || item.topOpening || topOpenings[0]?.name || "No clear top opening yet",
    topOpenings,
    studyTarget: snapshot.studyTarget || inferStudyTarget(data, topOpenings),
    healthScore,
    weakLines:
      snapshot.weakLines ||
      snapshot.weak_lines ||
      data?.weakLines ||
      data?.weak_lines ||
      data?.retentionMetrics?.weakLines ||
      data?.retention_metrics?.weak_lines ||
      [],
    trainingCompleted:
      safeNumber(snapshot.trainingCompleted ?? snapshot.training_completed ?? data?.trainingCompleted ?? data?.training_completed, null),
  };
}

function strongestOpening(snapshot) {
  const top = Array.isArray(snapshot?.topOpenings) ? snapshot.topOpenings : [];
  return top
    .filter((item) => item?.name)
    .sort((a, b) => {
      const scoreDelta = (safeNumber(b.score, -1) ?? -1) - (safeNumber(a.score, -1) ?? -1);
      if (scoreDelta) return scoreDelta;
      return (safeNumber(b.games, 0) ?? 0) - (safeNumber(a.games, 0) ?? 0);
    })[0]?.name || snapshot?.topOpening || "Not available yet";
}

function weakestOpening(snapshot) {
  const weakLines = Array.isArray(snapshot?.weakLines) ? snapshot.weakLines : [];
  const line = weakLines.find(Boolean);
  if (line) return line.line || line.variation || line.opening || line.name || "Weak line tracked";

  const top = Array.isArray(snapshot?.topOpenings) ? snapshot.topOpenings : [];
  const weakest = top
    .filter((item) => item?.name && safeNumber(item.score, null) !== null)
    .sort((a, b) => safeNumber(a.score, 100) - safeNumber(b.score, 100))[0];
  return weakest?.name || snapshot?.studyTarget || "Not available yet";
}

function signedDelta(delta, suffix = "") {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "Not available yet";
  if (delta === 0) return `No change${suffix}`;
  return `${delta > 0 ? "+" : ""}${delta}${suffix}`;
}

function buildWhatChanged(previous, current) {
  if (!previous || !current) return null;

  const previousSnapshot = snapshotFromHistoryItem(previous) || previous;
  const currentSnapshot = snapshotFromHistoryItem(current) || current;
  const previousBest = strongestOpening(previousSnapshot);
  const currentBest = strongestOpening(currentSnapshot);
  const previousWeak = weakestOpening(previousSnapshot);
  const currentWeak = weakestOpening(currentSnapshot);
  const previousScore = safeNumber(previousSnapshot.healthScore, null);
  const currentScore = safeNumber(currentSnapshot.healthScore, null);
  const previousGames = safeNumber(previousSnapshot.games, 0) ?? 0;
  const currentGames = safeNumber(currentSnapshot.games, 0) ?? 0;
  const previousTraining = safeNumber(previousSnapshot.trainingCompleted, null);
  const currentTraining = safeNumber(currentSnapshot.trainingCompleted, null);
  const scoreDelta = previousScore !== null && currentScore !== null ? Math.round(currentScore - previousScore) : null;
  const gamesDelta = Math.round(currentGames - previousGames);
  const trainingDelta = previousTraining !== null && currentTraining !== null ? Math.round(currentTraining - previousTraining) : null;
  const weakestChanged = previousWeak !== currentWeak && ![previousWeak, currentWeak].includes("Not available yet");

  return {
    cards: [
      {
        label: "Best opening",
        value: currentBest,
        detail: previousBest === currentBest ? "Still your best current signal." : `Changed from ${previousBest}.`,
      },
      {
        label: "Weakest line",
        value: currentWeak,
        detail: previousWeak === currentWeak ? "Still the main line to review." : `Changed from ${previousWeak}.`,
      },
      {
        label: "Repertoire score",
        value: currentScore === null ? "Not available yet" : `${currentScore}`,
        detail: scoreDelta === null ? "No comparable score in the older report." : `${signedDelta(scoreDelta)} since previous report.`,
      },
      {
        label: "Games analysed",
        value: `${currentGames || 0}`,
        detail: `${signedDelta(gamesDelta)} games since previous report.`,
      },
      {
        label: "Training / weakness",
        value: trainingDelta !== null ? signedDelta(trainingDelta, " sessions") : weakestChanged ? "Weakness changed" : "Not available yet",
        detail:
          trainingDelta !== null
            ? "Training completion data was found in saved history."
            : weakestChanged
              ? "Your main repair target moved, which can mean the old one improved or a new one appeared."
              : "Older reports did not include training progress.",
      },
    ],
  };
}

function WhatChangedPanel({ comparison }) {
  if (!comparison?.cards?.length) return null;

  return (
    <section className="historyWhatChanged" aria-label="What changed between reports">
      <div className="historyWhatChangedHeader">
        <p className="eyebrow">What changed?</p>
        <h3>Progress since the previous report</h3>
      </div>
      <div className="historyWhatChangedGrid">
        {comparison.cards.map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoryReportList({ history = [], onLoadReport, onDeleteReport, onStatus }) {
  const loadReport = (item) => {
    if (typeof onLoadReport === "function" && item?.data) {
      onLoadReport(item.data);
      onStatus?.(`Loaded ${item.username}'s saved report.`);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="historyList">
      {history.map((item) => (
        <article className="historyItem" key={item.id}>
          <div>
            <strong>{item.username}</strong>
            <span>
              {item.games || "Recent"} games · {item.analysisTimeFormatLabel} · {item.topOpening} · Study: {item.snapshot?.studyTarget || "Not available yet"}
            </span>
            <small>
              {safeDate(item.createdAt)} · {item.platform} · {item.snapshot?.importMonths || "Recent"} import
            </small>
          </div>

          <div className="historyActions">
            <button type="button" onClick={() => loadReport(item)} disabled={!item.data}>
              Reopen
            </button>
            {onDeleteReport ? (
              <button type="button" className="dangerHistoryButton" onClick={() => onDeleteReport(item.id)}>
                Delete
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function ReportHistoryVault({ data, fitData, onLoadReport }) {
  const {
    user,
    hasPremiumAccess,
    profileLoading,
    reportHistory,
    saveReport,
    deleteUserData,
    refreshUserData,
  } = useAuth();
  const [history, setHistory] = useState(() => readHistory().map(normalizeHistoryItem));
  const [status, setStatus] = useState("");

  const currentSnapshot = useMemo(() => {
    if (!data) return null;
    return createReportSnapshot(data, fitData);
  }, [data, fitData]);

  useEffect(() => {
    if (user?.id) {
      setHistory((Array.isArray(reportHistory) ? reportHistory : []).map(normalizeHistoryItem).filter(Boolean));
      return;
    }

    setHistory(readHistory().map(normalizeHistoryItem).filter(Boolean));
  }, [reportHistory, user?.id]);

  const previousReport = useMemo(() => {
    if (!currentSnapshot) return null;

    const sameReport = (item) => {
      const itemTime = Date.parse(item.createdAt || item.snapshot?.reportDate || "");
      const currentTime = Date.parse(currentSnapshot.reportDate || "");
      const closeInTime =
        Number.isFinite(itemTime) &&
        Number.isFinite(currentTime) &&
        Math.abs(currentTime - itemTime) < 120000;

      return (
        closeInTime &&
        item.games === currentSnapshot.games &&
        item.topOpening === currentSnapshot.topOpening &&
        item.snapshot?.healthScore === currentSnapshot.healthScore &&
        item.snapshot?.studyTarget === currentSnapshot.studyTarget
      );
    };

    return history.find(
      (item) =>
        String(item.username).toLowerCase() === String(currentSnapshot.username).toLowerCase() &&
        String(item.platform).toLowerCase() === String(currentSnapshot.platform).toLowerCase() &&
        !sameReport(item)
    );
  }, [currentSnapshot, history]);

  const comparisonRows = useMemo(
    () => compareSnapshots(previousReport?.snapshot, currentSnapshot),
    [currentSnapshot, previousReport]
  );
  const sortedHistory = useMemo(
    () =>
      [...history]
        .filter(Boolean)
        .sort((a, b) => Date.parse(b.createdAt || b.snapshot?.reportDate || "") - Date.parse(a.createdAt || a.snapshot?.reportDate || "")),
    [history]
  );
  const newestSaved = sortedHistory[0] || null;
  const previousSaved = sortedHistory[1] || null;
  const activeComparison = useMemo(() => {
    if (currentSnapshot && previousReport) {
      return buildWhatChanged(previousReport, {
        snapshot: currentSnapshot,
        createdAt: currentSnapshot.reportDate,
        username: currentSnapshot.username,
        platform: currentSnapshot.platform,
        games: currentSnapshot.games,
        topOpening: currentSnapshot.topOpening,
        data,
      });
    }
    if (newestSaved && previousSaved) return buildWhatChanged(previousSaved, newestSaved);
    return null;
  }, [currentSnapshot, data, newestSaved, previousReport, previousSaved]);
  const hasSavedHistory = sortedHistory.length > 0;

  if (!data || !currentSnapshot) {
    return (
      <section className="reportHistoryVault" id="report-history">
        <div className="reportHistoryHeader">
          <div>
            <p className="eyebrow">Report history</p>
            <h2>Track your opening profile over time</h2>
            <p>Compare saved reports to see whether your openings are getting stronger or just changing shape.</p>
          </div>
        </div>

        {!user?.id ? (
          <div className="historyLoginNote">
            <span>Login to keep report history across devices. Local history is available in this browser.</span>
            <a className="historyLoginLink" href="/login">Login</a>
          </div>
        ) : null}

        {activeComparison ? (
          <WhatChangedPanel comparison={activeComparison} />
        ) : (
          <div className="emptyHistoryState">
            <strong>Analyse more games to track your progress over time.</strong>
            <span>{hasSavedHistory ? "Save or import one more report to unlock a comparison." : "No saved reports yet. Analyse your games to create one."}</span>
          </div>
        )}

        {hasSavedHistory ? (
          <HistoryReportList history={sortedHistory} onLoadReport={onLoadReport} onStatus={setStatus} />
        ) : null}

        {status ? <p className="historyStatus">{status}</p> : null}
      </section>
    );
  }

  const saveCurrentReport = async () => {
    const item = {
      id: `${currentSnapshot.username}-${currentSnapshot.platform}-${Date.now()}`,
      createdAt: currentSnapshot.reportDate,
      username: currentSnapshot.username,
      platform: currentSnapshot.platform,
      games: currentSnapshot.games,
      topOpening: currentSnapshot.topOpening,
      snapshot: currentSnapshot,
      data,
    };

    if (user?.id) {
      if (!hasPremiumAccess) {
        setStatus("Founder Pass is required to save cloud report history. Anonymous browser history still works locally.");
        return;
      }

      try {
        const saved = await saveReport(data, currentSnapshot);
        if (!saved) {
          setStatus("Only a completed analysis created while signed in can be saved to account history.");
          return;
        }
        await refreshUserData(user);
        setStatus("Report saved to your account.");
      } catch (error) {
        setStatus(`${error.message || "Could not save report."} Try again or continue locally.`);
      }
      return;
    }

    const next = [item, ...history.filter((existing) => existing.id !== item.id)].slice(0, 10);

    writeHistory(next);
    setHistory(next);
    setStatus("Report saved locally. Login to sync report history across devices.");
    window.dispatchEvent(new CustomEvent("openingfit:open-account-payment"));
  };

  const loadReport = (item) => {
    if (typeof onLoadReport === "function") {
      onLoadReport(item.data);
      setStatus(`Loaded ${item.username}'s saved report.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const deleteReport = async (id) => {
    if (user?.id) {
      try {
        await deleteUserData("report_history", id);
        await refreshUserData(user);
        setStatus("Saved report removed.");
      } catch (error) {
        setStatus(`${error.message || "Could not remove report."} Try again in a moment.`);
      }
      return;
    }

    const next = history.filter((item) => item.id !== id);
    writeHistory(next);
    setHistory(next);
    setStatus("Saved report removed.");
  };

  const clearHistory = () => {
    if (user?.id) {
      setStatus("Delete saved account reports one at a time.");
      return;
    }

    writeHistory([]);
    setHistory([]);
    setStatus("Report history cleared.");
  };

  return (
    <section className="reportHistoryVault" id="report-history">
      <div className="reportHistoryHeader">
        <div>
          <p className="eyebrow">Report history</p>
          <h2>Track your opening profile over time</h2>
          <p>
            Save reports every few weeks to compare opening scores, verdicts, confidence levels,
            study targets, and repertoire health.
          </p>
        </div>

        <button type="button" className="saveReportButton" onClick={saveCurrentReport}>
          Save current report
        </button>
      </div>

      {!user?.id ? (
        <div className="historyLoginNote">
          <span>Login to keep report history across devices. Local history is available in this browser.</span>
          <a className="historyLoginLink" href="/login">Login</a>
        </div>
      ) : null}

      <div className="historySnapshotGrid">
        <article className="currentReportCard">
          <span>Previous report</span>
          <strong>{previousReport ? safeDate(previousReport.createdAt) : "No previous report yet"}</strong>
          <small>
            {previousReport
              ? `${previousReport.games || "Recent"} games · ${previousReport.analysisTimeFormatLabel} · Health ${previousReport.snapshot?.healthScore ?? "—"}/100`
              : "Save this report, then re-import in a few weeks to compare."}
          </small>
        </article>

        <article className="currentReportCard">
          <span>Current report</span>
          <strong>{currentSnapshot.username}</strong>
          <small>
            {currentSnapshot.games || "Recent"} games · {currentSnapshot.analysisTimeFormatLabel} · Health {currentSnapshot.healthScore ?? "—"}/100 · Study: {currentSnapshot.studyTarget}
          </small>
        </article>
      </div>

      {comparisonRows.length ? (
        <div className="historyComparisonTable">
          <div className="historyComparisonHeader">
            <span>Opening</span>
            <span>Last report</span>
            <span>Now</span>
            <span>Trend</span>
          </div>
          {comparisonRows.map((row) => (
            <div className="historyComparisonRow" key={row.name}>
              <strong>{row.name}</strong>
              <span>
                {row.previousScore === null ? "New" : `${row.previousScore}%`}
                <small>{row.previousVerdict}</small>
              </span>
              <span>
                {row.currentScore === null ? "—" : `${row.currentScore}%`}
                <small>{row.currentVerdict} · {row.confidence}</small>
              </span>
              <em className={`trendPill trend-${row.trend.replaceAll(" ", "-")}`}>
                {row.trend}
              </em>
            </div>
          ))}
        </div>
      ) : null}

      {activeComparison ? (
        <WhatChangedPanel comparison={activeComparison} />
      ) : (
        <div className="emptyHistoryState emptyHistoryStateCompact">
          <strong>Analyse more games to track your progress over time.</strong>
          <span>Save another report to compare best openings, weak lines, games analysed, and score movement.</span>
        </div>
      )}

      {status ? <p className="historyStatus">{status}</p> : null}

      {user?.id && profileLoading ? (
        <div className="emptyHistoryState">
          <strong>Looking for your saved reports...</strong>
          <span>OpeningFit is restoring your account reports before showing this list. You can continue locally if this takes a moment.</span>
        </div>
      ) : history.length > 0 ? (
        <>
          <div className="historyList">
            {history.map((item) => (
              <article className="historyItem" key={item.id}>
                <div>
                  <strong>{item.username}</strong>
                  <span>
                    {item.games || "Recent"} games · {item.analysisTimeFormatLabel} · {item.topOpening} · Study: {item.snapshot?.studyTarget || "—"}
                  </span>
                  <small>
                    {safeDate(item.createdAt)} · {item.platform} · {item.snapshot?.importMonths || "Recent"} import
                  </small>
                </div>

                <div className="historyActions">
                  <button type="button" onClick={() => loadReport(item)}>
                    Reopen
                  </button>
                  <button type="button" className="dangerHistoryButton" onClick={() => deleteReport(item.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          <button type="button" className="clearHistoryButton" onClick={clearHistory}>
            Clear all saved reports
          </button>
        </>
      ) : (
        <div className="emptyHistoryState">
          <strong>No saved reports yet.</strong>
          <span>
            Analyse your games to create one. After your next saved report, OpeningFit will show what changed.
          </span>
        </div>
      )}
    </section>
  );
}
