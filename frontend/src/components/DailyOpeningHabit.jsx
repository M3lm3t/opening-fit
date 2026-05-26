import { useEffect, useMemo, useState } from "react";
import { OPENINGS, findOpeningLine, normaliseOpeningKey } from "../data/openings";
import { fetchOpeningFitCloudState, saveOpeningFitCloudState } from "./openingFitCloudState";

const DAILY_HABIT_KEY = "openingFit:dailyOpeningHabit";
const REVIEW_INTERVALS = [1, 2, 4, 7, 14, 30];

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function openingName(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.opening || item?.openingName || item?.ecoName || "";
}

function openingScore(item) {
  if (!item || typeof item === "string") return 0;
  const direct = item.winRate ?? item.win_rate ?? item.score ?? item.percentage;
  if (direct !== undefined && direct !== null && direct !== "") {
    const number = safeNumber(String(direct).replace("%", ""), 0);
    return number <= 1 ? Math.round(number * 100) : Math.round(number);
  }

  const games = safeNumber(item.games ?? item.count, 0);
  const wins = safeNumber(item.wins ?? item.w, 0);
  const draws = safeNumber(item.draws ?? item.d, 0);
  return games ? Math.round(((wins + draws * 0.5) / games) * 100) : 0;
}

function openingGames(item) {
  if (!item || typeof item === "string") return 0;
  return safeNumber(item.games ?? item.count ?? item.total, 0);
}

function collectReportOpenings(data) {
  const sources = [
    data?.opening_stats,
    data?.openingStats,
    data?.top_openings,
    data?.topOpenings,
    data?.best_openings,
    data?.bestOpenings,
    data?.openings,
  ];
  const merged = new Map();

  sources.forEach((source) => {
    const items = Array.isArray(source)
      ? source
      : source && typeof source === "object"
        ? Object.entries(source).map(([name, stats]) => ({ name, ...(stats || {}) }))
        : [];

    items.forEach((item) => {
      const name = openingName(item);
      if (!name || /unknown|unclassified/i.test(name)) return;
      const key = normaliseOpeningKey(name);
      const current = merged.get(key);
      const games = openingGames(item);
      const score = openingScore(item);

      if (!current || games > current.games) {
        merged.set(key, { name, games, score });
      }
    });
  });

  return Array.from(merged.values());
}

function loadLocalHabit() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_HABIT_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalHabit(state) {
  try {
    localStorage.setItem(DAILY_HABIT_KEY, JSON.stringify(state));
  } catch {
    // Daily habits should not fail if storage is unavailable.
  }
}

function seededIndex(seed, length) {
  if (!length) return 0;
  const value = String(seed).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return value % length;
}

function buildDailyPlan(data, habitState) {
  const today = todayKey();
  const reportOpenings = collectReportOpenings(data);
  const weakReportOpening = [...reportOpenings]
    .filter((item) => item.games >= 2)
    .sort((a, b) => a.score - b.score || b.games - a.games)[0];
  const bestReportOpening = [...reportOpenings].sort((a, b) => b.score - a.score || b.games - a.games)[0];
  const dueReviews = Object.values(habitState.reviews || {})
    .filter((item) => item?.nextReviewDate && item.nextReviewDate <= today)
    .sort((a, b) => String(a.nextReviewDate).localeCompare(String(b.nextReviewDate)));

  const focusOpening =
    (weakReportOpening && findOpeningLine(weakReportOpening.name)) ||
    (dueReviews[0]?.openingId && OPENINGS.find((item) => item.id === dueReviews[0].openingId)) ||
    (bestReportOpening && findOpeningLine(bestReportOpening.name)) ||
    OPENINGS[seededIndex(today, OPENINGS.length)];

  const backupLine =
    focusOpening.trainingLines[seededIndex(`${today}:${focusOpening.id}`, focusOpening.trainingLines.length)] ||
    focusOpening.trainingLines[0];
  const weakOpeningName = weakReportOpening?.name || focusOpening.name;
  const mistakeReview =
    focusOpening.traps?.[0]?.warning ||
    `Review the first moment you leave book in ${weakOpeningName}; that is usually where rating points leak.`;
  const dueReview = dueReviews.find((item) => item.openingId === focusOpening.id);

  return {
    focusOpening,
    dailyLine: backupLine,
    dueReview,
    weakOpeningName,
    modules: [
      {
        key: "focus",
        title: "Today's Opening Focus",
        text: `${focusOpening.name}: ${focusOpening.ideas[0]}`,
      },
      {
        key: "variation",
        title: "Review This Variation",
        text: `${backupLine.name}: ${backupLine.explanation}`,
      },
      {
        key: "forgot",
        title: "You forgot this line",
        text: dueReview
          ? `${dueReview.lineName} is due today from your spaced repetition queue.`
          : `Start a spaced repetition card for ${backupLine.name}.`,
      },
      {
        key: "weakness",
        title: "Train against your weakest defense",
        text: `Use today's drill to repair ${weakOpeningName}.`,
      },
      {
        key: "mistake",
        title: "Mistake Review",
        text: mistakeReview,
      },
    ],
  };
}

