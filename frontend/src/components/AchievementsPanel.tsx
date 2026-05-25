import { useEffect, useMemo, useState } from "react";
import { Award, Lock } from "lucide-react";
import {
  ACHIEVEMENTS,
  checkAndUnlockAchievements,
  getTodayDashboard,
} from "../services/retentionService";

type AchievementRow = Record<string, unknown>;

type AchievementsPanelProps = {
  userId?: string | null;
  achievements?: AchievementRow[];
  compact?: boolean;
};

const ACHIEVEMENT_ORDER = [
  "first_session",
  "three_day_streak",
  "seven_day_streak",
  "first_week_complete",
  "level_intermediate",
  "level_advanced",
  "level_elite",
] as const;

const HINTS: Record<(typeof ACHIEVEMENT_ORDER)[number], string> = {
  first_session: "Complete one OpeningFit session.",
  three_day_streak: "Stay active for 3 days in a row.",
  seven_day_streak: "Stay active for 7 days in a row.",
  first_week_complete: "Complete your first weekly goal.",
  level_intermediate: "Reach 500 XP.",
  level_advanced: "Reach 1,500 XP.",
  level_elite: "Reach 3,000 XP.",
};

const DISPLAY_TITLES: Record<(typeof ACHIEVEMENT_ORDER)[number], string> = {
  first_session: "First Session",
  three_day_streak: "3 Day Streak",
  seven_day_streak: "7 Day Streak",
  first_week_complete: "First Full Week",
  level_intermediate: "Intermediate Level",
  level_advanced: "Advanced Level",
  level_elite: "Elite Level",
};

function formatUnlockDate(value?: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function AchievementsPanel({
  userId,
  achievements = [],
  compact = false,
}: AchievementsPanelProps) {
  const [rows, setRows] = useState<AchievementRow[]>(achievements);

  useEffect(() => {
    setRows(achievements);
  }, [achievements]);

  useEffect(() => {
    let mounted = true;

    async function refreshAchievements() {
      if (!userId) return;

      await checkAndUnlockAchievements(userId);
      const dashboard = await getTodayDashboard(userId);

      if (mounted && dashboard?.achievements) {
        setRows(dashboard.achievements as AchievementRow[]);
      }
    }

    refreshAchievements();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const unlockedByKey = useMemo(() => {
    return new Map(
      rows
        .map((row) => [String(row.achievement_key || ""), row] as const)
        .filter(([key]) => key)
    );
  }, [rows]);

  return (
    <section className={`achievementsPanel ${compact ? "achievementsPanelCompact" : ""}`}>
      <div className="todayPanelTop">
        <div>
          <span>Achievements</span>
          <strong>{unlockedByKey.size} of {ACHIEVEMENT_ORDER.length} unlocked</strong>
        </div>
        <Award size={20} />
      </div>

      <div className="achievementBadgeGrid">
        {ACHIEVEMENT_ORDER.map((key) => {
          const row = unlockedByKey.get(key);
          const unlocked = Boolean(row);
          const definition = ACHIEVEMENTS[key];
          const title = String(DISPLAY_TITLES[key] || row?.title || definition.title);
          const description = String(row?.description || definition.description);
          const unlockedAt = typeof row?.unlocked_at === "string" ? row.unlocked_at : "";

          return (
            <article
              className={`achievementBadge ${unlocked ? "achievementBadgeUnlocked" : "achievementBadgeLocked"}`}
              key={key}
            >
              <span className="achievementBadgeIcon">
                {unlocked ? <Award size={18} /> : <Lock size={18} />}
              </span>
              <div>
                <strong>{title}</strong>
                <p>
                  {unlocked
                    ? description
                    : HINTS[key]}
                </p>
                {unlocked ? <small>Unlocked {formatUnlockDate(unlockedAt)}</small> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
