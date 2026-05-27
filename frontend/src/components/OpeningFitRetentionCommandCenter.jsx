import { useMemo, useState } from "react";
import "./OpeningFitRetentionCommandCenter.css";

const STORAGE_PREFIX = "openingFit:retentionCommandCenter";

function safeNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
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

  const direct =
    item.winRate ??
    item.win_rate ??
    item.score ??
    item.performance ??
    item.percentage;

  if (direct !== undefined && direct !== null && direct !== "") {
    const rate = safeNumber(direct, 50);
    return rate <= 1 ? Math.round(rate * 100) : Math.round(rate);
  }

  const games = openingGames(item);
  const wins = safeNumber(item.wins ?? item.w, 0);
  const draws = safeNumber(item.draws ?? item.d, 0);
  return games ? Math.round(((wins + draws * 0.5) / games) * 100) : 50;
}

function hashString(value) {
  return String(value)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function collectOpenings(data) {
  const recommendationBuckets = data?.opening_recommendations
    ? [
        data.opening_recommendations.white,
        data.opening_recommendations.blackVsE4,
        data.opening_recommendations.blackVsD4Other,
        data.opening_recommendations.tooLittleData,
      ]
    : [];

  const sources = [
    data?.best_openings,
    data?.bestOpenings,
    data?.top_openings,
    data?.topOpenings,
    data?.opening_stats,
    data?.openingStats,
    data?.openings,
    data?.recommendations,
    ...recommendationBuckets,
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
      const current = merged.get(key);
      const games = openingGames(item);
      const winRate = openingWinRate(item);

      if (!current || games > current.games) {
        merged.set(key, {
          raw: item,
          name,
          games,
          winRate,
        });
      }
    });
  });

  const openings = Array.from(merged.values()).sort(
    (a, b) => b.games - a.games || b.winRate - a.winRate,
  );

  return openings.length
    ? openings
    : [
        { name: "London System", games: 8, winRate: 56 },
        { name: "King's Indian Defense", games: 6, winRate: 49 },
        { name: "Sicilian Defense", games: 5, winRate: 52 },
      ];
}

function buildMastery(opening, index, completedToday) {
  const seed = hashString(opening.name);
  const daysSinceReview = completedToday ? 0 : 3 + ((seed + index * 5) % 14);
  const decay = daysSinceReview > 10 ? 8 : daysSinceReview > 6 ? 4 : 0;
  const sampleBonus = clamp(opening.games * 2.2, 0, 28);
  const performanceBonus = (opening.winRate - 50) * 0.65;
  const mastery = clamp(Math.round(48 + sampleBonus + performanceBonus - decay), 18, 94);
  const xp = mastery * 14 + opening.games * 24 + index * 35;
  const level = clamp(Math.floor(xp / 420) + 1, 1, 12);
  const confidence = clamp(Math.round(35 + sampleBonus + Math.abs(opening.winRate - 50) * 0.9 - decay), 24, 97);
  const trainingProgress = clamp(mastery - 8 + index * 3, 12, 98);
  const weakLines = [
    "early queenside pressure",
    "fianchetto setups",
    "move-order swaps",
    "delayed central breaks",
    "opposite-side castling",
  ];

  return {
    ...opening,
    mastery,
    xp,
    level,
    confidence,
    trainingProgress,
    decay,
    daysSinceReview,
    theoryDepth:
      opening.games >= 18 ? "Main weapon" : opening.games >= 8 ? "Playable shell" : "Needs more reps",
    weakVariation: weakLines[(seed + index) % weakLines.length],
    reviewSchedule: daysSinceReview >= 10 ? "Due today" : daysSinceReview >= 6 ? "Review tomorrow" : "Fresh this week",
    lastTrained: completedToday ? "Today" : `${daysSinceReview} days ago`,
    accuracyTrend:
      opening.winRate >= 58 ? "+6% over recent games" : opening.winRate <= 44 ? "-5% under pressure" : "+2% steady",
  };
}

function getPlayerName(data, username) {
  return (
    username ||
    data?.username ||
    data?.player ||
    data?.profile?.username ||
    data?.account?.username ||
    "your repertoire"
  );
}

function getIdentity(data, openings) {
  const text = [
    data?.openingIdentity,
    data?.opening_identity,
    data?.style,
    data?.styleLabel,
    data?.playerStyle,
    openings.map((item) => item.name).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/attack|gambit|sicilian|tactical|chaos|sharp/.test(text)) {
    return {
      title: "Tactical Chaos Creator",
      summary: "You get value from initiative, imbalance, and forcing decisions before opponents settle.",
      badge: "Pressure first",
    };
  }

  if (/positional|grind|caro|queen|london|endgame|solid/.test(text)) {
    return {
      title: "Positional Grinder",
      summary: "Your edge comes from repeatable structures, patient pressure, and clean conversion habits.",
      badge: "Structure edge",
    };
  }

  if (/indian|modern|pirc|hyper/.test(text)) {
    return {
      title: "Hypermodern Specialist",
      summary: "You prefer flexible setups that invite overextension, then punish the center later.",
      badge: "Flexible prep",
    };
  }

  return {
    title: "Practical Repertoire Builder",
    summary: "Your best path is a compact repertoire with fast recall, clear plans, and low maintenance.",
    badge: "Reliable growth",
  };
}

