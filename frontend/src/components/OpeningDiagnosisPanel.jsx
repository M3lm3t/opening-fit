import { useMemo } from "react";
import { getPlayerLevelText } from "./playerLevelLogic";
import { getOpeningSignal } from "./OpeningEvidence";

function getOpeningName(opening) {
  return (
    opening?.name ||
    opening?.opening ||
    opening?.eco_name ||
    opening?.label ||
    "Unknown opening"
  );
}

function getGames(opening) {
  return Number(opening?.games ?? opening?.count ?? opening?.total ?? 0);
}

function getWins(opening) {
  return Number(opening?.wins ?? opening?.w ?? opening?.win ?? 0);
}

function getDraws(opening) {
  return Number(opening?.draws ?? opening?.d ?? opening?.draw ?? 0);
}

function getLosses(opening) {
  return Number(opening?.losses ?? opening?.l ?? opening?.loss ?? 0);
}

function getWinRate(opening) {
  const direct =
    opening?.winRate ??
    opening?.win_rate ??
    opening?.score ??
    opening?.percentage;

  if (typeof direct === "number") {
    return direct <= 1 ? Math.round(direct * 100) : Math.round(direct);
  }

  const games = getGames(opening);
  if (!games) return 0;

  const wins = getWins(opening);
  const draws = getDraws(opening);

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function getOpenings(data) {
  const raw = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];

  const seen = new Set();

  return raw
    .filter((opening) => {
      const name = getOpeningName(opening).trim();
      const clean = name.toLowerCase();

      if (!name || seen.has(clean)) return false;

      seen.add(clean);

      return ![
        "unknown",
        "unknown opening",
        "uncommon opening",
        "other",
        "misc",
      ].includes(clean);
    })
    .map((opening) => ({
      raw: opening,
      name: getOpeningName(opening),
      games: getGames(opening),
      wins: getWins(opening),
      draws: getDraws(opening),
      losses: getLosses(opening),
      winRate: getWinRate(opening),
    }))
    .filter((opening) => opening.games > 0);
}

function getPlayerTier(data) {
  const rating = Number(
    data?.rating ??
      data?.chesscomRating ??
      data?.chesscom_rating ??
      data?.lichessRating ??
      data?.lichess_rating ??
      data?.rapidRating ??
      data?.rapid_rating ??
      data?.blitzRating ??
      data?.blitz_rating ??
      data?.bulletRating ??
      data?.bullet_rating ??
      data?.player_level?.rating ??
      data?.playerLevel?.rating ??
      0
  );
  const level = getPlayerLevelText(data).toLowerCase();
  const title = String(
    data?.title ??
      data?.chessTitle ??
      data?.chess_title ??
      data?.fideTitle ??
      data?.fide_title ??
      data?.playerTitle ??
      data?.player_title ??
      data?.profile?.title ??
      ""
  )
    .trim()
    .toLowerCase();
  const titledPlayer = ["gm", "im", "fm", "cm", "wgm", "wim", "wfm", "wcm"].includes(title);

  if (rating >= 2400 || titledPlayer || level.includes("master") || level.includes("elite")) {
    return "elite";
  }

  if (rating >= 2200 || level.includes("expert")) return "strong";
  if (rating >= 1800 || level.includes("advanced")) return "club";
  return "developing";
}

function isStrongProfile(data) {
  const tier = getPlayerTier(data);
  return tier === "elite" || tier === "strong";
}

function getSampleTier(games) {
  return getOpeningSignal({ games, score: 50 }).tier;
}

