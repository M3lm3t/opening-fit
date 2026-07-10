import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import OpeningScoreExplanation from "./OpeningScoreExplanation";
import "./ReturningUserBriefing.css";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function reportName(report = {}, fallback = "") {
  return cleanText(
    report.profile?.realName ||
      report.profile?.real_name ||
      report.profile?.displayName ||
      report.profile?.display_name ||
      report.account?.realName ||
      report.account?.real_name ||
      report.account?.displayName ||
      report.account?.display_name ||
      report.username ||
      report.playerName ||
      report.player_name ||
      report.profile?.username ||
      report.account?.username ||
      fallback
  );
}

function openingName(item) {
  if (typeof item === "string") return cleanText(item);
  return cleanText(item?.opening || item?.name || item?.openingName || item?.opening_name || item?.label);
}

function moveLine(item) {
  return cleanText(
    item?.moveLine ||
      item?.move_line ||
      item?.line ||
      item?.variation ||
      item?.trainingSet?.startingMoveSequence ||
      item?.training_set?.starting_move_sequence
  );
}

function firstNamed(...groups) {
  return groups.flat().find((item) => {
    const name = openingName(item);
    return name && !/unknown|unclassified|unclear/i.test(name);
  });
}

function getActionText(report = {}, trainingTarget = null) {
  report = report || {};
  const direct = cleanText(
    report.coachInsights?.nextStep ||
      report.coach_insights?.next_step ||
      report.recommendedAction ||
      report.recommended_action
  );
  if (direct) return direct;

  const plan = asArray(report.training_plan || report.trainingPlan)[0];
  if (plan) {
    const title = cleanText(plan.title || plan.action);
    const detail = cleanText(plan.text || plan.description || plan.detail);
    if (title && detail) return `${title}: ${detail}`;
    if (title || detail) return title || detail;
  }

  const target = firstNamed(trainingTarget, report.oneThingToFix, report.one_thing_to_fix, report.weak_lines, report.weakLines);
  const name = openingName(target);
  const line = moveLine(target);
  if (name && line) return `Practise ${name}: ${line}.`;
  if (name) return `Practise ${name}.`;

  return "Open your latest report and pick the first repeated line to review.";
}

function getContinueFrom(report = {}, openingFitUserState = [], trainingTarget = null) {
  report = report || {};
  const state = asArray(openingFitUserState).find((row) => row?.coach_progress || row?.last_report) || null;
  const latestTraining =
    asArray(state?.coach_progress?.weakestLineTrainingHistory || state?.coach_progress?.weakest_line_training_history)[0] ||
    state?.coach_progress?.openingTraining ||
    state?.coach_progress?.opening_training ||
    null;
  const trainingName = openingName(latestTraining);
  if (trainingName) return `Continue your ${trainingName} practice.`;

  const target = firstNamed(trainingTarget, report.oneThingToFix, report.one_thing_to_fix, report.weak_lines, report.weakLines);
  const targetName = openingName(target);
  const line = moveLine(target);
  if (targetName && line) return `Practise ${targetName}: ${line}.`;
  if (targetName) return `Practise your ${targetName} setup.`;

  const best = firstNamed(report.best_openings, report.bestOpenings, report.top_openings, report.topOpenings);
  const bestName = openingName(best);
  if (bestName) return `Review your latest ${bestName} finding.`;

  return "Continue from your latest saved report.";
}

