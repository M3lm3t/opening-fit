import {
  getSmartLevelAwareRecommendation,
  getSmartPlayerLevelProfile,
} from "./playerLevelLogic";

function getPlayerName(data) {
  return (
    data?.username ||
    data?.playerName ||
    data?.player_name ||
    data?.requestedUsername ||
    data?.requested_username ||
    "your games"
  );
}

function getGames(data) {
  return (
    data?.gamesImported ||
    data?.games_imported ||
    data?.totalGames ||
    data?.total_games ||
    data?.gameCount ||
    data?.game_count ||
    0
  );
}

function openingName(opening) {
  return (
    opening?.name ||
    opening?.opening ||
    opening?.openingName ||
    opening?.ecoName ||
    opening?.displayName ||
    "Opening"
  );
}

function openingGames(opening) {
  return Number(opening?.games ?? opening?.count ?? opening?.total ?? 0);
}

function openingScore(opening) {
  const raw =
    opening?.winRate ??
    opening?.win_rate ??
    opening?.score ??
    opening?.scoreRate ??
    opening?.percentage;

  if (raw === undefined || raw === null || raw === "") return null;

  const number = Number(String(raw).replace("%", ""));
  if (!Number.isFinite(number)) return null;

  return number <= 1 ? Math.round(number * 100) : Math.round(number);
}

function collectOpenings(data) {
  const sources = [
    data?.top_openings,
    data?.topOpenings,
    data?.best_openings,
    data?.bestOpenings,
    data?.preferred_white,
    data?.preferredWhite,
    data?.preferred_black,
    data?.preferredBlack,
    data?.openings,
    data?.recommendations,
  ];

  return sources
    .flatMap((source) => {
      if (!source) return [];
      if (Array.isArray(source)) return source;
      if (typeof source === "object") {
        return Object.entries(source).map(([name, stats]) => ({
          name,
          ...(stats && typeof stats === "object" ? stats : {}),
        }));
      }
      return [];
    })
    .filter(Boolean)
    .filter((opening) => {
      const name = openingName(opening).toLowerCase();
      return (
        name &&
        name !== "opening" &&
        !name.includes("unknown") &&
        !name.includes("uncommon")
      );
    });
}

export default function CleanReportHeader({ data, fitData, onViewChange }) {
  if (!data) return null;

  const playerName = getPlayerName(data);
  const games = getGames(data);

  const openings = collectOpenings(data);

  const bestFromFit = fitData?.bestOpening;
  const weakFromFit = fitData?.weakestOpening;

  const ranked = [...openings].sort((a, b) => {
    const aScore = openingScore(a) ?? -1;
    const bScore = openingScore(b) ?? -1;
    const aGames = openingGames(a);
    const bGames = openingGames(b);

    if (bScore !== aScore) return bScore - aScore;
    return bGames - aGames;
  });

  const weakRanked = [...openings]
    .filter((item) => openingGames(item) >= 2 && openingScore(item) !== null)
    .sort((a, b) => (openingScore(a) ?? 100) - (openingScore(b) ?? 100));

  const bestOpening = bestFromFit || ranked[0];
  const weakOpening = weakFromFit || weakRanked[0] || ranked[1];

  const bestName = bestOpening ? openingName(bestOpening) : "Import more games";
  const weakName = weakOpening ? openingName(weakOpening) : "Not enough data";

  const bestScore =
    bestOpening?.fitScore ?? openingScore(bestOpening) ?? null;

  const weakScore =
    weakOpening?.fitScore ?? openingScore(weakOpening) ?? null;

  const knownOpenings = openings.length;

  const levelProfile = getSmartPlayerLevelProfile(data);
  const backendRecommendation = getSmartLevelAwareRecommendation(data, fitData);

  const style =
    levelProfile?.label ||
    fitData?.playerStyle?.title ||
    data?.styleLabel ||
    data?.style_label ||
    data?.primaryStyle ||
    data?.primary_style ||
    data?.style_profile?.labels?.[0] ||
    "Practical improver";

  const healthScore =
    fitData?.overallScore ||
    data?.openingHealthScore ||
    data?.opening_health_score ||
    data?.data_quality?.confidence ||
    data?.dataQuality?.confidence ||
    null;

  return (
    <section className="cleanInReportHeader">
      <div className="cleanReportMain">
        <div className="cleanReportEyebrow">Opening Fit report</div>

        <h1>
          {playerName}
          <span> — your opening plan</span>
        </h1>

        <p>
          {backendRecommendation.summary ||
            "Based on your recent games, OpeningFit has found what to keep, what to improve, and where your next study focus should be."}
        </p>

        <div className="cleanReportActions">
          <button
            type="button"
            onClick={() => onViewChange?.("recommendations")}
          >
            View recommendations
          </button>

          <button
            type="button"
            onClick={() => onViewChange?.("training")}
          >
            Start training plan
          </button>
        </div>
      </div>

      <div className="cleanReportCards">
        <article>
          <span>Best fit</span>
          <strong>{backendRecommendation.bestName || bestName}</strong>
          <p>
            {bestScore !== null
              ? `${bestScore}/100 current fit`
              : backendRecommendation.source === "backend"
                ? "Backend recommendation signal"
                : "Best result from your known openings"}
          </p>
        </article>

        <article>
          <span>Improve next</span>
          <strong>{backendRecommendation.weakName || weakName}</strong>
          <p>
            {weakScore !== null
              ? `${weakScore}/100 current fit`
              : backendRecommendation.source === "backend"
                ? "Backend repair target"
                : "Review this area first"}
          </p>
        </article>

        <article>
          <span>Profile</span>
          <strong>{style}</strong>
          <p>{games || "Recent"} games checked</p>
        </article>

        <article>
          <span>Opening base</span>
          <strong>{healthScore ? `${healthScore}/100` : knownOpenings}</strong>
          <p>{healthScore ? "overall health score" : "known openings found"}</p>
        </article>
      </div>
    </section>
  );
}
