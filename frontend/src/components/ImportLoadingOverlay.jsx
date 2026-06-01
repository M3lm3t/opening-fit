import "./ImportLoadingOverlay.css";

export default function ImportLoadingOverlay({
  platform = "Chess.com",
  username = "",
  mode = "import",
  loadingStep = "",
  elapsedSeconds = 0,
  showWakeupMessage = false,
  onCancel,
}) {
  const isAnalysis = mode === "analysis";
  const progressStages = [
    "Importing games",
    "Detecting openings",
    "Building style profile",
    "Comparing openings",
    "Generating recommendations",
    "Preparing results",
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
            : stepText.includes("generat")
              ? 4
              : stepText.includes("recommend") || stepText.includes("prepar")
                ? 5
                : Math.floor((Number(elapsedSeconds) || 0) / 8)
    )
  );
  const loadingTips = [
    isAnalysis
      ? "OpeningFit is building your personal opening profile."
      : "OpeningFit is building your personal opening profile.",
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
              ? "Building your opening profile..."
              : "Building your OpeningFit report..."}
          </h2>
          {isAnalysis ? (
            <p>
              First analyses may take a little longer while the server wakes up.
              Please don't close or refresh the page.
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
          <p className="importLoadingWakeup">Still working - the server may be waking up. This can take a moment on the first import.</p>
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

        {typeof onCancel === "function" ? (
          <button className="importLoadingCancel" type="button" onClick={onCancel}>
            Cancel import
          </button>
        ) : null}
      </div>
    </div>
  );
}
