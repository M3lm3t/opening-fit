import { useMemo } from "react";
import { buildOpeningGamificationSnapshot } from "../services/openingGamification";
import "./OpeningGamificationProgress.css";

function progressPercent(value, total) {
  const current = Number(value) || 0;
  const max = Number(total) || 1;
  return Math.max(4, Math.min(100, Math.round((current / max) * 100)));
}

export default function OpeningGamificationProgress({
  data,
  fitData,
  savedProgress = null,
}) {
  const progress = useMemo(
    () => (data ? buildOpeningGamificationSnapshot(data, fitData, savedProgress || {}) : savedProgress),
    [data, fitData, savedProgress]
  );

  if (!progress?.openingXp?.length) return null;

  const topOpenings = progress.openingXp.slice(0, 6);
  const achievements = progress.achievements || [];

  return (
    <section className="openingGamificationProgress" id="opening-xp">
      <div className="openingGamificationHeader">
        <div>
          <p className="eyebrow">Opening XP</p>
          <h2>Progress that rewards improvement activity</h2>
          <p>
            XP comes from analysed games, played samples, weak-line training, and measurable opening improvement.
            Login alone does not count.
          </p>
        </div>
        <div className="openingTotalXp">
          <span>Total opening XP</span>
          <strong>{Math.round(progress.totalXp || 0)}</strong>
        </div>
      </div>

      <div className="openingXpGrid">
        {topOpenings.map((opening) => (
          <article className="openingXpCard" key={opening.name}>
            <div className="openingXpTop">
              <div>
                <strong>{opening.name}</strong>
                <span>Level {opening.level}</span>
              </div>
              <span>{opening.earnedThisReport ? `+${opening.earnedThisReport} XP` : `${opening.score}%`}</span>
            </div>
            <div className="openingXpBar" aria-label={`${opening.name} XP progress`}>
              <i style={{ width: `${progressPercent(opening.currentLevelXp, opening.nextLevelXp)}%` }} />
            </div>
            <div className="openingXpMeta">
              <span>{opening.currentLevelXp} / {opening.nextLevelXp} XP</span>
              <span>{opening.games} games</span>
            </div>
          </article>
        ))}
      </div>

      <div className="openingStreakGrid">
        {Object.values(progress.streaks || {}).map((streak) => (
          <article className="openingStreakCard" key={streak.label}>
            <div className="openingStreakTop">
              <strong>{streak.label}</strong>
              <span>{streak.current}/{streak.target}</span>
            </div>
            <div className="openingStreakBar">
              <i style={{ width: `${progressPercent(streak.current, streak.target)}%` }} />
            </div>
          </article>
        ))}
      </div>

      <div className="openingBadgeGrid" aria-label="OpeningFit achievement badges">
        {achievements.map((badge) => (
          <article className={`openingBadgeCard ${badge.unlocked ? "isUnlocked" : ""}`} key={badge.key}>
            <span>{badge.unlocked ? "Unlocked" : "Locked"}</span>
            <strong>{badge.title}</strong>
            <p>{badge.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
