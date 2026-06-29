import { useMemo } from "react";
import { useAuth } from "../context/AuthDataProvider";
import { buildTrainingRecommendations } from "../services/trainingRecommendations";
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

function normaliseKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function coachInsights(data = {}) {
  const value = data?.openingCoachInsights || data?.opening_coach_insights;
  return value && typeof value === "object" ? value : null;
}

function focusMission(data = {}) {
  const mission = coachInsights(data)?.focusMission || coachInsights(data)?.focus_mission;
  return mission && typeof mission === "object" ? mission : null;
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

function countOpeningGames(data = {}, opening = "") {
  const key = normaliseKey(opening);
  if (!key) return 0;
  const games = [
    ...(Array.isArray(data.recentGames) ? data.recentGames : []),
    ...(Array.isArray(data.recent_games) ? data.recent_games : []),
    ...(Array.isArray(data.openingGames) ? data.openingGames : []),
    ...(Array.isArray(data.opening_games) ? data.opening_games : []),
  ];
  const seen = new Set();
  return games.filter((game, index) => {
    const name = normaliseKey(game?.opening || game?.name || game?.openingName || game?.opening_name);
    if (!name || name !== key) return false;
    const id = game?.url || game?.gameUrl || game?.id || `${name}-${index}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).length;
}

function completedForOpening(progress = {}, opening = "") {
  const key = normaliseKey(opening);
  if (!key) return 0;
  return Object.values(progress.completedLines || {}).filter((line) => {
    const lineKey = normaliseKey(line?.openingName || line?.opening || line?.openingId || line?.opening_id);
    return lineKey && (lineKey === key || lineKey.includes(key) || key.includes(lineKey));
  }).length;
}

function buildMission(data, fitData, openingFitUserState) {
  const localProgress = readLocalJson(BOARD_PROGRESS_KEY);
  const cloudProgress = latestCloudProgress(openingFitUserState, data);
  const localToday = readLocalJson(TODAY_TRAINING_KEY);
  const reviewedToday = Math.max(completedLinesToday(localProgress), completedLinesToday(cloudProgress || {}));
  const focus = focusMission(data || {});
  const focusOpening = focus?.openingName || focus?.opening_name || focus?.opening || "";
  const drillTarget = Number(focus?.targetDrills ?? focus?.target_drills) || 3;
  const gameTarget = Number(focus?.targetGames ?? focus?.target_games) || 5;
  const drillProgress = Math.min(
    drillTarget,
    Math.max(completedForOpening(localProgress, focusOpening), completedForOpening(cloudProgress || {}, focusOpening))
  );
  const gameProgress = Math.min(gameTarget, countOpeningGames(data || {}, focusOpening));

  if (focus) {
    const target = {
      opening: focusOpening || focus.title || "Opening mission",
      name: focusOpening || focus.title || "Opening mission",
      openingName: focusOpening || focus.title || "Opening mission",
      variation: focus.practiceGoal || focus.practice_goal || "",
      moveLine: focus.moveLine || focus.move_line || "",
      selectedReason: focus.description || focus.practiceGoal || focus.practice_goal || "",
      source: "weekly-opening-mission",
      targetDrills: drillTarget,
      targetGames: gameTarget,
      successMetric: focus.successMetric || focus.success_metric || "",
    };

    return {
      title: focus.title || "This week's opening mission",
      explanation:
        focus.description ||
        focus.practiceGoal ||
        focus.practice_goal ||
        "Keep this week's training narrow and measurable.",
      drillTarget,
      gameTarget,
      drillProgress,
      gameProgress,
      successMetric: focus.successMetric || focus.success_metric || "Compare this opening again after your next import.",
      reviewedToday,
      activeToday: localToday?.lastState === "started" && isToday(localToday?.saved_at || localToday?.lastSavedAt),
      realProgress: drillProgress > 0 || gameProgress > 0 || reviewedToday > 0,
      target,
      targetLabel: targetName(target),
      note: `${focusOpening || "This focus"}: ${focus.practiceGoal || focus.practice_goal || "complete the drill target, then play the game target."}`,
    };
  }

  const plan = buildTrainingRecommendations(data, fitData);
  const weakest = buildWeakestLineTrainingTarget(data || {});
  const target = plan.primary?.trainingTarget || (weakest.available ? weakest.target : null);
  const activeToday = localToday?.lastState === "started" && isToday(localToday?.saved_at || localToday?.lastSavedAt);
  const realProgress = reviewedToday > 0 || activeToday;

  return {
    title: "Train one useful opening habit today.",
    explanation: target
      ? "This target comes from the current training plan because the report does not include a weekly focus mission yet."
      : "OpeningFit needs a few repeated openings or lines before it can pick a precise weekly task.",
    drillTarget: 3,
    gameTarget: 5,
    drillProgress: Math.min(reviewedToday, 3),
    gameProgress: 0,
    successMetric: "Build enough practice and game data to compare after your next import.",
    reviewedToday,
    activeToday,
    realProgress,
    target: target || "Italian Game",
    targetLabel: targetName(target),
    note: target
      ? `${plan.primary?.sideLabel || "Train targeted line"}: ${targetName(target)}. ${plan.primary?.confidence || "Limited evidence"}.`
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
  const drillProgress = Math.min(mission.drillProgress ?? mission.reviewedToday, mission.drillTarget || 3);
  const gameProgress = Math.min(mission.gameProgress || 0, mission.gameTarget || 5);

  return (
    <section className="dailyMissionCard weeklyOpeningMissionCard" aria-label="This week's opening mission">
      <div className="dailyMissionHeader">
        <div>
          <p className="eyebrow">This week&apos;s opening mission</p>
          <h2>{mission.title}</h2>
          <p>{mission.explanation}</p>
        </div>
        <span>{drillProgress}/{mission.drillTarget || 3} drills</span>
      </div>

      <div className="dailyMissionChecklist">
        <label className={drillProgress >= (mission.drillTarget || 3) ? "isDone" : ""}>
          <input type="checkbox" checked={drillProgress >= (mission.drillTarget || 3)} readOnly />
          <span>Complete focused drills</span>
          <small>{drillProgress}/{mission.drillTarget || 3} drills completed</small>
        </label>
        <label className={gameProgress >= (mission.gameTarget || 5) ? "isDone" : ""}>
          <input type="checkbox" checked={gameProgress >= (mission.gameTarget || 5)} readOnly />
          <span>Play focused games</span>
          <small>{gameProgress}/{mission.gameTarget || 5} games in this report</small>
        </label>
        <label>
          <input type="checkbox" readOnly />
          <span>Success metric</span>
          <small>{mission.successMetric}</small>
        </label>
      </div>

      <div className="dailyMissionAction">
        <p>{mission.note}</p>
        <button type="button" onClick={() => onStartTraining?.(mission.target)}>
          {mission.activeToday || drillProgress ? "Continue practice" : "Start practice"}
        </button>
      </div>
    </section>
  );
}
