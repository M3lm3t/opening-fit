import { useMemo } from "react";
import { useAuth } from "../context/AuthDataProvider";
import { buildWeakestLineTrainingTarget } from "../services/weakestLineTraining";
import "./DailyMissionCard.css";

const BOARD_PROGRESS_KEY = "openingFit:openingTrainingProgress";
const TODAY_TRAINING_KEY = "openingFit:trainingProgress";

function readLocalJson(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function completedLinesToday(progress = {}) {
  return Object.values(progress.completedLines || {}).filter((line) => isToday(line?.completedAt)).length;
}

function latestCloudProgress(openingFitUserState = [], data = {}) {
  const platform = String(data?.platform || data?.importPlatform || data?.import_platform || "").toLowerCase();
  const username = String(data?.username || data?.playerName || data?.player_name || "").toLowerCase();
  const rows = Array.isArray(openingFitUserState) ? openingFitUserState : [];
  const row =
    rows.find((item) => {
      const samePlatform = !platform || String(item?.platform || "").toLowerCase() === platform;
      const sameUsername = !username || String(item?.username || "").toLowerCase() === username;
      return samePlatform && sameUsername;
    }) || rows[0];

  return row?.coach_progress?.openingTraining || null;
}

function targetName(target) {
  if (!target) return "recommended line";
  const opening = target.opening || target.name || target.openingName || target.opening_name || "";
  const line = target.variation || target.line || target.lineName || target.line_name || target.moveLine || target.move_line || "";
  if (opening && line && opening !== line) return `${opening}: ${line}`;
  return opening || line || "recommended line";
}

function buildMission(data, fitData, openingFitUserState) {
  const localProgress = readLocalJson(BOARD_PROGRESS_KEY);
  const cloudProgress = latestCloudProgress(openingFitUserState, data);
  const localToday = readLocalJson(TODAY_TRAINING_KEY);
  const reviewedToday = Math.max(completedLinesToday(localProgress), completedLinesToday(cloudProgress || {}));
  const weakest = buildWeakestLineTrainingTarget(data || {});
  const target = weakest.available ? weakest.target : null;
  const activeToday = localToday?.lastState === "started" && isToday(localToday?.saved_at || localToday?.lastSavedAt);
  const realProgress = reviewedToday > 0 || activeToday;

  return {
    reviewedToday,
    activeToday,
    realProgress,
    target: target || "Italian Game",
    targetLabel: targetName(target),
    note: target
      ? `Start with ${targetName(target)}.`
      : data
        ? "No repeated weak line is ready yet, so use the trainer to keep the habit alive."
        : "No report yet. Start with a simple trainer line.",
  };
}

export default function DailyMissionCard({ data, fitData, onStartTraining }) {
  const { openingFitUserState } = useAuth();
  const mission = useMemo(
    () => buildMission(data, fitData, openingFitUserState),
    [data, fitData, openingFitUserState]
  );
  const reviewedProgress = Math.min(mission.reviewedToday, 3);

  return (
    <section className="dailyMissionCard" aria-label="Today's Opening Mission">
      <div className="dailyMissionHeader">
        <div>
          <p className="eyebrow">Today&apos;s Opening Mission</p>
          <h2>Train one useful opening habit today.</h2>
        </div>
        <span>{reviewedProgress}/3 lines</span>
      </div>

      <div className="dailyMissionChecklist">
        <label className={mission.reviewedToday >= 3 ? "isDone" : ""}>
          <input type="checkbox" checked={mission.reviewedToday >= 3} readOnly />
          <span>Review 3 weak lines</span>
          <small>{mission.realProgress ? `${reviewedProgress} completed today` : "Checklist target"}</small>
        </label>
        <label>
          <input type="checkbox" readOnly />
          <span>Complete 10 training moves</span>
          <small>Tracked by the trainer session</small>
        </label>
        <label>
          <input type="checkbox" readOnly />
          <span>Score 80%+ when scoring is available</span>
          <small>Optional for now</small>
        </label>
      </div>

      <div className="dailyMissionAction">
        <p>{mission.note}</p>
        <button type="button" onClick={() => onStartTraining?.(mission.target)}>
          {mission.activeToday || mission.reviewedToday ? "Continue" : "Start Mission"}
        </button>
      </div>
    </section>
  );
}
