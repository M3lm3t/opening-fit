const arr = (value) => Array.isArray(value) ? value : [];
const num = (value) => { if (value === undefined || value === null || value === "") return null; const parsed = Number(String(value).replace("%", "")); return Number.isFinite(parsed) ? Math.round(parsed) : null; };
const payload = (row = {}) => row.report || row.last_report || row.analysis || row.data || row.snapshot?.report || row.snapshot || row;
const dateValue = (row = {}) => Date.parse(row.created_at || row.createdAt || row.updated_at || row.summary?.reportDate || payload(row).importedAt || payload(row).imported_at || "") || 0;
const openingName = (row = {}) => row.name || row.opening || row.openingName || row.opening_name || "";
const games = (row = {}) => num(row.games ?? row.count ?? row.total ?? row.sampleSize) || 0;
const score = (row = {}) => num(row.fitScore ?? row.fit_score ?? row.score ?? row.winRate ?? row.win_rate);
const confidence = (row = {}) => String(row.confidenceLabel || row.confidence_label || row.confidence || (games(row) >= 8 ? "High" : games(row) >= 3 ? "Medium" : games(row) ? "Low" : "Insufficient evidence"));

export function orderedCompletedReports(history = []) {
  const seen = new Set();
  return arr(history).filter((row) => !["failed", "error", "pending"].includes(String(row.status || row.summary?.status || "").toLowerCase())).filter((row) => {
    const body = payload(row); const key = row.id || row.snapshot_key || [body.platform, body.username, dateValue(row), body.gamesImported || body.total_games].join(":");
    if (!body || typeof body !== "object" || seen.has(key)) return false; seen.add(key); return true;
  }).sort((a, b) => dateValue(b) - dateValue(a));
}

function reportOpenings(report = {}) {
  return [...arr(report.best_openings), ...arr(report.bestOpenings), ...arr(report.opening_stats), ...arr(report.openingStats), ...arr(report.openings)].filter((row, index, rows) => openingName(row) && rows.findIndex((item) => openingName(item).toLowerCase() === openingName(row).toLowerCase()) === index);
}
function issues(report = {}) {
  return [...arr(report.weak_lines), ...arr(report.weakLines), ...arr(report.problem_lines), ...arr(report.problemLines)].map((row) => ({ name: openingName(row) || row.line || row.variation || "Recurring issue", frequency: games(row), confidence: confidence(row), games: arr(row.gamesList || row.games_list || row.supportingGames || row.supporting_games) }));
}
function health(report = {}) { return num(report.openingFitScore ?? report.opening_fit_score ?? report.repertoireHealth?.score ?? report.repertoire_health?.score); }

export function compareCompletedReports(history = [], activity = []) {
  const reports = orderedCompletedReports(history); if (reports.length < 2) return { available: false, changes: [], resolved: [], newIssues: [], repertoireChanges: [], trainingCompleted: 0 };
  const currentRow = reports[0], previousRow = reports[1], current = payload(currentRow), previous = payload(previousRow);
  const currentByName = new Map(reportOpenings(current).map((row) => [openingName(row).toLowerCase(), row]));
  const previousByName = new Map(reportOpenings(previous).map((row) => [openingName(row).toLowerCase(), row]));
  const changes = [];
  for (const [key, row] of currentByName) { const before = previousByName.get(key); if (!before) continue; const delta = score(row) !== null && score(before) !== null ? score(row) - score(before) : null; const confidenceChanged = confidence(row) !== confidence(before); if (delta || confidenceChanged) changes.push({ name: openingName(row), fitDelta: delta, confidenceBefore: confidence(before), confidenceNow: confidence(row) }); }
  const currentIssues = issues(current), previousIssues = issues(previous), currentIssueMap = new Map(currentIssues.map((item) => [item.name.toLowerCase(), item]));
  const resolved = previousIssues.filter((old) => old.frequency >= 3 && currentIssueMap.has(old.name.toLowerCase()) && currentIssueMap.get(old.name.toLowerCase()).frequency <= Math.max(1, Math.floor(old.frequency / 2)) && /high|medium/i.test(currentIssueMap.get(old.name.toLowerCase()).confidence)).map((old) => ({ ...old, recentFrequency: currentIssueMap.get(old.name.toLowerCase()).frequency, currentConfidence: currentIssueMap.get(old.name.toLowerCase()).confidence, supportingGames: currentIssueMap.get(old.name.toLowerCase()).games }));
  const newIssues = currentIssues.filter((item) => !previousIssues.some((old) => old.name.toLowerCase() === item.name.toLowerCase()));
  const repertoireChanges = [...currentByName.keys()].filter((key) => !previousByName.has(key)).map((key) => ({ type: "added signal", opening: openingName(currentByName.get(key)) }));
  const from = dateValue(previousRow), to = dateValue(currentRow); const trainingCompleted = arr(activity).filter((row) => /training.*completed|weakest_line_training_completed/.test(String(row.type || row.action_type || "")) && dateValue(row) > from && dateValue(row) <= to).length;
  const currentHealth = health(current), previousHealth = health(previous);
  return { available: true, currentDate: dateValue(currentRow), previousDate: dateValue(previousRow), health: { current: currentHealth, previous: previousHealth, delta: currentHealth !== null && previousHealth !== null ? currentHealth - previousHealth : null }, changes, resolved, newIssues, repertoireChanges, trainingCompleted };
}

export function buildReturningProgress({ user = null, currentReport = null, reportHistory = [], activity = [], repertoire = null, now = new Date() } = {}) {
  const reports = orderedCompletedReports(reportHistory); const latest = currentReport || payload(reports[0] || {}); const comparison = compareCompletedReports(reportHistory, activity);
  const lastDate = reports[0] ? dateValue(reports[0]) : dateValue(latest); const daysOld = lastDate ? Math.floor((now.getTime() - lastDate) / 86400000) : null;
  const explicitNewGames = num(latest?.newEligibleGames ?? latest?.new_eligible_games);
  const training = arr(activity).filter((row) => /training.*completed|weakest_line_training_completed/.test(String(row.type || row.action_type || ""))).sort((a, b) => dateValue(b) - dateValue(a));
  const repertoireItems = arr(repertoire?.items); const issue = issues(latest)[0] || repertoireItems.find((item) => item.status === "Repair");
  const shouldReanalyse = (explicitNewGames !== null && explicitNewGames >= 5) || (daysOld !== null && daysOld >= 14) || training.length >= 3;
  return { isAuthenticated: Boolean(user?.id), isReturning: Boolean(user?.id && reports.length), reportCount: reports.length, latest, lastDate, daysOld, newGames: explicitNewGames, newGamesReliable: explicitNewGames !== null, issue, nextTraining: issue?.name || issue?.opening || repertoireItems.find((item) => item.status === "Learning")?.name || "Continue your current repertoire line", recentImprovement: comparison.changes.find((item) => (item.fitDelta || 0) > 0) || null, comparison, training, shouldReanalyse, health: health(latest), coverage: `${new Set(repertoireItems.filter((item) => !["Paused", "Avoided"].includes(item.status)).map((item) => item.section)).size} repertoire areas represented` };
}
