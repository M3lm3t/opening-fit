import { canonicalChessEvidence } from "./primaryReportSummary.js";
import { roleGapCopy, TRAINING_SUBJECT_TYPES } from "./trainingPriority.js";

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
  const source = action.source || {};
  const trainingDuration = source.trainingDuration || source.training_duration || {};
  const minutes = Number(trainingDuration.minutes ?? source.durationMinutes ?? source.duration_minutes);
  const completion = source.successCheck || source.success_check || source.completionTarget?.label || source.completion_target?.label;
  return {
    ...action,
    id,
    type: action.kind,
    durationMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
    improvementCheck: text(completion) || "OpeningFit will compare this canonical target when your next compatible report includes new games.",
    identities: {
      reportId: text(source.sourceReportId || source.source_report_id || source.reportId || source.report_id) || null,
      diagnosisId: text(source.diagnosisId || source.diagnosis_id) || null,
      decisionId: text(source.decisionId || source.decision_id) || null,
      openingId: text(source.canonicalOpeningId || source.canonical_opening_id || source.openingId || source.opening_id) || null,
      trainingSubjectId: text(source.trainingSubjectId || source.training_subject_id || source.priorityId || source.priority_id || source.taskId || source.task_id) || null,
    },
    completed: completedToday(activity, id, date),
  };
}

export function buildTodayPrimaryAction({ decisionModel = null, canonicalPriority = null, activity = [], hasReport = false, date = new Date() } = {}) {
  if (canonicalPriority) {
    if (canonicalPriority.status === "unavailable") return { kind: "calm", title: "No supported session yet", explanation: "The saved coaching priority is unavailable, so OpeningFit will not manufacture a replacement.", cta: "Check for new games", route: "analyse", completed: false };
    const evidence = canonicalPriority.evidenceRefs || {};
    const source = {
      ...evidence,
      taskId: canonicalPriority.taskId,
      priorityId: canonicalPriority.taskId,
      sourceReportId: canonicalPriority.reportId,
      diagnosisId: canonicalPriority.diagnosisId,
      decisionId: canonicalPriority.decisionId || canonicalPriority.recommendationId,
      canonicalOpeningId: canonicalPriority.openingId,
      openingName: canonicalPriority.openingName,
      repertoireRole: canonicalPriority.repertoireRole,
    };
    const action = finalise({
      kind: "train",
      title: canonicalPriority.openingName ? `Train ${canonicalPriority.openingName}` : "Train today's position",
      opening: canonicalPriority.openingName,
      role: text(canonicalPriority.repertoireRole).replaceAll("_", " "),
      explanation: text(evidence.why || evidence.rationale) || "This is the strongest unresolved task retained from your current report.",
      why: text(evidence.provenance || evidence.why || evidence.rationale),
      cta: "Start session",
      route: "practice",
      target: source,
      chessEvidence: canonicalChessEvidence(source),
      source,
    }, activity, date);
    return { ...action, id: canonicalPriority.taskId || action.id, completed: canonicalPriority.status === "completed" || action.completed, unavailable: canonicalPriority.status === "unavailable" };
  }
  if (!decisionModel) {
    return hasReport
      ? { kind: "calm", title: "No supported session yet", explanation: "Your report does not contain a recommendation with enough trusted evidence to train safely.", cta: "Check for new games", route: "analyse", completed: false }
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

  return { kind: "calm", title: "No supported session yet", explanation: "Keep playing and check for new games. OpeningFit will surface a task when the evidence supports one.", cta: "Check for new games", route: "analyse", completed: false };
}

export function buildTodayExperienceAction({ connected = false, loading = false, importMessage = "", evidence = {}, ...taskInput } = {}) {
  if (!connected && !taskInput.hasReport) return { kind: "calm", title: "Connect your chess account", explanation: "Import your Chess.com or Lichess games to create your first evidence-backed session.", cta: "Connect and import", route: "analyse", completed: false };
  if (loading) return { kind: "calm", title: "Checking your games", explanation: text(importMessage) || "OpeningFit is using the current import progress and will keep your saved report available.", completed: false };
  if (evidence.systemicFailure) return { kind: "calm", title: "This report needs another pass", explanation: `OpeningFit could not attribute the imported games reliably.${evidence.diagnosticReference ? ` Diagnostic reference: ${evidence.diagnosticReference}.` : ""}`, cta: "Reanalyse", route: "analyse", completed: false };
  return buildTodayPrimaryAction(taskInput);
}

export function todayGoalContext(goal) {
  if (!goal?.hasGoal || !goal.current || !goal.target) return null;
  return `${goal.current} → ${goal.target}`;
}
