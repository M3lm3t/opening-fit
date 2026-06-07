import {
  canGiveAvoidVerdict,
  getPlayerLevelText,
  getSmartPlayerLevelProfile,
  isAdvancedOrStrongerLevel,
  isMasterLevel,
} from "./playerLevelLogic";
import OpeningEvidenceBlock, { getOpeningConfidence, getOpeningContext, getOpeningSignal } from "./OpeningEvidence";

function normaliseOpeningName(opening) {
  if (!opening) return "Unknown opening";

  if (typeof opening === "string") return opening;

  return (
    opening.name ||
    opening.opening ||
    opening.eco ||
    opening.label ||
    "Unknown opening"
  );
}

function getGames(opening) {
  return Number(
    opening?.games ??
      opening?.count ??
      opening?.total ??
      opening?.played ??
      0
  );
}

function getWinRate(opening) {
  const direct = opening?.winRate ?? opening?.win_rate ?? opening?.score ?? opening?.percentage;

  if (direct !== undefined && direct !== null && !Number.isNaN(Number(direct))) {
    const value = Number(direct);
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
  }

  const wins = Number(opening?.wins ?? opening?.won ?? 0);
  const draws = Number(opening?.draws ?? opening?.drawn ?? 0);
  const games = getGames(opening);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function getConfidenceLabel(opening) {
  const explicit =
    opening?.confidenceLabel ||
    opening?.confidence_label ||
    opening?.confidence;

  if (explicit) return getOpeningConfidence({ ...opening, confidence: explicit });

  return getOpeningConfidence(opening);
}

function getComparisonText(opening, data) {
  if (opening?.comparisonText || opening?.comparison_text) {
    return opening.comparisonText || opening.comparison_text;
  }

  const average = Number(data?.averageOpeningScore ?? data?.average_opening_score);
  const winRate = getWinRate(opening);

  if (!average || !winRate) return "Average comparison unavailable.";

  const delta = Math.round((winRate - average) * 10) / 10;

  if (delta > 0) return `${delta} points above your imported-game average.`;
  if (delta < 0) return `${Math.abs(delta)} points below your imported-game average.`;
  return "Matches your imported-game average.";
}

function getReason(opening, data) {
  if (opening?.verdictReason || opening?.verdict_reason) {
    return opening.verdictReason || opening.verdict_reason;
  }

  const games = getGames(opening);
  const confidence = getConfidenceLabel(opening).toLowerCase();

  if (games <= 2) return "This opening appears only once or twice, so the result is too noisy to judge.";
  if (confidence.includes("too little")) return "The sample is too small to judge properly yet.";
  if (confidence.includes("low")) return "The sample is still modest, so treat this as a provisional pattern.";
  return getComparisonText(opening, data);
}

function getRecommendedAction(data, focusOpening) {
  const existing = data?.recommendedAction || data?.recommended_action || data?.nextAction || data?.next_action;
  if (typeof existing === "string" && existing.trim()) return existing.trim();

  if (focusOpening) return `Train this line: ${focusOpening}.`;

  return "Play 5 games, then run a fresh analysis.";
}

function getNextTrainingActions(data, fallbackAction) {
  const raw =
    data?.nextTrainingActions ||
    data?.next_training_actions ||
    data?.trainingPlan ||
    data?.training_plan ||
    [];
  const actions = Array.isArray(raw) ? raw : [];
  const cleaned = actions
    .map((action) => String(action || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  const fallback = [
    fallbackAction,
    "Review one repeated weak line before changing openings.",
    "Re-import after 5 more games to confirm the pattern.",
  ];

  for (const action of fallback) {
    if (cleaned.length >= 3) break;
    if (action && !cleaned.includes(action)) cleaned.push(action);
  }

  return cleaned.slice(0, 3);
}

function getStudyQueue(data) {
  const raw = data?.studyQueue || data?.study_queue || [];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((task) => ({
      title: String(task?.title || "").trim(),
      why: String(task?.whyItMatters || task?.why_it_matters || task?.why || "").trim(),
      action: String(task?.recommendedAction || task?.recommended_action || task?.action || "").trim(),
      priority: String(task?.priority || "medium").trim().toLowerCase(),
      opening: String(task?.relatedOpening || task?.related_opening || "").trim(),
      colour: String(task?.colour || task?.color || "").trim(),
    }))
    .filter((task) => task.title && task.why && task.action)
    .slice(0, 5);
}

function getProblemLines(data) {
  const lines = data?.problemLines || data?.problem_lines || [];
  return Array.isArray(lines) ? lines.slice(0, 3) : [];
}

function getOpeningPhaseHabits(data) {
  const habits = data?.openingPhaseHabits || data?.opening_phase_habits || [];
  return Array.isArray(habits) ? habits.slice(0, 4) : [];
}

function getCoverageRows(data) {
  const coverage = data?.repertoireCoverage || data?.repertoire_coverage || {};
  const white = Array.isArray(coverage.white) ? coverage.white : [];
  const black = Array.isArray(coverage.black) ? coverage.black : [];
  return { white, black };
}

function getOpponentResponseReport(data) {
  return data?.opponentResponseReport || data?.opponent_response_report || null;
}

function getStyleOpeningMatch(data) {
  return data?.styleOpeningMatch || data?.style_opening_match || null;
}

function getRepertoireCoherence(data) {
  return data?.repertoireCoherence || data?.repertoire_coherence || null;
}

function getProgressComparison(data) {
  const comparison = data?.progressComparison || data?.progress_comparison || null;
  if (!comparison || comparison.enabled === false || comparison.available === false) return null;
  const items = Array.isArray(comparison.items) ? comparison.items.filter((item) => item?.copy || item?.title).slice(0, 6) : [];
  if (!items.length) return null;
  return { ...comparison, items };
}

function collectOpenings(data) {
  const candidates = [
    data?.topOpenings,
    data?.top_openings,
    data?.openingStats,
    data?.opening_stats,
    data?.openings,
    data?.openingTable,
    data?.opening_table,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
    if (item && typeof item === "object") return Object.values(item);
  }

  return [];
}

function getPlayerTier(data) {
  const rating = Number(
    data?.rating ??
      data?.chesscomRating ??
      data?.chesscom_rating ??
      data?.lichessRating ??
      data?.lichess_rating ??
      data?.rapidRating ??
      data?.rapid_rating ??
      data?.blitzRating ??
      data?.blitz_rating ??
      data?.bulletRating ??
      data?.bullet_rating ??
      data?.player_level?.rating ??
      data?.playerLevel?.rating ??
      0
  );
  const level = getPlayerLevelText(data).toLowerCase();
  const title = String(
    data?.title ??
      data?.chessTitle ??
      data?.chess_title ??
      data?.fideTitle ??
      data?.fide_title ??
      data?.playerTitle ??
      data?.player_title ??
      data?.profile?.title ??
      ""
  )
    .trim()
    .toLowerCase();
  const titledPlayer = ["gm", "im", "fm", "cm", "wgm", "wim", "wfm", "wcm"].includes(title);

  if (rating >= 2400 || titledPlayer || level.includes("master") || level.includes("elite")) {
    return "elite";
  }

  if (rating >= 2200 || level.includes("expert")) return "strong";
  if (rating >= 1800 || level.includes("advanced")) return "club";
  return "developing";
}

function getSampleTier(games) {
  const count = Number(games || 0);
  if (count >= 20) return "large";
  if (count >= 8) return "medium";
  if (count >= 3) return "low";
  if (count >= 1) return "tiny";
  return "none";
}

function getVerdict(opening, data, index = 0) {
  const existing = opening?.fitVerdict || opening?.fit_verdict || opening?.verdict || opening?.recommendation || opening?.status;
  const tier = getPlayerTier(data);
  const games = getGames(opening);
  const winRate = getWinRate(opening);
  const sampleTier = getSampleTier(games);
  const signal = getOpeningSignal(opening);
  const mainOpening = index <= 2 && signal.tier === "strong";

  if (games <= 2 || signal.badge === "Too little data") return `Experiment — ${getConfidenceLabel(opening)}`;
  if (games <= 7 || signal.badge === "Low confidence") return `Experiment — ${getConfidenceLabel(opening)}`;

  if (existing) {
    const lower = String(existing).toLowerCase();

    if (lower.includes("experiment")) {
      return `Experiment — ${getConfidenceLabel(opening)}`;
    }

    if (
      lower.includes("too little data") ||
      lower.includes("emerging pattern") ||
      lower.includes("needs more games")
    ) {
      return String(existing);
    }

    if (lower.includes("keep") || lower.includes("core weapon") || lower.includes("trusted weapon")) {
      return `Keep — ${getConfidenceLabel(opening)}`;
    }

    if (lower.includes("fix") || lower.includes("improve") || lower.includes("fine-tune")) {
      return `Fix — ${getConfidenceLabel(opening)}`;
    }
    if (lower.includes("replace") || lower.includes("avoid")) {
      return `Replace — ${getConfidenceLabel(opening)}`;
    }
    if (lower.includes("review")) {
      return `Fix — ${getConfidenceLabel(opening)}`;
    }

    return `Interesting signal — ${getConfidenceLabel(opening)}`;
  }

  if (tier === "elite") {
    if (mainOpening && winRate >= 45) return `Keep — ${getConfidenceLabel(opening)}`;
    if (mainOpening) return `Fix — ${getConfidenceLabel(opening)}`;
    if (sampleTier === "large" && winRate < 25) return `Replace — ${getConfidenceLabel(opening)}`;
    if (winRate < 45) return `Fix — ${getConfidenceLabel(opening)}`;
    return `Keep — ${getConfidenceLabel(opening)}`;
  }

  if (tier === "strong") {
    if (mainOpening && winRate >= 45) return `Keep — ${getConfidenceLabel(opening)}`;
    if (mainOpening && winRate >= 35) return `Fix — ${getConfidenceLabel(opening)}`;
    if (winRate < 40) return `Replace — ${getConfidenceLabel(opening)}`;
    return `Keep — ${getConfidenceLabel(opening)}`;
  }

  if (winRate >= 58) return `Keep — ${getConfidenceLabel(opening)}`;
  return `Fix — ${getConfidenceLabel(opening)}`;
}

function isStrongProfile(data) {
  const tier = getPlayerTier(data);
  return tier === "elite" || tier === "strong";
}

function getVerdictClass(verdict) {
  const lower = verdict.toLowerCase();

  if (lower.includes("keep")) return "reportVerdictKeep";
  if (lower.includes("core") || lower.includes("trusted")) return "reportVerdictKeep";
  if (lower.includes("replace") || lower.includes("avoid")) return "reportVerdictAvoid";
  if (
    lower.includes("fix") ||
    lower.includes("improve") ||
    lower.includes("review") ||
    lower.includes("fine") ||
    lower.includes("performance")
  ) {
    return "reportVerdictImprove";
  }

  return "reportVerdictWatch";
}

function getStyleLabel(data) {
  const label =
    data?.styleProfile?.label ||
    data?.style_profile?.label ||
    data?.styleLabel ||
    data?.style_label ||
    data?.playerStyle ||
    data?.player_style;

  if (label) return label;

  return "Practical attacker";
}

function getTotalGames(data, openings) {
  const direct =
    data?.gamesImported ??
    data?.games_imported ??
    data?.totalGames ??
    data?.total_games ??
    data?.games?.length;

  if (direct) return Number(direct);

  const openingTotal = openings.reduce((sum, opening) => sum + getGames(opening), 0);

  return openingTotal || 0;
}

function buildReportCards(openings, data) {
  const level = getSmartPlayerLevelProfile(data).level;
  const avoidAllowedFor = (opening) =>
    canGiveAvoidVerdict({
      level,
      games: opening.games,
      score: opening.winRate,
    });
  const cleaned = openings
    .map((opening) => ({
      raw: opening,
      name: normaliseOpeningName(opening),
      games: getGames(opening),
      winRate: getWinRate(opening),
    }))
    .filter((opening) => {
      const name = opening.name.toLowerCase();
      return (
        opening.games > 0 &&
        !["unknown", "unknown opening", "uncommon opening"].includes(name)
      );
    })
    .sort((a, b) => b.games - a.games)
    .map((opening, index) => ({
      ...opening,
      verdict: getVerdict(opening.raw, data, index),
      confidenceLabel: getConfidenceLabel(opening.raw),
      comparisonText: getComparisonText(opening.raw, data),
      reason: getReason(opening.raw, data),
    }));

  const keep =
    cleaned
      .filter((opening) => opening.winRate >= 58 && getOpeningSignal(opening.raw).canBePrimary)
      .sort((a, b) => b.winRate - a.winRate)[0] || cleaned[0];

  const improve =
    cleaned
      .filter((opening) => opening.winRate >= 42 && opening.winRate < 58 && getOpeningSignal(opening.raw).canBePrimary)
      .sort((a, b) => b.games - a.games)[0] || cleaned[1];

  const avoid =
    cleaned
      .filter((opening) => {
        const signal = getOpeningSignal(opening.raw);
        if (!signal.canBePrimary) return false;
        if (isMasterLevel(level)) return opening.winRate < 35 && opening.games >= 10;
        if (isAdvancedOrStrongerLevel(level)) return opening.winRate < 40 && opening.games >= 8;
        return opening.winRate < 42 && (avoidAllowedFor(opening) || signal.canBeFirm);
      })
      .sort((a, b) => a.winRate - b.winRate)[0] || cleaned[2];

  return { keep, improve, avoid, cleaned };
}

export default function OpeningReportSummary({ data, username, platform }) {
  if (!data) return null;

  const openings = collectOpenings(data);
  const totalGames = getTotalGames(data, openings);
  const styleLabel = getStyleLabel(data);
  const { keep, improve, avoid, cleaned } = buildReportCards(openings, data);
  const strongProfile = isStrongProfile(data);

  const platformLabel =
    platform === "lichess"
      ? "Lichess"
      : platform === "chesscom"
        ? "Chess.com"
        : "Chess profile";

  const bestOpening = keep?.name || "your strongest repeated opening";
  const weakOpening = avoid?.name || "your lowest-scoring repeated opening";
  const focusOpening = improve?.name || bestOpening;
  const recommendedAction = getRecommendedAction(data, focusOpening);
  const nextTrainingActions = getNextTrainingActions(data, recommendedAction);
  const studyQueue = getStudyQueue(data);
  const problemLines = getProblemLines(data);
  const openingPhaseHabits = getOpeningPhaseHabits(data);
  const coverageRows = getCoverageRows(data);
  const opponentResponseReport = getOpponentResponseReport(data);
  const styleOpeningMatch = getStyleOpeningMatch(data);
  const repertoireCoherence = getRepertoireCoherence(data);
  const progressComparison = getProgressComparison(data);

  return (
    <section className="openingReportShell">
      <div className="openingReportHero">
        <div>
          <p className="openingReportEyebrow">Opening report</p>
          <h2>Your personalised opening summary</h2>
          <p>
            {strongProfile
              ? `Based on ${totalGames || "your recent"} imported games${
                  username ? ` from ${platformLabel} user ${username}` : ""
                }, here is a repertoire audit of core openings and lines worth reviewing.`
              : `Based on ${totalGames || "your recent"} imported games${
                  username ? ` from ${platformLabel} user ${username}` : ""
                }, here is what looks strongest, what needs work, and what to avoid for now.`}
          </p>
        </div>

        <div className="openingReportScore">
          <span>{cleaned.length || "—"}</span>
          <small>tracked openings</small>
        </div>
      </div>

      <div className="openingInsightCard">
        <div className="openingInsightIcon">♟</div>
        <div>
          <h3>{styleLabel}</h3>
          <p>
            {strongProfile ? (
              <>
                Treat <strong>{bestOpening}</strong> as the stable reference point,
                then review <strong>{focusOpening}</strong> for recurring structures
                or move-order details before changing the repertoire.
              </>
            ) : (
              <>
                Your current profile suggests you should focus on openings that create
                clear plans quickly. Keep building around <strong>{bestOpening}</strong>,
                review <strong>{focusOpening}</strong>, and be careful with{" "}
                <strong>{weakOpening}</strong> until the results improve.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="openingReportGrid">
        <ReportCard
          title={keep?.verdict === "Keep" || keep?.verdict === "Reliable choice" || keep?.verdict === "Main weapon" ? "Keep playing" : "Track carefully"}
          opening={keep}
          fallbackTitle="Best repeated opening"
          fallbackText="Once more games are imported, this will show the opening that best fits your current results."
          type="keep"
          data={data}
        />

        <ReportCard
          title={improve?.verdict === "Fix" || improve?.verdict === "Promising but unstable" ? (strongProfile ? "Review next" : "Fix next") : "Build sample"}
          opening={improve}
          fallbackTitle={strongProfile ? "Main review target" : "Main study target"}
          fallbackText={
            strongProfile
              ? "This will highlight a core or recurring opening worth auditing for specific branches."
              : "This will highlight an opening with enough promise to keep, but enough weakness to study."
          }
          type="improve"
          data={data}
        />

        <ReportCard
          title={avoid?.verdict === "Replace" || avoid?.verdict === "Needs review" ? (strongProfile ? "Check carefully" : "Replace candidate") : "Wait before judging"}
          opening={avoid}
          fallbackTitle={strongProfile ? "Trend to inspect" : "Risky opening"}
          fallbackText={
            strongProfile
              ? "This will flag openings where recent results deserve review before any repertoire decision."
              : "This will flag openings that are repeatedly costing you games or producing poor positions."
          }
          type="avoid"
          data={data}
        />
      </div>

      <div className="openingReportNextSteps">
        <div>
          <strong>Next 3 training actions</strong>
          <ol className="openingReportActionList">
            {nextTrainingActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </div>

        <div>
          <strong>Problem lines to study</strong>
          {problemLines.length ? (
            <ul className="openingReportProblemList">
              {problemLines.map((line) => (
                <li key={`${line.opening || line.name}-${line.line}`}>
                  <span>{line.summary || `${line.opening || line.name}: results drop in ${line.line}.`}</span>
                  {Array.isArray(line.evidence) && line.evidence[0] ? <small>{line.evidence[0]}</small> : null}
                </li>
              ))}
            </ul>
          ) : (
            <span>No repeated poor-result line appeared often enough to flag yet.</span>
          )}
        </div>

        <div>
          <strong>Personal study queue</strong>
          {studyQueue.length ? (
            <ul className="openingReportStudyQueue">
              {studyQueue.map((task) => (
                <li key={`${task.title}-${task.opening || task.colour}`}>
                  <span>
                    {task.title}
                    <em>{task.priority}</em>
                  </span>
                  <small>{task.why}</small>
                  <small>{task.action}</small>
                  {task.opening || task.colour ? (
                    <small>{[task.colour, task.opening].filter(Boolean).join(" · ")}</small>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <span>No study queue yet. Import a few more games to create focused tasks.</span>
          )}
        </div>
      </div>

      <div className="openingReportCoverage">
        <CoverageColumn title="White repertoire" rows={coverageRows.white} />
        <CoverageColumn title="Black repertoire" rows={coverageRows.black} />
      </div>

      {repertoireCoherence ? (
        <div className="openingReportCoherence">
          <strong>Repertoire coherence · {repertoireCoherence.status}</strong>
          <span>{repertoireCoherence.summary}</span>
          <ul>
            {(repertoireCoherence.rows || repertoireCoherence.lanes || []).map((row) => (
              <li key={row.key}>
                <span>{row.label}</span>
                <em>{row.status} · {row.score}/100</em>
                <small>{row.summary}</small>
              </li>
            ))}
          </ul>
          <small>{repertoireCoherence.advice}</small>
        </div>
      ) : null}

      {progressComparison ? (
        <div className="openingReportProgress">
          <strong>Progress since last report</strong>
          {progressComparison.summary ? <span>{progressComparison.summary}</span> : null}
          <ul>
            {progressComparison.items.map((item) => (
              <li key={`${item.type || "progress"}-${item.title || item.copy}`}>
                <span>{item.title || "Progress update"}</span>
                <em>{item.status || "changed"}</em>
                <small>{item.copy}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {opponentResponseReport ? (
        <div className="openingReportResponses">
          <ResponseColumn title="White response gaps" report={opponentResponseReport.white} />
          <ResponseColumn title="Black response gaps" report={opponentResponseReport.black} />
        </div>
      ) : null}

      {styleOpeningMatch ? (
        <div className="openingReportStyleFits">
          <strong>Style-fit openings · {styleOpeningMatch.styleLabel || styleOpeningMatch.style_label}</strong>
          <ul>
            {(styleOpeningMatch.sections || []).map((section) => (
              <li key={section.key}>
                <span>{section.title}</span>
                <em>
                  {(section.items || [])
                    .slice(0, 3)
                    .map((item) => `${item.name} (${item.label || item.recommendationType})`)
                    .join(", ")}
                </em>
                {(section.items || [])[0]?.explanation ? <small>{section.items[0].explanation}</small> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="openingReportHabits">
        <strong>Opening-phase habits</strong>
        {openingPhaseHabits.length ? (
          <ul>
            {openingPhaseHabits.map((habit) => (
              <li key={`${habit.opening || habit.name}-${habit.issue}`}>
                <span>{habit.summary || `${habit.opening || habit.name}: ${habit.label}.`}</span>
                {Array.isArray(habit.evidence) && habit.evidence.length ? (
                  <small>{habit.evidence.slice(0, 2).join(" ")}</small>
                ) : (
                  <small>{habit.advice}</small>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <span>No repeated opening-principle issue appeared often enough to flag yet.</span>
        )}
      </div>
    </section>
  );
}

function ResponseColumn({ title, report }) {
  const strongest = report?.strongest;
  const weakest = report?.weakest;
  const noData = Array.isArray(report?.noDataAreas) ? report.noDataAreas : [];

  return (
    <div>
      <strong>{title}</strong>
      <ul>
        <li>
          <span>Strongest</span>
          <em>{strongest ? `${strongest.label} · ${strongest.score}%` : "No stable sample"}</em>
        </li>
        <li>
          <span>Weakest</span>
          <em>{weakest ? `${weakest.label} · ${weakest.score}%` : "No stable sample"}</em>
        </li>
        <li>
          <span>No-data areas</span>
          <em>{noData.length ? noData.map((row) => row.label).join(", ") : "None"}</em>
        </li>
      </ul>
      <small>{report?.studyPriority || "No response-area priority yet."}</small>
    </div>
  );
}

function CoverageColumn({ title, rows }) {
  return (
    <div>
      <strong>{title}</strong>
      <ul>
        {(rows || []).map((row) => (
          <li key={row.key || row.label}>
            <span>{row.label}</span>
            <em>{row.status}</em>
            {row.opening ? <small>{row.opening} · {row.games || 0} games</small> : <small>No stable opening yet</small>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportCard({ title, opening, fallbackTitle, fallbackText, type, data }) {
  const name = opening?.name || fallbackTitle;
  const context = getOpeningContext(opening?.raw || opening || {});
  const contextualName =
    opening && context.label !== "Mixed signal"
      ? `${name} ${context.label === "You faced this" ? "you faced" : context.label.toLowerCase()}`
      : name;
  const games = opening?.games || 0;
  const winRate = opening?.winRate || 0;
  const verdict = opening?.verdict || title;
  const confidenceLabel = opening?.confidenceLabel || getOpeningConfidence(opening?.raw || opening || {});
  const comparisonText = opening?.comparisonText || "Average comparison unavailable.";
  const reason = opening?.reason || fallbackText;

  return (
    <article className={`openingReportCard openingReportCard-${type}`}>
      <div className="openingReportCardTop">
        <span>{title}</span>
        <em className={getVerdictClass(verdict)}>{verdict}</em>
      </div>

      <h3>{contextualName}</h3>

      {opening ? (
        <>
          <div className="openingReportStats">
            <div>
              <strong>{games}</strong>
              <small>games</small>
            </div>

            <div>
              <strong>{winRate}%</strong>
              <small>score</small>
            </div>

            <div>
              <strong>{confidenceLabel}</strong>
              <small>confidence</small>
            </div>
          </div>

          <OpeningEvidenceBlock
            opening={{
              ...opening.raw,
              name,
              games,
              winRate,
              verdict,
              confidence: confidenceLabel,
              lossTimingNote: opening.raw?.lossTimingNote || opening.raw?.loss_timing_note,
              lossTiming: opening.raw?.lossTiming || opening.raw?.loss_timing,
              moveOrderNote: opening.raw?.moveOrderNote || opening.raw?.move_order_note,
              moveOrderStatus: opening.raw?.moveOrderStatus || opening.raw?.move_order_status,
              mostReliableMoveOrder: opening.raw?.mostReliableMoveOrder || opening.raw?.most_reliable_move_order,
              comparisonText,
              reason,
              nextAction:
                winRate < 45
                  ? `Review your last 3 ${name} losses before changing the whole opening.`
                  : `Keep tracking ${name} and review the next recurring branch.`,
            }}
            data={data}
            compact
          />
        </>
      ) : (
        <p>{fallbackText}</p>
      )}
    </article>
  );
}
