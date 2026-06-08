import { useState } from "react";
import { buildApiUrl, getApiBaseUrl } from "../lib/apiBase";

function toast(message) {
  window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: message }));
}

export default function OpeningFitImportDoctor({ username }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const apiBase = getApiBaseUrl();

  const runCheck = async () => {
    const cleanUsername = String(username || "").trim();

    if (!cleanUsername) {
      toast("Enter a Chess.com username first.");
      return;
    }

    setChecking(true);
    setResult(null);

    try {
      const response = await fetch(
        buildApiUrl(`/api/diagnose/chesscom/${encodeURIComponent(cleanUsername)}`),
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setResult({
          status: "error",
          title: "Import check failed",
          message: payload?.detail || `Backend returned ${response.status}.`,
          raw: payload,
        });
        return;
      }

      setResult(payload);
    } catch {
      setResult({
        status: "error",
        title: "Backend not reachable",
        message:
          `The frontend could not reach the backend at ${apiBase || "/api"}. Check the API proxy or backend service and try again.`,
      });
    } finally {
      setChecking(false);
    }
  };

  const status = result?.status || "idle";

  return (
    <section className="ofImportDoctor" id="import-doctor">
      <div className="ofImportDoctorHeader">
        <div>
          <div className="ofEyebrow">Import doctor</div>
          <h2>Check why an import may fail.</h2>
          <p>
            Before users get stuck, this checks the backend and Chess.com profile data
            so failed imports are easier to understand.
          </p>
        </div>

        <button type="button" onClick={runCheck} disabled={checking}>
          {checking ? "Checking..." : "Check current username"}
        </button>
      </div>

      {result ? (
        <div className={`ofImportDoctorResult ${status}`}>
          <div>
            <span>
              {status === "ok"
                ? "✓"
                : status === "warning"
                  ? "!"
                  : "×"}
            </span>
          </div>

          <div>
            <strong>{result.title || "Import check result"}</strong>
            <p>{result.message}</p>

            {Array.isArray(result.checks) && result.checks.length ? (
              <div className="ofImportChecks">
                {result.checks.map((check) => (
                  <article key={check.label} className={check.ok ? "ok" : "warn"}>
                    <span>{check.ok ? "✓" : "!"}</span>
                    <div>
                      <strong>{check.label}</strong>
                      <small>{check.detail}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
