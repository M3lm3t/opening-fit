import { useMemo } from "react";

function getOpeningName(item) {
  return (
    item?.opening ||
    item?.name ||
    item?.ecoName ||
    item?.opening_name ||
    item?.label ||
    "Unknown opening"
  );
}

function getGames(item) {
  return Number(item?.games ?? item?.count ?? item?.total ?? 0);
}

function getWinRate(item) {
  const direct = item?.winRate ?? item?.win_rate ?? item?.score;
  if (typeof direct === "number") return direct > 1 ? direct : Math.round(direct * 100);

  const wins = Number(item?.wins ?? item?.w ?? 0);
  const draws = Number(item?.draws ?? item?.d ?? 0);
  const games = getGames(item);

  if (!games) return 0;
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function collectOpenings(data) {
  const possible =
    data?.openingStats ||
    data?.openings ||
    data?.topOpenings ||
    data?.verdicts ||
    data?.opening_win_rates ||
    [];

  if (Array.isArray(possible)) return possible;

  if (possible && typeof possible === "object") {
    return Object.entries(possible).map(([name, value]) => ({
      name,
      ...(typeof value === "object" ? value : { games: value }),
    }));
  }

  return [];
}

function PremiumLockedCard({ title, children, isPremium }) {
  if (isPremium) {
    return (
      <div className="premiumInsightCard">
        <div className="premiumCardTopline">Premium unlocked</div>
        <h3>{title}</h3>
        {children}
      </div>
    );
  }

  return (
    <div className="premiumInsightCard premiumLockedCard">
      <div className="premiumLockBadge">Premium</div>
      <h3>{title}</h3>
      <div className="premiumBlur">{children}</div>
      <div className="premiumLockOverlay">
        <strong>Unlock this section</strong>
        <span>Get the full repertoire plan, weakness report and weekly training path.</span>
      </div>
    </div>
  );
}

export default function PremiumPanel({ data, isPremium, onUnlockDemo, onResetDemo }) {
  const openings = useMemo(() => {
    return collectOpenings(data)
      .map((item) => ({
        ...item,
        displayName: getOpeningName(item),
        games: getGames(item),
        winRate: getWinRate(item),
      }))
      .filter((item) => item.displayName && item.displayName.toLowerCase() !== "unknown opening")
      .sort((a, b) => b.games - a.games);
  }, [data]);

  if (!data) return null;

  const strongOpenings = openings
    .filter((item) => item.games >= 2 && item.winRate >= 50)
    .slice(0, 3);

  const weakOpenings = openings
    .filter((item) => item.games >= 2 && item.winRate < 45)
    .slice(0, 3);

  const mostPlayed = openings.slice(0, 4);

  const bestWhite =
    strongOpenings[0]?.displayName ||
    mostPlayed[0]?.displayName ||
    "your highest scoring White opening";

  const bestBlack =
    strongOpenings[1]?.displayName ||
    mostPlayed[1]?.displayName ||
    "a simple reliable Black setup";

  const biggestLeak =
    weakOpenings[0]?.displayName ||
    "inconsistent opening choices";

  return (
    <section className="premiumFoundationShell" id="premium">
      <div className="premiumHeroCard">
        <div>
          <div className="premiumEyebrow">OpeningFit Premium</div>
          <h2>Turn your games into a personal opening plan.</h2>
          <p>
            Premium should not just show more stats. It should tell players what to keep,
            what to fix, and exactly what to study next.
          </p>
        </div>

        <div className="premiumDemoBox">
          <span className={isPremium ? "premiumStatus unlocked" : "premiumStatus locked"}>
            {isPremium ? "Premium demo unlocked" : "Free preview mode"}
          </span>

          <button type="button" className="premiumPrimaryBtn" onClick={onUnlockDemo}>
            Unlock Premium Demo
          </button>

          <button type="button" className="premiumGhostBtn" onClick={onResetDemo}>
            Reset Free Preview
          </button>
        </div>
      </div>

      <div className="premiumValueGrid">
        <div className="premiumSummaryCard">
          <span>Your current plan</span>
          <h3>{bestWhite}</h3>
          <p>
            Your strongest fit appears to be built around <strong>{bestWhite}</strong>.
            The next step is turning this into a simple repeatable repertoire instead of
            guessing game by game.
          </p>
        </div>

        <div className="premiumSummaryCard">
          <span>Biggest leak</span>
          <h3>{biggestLeak}</h3>
          <p>
            Your lowest-value area looks like <strong>{biggestLeak}</strong>. Premium should
            focus the training plan here first because this is where quick rating gains are
            most likely.
          </p>
        </div>

        <div className="premiumSummaryCard">
          <span>Suggested promise</span>
          <h3>£8 lifetime early access</h3>
          <p>
            Best offer for now: a low one-time price while the app is improving. Avoid a
            monthly subscription until the saved dashboard and deeper analysis are stronger.
          </p>
        </div>
      </div>

      <div className="premiumCardsGrid">
        <PremiumLockedCard title="Full repertoire builder" isPremium={isPremium}>
          <div className="premiumRepertoireGrid">
            <div>
              <h4>White plan</h4>
              <ul>
                <li>Build around: {bestWhite}</li>
                <li>Backup option: simple queen-pawn system</li>
                <li>Goal: reach familiar middlegames by move 6–8</li>
              </ul>
            </div>

            <div>
              <h4>Black plan</h4>
              <ul>
                <li>Against 1.e4: {bestBlack}</li>
                <li>Against 1.d4: solid development setup</li>
                <li>Goal: reduce unknown positions early</li>
              </ul>
            </div>
          </div>
        </PremiumLockedCard>

        <PremiumLockedCard title="Opening weakness detector" isPremium={isPremium}>
          <div className="premiumWeaknessList">
            {weakOpenings.length ? (
              weakOpenings.map((item) => (
                <div className="premiumWeaknessRow" key={item.displayName}>
                  <span>{item.displayName}</span>
                  <strong>{item.winRate}%</strong>
                  <small>{item.games} games</small>
                </div>
              ))
            ) : (
              <>
                <div className="premiumWeaknessRow">
                  <span>Unknown / inconsistent openings</span>
                  <strong>Review</strong>
                  <small>Improve move-order confidence</small>
                </div>
                <div className="premiumWeaknessRow">
                  <span>Black repertoire gaps</span>
                  <strong>Fix</strong>
                  <small>Choose one response per main first move</small>
                </div>
              </>
            )}
          </div>
        </PremiumLockedCard>

        <PremiumLockedCard title="Weekly training plan" isPremium={isPremium}>
          <ol className="premiumTrainingPlan">
            <li>
              <strong>Day 1:</strong> Review your most-played opening and write down the first
              6 moves you want.
            </li>
            <li>
              <strong>Day 2:</strong> Replay two wins and two losses in {bestWhite}.
            </li>
            <li>
              <strong>Day 3:</strong> Fix one weak line from {biggestLeak}.
            </li>
            <li>
              <strong>Day 4:</strong> Play five rapid games using only the recommended plan.
            </li>
            <li>
              <strong>Day 5:</strong> Re-import games and compare results.
            </li>
          </ol>
        </PremiumLockedCard>
      </div>
    </section>
  );
}