function scoreFromRow(row) {
  const report = row?.report || row?.summary || row || {};
  const raw =
    report.openingFitScore ??
    report.opening_fit_score ??
    report.openingfitScore?.score ??
    report.openingfit_score?.score ??
    report.summary?.openingFitScore ??
    null;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function sinceLastVisit({ openingScore, reportHistory }) {
  const rows = asArray(reportHistory);
  if (rows.length < 2 || openingScore === null || openingScore === undefined) return "";
  const previous = scoreFromRow(rows[1]);
  if (previous === null || previous === Number(openingScore)) return "";
  const delta = Number(openingScore) - previous;
  if (!Number.isFinite(delta) || delta === 0) return "";
  return `Opening Score ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} since the previous saved report.`;
}

export default function ReturningUserBriefing({
  open,
  report,
  displayName,
  openingScore,
  scoreStatus,
  reportHistory = [],
  openingFitUserState = [],
  trainingTarget,
  onClose,
  onViewReport,
  onContinueTraining,
}) {
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const dialogRef = useRef(null);
  const scoreInfoRef = useRef(null);
  const previousFocusRef = useRef(null);
  const briefing = useMemo(() => {
    const safeName = reportName(report, displayName) || "there";
    return {
      safeName,
      nextBestMove: getActionText(report, trainingTarget),
      continueFrom: getContinueFrom(report, openingFitUserState, trainingTarget),
      since: sinceLastVisit({ openingScore, reportHistory }),
    };
  }, [displayName, openingFitUserState, openingScore, report, reportHistory, trainingTarget]);
  const canTrain = Boolean(trainingTarget && onContinueTraining);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => dialogRef.current?.querySelector("button")?.focus?.(), 0);

    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (showScoreInfo) {
          setShowScoreInfo(false);
          return;
        }
        onClose?.();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])")
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
  }, [onClose, open, showScoreInfo]);

  useEffect(() => {
    if (!showScoreInfo) return undefined;
    const handlePointerDown = (event) => {
      if (scoreInfoRef.current?.contains(event.target)) return;
      setShowScoreInfo(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [showScoreInfo]);

  if (!open || !report) return null;

  return createPortal(
    <div className="returningUserBriefingOverlay" role="presentation" onPointerDown={onClose}>
      <section
        className="returningUserBriefing"
        role="dialog"
        aria-modal="true"
        aria-labelledby="returning-user-briefing-title"
        aria-describedby="returning-user-briefing-greeting"
        ref={dialogRef}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="returningUserBriefingHandle" aria-hidden="true" />
        <div className="returningUserBriefingHeader">
          <div>
            <h2 id="returning-user-briefing-title">Your OpeningFit Briefing</h2>
            <p id="returning-user-briefing-greeting">Welcome back, {briefing.safeName}</p>
          </div>
          <button className="returningUserBriefingClose" type="button" onClick={onClose} aria-label="Close briefing">
            <X size={20} />
          </button>
        </div>

        <div className="returningUserBriefingScore">
          <div className="returningUserBriefingScoreLabel" ref={scoreInfoRef}>
            <span>
              Opening Score
              <button
                className="returningUserBriefingInfo"
                type="button"
                aria-label="About Opening Score"
                aria-controls="returning-user-score-info"
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
          <strong>{openingScore ?? "-" }{openingScore !== null && openingScore !== undefined ? "/100" : ""}</strong>
          {scoreStatus ? <em>{scoreStatus}</em> : null}
          {showScoreInfo ? (
            <div
              className="returningUserBriefingScoreInfo"
              id="returning-user-score-info"
              role="tooltip"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <OpeningScoreExplanation />
            </div>
          ) : null}
        </div>

        <div className="returningUserBriefingSummary">
          <article>
            <span>Your next best move</span>
            <p>{briefing.nextBestMove}</p>
          </article>
          <article>
            <span>Continue from</span>
            <p>{briefing.continueFrom}</p>
          </article>
          {briefing.since ? (
            <article>
              <span>Since your last visit</span>
              <p>{briefing.since}</p>
            </article>
          ) : null}
        </div>

        <div className="returningUserBriefingActions">
          {canTrain ? (
            <button className="primaryBtn" type="button" onClick={() => onContinueTraining(trainingTarget)}>
              Continue training
            </button>
          ) : null}
          <button className={canTrain ? "secondaryBtn" : "primaryBtn"} type="button" onClick={onViewReport}>
            View my report
          </button>
          <button className="returningUserBriefingTextAction" type="button" onClick={onClose}>
            Not now
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
