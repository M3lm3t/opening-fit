import { useEffect, useMemo, useState } from "react";
import { Activity, Flame, Sparkles, Target, Trophy } from "lucide-react";
import { generateWeeklyReport, getTodayDashboard } from "../services/retentionService";
import { logRetentionEvent } from "../services/retentionEvents";
import AchievementsPanel from "./AchievementsPanel";
import WeeklyReportCard from "./WeeklyReportCard";
import NotificationPreferences from "./NotificationPreferences";
import ShareProgressCard from "./ShareProgressCard";

type TodayDashboardProps = {
  user?: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
  onPrimaryAction?: () => void;
};

type DashboardState = Awaited<ReturnType<typeof getTodayDashboard>>;
type WeeklyReportState = Awaited<ReturnType<typeof generateWeeklyReport>>;

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatActivityType(type: unknown) {
  return String(type || "OpeningFit session")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) return "Today";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(String(value)));
  } catch {
    return "Today";
  }
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentWeekStartIsoDate() {
  const date = new Date();
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function getDisplayName(user: TodayDashboardProps["user"], dashboard: DashboardState) {
  const metadata = user?.user_metadata || {};
  return (
    dashboard?.profile?.display_name ||
    String(metadata.full_name || metadata.display_name || "").trim() ||
    user?.email?.split("@")[0] ||
    "there"
  );
}

function getWeeklyProgress(goal: NonNullable<DashboardState>["weeklyGoalProgress"] | null) {
  const current = safeNumber(goal?.current_value, 0);
  const target = safeNumber(goal?.target_value, 0);
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return { current, target, percent };
}

function getStreakAtRisk(streak: NonNullable<DashboardState>["currentStreak"] | null) {
  if (!streak?.last_active_date) return true;
  return streak.last_active_date !== todayIsoDate();
}

function getWeeklyGoalMessage(current: number, target: number) {
  if (!target) return "Set a weekly target to make progress visible.";
  const remaining = Math.max(0, target - current);

  if (remaining === 0) return "Week complete. Nice work.";
  if (remaining === 1) return "One more session to complete your week.";
  return `${remaining} sessions left to complete your week.`;
}

function getNextAction({
  hasRetentionHistory,
  atRisk,
  weeklyProgress,
  recentActivity,
}: {
  hasRetentionHistory: boolean;
  atRisk: boolean;
  weeklyProgress: ReturnType<typeof getWeeklyProgress>;
  recentActivity: Record<string, unknown>[];
}) {
  if (!hasRetentionHistory) return "Start first session";
  if (atRisk) return "Complete today’s goal";
  if (weeklyProgress.target && weeklyProgress.current >= weeklyProgress.target) {
    return "Generate weekly report";
  }
  if (recentActivity.length) return "Continue last session";
  return "Complete today’s goal";
}

function StreakCard({
  currentStreak,
  bestStreak,
  streakFreezes,
  atRisk,
}: {
  currentStreak: number;
  bestStreak: number;
  streakFreezes: number;
  atRisk: boolean;
}) {
  return (
    <article className={`todayStatCard streakCard ${atRisk ? "streakCardRisk" : ""}`}>
      <span className="todayStatIcon"><Flame size={18} /></span>
      <small>Current streak</small>
      <strong>{currentStreak}</strong>
      <p>{currentStreak === 1 ? "day active" : "days active"}</p>

      <div className="todayMiniStats">
        <span>Best {bestStreak}</span>
        <span>{streakFreezes} freeze{streakFreezes === 1 ? "" : "s"}</span>
      </div>

      {atRisk ? (
        <p className="todayWarning">Your streak is at risk today.</p>
      ) : (
        <p className="todaySuccess">Streak protected for today.</p>
      )}
    </article>
  );
}

function WeeklyGoalCard({
  current,
  target,
  percent,
}: {
  current: number;
  target: number;
  percent: number;
}) {
  return (
    <article className="todayPanel weeklyGoalCard">
      <div className="todayPanelTop">
        <div>
          <span>Weekly goal</span>
          <strong>
            {current} of {target || "?"} sessions complete
          </strong>
        </div>
        <span>{percent}%</span>
      </div>

      <div className="todayProgressTrack" aria-hidden="true">
        <div style={{ width: `${percent}%` }} />
      </div>

      <p className="todayMotivation">{getWeeklyGoalMessage(current, target)}</p>
    </article>
  );
}

function NextActionCard({
  action,
  suggestion,
  onAction,
}: {
  action: string;
  suggestion: string;
  onAction: () => void;
}) {
  return (
    <article className="todayStatCard nextActionCard">
      <span className="todayStatIcon"><Target size={18} /></span>
      <small>Next action</small>
      <strong>{action}</strong>
      <p>{suggestion}</p>
      <button className="secondaryBtn" type="button" onClick={onAction}>
        {action}
      </button>
    </article>
  );
}

export default function TodayDashboard({ user, onPrimaryAction }: TodayDashboardProps) {
  const [dashboard, setDashboard] = useState<DashboardState>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportState>(null);
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [loading, setLoading] = useState(Boolean(user?.id));
  const [retentionError, setRetentionError] = useState("");
  const [retentionRetry, setRetentionRetry] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      if (!user?.id) {
        setDashboard(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setRetentionError("");
      const nextDashboard = await getTodayDashboard(user.id);
      if (mounted) {
        setDashboard(nextDashboard);
        if (!nextDashboard) {
          setRetentionError("Could not load retention progress. You can keep using OpeningFit.");
        }
        setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [retentionRetry, user?.id]);

  const displayName = getDisplayName(user, dashboard);
  const weeklyProgress = getWeeklyProgress(dashboard?.weeklyGoalProgress || null);
  const currentStreak = safeNumber(dashboard?.currentStreak?.current_streak, 0);
  const bestStreak = safeNumber(dashboard?.currentStreak?.best_streak, 0);
  const streakFreezes = safeNumber(dashboard?.currentStreak?.streak_freezes, 0);
  const streakAtRisk = getStreakAtRisk(dashboard?.currentStreak || null);
  const xp = safeNumber(dashboard?.xp, 0);
  const level = dashboard?.level || dashboard?.profile?.current_level || "Beginner";
  const recentActivity = dashboard?.recentActivity || [];
  const latestAchievement = dashboard?.achievements?.[0] || null;

  const hasRetentionHistory = Boolean(
    xp ||
      currentStreak ||
      weeklyProgress.current ||
      recentActivity.length ||
      dashboard?.achievements?.length
  );

  const motivation = useMemo(() => {
    const sessionsAway = Math.max(1, (weeklyProgress.target || 3) - weeklyProgress.current + 1);
    return `You’re ${sessionsAway} session${sessionsAway === 1 ? "" : "s"} away from beating last week.`;
  }, [weeklyProgress.current, weeklyProgress.target]);
  const nextAction = getNextAction({
    hasRetentionHistory,
    atRisk: streakAtRisk,
    weeklyProgress,
    recentActivity,
  });

  function handlePrimaryAction() {
    logRetentionEvent(
      "session_started",
      {
        source: "today_dashboard",
      },
      { dedupeKey: `${user?.id || "guest"}:${todayIsoDate()}` }
    );
    onPrimaryAction?.();
  }

  async function handleGenerateWeeklyReport() {
    if (!user?.id) return;

    setWeeklyReportLoading(true);
    try {
      const report = await generateWeeklyReport(user.id, currentWeekStartIsoDate());
      if (report) setWeeklyReport(report);
    } finally {
      setWeeklyReportLoading(false);
    }
  }

  function handleViewWeeklyHistory() {
    const target =
      document.getElementById("report-history") ||
      document.getElementById("saved-history-progress") ||
      document.getElementById("app-results");

    if (target?.scrollIntoView) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (!user?.id) return null;

  if (loading) {
    return (
      <section className="todayDashboard todayDashboardLoading" aria-label="OpeningFit Today">
        <div className="todayDashboardHero">
          <p className="eyebrow">OpeningFit Today</p>
          <h2>Loading your OpeningFit history...</h2>
        </div>
      </section>
    );
  }

  if (retentionError && !dashboard) {
    return (
      <section className="todayDashboard todayDashboardEmpty" aria-label="OpeningFit Today">
        <div className="todayDashboardHero">
          <div>
            <p className="eyebrow">OpeningFit Today</p>
            <h2>Progress is temporarily unavailable</h2>
            <p>{retentionError}</p>
          </div>
          <button className="primaryBtn" type="button" onClick={() => setRetentionRetry((value) => value + 1)}>
            Retry progress
          </button>
        </div>
      </section>
    );
  }

  if (!hasRetentionHistory) {
    return (
      <section className="todayDashboard todayDashboardEmpty" aria-label="OpeningFit Today">
        <div className="todayDashboardHero">
          <div>
            <p className="eyebrow">OpeningFit Today</p>
            <h2>Welcome back, {displayName}</h2>
            <p>Start your first session to begin building your OpeningFit history.</p>
          </div>
          <button className="primaryBtn" type="button" onClick={handlePrimaryAction}>
            Start first session
          </button>
        </div>

        <AchievementsPanel
          userId={user.id}
          achievements={dashboard?.achievements || []}
          compact
        />

        <WeeklyReportCard
          report={weeklyReport}
          loading={weeklyReportLoading}
          onGenerate={handleGenerateWeeklyReport}
          onViewHistory={handleViewWeeklyHistory}
        />

        <ShareProgressCard
          currentStreak={currentStreak}
          weeklyProgress={weeklyProgress}
          level={level}
          latestAchievement={latestAchievement}
          weeklyReport={weeklyReport}
        />

        <NotificationPreferences userId={user.id} />
      </section>
    );
  }

  return (
    <section className="todayDashboard" aria-label="OpeningFit Today">
      <div className="todayDashboardHero">
        <div>
          <p className="eyebrow">OpeningFit Today</p>
          <h2>Welcome back, {displayName}</h2>
          <p>{dashboard?.suggestedNextAction || "Review your next opening task and keep momentum going."}</p>
        </div>

        <button className="primaryBtn" type="button" onClick={handlePrimaryAction}>
          Continue session
        </button>
      </div>

      <div className="todayStatsGrid">
        <StreakCard
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          streakFreezes={streakFreezes}
          atRisk={streakAtRisk}
        />

        <article className="todayStatCard">
          <span className="todayStatIcon"><Trophy size={18} /></span>
          <small>Best streak</small>
          <strong>{bestStreak}</strong>
          <p>{bestStreak === 1 ? "day record" : "day record"}</p>
        </article>

        <article className="todayStatCard todayXpCard">
          <span className="todayStatIcon"><Sparkles size={18} /></span>
          <small>XP and level</small>
          <strong>{xp}</strong>
          <p>{level}</p>
        </article>

        <NextActionCard
          action={nextAction}
          suggestion={dashboard?.suggestedNextAction || "Run one focused OpeningFit session."}
          onAction={nextAction === "Generate weekly report" ? handleGenerateWeeklyReport : handlePrimaryAction}
        />
      </div>

      <div className="todayDashboardSplit">
        <WeeklyGoalCard
          current={weeklyProgress.current}
          target={weeklyProgress.target}
          percent={weeklyProgress.percent}
        />

        <article className="todayPanel">
          <div className="todayPanelTop">
            <div>
              <span>Latest achievement</span>
              <strong>{String(latestAchievement?.title || "No achievement yet")}</strong>
            </div>
            <Sparkles size={20} />
          </div>
          <p>
            {String(
              latestAchievement?.description ||
                "Complete a session to unlock your first OpeningFit achievement."
            )}
          </p>
        </article>
      </div>

      <article className="todayPanel">
        <div className="todayPanelTop">
          <div>
            <span>Recent activity</span>
            <strong>Your latest OpeningFit sessions</strong>
          </div>
          <Activity size={20} />
        </div>

        {recentActivity.length ? (
          <ol className="todayTimeline">
            {recentActivity.slice(0, 5).map((activity, index) => (
              <li key={String(activity.id || `${activity.activity_type}-${index}`)}>
                <span />
                <div>
                  <strong>{formatActivityType(activity.activity_type)}</strong>
                  <small>
                    {formatDate(activity.created_at)} · +{safeNumber(activity.points, 0)} XP
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="todayMuted">Your activity timeline starts with your first session.</p>
        )}
      </article>

      <AchievementsPanel
        userId={user.id}
        achievements={dashboard?.achievements || []}
        compact
      />

      <WeeklyReportCard
        report={weeklyReport}
        loading={weeklyReportLoading}
        onGenerate={handleGenerateWeeklyReport}
        onViewHistory={handleViewWeeklyHistory}
      />

      <ShareProgressCard
        currentStreak={currentStreak}
        weeklyProgress={weeklyProgress}
        level={level}
        latestAchievement={latestAchievement}
        weeklyReport={weeklyReport}
      />

      <NotificationPreferences userId={user.id} />
    </section>
  );
}