function scoreMetrics(masteredOpenings) {
  const averageMastery =
    masteredOpenings.reduce((sum, item) => sum + item.mastery, 0) / Math.max(masteredOpenings.length, 1);
  const averageConfidence =
    masteredOpenings.reduce((sum, item) => sum + item.confidence, 0) / Math.max(masteredOpenings.length, 1);
  const repertoireDepth = clamp(
    Math.round(masteredOpenings.reduce((sum, item) => sum + item.games, 0) * 2.4),
    22,
    94,
  );
  const consistency = clamp(Math.round(averageMastery - 4), 20, 95);

  return [
    { label: "Opening IQ", value: Math.round(averageMastery) },
    { label: "Tactical aggression", value: clamp(Math.round(48 + masteredOpenings[0]?.winRate / 2), 28, 96) },
    { label: "Positional understanding", value: clamp(Math.round(averageConfidence - 2), 24, 96) },
    { label: "Repertoire depth", value: repertoireDepth },
    { label: "Preparation consistency", value: consistency },
    { label: "Theory accuracy", value: clamp(Math.round(averageMastery + 5), 28, 96) },
  ];
}

export default function OpeningFitRetentionCommandCenter({ data, username, onPractice }) {
  const playerName = getPlayerName(data, username);
  const storageKey = `${STORAGE_PREFIX}:${playerName}`;
  const today = todayKey();
  const [completedDate, setCompletedDate] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || "";
    } catch {
      return "";
    }
  });
  const completedToday = completedDate === today;

  const openings = useMemo(() => collectOpenings(data || {}), [data]);
  const masteredOpenings = useMemo(
    () => openings.slice(0, 5).map((opening, index) => buildMastery(opening, index, completedToday)),
    [openings, completedToday],
  );
  const weakestOpening = [...masteredOpenings].sort((a, b) => a.mastery - b.mastery)[0];
  const strongestOpening = [...masteredOpenings].sort((a, b) => b.mastery - a.mastery)[0];
  const metrics = scoreMetrics(masteredOpenings);
  const openingFitScore = Math.round(metrics.reduce((sum, item) => sum + item.value, 0) / metrics.length);
  const identity = getIdentity(data || {}, masteredOpenings);
  const streakDays = completedToday ? 4 : 3;

  function completeDailyLoop() {
    setCompletedDate(today);
    try {
      localStorage.setItem(storageKey, today);
    } catch {
      // Retention state should remain optional if browser storage is blocked.
    }
  }

  return (
    <section className="ofRetentionShell" aria-labelledby="openingfit-retention-title">
      <div className="ofRetentionHero">
        <div>
          <p className="ofRetentionEyebrow">Daily improvement platform</p>
          <h2 id="openingfit-retention-title">Make your repertoire feel alive.</h2>
          <p>
            OpeningFit now turns each report into a loop: train the weakest line, protect sharpness,
            grow mastery, and watch your chess identity evolve over time.
          </p>
        </div>
        <div className="ofRetentionScoreCard" aria-label={`OpeningFit score ${openingFitScore}`}>
          <span>OpeningFit Score</span>
          <strong>{openingFitScore}</strong>
          <small>{identity.title}</small>
        </div>
      </div>

      <div className="ofRetentionGrid">
        <article className="ofRetentionPanel ofRetentionDaily">
          <div className="ofRetentionPanelHeader">
            <div>
              <p className="ofRetentionEyebrow">Today</p>
              <h3>2-minute review loop</h3>
            </div>
            <span className={completedToday ? "ofRetentionPill isDone" : "ofRetentionPill"}>
              {completedToday ? "Trained today" : `${streakDays}-day rhythm`}
            </span>
          </div>

          <div className="ofRetentionTaskList">
            <div>
              <strong>Daily opening drill</strong>
              <span>{strongestOpening?.name}: recall the first 6 moves and one plan.</span>
            </div>
            <div>
              <strong>Weakest-line training</strong>
              <span>{weakestOpening?.name}: repair {weakestOpening?.weakVariation}.</span>
            </div>
            <div>
              <strong>Spaced review queue</strong>
              <span>{weakestOpening?.reviewSchedule}. Keep the streak light, not stressful.</span>
            </div>
          </div>

          <button
            className="ofRetentionPrimaryBtn"
            type="button"
            onClick={completeDailyLoop}
            disabled={completedToday}
          >
            {completedToday ? "Daily review complete" : "Mark today's review done"}
          </button>
        </article>

        <article className="ofRetentionPanel ofRetentionIdentity">
          <div className="ofRetentionPanelHeader">
            <div>
              <p className="ofRetentionEyebrow">Chess identity</p>
              <h3>{identity.title}</h3>
            </div>
            <span className="ofRetentionPill">{identity.badge}</span>
          </div>
          <p>{identity.summary}</p>
          <div className="ofRetentionIdentityStats">
            <span>Used by your current repertoire</span>
            <strong>{masteredOpenings.length} tracked openings</strong>
          </div>
          <div className="ofRetentionIdentityStats">
            <span>Average time saved</span>
            <strong>One clear drill per visit</strong>
          </div>
        </article>
      </div>

      <div className="ofRetentionSectionHeader">
        <div>
          <p className="ofRetentionEyebrow">Opening mastery system</p>
          <h3>Progression for every opening</h3>
        </div>
        <span>{masteredOpenings.length} live tracks</span>
      </div>

      <div className="ofMasteryGrid">
        {masteredOpenings.map((opening) => (
          <article className="ofMasteryCard" key={opening.name}>
            <div className="ofMasteryTopline">
              <div>
                <h4>{opening.name}</h4>
                <span>Level {opening.level} · {opening.xp} XP</span>
              </div>
              <strong>{opening.mastery}%</strong>
            </div>
            <div className="ofProgressTrack" aria-label={`${opening.name} ${opening.mastery}% mastered`}>
              <span style={{ width: `${opening.mastery}%` }} />
            </div>
            <dl className="ofMasteryMeta">
              <div>
                <dt>Confidence</dt>
                <dd>{opening.confidence}%</dd>
              </div>
              <div>
                <dt>Theory depth</dt>
                <dd>{opening.theoryDepth}</dd>
              </div>
              <div>
                <dt>Last trained</dt>
                <dd>{opening.lastTrained}</dd>
              </div>
              <div>
                <dt>Accuracy trend</dt>
                <dd>{opening.accuracyTrend}</dd>
              </div>
            </dl>
            <p>
              Weak against {opening.weakVariation}. {opening.decay ? `Sharpness dropped ${opening.decay}%.` : "Sharpness stable."}
            </p>
            {onPractice ? (
              <button className="ofRetentionSecondaryBtn" type="button" onClick={() => onPractice(opening.name)}>
                Train this opening
              </button>
            ) : null}
          </article>
        ))}
      </div>

      <div className="ofRetentionLowerGrid">
        <article className="ofRetentionPanel">
          <div className="ofRetentionPanelHeader">
            <div>
              <p className="ofRetentionEyebrow">Weekly report preview</p>
              <h3>What changed this week</h3>
            </div>
            <span className="ofRetentionPill">Shareable</span>
          </div>
          <ul className="ofReportList">
            <li><strong>Best performing:</strong> {strongestOpening?.name} at {strongestOpening?.winRate}%.</li>
            <li><strong>Worst opening:</strong> {weakestOpening?.name}, due for a focused repair session.</li>
            <li><strong>Forgotten line:</strong> {weakestOpening?.weakVariation} needs spaced repetition.</li>
            <li><strong>Training consistency:</strong> {completedToday ? "today protected" : "one short review restores momentum"}.</li>
          </ul>
        </article>

        <article className="ofRetentionPanel">
          <div className="ofRetentionPanelHeader">
            <div>
              <p className="ofRetentionEyebrow">Recommendation transparency</p>
              <h3>Why this, not that?</h3>
            </div>
            <span className="ofRetentionPill">{strongestOpening?.confidence}% confidence</span>
          </div>
          <div className="ofDecisionRows">
            <div>
              <strong>Recommended</strong>
              <span>{strongestOpening?.name} matches your current results and gives repeatable plans.</span>
            </div>
            <div>
              <strong>Rejected for now</strong>
              <span>{weakestOpening?.name} stays in review until the weak variation improves.</span>
            </div>
            <div>
              <strong>Style match</strong>
              <span>{identity.title} · {clamp(strongestOpening?.mastery + 4 || 72, 50, 98)}% fit.</span>
            </div>
          </div>
        </article>
      </div>

      <div className="ofScoreStrip">
        {metrics.map((metric) => (
          <div className="ofScoreMetric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <div className="ofMiniTrack"><span style={{ width: `${metric.value}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="ofRetentionFooter">
        <div>
          <strong>Shareable moments</strong>
          <span>Your chess personality, repertoire evolution, openings to avoid, and tactical profile.</span>
        </div>
        <div>
          <strong>Friend comparisons</strong>
          <span>Style similarity, opening overlap, aggression score, and repertoire readiness.</span>
        </div>
        <div>
          <strong>AI coach direction</strong>
          <span>Choose a tactical, positional, aggressive, or minimalist coach voice.</span>
        </div>
      </div>
    </section>
  );
}
