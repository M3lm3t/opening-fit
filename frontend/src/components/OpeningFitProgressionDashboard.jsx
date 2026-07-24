import { useMemo, useState } from "react";
import "./OpeningFitProgressionDashboard.css";

function safeNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function openingName(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.opening || item?.openingName || item?.ecoName || "";
}

function openingGames(item) {
  if (!item || typeof item === "string") return 0;
  return safeNumber(item.games ?? item.count ?? item.totalGames ?? item.played, 0);
}

function openingWinRate(item) {
  if (!item || typeof item === "string") return 50;
  const direct = item.winRate ?? item.win_rate ?? item.score ?? item.performance ?? item.percentage;

  if (direct !== undefined && direct !== null && direct !== "") {
    const rate = safeNumber(direct, 50);
    return rate <= 1 ? Math.round(rate * 100) : Math.round(rate);
  }

  const games = openingGames(item);
  const wins = safeNumber(item.wins ?? item.w, 0);
  const draws = safeNumber(item.draws ?? item.d, 0);
  return games ? Math.round(((wins + draws * 0.5) / games) * 100) : 50;
}

function collectOpenings(data) {
  const sources = [
    data?.best_openings,
    data?.bestOpenings,
    data?.top_openings,
    data?.topOpenings,
    data?.opening_stats,
    data?.openingStats,
    data?.openings,
    data?.recommendations,
    data?.opening_recommendations?.white,
    data?.opening_recommendations?.blackVsE4,
    data?.opening_recommendations?.blackVsD4Other,
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
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const games = openingGames(item);
      const winRate = openingWinRate(item);
      const existing = merged.get(key);

      if (!existing || games > existing.games) {
        merged.set(key, { name, games, winRate });
      }
    });
  });

  const openings = Array.from(merged.values()).sort((a, b) => b.games - a.games || b.winRate - a.winRate);
  return openings.length
    ? openings
    : [
        { name: "London System", games: 8, winRate: 56 },
        { name: "King's Indian Defence", games: 6, winRate: 49 },
        { name: "Sicilian Defence", games: 5, winRate: 52 },
      ];
}

function getIdentity(data, openings) {
  const text = [
    data?.openingIdentity,
    data?.opening_identity,
    data?.style,
    data?.styleLabel,
    openings.map((item) => item.name).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/attack|gambit|sicilian|tactical|chaos|sharp/.test(text)) return "Tactical Chaos Creator";
  if (/indian|modern|pirc|hyper/.test(text)) return "Hypermodern Specialist";
  if (/endgame/.test(text)) return "Endgame Technician";
  if (/positional|grind|caro|queen|london|solid/.test(text)) return "Positional Grinder";
  return "Practical Repertoire Builder";
}

function buildDashboard(data) {
  const openings = collectOpenings(data);
  const strongest = [...openings].sort((a, b) => b.winRate - a.winRate || b.games - a.games)[0];
  const weakest = [...openings].sort((a, b) => a.winRate - b.winRate || b.games - a.games)[0];
  const totalGames = openings.reduce((sum, item) => sum + item.games, 0);
  const avgWinRate = openings.reduce((sum, item) => sum + item.winRate, 0) / openings.length;
  const readiness = clamp(Math.round(avgWinRate * 0.72 + Math.min(totalGames, 60) * 0.45), 28, 96);
  const consistency = clamp(Math.round(42 + openings.length * 7 + Math.min(totalGames, 35) * 0.55), 32, 94);
  const identity = getIdentity(data || {}, openings);
  const graphBase = clamp(readiness - 16, 24, 80);
  const graph = Array.from({ length: 7 }, (_, index) =>
    clamp(Math.round(graphBase + index * 3 + ((index % 2 ? 4 : -1) + openings.length)), 24, 96),
  );

  return {
    openings: openings.slice(0, 5),
    strongest,
    weakest,
    totalGames,
    readiness,
    consistency,
    identity,
    graph,
    achievements: [
      `${openings.length} openings mapped`,
      `${strongest?.name || "Main repertoire"} became your strongest track`,
      `${weakest?.name || "Weakest line"} added to the repair queue`,
    ],
  };
}

const coachModes = [
  {
    id: "tactical",
    label: "Tactical coach",
    text: "Pushes forcing lines, initiative, and practical traps.",
  },
  {
    id: "positional",
    label: "Positional coach",
    text: "Prioritizes structures, plans, and calm conversion.",
  },
  {
    id: "minimalist",
    label: "Minimalist coach",
    text: "Gives the shortest useful review and one next action.",
  },
];

