import "./OpeningCoachSummary.css";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function openingName(value, fallback = "Your repertoire") {
  if (typeof value === "string") return value || fallback;
  return value?.openingName || value?.name || value?.opening || fallback;
}

function readOpeningName(value) {
  return openingName(value, "");
}

function firstReportOpening(data, keys) {
  for (const key of keys) {
    const row = asArray(data?.[key]).find(Boolean);
    if (row) return row;
  }
  return null;
}

function buildFallbackInsights(data = {}) {
  data = data || {};
  const best = firstReportOpening(data, ["bestOpenings", "best_openings", "topOpenings", "top_openings"]);
  const games = numberValue(data.gamesAnalysed ?? data.gamesAnalyzed ?? data.gamesImported ?? data.totalGames, 0);
  const bestName = openingName(best, "Your main opening");

  return {
    analysedGameCount: games,
    confidence: {
      label: games >= 12 ? "high" : games >= 5 ? "medium" : "low",
      reason: games
        ? "This older report does not include the newer coach insight breakdown, so OpeningFit is showing the safest available summary."
        : "This report has limited game-count detail.",
      sampleSize: games,
    },
    headline: {
      title: `${bestName} is your clearest current signal`,
      summary: "This saved report predates the richer coach insights, so use the opening table for the detailed evidence.",
      primaryAction: `Review one recent ${bestName} game and note where the position first felt unclear.`,
    },
    strongestWeapon: best
      ? {
          openingName: bestName,
          games: numberValue(best.games ?? best.gamesPlayed ?? best.games_played, 0),
          score: numberValue(best.fitScore ?? best.score ?? best.winRate, null),
          action: `Keep ${bestName} as the reference point while you compare weaker lines.`,
        }
      : null,
    biggestLeak: {
      openingName: null,
      issueType: "insufficient_data",
      title: "No specific leak saved",
      action: "Open the breakdown to review the available opening evidence.",
      evidence: ["Older report format"],
      games: 0,
    },
    focusMission: {
      title: best ? `Check ${bestName} this week` : "Build a bigger sample",
      openingName: best ? bestName : null,
      practiceGoal: best
        ? `Practise the first plan you commonly reach in ${bestName}.`
        : "Import more games before making opening changes.",
      successMetric: "After your next import, compare whether this signal is still present.",
    },
    openingDiagnostics: [],
  };
}

function getCoachInsights(data) {
  const insights = data?.openingCoachInsights || data?.opening_coach_insights;
  return insights && typeof insights === "object" ? insights : buildFallbackInsights(data);
}

function compactScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Current signal";
  return `${Math.round(number)}/100`;
}

function evidenceLine(insights) {
  const count = numberValue(insights.analysedGameCount ?? insights.confidence?.sampleSize, 0);
  const confidence = titleCase(insights.confidence?.label || "low");
  return `Based on ${count} analysed game${count === 1 ? "" : "s"} - ${confidence} confidence`;
}

function issueCopy(issueType) {
  if (issueType === "opening") return "Opening phase issue";
  if (issueType === "transition") return "Transition issue";
  if (issueType === "middlegame") return "Later-game issue";
  if (issueType === "mixed") return "Mixed issue";
  return "Evidence building";
}

export default function OpeningCoachSummary({ data, onStartPractice, onOpenBreakdown, onAnalytics }) {
  if (!data) return null;

  const insights = getCoachInsights(data);
  const strongest = asObject(insights.strongestWeapon);
  const leak = asObject(insights.biggestLeak);
  const mission = asObject(insights.focusMission);
  const headline = asObject(insights.headline);
  const strongestName = readOpeningName(strongest);
  const leakName = readOpeningName(leak);
  const missionName = readOpeningName(mission);
  const focusName = missionName || leakName || strongestName || "";
  const diagnostics = asArray(insights.openingDiagnostics);

  const tiles = [
    {
      label: "Strongest weapon",
      title: strongestName || "Still emerging",
      meta: strongestName
        ? `${strongest.games || "Some"} game${Number(strongest.games) === 1 ? "" : "s"} - ${compactScore(strongest.score)}`
        : "More games needed",
    },
    {
      label: "Biggest leak",
      title: leakName || "No reliable leak yet",
      meta: leak.issueType ? `${issueCopy(leak.issueType)}${leak.games ? ` - ${leak.games} games` : ""}` : "Not enough repeated evidence",
    },
    {
      label: "This week's focus",
      title: mission.title || "Build a bigger sample",
      meta: mission.successMetric || mission.practiceGoal || "Keep the next set of games focused.",
    },
  ];

  return (
    <section className="openingCoachSummary" aria-labelledby="opening-coach-summary-title">
      <div className="openingCoachSummaryMain">
        <p className="eyebrow">Personal coach verdict</p>
        <h2 id="opening-coach-summary-title">
          {headline.title || "Your opening plan is ready"}
        </h2>
        <p>{headline.summary || mission.practiceGoal || "OpeningFit has found the clearest current training signal from your report."}</p>

        <div className="openingCoachTiles" aria-label="Opening coach highlights">
          {tiles.map((tile) => (
            <div className="openingCoachTile" key={tile.label}>
              <span>{tile.label}</span>
              <strong>{tile.title}</strong>
              <small>{tile.meta}</small>
            </div>
          ))}
        </div>
      </div>

      <aside className="openingCoachSummarySide" aria-label="Coach evidence and actions">
        <details className="openingCoachEvidence">
          <summary>
            <span>{evidenceLine(insights)}</span>
          </summary>
          <div>
            <p>{insights.confidence?.reason || "Confidence is based on the available opening sample size."}</p>
            {headline.primaryAction ? <p>{headline.primaryAction}</p> : null}
            {diagnostics.length ? (
              <ul>
                {diagnostics.slice(0, 3).map((item) => (
                  <li key={item.openingName || item.recommendation}>
                    <strong>{item.openingName || "Opening"}</strong>: {item.explanation || item.recommendation}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>

        <div className="openingCoachActions">
          <button
            type="button"
            className="primaryBtn"
            onClick={() => {
              onAnalytics?.("coach_practice_started", { opening: focusName || null, source: "coach_summary" });
              if (focusName) {
                onStartPractice?.(focusName);
              } else {
                onOpenBreakdown?.();
              }
            }}
          >
            Start this week's practice
          </button>
          <button
            type="button"
            className="secondaryBtn"
            onClick={() => {
              onAnalytics?.("coach_diagnostic_opened", { source: "coach_summary" });
              onOpenBreakdown?.();
            }}
          >
            See opening breakdown
          </button>
        </div>
      </aside>
    </section>
  );
}
