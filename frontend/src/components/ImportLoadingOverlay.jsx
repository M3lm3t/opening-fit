import "./ImportLoadingOverlay.css";
import {
  BarChart3,
  BookOpen,
  Check,
  Lightbulb,
  ListChecks,
  Search,
  Sparkles,
  X,
} from "lucide-react";

function ChessAnalysisLoader() {
  return (
    <div className="importLoadingChessLoader" aria-hidden="true">
      <div className="importLoadingChessBoard">
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} />
        ))}
        <img src="/icons/openingfit-icon.svg" alt="" />
      </div>
      <div className="importLoadingMoveLine">
        <span>1. e4</span>
        <span>c6</span>
        <span>2. d4</span>
      </div>
    </div>
  );
}

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
      detail: "Grouping opening families, move orders, and transpositions.",
      icon: BookOpen,
    },
    {
      title: "Measuring results",
      detail: "Comparing score, sample size, early losses, and plan clarity.",
      icon: BarChart3,
    },
    {
      title: "Building recommendations",
      detail: "Choosing what to keep, repair, try, or delay.",
      icon: Lightbulb,
    },
    {
      title: "Creating training plan",
      detail: "Turning the report into the first line to train.",
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
    "Starting with the positions you actually reach.",
    "Looking for opening patterns and transpositions that repeat.",
    "Separating strong signals from small or noisy samples.",
    "Turning the evidence into clear repertoire choices.",
    "Finishing with a line you can train next session.",
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
              <ChessAnalysisLoader />
              <span><Search size={14} /> Analysing games</span>
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
        </div>

        {showWakeupMessage ? (
          <p className="importLoadingWakeup">Still working. This can take a little longer for large imports while OpeningFit reads the full game sample.</p>
        ) : null}

        <footer className="importLoadingFooter">
          <span>{loadingStep || progressStages[activeStageIndex].detail}</span>
          <small>Please keep this tab open. Large game imports can take a moment.</small>
        </footer>
      </div>
    </div>
  );
}
