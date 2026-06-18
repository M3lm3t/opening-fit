import { useMemo } from "react";
import { useAuth } from "../context/AuthDataProvider";
import { buildTrainingRecommendations } from "../services/trainingRecommendations";
import { buildWeakestLineTrainingTarget } from "../services/weakestLineTraining";
import "./ContinueTrainingCard.css";

const TODAY_TRAINING_KEY = "openingFit:trainingProgress";
const BOARD_PROGRESS_KEY = "openingFit:openingTrainingProgress";

function readLocalJson(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value) {
  const date = safeDate(value);
  if (!date) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getOpeningName(item = {}) {
  return item.opening || item.name || item.openingName || item.opening_name || item.trainingTarget || "";
}

function getLineName(item = {}) {
  return item.variation || item.line || item.lineName || item.line_name || item.moveLine || item.move_line || "";
}

function buildRecommendedTarget(data, fitData) {
  if (!data) return null;

  const weakest = buildWeakestLineTrainingTarget(data);
  if (weakest.available && weakest.target) {
    return {
      source: "recommended",
      buttonLabel: "Train this line",
      opening: getOpeningName(weakest.target),
      line: getLineName(weakest.target),
      moveLine:
        weakest.target.moveLine ||
        weakest.target.move_line ||
        weakest.target.trainingSet?.startingMoveSequence ||
        weakest.target.training_set?.starting_move_sequence ||
        "",
      note: "Recommended from your weakest line.",
      target: weakest.target,
    };
  }

  const plan = buildTrainingRecommendations(data, fitData);
  if (!plan.primary) return null;

  return {
    source: "recommended",
    buttonLabel: "Train this line",
    opening: getOpeningName(plan.primary),
    line: getLineName(plan.primary),
    moveLine: plan.primary.moveLine || "",
    note: "Recommended from your current training plan.",
    target: plan.primary.trainingTarget || plan.primary.opening || plan.primary,
  };
}

function buildBoardProgressTarget() {
  const progress = readLocalJson(BOARD_PROGRESS_KEY);
  const rows = Object.values(progress.progressByOpening || {})
    .filter((item) => item?.openingName)
    .sort((a, b) => (safeDate(b.lastPracticedAt)?.getTime() || 0) - (safeDate(a.lastPracticedAt)?.getTime() || 0));
  const latest = rows[0];
  if (!latest) return null;

  return {
    source: "board-progress",
    buttonLabel: "Continue Training",
    opening: latest.openingName,
    line: "",
    moveLine: "",
    progressText:
      latest.total && latest.completed !== undefined
        ? `${latest.completed}/${latest.total} lines reviewed`
        : "Practice progress saved",
    lastText: formatShortDate(latest.lastPracticedAt) ? `Last trained ${formatShortDate(latest.lastPracticedAt)}` : "",
    note: "Resume the opening you last practised on this device.",
    target: latest.openingName,
  };
}

function findCloudTodayTraining(openingFitUserState = [], data = {}) {
  const platform = String(data?.platform || data?.importPlatform || data?.import_platform || "").toLowerCase();
  const username = String(data?.username || data?.playerName || data?.player_name || "").toLowerCase();
  const rows = Array.isArray(openingFitUserState) ? openingFitUserState : [];
  const row =
    rows.find((item) => {
      const samePlatform = !platform || String(item?.platform || "").toLowerCase() === platform;
      const sameUsername = !username || String(item?.username || "").toLowerCase() === username;
      return samePlatform && sameUsername;
    }) || rows[0];

  return row?.coach_progress?.todayTraining || null;
}

function buildSavedTodayTarget(saved) {
  if (!saved || saved.lastState !== "started") return null;
  const opening = saved.opening || "";
  if (!opening) return null;

  const moveLine = saved.move_line || saved.moveLine || "";
  const line = saved.variation || saved.line || "";
  const lastSavedAt = saved.saved_at || saved.lastSavedAt || "";

  return {
    source: "today-progress",
    buttonLabel: "Continue Training",
    opening,
    line,
    moveLine,
    progressText: moveLine ? `Current line: ${moveLine}` : "Training session started",
    lastText: formatShortDate(lastSavedAt) ? `Last trained ${formatShortDate(lastSavedAt)}` : "",
    note: "Resume the line you started last time.",
    target: {
      opening,
      variation: line,
      moveLine,
      trainingTarget: {
        opening,
        variation: line,
        moveLine,
      },
    },
  };
}

export default function ContinueTrainingCard({ data, fitData, onAnalyse, onStartTraining }) {
  const { user, openingFitUserState } = useAuth();
  const target = useMemo(() => {
    const localToday = readLocalJson(TODAY_TRAINING_KEY);
    const cloudToday = user?.id ? findCloudTodayTraining(openingFitUserState, data) : null;
    return (
      buildSavedTodayTarget(cloudToday) ||
      buildSavedTodayTarget(localToday) ||
      buildBoardProgressTarget() ||
      buildRecommendedTarget(data, fitData) ||
      {
        source: "starter",
        buttonLabel: data ? "Train this line" : "Start starter line",
        opening: "Practice starter line",
        line: data
          ? "No saved training session yet."
          : "Analyse your games to unlock a personal training target.",
        moveLine: "",
        note: data
          ? "No saved training yet."
          : "Starter practice is available now. Your personal target appears after analysis.",
        target: "Italian Game",
      }
    );
  }, [data, fitData, openingFitUserState, user?.id]);

  const hasPersonalTarget = target.source !== "starter";
  const action = () => {
    if (target.source === "starter" && !data) {
      onStartTraining?.(target.target);
      return;
    }
    if (!target.target && !hasPersonalTarget) {
      onAnalyse?.();
      return;
    }
    onStartTraining?.(target.target || target.opening);
  };

  return (
    <section className="continueTrainingCard" aria-label="Continue Training">
      <div className="continueTrainingCopy">
        <p className="eyebrow">Continue Training</p>
        <h2>{target.opening || "Your next training line"}</h2>
        {target.line ? <p>{target.line}</p> : null}
        {target.progressText ? <span>{target.progressText}</span> : null}
        {target.lastText ? <span>{target.lastText}</span> : null}
      </div>
      <div className="continueTrainingAction">
        <p>{target.note}</p>
        <button type="button" onClick={action}>
          {target.buttonLabel}
        </button>
      </div>
    </section>
  );
}
