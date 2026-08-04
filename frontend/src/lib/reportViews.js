export const REPORT_VIEWS = Object.freeze([
  { key: "summary", label: "Summary", hash: "report-summary", headingId: "primary-report-title" },
  { key: "repertoire", label: "Repertoire", hash: "report-repertoire", headingId: "report-repertoire-view-title" },
  { key: "problems", label: "Problems", hash: "report-problems", headingId: "report-problems-view-title" },
  { key: "train", label: "Train", hash: "report-train", headingId: "report-train-view-title" },
  { key: "evidence", label: "Evidence", hash: "report-evidence", headingId: "report-evidence-view-title" },
]);

export const REPORT_CONTEXT_QUERY_KEYS = Object.freeze(["reportAction", "decision", "diagnosis", "opening", "role", "task", "focus", "source"]);

/**
 * @typedef {Object} ReportAction
 * @property {string} actionType
 * @property {string} sourceSection
 * @property {string|null} decisionId
 * @property {string|null} diagnosisId
 * @property {string|null} openingId
 * @property {string|null} repertoireRole
 * @property {string} destinationRoute
 * @property {string} destinationSection
 * @property {string|null} trainingTaskId
 * @property {string|null} focusTarget
 */

const clean = (value) => String(value ?? "").trim() || null;

