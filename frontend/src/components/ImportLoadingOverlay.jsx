import "./ImportLoadingOverlay.css";

export default function ImportLoadingOverlay({ platform = "Chess.com", username = "" }) {
  return (
    <div className="importLoadingOverlay" role="status" aria-live="polite">
      <div className="importLoadingCard">
        <div className="importLoadingSpinner" />

        <div>
          <span className="importLoadingEyebrow">Importing games</span>
          <h2>Building your OpeningFit report...</h2>
          <p>
            Pulling public games from {platform}
            {username ? ` for ${username}` : ""}, finding your openings, and preparing your recommendations.
          </p>
        </div>

        <div className="importLoadingSteps">
          <span>Checking public games</span>
          <span>Detecting opening patterns</span>
          <span>Creating repertoire suggestions</span>
        </div>
      </div>
    </div>
  );
}
