import { canonicalReportAction } from './reportViews.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

export function evidenceAction(target, sourceSection = 'summary', report = null) {
  const source = { ...object(target?.source), ...object(target) };
  const savedRole = /^white_(primary|secondary)$/.test(source.slot) ? 'white' : source.slot;
  return canonicalReportAction({
    actionType: 'open_evidence', sourceSection, destinationSection: 'evidence',
    reportId: source.sourceReportId || source.source_report_id || source.reportId || source.report_id || report?.analysisId || report?.analysis_id,
    decisionId: source.decisionId || source.decision_id || source.recommendationId,
    diagnosisId: source.diagnosisId || source.diagnosis_id,
    openingId: source.canonicalOpeningId || source.canonical_opening_id || source.openingId || source.opening_id || source.openingKey,
    openingName: source.openingName || source.opening_name || source.opening || source.name,
    repertoireRole: source.repertoireRole || source.repertoire_role || savedRole || source.role,
    trainingTaskId: source.taskId || source.trainingTaskId,
    focusTarget: 'evidence-table',
  });
}

// Resolve against the current restored report, never against a cached object or
// an array index from an earlier report. Older name-only links remain supported.
export function resolveReportEvidence(report, input) {
  const data = object(report);
  const action = canonicalReportAction(object(input));
  const decision = object(data.reportDecision || data.report_decision);
  const rows = list(decision.recommendations).length ? list(decision.recommendations)
    : [...list(data.topOpenings || data.top_openings), ...list(data.opening_stats), ...list(data.best_openings)];
  const reportId = text(data.analysisId || data.analysis_id || decision.sourceReportId);
  const unavailable = (status, message) => ({ status, message, target: null });
  if (action.reportId && action.reportId !== reportId) return unavailable('stale', 'This evidence belongs to an older report. Open that saved report or analyse your games again.');
  const isReportDecision = Boolean(action.decisionId && action.decisionId === text(decision.decisionId || decision.decision_id));
  const hasTarget = Boolean((action.decisionId && !isReportDecision) || action.diagnosisId || action.openingId || action.openingName);
  if (!hasTarget) return unavailable(rows.length ? 'overview' : 'absent', rows.length ? 'Showing the evidence retained in this report.' : 'Detailed evidence was not retained in this saved report. Analyse your games again to rebuild it.');
  const diagnoses = [decision.openingDiagnosis, decision.opening_diagnosis, ...list(decision.diagnoses)].filter(Boolean);
  const diagnosis = diagnoses.find(row => text(row.diagnosisId || row.diagnosis_id) === action.diagnosisId);
  const matches = rows.filter(row => {
    const ids = [row.decisionId, row.decision_id, row.recommendationId, row.contextId].map(text).filter(Boolean);
    if (action.decisionId && !isReportDecision && !ids.includes(action.decisionId)) return false;
    if (action.diagnosisId && (!diagnosis || !ids.includes(text(diagnosis.canonicalDecisionId || diagnosis.canonical_decision_id || diagnosis.decisionId || diagnosis.recommendationId)))) return false;
    if (action.openingId && text(row.canonicalOpeningId || row.openingId || row.opening_id || row.openingKey) !== action.openingId) return false;
    if (!action.openingId && (!action.decisionId || isReportDecision) && !action.diagnosisId && text(row.openingName || row.opening || row.name).toLowerCase() !== action.openingName.toLowerCase()) return false;
    return !action.repertoireRole || [row.repertoireRole, row.repertoire_role, row.role, row.context].map(text).includes(action.repertoireRole);
  });
  const target = matches.length === 1 ? matches[0] : null;
  if (!target) return unavailable(rows.length ? 'stale' : 'absent', 'The requested evidence target is not available in this saved report. Analyse your games again to rebuild it.');
  return { status: 'available', target, message: `Evidence for ${text(target.openingName || target.opening || target.name) || 'the selected opening'}. Only information retained in this report is shown; individual source games may be unavailable in a compact report.` };
}