export default function DailyOpeningHabit({ data, user = null, onPractice }) {
  const [habitState, setHabitState] = useState(() => loadLocalHabit());
  const [syncStatus, setSyncStatus] = useState(user?.id ? "Syncing daily habit..." : "Saved on this device");
  const plan = useMemo(() => buildDailyPlan(data || {}, habitState), [data, habitState]);
  const today = todayKey();
  const completedToday = habitState.completedDays?.[today];
  const focusProgress = habitState.reviews?.[plan.focusOpening.id];
  const currentBox = safeNumber(focusProgress?.box, 0);
  const nextInterval = REVIEW_INTERVALS[Math.min(currentBox, REVIEW_INTERVALS.length - 1)];

  useEffect(() => {
    let cancelled = false;
    const local = loadLocalHabit();

    if (!user?.id) {
      return () => {
        cancelled = true;
      };
    }

    async function loadCloudHabit() {
      try {
        const state = await fetchOpeningFitCloudState(user, data || {});
        if (cancelled) return;
        const cloudHabit = state?.coach_progress?.dailyOpeningHabit;
        if (cloudHabit && typeof cloudHabit === "object") {
          const merged = {
            ...local,
            ...cloudHabit,
            reviews: { ...(local.reviews || {}), ...(cloudHabit.reviews || {}) },
            completedDays: { ...(local.completedDays || {}), ...(cloudHabit.completedDays || {}) },
          };
          setHabitState(merged);
          saveLocalHabit(merged);
        }
        setSyncStatus("Daily habit synced to your OpeningFit account");
      } catch {
        if (!cancelled) setSyncStatus("Saved locally. Cloud sync will retry later.");
      }
    }

    loadCloudHabit();

    return () => {
      cancelled = true;
    };
  }, [user, data]);

  async function persistHabit(nextState) {
    setHabitState(nextState);
    saveLocalHabit(nextState);

    if (!user?.id) {
      setSyncStatus("Saved on this device");
      return;
    }

    setSyncStatus("Saving daily habit...");
    try {
      const state = await fetchOpeningFitCloudState(user, data || {});
      const coachProgress =
        state?.coach_progress && typeof state.coach_progress === "object"
          ? state.coach_progress
          : {};

      await saveOpeningFitCloudState(user, data || {}, {
        coach_progress: {
          ...coachProgress,
          dailyOpeningHabit: nextState,
        },
      });
      setSyncStatus("Daily habit synced to your OpeningFit account");
    } catch {
      setSyncStatus("Saved locally. Cloud sync failed.");
    }
  }

  function completeToday(result = "reviewed") {
    const nextBox = result === "again" ? 0 : Math.min(currentBox + 1, REVIEW_INTERVALS.length - 1);
    const interval = REVIEW_INTERVALS[nextBox];
    const nextState = {
      ...habitState,
      completedDays: {
        ...(habitState.completedDays || {}),
        [today]: {
          openingId: plan.focusOpening.id,
          openingName: plan.focusOpening.name,
          lineName: plan.dailyLine.name,
          result,
          completedAt: new Date().toISOString(),
        },
      },
      reviews: {
        ...(habitState.reviews || {}),
        [plan.focusOpening.id]: {
          openingId: plan.focusOpening.id,
          openingName: plan.focusOpening.name,
          lineName: plan.dailyLine.name,
          box: nextBox,
          lastReviewedAt: new Date().toISOString(),
          nextReviewDate: addDays(today, interval),
        },
      },
    };

    persistHabit(nextState);
  }

  return (
    <section className="dailyOpeningHabit" id="daily-opening-habit">
      <div className="dailyHabitHero">
        <div>
          <p className="eyebrow">Daily opening habit</p>
          <h2>Today's Opening Focus</h2>
          <p>
            A short spaced-repetition loop for your repertoire: one focus, one line,
            one weakness, one mistake review.
          </p>
        </div>

        <div className="dailyHabitStreak">
          <span>{completedToday ? "Done today" : "Due today"}</span>
          <strong>{plan.focusOpening.name}</strong>
          <small>Next review: {focusProgress?.nextReviewDate || `${nextInterval} day${nextInterval === 1 ? "" : "s"}`}</small>
        </div>
      </div>

      <div className="dailyHabitGrid">
        {plan.modules.map((module) => (
          <article className={`dailyHabitCard dailyHabitCard--${module.key}`} key={module.key}>
            <span>{module.title}</span>
            <h3>{module.key === "variation" ? plan.dailyLine.name : plan.focusOpening.name}</h3>
            <p>{module.text}</p>
          </article>
        ))}
      </div>

      <div className="dailyHabitLine">
        <div>
          <span>Daily recommended line</span>
          <strong>{plan.dailyLine.moves.join(" ")}</strong>
          <p>{plan.dailyLine.keyIdeas.join(" · ")}</p>
        </div>

        <div className="dailyHabitActions">
          <button type="button" className="primaryBtn" onClick={() => onPractice?.(plan.focusOpening.name)}>
            Train line
          </button>
          <button type="button" className="secondaryBtn" onClick={() => completeToday("reviewed")}>
            Mark reviewed
          </button>
          <button type="button" className="ghostButton" onClick={() => completeToday("again")}>
            Review again tomorrow
          </button>
        </div>
      </div>

      <p className="dailyHabitSync">{syncStatus}</p>
    </section>
  );
}
