import { BarChart3 } from "lucide-react";

type WeeklyReportCardProps = {
  report?: {
    week_start?: unknown;
    week_end?: unknown;
    summary?: unknown;
    stats?: unknown;
  } | null;
  loading?: boolean;
  onGenerate?: () => void;
  onViewHistory?: () => void;
};

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatDate(value: unknown) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(`${String(value)}T00:00:00`));
  } catch {
    return String(value);
  }
}

function formatDelta(value: number, unit: string) {
  if (value > 0) return `+${value} ${unit}`;
  if (value < 0) return `${value} ${unit}`;
  return `No change in ${unit}`;
}

export default function WeeklyReportCard({
  report,
  loading = false,
  onGenerate,
  onViewHistory,
}: WeeklyReportCardProps) {
  const stats = (report?.stats || {}) as Record<string, unknown>;
  const comparison = (stats.comparison || {}) as Record<string, unknown>;
  const streakProgress = (stats.streakProgress || {}) as Record<string, unknown>;
  const bestAchievement = (stats.bestAchievement || null) as Record<string, unknown> | null;
  const totalSessions = safeNumber(stats.totalSessions, 0);
  const completedGoals = safeNumber(stats.completedGoals, 0);
  const totalXp = safeNumber(stats.totalXp, 0);
  const sessionDelta = safeNumber(comparison.sessionDelta, 0);
  const xpDelta = safeNumber(comparison.xpDelta, 0);
  const goalDelta = safeNumber(comparison.completedGoalDelta, 0);

  return (
    <article className="weeklyReportCard">
      <div className="todayPanelTop">
        <div>
          <span>Weekly report</span>
          <strong>
            {report
              ? `${formatDate(report.week_start)} - ${formatDate(report.week_end)}`
              : "Generate this week"}
          </strong>
        </div>
        <BarChart3 size={20} />
      </div>

      {report ? (
        <>
          <div className="weeklyReportStats">
            <div>
              <strong>{totalSessions}</strong>
              <span>Sessions</span>
            </div>
            <div>
              <strong>{completedGoals}</strong>
              <span>Goals</span>
            </div>
            <div>
              <strong>{totalXp}</strong>
              <span>XP</span>
            </div>
            <div>
              <strong>{safeNumber(streakProgress.activeDays, 0)}</strong>
              <span>Active days</span>
            </div>
          </div>

          <div className="weeklyReportComparison">
            <span>{formatDelta(sessionDelta, "sessions")}</span>
            <span>{formatDelta(goalDelta, "goals")}</span>
            <span>{formatDelta(xpDelta, "XP")}</span>
          </div>

          {bestAchievement?.title ? (
            <p className="weeklyReportHighlight">
              Best unlock: <strong>{String(bestAchievement.title)}</strong>
            </p>
          ) : null}

          <p>{String(report.summary || "Your weekly OpeningFit progress is ready.")}</p>
        </>
      ) : (
        <p>Summarize your sessions, goals, XP, streak progress, and achievement unlocks for this week.</p>
      )}

      <div className="weeklyReportActions">
        <button className="primaryBtn" type="button" onClick={onGenerate} disabled={loading}>
          {loading ? "Generating..." : "Generate Weekly Report"}
        </button>
        <button className="secondaryBtn" type="button" onClick={onViewHistory}>
          View history
        </button>
      </div>
    </article>
  );
}