export function normaliseReportView(value) {
  const clean = String(value || "").replace(/^#/, "").trim().toLowerCase();
  return REPORT_VIEWS.find((view) => view.key === clean || view.hash === clean)?.key || "summary";
}

export function reportViewHash(view) {
  return `#${REPORT_VIEWS.find((item) => item.key === normaliseReportView(view))?.hash || REPORT_VIEWS[0].hash}`;
}

export function reportViewHeadingId(view) {
  return REPORT_VIEWS.find((item) => item.key === normaliseReportView(view))?.headingId || REPORT_VIEWS[0].headingId;
}

export function reportViewFromLocation(location = globalThis.location) {
  return normaliseReportView(location?.hash);
}

export function canonicalReportAction(input = {}) {
  return Object.freeze({
    actionType: clean(input.actionType || input.type) || "open_report_section",
    sourceSection: normaliseReportView(input.sourceSection || "summary"),
    decisionId: clean(input.decisionId || input.decision_id),
    diagnosisId: clean(input.diagnosisId || input.diagnosis_id),
    openingId: clean(input.openingId || input.opening_id || input.canonicalOpeningId),
    repertoireRole: clean(input.repertoireRole || input.repertoire_role),
    destinationRoute: clean(input.destinationRoute || input.route) || "/report",
    destinationSection: normaliseReportView(input.destinationSection || input.section),
    trainingTaskId: clean(input.trainingTaskId || input.training_task_id || input.taskId),
    focusTarget: clean(input.focusTarget || input.focus),
  });
}

export function reportActionUrl(input, location = globalThis.location) {
  const action = canonicalReportAction(input);
  const currentSearch = new URLSearchParams(location?.search || "");
  REPORT_CONTEXT_QUERY_KEYS.forEach((key) => currentSearch.delete(key));
  const values = {
    reportAction: action.actionType,
    decision: action.decisionId,
    diagnosis: action.diagnosisId,
    opening: action.openingId,
    role: action.repertoireRole,
    task: action.trainingTaskId,
    focus: action.focusTarget,
    source: action.sourceSection,
  };
  Object.entries(values).forEach(([key, value]) => { if (value) currentSearch.set(key, value); });
  const query = currentSearch.toString();
  return `${action.destinationRoute}${query ? `?${query}` : ""}${reportViewHash(action.destinationSection)}`;
}

export function reportActionFromLocation(location = globalThis.location) {
  const params = new URLSearchParams(location?.search || "");
  if (!params.get("reportAction")) return null;
  return canonicalReportAction({
    actionType: params.get("reportAction"),
    sourceSection: params.get("source"),
    decisionId: params.get("decision"),
    diagnosisId: params.get("diagnosis"),
    openingId: params.get("opening"),
    repertoireRole: params.get("role"),
    destinationRoute: location?.pathname || "/report",
    destinationSection: reportViewFromLocation(location),
    trainingTaskId: params.get("task"),
    focusTarget: params.get("focus"),
  });
}

export function reportActionForPriority(priority = {}, sourceSection = "evidence") {
  const diagnosis = priority.diagnosisId || priority.diagnosis_id || priority.openingDiagnosis?.diagnosisId;
  const finding = String(priority.findingType || priority.finding_type || "").toLowerCase();
  const type = String(priority.type || priority.actionType || "").toLowerCase();
  const repertoireGap = /repertoire_gap|insufficient_evidence/.test(finding) || /fill_repertoire_gap|collect_more_games/.test(type);
  const diagnosedProblem = Boolean(diagnosis) && /weakness|problem|repair/.test(`${finding} ${type}`);
  const destinationSection = diagnosedProblem ? "problems" : repertoireGap ? "repertoire" : "train";
  return canonicalReportAction({
    actionType: diagnosedProblem ? "open_diagnosed_problem" : repertoireGap ? "open_repertoire_priority" : "open_training_priority",
    sourceSection,
    decisionId: priority.decisionId || priority.decision_id,
    diagnosisId: diagnosis,
    openingId: priority.canonicalOpeningId || priority.openingId || priority.opening_id,
    repertoireRole: priority.repertoireRole || priority.repertoire_role,
    destinationSection,
    trainingTaskId: priority.taskId || priority.task_id,
    focusTarget: diagnosedProblem ? "diagnosis" : repertoireGap ? "repertoire-role" : "training-priority",
  });
}

export const REPORT_ACTION_INVENTORY = Object.freeze([
  { label: "View evidence and full report", source: "Summary", actionType: "open_evidence", destination: "Evidence", context: "decision/opening when present", access: "Free" },
  { label: "View supporting games / Evidence", source: "Summary, Repertoire and Problems cards", actionType: "open_evidence", destination: "Evidence", context: "decision/opening/role", access: "Free; evidence row limit follows existing entitlement" },
  { label: "Go to priority", source: "Repertoire Health factors", actionType: "priority-dependent", destination: "Problems, Repertoire or Train", context: "decision/diagnosis/role/task", access: "Free report destination" },
  { label: "Start 10-minute practice", source: "Summary Train next", actionType: "start_training", destination: "/train?start=report-task", context: "canonical report task", access: "Free first task; existing plan entitlement unchanged" },
  { label: "Analyse more games", source: "Summary or unresolved Repertoire role", actionType: "analyse", destination: "Analysis form", context: "role when present", access: "Free" },
  { label: "Role practice / options", source: "Repertoire", actionType: "role_action", destination: "Training or Evidence", context: "opening/role", access: "Existing behaviour" },
  { label: "Supporting games / Train", source: "Problems", actionType: "problem_action", destination: "Evidence or Training", context: "decision/diagnosis", access: "Existing behaviour" },
  { label: "Open this week's training plan", source: "Train", actionType: "open_training_plan", destination: "/train", context: "canonical task", access: "Existing weekly-plan entitlement" },
  { label: "Practise this response", source: "Repertoire opponent-response prep", actionType: "start_response_practice", destination: "/train", context: "opening/branch", access: "Existing behaviour" },
  { label: "Opening name", source: "Evidence table", actionType: "open_evidence", destination: "/report/evidence", context: "opening decision", access: "Canonical evidence drill-down" },
  { label: "Report filters", source: "Evidence", actionType: "filter_report", destination: "Current Evidence section", context: "report filter state", access: "Free" },
  { label: "Sign in / Account", source: "Evidence save status", actionType: "open_account", destination: "Account", context: "report", access: "Existing auth behaviour unchanged" },
  { label: "Upgrade", source: "Report continuation and locked Evidence tools", actionType: "open_upgrade", destination: "Upgrade", context: "feature", access: "Existing entitlement behaviour unchanged" },
  { label: "View history / comparison", source: "Evidence tools", actionType: "open_history", destination: "History", context: "report", access: "Existing entitlement behaviour unchanged" },
  { label: "Report tabs / mobile report navigation", source: "Report command bar", actionType: "open_report_section", destination: "Selected report hash", context: "preserved query context", access: "Free" },
]);
