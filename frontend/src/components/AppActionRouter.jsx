import { useEffect, useMemo, useState } from "react";
import { navigateApp } from "../appNavigation";

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
    if (typeof onViewChange === "function") onViewChange("train");
    setTimeout(() => scrollToTarget("next-actions"), 80);
  };

  const goProgress = () => {
    if (typeof onViewChange === "function") onViewChange("profile");
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
      "analyse": { view: "analyse", target: "import", path: "/" },
      "analyze": { view: "analyse", target: "import", path: "/" },
      "analyse new games": { view: "analyse", target: "import", path: "/" },
      "analyse username": { view: "analyse", target: "import", path: "/" },
      "start an import": { view: "analyse", target: "import", path: "/" },
      "import": { view: "analyse", target: "import", path: "/" },
      "import games": { view: "analyse", target: "import", path: "/" },
      "go to analyse": { view: "analyse", target: "import", path: "/" },
      "get started": { view: "analyse", target: "import", path: "/" },

      "report": { view: "report", target: "app-results", path: "/report" },
      "go to report": { view: "report", target: "app-results", path: "/report" },
      "view report": { view: "report", target: "app-results", path: "/report" },
      "view example report": { view: "report", target: "app-results", path: "/report" },
      "view sample report": { view: "report", target: "app-results", path: "/report" },
      "try demo": { view: "report", target: "app-results", path: "/report" },
      "example report": { view: "report", target: "app-results", path: "/report" },
      "sample report": { view: "report", target: "app-results", path: "/report" },
      "full report": { view: "report", target: "openingfit-verdict", path: "/report" },
      "see verdicts": { view: "report", target: "full-report-highlights", path: "/report" },
      "see what we learned": { view: "report", target: "evidence-table", path: "/report" },
      "evidence table": { view: "report", target: "evidence-table", path: "/report" },

      "repertoire": { view: "report", target: "recommended-repertoire", path: "/report" },
      "view repertoire": { view: "report", target: "recommended-repertoire", path: "/report" },
      "view my repertoire": { view: "report", target: "recommended-repertoire", path: "/report" },
      "view recommendations": { view: "report", target: "recommended-repertoire", path: "/report" },
      "recommendations": { view: "report", target: "recommended-repertoire", path: "/report" },
      "opening suggestions": { view: "report", target: "recommended-repertoire", path: "/report" },

      "train": { view: "train", target: "training-plan", path: "/train" },
      "training": { view: "train", target: "training-plan", path: "/train" },
      "start training": { view: "train", target: "training-plan", path: "/train" },
      "start training plan": { view: "train", target: "training-plan", path: "/train" },
      "start training focus": { view: "train", target: "training-plan", path: "/train" },
      "open training": { view: "train", target: "training-plan", path: "/train" },
      "open study plan": { view: "train", target: "study-planner", path: "/train" },
      "study plan": { view: "train", target: "study-planner", path: "/train" },
      "add to study plan": { view: "train", target: "training-plan", path: "/train" },
      "practice": { view: "train", target: "opening-practice", path: "/train" },
      "replay": { view: "train", target: "game-replay", path: "/train" },
      "games": { view: "train", target: "game-replay", path: "/train" },
      "game replay": { view: "train", target: "game-replay", path: "/train" },
      "view games": { view: "train", target: "game-replay", path: "/train" },
      "data": { view: "train", target: "game-replay", path: "/train" },

      "profile": { view: "profile", target: "profile", path: "/account" },
      "account": { view: "profile", target: "profile-account", path: "/account" },
      "login": { view: "profile", target: "login", path: "/login" },
      "log in": { view: "profile", target: "login", path: "/login" },
      "sign in": { view: "profile", target: "login", path: "/login" },
      "connect account": { view: "profile", target: "login", path: "/login" },
      "create account": { view: "profile", target: "login", path: "/login" },
      "sync account": { view: "profile", target: "profile-account", path: "/account" },
      "cloud sync": { view: "profile", target: "profile-account", path: "/account" },
      "history": { view: "profile", target: "recommendation-history", path: "/account" },
      "progress": { view: "profile", target: "openingfit-progress", path: "/account" },
      "view progress": { view: "profile", target: "openingfit-progress", path: "/account" },
      "check progress": { view: "profile", target: "openingfit-progress", path: "/account" },
      "view saved progress": { view: "profile", target: "openingfit-progress", path: "/account" },
      "saved reports": { view: "profile", target: "report-history", path: "/account" },

      "feedback": { view: "feedback", target: "feedback", path: "/" },
      "leave feedback": { view: "feedback", target: "feedback", path: "/" },

      "premium": { view: "profile", target: "premium", path: "/premium" },
      "pricing": { view: "profile", target: "premium", path: "/premium" },
      "upgrade": { view: "profile", target: "premium", path: "/premium", founderIntent: true },
      "upgrade to premium": { view: "profile", target: "premium", path: "/premium", founderIntent: true },
      "get founder pass": { view: "profile", target: "premium", path: "/premium", founderIntent: true },
      "unlock full report": { view: "profile", target: "premium", path: "/premium", founderIntent: true },
    };

    const comingSoonMap = {
      "export pdf": "PDF export is a good premium feature, but it is not wired up yet.",
      "download pdf": "PDF download is not live yet. This should become a premium report export.",
      "analyse latest games": "Auto re-analysis is not live yet. For now, import again to refresh your report.",
      "analyze latest games": "Auto re-analysis is not live yet. For now, import again to refresh your report.",
      "start drill": "Interactive drills are not live yet. This is a strong premium/training upgrade.",
      "sign out": "Use the account panel to sign out so the app can clear report state safely.",
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
      const fuzzyRoute = Object.entries(routeMap).find(([key]) => {
        if (key.length < 10) return false;
        return label.includes(key);
      })?.[1];
      const route = exactRoute || fuzzyRoute;

      const exactSoon = comingSoonMap[label];
      const fuzzySoon = Object.entries(comingSoonMap).find(([key]) => label.includes(key))?.[1];
      const soonMessage = exactSoon || fuzzySoon;

      if (route) {
        if (route.founderIntent) {
          window.dispatchEvent(
            new CustomEvent("openingfit:founder-pass-intent", {
              detail: { source: "action-router", plan: "founder_pass" },
            })
          );
        }

        navigateApp(route, { setView: onViewChange });

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
