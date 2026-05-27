import { useEffect, useMemo, useState } from "react";
import { getRetentionMetricSummary, recordRetentionMetric } from "../services/retentionMetrics";
import "./OpeningFitRetentionSystems.css";

function safeNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
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
      const current = merged.get(key);
      if (!current || games > current.games) merged.set(key, { name, games, winRate });
    });
  });

  const openings = Array.from(merged.values()).sort((a, b) => a.winRate - b.winRate || b.games - a.games);
  return openings.length
    ? openings
    : [
        { name: "Sicilian Defense", games: 7, winRate: 46 },
        { name: "London System", games: 8, winRate: 56 },
        { name: "King's Indian Defense", games: 6, winRate: 49 },
      ];
}

function buildRetentionPlan(data) {
  const openings = collectOpenings(data || {});
  const weakest = openings[0];
  const strongest = [...openings].sort((a, b) => b.winRate - a.winRate || b.games - a.games)[0];
  const weakLineCount = Math.min(3, Math.max(1, openings.filter((item) => item.winRate < 52).length));
  const masteryGrowth = Math.max(6, Math.min(18, Math.round((strongest?.winRate || 55) - (weakest?.winRate || 48))));

  return {
    openings,
    weakest,
    strongest,
    weakLineCount,
    masteryGrowth,
    spacedRepetition: [
      {
        label: "Opening line",
        title: weakest?.name || "Weakest opening",
        due: "Today",
        detail: "Recall the main plan, then test the first move-order trap.",
      },
      {
        label: "Trap",
        title: "Early tactic check",
        due: "Tomorrow",
        detail: "Review the tactic that appears when opponents delay development.",
      },
      {
        label: "Move order",
        title: strongest?.name || "Main weapon",
        due: "This week",
        detail: "Protect your strongest line from fading with one light review.",
      },
    ],
  };
}

const achievementRows = [
  ["7-day streak", "Complete one short review for seven active days."],
  ["First opening mastered", "Reach 80% mastery on any opening track."],
  ["Tactical specialist", "Build a profile around sharp, forcing recommendations."],
  ["Theory grinder", "Complete repeated spaced-repetition reviews."],
  ["Repertoire builder", "Track five opening families across reports."],
  ["Accuracy milestone", "Improve a weak line by 10% or more."],
];

