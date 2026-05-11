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

  if (typeof direct === "number") {
    return direct > 1 ? Math.round(direct) : Math.round(direct * 100);
  }

  const games = getGames(item);
  const wins = Number(item?.wins ?? item?.w ?? 0);
  const draws = Number(item?.draws ?? item?.d ?? 0);

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
    data?.openingWinRates ||
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

function isUnknownOpening(name) {
  const normalised = String(name || "").trim().toLowerCase();

  return (
    !normalised ||
    normalised === "unknown" ||
    normalised === "unknown opening" ||
    normalised.includes("uncommon opening")
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function OpeningHealthScore({ data }) {
  const health = useMemo(() => {
    if (!data) return null;

    const allOpenings = collectOpenings(data).map((item) => ({
      name: getOpeningName(item),
      games: getGames(item),
      winRate: getWinRate(item),
    }));

    const known = allOpenings
      .filter((item) => !isUnknownOpening(item.name))
      .filter((item) => item.games > 0)
      .sort((a, b) => b.games - a.games);

    const unknown = allOpenings.filter((item) => isUnknownOpening(item.name));
    const reliable = known.filter((item) => item.games >= 2);
    const strong = reliable.filter((item) => item.winRate >= 55);
    const weak = reliable.filter((item) => item.winRate < 45);

    const totalKnownGames = known.reduce((sum, item) => sum + item.games, 0);
    const totalUnknownGames = unknown.reduce((sum, item) => sum + item.games, 0);
    const totalGames = totalKnownGames + totalUnknownGames;

    const weightedScore = totalKnownGames
      ? Math.round(
          known.reduce((sum, item) => sum + item.winRate * item.games, 0) / totalKnownGames
        )
      : 0;

    const unknownPenalty = totalGames ? Math.round((totalUnknownGames / totalGames) * 20) : 0;
    const weakPenalty = Math.min(20, weak.length * 5);
    const varietyPenalty = known.length > 12 ? 8 : known.length > 8 ? 4 : 0;
    const strongBonus = Math.min(12, strong.length * 4);

    const score = clamp(
      Math.round(weightedScore - unknownPenalty - weakPenalty - varietyPenalty + strongBonus),
      0,
      100
    );

    let label = "Needs structure";
    let verdict = "Your openings look a little scattered. Pick one main White plan and one Black plan first.";

    if (score >= 80) {
      label = "Strong repertoire";
      verdict = "Your opening choices look healthy. Keep refining your best lines and track progress over time.";
    } else if (score >= 65) {
      label = "Good foundation";
      verdict = "You have a decent base. The next gain is fixing your weakest opening and reducing random choices.";
    } else if (score >= 50) {
      label = "Mixed results";
      verdict = "There is useful data here, but your repertoire needs simplifying before adding more openings.";
    }

    const best = strong.sort((a, b) => b.winRate - a.winRate)[0] || reliable[0] || known[0];
    const weakest = weak.sort((a, b) => a.winRate - b.winRate)[0] || reliable[1] || known[1];

    const positives = [];
    const fixes = [];

    if (best) positives.push(`Build around ${best.name}.`);
    if (strong.length) positives.push(`${strong.length} opening${strong.length === 1 ? "" : "s"} scoring 55%+.`);
    if (known.length <= 8 && known.length > 0) positives.push("Your repertoire is not too bloated.");

    if (weakest) fixes.push(`Fix ${weakest.name} first.`);
    if (unknownPenalty > 0) fixes.push("Reduce unknown or unclear opening choices.");
    if (varietyPenalty > 0) fixes.push("You may be playing too many different openings.");
    if (!strong.length) fixes.push("You need one reliable opening to build confidence around.");

    return {
      score,
      label,
      verdict,
      best,
      weakest,
      knownCount: known.length,
      weakCount: weak.length,
      strongCount: strong.length,
      unknownGames: totalUnknownGames,
      positives: positives.slice(0, 3),
      fixes: fixes.slice(0, 3),
    };
  }, [data]);

  if (!data || !health) return null;

  const scoreStyle = {
    "--health-score": `${health.score}%`,
  };

  return (
    <section className="openingHealthShell" id="opening-health">
      <div className="openingHealthMain">
        <div className="openingHealthScoreCircle" style={scoreStyle}>
          <div>
            <strong>{health.score}</strong>
            <span>/100</span>
          </div>
        </div>

        <div className="openingHealthCopy">
          <div className="openingHealthEyebrow">Opening Health Score</div>
          <h2>{health.label}</h2>
          <p>{health.verdict}</p>
        </div>

        <div className="openingHealthStats">
          <div>
            <strong>{health.knownCount}</strong>
            <span>Openings tracked</span>
          </div>

          <div>
            <strong>{health.strongCount}</strong>
            <span>Strong openings</span>
          </div>

          <div>
            <strong>{health.weakCount}</strong>
            <span>Need work</span>
          </div>
        </div>
      </div>

      <div className="openingHealthGrid">
        <div className="openingHealthCard good">
          <span>What is working</span>

          {health.positives.length ? (
            <ul>
              {health.positives.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>Import more games to find a clear strength.</p>
          )}
        </div>

        <div className="openingHealthCard fix">
          <span>What to fix next</span>

          {health.fixes.length ? (
            <ul>
              {health.fixes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No urgent opening weakness found yet.</p>
          )}
        </div>

        <div className="openingHealthCard next">
          <span>Best next move</span>
          <p>
            Save this import in Progress Tracker, then build your repertoire around{" "}
            <strong>{health.best?.name || "your best opening"}</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}
