import { useEffect, useMemo, useState } from "react";
import "./OpeningCoachPlan.css";
import { getPlayerLevelText } from "./playerLevelLogic";

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

function resultRecord(item) {
  const wins = toNumber(item?.wins ?? item?.w, 0);
  const draws = toNumber(item?.draws ?? item?.d, 0);
  const losses = toNumber(item?.losses ?? item?.l, 0);
  return wins || draws || losses ? ` · ${wins}W-${draws}D-${losses}L` : "";
}

function evidence(item) {
  if (!item) return "Evidence: no stable opening sample yet.";
  return `Evidence: ${openingMeta(item)}${resultRecord(item)}.`;
}

function getAllOpenings(data) {
  return [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
  ];
}

function getRating(data) {
  return toNumber(
    data?.rating ??
      data?.currentRating ??
      data?.current_rating ??
      data?.chesscom_rating ??
      data?.lichess_rating ??
      data?.player_level?.rating ??
      data?.playerLevel?.rating,
    null
  );
}

function getLevel(data) {
  const rating = getRating(data);
  const level = getPlayerLevelText(data).toLowerCase();

  if (rating >= 2200 || level.includes("master") || level.includes("expert") || level.includes("elite")) {
    return "advanced";
  }
  if (rating >= 1200 || level.includes("club") || level.includes("intermediate")) {
    return "intermediate";
  }
  return "beginner";
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
  const level = getLevel(data);
  const advancedMode =
    level === "advanced" ||
    ["high_rated_user", "public_account_possible"].includes(data?.reportMode || data?.report_mode);
  const reviewLanguage =
    advancedMode
      ? `${evidence(weak)} Action: audit move order, opponent rating band, and the first recurring middlegame structure.`
      : level === "intermediate"
      ? `${evidence(weak)} Action: find the first repeated position where your plan becomes unclear.`
      : `${evidence(weak)} Action: mark the first move where development, king safety, or the centre plan went wrong.`;
  const strengthLanguage =
    advancedMode
      ? `${evidence(best)} Action: add one branch-level note on the reply causing the most practical problems.`
      : level === "intermediate"
      ? `${evidence(best)} Action: choose one repeatable line and write the plan in one sentence.`
      : `${evidence(best)} Action: play this opening again and aim for the same move-10 structure.`;
  const reviewTitle = advancedMode
    ? `20 minutes on ${openingName(weak, "a lower-scoring sample")}`
    : `20 minutes on ${openingName(weak, "your weakest recurring opening")}`;

  return [
    {
      id: "day-1-2",
      days: "Day 1",
      title: reviewTitle,
      meta: openingMeta(weak),
      detail: reviewLanguage,
      tag: advancedMode ? "Trend" : "Repair",
    },
    {
      id: "day-2",
      days: "Day 2",
      title: `20 minutes building around ${openingName(best, "your best-fit opening")}`,
      meta: openingMeta(best),
      detail: strengthLanguage,
      tag: "Strength",
    },
    {
      id: "day-3",
      days: "Day 3",
      title: advancedMode ? "20 minutes on the lower-scoring branch" : "20 minutes on the damaging line",
      meta: weak ? openingMeta(weak) : "Needs a larger sample",
      detail: advancedMode
        ? "Verdict: Lower-scoring sample. Evidence: this branch underperformed in the import. Action: compare moves 1-12 across three recent games."
        : "Verdict: Improve. Evidence: this is the lower-scoring repeated sample. Action: replay only moves 1-12 of three games and mark the repeated branch.",
      tag: "Review",
    },
    {
      id: "day-4",
      days: "Day 4",
      title: recommendation,
      meta: "Turn your report into one practical rule",
      detail:
        "Evidence: this came from your imported opening summary. Action: write one rule for the next games, such as castle earlier, delay the pawn break, or skip one risky sideline.",
      tag: "Apply",
    },
    {
      id: "day-5",
      days: "Day 5",
      title: "20 minutes of line practice",
      meta: "Use the practice pack for your most relevant opening",
      detail:
        "Play through three lines slowly. Say out loud why each move works: centre, development, king safety, pressure, or a useful pawn break.",
      tag: "Drill",
    },
    {
      id: "day-6",
      days: "Day 6",
      title: "Play a small focused block",
      meta: "Do not change the whole repertoire today",
      detail:
        "Play 3 to 5 games while deliberately entering the line you reviewed. Your only goal is to reach the repaired structure with a clear plan.",
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
          <h2>Your 7-day / 20-minute opening plan</h2>
          <p>
            A rating-aware plan based on your imported games. Each step is built
            for one focused 20-minute session.
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
