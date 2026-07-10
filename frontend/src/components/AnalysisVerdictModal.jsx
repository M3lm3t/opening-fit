import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./AnalysisVerdictModal.css";

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || "";
}

function openingName(item) {
  if (typeof item === "string") return item;
  return cleanText(
    item?.name ||
      item?.opening ||
      item?.openingName ||
      item?.opening_name ||
      item?.displayName ||
      item?.label
  );
}

function openingScore(item) {
  const raw = item?.fitScore ?? item?.fit_score ?? item?.score ?? item?.winRate ?? item?.win_rate;
  const number = Number(String(raw ?? "").replace("%", ""));
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number <= 1 ? number * 100 : number)));
}

function openingGames(item) {
  const number = Number(item?.games ?? item?.gamesPlayed ?? item?.games_played ?? item?.sampleSize ?? item?.sample_size);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function openingVerdict(item) {
  return cleanText(item?.fitVerdict || item?.fit_verdict || item?.verdict || item?.recommendation || item?.status);
}

function openingSide(item) {
  const text = cleanText(
    [
      item?.context,
      item?.contextKey,
      item?.context_key,
      item?.role,
      item?.side,
      item?.colour,
      item?.color,
      item?.player_color,
      item?.player_colour,
    ].join(" ")
  ).toLowerCase();
  if (text.includes("white") || text.includes("played_as_white") || text.includes("white_repertoire")) return "white";
  if (text.includes("black") || text.includes("black_vs") || text.includes("vs 1.")) return "black";
  return "";
}

function blackContext(item) {
  const text = cleanText(
    [
      item?.context,
      item?.contextKey,
      item?.context_key,
      item?.role,
      item?.side,
      item?.colour,
      item?.color,
      item?.firstMove,
      item?.first_move,
      item?.opponentFirstMove,
      item?.opponent_first_move,
    ].join(" ")
  ).toLowerCase();
  if (text.includes("black_vs_e4") || text.includes("vs 1.e4") || text.includes("vs e4") || text === "e4") return "vs 1.e4";
  if (text.includes("black_vs_d4") || text.includes("vs 1.d4") || text.includes("vs d4") || text === "d4") return "vs 1.d4";
  if (text.includes("black_vs_other")) return "vs other first moves";
  return "";
}

function withContext(items, context) {
  return asArray(items).map((item) => (item && typeof item === "object" ? { ...item, context } : item));
}

function isUsableOpening(item) {
  const name = openingName(item);
  return Boolean(name) && !/unknown|unclassified|unclear transposition/i.test(name);
}

function firstUsable(...items) {
  return items.flat().find(isUsableOpening) || null;
}

function candidateRecommendations(data = {}) {
  const legacy = data.opening_recommendations || data.openingRecommendations || {};
  const grouped = data.recommended_openings || data.recommendedOpeningsByStyle || {};
  return [
    ...asArray(data.coachInsights?.recommendations),
    ...asArray(data.coach_insights?.recommendations),
    ...asArray(data.recommendations),
    ...asArray(legacy.white),
    ...asArray(legacy.white_repertoire),
    ...asArray(legacy.whiteDetailed),
    ...asArray(legacy.black_vs_e4),
    ...asArray(legacy.blackVsE4),
    ...asArray(legacy.blackVsE4Detailed),
    ...asArray(legacy.black_vs_d4),
    ...asArray(legacy.blackVsD4),
    ...asArray(legacy.blackVsD4Detailed),
    ...asArray(legacy.black_vs_other),
    ...asArray(legacy.blackVsOther),
    ...asArray(legacy.blackVsOtherDetailed),
    ...asArray(grouped.white),
    ...asArray(grouped.black_vs_e4 || grouped.blackVsE4),
    ...asArray(grouped.black_vs_d4 || grouped.blackVsD4),
  ];
}

function keepRecommendations(items) {
  return asArray(items).filter((item) => /keep|weapon|reliable|core|main/i.test(openingVerdict(item)));
}

function reviewRecommendations(items) {
  return asArray(items).filter((item) => /improve|avoid|park|repair|review|weak|lower/i.test(openingVerdict(item)));
}

function strongestOpening(items) {
  return asArray(items)
    .filter(isUsableOpening)
    .sort((a, b) => {
      const scoreDelta = (openingScore(b) ?? -1) - (openingScore(a) ?? -1);
      if (scoreDelta) return scoreDelta;
      return openingGames(b) - openingGames(a);
    })[0] || null;
}

function whiteRecommendationCandidates(data = {}) {
  const legacy = data.opening_recommendations || data.openingRecommendations || {};
  return [
    ...withContext(data.preferred_white || data.preferredWhite, "white_repertoire"),
    ...withContext(legacy.white || legacy.white_repertoire || legacy.whiteDetailed, "white_repertoire"),
    ...asArray(data.best_openings || data.bestOpenings).filter((item) => openingSide(item) === "white"),
    ...asArray(data.top_openings || data.topOpenings).filter((item) => openingSide(item) === "white"),
  ];
}

function blackRecommendationCandidates(data = {}) {
  const legacy = data.opening_recommendations || data.openingRecommendations || {};
  return [
    ...withContext(data.preferred_black || data.preferredBlack, "black_vs_e4"),
    ...withContext(legacy.black_vs_e4 || legacy.blackVsE4 || legacy.blackVsE4Detailed, "black_vs_e4"),
    ...withContext(legacy.black_vs_d4 || legacy.blackVsD4 || legacy.blackVsD4Detailed, "black_vs_d4"),
    ...withContext(legacy.black_vs_other || legacy.blackVsOther || legacy.blackVsOtherDetailed, "black_vs_other"),
    ...asArray(data.best_openings || data.bestOpenings).filter((item) => openingSide(item) === "black"),
    ...asArray(data.top_openings || data.topOpenings).filter((item) => openingSide(item) === "black"),
  ];
}

function fallbackKeepCandidate(data = {}, side) {
  const candidates = keepRecommendations(candidateRecommendations(data));
  return strongestOpening(
    candidates.filter((item) => {
      const detected = openingSide(item);
      if (side === "white") return detected === "white" || !detected;
      return detected === "black";
    })
  );
}

function cardSupport(item, side) {
  const games = openingGames(item);
  const score = openingScore(item);
  const reason = cleanText(item?.reason || item?.recommendationReason || item?.recommendation_reason || item?.summary);
  if (reason) return reason;
  if (games >= 10) return `Strong results across ${games} analysed games.`;
  if (score !== null && score >= 70) return side === "white" ? "Your most reliable White weapon so far." : "Your clearest Black opening to build around.";
  if (games >= 3) return side === "white" ? "You get playable positions here more consistently." : "A practical system you already know well.";
  return side === "white" ? "Your most reliable White weapon so far." : "Keep this as your main response for now.";
}

function buildWhiteCard(data = {}, fitData = {}) {
  const pick =
    firstUsable(data.preferred_white, data.preferredWhite) ||
    strongestOpening(asArray(data.best_openings || data.bestOpenings).filter((item) => openingSide(item) === "white")) ||
    strongestOpening(whiteRecommendationCandidates(data)) ||
    fallbackKeepCandidate(data, "white") ||
    (openingSide(fitData.bestOpening) === "white" ? fitData.bestOpening : null);

  if (!pick) {
    return {
      key: "white",
      label: "Best as White",
      title: "White repertoire still forming",
      text: "With more games, we'll identify your best White system.",
      indicator: "W",
      target: null,
    };
  }

  return {
    key: "white",
    label: "Best as White",
    title: openingName(pick),
    text: cardSupport(pick, "white"),
    indicator: "W",
    target: pick,
  };
}

function buildBlackCard(data = {}, fitData = {}) {
  const pick =
    firstUsable(data.preferred_black, data.preferredBlack) ||
    strongestOpening(asArray(data.best_openings || data.bestOpenings).filter((item) => openingSide(item) === "black")) ||
    strongestOpening(blackRecommendationCandidates(data)) ||
    fallbackKeepCandidate(data, "black") ||
    (openingSide(fitData.bestOpening) === "black" ? fitData.bestOpening : null);

  if (!pick) {
    return {
      key: "black",
      label: "Best as Black",
      title: "Black repertoire still forming",
      text: "Play a few more games as Black to get a clearer recommendation.",
      indicator: "B",
      target: null,
    };
  }

  const context = blackContext(pick);
  const name = openingName(pick);
  return {
    key: "black",
    label: "Best as Black",
    title: context && !name.toLowerCase().includes(context) ? `${name} ${context}` : name,
    text: cardSupport(pick, "black"),
    indicator: "B",
    target: pick,
  };
}

function cleanFocusTitle(value) {
  const text = cleanText(value);
  if (!text) return "";
  return text.length > 72 ? `${text.slice(0, 69).trim()}...` : text;
}

function buildFocusCard(data = {}, fitData = {}, trainingTarget = null) {
  const plan = asArray(data.training_plan || data.trainingPlan)[0];
  if (plan) {
    const title = typeof plan === "string" ? plan : cleanText(plan.title || plan.action || plan.opening);
    const detail = typeof plan === "string" ? "" : cleanText(plan.text || plan.description || plan.detail || plan.reason);
    return {
      key: "focus",
      label: "This week's focus",
      title: cleanFocusTitle(title) || "Build consistency with your current main openings.",
      text: detail || "A small improvement here will affect the most games.",
      indicator: "!",
      target: typeof plan === "object" ? (plan.trainingTarget || plan.opening || trainingTarget) : trainingTarget,
    };
  }

  const weakLine = firstUsable(data.weak_lines, data.weakLines);
  if (weakLine) {
    const name = openingName(weakLine);
    return {
      key: "focus",
      label: "This week's focus",
      title: `Practise ${name}`,
      text: "This repeated line is the clearest place to sharpen first.",
      indicator: "!",
      target: weakLine,
    };
  }

  const priority = firstUsable(reviewRecommendations(candidateRecommendations(data)), fitData.weakestOpening, trainingTarget);
  if (priority) {
    const name = openingName(priority);
    return {
      key: "focus",
      label: "This week's focus",
      title: name ? `Practise ${name}` : "Build consistency with your current main openings.",
      text: "This is the area costing you the most early-game points.",
      indicator: "!",
      target: priority,
    };
  }

  return {
    key: "focus",
    label: "This week's focus",
    title: "Build consistency with your current main openings.",
    text: "Play a few more games in the same systems so the next report can judge them fairly.",
    indicator: "!",
    target: trainingTarget || null,
  };
}

function scoreStatus(data = {}, fitData = {}) {
  return cleanText(
    data.openingFitScoreBand ||
      data.opening_fit_score_band ||
      data.openingFitScoreStatus ||
      data.opening_fit_score_status ||
      data.openingFitScoreLabel ||
      data.opening_fit_score_label ||
      fitData.scoreBand ||
      fitData.status ||
      fitData.label
  );
}

function dynamicScoreStatus(data = {}, fitData = {}, whiteCard, blackCard, openingScore) {
  const games = gameCount(data);
  if (games > 0 && games < 5) return "Still early data, but a useful direction is emerging.";
  if (whiteCard?.target && !blackCard?.target) return "Your White is ahead of your Black repertoire.";
  const score = Number(openingScore ?? fitData?.overallScore ?? data?.openingFitScore ?? data?.opening_fit_score);
  if (Number.isFinite(score) && score >= 70) return "Solid foundation - one key area to sharpen.";
  return "Clear progress path: simplify, then strengthen.";
}

function gameCount(data = {}) {
  return (
    Number(
      data.gamesAnalysed ??
        data.gamesAnalyzed ??
        data.games_analyzed ??
        data.gamesImported ??
        data.total_games ??
        data.totalGames ??
        0
    ) || 0
  );
}

export default function AnalysisVerdictModal({
  data,
  fitData,
  openingScore,
  analysisId,
  trainingTarget,
  onDismiss,
  onViewReport,
  onStartTraining,
}) {
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const dialogRef = useRef(null);
  const scoreInfoRef = useRef(null);
  const previousFocusRef = useRef(null);

  const insights = useMemo(() => {
    const whiteCard = buildWhiteCard(data, fitData);
    const blackCard = buildBlackCard(data, fitData);
    const focusCard = buildFocusCard(data, fitData, trainingTarget);
    return [whiteCard, blackCard, focusCard];
  }, [data, fitData, trainingTarget]);
  const focusTarget = insights[2]?.target || trainingTarget || insights[0]?.target || insights[1]?.target || null;
  const status = scoreStatus(data, fitData) || dynamicScoreStatus(data, fitData, insights[0], insights[1], openingScore);
  const hasTrainingAction = Boolean(onStartTraining || onViewReport);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTarget = dialogRef.current?.querySelector("button, [href], [tabindex]:not([tabindex='-1'])");
    window.setTimeout(() => focusTarget?.focus?.(), 0);

    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (showScoreInfo) {
          setShowScoreInfo(false);
          return;
        }

        onDismiss?.();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll(
          "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])"
        )
      ).filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onDismiss, showScoreInfo]);

  useEffect(() => {
    if (!showScoreInfo) return undefined;

    const handlePointerDown = (event) => {
      if (scoreInfoRef.current?.contains(event.target)) return;
      setShowScoreInfo(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [showScoreInfo]);

  if (!data || !analysisId || !insights.length) return null;

  return createPortal(
    <div className="analysisVerdictOverlay" role="presentation" onPointerDown={onDismiss}>
      <section
        className="analysisVerdictModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-verdict-title"
        aria-describedby="analysis-verdict-subtitle"
        ref={dialogRef}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="analysisVerdictHandle" aria-hidden="true" />
        <div className="analysisVerdictHeader">
          <div>
            <h2 id="analysis-verdict-title">Your OpeningFit Verdict</h2>
            <p id="analysis-verdict-subtitle">Here is the clearest next step from this analysis.</p>
          </div>
          <button className="analysisVerdictClose" type="button" onClick={onDismiss} aria-label="Close verdict">
            ×
          </button>
        </div>

        <div className="analysisVerdictScoreRow">
          <div className="analysisVerdictScoreLabel" ref={scoreInfoRef}>
            <span>OpeningScore</span>
          </div>
          <strong>{openingScore ?? "—"}{openingScore !== null && openingScore !== undefined ? "/100" : ""}</strong>
          {status ? <em>{status}</em> : null}
          <button
            className="analysisVerdictInfo"
            type="button"
            aria-label="About Opening Score"
            aria-controls="analysis-verdict-score-info"
            aria-expanded={showScoreInfo}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setShowScoreInfo((current) => !current);
            }}
          >
            <span aria-hidden="true">i</span>
            Score details
          </button>
          {showScoreInfo ? (
            <div
              className="analysisVerdictScoreInfo"
              id="analysis-verdict-score-info"
              role="tooltip"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <strong>What your OpeningScore means</strong>
              <p>
                OpeningScore reflects how reliable your current repertoire is based on your results,
                consistency, sample size and how comfortable you appear to be in the opening phase.
                It is a training guide, not a judgement of your chess ability.
              </p>
            </div>
          ) : null}
        </div>

        <div className="analysisVerdictInsights">
          {insights.map((insight) => (
            <article className={`analysisVerdictInsight analysisVerdictInsight--${insight.key}`} key={insight.label}>
              <span>
                <i aria-hidden="true">{insight.indicator}</i>
                {insight.label}
              </span>
              <h3>{insight.title}</h3>
              <p>{insight.text}</p>
            </article>
          ))}
        </div>

        <div className="analysisVerdictActions">
          <button className="primaryBtn" type="button" onClick={onViewReport}>
            View full report
          </button>
          {hasTrainingAction ? (
            <button
              className="secondaryBtn"
              type="button"
              onClick={() => {
                if (focusTarget && onStartTraining) {
                  onStartTraining(focusTarget);
                  return;
                }
                onViewReport?.();
              }}
            >
              Start this week's focus
            </button>
          ) : null}
        </div>
      </section>
    </div>,
    document.body
  );
}
