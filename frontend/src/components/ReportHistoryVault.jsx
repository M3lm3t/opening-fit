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
    data?.player_name ||
    data?.profile?.username ||
    data?.imported_username ||
    "Unknown player"
  );
}

function getPlatform(data) {
  return (
    data?.platform ||
    data?.source ||
    data?.profile?.platform ||
    "chess"
  );
}

function getGameCount(data) {
  return (
    data?.games_imported ||
    data?.gamesImported ||
    data?.total_games ||
    data?.game_count ||
    data?.games?.length ||
    0
  );
}

function getTopOpening(data) {
  const openings =
    data?.top_openings ||
    data?.opening_stats ||
    data?.openings ||
    [];

  if (!Array.isArray(openings) || openings.length === 0) {
    return "No clear top opening yet";
  }

  return (
    openings[0]?.name ||
    openings[0]?.opening ||
    openings[0]?.eco_name ||
    openings[0]?.label ||
    "No clear top opening yet"
  );
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

export default function ReportHistoryVault({ data, onLoadReport }) {
  const { user, reportHistory, saveReport, deleteUserData, refreshUserData } = useAuth();
  const [history, setHistory] = useState(() => readHistory());
  const [status, setStatus] = useState("");

  const currentSummary = useMemo(() => {
    if (!data) return null;

    return {
      username: getUsername(data),
      platform: getPlatform(data),
      games: getGameCount(data),
      topOpening: getTopOpening(data),
    };
  }, [data]);

  useEffect(() => {
    if (user?.id) {
      setHistory(
        (reportHistory || []).map((item) => ({
          id: item.id,
          createdAt: item.created_at,
          username: item.username,
          platform: item.platform,
          games: item.summary?.games,
          topOpening: item.summary?.topOpening,
          data: item.report,
        }))
      );
      return;
    }

    setHistory(readHistory());
  }, [reportHistory, user?.id]);

  if (!data || !currentSummary) return null;

  const saveCurrentReport = async () => {
    const now = new Date().toISOString();

    const item = {
      id: `${currentSummary.username}-${currentSummary.platform}-${Date.now()}`,
      createdAt: now,
      username: currentSummary.username,
      platform: currentSummary.platform,
      games: currentSummary.games,
      topOpening: currentSummary.topOpening,
      data,
    };

    if (user?.id) {
      try {
        await saveReport(data, currentSummary);
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
    setStatus("Report saved.");
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
          <p className="eyebrow">Saved reports</p>
          <h2>Keep your Opening Fit history</h2>
          <p>
            Save this analysis and reload it automatically from your account on any device.
          </p>
        </div>

        <button type="button" className="saveReportButton" onClick={saveCurrentReport}>
          Save current report
        </button>
      </div>

      <div className="currentReportCard">
        <span>Current report</span>
        <strong>{currentSummary.username}</strong>
        <small>
          {currentSummary.games || "Recent"} games · Top signal: {currentSummary.topOpening}
        </small>
      </div>

      {status ? <p className="historyStatus">{status}</p> : null}

      {history.length > 0 ? (
        <>
          <div className="historyList">
            {history.map((item) => (
              <article className="historyItem" key={item.id}>
                <div>
                  <strong>{item.username}</strong>
                  <span>
                    {item.games || "Recent"} games · {item.topOpening}
                  </span>
                  <small>{safeDate(item.createdAt)}</small>
                </div>

                <div className="historyActions">
                  <button type="button" onClick={() => loadReport(item)}>
                    Load
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
            Save this report after importing games. Later, this can become proper
            cloud history connected to user accounts.
          </span>
        </div>
      )}
    </section>
  );
}
