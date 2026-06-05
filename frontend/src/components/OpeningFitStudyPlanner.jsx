import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";
import { getOpeningSignal } from "./OpeningEvidence";
import { fetchOpeningFitCloudState, saveOpeningFitCloudState } from "./openingFitCloudState";
import {
  adaptVerdictForPlayerLevel,
  getLevelToneCopy,
  getSmartPlayerLevelProfile,
  isAdvancedOrStrongerLevel,
} from "./playerLevelLogic";

function getOpenings(data) {
  return [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];
}

function openingName(item) {
  return item?.name || item?.opening || item?.eco_name || item?.label || "Unknown opening";
}

function getGames(item) {
  return Number(item?.games ?? item?.count ?? item?.total ?? 0);
}

function getWinRate(item) {
  const raw = item?.win_rate ?? item?.winRate ?? item?.score ?? item?.percentage;
  const value = Number(raw);

  if (!Number.isFinite(value)) return null;

  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function verdictFor(item, data) {
  const signal = getOpeningSignal(item);
  const level = getSmartPlayerLevelProfile(data).level;
  const verdict = String(item?.verdict || "").toLowerCase();

  if (signal.tier === "none") return "No reliable data";
  if (signal.tier === "low") return "Too few games";

  if (verdict.includes("keep") || verdict.includes("weapon") || verdict.includes("reliable")) {
    return "Reliable choice";
  }
  if (verdict.includes("improve") || verdict.includes("promising")) {
    return "Promising but unstable";
  }
  if (verdict.includes("avoid") || verdict.includes("review")) {
    return adaptVerdictForPlayerLevel("Avoid", { level, games: getGames(item), score: getWinRate(item) }) || "Needs review";
  }

  const winRate = getWinRate(item);
  const games = getGames(item);

  if (games < 5) return "Too few games";
  if (winRate >= 58) return "Reliable choice";
  if (winRate >= 45) return "Promising but unstable";
  return adaptVerdictForPlayerLevel("Avoid", { level, games, score: winRate }) || "Needs review";
}

function storageKey(username) {
  return `openingfit.studyPlanner.v1.${String(username || "guest").toLowerCase()}`;
}

function toast(message) {
  window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: message }));
}

function buildTasks(opening, side, data) {
  const name = openingName(opening);
  const verdict = verdictFor(opening, data);
  const level = getSmartPlayerLevelProfile(data).level;
  const advancedOrHigher = isAdvancedOrStrongerLevel(level);
  const levelCopy = getLevelToneCopy(level);

  const baseTasks = [
    {
      id: "setup",
      title: advancedOrHigher ? `Map the key ${side} move order for ${name}` : `Write down your main ${side} setup for ${name}`,
      detail: advancedOrHigher
        ? "Focus on move-order precision, opponent preparation, and the branch where practical results start to change."
        : "Keep this simple: first 6-8 moves, ideal piece placement, and one common pawn break.",
      minutes: 10,
    },
    {
      id: "review-losses",
      title: `Review 2 losses or difficult games in ${name}`,
      detail: "Find the first moment you left your comfort zone. Do not analyse the whole game yet.",
      minutes: 20,
    },
    {
      id: "model-game",
      title: `Watch or replay 1 model game in ${name}`,
      detail: "Focus on plans and piece placement rather than memorising long engine lines.",
      minutes: 15,
    },
    {
      id: "practice",
      title: `Play 3 games using the ${name} plan`,
      detail: "After each game, note whether you reached a familiar structure.",
      minutes: 30,
    },
  ];

  if (verdict === "Keep") {
    return [
      {
        id: "keep-strength",
        title: `Keep ${name} in your repertoire`,
        detail: "This opening is currently a strength. Your goal is to make it more repeatable, not replace it.",
        minutes: 5,
      },
      ...baseTasks.slice(0, 3),
    ];
  }

  if (verdict === "Avoid" && !advancedOrHigher) {
    return [
      {
        id: "simplify",
        title: `Simplify or pause ${name}`,
        detail: "This may be costing points. Decide whether to replace it or learn one safer setup.",
        minutes: 10,
      },
      {
        id: "identify-trigger",
        title: `Find the common problem in ${name}`,
        detail: "Look for the recurring issue: early tactic, bad structure, unsafe king, or unfamiliar middlegame.",
        minutes: 20,
      },
      ...baseTasks.slice(0, 2),
    ];
  }

  if (advancedOrHigher && verdict.toLowerCase().includes("review")) {
    return [
      {
        id: "targeted-review",
        title: `Run targeted analysis on ${name}`,
        detail: levelCopy.reason,
        minutes: 20,
      },
      ...baseTasks.slice(1, 4),
    ];
  }

  return baseTasks;
}