function getVerdict(opening, data, index = 0) {
  const tier = getPlayerTier(data);
  const strongProfile = tier === "elite" || tier === "strong";
  const signal = getOpeningSignal(opening);
  const mainOpening = index <= 2 && signal.tier === "strong";
  const sampleTier = getSampleTier(opening.games);

  if (sampleTier === "none" || sampleTier === "low") {
    return {
      label: sampleTier === "none" ? "No reliable data" : "Too few games",
      tone: "neutral",
      reason:
        "Too few games to make a firm call. Treat this as a trend to watch, not a recommendation.",
      action: "Collect more games before making a final call.",
    };
  }

  if (tier === "elite" && mainOpening && opening.winRate >= 45) {
    return {
      label: "Main weapon",
      tone: "positive",
      reason:
        "This is a heavily played opening for an elite player. Treat it as a core repertoire choice unless a deeper branch-level review proves otherwise.",
      action:
        "Audit recurring loss structures, opponent rating bands, and move-order details rather than replacing the opening.",
    };
  }

  if (tier === "strong" && mainOpening && opening.winRate >= 45) {
    return {
      label: "Main weapon",
      tone: "positive",
      reason:
        "This is used often enough to look like a trusted part of the repertoire. Mixed recent results should trigger review, not replacement.",
      action:
        "Review losses by structure and variation before drawing conclusions from the headline win rate.",
    };
  }

  if (strongProfile && opening.winRate < 48) {
    return {
      label: mainOpening ? "Promising but unstable" : "Needs review",
      tone: "warning",
      reason:
        "The opening itself may still be completely viable. Recent results point to specific lines or middlegame structures worth checking.",
      action:
        "Review losses by structure and variation before drawing conclusions from the headline win rate.",
    };
  }

  if (opening.winRate >= 60) {
    return {
      label: mainOpening ? "Main weapon" : "Reliable choice",
      tone: "positive",
      reason:
        "This opening is giving you a strong return. It likely suits your current decision-making and middlegame comfort.",
      action:
        "Keep it as part of your main repertoire and learn one deeper plan rather than switching openings.",
    };
  }

  if (opening.winRate >= 48) {
    return {
      label: "Promising but unstable",
      tone: "warning",
      reason:
        "This opening is playable for you, but it is not yet a strength. There are likely one or two repeat mistakes costing points.",
      action:
        "Review losses in this line and identify the first move where your position becomes uncomfortable.",
    };
  }

  return {
    label: "Needs review",
    tone: "danger",
    reason:
      "This opening is currently dragging your results down. That does not mean it is bad, but it may not fit your current style or understanding.",
    action:
      "Pause it temporarily, simplify the line, or replace it with a more reliable system.",
  };
}

function scrollToTarget(targetId) {
  const target = document.getElementById(targetId);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function OpeningDiagnosisPanel({ data, onViewChange }) {
  const strongProfile = isStrongProfile(data);
  const diagnosis = useMemo(() => {
    if (!data) return null;

    const openings = getOpenings(data);

    const reliable = openings.filter((opening) => opening.games >= 2);

    const keep = [...reliable]
      .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
      .slice(0, 2);

    const improve = [...reliable]
      .filter((opening) => opening.winRate < 58)
      .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
      .slice(0, 3);

    const mostPlayed = [...openings]
      .sort((a, b) => b.games - a.games)
      .slice(0, 1);

    const selected = [...keep, ...improve, ...mostPlayed];

    const unique = [];
    const seen = new Set();

    for (const opening of selected) {
      const key = opening.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(opening);
      }
    }

    return unique.slice(0, 5);
  }, [data]);

  if (!data || !diagnosis || diagnosis.length === 0) {
    return null;
  }

  const goTraining = () => {
    if (typeof onViewChange === "function") {
      onViewChange("train");
    }

    setTimeout(() => scrollToTarget("next-actions"), 80);
  };

  const goProgress = () => {
    if (typeof onViewChange === "function") {
      onViewChange("profile");
    }

    setTimeout(() => scrollToTarget("report-history"), 80);
  };

  return (
    <section className="openingDiagnosisPanel" id="opening-diagnosis">
      <div className="diagnosisHeader">
        <div>
          <p className="eyebrow">Opening diagnosis</p>
          <h2>What your openings are telling us</h2>
          <p>
            {strongProfile
              ? "This turns your opening stats into a repertoire audit. The goal is to protect core weapons, find branch-level issues, and avoid overreacting to variance."
              : "This turns your opening stats into practical coaching decisions. The goal is not to learn more openings — it is to keep what works, fix what is costing points, and avoid lines that do not currently fit."}
          </p>
        </div>
      </div>

      <div className="diagnosisGrid">
        {diagnosis.map((opening, index) => {
          const verdict = getVerdict(opening, data, index);

          return (
            <article className={`diagnosisCard ${verdict.tone}`} key={opening.name}>
              <div className="diagnosisCardTop">
                <span>{verdict.label}</span>
                <strong>{opening.winRate}%</strong>
              </div>

              <h3>{opening.name}</h3>

              <div className="diagnosisStats">
                <span>{opening.games} games</span>
                <span>{opening.wins}W</span>
                <span>{opening.draws}D</span>
                <span>{opening.losses}L</span>
              </div>

              <p>{verdict.reason}</p>

              <div className="diagnosisAction">
                <strong>Next move:</strong>
                <span>{verdict.action}</span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="diagnosisFooter">
        <button type="button" onClick={goTraining}>
          Turn this into training
        </button>

        <button type="button" onClick={goProgress}>
          Save and track progress
        </button>
      </div>
    </section>
  );
}
