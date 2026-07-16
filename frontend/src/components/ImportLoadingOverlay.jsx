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
import { IMPORT_STAGES, IMPORT_STAGE_DETAILS } from "../lib/importJourney";

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
  showWakeupMessage = false,
  onCancel,
}) {
  const isAnalysis = mode === "analysis";
  const progressStages = [
    {
      key: IMPORT_STAGES.FETCHING,
      title: "Finding recent games",
      detail: `Requesting available public games from ${platform}.`,
      icon: Search,
    },
    {
      key: IMPORT_STAGES.FILTERING,
      title: "Checking eligible time controls",
      detail: "Separating games that can support this report.",
      icon: ListChecks,
    },
    {
      key: IMPORT_STAGES.IDENTIFYING,
      title: "Identifying recurring opening positions",
      detail: "Grouping repeated openings and move orders.",
      icon: BookOpen,
    },
    {
      key: IMPORT_STAGES.RECOMMENDING,
      title: "Comparing results",
      detail: "Preparing evidence-based repertoire recommendations.",
      icon: BarChart3,
    },
    {
      key: IMPORT_STAGES.SAVING,
      title: "Saving report",
      detail: "Keeping the completed report available on this device.",
      icon: Lightbulb,
    },
  ];
  const activeStageIndex = Math.max(0, progressStages.findIndex((item) => item.key === stage));
  const activeStage = progressStages[activeStageIndex] || progressStages[0];
  const platformLabel =
    typeof platform === "string" && platform.length ? platform : "your chess platform";

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
            <strong>{IMPORT_STAGE_DETAILS[stage]?.title || activeStage.title}</strong>
          </div>
        </div>

        <div className="importLoadingWorkspace">
          <div className="importLoadingNarrative">
            <div className="importLoadingActiveMessage">
              <ChessAnalysisLoader />
              <span><Search size={14} /> Analysing games</span>
              <strong>{activeStage.title}</strong>
              <p>{IMPORT_STAGE_DETAILS[stage]?.detail || activeStage.detail}</p>
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
          <p className="importLoadingWakeup">{platformLabel} or the analysis service is responding slowly. OpeningFit is still waiting safely; you can cancel without removing your previous report.</p>
        ) : null}

        <footer className="importLoadingFooter">
          <span>{loadingStep || activeStage.detail}</span>
          <small>The analysis runs as a background job. You can safely cancel without replacing your last report.</small>
        </footer>
      </div>
    </div>
  );
}
