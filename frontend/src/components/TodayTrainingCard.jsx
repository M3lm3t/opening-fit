import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";
import { buildTrainingRecommendations } from "../services/trainingRecommendations";
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

export default function TodayTrainingCard({
  data,
  fitData,
  onAnalyse,
  onStartTraining,
}) {
  const { user, recordActivity } = useAuth();
  const plan = useMemo(() => buildTrainingRecommendations(data, fitData), [data, fitData]);
  const primary = plan.primary;
  const [status, setStatus] = useState(() => {
    const key = recommendationKey(primary);
    const local = readLocalProgress();
    return key && local.currentKey === key ? "Continue Training" : "";
  });

  useEffect(() => {
    const key = recommendationKey(primary);
    const local = readLocalProgress();
    setStatus(key && local.currentKey === key && local.lastState === "started" ? "Continue Training" : "");
  }, [primary]);

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
    });

    if (user?.id && recordActivity) {
      await recordActivity(state === "completed" ? "training_completed" : "training_started", {
        ...payload,
        points: state === "completed" ? 80 : 35,
      });
    }
  };

  const start = async () => {
    if (!primary) {
      onAnalyse?.();
      return;
    }

    try {
      await saveProgress("started");
      setStatus(user?.id ? "Training started · Progress saved to cloud" : "Training started · Progress saved locally");
    } catch (error) {
      console.warn("OpeningFit could not save training start.", error);
      setStatus("Training started");
    }

    onStartTraining?.(primary);
  };

  const complete = async () => {
    if (!primary) return;

    try {
      await saveProgress("completed");
      setStatus(user?.id ? "Line reviewed · Progress saved to cloud" : "Line reviewed · Progress saved locally");
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
            <p className="eyebrow">Today&apos;s Training</p>
            <h2>Import your games to unlock personalised training</h2>
            <p>OpeningFit will turn your recent openings into one focused training task.</p>
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
            <p className="eyebrow">Today&apos;s Training</p>
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
          <p className="eyebrow">Today&apos;s Training</p>
          <h2>{plan.message}</h2>
          <p>Based on your recent games, this is the best thing to work on next.</p>
        </div>
        <span className="todayTrainingTime">Estimated time: {primary.estimatedTime}</span>
      </div>

      <div className="todayTrainingPrimary">
        <div>
          <h3>{primary.opening}</h3>
          {primary.variation ? <p className="todayTrainingLine">{primary.variation}</p> : null}
          {primary.moveLine ? <p className="todayTrainingLine">{primary.moveLine}</p> : null}
        </div>

        <div className="todayTrainingStats">
          {primary.games ? <span>{primary.games} games</span> : null}
          {primary.winRate !== null && primary.winRate !== undefined ? <span>{primary.winRate}% win rate</span> : null}
          {primary.lossRate !== null && primary.lossRate !== undefined ? <span>{primary.lossRate}% loss rate</span> : null}
        </div>

        <p className="todayTrainingReason">
          <strong>Why this?</strong> {primary.reason}. {primary.why}
        </p>

        <div className="todayTrainingActions">
          <button type="button" onClick={start}>
            Start Training
          </button>
          <button type="button" onClick={complete}>
            Mark Line Reviewed
          </button>
        </div>

        {status ? <p className="todayTrainingStatus">{status}</p> : null}
        {!user?.id ? <p className="todayTrainingSavePrompt">Log in to save your training progress across devices.</p> : null}
      </div>

      {plan.recommendations.length > 1 ? (
        <div className="todayTrainingSupport">
          {plan.recommendations.slice(1, 3).map((item) => (
            <article key={recommendationKey(item)}>
              <strong>{item.opening}</strong>
              <span>{item.reason}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
