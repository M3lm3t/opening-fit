import {
  collectOpenings,
  collectRatings,
  displayOpeningName,
  getBackendDataQuality,
  getOpeningGames,
  getOpeningScore,
  getSmartPlayerLevelProfile,
  safeNumber,
} from "./playerLevelLogic";

const TACTICAL_TERMS = [
  "gambit",
  "sicilian",
  "vienna",
  "scotch",
  "danish",
  "englund",
  "benko",
  "attack",
];

const POSITIONAL_TERMS = [
  "caro-kann",
  "french",
  "london",
  "queen's gambit",
  "slav",
  "catalan",
  "reti",
  "réti",
  "english",
  "italian",
  "nimzo",
  "colle",
];

const BLACK_TERMS = [
  "defence",
  "defense",
  "sicilian",
  "french",
  "caro-kann",
  "scandinavian",
  "pirc",
  "dutch",
  "nimzo",
  "king's indian",
  "queen's indian",
  "slav",
  "benoni",
  "englund",
];

const WHITE_TERMS = [
  "london",
  "vienna",
  "italian",
  "ruy lopez",
  "scotch",
  "king's gambit",
  "queen's gambit",
  "english opening",
  "reti",
  "réti",
  "colle",
  "wayward queen",
];

function matchesAny(name = "", terms = []) {
  const lower = String(name || "").toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function normaliseCoach(data) {
  return data?.ai_chess_coach || data?.aiChessCoach || null;
}

function openingSide(opening) {
  const explicit = String(
    opening?.colour ||
      opening?.color ||
      opening?.side ||
      opening?.playerColor ||
      opening?.player_colour ||
      ""
  ).toLowerCase();

  if (explicit.includes("white")) return "white";
  if (explicit.includes("black")) return "black";

  const name = displayOpeningName(opening);

  if (matchesAny(name, BLACK_TERMS)) return "black";
  if (matchesAny(name, WHITE_TERMS)) return "white";

  return "mixed";
}

function confidenceLabel(games, totalGames) {
  const share = totalGames ? games / totalGames : 0;

  if (games >= 20 || (games >= 12 && share >= 0.1)) return "High";
  if (games >= 8 || (games >= 5 && share >= 0.06)) return "Medium";
  return "Low";
}

function impactLabel(opening, averageScore = 50) {
  const score = getOpeningScore(opening);
  const games = getOpeningGames(opening);
  const gap = score === null ? 8 : Math.max(0, averageScore - score);
  const low = Math.max(2, Math.min(8, Math.round(gap / 7) + (games >= 12 ? 2 : 1)));
  return `${low}-${Math.min(12, low + 3)}%`;
}

function resultPhrase(opening) {
  const score = getOpeningScore(opening);

  if (score === null) return "unclear results";
  if (score >= 58) return "strong results";
  if (score >= 48) return "playable but improvable results";
  if (score >= 40) return "fragile results";
  return "costly results";
}

function weightedScore(items) {
  const games = items.reduce((sum, item) => sum + getOpeningGames(item), 0);
  if (!games) return null;

  const total = items.reduce(
    (sum, item) => sum + getOpeningGames(item) * (getOpeningScore(item) ?? 0),
    0
  );

  return Math.round((total / games) * 10) / 10;
}

function buildFallbackCoach(data) {
  const openings = collectOpenings(data, { includeUnknown: false });
  const quality = getBackendDataQuality(data);
  const gameCount =
    safeNumber(quality?.games_checked, null) ??
    safeNumber(quality?.gamesChecked, null) ??
    safeNumber(data?.gamesImported, null) ??
    safeNumber(data?.totalGames, null) ??
    openings.reduce((sum, item) => sum + getOpeningGames(item), 0);
  const useful = openings
    .filter((item) => getOpeningScore(item) !== null && getOpeningGames(item) >= 2)
    .sort((a, b) => {
      const scoreDiff = (getOpeningScore(a) ?? 100) - (getOpeningScore(b) ?? 100);
      if (scoreDiff) return scoreDiff;
      return getOpeningGames(b) - getOpeningGames(a);
    });
  const strongest = [...useful].sort((a, b) => (getOpeningScore(b) ?? -1) - (getOpeningScore(a) ?? -1))[0];
  const target = useful.find((item) => openingSide(item) === "black") || useful[0] || strongest;
  const targetName = target ? displayOpeningName(target, data) : "your most repeated opening";
  const whiteScore = weightedScore(useful.filter((item) => openingSide(item) === "white"));
  const blackScore = weightedScore(useful.filter((item) => openingSide(item) === "black"));
  const tacticalGames = openings
    .filter((item) => matchesAny(displayOpeningName(item, data), TACTICAL_TERMS))
    .reduce((sum, item) => sum + getOpeningGames(item), 0);
  const positionalGames = openings
    .filter((item) => matchesAny(displayOpeningName(item, data), POSITIONAL_TERMS))
    .reduce((sum, item) => sum + getOpeningGames(item), 0);
  const preference =
    tacticalGames > positionalGames * 1.2
      ? "Tactical"
      : positionalGames > tacticalGames * 1.2
        ? "Positional"
        : "Balanced";
  const repeatOpenings = openings.filter((item) => getOpeningGames(item) >= 5).length;
  const averageScore = weightedScore(useful) ?? 50;

  return {
    headline: `Study ${targetName} next`,
    summary:
      "The fastest improvement path is to fix one repeated weak spot, then test it in real games before adding more theory.",
    recommendations: [
      {
        priority: 1,
        title:
          openingSide(target) === "black"
            ? `Focus on defending with ${targetName} first`
            : `Make ${targetName} your first study target`,
        coach_note: target
          ? `${targetName} has ${getOpeningGames(target)} games with ${resultPhrase(target)}.`
          : "There is enough signal to start with one narrow study block.",
        action:
          "Review the first position where you stop knowing the plan, then save one simple line you will repeat for 10 games.",
        confidence: confidenceLabel(getOpeningGames(target), gameCount),
        estimated_impact: impactLabel(target, averageScore),
      },
      whiteScore !== null && blackScore !== null
        ? {
            priority: 2,
            title:
              whiteScore > blackScore
                ? "Your white repertoire is stronger than black"
                : "Your black repertoire is stronger than white",
            coach_note: `White is scoring ${whiteScore}% and Black is scoring ${blackScore}%.`,
            action: "Spend the next study block on the weaker side before learning a new opening.",
            confidence: "Medium",
            estimated_impact: "4-8%",
          }
        : null,
      strongest && target
        ? {
            priority: 3,
            title: `Use ${displayOpeningName(strongest, data)} as your model`,
            coach_note: "Your strongest opening shows the type of position you already handle well.",
            action: `Copy that clarity into ${targetName}: pawn structure, piece squares, and one middlegame plan.`,
            confidence: "Medium",
            estimated_impact: "3-6%",
          }
        : null,
    ].filter(Boolean),
    roadmap: [
      {
        phase: "This week",
        title: `Stabilise ${targetName}`,
        task: "Study one main line, one common sideline, and the first middlegame plan.",
      },
      {
        phase: "Next 10 games",
        title: "Repeat it on purpose",
        task: "Track whether you reached a familiar position by move 8.",
      },
      {
        phase: "After 20 games",
        title: "Re-import and compare",
        task: "Check whether the target line is moving toward a healthier score.",
      },
    ],
    opening_improvement_suggestions: useful.slice(0, 3).map((item) => ({
      opening: displayOpeningName(item, data),
      side: openingSide(item),
      issue: resultPhrase(item),
      suggestion: "Learn one anti-line or simplify the move order before playing it again.",
      confidence: confidenceLabel(getOpeningGames(item), gameCount),
      estimated_impact: impactLabel(item, averageScore),
    })),
    style_analysis: {
      label:
        data?.styleLabel ||
        data?.style_profile?.primary ||
        data?.styleProfile?.primary ||
        `${preference} practical player`,
      summary:
        data?.styleSummary ||
        data?.style_profile?.summary ||
        data?.styleProfile?.summary ||
        "Your best study plan should connect openings to the middlegames you actually enjoy playing.",
    },
    preference_detection: {
      label: preference,
      tactical_games: tacticalGames,
      positional_games: positionalGames,
      summary:
        preference === "Tactical"
          ? "You seem most comfortable when the opening creates immediate contact and forcing choices."
          : preference === "Positional"
            ? "Your repertoire leans toward structure, repeatable plans, and slower pressure."
            : "Your games show a mix of tactical and positional openings.",
    },
    consistency_analysis: {
      label:
        repeatOpenings >= 4
          ? "Consistent repertoire"
          : openings.length >= 12
            ? "Scattered repertoire"
            : "Moderate consistency",
      summary:
        repeatOpenings >= 4
          ? "You repeat enough openings to build habits and measure progress quickly."
          : "Narrowing the repertoire for the next block will make improvement easier to measure.",
      repeat_openings: repeatOpenings,
      opening_variety: openings.length,
    },
  };
}

function coachValue(value, fallback = "") {
  return value || fallback;
}

export default function IntelligentCoachInsights({ data }) {
  if (!data) return null;

  const coach = normaliseCoach(data) || buildFallbackCoach(data);
  const rating = collectRatings(data) || getSmartPlayerLevelProfile(data)?.rating;
  const style = coach.style_analysis || coach.styleAnalysis || {};
  const preference = coach.preference_detection || coach.preferenceDetection || {};
  const consistency = coach.consistency_analysis || coach.consistencyAnalysis || {};
  const openingSuggestions =
    coach.opening_improvement_suggestions || coach.openingImprovementSuggestions || [];

  return (
    <section className="aiCoachShell" aria-labelledby="ai-coach-title">
      <div className="aiCoachHeader">
        <div>
          <div className="aiCoachEyebrow">AI chess coach</div>
          <h2 id="ai-coach-title">What Should You Study Next?</h2>
          <p>{coach.summary}</p>
        </div>

        <div className="aiCoachFocus">
          <span>Coach focus</span>
          <strong>{coach.headline}</strong>
          <small>{rating ? `Calibrated around rating ${rating}` : "Calibrated from your imported games"}</small>
        </div>
      </div>

      <div className="coachRecommendationGrid">
        {(coach.recommendations || []).map((item) => (
          <article className="coachRecommendationCard" key={`${item.priority}-${item.title}`}>
            <div className="coachCardTopline">
              <span>Priority {item.priority}</span>
              <strong>{coachValue(item.confidence, "Medium")} confidence</strong>
            </div>
            <h3>{item.title}</h3>
            <p>{item.coach_note || item.coachNote}</p>
            <div className="coachActionBox">{item.action}</div>
            <div className="coachImpactLabel">
              Studying this line may improve your {String(item.title || "").toLowerCase().includes("black") ? "black" : "opening"} win rate by {item.estimated_impact || item.estimatedImpact || "3-6%"}
            </div>
          </article>
        ))}
      </div>

      <div className="coachRoadmapShell">
        <div className="coachSubhead">
          <span>Personalized study roadmap</span>
          <strong>One repair, then measured reps</strong>
        </div>
        <div className="coachRoadmap">
          {(coach.roadmap || []).map((step) => (
            <article key={`${step.phase}-${step.title}`}>
              <span>{step.phase}</span>
              <h3>{step.title}</h3>
              <p>{step.task}</p>
            </article>
          ))}
        </div>
      </div>

      {openingSuggestions.length ? (
        <div className="coachOpeningSuggestions">
          <div className="coachSubhead">
            <span>Opening improvement suggestions</span>
            <strong>Small fixes with visible upside</strong>
          </div>
          <div className="coachSuggestionList">
            {openingSuggestions.map((item) => (
              <article key={`${item.opening}-${item.side}`}>
                <div>
                  <span>{coachValue(item.side, "mixed")} side</span>
                  <h3>{item.opening}</h3>
                  <p>{item.suggestion}</p>
                </div>
                <div className="coachSuggestionMeta">
                  <strong>{item.estimated_impact || item.estimatedImpact || "3-6%"}</strong>
                  <small>{coachValue(item.confidence, "Medium")} confidence</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="coachPatternGrid">
        <article>
          <span>Opening style analysis</span>
          <strong>{coachValue(style.label, "Practical player")}</strong>
          <p>{style.summary}</p>
        </article>
        <article>
          <span>Tactical vs positional</span>
          <strong>{coachValue(preference.label, "Balanced")}</strong>
          <p>{preference.summary}</p>
        </article>
        <article>
          <span>Consistency analysis</span>
          <strong>{coachValue(consistency.label, "Moderate consistency")}</strong>
          <p>{consistency.summary}</p>
        </article>
      </div>
    </section>
  );
}
