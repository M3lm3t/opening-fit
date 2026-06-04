import "./ImportLoadingOverlay.css";
import {
  BarChart3,
  BookOpen,
  Check,
  CircleDot,
  Gamepad2,
  Lightbulb,
  ListChecks,
  Search,
  Sparkles,
  X,
} from "lucide-react";

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
    {
      title: "Finding games",
      detail: `Checking recent public games on ${platform}.`,
      icon: Search,
    },
    {
      title: "Reading openings",
      detail: "Grouping recurring openings and positions.",
      icon: BookOpen,
    },
    {
      title: "Measuring results",
      detail: "Comparing results, confidence, and patterns.",
      icon: BarChart3,
    },
    {
      title: "Building recommendations",
      detail: "Choosing what to keep, improve, and watch.",
      icon: Lightbulb,
    },
    {
      title: "Creating training plan",
      detail: "Turning the report into practical next actions.",
      icon: ListChecks,
    },
  ];
  const stepText = String(loadingStep || "").toLowerCase();
  const activeStageIndex = Math.min(
    progressStages.length - 1,
    Math.max(
      0,
      stepText.includes("detect")
        ? 1
        : stepText.includes("style") || stepText.includes("compar") || stepText.includes("fit")
          ? 2
          : stepText.includes("generat") || stepText.includes("recommend")
            ? 3
            : stepText.includes("prepar")
              ? 4
              : Math.floor((Number(elapsedSeconds) || 0) / 8)
    )
  );
  const friendlyMessages = [
    "Starting with the games you actually play.",
    "Looking for opening patterns that repeat.",
    "Separating strong signals from small samples.",
    "Turning the evidence into clear repertoire choices.",
    "Finishing with a plan you can use next session.",
  ];
  const platformLabel =
    typeof platform === "string" && platform.length ? platform : "your chess platform";
  const progressPercent = Math.max(
    12,
    Math.min(94, ((activeStageIndex + 0.55) / progressStages.length) * 100)
  );

  return (
    <div
      className={`importLoadingOverlay ${isAnalysis ? "analysisLoadingOverlay" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="importLoadingCard">
        <header className="importLoadingHeader">
          <div className="importLoadingIdentity">
            <span className="importLoadingMark"><Sparkles size={19} /></span>
            <div>
              <span className="importLoadingEyebrow">Personal report in progress</span>
              <h2>Building your OpeningFit report</h2>
            </div>
          </div>
          {typeof onCancel === "function" ? (
            <button className="importLoadingCancel" type="button" onClick={onCancel} aria-label="Cancel analysis">
              <X size={18} />
            </button>
          ) : null}
        </header>

        <div className="importLoadingProgressWrap">
          <div className="importLoadingProgressLabel">
            <span>{platformLabel}{username ? ` / ${username}` : ""}</span>
            <strong>{Math.round(progressPercent)}%</strong>
          </div>
          <div className="importLoadingProgress" aria-label="Analysis progress estimate">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="importLoadingWorkspace">
          <div className="importLoadingNarrative">
            <div className="importLoadingActiveMessage">
              <span><CircleDot size={14} /> Now working</span>
              <strong>{progressStages[activeStageIndex].title}</strong>
              <p>{friendlyMessages[activeStageIndex]}</p>
            </div>

            <div className="importLoadingSteps">
              {progressStages.map((stage, index) => {
                const StageIcon = stage.icon;
                return (
                  <div
                    className={
                      index < activeStageIndex
                        ? "importLoadingStepDone"
                        : index === activeStageIndex
                          ? "importLoadingStepActive"
                          : ""
                    }
                    key={stage.title}
                  >
                    <span className="importLoadingStepIcon">
                      {index < activeStageIndex ? <Check size={16} /> : <StageIcon size={16} />}
                    </span>
                    <p><strong>{stage.title}</strong><small>{stage.detail}</small></p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="importLoadingPreview" aria-label="Report preview loading">
            <div className="importLoadingPreviewTop">
              <div><span>Report preview</span><strong>Your opening profile</strong></div>
              <span className="importLoadingLive"><i /> Live</span>
            </div>
            <div className="importLoadingScoreSkeleton">
              <span className="importSkeleton importSkeletonShort" />
              <span className="importSkeleton importSkeletonScore" />
              <span className="importSkeleton importSkeletonMedium" />
            </div>
            <div className="importLoadingCardSkeletons">
              {[Gamepad2, BookOpen, BarChart3].map((SkeletonIcon, index) => (
                <div className="importLoadingMiniSkeleton" key={index}>
                  <SkeletonIcon size={15} />
                  <span className="importSkeleton importSkeletonMedium" />
                  <span className="importSkeleton importSkeletonLong" />
                </div>
              ))}
            </div>
            <div className="importLoadingRecommendationSkeleton">
              <span><Sparkles size={14} /> Recommendation</span>
              <i className="importSkeleton importSkeletonLong" />
              <i className="importSkeleton importSkeletonMedium" />
            </div>
          </div>
        </div>

        {showWakeupMessage ? (
          <p className="importLoadingWakeup">Still working. The first analysis can take a little longer while the service gets ready.</p>
        ) : null}

        <footer className="importLoadingFooter">
          <span>{loadingStep || progressStages[activeStageIndex].detail}</span>
          <small>Please keep this tab open</small>
        </footer>
      </div>
    </div>
  );
}
