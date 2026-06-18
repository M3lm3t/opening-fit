import { useMemo } from "react";
import { useAuth } from "../context/AuthDataProvider";
import "./ResumeTrainingPrompt.css";

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

function isRecent(value) {
  const date = safeDate(value);
  if (!date) return false;
  const ageMs = Date.now() - date.getTime();
  return ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24 * 30;
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

function savedTodayTarget(saved) {
  if (!saved || saved.lastState !== "started") return null;
  const opening = saved.opening || "";
  if (!opening) return null;
  const variation = saved.variation || saved.line || "";
  const moveLine = saved.move_line || saved.moveLine || "";
  const savedAt = saved.saved_at || saved.lastSavedAt || "";

  return {
    opening,
    variation,
    moveLine,
    label: variation && variation !== opening ? `${opening}: ${variation}` : opening,
    meta: formatShortDate(savedAt) ? `Started ${formatShortDate(savedAt)}` : "Training session started",
    target: {
      opening,
      variation,
      moveLine,
      trainingTarget: { opening, variation, moveLine },
    },
  };
}

function boardProgressTarget() {
  const progress = readLocalJson(BOARD_PROGRESS_KEY);
  const latest = Object.values(progress.progressByOpening || {})
    .filter((item) => item?.openingName && isRecent(item?.lastPracticedAt))
    .sort((a, b) => (safeDate(b.lastPracticedAt)?.getTime() || 0) - (safeDate(a.lastPracticedAt)?.getTime() || 0))[0];

  if (!latest) return null;
  return {
    opening: latest.openingName,
    variation: "",
    moveLine: "",
    label: latest.openingName,
    meta: latest.total && latest.completed !== undefined
      ? `${latest.completed}/${latest.total} lines reviewed`
      : `Last trained ${formatShortDate(latest.lastPracticedAt)}`,
    target: latest.openingName,
  };
}

export default function ResumeTrainingPrompt({ data, onResume }) {
  const { user, openingFitUserState } = useAuth();
  const target = useMemo(() => {
    const localToday = readLocalJson(TODAY_TRAINING_KEY);
    const cloudToday = user?.id ? findCloudTodayTraining(openingFitUserState, data) : null;
    return savedTodayTarget(cloudToday) || savedTodayTarget(localToday) || boardProgressTarget();
  }, [data, openingFitUserState, user?.id]);

  if (!target) return null;

  return (
    <section className="resumeTrainingPrompt" aria-label="Resume Training">
      <div>
        <span>Resume Training</span>
        <strong>{target.label}</strong>
        <small>{target.meta}</small>
      </div>
      <button type="button" onClick={() => onResume?.(target.target)}>
        Resume
      </button>
    </section>
  );
}
