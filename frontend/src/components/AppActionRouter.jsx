import { useEffect, useMemo, useState } from "react";

function normalise(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getOpenings(data) {
  const openings = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];

  const seen = new Set();

  return openings.filter((opening) => {
    const name =
      opening?.name ||
      opening?.opening ||
      opening?.eco_name ||
      opening?.label ||
      "Unknown opening";

    const clean = String(name).toLowerCase().trim();

    if (!clean || seen.has(clean)) return false;
    seen.add(clean);

    return !["unknown", "unknown opening", "uncommon opening", "other"].includes(clean);
  });
}

function getGames(opening) {
  return Number(opening?.games ?? opening?.count ?? opening?.total ?? 0);
}

function getWinRate(opening) {
  const direct = opening?.winRate ?? opening?.win_rate ?? opening?.score ?? opening?.percentage;

  if (typeof direct === "number") {
    return direct <= 1 ? Math.round(direct * 100) : Math.round(direct);
  }

  const wins = Number(opening?.wins ?? opening?.w ?? 0);
  const draws = Number(opening?.draws ?? opening?.d ?? 0);
  const games = getGames(opening);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function scrollToTarget(targetId) {
  const target =
    document.getElementById(targetId) ||
    document.querySelector(`[data-section="${targetId}"]`) ||
    document.querySelector(`#${targetId}`);

  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  return false;
}

export function AppOpeningHealthScore({ data, onViewChange }) {
  const score = useMemo(() => {
    if (!data) return null;

    const openings = getOpenings(data);
    const gamesImported =
      Number(data?.games_imported || data?.gamesImported || data?.total_games || data?.game_count || data?.games?.length || 0);

    const knownOpeningCount = openings.length;
    const reliableOpenings = openings.filter((opening) => getGames(opening) >= 3);
    const winRates = reliableOpenings.map(getWinRate).filter((rate) => Number.isFinite(rate));

    const averageScore =
      winRates.length > 0
        ? Math.round(winRates.reduce((total, rate) => total + rate, 0) / winRates.length)
        : 0;

    let total = 35;

    if (gamesImported >= 20) total += 15;
    else if (gamesImported >= 10) total += 10;
    else if (gamesImported >= 5) total += 5;

    if (knownOpeningCount >= 8) total += 15;
    else if (knownOpeningCount >= 4) total += 10;
    else if (knownOpeningCount >= 2) total += 5;

    if (reliableOpenings.length >= 5) total += 15;
    else if (reliableOpenings.length >= 3) total += 10;
    else if (reliableOpenings.length >= 1) total += 5;

    if (averageScore >= 58) total += 20;
    else if (averageScore >= 52) total += 15;
    else if (averageScore >= 47) total += 10;
    else if (averageScore > 0) total += 5;

    const finalScore = Math.max(12, Math.min(96, total));

    let label = "Needs structure";
    let verdict =
      "You have enough data to start building a clearer repertoire, but the app should guide you more tightly.";

    if (finalScore >= 80) {
      label = "Strong opening base";
      verdict =
        "You have a solid foundation. The next step is targeted improvement, not adding random new openings.";
    } else if (finalScore >= 62) {
      label = "Good improvement base";
      verdict =
        "There is a useful pattern in your openings. Focus on your worst repeat positions first.";
    } else if (finalScore >= 45) {
      label = "Early but useful";
      verdict =
        "Opening Fit has enough to give direction, but more games will make recommendations sharper.";
    }

    return {
      finalScore,
      label,
      verdict,
      gamesImported,
      knownOpeningCount,
      reliableCount: reliableOpenings.length,
      averageScore,
    };
  }, [data]);

  if (!data || !score) return null;

  const goTraining = () => {
    if (typeof onViewChange === "function") onViewChange("training");
    setTimeout(() => scrollToTarget("next-actions"), 80);
  };

  const goProgress = () => {
    if (typeof onViewChange === "function") onViewChange("upgrade");
    setTimeout(() => scrollToTarget("report-history"), 80);
  };

  return (
    <section className="openingHealthScore" id="opening-health">
      <div className="healthScoreMain">
        <div>
          <p className="eyebrow">Opening health score</p>
          <h2>{score.label}</h2>
          <p>{score.verdict}</p>
        </div>

        <div className="healthScoreDial" aria-label={`Opening health score ${score.finalScore} out of 100`}>
          <strong>{score.finalScore}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="healthMetricGrid">
        <div>
          <strong>{score.gamesImported || "Recent"}</strong>
          <span>games imported</span>
        </div>
        <div>
          <strong>{score.knownOpeningCount}</strong>
          <span>known openings</span>
        </div>
        <div>
          <strong>{score.reliableCount}</strong>
          <span>repeat openings</span>
        </div>
        <div>
          <strong>{score.averageScore || "—"}{score.averageScore ? "%" : ""}</strong>
          <span>average opening score</span>
        </div>
      </div>

      <div className="healthActionRow">
        <button type="button" onClick={goTraining}>
          Improve weakest opening
        </button>
        <button type="button" onClick={goProgress}>
          View saved progress
        </button>
      </div>
    </section>
  );
}

export default function AppActionRouter({ onViewChange }) {
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return undefined;

    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const routeMap = {
      "overview": { view: "overview", target: "app-results" },
      "view overview": { view: "overview", target: "app-results" },
      "dashboard": { view: "overview", target: "app-results" },

      "repertoire": { view: "repertoire", target: "repertoire-map" },
      "view repertoire": { view: "repertoire", target: "repertoire-map" },
      "view repertoire plan": { view: "repertoire", target: "repertoire-map" },
      "opening suggestions": { view: "openings", target: "section-verdicts" },
      "recommendations": { view: "repertoire", target: "repertoire-map" },

      "training": { view: "training", target: "seven-day-plan" },
      "start training": { view: "training", target: "seven-day-plan" },
      "start training focus": { view: "training", target: "seven-day-plan" },
      "open training": { view: "training", target: "seven-day-plan" },
      "improve weakest opening": { view: "training", target: "seven-day-plan" },

      "games": { view: "data", target: "game-replay" },
      "game replay": { view: "data", target: "game-replay" },
      "view games": { view: "data", target: "game-replay" },

      "progress": { view: "upgrade", target: "report-history" },
      "view progress": { view: "upgrade", target: "report-history" },
      "check progress": { view: "upgrade", target: "report-history" },
      "view saved progress": { view: "upgrade", target: "report-history" },
      "saved reports": { view: "upgrade", target: "report-history" },

      "feedback": { view: "feedback", target: "feedback" },
      "leave feedback": { view: "feedback", target: "feedback" },
      "send feedback": { view: "feedback", target: "feedback" },

      "premium": { view: "upgrade", target: "premium" },
      "upgrade": { view: "upgrade", target: "premium" },
      "upgrade to premium": { view: "upgrade", target: "premium" },
      "learn more": { view: "upgrade", target: "premium" },
    };

    const comingSoonMap = {
      "export pdf": "PDF export is a good premium feature, but it is not wired up yet.",
      "download pdf": "PDF download is not live yet. This should become a premium report export.",
      "share report": "Sharing is not live yet. A shareable report link would be a strong next upgrade.",
      "analyse latest games": "Auto re-analysis is not live yet. For now, import again to refresh your report.",
      "analyze latest games": "Auto re-analysis is not live yet. For now, import again to refresh your report.",
      "connect account": "Full account connection is not live yet. Saved local reports are the bridge for now.",
      "sync account": "Cloud sync is not live yet. This should come with proper login history.",
      "start drill": "Interactive drills are not live yet. This is a strong premium/training upgrade.",
      "start practice": "Interactive practice is not fully wired yet. This should become the next training feature.",
      "create account": "Account creation is not fully live yet. Saved report history is active for now.",
      "sign in": "Opening account menu...",
      "login": "Opening account menu...",
    };

    const handleClick = (event) => {
      const button = event.target.closest("button, a");
      if (!button) return;

      const label =
        normalise(button.getAttribute("aria-label")) ||
        normalise(button.textContent) ||
        normalise(button.getAttribute("title"));

      if (!label) return;

      const exactRoute = routeMap[label];
      const fuzzyRoute = Object.entries(routeMap).find(([key]) => label.includes(key))?.[1];
      const route = exactRoute || fuzzyRoute;

      const exactSoon = comingSoonMap[label];
      const fuzzySoon = Object.entries(comingSoonMap).find(([key]) => label.includes(key))?.[1];
      const soonMessage = exactSoon || fuzzySoon;

      if (route) {
        if (typeof onViewChange === "function") {
          onViewChange(route.view);
        }

        setTimeout(() => {
          const moved = scrollToTarget(route.target);
          if (!moved && route.target !== "app-results") {
            scrollToTarget("app-results");
          }
        }, 80);

        return;
      }

      if (soonMessage) {
        setToast(soonMessage);
      }
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [onViewChange]);

  return (
    <div className={`appActionToast ${toast ? "appActionToastVisible" : ""}`} role="status">
      {toast}
    </div>
  );
}
