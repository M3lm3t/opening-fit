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
import { analysisTimingStatus, IMPORT_STAGES, IMPORT_STAGE_DETAILS } from "../lib/importJourney";

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
  showWakeupMessage = false,
  elapsedSeconds = 0,
  onCancel,
}) {
  const isAnalysis = mode === "analysis";
  const progressStages = [
    {
      key: IMPORT_STAGES.FETCHING,
      title: "Requesting public games",
      detail: `Requesting available public games from ${platform}.`,
      icon: Search,
    },
    {
      key: IMPORT_STAGES.GAMES_FOUND,
      title: "Games found",
      detail: "Confirming how many public games were returned.",
      icon: Check,
    },
    {
      key: IMPORT_STAGES.FILTERING,
      title: "Filtering eligible games",
      detail: "Separating games that can support this report.",
      icon: ListChecks,
    },
    {
      key: IMPORT_STAGES.IDENTIFYING,
      title: "Identifying openings",
      detail: "Grouping repeated openings and move orders.",
      icon: BookOpen,
    },
    {
      key: IMPORT_STAGES.RECOMMENDING,
      title: "Building recommendations",
      detail: "Preparing evidence-based repertoire recommendations.",
      icon: BarChart3,
    },
    {
      key: IMPORT_STAGES.SAVING,
      title: "Saving / finishing report",
      detail: "Keeping the completed report available on this device.",
      icon: Lightbulb,
    },
  ];
  const activeStageIndex = progressStages.findIndex((item) => item.key === stage);
  const hasRealStage = Boolean(progress?.real && activeStageIndex >= 0);
  const activeStage = hasRealStage ? progressStages[activeStageIndex] : null;
  const platformLabel =
    typeof platform === "string" && platform.length ? platform : "your chess platform";
  const timing = analysisTimingStatus(elapsedSeconds);

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
            <strong>{hasRealStage ? IMPORT_STAGE_DETAILS[stage]?.title || activeStage.title : "Analysis in progress"}</strong>
          </div>
        </div>

        <div className="importLoadingWorkspace">
          <div className="importLoadingNarrative">
            <div className="importLoadingActiveMessage">
              <ChessAnalysisLoader />
              <span><Search size={14} /> Analysing games</span>
              <strong>{hasRealStage ? activeStage.title : "Waiting for a confirmed analysis stage"}</strong>
              <p>{progress?.message || "OpeningFit is waiting for the analysis service. Detailed stages are not available for this request."}</p>
            </div>

            <div className="importLoadingSteps">
              {progressStages.map((stage, index) => {
                const StageIcon = stage.icon;
                return (
                  <div
                    className={
                      hasRealStage && index < activeStageIndex
                        ? "importLoadingStepDone"
                        : hasRealStage && index === activeStageIndex
                          ? "importLoadingStepActive"
                          : ""
                    }
                    key={stage.title}
                  >
                    <span className="importLoadingStepIcon">
                      {hasRealStage && index < activeStageIndex ? <Check size={16} /> : <StageIcon size={16} />}
                    </span>
                    <p><strong>{stage.title}</strong><small>{stage.detail}</small></p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {showWakeupMessage || timing.slow ? (
          <p className="importLoadingWakeup">{timing.label} OpeningFit is still waiting safely; you can cancel without removing your previous report.</p>
        ) : null}

        <footer className="importLoadingFooter">
          <span>{loadingStep || progress?.message || activeStage?.detail || "Analysis in progress."}</span>
          <small>{timing.showElapsed ? `${timing.elapsedLabel}. ` : ""}{timing.expectation} You can safely cancel without replacing your last report.</small>
        </footer>
      </div>
    </div>
  );
}
