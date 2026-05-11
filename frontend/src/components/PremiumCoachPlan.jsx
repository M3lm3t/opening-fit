import { useMemo, useState } from "react";

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

function getPlanTheme(openingName) {
  const name = String(openingName || "").toLowerCase();

  if (name.includes("vienna")) {
    return {
      plan: "Direct attacking development",
      focus: "Learn the common Vienna move orders and stop drifting into random King's Pawn positions.",
      rule: "As White, aim for fast development, central control and kingside pressure.",
    };
  }

  if (name.includes("london")) {
    return {
      plan: "Simple structure and repeatable plans",
      focus: "Use the same setup often enough that your middlegame plans become automatic.",
      rule: "Do not rush attacks. Build the structure first, then improve pieces.",
    };
  }

  if (name.includes("sicilian")) {
    return {
      plan: "Sharp counterplay and tactical awareness",
      focus: "Pick one Sicilian setup and stop mixing too many structures.",
      rule: "Prioritise development and king safety before chasing tactics.",
    };
  }

  if (name.includes("caro")) {
    return {
      plan: "Solid defence with clear pawn breaks",
      focus: "Understand when to play ...c5 or ...e5 instead of just surviving the opening.",
      rule: "Trade bad pieces, protect your structure and aim for comfortable middlegames.",
    };
  }

  if (name.includes("scandinavian")) {
    return {
      plan: "Simple development and early queen safety",
      focus: "Avoid moving the queen too many times and get your minor pieces out quickly.",
      rule: "If the queen moves twice, your next moves should usually be development.",
    };
  }

  if (name.includes("queen") || name.includes("d4")) {
    return {
      plan: "Positional development and central control",
      focus: "Learn one reliable setup against common Queen's Pawn structures.",
      rule: "Do not change plans every game. Build around one pawn structure.",
    };
  }

  return {
    plan: "Practical club-player repertoire",
    focus: "Reduce unknown openings and build one repeatable White plan and one Black plan.",
    rule: "For the next 10 games, avoid experimenting. Play the same core setups.",
  };
}

export default function PremiumCoachPlan({ data, isPremium, onUnlockDemo }) {
  const [copied, setCopied] = useState(false);

  const plan = useMemo(() => {
    if (!data) return null;

    const openings = collectOpenings(data)
      .map((item) => ({
        ...item,
        displayName: getOpeningName(item),
        games: getGames(item),
        winRate: getWinRate(item),
      }))
      .filter((item) => !isUnknownOpening(item.displayName))
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        return b.winRate - a.winRate;
      });

    const reliable = openings.filter((item) => item.games >= 2);
    const strong = reliable.filter((item) => item.winRate >= 55).sort((a, b) => b.winRate - a.winRate);
    const weak = reliable.filter((item) => item.winRate < 45).sort((a, b) => a.winRate - b.winRate);

    const mainOpening = strong[0] || reliable[0] || openings[0];
    const weakOpening = weak[0] || reliable[1] || openings[1] || mainOpening;

    const mainName = mainOpening?.displayName || "your most reliable opening";
    const weakName = weakOpening?.displayName || "your least consistent opening";
    const theme = getPlanTheme(mainName);

    return {
      mainName,
      weakName,
      mainWinRate: mainOpening?.winRate || null,
      weakWinRate: weakOpening?.winRate || null,
      mainGames: mainOpening?.games || null,
      weakGames: weakOpening?.games || null,
      ...theme,
    };
  }, [data]);

  if (!data || !plan) return null;

  const copyText = `OpeningFit Premium Coach Plan

Main opening to build around: ${plan.mainName}
Opening weakness to fix: ${plan.weakName}

Plan theme: ${plan.plan}
Main focus: ${plan.focus}
Rule for next 10 games: ${plan.rule}

7-day plan:
Day 1: Write down your first 6-8 moves in ${plan.mainName}.
Day 2: Review two wins in ${plan.mainName} and note what worked.
Day 3: Review two losses in ${plan.weakName} and find where you left comfort.
Day 4: Play three rapid games using only the recommended setup.
Day 5: Study one common sideline you faced.
Day 6: Play five more games and avoid experimenting.
Day 7: Re-import your games and compare the results.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      alert("Could not copy automatically. You can screenshot or manually copy the plan.");
    }
  };

  return (
    <section className={isPremium ? "coachPlanShell" : "coachPlanShell locked"} id="coach-plan">
      <div className="coachPlanHeader">
        <div>
          <div className="coachPlanEyebrow">Premium Coach Plan</div>
          <h2>Your next 7 days of opening study</h2>
          <p>
            This is the kind of feature that can make Premium feel worth paying for:
            not just more analysis, but a clear plan of what to do next.
          </p>
        </div>

        <div className="coachPlanStatus">
          <span>{isPremium ? "Unlocked" : "Premium locked"}</span>
          {isPremium ? (
            <button type="button" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy plan"}
            </button>
          ) : (
            <button type="button" onClick={onUnlockDemo}>
              Unlock demo
            </button>
          )}
        </div>
      </div>

      <div className="coachPlanGrid">
        <div className="coachPrimaryCard">
          <span>Build around</span>
          <h3>{plan.mainName}</h3>
          <p>{plan.focus}</p>

          <div className="coachMiniStats">
            <div>
              <strong>{plan.mainWinRate ? `${plan.mainWinRate}%` : "Best"}</strong>
              <small>Current score</small>
            </div>
            <div>
              <strong>{plan.mainGames || "—"}</strong>
              <small>Games found</small>
            </div>
          </div>
        </div>

        <div className="coachPrimaryCard danger">
          <span>Fix first</span>
          <h3>{plan.weakName}</h3>
          <p>
            This is the opening area to simplify first. The goal is to stop reaching positions
            you do not understand by move 6–8.
          </p>

          <div className="coachMiniStats">
            <div>
              <strong>{plan.weakWinRate ? `${plan.weakWinRate}%` : "Review"}</strong>
              <small>Current score</small>
            </div>
            <div>
              <strong>{plan.weakGames || "—"}</strong>
              <small>Games found</small>
            </div>
          </div>
        </div>

        <div className="coachRuleCard">
          <span>Rule for your next 10 games</span>
          <h3>{plan.rule}</h3>
        </div>
      </div>

      <div className="coachWeekCard">
        <div className="coachWeekHeader">
          <span>7-day plan</span>
          <strong>{plan.plan}</strong>
        </div>

        <div className="coachDaysGrid">
          <div><strong>Day 1</strong><span>Write down your first 6–8 moves in {plan.mainName}.</span></div>
          <div><strong>Day 2</strong><span>Review two wins and note the middlegame plans that worked.</span></div>
          <div><strong>Day 3</strong><span>Review two losses in {plan.weakName} and find where things went wrong.</span></div>
          <div><strong>Day 4</strong><span>Play three rapid games using only the recommended setup.</span></div>
          <div><strong>Day 5</strong><span>Study one common sideline you faced in your own games.</span></div>
          <div><strong>Day 6</strong><span>Play five more games. No experimenting with random openings.</span></div>
          <div><strong>Day 7</strong><span>Re-import your games and compare the results.</span></div>
        </div>
      </div>

      {!isPremium ? (
        <div className="coachLockedOverlay">
          <div>
            <strong>Unlock the full coach plan</strong>
            <span>
              Premium should give users a clear study path, not just extra numbers.
            </span>
          </div>
          <button type="button" onClick={onUnlockDemo}>
            Test Premium Demo
          </button>
        </div>
      ) : null}
    </section>
  );
}
