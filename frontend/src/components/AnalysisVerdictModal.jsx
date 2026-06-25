import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import OpeningScoreExplanation from "./OpeningScoreExplanation";
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

function openingContext(item) {
  return cleanText(item?.contextLabel || item?.context_label || item?.role || item?.side || item?.colour || item?.color);
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
    ...asArray(legacy.white_repertoire),
    ...asArray(legacy.whiteDetailed),
    ...asArray(legacy.black_vs_e4),
    ...asArray(legacy.blackVsE4Detailed),
    ...asArray(legacy.black_vs_d4),
    ...asArray(legacy.blackVsD4Detailed),
    ...asArray(legacy.black_vs_other),
    ...asArray(legacy.blackVsOtherDetailed),
    ...asArray(grouped.white),
    ...asArray(grouped.black_vs_e4 || grouped.blackVsE4),
    ...asArray(grouped.black_vs_d4 || grouped.blackVsD4),
  ];
}

function insightFromText(title, text) {
  const value = cleanText(text);
  return value ? { title, text: value } : null;
}

function insightForStrength(data = {}, fitData = {}) {
  const direct =
    insightFromText("Your biggest strength", data.coachInsights?.strength || data.coach_insights?.strength) ||
    insightFromText("Your biggest strength", data.diagnosis?.strength || data.openingDiagnosis?.strength);
  if (direct) return direct;

  const best = firstUsable(fitData.bestOpening, data.best_openings?.[0], data.bestOpenings?.[0], data.top_openings?.[0]);
  if (best) {
    const name = openingName(best);
    const score = openingScore(best);
    const context = openingContext(best);
    return {
      title: "Your biggest strength",
      text: `${name}${context ? ` ${context}` : ""}${score !== null ? ` is your strongest signal at ${score}/100.` : " is your strongest opening signal."}`,
    };
  }

  const style = cleanText(data.styleProfile?.summary || data.style_profile?.summary || data.styleProfile?.label || data.style_profile?.label);
  return insightFromText("Your biggest strength", style ? `Your style profile points to ${style}.` : "");
}

function insightForOpportunity(data = {}, fitData = {}) {
  const direct =
    insightFromText("Main opportunity", data.coachInsights?.opportunity || data.coach_insights?.opportunity) ||
    insightFromText("Main opportunity", data.diagnosis?.opportunity || data.openingDiagnosis?.opportunity);
  if (direct) return direct;

  const weakLine = firstUsable(data.weak_lines, data.weakLines);
  if (weakLine) {
    const name = openingName(weakLine);
    const moveLine = cleanText(weakLine.moveLine || weakLine.move_line || weakLine.line || weakLine.variation);
    return {
      title: "Main opportunity",
      text: moveLine ? `Review ${name}: ${moveLine}.` : `Review the repeated line in ${name}.`,
    };
  }

  const weakest = firstUsable(fitData.weakestOpening);
  if (weakest) {
    const name = openingName(weakest);
    const score = openingScore(weakest);
    return {
      title: "Main opportunity",
      text: `Clean up ${name}${score !== null ? ` (${score}/100)` : ""} before adding more theory.`,
    };
  }

  const rec = firstUsable(candidateRecommendations(data));
  if (rec) {
    const name = openingName(rec);
    const reason = cleanText(rec.recommendationReason || rec.recommendation_reason || rec.reason);
    return {
      title: "Main opportunity",
      text: reason || `Compare the recommendation for ${name} against your current repertoire.`,
    };
  }

  return null;
}

function insightForNextStep(data = {}, fitData = {}) {
  const direct =
    insightFromText("Best next step", data.coachInsights?.nextStep || data.coach_insights?.next_step) ||
    insightFromText("Best next step", data.recommendedAction || data.recommended_action);
  if (direct) return direct;

  const plan = asArray(data.training_plan || data.trainingPlan)[0];
  if (plan) {
    const title = cleanText(plan.title || plan.action);
    const text = cleanText(plan.text || plan.description || plan.detail);
    return {
      title: "Best next step",
      text: title && text ? `${title}: ${text}` : title || text,
    };
  }

  const target = firstUsable(fitData.weakestOpening, fitData.bestOpening);
  if (target) {
    return {
      title: "Best next step",
      text: `Start one focused training session on ${openingName(target)}.`,
    };
  }

  return null;
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

function fallbackInsights(data = {}) {
  const games = gameCount(data);
  return {
    strength: `OpeningFit found ${games || "your"} usable game${games === 1 ? "" : "s"} for this report.`,
    opportunity: "Use the full opening table to compare results by colour before changing repertoire.",
    next: "Open the report verdicts and pick one repeated line to review first.",
  };
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
    const fallback = fallbackInsights(data);
    return [
      insightForStrength(data, fitData) || { title: "Your biggest strength", text: fallback.strength },
      insightForOpportunity(data, fitData) || { title: "Main opportunity", text: fallback.opportunity },
      insightForNextStep(data, fitData) || { title: "Best next step", text: fallback.next },
    ];
  }, [data, fitData]);
  const status = scoreStatus(data, fitData);
  const hasTrainingAction = Boolean(trainingTarget && onStartTraining);

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
            <span>
              Opening Score
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
                i
              </button>
            </span>
          </div>
          <strong>{openingScore ?? "—"}{openingScore !== null && openingScore !== undefined ? "/100" : ""}</strong>
          {status ? <em>{status}</em> : null}
          {showScoreInfo ? (
            <div
              className="analysisVerdictScoreInfo"
              id="analysis-verdict-score-info"
              role="tooltip"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <OpeningScoreExplanation />
            </div>
          ) : null}
        </div>

        <div className="analysisVerdictInsights">
          {insights.map((insight) => (
            <article key={insight.title}>
              <span>{insight.title}</span>
              <p>{insight.text}</p>
            </article>
          ))}
        </div>

        <div className="analysisVerdictActions">
          <button className="primaryBtn" type="button" onClick={onViewReport}>
            View full report
          </button>
          {hasTrainingAction ? (
            <button className="secondaryBtn" type="button" onClick={() => onStartTraining(trainingTarget)}>
              Start next training step
            </button>
          ) : null}
        </div>
      </section>
    </div>,
    document.body
  );
}
