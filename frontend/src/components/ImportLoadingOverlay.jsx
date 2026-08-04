import "./ImportLoadingOverlay.css";
import {
  BookOpen,
  Check,
  ListChecks,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { analysisTimingStatus, IMPORT_STAGES } from "../lib/importJourney";

function ChessAnalysisLoader() {
  return (
    <div className="importLoadingChessLoader" aria-hidden="true">
      <div className="importLoadingChessBoard">
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} />
        ))}
        <img src="/icons/openingfit-icon.svg" alt="" width="40" height="40" />
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
  stage = IMPORT_STAGES.FETCHING,
  progress = null,
  elapsedSeconds = 0,
  onCancel,
}) {
  const isAnalysis = mode === "analysis";
  const progressStages = [
    {
      keys: [IMPORT_STAGES.FETCHING, IMPORT_STAGES.GAMES_FOUND],
      title: "Finding your games",
      detail: `Checking available public games from ${platform}.`,
      icon: Search,
    },
    {
      keys: [IMPORT_STAGES.FILTERING],
      title: "Choosing suitable games",
      detail: "Keeping games that can support a useful report.",
      icon: ListChecks,
    },
    {
      keys: [IMPORT_STAGES.IDENTIFYING],
      title: "Understanding your openings",
      detail: "Grouping repeated openings and move orders.",
      icon: BookOpen,
    },
    {
      keys: [IMPORT_STAGES.RECOMMENDING],
      title: "Building your recommendations",
      detail: "Preparing evidence-based repertoire recommendations.",
      icon: Sparkles,
    },
    {
      keys: [IMPORT_STAGES.SAVING, IMPORT_STAGES.COMPLETE],
      title: "Preparing your report",
      detail: "Keeping the completed report safely on this device.",
      icon: Sparkles,
    },
  ];
  const activeStageIndex = progressStages.findIndex((item) => item.keys.includes(stage));
  const hasRealStage = Boolean(progress?.real && activeStageIndex >= 0);
  const activeStage = hasRealStage ? progressStages[activeStageIndex] : null;
  const stageProgress = progress?.progress;
  const determinate = Boolean(stageProgress && stageProgress.maximum > 0);
  const progressValue = determinate ? Math.max(0, Math.min(stageProgress.current, stageProgress.maximum)) : null;
  const progressPercent = determinate ? Math.round((progressValue / stageProgress.maximum) * 100) : null;
  const complete = stage === IMPORT_STAGES.COMPLETE;
  const platformLabel =
    typeof platform === "string" && platform.length ? platform : "your chess platform";
  const timing = analysisTimingStatus(elapsedSeconds);

  return (
    <div
      className={`importLoadingOverlay ${isAnalysis ? "analysisLoadingOverlay" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-loading-title"
      aria-busy={!complete}
    >
      <div className="importLoadingCard">
        <header className="importLoadingHeader">
          <div className="importLoadingIdentity">
            <span className="importLoadingMark"><Sparkles size={19} /></span>
            <div>
              <span className="importLoadingEyebrow">Personal report in progress</span>
              <h2 id="import-loading-title">Building your OpeningFit report</h2>
            </div>
          </div>
          {typeof onCancel === "function" && !complete ? (
            <button className="importLoadingCancel" type="button" onClick={onCancel} aria-label="Cancel analysis">
              <X size={18} />
            </button>
          ) : null}
        </header>

        <div className="importLoadingProgressWrap">
          <div className="importLoadingProgressLabel">
            <span>{platformLabel}{username ? ` / ${username}` : ""}</span>
            <span className="importLoadingProgressState"><strong>{complete ? "Report ready" : hasRealStage ? activeStage.title : "Analysis in progress"}</strong>{determinate ? <b>{progressPercent}%</b> : null}</span>
          </div>
          <div
            className={`importLoadingProgress ${determinate ? "importLoadingProgress--determinate" : "importLoadingProgress--indeterminate"}`}
            role="progressbar"
            aria-label={determinate ? `${activeStage?.title || "Analysis"} progress` : `${activeStage?.title || "Analysis"} in progress`}
            aria-valuetext={determinate ? `${progressValue} of ${stageProgress.maximum} ${stageProgress.unit}` : "Waiting for confirmed progress from the analysis service"}
            aria-valuemin={determinate ? 0 : undefined}
            aria-valuemax={determinate ? stageProgress.maximum : undefined}
            aria-valuenow={determinate ? progressValue : undefined}
          >
            <span style={determinate ? { width: `${progressPercent}%` } : undefined} />
          </div>
        </div>

        <div className="importLoadingWorkspace">
          <div className="importLoadingNarrative">
            <div className="importLoadingActiveMessage" role="status" aria-live="polite" aria-atomic="true" aria-busy={!complete}>
              <ChessAnalysisLoader />
              <span>{complete ? <Check size={14} /> : <Search size={14} />} {complete ? "Analysis complete" : "Analysing games"}</span>
              <strong>{complete ? "Your report is ready" : hasRealStage ? activeStage.title : "Importing and analysing games"}</strong>
              <p>{hasRealStage || complete ? progress?.message || activeStage?.detail : `OpeningFit is working on ${platformLabel}${username ? ` games for ${username}` : " games"}. Detailed stages are not available for this request.`}</p>
            </div>

            {hasRealStage || complete ? <div className="importLoadingSteps" aria-label="Confirmed analysis stages">
              {progressStages.map((stageItem, index) => {
                const StageIcon = stageItem.icon;
                const isDone = complete || (hasRealStage && index < activeStageIndex);
                return (
                  <div
                    className={
                      isDone
                        ? "importLoadingStepDone"
                        : hasRealStage && index === activeStageIndex
                          ? "importLoadingStepActive"
                          : ""
                    }
                    key={stageItem.title}
                  >
                    <span className="importLoadingStepIcon">
                      {isDone ? <Check size={16} /> : <StageIcon size={16} />}
                    </span>
                    <p><strong>{stageItem.title}</strong><small>{stageItem.detail}</small></p>
                  </div>
                );
              })}
            </div> : null}
          </div>
        </div>

        {elapsedSeconds >= 7 && !complete ? (
          <p className="importLoadingWakeup">{timing.reassurance} You can cancel without removing your previous report.</p>
        ) : null}

        <footer className="importLoadingFooter">
          <span>{loadingStep || progress?.message || activeStage?.detail || "Analysis in progress."}</span>
          <small>{timing.showElapsed ? `${timing.elapsedLabel}. ` : ""}{timing.expectation} You can safely cancel without replacing your last report.</small>
        </footer>
      </div>
    </div>
  );
}
