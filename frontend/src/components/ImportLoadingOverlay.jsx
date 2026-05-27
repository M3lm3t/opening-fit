import "./ImportLoadingOverlay.css";

export default function ImportLoadingOverlay({ platform = "Chess.com", username = "" }) {
  const loadingTips = [
    "Tip: openings with repeatable plans are easier to remember than long move trees.",
    "Looking for confidence, sample size, and style match before recommending lines.",
    "Your report will highlight one next action first, then the deeper data.",
  ];

  return (
    <div className="importLoadingOverlay" role="status" aria-live="polite">
      <div className="importLoadingCard">
        <div className="importLoadingBoard" aria-hidden="true">
          <span>♞</span>
        </div>

        <div>
          <span className="importLoadingEyebrow">Importing games</span>
          <h2>Building your OpeningFit report...</h2>
          <p>
            Pulling public games from {platform}
            {username ? ` for ${username}` : ""}, finding your openings, and preparing your recommendations.
          </p>
        </div>

        <div className="importLoadingProgress" aria-label="Analysis progress estimate">
          <span />
        </div>

        <div className="importLoadingSteps">
          <span>Checking public games</span>
          <span>Detecting opening patterns</span>
          <span>Building mastery and coach prompts</span>
        </div>

        <div className="importLoadingTips">
          {loadingTips.map((tip) => (
            <p key={tip}>{tip}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
