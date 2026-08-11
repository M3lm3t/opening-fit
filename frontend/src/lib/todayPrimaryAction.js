import { canonicalChessEvidence } from "./primaryReportSummary.js";
import { formatTrainingPriorityTitle, roleGapCopy, TRAINING_SUBJECT_TYPES } from "./trainingPriority.js";

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

function dateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function taskId(kind, source, date) {
  const identity = text(source?.priorityId || source?.diagnosisId || source?.decisionId || source?.openingId || source?.repertoireRole || kind)
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `today:${dateKey(date)}:${kind}:${identity || "current"}`;
}

function completedToday(activity, id, date) {
  const today = dateKey(date);
  return list(activity).some((item) => {
    const type = text(item?.type || item?.action_type);
    const payload = item?.payload || {};
    return type === "today_task_completed" && text(payload.task_id || payload.taskId) === id && text(payload.training_date || payload.trainingDate || dateKey(item.created_at || item.createdAt)) === today;
  });
}

function evidenceCount(source = {}) {
  const direct = Number(source.evidenceCount ?? source.sample?.games ?? source.games);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  return list(source.evidenceGameIds || source.representativeGameIds || source.supportingGameIds).length;
}

function finalise(action, activity, date) {
  const id = taskId(action.kind, action.source, date);
  return { ...action, id, type: action.kind, completed: completedToday(activity, id, date) };
}

export function buildTodayPrimaryAction({ decisionModel = null, activity = [], hasReport = false, date = new Date() } = {}) {
  if (!decisionModel) {
    return hasReport
      ? { kind: "calm", title: "Nothing urgent to repair right now.", explanation: "Keep playing and collect more games before the next analysis.", completed: false }
      : finalise({ kind: "analyse", title: "Analyse your games", explanation: "OpeningFit needs a completed report before it can choose a trustworthy daily task.", cta: "Analyse games", route: "analyse", source: {} }, activity, date);
  }

  const priority = decisionModel.coachingPriority || decisionModel.trainingPriority || decisionModel.authoritative?.trainingPriority || null;
  const priorityType = text(priority?.subjectType || priority?.subject_type);
  const actionType = text(priority?.actionType || priority?.action_type || decisionModel.nextTrainingAction?.type).toLowerCase();
  if (priority && priorityType !== TRAINING_SUBJECT_TYPES.ROLE_GAP && actionType !== "collect_more_games") {
    const chessEvidence = canonicalChessEvidence(priority);
    const count = evidenceCount(priority);
    const opening = text(priority.openingName || decisionModel.nextTrainingAction?.opening || "Current opening priority");
    return finalise({
      kind: "train",
      title: chessEvidence?.positionFen ? "Train this position" : `Train ${opening}`,
      opening,
      role: text(priority.repertoireRole || priority.playerRole).replaceAll("_", " "),
      explanation: count ? `You have reached this target in ${count} supporting game${count === 1 ? "" : "s"}.` : text(priority.rationale || decisionModel.nextTrainingAction?.reason) || "This is the current evidence-backed training priority.",
      why: text(priority.rationale || decisionModel.nextTrainingAction?.reason),
      cta: chessEvidence?.positionFen ? "Train position" : "Start training",
      route: "practice",
      target: priority,
      chessEvidence,
      source: priority,
    }, activity, date);
  }

  const repair = decisionModel.primaryProblem || decisionModel.authoritative?.primaryProblem || null;
  if (repair) {
    const chessEvidence = canonicalChessEvidence(repair.openingDiagnosis || repair.opening_diagnosis || repair);
    const count = evidenceCount(repair);
    const opening = text(repair.opening || repair.openingName || "Current repair target");
    return finalise({
      kind: "repair",
      title: chessEvidence?.positionFen ? "Repair this position" : `Repair ${opening}`,
      opening,
      role: text(repair.repertoireRole || repair.repertoire_role).replaceAll("_", " "),
      explanation: count ? `${count} supporting game${count === 1 ? "" : "s"} make this the clearest unresolved repair task.` : "This is the report's unresolved repair task.",
      why: text(repair.reason || repair.explanation),
      cta: chessEvidence ? "Train repair" : "Review evidence",
      route: chessEvidence ? "practice" : "report",
      target: repair,
      chessEvidence,
      source: repair,
    }, activity, date);
  }

  if (priorityType === TRAINING_SUBJECT_TYPES.ROLE_GAP) {
    const copy = roleGapCopy(priority.subjectRole || priority.repertoireRole || priority.playerRole);
    if (copy) return finalise({ kind: "coverage", title: copy.reportHeading, opening: copy.label, role: copy.role, explanation: copy.objective, why: "The current report has no established opening for this repertoire role.", cta: "Open repertoire", route: "repertoire", target: priority, source: priority }, activity, date);
  }

  return { kind: "calm", title: "Nothing urgent to repair right now.", explanation: "Keep playing and collect more games. OpeningFit will surface a task when the evidence supports one.", completed: false };
}

export function todayGoalContext(goal) {
  if (!goal?.hasGoal || !goal.current || !goal.target) return null;
  return `${goal.current} → ${goal.target}`;
}
