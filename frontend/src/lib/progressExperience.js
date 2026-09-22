import { compareReportSnapshots } from "./reportComparison.js";
import { buildReportSnapshot } from "./reportSnapshot.js";
import { reportBody } from "./comparisonPolicy.js";

const arr = (value) => Array.isArray(value) ? value : [];
const num = (value) => { if (value === undefined || value === null || value === "") return null; const parsed = Number(String(value).replace("%", "")); return Number.isFinite(parsed) ? Math.round(parsed) : null; };
const payload = reportBody;
const dateValue = (row = {}) => Date.parse(row.created_at || row.createdAt || row.updated_at || row.summary?.reportDate || payload(row).generated_at || payload(row).importedAt || payload(row).imported_at || "") || 0;
const issues = report => arr(report.weak_lines || report.weakLines || report.problem_lines || report.weaknesses || report.training_priorities);

export function orderedCompletedReports(history = []) {
  const seen = new Set();
  return arr(history).filter((row) => !["failed", "error", "pending"].includes(String(row.status || row.summary?.status || "").toLowerCase())).filter((row) => {
    const body = payload(row); const key = row.id || row.snapshot_key || [body.platform, body.username, dateValue(row), body.gamesImported || body.total_games].join(":");
    if (!body || typeof body !== "object" || seen.has(key)) return false; seen.add(key); return true;
  }).sort((a, b) => dateValue(b) - dateValue(a));
}

function health(report = {}) { return num(report.openingFitScore ?? report.opening_fit_score ?? report.repertoireHealth?.score ?? report.repertoire_health?.score); }

export function compareCompletedReports(history = [], activity = []) {
  const reports = orderedCompletedReports(history);
  const empty = { available: false, changes: [], resolved: [], newIssues: [], repertoireChanges: [], trainingCompleted: 0 };
  if (reports.length < 2) return empty;
  const snapshot = row => { const body = reportBody(row); return body.report_schema_version ? body : buildReportSnapshot({ report: body, defaultGeneratedAt: false }); };
  const result = compareReportSnapshots(snapshot(reports[1]), snapshot(reports[0]));
  const from = dateValue(reports[1]), to = dateValue(reports[0]);
  const trainingCompleted = arr(activity).filter(row => /training.*completed|weakest_line_training_completed/.test(String(row.type || row.action_type || "")) && dateValue(row) > from && dateValue(row) <= to).length;
  if (!result.comparable) return { ...empty, trainingCompleted, reason: result.compatibilityReasons?.join(" "), eligibility: result };
  return { available: true, currentDate: to, previousDate: from, trainingCompleted,
    health: { current: result.currentScore, previous: result.previousScore, delta: result.scoreChange },
    changes: result.openingChanges.map(row => ({ ...row, name: row.opening, scoreDelta: row.scoreChange, fitDelta: null })),
    resolved: result.resolvedWeaknesses, newIssues: result.newWeaknesses, repertoireChanges: result.repertoireChanges, eligibility: result };
}

export function buildReturningProgress({ user = null, currentReport = null, reportHistory = [], activity = [], repertoire = null, now = new Date() } = {}) {
  const reports = orderedCompletedReports(reportHistory); const latest = currentReport || payload(reports[0] || {}); const comparison = compareCompletedReports(reportHistory, activity);
  const lastDate = reports[0] ? dateValue(reports[0]) : dateValue(latest); const daysOld = lastDate ? Math.floor((now.getTime() - lastDate) / 86400000) : null;
  const explicitNewGames = num(latest?.newEligibleGames ?? latest?.new_eligible_games);
  const training = arr(activity).filter((row) => /training.*completed|weakest_line_training_completed/.test(String(row.type || row.action_type || ""))).sort((a, b) => dateValue(b) - dateValue(a));
  const repertoireItems = arr(repertoire?.items); const issue = issues(latest)[0] || repertoireItems.find((item) => item.status === "Repair");
  const shouldReanalyse = (explicitNewGames !== null && explicitNewGames >= 5) || (daysOld !== null && daysOld >= 14) || training.length >= 3;
  return { isAuthenticated: Boolean(user?.id), isReturning: Boolean(user?.id && reports.length), reportCount: reports.length, latest, lastDate, daysOld, newGames: explicitNewGames, newGamesReliable: explicitNewGames !== null, issue, nextTraining: issue?.name || issue?.opening || repertoireItems.find((item) => item.status === "Learning")?.name || "Continue your current repertoire line", recentImprovement: comparison.changes.find((item) => (item.scoreDelta || 0) > 0) || null, comparison, training, shouldReanalyse, health: health(latest), coverage: `${new Set(repertoireItems.filter((item) => !["Paused", "Avoided"].includes(item.status)).map((item) => item.section)).size} repertoire areas represented` };
}
