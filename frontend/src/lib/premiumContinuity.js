const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const text = (value) => String(value ?? "").trim();
const roleLabel = (role) => ({ black_vs_e4: "Black against 1.e4", black_vs_d4: "Black against 1.d4", white: "White repertoire", white_repertoire: "White repertoire" })[text(role)] || "Repertoire role";

export function buildTrainingResponsePlanRecord({ existing = {}, taskId, planId, responsePlan, openingName, priority = {}, sourceType = "general setup", synced = false, now = new Date() } = {}) {
  const timestamp = new Date(now).toISOString();
  const roleGap = priority.subjectType === "role_gap";
  return {
    taskId: text(taskId) || null,
    planId: text(planId) || null,
    responsePlan: text(responsePlan),
    subjectType: text(priority.subjectType) || "opening",
    subjectRole: text(priority.subjectRole) || null,
    openingName: roleGap ? null : text(openingName) || "Opening focus",
    repertoireRole: text(priority.repertoireRole) || "unresolved",
    playerColour: text(priority.playerColour) || null,
    triggeringPosition: text(priority.lineOrPosition) || null,
    sourceReportId: text(priority.sourceReportId) || null,
    sourceType: text(sourceType) || "general setup",
    fictional: false,
    synced: Boolean(synced),
    createdAt: existing.createdAt || timestamp,
    updatedAt: timestamp,
    reviewState: "active",
    completionState: "response_plan_saved",
  };
}

export function trainingResponsePlans(settings = {}) {
  const plans = settings?.preferences?.trainingResponsePlans;
  return plans && typeof plans === "object" && !Array.isArray(plans) ? plans : {};
}

export function repertoireIntentions(settings = {}) {
  const intentions = settings?.preferences?.repertoireIntentions;
  return intentions && typeof intentions === "object" && !Array.isArray(intentions) ? intentions : {};
}

export function buildPremiumWeeklyOverview(plan = {}, responsePlans = {}) {
  const tasks = list(plan.tasks).slice().sort((left, right) => Number(left.order || 0) - Number(right.order || 0)).slice(0, 5);
  const primaryTask = tasks[0] || null;
  const saved = responsePlans[primaryTask?.id] || Object.values(responsePlans).find((item) => item?.planId === plan.id) || null;
  const evidenceCount = Number(plan.trainingPriority?.evidenceCount ?? plan.targetMetric?.evidenceGames ?? primaryTask?.sourceGameIds?.length ?? 0);
  const completed = tasks.filter((task) => task.status === "completed").length;
  return {
    primaryTask,
    secondaryTasks: tasks.slice(1, 5),
    completed,
    total: tasks.length,
    completionPercent: tasks.length ? Math.round(completed * 100 / tasks.length) : Number(plan.completionPercent || 0),
    estimatedMinutes: Number(plan.estimatedMinutes || tasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0)),
    evidenceCount: Math.max(0, evidenceCount || 0),
    confidence: text(plan.trainingPriority?.confidenceStatus || plan.trainingPriority?.confidenceLabel) || (evidenceCount >= 8 ? "Stronger sample" : evidenceCount >= 5 ? "Usable sample" : "Limited evidence"),
    responsePlan: text(saved?.responsePlan),
    responsePlanSource: saved?.synced ? "Synced across devices" : saved?.responsePlan ? "Saved on this device" : "No response plan saved yet",
    generatedAt: plan.createdAt || null,
    refreshMessage: plan.weekEnd
      ? `This plan remains current through ${plan.weekEnd}. A new valid report can refresh the priority sooner.`
      : "A new valid report can refresh this priority when enough evidence is available.",
  };
}

export function buildPremiumTrainingHistory(plans = [], responsePlans = {}) {
  return list(plans).flatMap((plan) => list(plan.tasks).filter((task) => task.status === "completed").flatMap((task) => {
    const saved = responsePlans[task.id] || Object.values(responsePlans).find((item) => item?.taskId === task.id);
    const sourceType = text(saved?.sourceType) || (task.positionFen ? "own game" : task.sourceGameIds?.length ? "own game" : "general setup");
    if (sourceType === "fictional preview" || saved?.fictional) return [];
    const roleGap = (saved?.subjectType || task.subjectType) === "role_gap";
    return [{
      id: `${plan.id}:${task.id}`,
      planId: plan.id,
      taskId: task.id,
      title: task.title || "Completed training task",
      openingName: roleGap ? roleLabel(saved?.subjectRole || task.subjectRole) : saved?.openingName || task.openingName || task.openingId || plan.targetMetric?.openingId || "Opening focus",
      startedAt: task.startedAt || task.started_at || plan.createdAt || plan.created_at || null,
      completedAt: task.completedAt || task.completed_at || plan.completedAt || plan.completed_at || null,
      sourceType,
      responsePlan: text(saved?.responsePlan),
      recurrenceStatus: text(saved?.recurrenceStatus) || "More evidence needed",
      explanation: task.explanation || "Completed from the saved weekly plan.",
      reopenable: true,
    }];
  })).sort((left, right) => (Date.parse(right.completedAt) || 0) - (Date.parse(left.completedAt) || 0));
}

export function contextualPlusContinuation(priority = {}, responsePlan = "") {
  if (priority.subjectType === "role_gap") {
    return {
      title: "Continue building your repertoire choice",
      message: responsePlan
        ? "Plus keeps this repertoire response plan with the weekly plan, refreshes the role after future valid reports, and checks the next correctly attributed evidence."
        : "Plus turns this repertoire-building action into a weekly loop with prioritised tasks, saved response plans, and honest progress checks after future comparable reports.",
    };
  }
  const opening = text(priority.openingName) || "this opening";
  const role = text(priority.role).toLowerCase();
  const roleText = role === "played_as_white" ? "your White role" : role.includes("black") ? "your Black repertoire role" : role.startsWith("faced_") ? `your preparation against ${opening}` : `your ${opening} preparation`;
  return {
    title: `Continue building ${roleText}`,
    message: responsePlan
      ? `Plus keeps your ${opening} response plan with the weekly plan, refreshes the priority after future valid reports, and checks whether the same opening-level issue recurs.`
      : `Plus turns this ${opening} action into a weekly loop with prioritised tasks, recoverable source-game reviews, saved response plans, and honest progress checks after future comparable reports.`,
  };
}