export default function OpeningFitStudyPlanner({ data, username }) {
  const { user } = useAuth();
  const openings = useMemo(() => getOpenings(data).slice(0, 12), [data]);

  const [selectedName, setSelectedName] = useState("");
  const [side, setSide] = useState("White");
  const [completed, setCompleted] = useState({});
  const [cloudPlannerReady, setCloudPlannerReady] = useState(false);

  const selectedOpening = useMemo(() => {
    return openings.find((item) => openingName(item) === selectedName) || openings[0];
  }, [openings, selectedName]);

  const tasks = useMemo(() => {
    if (!selectedOpening) return [];
    return buildTasks(selectedOpening, side, data);
  }, [selectedOpening, side, data]);

  const key = storageKey(username);

  useEffect(() => {
    if (!openings.length || selectedName) return;
    setSelectedName(openingName(openings[0]));
  }, [openings, selectedName]);

  useEffect(() => {
    let cancelled = false;
    setCloudPlannerReady(!user?.id);

    try {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      if (saved?.completed && typeof saved.completed === "object") {
        setCompleted(saved.completed);
      }
      if (saved?.selectedName) {
        setSelectedName(saved.selectedName);
      }
      if (saved?.side) {
        setSide(saved.side);
      }
    } catch {
      // Ignore corrupt saved planner data.
    }

    if (user?.id) {
      fetchOpeningFitCloudState(user, data || {})
        .then((state) => {
          if (cancelled) return;
          const planner = state?.coach_progress?.studyPlanner;
          if (planner && typeof planner === "object") {
            if (planner.completed && typeof planner.completed === "object") {
              setCompleted(planner.completed);
            }
            if (planner.selectedName) setSelectedName(planner.selectedName);
            if (planner.side) setSide(planner.side);
          }
          setCloudPlannerReady(true);
        })
        .catch(() => {
          if (!cancelled) setCloudPlannerReady(true);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [data, key, user]);

  useEffect(() => {
    const snapshot = {
      selectedName,
      side,
      completed,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // Ignore local storage failure.
    }

    if (user?.id && cloudPlannerReady) {
      fetchOpeningFitCloudState(user, data || {})
        .then((state) => {
          const coachProgress =
            state?.coach_progress && typeof state.coach_progress === "object"
              ? state.coach_progress
              : {};

          return saveOpeningFitCloudState(user, data || {}, {
            coach_progress: {
              ...coachProgress,
              studyPlanner: snapshot,
            },
          });
        })
        .catch(() => {
          // The local copy is still available if cloud sync fails.
        });
    }
  }, [cloudPlannerReady, completed, data, key, selectedName, side, user]);

  if (!data || !openings.length) return null;

  const completedCount = tasks.filter((task) => completed[task.id]).length;
  const totalMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  const doneMinutes = tasks.reduce((sum, task) => sum + (completed[task.id] ? task.minutes : 0), 0);
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const toggleTask = (taskId) => {
    setCompleted((current) => ({
      ...current,
      [taskId]: !current[taskId],
    }));
  };

  const resetPlan = () => {
    setCompleted({});
    toast("Study plan reset.");
  };

  const exportPlan = () => {
    const name = openingName(selectedOpening);
    const lines = [
      `OpeningFit Study Plan`,
      `User: ${username || "Unknown"}`,
      `Opening: ${name}`,
      `Side: ${side}`,
      `Verdict: ${verdictFor(selectedOpening)}`,
      `Progress: ${completedCount}/${tasks.length} tasks complete`,
      "",
      ...tasks.map((task, index) => {
        const tick = completed[task.id] ? "[x]" : "[ ]";
        return `${tick} ${index + 1}. ${task.title}\n   ${task.detail}\n   Estimated time: ${task.minutes} minutes`;
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = name.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();

    link.href = url;
    link.download = `openingfit-study-plan-${safeName}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast("Study plan exported.");
  };

  return (
    <section className="ofStudyPlanner" id="study-planner">
      <div className="ofStudyPlannerHeader">
        <div>
          <div className="ofEyebrow">Study planner</div>
          <h2>Turn your report into weekly training.</h2>
          <p>
            Pick one opening from your report and work through a practical task list.
            Progress saves automatically on this device.
          </p>
        </div>

        <div className="ofStudyProgressCard">
          <span>Progress</span>
          <strong>{progress}%</strong>
          <small>{completedCount}/{tasks.length} tasks · {doneMinutes}/{totalMinutes} minutes</small>
        </div>
      </div>

      <div className="ofStudyControls">
        <label>
          Opening
          <select value={openingName(selectedOpening)} onChange={(event) => setSelectedName(event.target.value)}>
            {openings.map((opening) => (
              <option key={openingName(opening)} value={openingName(opening)}>
                {openingName(opening)} · {verdictFor(opening)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Side
          <select value={side} onChange={(event) => setSide(event.target.value)}>
            <option>White</option>
            <option>Black</option>
            <option>Both</option>
          </select>
        </label>

        <div className="ofStudyOpeningMeta">
          <span>{verdictFor(selectedOpening)}</span>
          <strong>{openingName(selectedOpening)}</strong>
          <small>
            {getGames(selectedOpening) ? `${getGames(selectedOpening)} games` : "Game count unknown"}
            {getWinRate(selectedOpening) !== null ? ` · ${getWinRate(selectedOpening)}% score` : ""}
          </small>
        </div>
      </div>

      <div className="ofStudyProgressBar" aria-label={`Study progress ${progress}%`}>
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="ofStudyTaskList">
        {tasks.map((task, index) => (
          <article key={task.id} className={completed[task.id] ? "complete" : ""}>
            <button
              type="button"
              className="ofStudyCheck"
              onClick={() => toggleTask(task.id)}
              aria-label={completed[task.id] ? "Mark task incomplete" : "Mark task complete"}
            >
              {completed[task.id] ? "✓" : index + 1}
            </button>

            <div>
              <strong>{task.title}</strong>
              <p>{task.detail}</p>
              <small>{task.minutes} minutes</small>
            </div>
          </article>
        ))}
      </div>

      <div className="ofStudyActions">
        <button type="button" onClick={exportPlan}>
          Export study plan
        </button>

        <button type="button" className="secondary" onClick={resetPlan}>
          Reset progress
        </button>
      </div>
    </section>
  );
}