export default function OpeningFitRetentionSystems({ data, username }) {
  const plan = useMemo(() => buildRetentionPlan(data), [data]);
  const [summary, setSummary] = useState(() => getRetentionMetricSummary());
  const player = username || data?.username || data?.player || "OpeningFit player";

  useEffect(() => {
    recordRetentionMetric("retention_dashboard_viewed", { player }, { dedupeKey: `${player}:dashboard` });
    setSummary(getRetentionMetricSummary());
  }, [player]);

  function handleReminderPreview() {
    recordRetentionMetric("review_reminder_previewed", {
      player,
      opening: plan.weakest?.name,
      weakLineCount: plan.weakLineCount,
    });
    setSummary(getRetentionMetricSummary());
  }

  const kpis = [
    ["D1 retention", `${summary.d1Retention}%`, "Return after first report"],
    ["D7 retention", `${summary.d7Retention}%`, "Weekly report habit"],
    ["D30 retention", `${summary.d30Retention}%`, "Long-term repertoire loop"],
    ["Sessions/week", summary.averageSessionsPerWeek, "Frequency target"],
    ["Training completion", `${summary.trainingCompletionRate}%`, "Daily loop finish rate"],
    ["Mastery growth", `+${Math.max(summary.masteryGrowth, plan.masteryGrowth)}%`, "Opening progress signal"],
  ];

  return (
    <section className="ofRetentionSystems" aria-labelledby="of-retention-systems-title">
      <div className="ofSystemsHeader">
        <div>
          <p className="ofSystemsEyebrow">Retention metrics + systems</p>
          <h2 id="of-retention-systems-title">Track the habits that make users return.</h2>
          <p>
            This layer turns OpeningFit into daily, weekly, and long-term loops:
            train, earn XP, protect sharpness, compare progress, and evolve a chess identity.
          </p>
        </div>
        <div className="ofSystemsNorthStar">
          <span>Primary KPI</span>
          <strong>Returning users</strong>
          <small>{summary.activeDays || 1} active day signal{summary.activeDays === 1 ? "" : "s"}</small>
        </div>
      </div>

      <div className="ofKpiGrid">
        {kpis.map(([label, value, detail]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </div>

      <div className="ofLoopGrid">
        <article>
          <p className="ofSystemsEyebrow">Daily loop</p>
          <h3>Open, train, gain XP</h3>
          <ul>
            <li>Complete today&apos;s drill for {plan.weakest?.name}.</li>
            <li>Review {plan.weakLineCount} weak line{plan.weakLineCount === 1 ? "" : "s"} before they fade.</li>
            <li>Protect streaks with a low-pressure 2-minute session.</li>
          </ul>
        </article>
        <article>
          <p className="ofSystemsEyebrow">Weekly loop</p>
          <h3>Report, compare, unlock</h3>
          <ul>
            <li>Show best and worst opening movement.</li>
            <li>Compare session pace against last week.</li>
            <li>Unlock achievements and shareable report moments.</li>
          </ul>
        </article>
        <article>
          <p className="ofSystemsEyebrow">Long-term loop</p>
          <h3>Build an identity</h3>
          <ul>
            <li>Grow repertoire mastery and opening readiness.</li>
            <li>Track archetype shifts as playstyle evolves.</li>
            <li>Prepare rankings, public profiles, and friend battles.</li>
          </ul>
        </article>
      </div>

      <div className="ofSystemsMainGrid">
        <article className="ofSystemsPanel">
          <div className="ofSystemsPanelHeader">
            <div>
              <p className="ofSystemsEyebrow">Spaced repetition</p>
              <h3>Review queue</h3>
            </div>
            <span>{plan.spacedRepetition.length} due items</span>
          </div>
          <div className="ofSpacedQueue">
            {plan.spacedRepetition.map((item) => (
              <div key={`${item.label}:${item.title}`}>
                <span>{item.label} · {item.due}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="ofSystemsPanel">
          <div className="ofSystemsPanelHeader">
            <div>
              <p className="ofSystemsEyebrow">Notification ideas</p>
              <h3>Return prompts</h3>
            </div>
            <button type="button" onClick={handleReminderPreview}>Preview</button>
          </div>
          <div className="ofNotificationStack">
            <p>Your {plan.weakest?.name} prep is fading.</p>
            <p>You have {plan.weakLineCount} weak line{plan.weakLineCount === 1 ? "" : "s"} to review.</p>
            <p>You gained {Math.max(summary.masteryGrowth, plan.masteryGrowth)}% mastery this week.</p>
            <p>New opening recommendation unlocked from your latest report.</p>
          </div>
        </article>
      </div>

      <div className="ofSystemsMainGrid">
        <article className="ofSystemsPanel">
          <div className="ofSystemsPanelHeader">
            <div>
              <p className="ofSystemsEyebrow">Achievement system</p>
              <h3>Milestones that create momentum</h3>
            </div>
            <span>6 tracks</span>
          </div>
          <div className="ofAchievementSystemGrid">
            {achievementRows.map(([title, detail]) => (
              <div key={title}>
                <strong>{title}</strong>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="ofSystemsPanel">
          <div className="ofSystemsPanelHeader">
            <div>
              <p className="ofSystemsEyebrow">Social retention</p>
              <h3>Reasons to bring friends back</h3>
            </div>
            <span>Next loop</span>
          </div>
          <div className="ofSocialLoopList">
            <div><strong>Share cards</strong><span>Chess personality, repertoire evolution, tactical profile.</span></div>
            <div><strong>Opening battles</strong><span>Compare strongest lines and weak spots head-to-head.</span></div>
            <div><strong>Public profiles</strong><span>Let users show badges, streaks, archetype, and mastery.</span></div>
            <div><strong>Friend challenges</strong><span>Weekly weak-line repair challenge with completion rate.</span></div>
          </div>
        </article>
      </div>
    </section>
  );
}
