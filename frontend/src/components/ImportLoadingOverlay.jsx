import "./ImportLoadingOverlay.css";

export default function ImportLoadingOverlay({
  platform = "Chess.com",
  username = "",
  mode = "import",
  loadingStep = "",
  elapsedSeconds = 0,
  showWakeupMessage = false,
}) {
  const isAnalysis = mode === "analysis";
  const progressStages = [
    "Importing games",
    "Detecting openings",
    "Building style profile",
    "Comparing opening fit",
    "Saving results",
    "Preparing recommendations",
  ];
  const stepText = String(loadingStep || "").toLowerCase();
  const activeStageIndex = Math.min(
    progressStages.length - 1,
    Math.max(
      0,
      stepText.includes("detect")
        ? 1
        : stepText.includes("style")
          ? 2
          : stepText.includes("fit") || stepText.includes("compar")
            ? 3
            : stepText.includes("sav")
              ? 4
              : stepText.includes("recommend") || stepText.includes("prepar")
                ? 5
                : Math.floor((Number(elapsedSeconds) || 0) / 8)
    )
  );
  const loadingTips = [
    isAnalysis
      ? "OpeningFit is checking public game data and grouping opening patterns."
      : "Tip: openings with repeatable plans are easier to remember than long move trees.",
    "OpeningFit gets smarter as you analyse more games.",
    "Your recommendations improve when you come back after playing more games.",
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
          <span style={{ width: `${Math.max(18, ((activeStageIndex + 1) / progressStages.length) * 100)}%` }} />
        </div>

        {loadingStep ? <p className="importLoadingCurrentStep">{loadingStep}</p> : null}

        {showWakeupMessage ? (
          <p className="importLoadingWakeup">Still working — the server may be waking up.</p>
        ) : null}

        <div className="importLoadingSteps">
          {progressStages.map((stage, index) => (
            <span
              className={
                index < activeStageIndex
                  ? "importLoadingStepDone"
                  : index === activeStageIndex
                    ? "importLoadingStepActive"
                    : ""
              }
              key={stage}
            >
              {stage}
            </span>
          ))}
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
