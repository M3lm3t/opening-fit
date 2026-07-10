import { buildOpeningHealthSnapshot } from "./openingHealth";
import { buildRepertoireMap } from "./repertoireStatus";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  if (!Number.isFinite(number)) return fallback;
  return number >= 0 && number <= 1 ? Math.round(number * 100) : Math.round(number);
}

function openingName(item, fallback = "your main opening") {
  if (typeof item === "string") return item;
  return (
    item?.name ||
    item?.opening ||
    item?.openingName ||
    item?.opening_name ||
    item?.ecoName ||
    item?.eco_name ||
    fallback
  );
}

function reportFromRow(row = {}) {
  return row.report || row.data || row.last_report || row.summary?.report || row.summary || row.snapshot || row;
}

function dateFromRow(row = {}) {
  const report = reportFromRow(row);
  const raw =
    row.created_at ||
    row.createdAt ||
    row.updated_at ||
    row.updatedAt ||
    report.reportDate ||
    report.importedAt ||
    report.imported_at ||
    report.lastUpdated ||
    report.last_updated ||
    "";
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function scoreFromReport(report = {}) {
  return numberValue(
    report.openingFitScore ??
      report.opening_fit_score ??
      report.opening_fit_score_v2 ??
      report.openingHealthScore ??
      report.opening_health_score ??
      report.openingHealth?.score ??
      report.opening_health?.score ??
      report.score,
    null
  );
}

function gameCount(data = {}) {
  data = data || {};
  return numberValue(
    data.gamesImported ??
      data.games_imported ??
      data.gamesAnalysed ??
      data.gamesAnalyzed ??
      data.games_analyzed ??
      data.totalGames ??
      data.total_games,
    0
  );
}

function scoreLabel(score) {
  if (score === null || score === undefined) return "Building";
  if (score >= 85) return "Excellent";
  if (score >= 72) return "Strong";
  if (score >= 58) return "Stable";
  if (score >= 42) return "Developing";
  return "Building";
}

function statusForScore(score) {
  if (score === null || score === undefined) return "Needs data";
  if (score >= 72) return "Strong";
  if (score >= 58) return "Stable";
  if (score >= 42) return "Developing";
  return "Needs attention";
}

function trendFor(delta, historyCount) {
  if (historyCount < 2 || delta === null || delta === undefined) return "Not enough history yet";
  if (delta >= 3) return "Improving";
  if (delta <= -3) return "Needs attention";
  return "Holding steady";
}

function collectOpenings(data = {}) {
  data = data || {};
  return [
    ...asArray(data.best_openings),
    ...asArray(data.bestOpenings),
    ...asArray(data.top_openings),
    ...asArray(data.topOpenings),
    ...asArray(data.opening_stats),
    ...asArray(data.openingStats),
    ...asArray(data.preferred_white),
    ...asArray(data.preferredWhite),
    ...asArray(data.preferred_black),
    ...asArray(data.preferredBlack),
  ].filter((item) => openingName(item, "") && !/unknown|unclassified/i.test(openingName(item, "")));
}

function scoreOpening(item = {}) {
  return numberValue(
    item.fitScore ??
      item.fit_score ??
      item.openingFitScore ??
      item.opening_fit_score ??
      item.score ??
      item.winRate ??
      item.win_rate,
    null
  );
}

function openingGames(item = {}) {
  return numberValue(item.games ?? item.count ?? item.total ?? item.games_played ?? item.gamesPlayed, 0);
}

function getHistoryPoints(reportHistory = [], currentScore = null) {
  const points = asArray(reportHistory)
    .map((row, index) => {
      const report = reportFromRow(row);
      return {
        date: dateFromRow(row),
        score: scoreFromReport(report),
        report,
        index,
      };
    })
    .filter((point) => point.score !== null || point.date)
    .sort((a, b) => {
      const aTime = Date.parse(a.date);
      const bTime = Date.parse(b.date);
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
      return a.index - b.index;
    });

  if (currentScore !== null && currentScore !== undefined) {
    const last = points[points.length - 1];
    if (!last || last.score !== currentScore) {
      points.push({ date: new Date().toISOString(), score: currentScore, report: null, index: points.length });
    }
  }

  return points.filter((point) => point.score !== null);
}

function actionForFactor(key) {
  const routes = {
    repertoire: "repertoire",
    consistency: "training",
    survival: "weakspots",
    results: "report",
    white: "repertoire",
    black: "repertoire",
    mistakes: "training",
    rotation: "repertoire",
  };
  return routes[key] || "report";
}

function buildFactors({ data, health, repertoireMap, openings }) {
  const factors = [];
  const weakOpenings = openings.filter((item) => {
    const score = scoreOpening(item);
    return score !== null && score < 45 && openingGames(item) >= 3;
  });
  const strongOpenings = openings.filter((item) => {
    const score = scoreOpening(item);
    return score !== null && score >= 62 && openingGames(item) >= 3;
  });
  const weakLines = [
    ...asArray(data.weakLines),
    ...asArray(data.weak_lines),
    ...asArray(data.recurringWeakLines),
    ...asArray(data.recurring_weak_lines),
  ];

  factors.push({
    key: "repertoire",
    title: "Repertoire focus",
    status: repertoireMap.focusLabel || "Still building",
    text: repertoireMap.overview || "OpeningFit is still mapping your White and Black choices.",
    action: actionForFactor("repertoire"),
  });

  factors.push({
    key: "consistency",
    title: "Opening consistency",
    status: statusForScore(health.factors?.consistency),
    text:
      health.factors?.consistency >= 60
        ? "Your repeated openings are producing a more stable shape."
        : "Your openings still vary enough that the score needs more repeatable positions.",
    action: actionForFactor("consistency"),
  });

  if (health.breakdown?.recentForm !== undefined) {
    factors.push({
      key: "results",
      title: "Results in main openings",
      status: statusForScore(health.breakdown.recentForm),
      text:
        strongOpenings.length
          ? `${openingName(strongOpenings[0])} is helping the score because it has a stronger current signal.`
          : "Your main-opening results are still looking for one clearly positive anchor.",
      action: actionForFactor("results"),
    });
  }

  if (weakLines.length || weakOpenings.length) {
    factors.push({
      key: "mistakes",
      title: "Recurring mistakes",
      status: weakLines.length || weakOpenings.length >= 2 ? "Needs attention" : "Developing",
      text:
        weakLines.length
          ? "Recurring opening problems are still showing up in the analysed games."
          : `${openingName(weakOpenings[0])} is dragging the score because the current sample is less stable.`,
      action: actionForFactor("mistakes"),
    });
  }

  if (repertoireMap.sections?.white?.length) {
    factors.push({
      key: "white",
      title: "Coverage as White",
      status: repertoireMap.sections.white.length <= 2 ? "Focused" : "Spread out",
      text:
        repertoireMap.sections.white.length <= 2
          ? "Your White repertoire has a compact enough shape to improve."
          : "Your White games are spread across several systems, which makes progress harder to measure.",
      action: actionForFactor("white"),
    });
  }

  if ((repertoireMap.sections?.blackE4?.length || 0) + (repertoireMap.sections?.blackD4?.length || 0)) {
    factors.push({
      key: "black",
      title: "Coverage as Black",
      status:
        repertoireMap.sections.blackE4.length && repertoireMap.sections.blackD4.length
          ? "Covered"
          : "Incomplete",
      text:
        repertoireMap.sections.blackE4.length && repertoireMap.sections.blackD4.length
          ? "OpeningFit can see Black repertoire coverage against both main first-move families."
          : "One Black repertoire area still needs clearer evidence before the score is confident.",
      action: actionForFactor("black"),
    });
  }

  return factors.slice(0, 4);
}

function buildTimeline({ data, historyPoints, openingFitUserState }) {
  const rows = [];
  if (historyPoints[0]) {
    rows.push({
      type: "report",
      title: "First report created",
      detail: `${historyPoints[0].score}/100 opening score recorded.`,
      date: historyPoints[0].date,
    });
  }

  historyPoints.slice(1).forEach((point, index) => {
    const previous = historyPoints[index];
    const delta = previous ? point.score - previous.score : null;
    rows.push({
      type: "score",
      title: delta > 0 ? "Score improved" : delta < 0 ? "New analysis completed" : "Score held steady",
      detail:
        delta === null
          ? `${point.score}/100 recorded.`
          : `${point.score}/100 (${delta > 0 ? "+" : ""}${delta} from previous report).`,
      date: point.date,
    });
  });

  const trainingRows = asArray(openingFitUserState)
    .filter((row) => /practice|training|mission|drill/i.test(String(row.type || row.activity_type || row.event_type || "")))
    .slice(0, 2);
  trainingRows.forEach((row) => {
    rows.push({
      type: "training",
      title: "Training completed",
      detail: row.opening ? `Practice recorded for ${row.opening}.` : "Opening practice activity recorded.",
      date: row.created_at || row.createdAt || row.completedAt || "",
    });
  });

  const openings = collectOpenings(data);
  const best = openings
    .filter((item) => scoreOpening(item) !== null)
    .sort((a, b) => (scoreOpening(b) || 0) - (scoreOpening(a) || 0))[0];
  if (best) {
    rows.push({
      type: "milestone",
      title: "Opening strength identified",
      detail: `${openingName(best)} is currently your strongest tracked opening signal.`,
      date: new Date().toISOString(),
    });
  }

  return rows
    .filter((row) => row.title)
    .sort((a, b) => {
      const aTime = Date.parse(a.date);
      const bTime = Date.parse(b.date);
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
      return 0;
    })
    .slice(0, 6);
}

function buildMilestones({ data, delta, repertoireMap, openings }) {
  const games = gameCount(data);
  const best = openings
    .filter((item) => scoreOpening(item) !== null)
    .sort((a, b) => (scoreOpening(b) || 0) - (scoreOpening(a) || 0))[0];
  const mainTen = openings.find((item) => openingGames(item) >= 10);
  const milestones = [
    {
      title: "First repertoire mapped",
      done: repertoireMap.totalOpenings > 0,
      text: repertoireMap.totalOpenings > 0
        ? "OpeningFit can now see at least one repertoire signal."
        : "Analyse enough games to detect your first repertoire signal.",
    },
    {
      title: "Your first opening strength identified",
      done: Boolean(best),
      text: best ? `${openingName(best)} is your current strength.` : "A strength appears once an opening repeats with enough score data.",
    },
    {
      title: "10 games in your main opening",
      done: Boolean(mainTen),
      text: mainTen ? `${openingName(mainTen)} has ${openingGames(mainTen)} analysed games.` : "Keep one main opening stable long enough to reach 10 games.",
    },
    {
      title: "Opening score improved",
      done: Number(delta) > 0,
      text: Number(delta) > 0 ? `Your score is up ${delta} point${delta === 1 ? "" : "s"}.` : "This appears after a later report beats the previous score.",
    },
    {
      title: "Repertoire becoming more focused",
      done: ["Focused", "Mostly focused"].includes(repertoireMap.focusLabel),
      text: ["Focused", "Mostly focused"].includes(repertoireMap.focusLabel)
        ? "Your repertoire has a clearer shape now."
        : "Choose one main White system and one main Black defence before expanding.",
    },
    {
      title: "Opening sample is usable",
      done: games >= 10,
      text: games >= 10 ? `${games} games gives OpeningFit a useful current sample.` : "Analyse at least 10 games for a sturdier score.",
    },
  ];
  return milestones;
}

export function buildOpeningScorePresentation({ data = {}, fitData = null, reportHistory = [], openingFitUserState = [] } = {}) {
  const hasLiveData = Boolean(data && Object.keys(data).length);
  const health = hasLiveData ? buildOpeningHealthSnapshot(data || {}, fitData, reportHistory) : null;
  const savedHistoryPoints = getHistoryPoints(reportHistory, null);
  const savedLatestScore = savedHistoryPoints[savedHistoryPoints.length - 1]?.score ?? null;
  const score = scoreFromReport(data) ?? (hasLiveData ? scoreFromReport({ openingHealth: health }) ?? health.score : savedLatestScore);
  const historyPoints = getHistoryPoints(reportHistory, score);
  const previous = historyPoints.length >= 2 ? historyPoints[historyPoints.length - 2] : null;
  const delta = previous && score !== null ? score - previous.score : null;
  const repertoireMap = buildRepertoireMap(data || {});
  const openings = collectOpenings(data || {});
  const factors = health ? buildFactors({ data: data || {}, health, repertoireMap, openings }) : [];
  const timeline = buildTimeline({ data: data || {}, historyPoints, openingFitUserState });
  const milestones = buildMilestones({ data: data || {}, delta, repertoireMap, openings });
  const improved = openings
    .filter((item) => scoreOpening(item) !== null)
    .sort((a, b) => (scoreOpening(b) || 0) - (scoreOpening(a) || 0))[0];
  const focus = factors.find((factor) => /attention|Incomplete|Spread|Building|Developing/i.test(factor.status)) || factors[0];

  return {
    score,
    label: scoreLabel(score),
    delta,
    trend: trendFor(delta, historyPoints.length),
    factors,
    timeline,
    milestones,
    recap: {
      scoreMovement: delta === null ? "New report" : `${delta > 0 ? "+" : ""}${delta}`,
      mostImprovedOpening: improved ? openingName(improved) : "More data needed",
      biggestFocus: focus?.title || "Build a repeat sample",
      gamesAnalysed: gameCount(data || {}),
      verdict:
        score !== null
          ? `Your OpeningFit Score is ${score}/100 and currently ${trendFor(delta, historyPoints.length).toLowerCase()}.`
          : "Your OpeningFit progress story starts after the next analysis.",
    },
    hasHistory: historyPoints.length >= 2,
  };
}
