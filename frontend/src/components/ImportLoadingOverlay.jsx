import "./ImportLoadingOverlay.css";

export default function ImportLoadingOverlay({
  platform = "Chess.com",
  username = "",
  mode = "import",
  loadingStep = "",
  showWakeupMessage = false,
}) {
  const isAnalysis = mode === "analysis";
  const loadingTips = [
    isAnalysis
      ? "OpeningFit is checking public game data and grouping opening patterns."
      : "Tip: openings with repeatable plans are easier to remember than long move trees.",
    "Looking for confidence, sample size, and style match before recommending lines.",
    "Your report will highlight one next action first, then the deeper data.",
  ];
  const platformLabel =
    typeof platform === "string" && platform.length ? platform : "your chess platform";

  return (
    <div
      className={`importLoadingOverlay ${isAnalysis ? "analysisLoadingOverlay" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="importLoadingCard">
        <div className="importLoadingBoard" aria-hidden="true">
          <span>♞</span>
        </div>

        <div>
          <span className="importLoadingEyebrow">
            {isAnalysis ? "Analysing game" : "Importing games"}
          </span>
          <h2>
            {isAnalysis
              ? "Analysing your game... this can take a little time."
              : "Building your OpeningFit report..."}
          </h2>
          {isAnalysis ? (
            <p>
              OpeningFit is running on a free server, so the first analysis may
              take 30-60 seconds to start. Please don't close or refresh the page.
            </p>
          ) : (
            <p>
              Pulling public games from {platformLabel}
              {username ? ` for ${username}` : ""}, finding your openings, and preparing your recommendations.
            </p>
          )}
        </div>

        <div className="importLoadingProgress" aria-label="Analysis progress estimate">
          <span />
        </div>

        {loadingStep ? <p className="importLoadingCurrentStep">{loadingStep}</p> : null}

        {showWakeupMessage ? (
          <p className="importLoadingWakeup">Still working — the server may be waking up.</p>
        ) : null}

        <div className="importLoadingSteps">
          <span>{isAnalysis ? "Starting backend analysis" : "Checking public games"}</span>
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
