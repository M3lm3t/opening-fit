import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "openingfit.savedReports.v2";
const FEEDBACK_KEY = "openingfit.localFeedback.v1";

function getApiBase() {
  const envBase = import.meta?.env?.VITE_API_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  return "";
}

function getReports() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setReports(reports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, 12)));
  } catch {
    // Browser storage may be disabled.
  }
}

function getLocalFeedback() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalFeedback(item) {
  try {
    const existing = getLocalFeedback();
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify([item, ...existing].slice(0, 25)));
  } catch {
    // Ignore local storage failure.
  }
}

function toast(message) {
  window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: message }));
}

function getOpenings(data) {
  return [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];
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
  const top = getOpenings(data)[0];
  return top?.name || top?.opening || top?.eco_name || top?.label || "Unknown opening";
}

function normaliseName(value) {
  return String(value || "unknown")
    .trim()
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export default function OpeningFitFunctionalityHub({
  data,
  username,
  onLoadReport,
}) {
  const [reports, setReportState] = useState(() => getReports());
  const [backendStatus, setBackendStatus] = useState("checking");
  const [backendMessage, setBackendMessage] = useState("Checking backend health...");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [qaOpen, setQaOpen] = useState(false);

  const apiBase = getApiBase();

  const reportSummary = useMemo(() => {
    if (!data) return null;

    return {
      username: username || data?.username || "Unknown user",
      games: getGames(data),
      topOpening: getTopOpening(data),
      savedAt: new Date().toISOString(),
    };
  }, [data, username]);

  const qa = useMemo(() => {
    return [
      {
        label: "Backend health",
        ok: backendStatus === "online",
        detail: backendStatus === "online" ? "API reachable" : backendMessage,
      },
      {
        label: "Report loaded",
        ok: Boolean(data),
        detail: data ? "Analysis data is present" : "Import a username first",
      },
      {
        label: "Opening data",
        ok: getOpenings(data).length > 0,
        detail: `${getOpenings(data).length} opening rows found`,
      },
      {
        label: "Report save",
        ok: reports.length > 0,
        detail: `${reports.length} local report snapshots`,
      },
      {
        label: "Feedback fallback",
        ok: true,
        detail: "Feedback can save locally if backend fails",
      },
    ];
  }, [backendStatus, backendMessage, data, reports.length]);

  useEffect(() => {
    let cancelled = false;

    async function checkBackend() {
      try {
        const response = await fetch(`${apiBase}/api/health`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        if (!cancelled) {
          setBackendStatus("online");
          setBackendMessage("Backend API is online.");
        }
      } catch {
        if (!cancelled) {
          setBackendStatus("offline");
          setBackendMessage(
            apiBase
              ? `Could not reach backend at ${apiBase}.`
              : "Could not reach backend from this page."
          );
        }
      }
    }

    checkBackend();

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    if (!data || !reportSummary) return;

    const snapshot = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      summary: reportSummary,
      data,
    };

    const existing = getReports();

    const withoutDuplicate = existing.filter((report) => {
      const sameUser = report?.summary?.username === snapshot.summary.username;
      const sameGames = report?.summary?.games === snapshot.summary.games;
      const sameOpening = report?.summary?.topOpening === snapshot.summary.topOpening;
      return !(sameUser && sameGames && sameOpening);
    });

    const next = [snapshot, ...withoutDuplicate].slice(0, 12);
    setReports(next);
    setReportState(next);
  }, [data, reportSummary]);

  const downloadReport = () => {
    if (!data) {
      toast("Import games before downloading a report.");
      return;
    }

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
    link.href = url;
    link.download = `openingfit-report-${normaliseName(username || data?.username)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast("Report downloaded.");
  };

  const loadLatest = () => {
    const latest = reports[0];

    if (!latest?.data) {
      toast("No saved report found yet.");
      return;
    }

    onLoadReport?.(latest.data);
    toast("Latest saved report loaded.");
  };

  const clearReports = () => {
    localStorage.removeItem(STORAGE_KEY);
    setReportState([]);
    toast("Saved reports cleared.");
  };

  const submitFeedback = async (event) => {
    event.preventDefault();

    const message = feedbackText.trim();

    if (message.length < 5) {
      setFeedbackStatus("Please add a little more detail first.");
      return;
    }

    const payload = {
      message,
      email: feedbackEmail.trim() || null,
      username: username || data?.username || null,
      page: window.location.href,
      report_summary: reportSummary,
      created_at: new Date().toISOString(),
    };

    setFeedbackStatus("Sending feedback...");

    const endpoints = [`${apiBase}/api/feedback`, `${apiBase}/api/feedback-local`];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          setFeedbackText("");
          setFeedbackStatus("Thanks — feedback saved.");
          toast("Feedback saved.");
          return;
        }
      } catch {
        // Try next fallback.
      }
    }

    saveLocalFeedback(payload);
    setFeedbackText("");
    setFeedbackStatus("Backend feedback failed, so this was saved locally in your browser.");
    toast("Feedback saved locally.");
  };

  return (
    <section className="ofFunctionalityHub" id="functionality-hub">
      <div className="ofFunctionalityHeader">
        <div>
          <div className="ofEyebrow">Functionality check</div>
          <h2>Working tools, not just previews.</h2>
          <p>
            This section gives users working report actions, feedback fallback,
            save/load history, and a simple QA check for the main user journey.
          </p>
        </div>

        <div className={`ofBackendStatus ${backendStatus}`}>
          <span>Backend</span>
          <strong>
            {backendStatus === "online"
              ? "Online"
              : backendStatus === "offline"
                ? "Offline"
                : "Checking"}
          </strong>
          <small>{backendMessage}</small>
        </div>
      </div>

      <div className="ofFunctionalityGrid">
        <article>
          <span>Report history</span>
          <strong>{reports.length} saved locally</strong>
          <p>
            {reports[0]?.summary
              ? `${reports[0].summary.username} · ${reports[0].summary.games || "Unknown"} games · ${reports[0].summary.topOpening}`
              : "Import a username to create the first local report snapshot."}
          </p>
          <div className="ofFunctionalityButtons">
            <button type="button" onClick={loadLatest}>Load latest</button>
            <button type="button" className="secondary" onClick={clearReports}>Clear</button>
          </div>
        </article>

        <article>
          <span>Export</span>
          <strong>Download current report</strong>
          <p>Save your current analysis as a JSON backup while account history is being built.</p>
          <button type="button" onClick={downloadReport}>Download report</button>
        </article>

        <article>
          <span>Import diagnostics</span>
          <strong>Know what is working</strong>
          <p>
            If import fails, first check backend health. Then confirm the username has recent public games.
          </p>
          <button type="button" onClick={() => toast(backendMessage)}>
            Show backend status
          </button>
        </article>

        <article>
          <span>QA panel</span>
          <strong>Pre-launch checklist</strong>
          <p>Check whether the key parts of the site are working before pushing changes live.</p>
          <button type="button" onClick={() => setQaOpen((value) => !value)}>
            {qaOpen ? "Hide checklist" : "Show checklist"}
          </button>
        </article>
      </div>

      {qaOpen ? (
        <div className="ofQAPanel">
          {qa.map((item) => (
            <div key={item.label} className={item.ok ? "ok" : "warn"}>
              <span>{item.ok ? "✓" : "!"}</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <form className="ofFeedbackFallback" onSubmit={submitFeedback}>
        <div>
          <span>Feedback fallback</span>
          <strong>Send feedback that does not silently disappear.</strong>
          <p>
            This tries the normal feedback endpoint first, then a local backend fallback,
            then browser storage if everything else fails.
          </p>
        </div>

        <div className="ofFeedbackFields">
          <input
            value={feedbackEmail}
            onChange={(event) => setFeedbackEmail(event.target.value)}
            placeholder="Email optional"
            type="email"
          />

          <textarea
            value={feedbackText}
            onChange={(event) => setFeedbackText(event.target.value)}
            placeholder="What worked, what broke, or what felt wrong?"
            rows={4}
          />

          <button type="submit">Send feedback</button>

          {feedbackStatus ? <small>{feedbackStatus}</small> : null}
        </div>
      </form>
    </section>
  );
}
