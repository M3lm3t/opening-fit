import { getOpeningContext } from "./OpeningEvidence";

function getOpeningName(opening) {
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
  return Number(opening?.games ?? opening?.count ?? opening?.total ?? opening?.played ?? 0);
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

function collectOpenings(data) {
  const possibleSources = [
    data?.topOpenings,
    data?.top_openings,
    data?.openingStats,
    data?.opening_stats,
    data?.openings,
    data?.openingTable,
    data?.opening_table,
  ];

  for (const source of possibleSources) {
    if (Array.isArray(source)) return source;
    if (source && typeof source === "object") return Object.values(source);
  }

  return [];
}

function cleanOpenings(data) {
  return collectOpenings(data)
    .map((opening) => ({
      name: getOpeningName(opening),
      games: getGames(opening),
      winRate: getWinRate(opening),
      colour:
        opening?.colour ||
        opening?.color ||
        opening?.side ||
        opening?.player_color ||
        "",
      context: opening?.context || opening?.repertoireContext || opening?.contextLabel || "",
    }))
    .filter((opening) => {
      const lower = opening.name.toLowerCase();

      return (
        opening.games > 0 &&
        !["unknown", "unknown opening", "uncommon opening"].includes(lower)
      );
    });
}

function pickBest(openings, side) {
  const sideOpenings = openings.filter((opening) => {
    if (!side) return true;

    return getOpeningContext(opening).type === side;
  });

  const pool = sideOpenings.length ? sideOpenings : openings;

  return [...pool]
    .filter((opening) => opening.games >= 2)
    .sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.games - a.games;
    })[0];
}

function pickWeakest(openings) {
  return [...openings]
    .filter((opening) => opening.games >= 2)
    .sort((a, b) => {
      if (a.winRate !== b.winRate) return a.winRate - b.winRate;
      return b.games - a.games;
    })[0];
}

function pickMostPlayed(openings) {
  return [...openings].sort((a, b) => b.games - a.games)[0];
}

function fallbackOpening(label) {
  return {
    name: label,
    games: 0,
    winRate: 0,
    fallback: true,
  };
}

export default function RepertoireStudyPlan({ data }) {
  if (!data) return null;

  const openings = cleanOpenings(data);
  const repertoireOpenings = openings.filter((opening) =>
    ["white", "black"].includes(getOpeningContext(opening).type)
  );

  const whitePick =
    pickBest(repertoireOpenings, "white") ||
    fallbackOpening("Choose a main White opening");

  const blackPick =
    pickBest(repertoireOpenings, "black") ||
    fallbackOpening("Choose a reliable Black defence");

  const studyTarget =
    pickWeakest(repertoireOpenings) ||
    pickMostPlayed(repertoireOpenings) ||
    fallbackOpening("Import more games to find a study target");

  const anchorOpening = whitePick?.fallback ? blackPick : whitePick;

  return (
    <section className="repertoirePlanShell">
      <div className="repertoirePlanHeader">
        <div>
          <p className="repertoirePlanEyebrow">Action plan</p>
          <h2>Your recommended repertoire path</h2>
          <p>
            Use this as your short-term study direction. Keep the repertoire simple,
            focus on one improvement target, then re-import games to check progress.
          </p>
        </div>
      </div>

      <div className="repertoirePlanGrid">
        <PlanCard
          label="Main White weapon"
          opening={whitePick}
          type="white"
          text="Use this as your main opening with White. Build depth around common plans rather than memorising too many sidelines."
        />

        <PlanCard
          label="Main Black defence"
          opening={blackPick}
          type="black"
          text="Use this as your reliable Black option. The goal is to reach familiar middlegames with fewer early mistakes."
        />

        <PlanCard
          label="Study target"
          opening={studyTarget}
          type="study"
          text="This is where focused study should give the biggest return. Review losses and identify the first recurring mistake."
        />
      </div>

      <div className="studyTimeline">
        <div className="studyTimelineStep">
          <strong>Week 1</strong>
          <span>
            Review 3 recent games in <b>{anchorOpening.name}</b>. Write down the
            first position where you felt unsure.
          </span>
        </div>

        <div className="studyTimelineStep">
          <strong>Week 2</strong>
          <span>
            Learn the main plan, not just the move order. Focus on development,
            pawn breaks, and typical piece placement.
          </span>
        </div>

        <div className="studyTimelineStep">
          <strong>Week 3</strong>
          <span>
            Play at least 10 games using the same repertoire choice. Do not switch
            openings too quickly.
          </span>
        </div>

        <div className="studyTimelineStep">
          <strong>Week 4</strong>
          <span>
            Re-import your games and compare the results. Keep what improved and
            replace what still feels uncomfortable.
          </span>
        </div>
      </div>

      <div className="premiumCoachNote">
        <div>
          <strong>Why this matters</strong>
          <span>
            Most club players jump between openings too often. A simple repertoire
            gives you repeat positions, clearer plans, and faster improvement.
          </span>
        </div>
      </div>
    </section>
  );
}

function PlanCard({ label, opening, type, text }) {
  const context = getOpeningContext(opening);

  return (
    <article className={`repertoirePlanCard repertoirePlanCard-${type}`}>
      <div className="repertoirePlanCardTop">
        <span>{label}</span>
      </div>

      <h3>{opening.name}</h3>
      {!opening.fallback ? <p className="repertoirePlanContext">{context.label}</p> : null}

      {!opening.fallback ? (
        <div className="repertoirePlanStats">
          <div>
            <strong>{opening.games}</strong>
            <small>games</small>
          </div>

          <div>
            <strong>{opening.winRate}%</strong>
            <small>score</small>
          </div>
        </div>
      ) : null}

      <p>{text}</p>
    </article>
  );
}
