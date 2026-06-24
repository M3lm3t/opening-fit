import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";
import { buildTrainingRecommendations } from "../services/trainingRecommendations";
import { buildWeakestLineTrainingTarget } from "../services/weakestLineTraining";
import "./TodayTrainingCard.css";

const LOCAL_KEY = "openingFit:trainingProgress";

function readLocalProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalProgress(patch) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...readLocalProgress(), ...patch }));
  } catch {
    // Local progress is helpful, not required.
  }
}

function recommendationKey(item) {
  if (!item) return "";
  return [item.opening, item.variation, item.moveLine].filter(Boolean).join("::");
}

function safeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function openingName(item = {}) {
  return item.opening || item.name || item.openingName || item.opening_name || item.trainingTarget || "";
}

function lineName(item = {}) {
  return item.variation || item.line || item.lineName || item.line_name || item.moveLine || item.move_line || "";
}

function buildTodayFocus(data, plan) {
  if (!data) return null;

  if (plan.primary) {
    return {
      ...plan.primary,
      reason: plan.primary.reason || "Why this was picked:",
      why:
        plan.primary.why ||
        "This is the most specific training target OpeningFit can support from the current evidence.",
    };
  }

  const weakestTraining = buildWeakestLineTrainingTarget(data);
  if (weakestTraining.available && weakestTraining.target) {
    const target = weakestTraining.target;
    const games = safeNumber(target.games ?? target.gamesPlayed ?? target.games_played, null);
    const winRate = safeNumber(target.winRate ?? target.win_rate, null);
    const lossRate = safeNumber(target.lossRate ?? target.loss_rate, null);
    const trainingSet = target.trainingSet || target.training_set || {};

    return {
      type: "weakest-line",
      opening: openingName(target),
      variation: lineName(target),
      moveLine: target.moveLine || target.move_line || trainingSet.startingMoveSequence || trainingSet.starting_move_sequence || "",
      games,
      winRate,
      lossRate,
      practiceSide: target.practiceSide || target.side || trainingSet.side || "",
      sideLabel: (target.practiceSide || target.side || trainingSet.side) === "black" ? "Train as Black" : "Train as White",
      startLabel: target.moveLine || target.move_line || trainingSet.startingMoveSequence || trainingSet.starting_move_sequence
        ? `after ${target.moveLine || target.move_line || trainingSet.startingMoveSequence || trainingSet.starting_move_sequence}`
        : "from the saved weak-line sequence",
      confidence: games >= 6 && lossRate >= 50 ? "High confidence" : games >= 3 ? "Developing pattern" : "Limited evidence",
      reason: "Why this was picked:",
      why:
        trainingSet.shortExplanation ||
        trainingSet.short_explanation ||
        target.flagReason ||
        "It is the clearest line to repair before adding more opening study.",
      estimatedTime: "3-5 minutes",
      trainingTarget: target,
    };
  }

  return null;
}

