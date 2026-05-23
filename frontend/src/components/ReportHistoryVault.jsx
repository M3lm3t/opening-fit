import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";

const HISTORY_KEY = "openingFit:reportHistory:v1";

function safeDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown date";
  }
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

  return {
    reportDate: new Date().toISOString(),
    username: getUsername(data),
    platform: getPlatform(data),
    importMonths: getImportMonths(data),
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
  const summary = item.summary || item.snapshot || {};

  return {
    id: item.id || `${summary.username || item.username}-${summary.platform || item.platform}-${item.created_at || item.createdAt}`,
    createdAt: item.created_at || item.createdAt || summary.reportDate,
    username: summary.username || item.username || "Unknown player",
    platform: summary.platform || item.platform || "chess",
    games: summary.games || item.games || 0,
    topOpening: summary.topOpening || item.topOpening || "No clear top opening yet",
    snapshot: {
      ...summary,
      topOpenings: summary.topOpenings || [],
      healthScore: summary.healthScore ?? null,
    },
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

export default function ReportHistoryVault({ data, fitData, onLoadReport }) {
  const { user, reportHistory, saveReport, deleteUserData, refreshUserData } = useAuth();
  const [history, setHistory] = useState(() => readHistory().map(normalizeHistoryItem));
  const [status, setStatus] = useState("");

  const currentSnapshot = useMemo(() => {
    if (!data) return null;
    return createReportSnapshot(data, fitData);
  }, [data, fitData]);

  useEffect(() => {
    if (user?.id) {
      setHistory((reportHistory || []).map(normalizeHistoryItem));
      return;
    }

    setHistory(readHistory().map(normalizeHistoryItem));
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

  if (!data || !currentSnapshot) return null;

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
      try {
        await saveReport(data, currentSnapshot);
        await refreshUserData(user);
        setStatus("Report saved to your account.");
      } catch (error) {
        setStatus(error.message || "Could not save report.");
      }
      return;
    }

    const next = [
      item,
      ...history.filter((existing) => existing.id !== item.id),
    ].slice(0, 10);

    writeHistory(next);
    setHistory(next);
    setStatus("Report saved locally. Log in to keep history across devices.");
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
        setStatus(error.message || "Could not remove report.");
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
          Log in to keep report history across devices. Local history is available in this browser.
        </div>
      ) : null}

      <div className="historySnapshotGrid">
        <article className="currentReportCard">
          <span>Previous report</span>
          <strong>{previousReport ? safeDate(previousReport.createdAt) : "No previous report yet"}</strong>
          <small>
            {previousReport
              ? `${previousReport.games || "Recent"} games · Health ${previousReport.snapshot.healthScore ?? "—"}/100`
              : "Save this report, then re-import in a few weeks to compare."}
          </small>
        </article>

        <article className="currentReportCard">
          <span>Current report</span>
          <strong>{currentSnapshot.username}</strong>
          <small>
            {currentSnapshot.games || "Recent"} games · Health {currentSnapshot.healthScore ?? "—"}/100 · Study: {currentSnapshot.studyTarget}
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

      {status ? <p className="historyStatus">{status}</p> : null}

      {history.length > 0 ? (
        <>
          <div className="historyList">
            {history.map((item) => (
              <article className="historyItem" key={item.id}>
                <div>
                  <strong>{item.username}</strong>
                  <span>
                    {item.games || "Recent"} games · {item.topOpening} · Study: {item.snapshot.studyTarget || "—"}
                  </span>
                  <small>
                    {safeDate(item.createdAt)} · {item.platform} · {item.snapshot.importMonths || "Recent"} import
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
          <strong>No saved reports yet</strong>
          <span>
            Save this report after importing games. After your next import, OpeningFit will show
            what improved, what stayed weak, and what to study next.
          </span>
        </div>
      )}
    </section>
  );
}
