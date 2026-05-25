import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";

type ShareProgressCardProps = {
  currentStreak?: number;
  weeklyProgress?: {
    current: number;
    target: number;
    percent: number;
  };
  level?: string;
  latestAchievement?: Record<string, unknown> | null;
  weeklyReport?: {
    summary?: unknown;
    stats?: unknown;
  } | null;
};

type ShareOptionKey =
  | "currentStreak"
  | "weeklyProgress"
  | "level"
  | "latestAchievement"
  | "weeklyReport";

const SHARE_OPTIONS: Array<{
  key: ShareOptionKey;
  label: string;
}> = [
  { key: "currentStreak", label: "Current streak" },
  { key: "weeklyProgress", label: "Weekly progress" },
  { key: "level", label: "Level" },
  { key: "latestAchievement", label: "Latest achievement" },
  { key: "weeklyReport", label: "Weekly report summary" },
];

function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: message }));
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default function ShareProgressCard({
  currentStreak = 0,
  weeklyProgress,
  level = "Beginner",
  latestAchievement = null,
  weeklyReport = null,
}: ShareProgressCardProps) {
  const [selected, setSelected] = useState<Record<ShareOptionKey, boolean>>({
    currentStreak: true,
    weeklyProgress: true,
    level: true,
    latestAchievement: true,
    weeklyReport: Boolean(weeklyReport?.summary),
  });

  const summaryText = useMemo(() => {
    const lines = ["OpeningFit progress"];

    if (selected.currentStreak) {
      lines.push(`Current streak: ${currentStreak} day${currentStreak === 1 ? "" : "s"}`);
    }

    if (selected.weeklyProgress && weeklyProgress) {
      lines.push(
        `Weekly progress: ${weeklyProgress.current}/${weeklyProgress.target || "?"} sessions (${weeklyProgress.percent}%)`
      );
    }

    if (selected.level) {
      lines.push(`Level: ${level}`);
    }

    if (selected.latestAchievement && latestAchievement?.title) {
      lines.push(`Latest achievement: ${String(latestAchievement.title)}`);
    }

    if (selected.weeklyReport && weeklyReport?.summary) {
      lines.push(`Weekly report: ${String(weeklyReport.summary)}`);
    }

    lines.push("Shared from OpeningFit.");
    return lines.join("\n");
  }, [currentStreak, latestAchievement, level, selected, weeklyProgress, weeklyReport]);

  function toggleOption(key: ShareOptionKey) {
    setSelected((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function copyFallback() {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast("Progress summary copied.");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = summaryText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      toast("Progress summary copied.");
    }
  }

  async function shareProgress() {
    const payload = {
      title: "OpeningFit progress",
      text: summaryText,
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }

      await copyFallback();
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      await copyFallback();
    }
  }

  const weeklyStats = (weeklyReport?.stats || {}) as Record<string, unknown>;

  return (
    <section className="shareProgressCard" aria-label="Share progress">
      <div className="todayPanelTop">
        <div>
          <span>Share progress</span>
          <strong>Choose what goes on your card</strong>
        </div>
        <Share2 size={20} />
      </div>

      <div className="shareProgressPreview">
        <span>OpeningFit</span>
        <strong>{level} progress</strong>
        <div>
          {selected.currentStreak ? <p>{currentStreak} day streak</p> : null}
          {selected.weeklyProgress && weeklyProgress ? (
            <p>{weeklyProgress.current}/{weeklyProgress.target || "?"} sessions this week</p>
          ) : null}
          {selected.latestAchievement && latestAchievement?.title ? (
            <p>{String(latestAchievement.title)}</p>
          ) : null}
          {selected.weeklyReport && weeklyReport?.summary ? (
            <p>{safeNumber(weeklyStats.totalXp, 0)} XP this week</p>
          ) : null}
        </div>
      </div>

      <div className="shareProgressOptions">
        {SHARE_OPTIONS.map((option) => (
          <label className="shareProgressOption" key={option.key}>
            <input
              type="checkbox"
              checked={selected[option.key]}
              onChange={() => toggleOption(option.key)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <button className="primaryBtn" type="button" onClick={shareProgress}>
        Share progress
      </button>
    </section>
  );
}
