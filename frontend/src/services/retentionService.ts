import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

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

const LEVELS = [
  { name: "Elite", minXp: 3000 },
  { name: "Advanced", minXp: 1500 },
  { name: "Intermediate", minXp: 500 },
  { name: "Beginner", minXp: 0 },
];

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

function getClient() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  return supabase;
}

function logRetentionQueryFailure(table: string, operation: string, error: unknown, details: JsonObject = {}) {
  console.error("OpeningFit Supabase query failed", {
    table,
    operation,
    details,
    error,
  });
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function addDaysIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function toDateTimeStart(isoDate: string) {
  return `${isoDate}T00:00:00.000Z`;
}

function getLevelFromXp(xp: number) {
  return LEVELS.find((level) => xp >= level.minXp)?.name || "Beginner";
}

function getAchievementRank(key: string) {
  const ranks: Record<string, number> = {
    level_elite: 7,
    level_advanced: 6,
    level_intermediate: 5,
    accuracy_milestone: 5,
    first_opening_mastered: 5,
    repertoire_builder: 4,
    theory_grinder: 4,
    tactical_specialist: 4,
    seven_day_streak: 4,
    first_week_complete: 3,
    three_day_streak: 2,
    first_session: 1,
  };

  return ranks[key] || 0;
}

function buildWeeklySummary({
  totalSessions,
  completedGoals,
  totalXp,
  bestAchievement,
  comparison,
}: {
  totalSessions: number;
  completedGoals: number;
  totalXp: number;
  bestAchievement: JsonObject | null;
  comparison: JsonObject;
}) {
  const sessionDelta = Number(comparison.sessionDelta || 0);
  const direction =
    sessionDelta > 0
      ? `up ${sessionDelta} session${sessionDelta === 1 ? "" : "s"} from last week`
      : sessionDelta < 0
        ? `${Math.abs(sessionDelta)} session${Math.abs(sessionDelta) === 1 ? "" : "s"} behind last week`
        : "matching last week's session pace";
  const achievementText = bestAchievement?.title
    ? ` You unlocked ${bestAchievement.title}.`
    : "";

  if (!totalSessions && !totalXp && !completedGoals) {
    return "No sessions logged this week yet. Start one focused OpeningFit session to build momentum.";
  }

  return `You logged ${totalSessions} session${totalSessions === 1 ? "" : "s"}, earned ${totalXp} XP, and completed ${completedGoals} goal${completedGoals === 1 ? "" : "s"}, ${direction}.${achievementText}`;
}

function countWeeklySessions(activities: JsonObject[]) {
  const completed = activities.filter(
    (item) => String(item.activity_type || "") === "session_completed"
  ).length;

  if (completed) return completed;

  return activities.filter(
    (item) => String(item.activity_type || "") === "session_started"
  ).length;
}

function getSuggestedNextAction(
  profile: UserProfile | null,
  streak: UserStreak | null,
  weeklyGoal: WeeklyGoal | null
) {
  if (!profile) return "Create your OpeningFit profile.";

  const currentValue = Number(weeklyGoal?.current_value || 0);
  const targetValue = Number(weeklyGoal?.target_value || 0);

  if (weeklyGoal && !weeklyGoal.completed && targetValue > currentValue) {
    return `Make progress on your weekly ${weeklyGoal.goal_type} goal.`;
  }

  if (!streak?.last_active_date || streak.last_active_date !== todayIsoDate()) {
    return "Log one OpeningFit activity today to protect your streak.";
  }

  return "Review your next opening task and keep the streak alive.";
}

async function getCurrentUserId() {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser();
  if (error) {
    logRetentionQueryFailure("auth.users", "get current authenticated user", error);
    return null;
  }

  return data.user?.id || null;
}

async function ensureRetentionProfile(userId: string) {
  const client = getClient();
  if (!client || !userId) return null;

  const { data, error } = await client
    .from("user_profiles")
    .upsert({ id: userId }, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    logRetentionQueryFailure("user_profiles", "upsert retention profile by id", error, { userId });
    throw error;
  }
  return data as UserProfile;
}

async function getActiveWeeklyGoal(userId: string) {
  const client = getClient();
  if (!client || !userId) return null;

  const today = todayIsoDate();
  const { data, error } = await client
    .from("user_goals")
    .select("*")
    .eq("user_id", userId)
    .eq("period", "weekly")
    .or(`ends_on.is.null,ends_on.gte.${today}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logRetentionQueryFailure("user_goals", "select active weekly goal by user_id", error, {
      userId,
      today,
    });
    throw error;
  }
  return data as WeeklyGoal | null;
}

async function incrementWeeklyGoalProgress(userId: string) {
  const client = getClient();
  if (!client || !userId) return null;

  const goal = await getActiveWeeklyGoal(userId);
  if (!goal || goal.completed) return goal;

  const currentValue = Number(goal.current_value || 0) + 1;
  const targetValue = Number(goal.target_value || 0);
  const completed = targetValue > 0 && currentValue >= targetValue;

  const { data, error } = await client
    .from("user_goals")
    .update({ current_value: currentValue, completed })
    .eq("id", goal.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    logRetentionQueryFailure("user_goals", "update weekly goal progress", error, {
      userId,
      goalId: goal.id,
      currentValue,
      completed,
    });
    throw error;
  }
  return data as WeeklyGoal;
}

async function unlockAchievement(
  userId: string,
  achievementKey: keyof typeof ACHIEVEMENTS
) {
  const client = getClient();
  if (!client || !userId) return null;

  const achievement = ACHIEVEMENTS[achievementKey];
  const { data: existing, error: existingError } = await client
    .from("user_achievements")
    .select("*")
    .eq("user_id", userId)
    .eq("achievement_key", achievementKey)
    .maybeSingle();

  if (existingError) {
    logRetentionQueryFailure("user_achievements", "select achievement before unlock", existingError, {
      userId,
      achievementKey,
    });
    throw existingError;
  }
  if (existing) return null;

  const { data, error } = await client
    .from("user_achievements")
    .insert({
      user_id: userId,
      achievement_key: achievementKey,
      title: achievement.title,
      description: achievement.description,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return null;
    logRetentionQueryFailure("user_achievements", "insert unlocked achievement", error, {
      userId,
      achievementKey,
    });
    throw error;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("openingfit-toast", {
        detail: `Achievement unlocked: ${achievement.title}`,
      })
    );
  }

  return data;
}

export async function getTodayDashboard(userId: string): Promise<RetentionDashboard | null> {
  const client = getClient();
  if (!client || !userId) return null;

  try {
    const profile = await ensureRetentionProfile(userId);

    const [
      { data: streak, error: streakError },
      weeklyGoalProgress,
      { data: recentActivity, error: activityError },
      { data: achievements, error: achievementError },
    ] = await Promise.all([
      client
        .from("user_streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      getActiveWeeklyGoal(userId),
      client
        .from("user_activity_log")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("user_achievements")
        .select("*")
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false }),
    ]);

    if (streakError) {
      logRetentionQueryFailure("user_streaks", "select current streak by user_id", streakError, { userId });
      throw streakError;
    }
    if (activityError) {
      logRetentionQueryFailure("user_activity_log", "select recent activity by user_id", activityError, { userId });
      throw activityError;
    }
    if (achievementError) {
      logRetentionQueryFailure("user_achievements", "select achievements by user_id", achievementError, { userId });
      throw achievementError;
    }

    const xp = Number(profile?.xp || 0);
    const level = profile?.current_level || getLevelFromXp(xp);

    return {
      profile,
      currentStreak: (streak as UserStreak | null) || null,
      weeklyGoalProgress,
      recentActivity: (recentActivity as JsonObject[]) || [],
      achievements: (achievements as JsonObject[]) || [],
      xp,
      level,
      suggestedNextAction: getSuggestedNextAction(
        profile,
        (streak as UserStreak | null) || null,
        weeklyGoalProgress
      ),
    };
  } catch (error) {
    console.error("OpeningFit retention dashboard failed.", error);
    return null;
  }
}

export async function logUserActivity(
  activityType: string,
  points: number,
  metadata: JsonObject = {}
) {
  const client = getClient();
  if (!client || !activityType) return null;

  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const safePoints = Number.isFinite(points) ? points : 0;
    const { data, error } = await client
      .from("user_activity_log")
      .insert({
        user_id: userId,
        activity_type: activityType,
        points: safePoints,
        metadata,
      })
      .select("*")
      .single();

    if (error) {
      logRetentionQueryFailure("user_activity_log", "insert activity log row", error, {
        userId,
        activityType,
        points: safePoints,
      });
      throw error;
    }

    await Promise.allSettled([
      addXp(userId, safePoints),
      updateUserStreak(userId),
      incrementWeeklyGoalProgress(userId),
    ]);

    await checkAndUnlockAchievements(userId);

    return data;
  } catch (error) {
    console.error("OpeningFit retention activity logging failed.", error);
    return null;
  }
}

export async function updateUserStreak(userId: string) {
  const client = getClient();
  if (!client || !userId) return null;

  try {
    const today = todayIsoDate();
    const yesterday = isoDateDaysAgo(1);
    const missedOneDay = isoDateDaysAgo(2);

    const { data: existing, error: fetchError } = await client
      .from("user_streaks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      logRetentionQueryFailure("user_streaks", "select streak for update", fetchError, { userId });
      throw fetchError;
    }

    const streak = (existing as UserStreak | null) || null;
    if (streak?.last_active_date === today) return streak;

    const currentStreak = Number(streak?.current_streak || 0);
    const bestStreak = Number(streak?.best_streak || 0);
    const streakFreezes = Number(streak?.streak_freezes ?? 1);
    let nextCurrentStreak = 1;
    let nextFreezes = streakFreezes;

    if (streak?.last_active_date === yesterday) {
      nextCurrentStreak = currentStreak + 1;
    } else if (streak?.last_active_date === missedOneDay && streakFreezes > 0) {
      nextCurrentStreak = Math.max(currentStreak, 1);
      nextFreezes = streakFreezes - 1;
    }

    const payload = {
      user_id: userId,
      current_streak: nextCurrentStreak,
      best_streak: Math.max(bestStreak, nextCurrentStreak),
      last_active_date: today,
      streak_freezes: nextFreezes,
    };

    const { data, error } = await client
      .from("user_streaks")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      logRetentionQueryFailure("user_streaks", "upsert streak row", error, { userId, payload });
      throw error;
    }
    return data as UserStreak;
  } catch (error) {
    console.error("OpeningFit retention streak update failed.", error);
    return null;
  }
}

export async function addXp(userId: string, points: number) {
  const client = getClient();
  if (!client || !userId) return null;

  try {
    const safePoints = Number.isFinite(points) ? points : 0;
    const profile = await ensureRetentionProfile(userId);
    const nextXp = Math.max(0, Number(profile?.xp || 0) + safePoints);
    const nextLevel = getLevelFromXp(nextXp);

    const { data, error } = await client
      .from("user_profiles")
      .update({
        xp: nextXp,
        current_level: nextLevel,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      logRetentionQueryFailure("user_profiles", "update XP and current_level", error, {
        userId,
        points: safePoints,
        nextXp,
        nextLevel,
      });
      throw error;
    }
    return data as UserProfile;
  } catch (error) {
    console.error("OpeningFit retention XP update failed.", error);
    return null;
  }
}

export async function checkAndUnlockAchievements(userId: string) {
  const client = getClient();
  if (!client || !userId) return [];

  try {
    const [
      { count: activityCount, error: activityError },
      { data: streak, error: streakError },
      { data: profile, error: profileError },
      { data: completedGoals, error: goalError },
    ] = await Promise.all([
      client
        .from("user_activity_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      client
        .from("user_streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      client
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(),
      client
        .from("user_goals")
        .select("id")
        .eq("user_id", userId)
        .eq("period", "weekly")
        .eq("completed", true)
        .limit(1),
    ]);

    if (activityError) {
      logRetentionQueryFailure("user_activity_log", "count activities for achievements", activityError, { userId });
      throw activityError;
    }
    if (streakError) {
      logRetentionQueryFailure("user_streaks", "select streak for achievements", streakError, { userId });
      throw streakError;
    }
    if (profileError) {
      logRetentionQueryFailure("user_profiles", "select profile for achievements", profileError, { userId });
      throw profileError;
    }
    if (goalError) {
      logRetentionQueryFailure("user_goals", "select completed weekly goal for achievements", goalError, { userId });
      throw goalError;
    }

    const keysToUnlock: Array<keyof typeof ACHIEVEMENTS> = [];
    const currentStreak = Number((streak as UserStreak | null)?.current_streak || 0);
    const xp = Number((profile as UserProfile | null)?.xp || 0);

    if (Number(activityCount || 0) > 0) keysToUnlock.push("first_session");
    if (currentStreak >= 3) keysToUnlock.push("three_day_streak");
    if (currentStreak >= 7) keysToUnlock.push("seven_day_streak");
    if ((completedGoals || []).length > 0) keysToUnlock.push("first_week_complete");
    if (xp >= 500) keysToUnlock.push("level_intermediate");
    if (xp >= 1500) keysToUnlock.push("level_advanced");
    if (xp >= 3000) keysToUnlock.push("level_elite");
    if (xp >= 250) keysToUnlock.push("first_opening_mastered");
    if (xp >= 750) keysToUnlock.push("accuracy_milestone");
    if (Number(activityCount || 0) >= 5) keysToUnlock.push("repertoire_builder");
    if (Number(activityCount || 0) >= 8) keysToUnlock.push("theory_grinder");
    if (Number(activityCount || 0) >= 10 && xp >= 1000) keysToUnlock.push("tactical_specialist");

    const results = await Promise.allSettled(
      keysToUnlock.map((key) => unlockAchievement(userId, key))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<unknown> => result.status === "fulfilled")
      .map((result) => result.value)
      .filter(Boolean);
  } catch (error) {
    console.error("OpeningFit retention achievement check failed.", error);
    return [];
  }
}

export async function generateWeeklyReport(userId: string, weekStart: string) {
  const client = getClient();
  if (!client || !userId || !weekStart) return null;

  try {
    const weekEnd = addDaysIsoDate(weekStart, 6);
    const nextWeekStart = addDaysIsoDate(weekStart, 7);
    const previousWeekStart = addDaysIsoDate(weekStart, -7);
    const previousWeekEnd = addDaysIsoDate(weekStart, -1);

    const [
      { data: activities, error: activityError },
      { data: previousActivities, error: previousActivityError },
      { data: completedGoals, error: goalError },
      { data: previousCompletedGoals, error: previousGoalError },
      { data: streak, error: streakError },
      { data: achievements, error: achievementError },
    ] = await Promise.all([
      client
        .from("user_activity_log")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", toDateTimeStart(weekStart))
        .lt("created_at", toDateTimeStart(nextWeekStart)),
      client
        .from("user_activity_log")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", toDateTimeStart(previousWeekStart))
        .lt("created_at", toDateTimeStart(weekStart)),
      client
        .from("user_goals")
        .select("*")
        .eq("user_id", userId)
        .eq("completed", true)
        .gte("starts_on", weekStart)
        .lte("starts_on", weekEnd),
      client
        .from("user_goals")
        .select("*")
        .eq("user_id", userId)
        .eq("completed", true)
        .gte("starts_on", previousWeekStart)
        .lte("starts_on", previousWeekEnd),
      client
        .from("user_streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      client
        .from("user_achievements")
        .select("*")
        .eq("user_id", userId)
        .gte("unlocked_at", toDateTimeStart(weekStart))
        .lt("unlocked_at", toDateTimeStart(nextWeekStart)),
    ]);

    if (activityError) {
      logRetentionQueryFailure("user_activity_log", "select weekly report activity", activityError, {
        userId,
        weekStart,
      });
      throw activityError;
    }
    if (previousActivityError) {
      logRetentionQueryFailure("user_activity_log", "select previous weekly report activity", previousActivityError, {
        userId,
        previousWeekStart,
      });
      throw previousActivityError;
    }
    if (goalError) {
      logRetentionQueryFailure("user_goals", "select weekly report completed goals", goalError, {
        userId,
        weekStart,
        weekEnd,
      });
      throw goalError;
    }
    if (previousGoalError) {
      logRetentionQueryFailure("user_goals", "select previous weekly report completed goals", previousGoalError, {
        userId,
        previousWeekStart,
        previousWeekEnd,
      });
      throw previousGoalError;
    }
    if (streakError) {
      logRetentionQueryFailure("user_streaks", "select weekly report streak", streakError, { userId });
      throw streakError;
    }
    if (achievementError) {
      logRetentionQueryFailure("user_achievements", "select weekly report achievements", achievementError, {
        userId,
        weekStart,
      });
      throw achievementError;
    }

    const weekActivities = (activities || []) as JsonObject[];
    const priorActivities = (previousActivities || []) as JsonObject[];
    const totalSessions = countWeeklySessions(weekActivities);
    const previousSessions = countWeeklySessions(priorActivities);
    const totalXp = weekActivities.reduce((sum, item) => sum + Number(item.points || 0), 0);
    const previousXp = priorActivities.reduce((sum, item) => sum + Number(item.points || 0), 0);
    const completedGoalCount = (completedGoals || []).length;
    const previousCompletedGoalCount = (previousCompletedGoals || []).length;
    const activeDays = new Set(
      weekActivities.map((item) => String(item.created_at || "").slice(0, 10)).filter(Boolean)
    ).size;
    const bestAchievement =
      ((achievements || []) as JsonObject[])
        .slice()
        .sort(
          (a, b) =>
            getAchievementRank(String(b.achievement_key || "")) -
            getAchievementRank(String(a.achievement_key || ""))
        )[0] || null;
    const comparison = {
      previousSessions,
      previousCompletedGoals: previousCompletedGoalCount,
      previousXp,
      sessionDelta: totalSessions - previousSessions,
      completedGoalDelta: completedGoalCount - previousCompletedGoalCount,
      xpDelta: totalXp - previousXp,
    };
    const streakProgress = {
      currentStreak: Number((streak as UserStreak | null)?.current_streak || 0),
      bestStreak: Number((streak as UserStreak | null)?.best_streak || 0),
      activeDays,
    };
    const stats = {
      totalSessions,
      completedGoals: completedGoalCount,
      totalXp,
      streakProgress,
      bestAchievement,
      comparison,
    };
    const summary = buildWeeklySummary({
      totalSessions,
      completedGoals: completedGoalCount,
      totalXp,
      bestAchievement,
      comparison,
    });

    const { data, error } = await client
      .from("weekly_reports")
      .upsert(
        {
          user_id: userId,
          week_start: weekStart,
          week_end: weekEnd,
          summary,
          stats,
        },
        { onConflict: "user_id,week_start" }
      )
      .select("*")
      .single();

    if (error) {
      logRetentionQueryFailure("weekly_reports", "upsert generated weekly report", error, {
        userId,
        weekStart,
        weekEnd,
      });
      throw error;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("openingfit-toast", {
          detail: "Weekly report generated.",
        })
      );
    }

    return data as WeeklyReport;
  } catch (error) {
    console.error("OpeningFit weekly report generation failed.", error);
    return null;
  }
}
