type JsonObject = Record<string, unknown>;

type UserProfile = {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  goal_text?: string | null;
  current_level?: string | null;
  xp?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UserStreak = {
  user_id: string;
  current_streak?: number | null;
  best_streak?: number | null;
  last_active_date?: string | null;
  streak_freezes?: number | null;
  updated_at?: string | null;
};

type WeeklyGoal = {
  id: string;
  user_id: string;
  goal_type: string;
  target_value: number;
  current_value?: number | null;
  period?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  completed?: boolean | null;
  created_at?: string | null;
};

type WeeklyReport = {
  id?: string;
  user_id: string;
  week_start: string;
  week_end: string;
  summary: string;
  stats: JsonObject;
  created_at?: string | null;
};

type RetentionDashboard = {
  profile: UserProfile | null;
  currentStreak: UserStreak | null;
  weeklyGoalProgress: WeeklyGoal | null;
  recentActivity: JsonObject[];
  achievements: JsonObject[];
  xp: number;
  level: string;
  suggestedNextAction: string;
};

export const ACHIEVEMENTS = {
  first_session: {
    title: "First Session",
    description: "Logged your first OpeningFit activity.",
  },
  three_day_streak: {
    title: "Three Day Streak",
    description: "Stayed active for three days in a row.",
  },
  seven_day_streak: {
    title: "Seven Day Streak",
    description: "Stayed active for seven days in a row.",
  },
  first_week_complete: {
    title: "First Week Complete",
    description: "Completed your first weekly OpeningFit goal.",
  },
  level_intermediate: {
    title: "Intermediate",
    description: "Reached Intermediate level.",
  },
  level_advanced: {
    title: "Advanced",
    description: "Reached Advanced level.",
  },
  level_elite: {
    title: "Elite",
    description: "Reached Elite level.",
  },
  first_opening_mastered: {
    title: "First Opening Mastered",
    description: "Built enough consistency to treat one opening as mastered.",
  },
  tactical_specialist: {
    title: "Tactical Specialist",
    description: "Built a sharp, forcing OpeningFit activity profile.",
  },
  theory_grinder: {
    title: "Theory Grinder",
    description: "Kept returning for repeated review work.",
  },
  repertoire_builder: {
    title: "Repertoire Builder",
    description: "Logged enough sessions to start forming a real repertoire habit.",
  },
  accuracy_milestone: {
    title: "Accuracy Milestone",
    description: "Reached a meaningful improvement milestone.",
  },
};

const LOCAL_RETENTION_EVENT_KEY = "openingFit:legacyRetentionEvents";

function readLocalRetentionEvents(): JsonObject[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_RETENTION_EVENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalRetentionEvents(events: JsonObject[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCAL_RETENTION_EVENT_KEY, JSON.stringify(events.slice(0, 50)));
  } catch {
    // Retention logging should never block the app.
  }
}

function weekEndFromStart(weekStart: string) {
  const date = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return weekStart;
  date.setDate(date.getDate() + 6);
  return date.toISOString().slice(0, 10);
}

// Deprecated Supabase tables intentionally no longer queried here:
// user_profiles, user_activity_log, user_streaks, user_goals,
// user_achievements, weekly_reports.
// Current retention/report persistence lives in userDataService.js via
// openingfit_retention_snapshots, activity_history, report_history, and
// openingfit_user_state. These compatibility exports keep older UI imports
// safe without producing missing-table restore warnings.
export async function getTodayDashboard(_userId: string): Promise<RetentionDashboard | null> {
  return null;
}

export async function logUserActivity(
  activityType: string,
  points: number,
  metadata: JsonObject = {}
) {
  if (!activityType) return null;

  const event = {
    id: `${activityType}:${Date.now()}`,
    activity_type: activityType,
    points: Number.isFinite(points) ? points : 0,
    metadata,
    created_at: new Date().toISOString(),
  };
  writeLocalRetentionEvents([event, ...readLocalRetentionEvents()]);
  return event;
}

export async function updateUserStreak(_userId: string) {
  return null;
}

export async function addXp(_userId: string, _points: number) {
  return null;
}

export async function checkAndUnlockAchievements(_userId: string) {
  return [];
}

export async function generateWeeklyReport(userId: string, weekStart: string): Promise<WeeklyReport | null> {
  if (!userId || !weekStart) return null;

  return {
    id: `local-${userId}-${weekStart}`,
    user_id: userId,
    week_start: weekStart,
    week_end: weekEndFromStart(weekStart),
    summary: "Analyse more games to build a weekly OpeningFit report.",
    stats: {
      source: "local-fallback",
      events: readLocalRetentionEvents().slice(0, 10),
    },
    created_at: new Date().toISOString(),
  };
}
