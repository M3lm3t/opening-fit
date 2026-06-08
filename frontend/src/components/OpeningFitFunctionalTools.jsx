import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "openingfit.savedReports.v1";

function getStoredReports() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredReports(reports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, 10)));
  } catch {
    // Local storage may be blocked. The UI will still work except saving.
  }
}

function getGames(data) {
  return (
    Number(data?.games_imported) ||
    Number(data?.games_analyzed) ||
    Number(data?.gamesAnalysed) ||
    Number(data?.total_games) ||
    Number(data?.summary?.games) ||
    0
  );
}

function getTopOpening(data) {
  const openings = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];

  const top = openings[0];

  return top?.name || top?.opening || top?.eco_name || top?.label || "Unknown opening";
}

function toast(message) {
  window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: message }));
}

export default function OpeningFitFunctionalTools({ data, username, onLoadReport, onJump }) {
  const [reports, setReports] = useState(() => getStoredReports());

  const currentSummary = useMemo(() => {
    if (!data) return null;

    return {
      username: username || data?.username || "Unknown user",
      games: getGames(data),
      topOpening: getTopOpening(data),
      savedAt: new Date().toISOString(),
    };
  }, [data, username]);

  useEffect(() => {
    if (!data || !currentSummary) return;

    const snapshot = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      summary: currentSummary,
      data,
    };

    const existing = getStoredReports();

    const withoutDuplicate = existing.filter((report) => {
      const sameUser = report?.summary?.username === snapshot.summary.username;
      const sameGames = report?.summary?.games === snapshot.summary.games;
      const sameTop = report?.summary?.topOpening === snapshot.summary.topOpening;
      return !(sameUser && sameGames && sameTop);
    });

    const next = [snapshot, ...withoutDuplicate].slice(0, 10);

    saveStoredReports(next);
    setReports(next);
  }, [data, currentSummary]);

  if (!data) return null;

  const latest = reports[0];

  const downloadReport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      username: username || data?.username || null,
      report: data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeUsername = String(username || data?.username || "openingfit")
      .replace(/[^a-z0-9_-]/gi, "-")
      .toLowerCase();

    link.href = url;
    link.download = `openingfit-report-${safeUsername}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast("Report downloaded.");
  };

  const loadLatest = () => {
    if (!latest?.data) {
      toast("No saved report found yet.");
      return;
    }

    onLoadReport?.(latest.data);
    toast("Latest saved report loaded.");
  };

  const clearReports = () => {
    localStorage.removeItem(STORAGE_KEY);
    setReports([]);
    toast("Saved reports cleared.");
  };

  return (
    <section className="ofFunctionalTools" id="functional-tools">
      <div className="ofFunctionalToolsHeader">
        <div>
          <div className="ofEyebrow">Functionality</div>
          <h2>Your report now has working actions.</h2>
          <p>
            Save a report locally, download it, reload your latest result, or jump straight
            to feedback if something does not look right.
          </p>
        </div>

        <div className="ofFunctionalStatus">
          <span>Saved reports</span>
          <strong>{reports.length}</strong>
          <small>Stored locally on this device</small>
        </div>
      </div>

      <div className="ofFunctionalGrid">
        <article>
          <span>Download</span>
          <strong>Export report JSON</strong>
          <p>Useful as a portable backup alongside your account history.</p>
          <button type="button" onClick={downloadReport}>
            Download report
          </button>
        </article>

        <article>
          <span>History</span>
          <strong>Load latest saved report</strong>
          <p>
            {latest?.summary
              ? `${latest.summary.username} · ${latest.summary.games || "Unknown"} games · ${latest.summary.topOpening}`
              : "No saved report found yet."}
          </p>
          <button type="button" onClick={loadLatest}>
            Load latest
          </button>
        </article>

        <article>
          <span>Feedback</span>
          <strong>Report a bad result</strong>
          <p>If an opening recommendation feels wrong, that is useful feedback.</p>
          <button type="button" onClick={() => onJump?.("feedback")}>
            Leave feedback
          </button>
        </article>

        <article>
          <span>Reset</span>
          <strong>Clear local reports</strong>
          <p>Removes saved report snapshots from this browser only.</p>
          <button type="button" className="secondary" onClick={clearReports}>
            Clear saved reports
          </button>
        </article>
      </div>
    </section>
  );
}