export default function TodayTrainingCard({
  data,
  fitData,
  onAnalyse,
  onStartTraining,
}) {
  const { user, openingFitUserState, recordActivity, upsertUserData } = useAuth();
  const plan = useMemo(() => buildTrainingRecommendations(data, fitData), [data, fitData]);
  const primary = useMemo(() => buildTodayFocus(data, plan), [data, plan]);
  const cloudState = useMemo(() => {
    if (!user?.id) return null;
    const platform = String(data?.platform || data?.importPlatform || data?.import_platform || "").toLowerCase();
    const username = String(data?.username || data?.playerName || data?.player_name || "").toLowerCase();

    return (openingFitUserState || []).find((row) => {
      const samePlatform = !platform || String(row?.platform || "").toLowerCase() === platform;
      const sameUsername = !username || String(row?.username || "").toLowerCase() === username;
      return samePlatform && sameUsername;
    }) || openingFitUserState?.[0] || null;
  }, [data, openingFitUserState, user?.id]);
  const [status, setStatus] = useState(() => {
    const key = recommendationKey(primary);
    const local = readLocalProgress();
    return key && local.currentKey === key ? "Continue Training" : "";
  });

  useEffect(() => {
    const key = recommendationKey(primary);
    const local = readLocalProgress();
    const cloudProgress = cloudState?.coach_progress?.todayTraining;
    const saved = cloudProgress?.recommendation_key === key ? cloudProgress : local;
    setStatus(key && saved?.currentKey === key && saved?.lastState === "started" ? "Continue Training" : "");
  }, [cloudState, primary]);

  const saveProgress = async (state) => {
    const payload = {
      state,
      opening: primary?.opening || "",
      variation: primary?.variation || "",
      move_line: primary?.moveLine || "",
      recommendation_key: recommendationKey(primary),
      source: "today_training",
      saved_at: new Date().toISOString(),
    };

    writeLocalProgress({
      currentKey: payload.recommendation_key,
      lastState: state,
      lastSavedAt: payload.saved_at,
      opening: primary?.opening || "",
      variation: primary?.variation || "",
      move_line: primary?.moveLine || "",
      saved_at: payload.saved_at,
    });

    if (user?.id && recordActivity) {
      await recordActivity(state === "completed" ? "training_completed" : "training_started", {
        ...payload,
        points: state === "completed" ? 80 : 35,
      });
    }

    if (user?.id && upsertUserData) {
      const coachProgress =
        cloudState?.coach_progress && typeof cloudState.coach_progress === "object"
          ? cloudState.coach_progress
          : {};

      await upsertUserData(
        "openingfit_user_state",
        {
          ...(cloudState?.id ? { id: cloudState.id } : {}),
          platform: data?.platform || data?.importPlatform || data?.import_platform || "unknown",
          username: data?.username || data?.playerName || data?.player_name || "guest",
          last_report: data || cloudState?.last_report || null,
          coach_progress: {
            ...coachProgress,
            todayTraining: {
              ...payload,
              currentKey: payload.recommendation_key,
              lastState: state,
            },
          },
        },
        { onConflict: "user_id,platform,username" }
      );
    }
  };

  const start = async () => {
    if (!primary) {
      onAnalyse?.();
      return;
    }

    try {
      await saveProgress("started");
      setStatus(user?.id ? "Training started - progress saved to cloud" : "Training started - progress saved locally");
    } catch (error) {
      console.warn("OpeningFit could not save training start.", error);
      setStatus("Training started");
    }

    onStartTraining?.(primary);
  };

  const primaryIsWeakLine = primary?.type === "weak-line" || primary?.type === "weakest-line";
  const ctaLabel = primaryIsWeakLine ? "Train this line" : "Review this opening";

  const complete = async () => {
    if (!primary) return;

    try {
      await saveProgress("completed");
      setStatus(user?.id ? "Line reviewed - progress saved to cloud" : "Line reviewed - progress saved locally");
    } catch (error) {
      console.warn("OpeningFit could not save training completion.", error);
      setStatus("Line reviewed");
    }
  };

  if (!data) {
    return (
      <section className="todayTrainingCard" id="today-training">
        <div className="todayTrainingHeader">
          <div>
            <p className="eyebrow">Today&apos;s Focus</p>
            <h2>Analyse your games to get a personal training target.</h2>
            <p>OpeningFit will turn your recent openings into one focused line to work on next.</p>
          </div>
          <span className="todayTrainingTime">3-5 min</span>
        </div>
        <div className="todayTrainingActions">
          <button type="button" onClick={onAnalyse}>
            Analyse My Games
          </button>
        </div>
      </section>
    );
  }

  if (!primary) {
    return (
      <section className="todayTrainingCard" id="today-training">
        <div className="todayTrainingHeader">
          <div>
            <p className="eyebrow">Today&apos;s Focus</p>
            <h2>Build your first training plan</h2>
            <p>OpeningFit needs a few repeated openings or lines before it can pick a precise daily task.</p>
          </div>
          <span className="todayTrainingTime">3-5 min</span>
        </div>
        <div className="todayTrainingActions">
          <button type="button" onClick={onAnalyse}>
            Analyse More Games
          </button>
        </div>
        {!user?.id ? <p className="todayTrainingSavePrompt">Log in to save your training progress across devices.</p> : null}
      </section>
    );
  }

  return (
    <section className="todayTrainingCard" id="today-training">
      <div className="todayTrainingHeader">
        <div>
          <p className="eyebrow">Today&apos;s Focus</p>
          <h2>{primary.opening || "Your next opening target"}</h2>
          <p>Start with the line most likely to make your next opening session useful.</p>
        </div>
        <span className="todayTrainingTime">Estimated time: {primary.estimatedTime}</span>
      </div>

      <div className="todayTrainingPrimary">
        <div className="todayTrainingTargetHeader">
          <span>{primary.sideLabel || (primary.practiceSide === "black" ? "Train as Black" : "Train as White")}</span>
          <small>{primary.confidence || "Limited evidence"}</small>
        </div>
        <div>
          <h3>{primary.variation && primary.variation !== primary.opening ? primary.variation : primary.opening}</h3>
          {primary.variation && primary.variation !== primary.opening ? (
            <p className="todayTrainingLine">{primary.opening}</p>
          ) : null}
          <p className="todayTrainingLine">
            Exact practice point: {primary.startLabel || (primary.moveLine ? `after ${primary.moveLine}` : "from the saved starting sequence")}
          </p>
        </div>

        <div className="todayTrainingStats">
          {primary.games ? <span>{primary.games} games</span> : null}
          {primary.winRate !== null && primary.winRate !== undefined ? <span>{primary.winRate}% win rate</span> : null}
          {primary.lossRate !== null && primary.lossRate !== undefined ? <span>{primary.lossRate}% loss rate</span> : null}
        </div>

        <p className="todayTrainingReason">
          <strong>{primary.reason || "Why this was picked:"}</strong> {primary.why}
        </p>

        <div className="todayTrainingActions">
          <button type="button" onClick={start}>
            {ctaLabel}
          </button>
          <button type="button" onClick={complete}>
            Mark reviewed
          </button>
        </div>

        {status ? <p className="todayTrainingStatus">{status}</p> : null}
        {!user?.id ? <p className="todayTrainingSavePrompt">Log in to save your training progress across devices.</p> : null}
      </div>
    </section>
  );
}