export default function OpeningFitProgressionDashboard({ data, username }) {
  const dashboard = useMemo(() => buildDashboard(data || {}), [data]);
  const [coachMode, setCoachMode] = useState("minimalist");
  const selectedCoach = coachModes.find((mode) => mode.id === coachMode) || coachModes[0];
  const player = username || data?.username || data?.player || "Your profile";

  return (
    <section className="ofProgressDashboard" aria-labelledby="of-progression-title">
      <div className="ofProgressHeader">
        <div>
          <p className="ofProgressEyebrow">Progress</p>
          <h2 id="of-progression-title">Track how your openings are changing.</h2>
          <p>Each import shows your repertoire health, weak lines, and next training focus.</p>
        </div>
        <div className="ofReadinessDial">
          <span>Readiness</span>
          <strong>{dashboard.readiness}%</strong>
          <small>{dashboard.identity}</small>
        </div>
      </div>

      <div className="ofProgressOverviewGrid">
        <article>
          <span>Current repertoire</span>
          <strong>{dashboard.openings.length} tracked openings</strong>
          <p>{player} has {dashboard.totalGames} games feeding this opening profile.</p>
        </article>
        <article>
          <span>Strongest opening</span>
          <strong>{dashboard.strongest?.name}</strong>
          <p>{dashboard.strongest?.winRate}% score. Keep this opening sharp with a light review.</p>
        </article>
        <article>
          <span>Weakest opening</span>
          <strong>{dashboard.weakest?.name}</strong>
          <p>{dashboard.weakest?.winRate}% score. This is the next line to repair.</p>
        </article>
        <article>
          <span>Training consistency</span>
          <strong>{dashboard.consistency}%</strong>
          <p>Built as a friendly rhythm, not a stressful streak.</p>
        </article>
      </div>

      <div className="ofProgressMainGrid">
        <article className="ofProgressPanel">
          <div className="ofProgressPanelHeader">
            <div>
              <p className="ofProgressEyebrow">Improvement graph</p>
              <h3>Opening readiness trend</h3>
            </div>
            <span>7-day view</span>
          </div>
          <div className="ofTrendGraph" aria-label="Seven day readiness trend">
            {dashboard.graph.map((value, index) => (
              <div className="ofTrendBar" key={`${value}-${index}`}>
                <span style={{ height: `${value}%` }} />
                <small>{index === 6 ? "Now" : `D${index + 1}`}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="ofProgressPanel">
          <div className="ofProgressPanelHeader">
            <div>
              <p className="ofProgressEyebrow">Recent achievements</p>
              <h3>Dopamine without pressure</h3>
            </div>
            <span>Unlocked</span>
          </div>
          <div className="ofAchievementList">
            {dashboard.achievements.map((achievement) => (
              <div key={achievement}>
                <strong>{achievement}</strong>
                <span>Progress saved to this report cycle.</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="ofProgressMainGrid">
        <article className="ofProgressPanel">
          <div className="ofProgressPanelHeader">
            <div>
              <p className="ofProgressEyebrow">Shareable profile</p>
              <h3>Social hooks users remember</h3>
            </div>
            <span>{dashboard.identity}</span>
          </div>
          <div className="ofShareCardGrid">
            <div>
              <strong>Your chess personality</strong>
              <span>{dashboard.identity}</span>
            </div>
            <div>
              <strong>Best openings for your style</strong>
              <span>{dashboard.strongest?.name} leads the current profile.</span>
            </div>
            <div>
              <strong>Openings to avoid today</strong>
              <span>{dashboard.weakest?.name} needs review before more blitz reps.</span>
            </div>
          </div>
        </article>

        <article className="ofProgressPanel">
          <div className="ofProgressPanelHeader">
            <div>
              <p className="ofProgressEyebrow">Friend comparison</p>
              <h3>Reason to come back with someone</h3>
            </div>
            <span>Preview</span>
          </div>
          <div className="ofComparisonTable" role="table" aria-label="Friend comparison preview">
            <div role="row">
              <span role="cell">Style similarity</span>
              <strong role="cell">Compare after invite</strong>
            </div>
            <div role="row">
              <span role="cell">Opening overlap</span>
              <strong role="cell">{dashboard.openings.length} yours</strong>
            </div>
            <div role="row">
              <span role="cell">More aggressive</span>
              <strong role="cell">Based on tactical profile</strong>
            </div>
          </div>
        </article>
      </div>

      <article className="ofProgressCoachPanel">
        <div>
          <p className="ofProgressEyebrow">Opening coach</p>
          <h3>{selectedCoach.label}</h3>
          <p>{selectedCoach.text} Today it would focus on {dashboard.weakest?.name} and keep the session under 2 minutes.</p>
        </div>
        <div className="ofCoachModeGroup" aria-label="Coach mode">
          {coachModes.map((mode) => (
            <button
              className={coachMode === mode.id ? "isActive" : ""}
              key={mode.id}
              type="button"
              onClick={() => setCoachMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}
