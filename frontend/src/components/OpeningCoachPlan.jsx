import { useEffect, useMemo, useState } from "react";
import "./OpeningCoachPlan.css";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function openingName(item, fallback = "your recurring opening") {
  return (
    item?.name ||
    item?.opening ||
    item?.eco_name ||
    item?.label ||
    item?.title ||
    fallback
  );
}

function winRate(item) {
  const raw =
    item?.winRate ??
    item?.win_rate ??
    item?.winrate ??
    item?.score ??
    item?.successRate;

  const n = toNumber(raw, null);
  if (n === null) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function games(item) {
  return toNumber(item?.games ?? item?.count ?? item?.total ?? item?.played, 0);
}

function openingMeta(item) {
  if (!item) return "Use your imported games as the guide.";

  const parts = [];
  const wr = winRate(item);
  const g = games(item);

  if (wr !== null) parts.push(`${wr}% score`);
  if (g > 0) parts.push(`${g} game${g === 1 ? "" : "s"}`);

  return parts.length ? parts.join(" · ") : "Pattern found in your games";
}

function getAllOpenings(data) {
  return [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
  ];
}

function getBestOpening(data) {
  const openings = getAllOpenings(data);
  if (!openings.length) return null;

  return [...openings].sort((a, b) => {
    const aScore = (winRate(a) ?? 0) + Math.min(games(a), 20);
    const bScore = (winRate(b) ?? 0) + Math.min(games(b), 20);
    return bScore - aScore;
  })[0];
}

function getWeakOpening(data) {
  const openings = getAllOpenings(data).filter((item) => games(item) >= 2);
  if (!openings.length) return null;

  return [...openings].sort((a, b) => {
    const aScore = winRate(a) ?? 50;
    const bScore = winRate(b) ?? 50;
    if (aScore !== bScore) return aScore - bScore;
    return games(b) - games(a);
  })[0];
}

function getMainRecommendation(data) {
  const recs = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const first = recs[0];

  if (typeof first === "string") return first;

  return (
    first?.title ||
    first?.summary ||
    first?.reason ||
    first?.text ||
    first?.message ||
    "Play one focused set of games using your recommended opening choices."
  );
}

function storageKey(data) {
  const platform =
    data?.platform ||
    data?.source ||
    localStorage.getItem("openingFit:lastPlatform") ||
    "unknown";

  const username =
    data?.username ||
    data?.player ||
    data?.handle ||
    localStorage.getItem("openingFit:lastUsername") ||
    "guest";

  return `openingFit:coachPlanProgress:${platform}:${username}`;
}

function buildPlan(data) {
  const best = getBestOpening(data);
  const weak = getWeakOpening(data);
  const recommendation = getMainRecommendation(data);

  return [
    {
      id: "day-1-2",
      days: "Day 1–2",
      title: `Fix ${openingName(weak, "your weakest recurring opening")}`,
      meta: openingMeta(weak),
      detail:
        "Replay 3 losses or difficult games from this opening. Write down where you left familiar positions and what plan you needed.",
      tag: "Repair",
    },
    {
      id: "day-3-4",
      days: "Day 3–4",
      title: `Build around ${openingName(best, "your best-fit opening")}`,
      meta: openingMeta(best),
      detail:
        "Choose one simple line you are happy to repeat. The goal is not memorising everything — it is getting familiar positions more often.",
      tag: "Strength",
    },
    {
      id: "day-5",
      days: "Day 5",
      title: "Review your opening losses",
      meta: "Look for the first moment the game became uncomfortable",
      detail:
        "Do not analyse the whole game. Focus only on the opening-to-middlegame transition and mark the first decision you would change.",
      tag: "Review",
    },
    {
      id: "day-6",
      days: "Day 6",
      title: recommendation,
      meta: "Turn your report into one practical rule",
      detail:
        "Convert the recommendation into a simple rule you can remember during games, such as: castle earlier, avoid early queen moves, or trade into simpler structures.",
      tag: "Apply",
    },
    {
      id: "day-7",
      days: "Day 7",
      title: "Play 5 focused games and re-import",
      meta: "Track whether the same opening problems repeat",
      detail:
        "Play normal games, but stick to your chosen repertoire idea. Re-import afterwards and compare your snapshot.",
      tag: "Test",
    },
  ];
}

export default function OpeningCoachPlan({ data, compact = false }) {
  const plan = useMemo(() => buildPlan(data || {}), [data]);
  const key = useMemo(() => storageKey(data || {}), [data]);

  const [checked, setChecked] = useState({});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      setChecked(saved && typeof saved === "object" ? saved : {});
    } catch {
      setChecked({});
    }
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(checked));
    } catch {
      // Progress tracking should never break the report.
    }
  }, [checked, key]);

  const completed = plan.filter((item) => checked[item.id]).length;
  const percent = Math.round((completed / plan.length) * 100);

  const toggleStep = (id) => {
    setChecked((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const resetProgress = () => {
    setChecked({});
  };

  const visiblePlan = compact ? plan.slice(0, 3) : plan;

  return (
    <section className={`openingCoachPlan ${compact ? "openingCoachPlan--compact" : ""}`}>
      <div className="openingCoachPlanHeader">
        <div>
          <p className="openingCoachPlanKicker">Opening coach</p>
          <h2>Your 7-day opening plan</h2>
          <p>
            A simple progress-tracked plan based on your imported games. Tick
            each step off as you complete it.
          </p>
        </div>

        <div className="openingCoachProgressCard">
          <span>{completed}/{plan.length} done</span>
          <strong>{percent}%</strong>
          <div className="openingCoachProgressTrack" aria-hidden="true">
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <div className="openingCoachPlanList">
        {visiblePlan.map((step) => {
          const isDone = Boolean(checked[step.id]);

          return (
            <article
              className={`openingCoachStep ${isDone ? "openingCoachStep--done" : ""}`}
              key={step.id}
            >
              <button
                type="button"
                className="openingCoachCheck"
                onClick={() => toggleStep(step.id)}
                aria-pressed={isDone}
                aria-label={isDone ? "Mark step incomplete" : "Mark step complete"}
              >
                {isDone ? "✓" : ""}
              </button>

              <div className="openingCoachStepBody">
                <div className="openingCoachStepTopline">
                  <span>{step.days}</span>
                  <em>{step.tag}</em>
                </div>

                <h3>{step.title}</h3>
                <p className="openingCoachStepMeta">{step.meta}</p>
                <p className="openingCoachStepDetail">{step.detail}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="openingCoachPlanFooter">
        {compact ? (
          <p>Open the Study Session tab to complete the full 7-day plan.</p>
        ) : (
          <p>
            Progress is saved on this device for this player. Re-import after
            Day 7 to see what changed.
          </p>
        )}

        {completed > 0 ? (
          <button type="button" onClick={resetProgress}>
            Reset progress
          </button>
        ) : null}
      </div>
    </section>
  );
}
