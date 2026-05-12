import { useEffect, useMemo, useState } from "react";

function getOpenings(data) {
  return [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];
}

function getGames(data) {
  return (
    Number(data?.games_imported) ||
    Number(data?.games_analyzed) ||
    Number(data?.gamesAnalysed) ||
    Number(data?.total_games) ||
    Number(data?.summary?.games) ||
    0
  );
}

function openingName(item) {
  return item?.name || item?.opening || item?.eco_name || item?.label || "Unknown opening";
}

function getStyle(data) {
  return (
    data?.style_profile?.label ||
    data?.style?.label ||
    data?.style ||
    data?.player_style ||
    "Opening profile"
  );
}

function normaliseTab(activeView) {
  const value = String(activeView || "overview").toLowerCase();

  if (["overview", "summary", "home"].includes(value)) return "overview";
  if (["recommendations", "openings", "repertoire"].includes(value)) return "recommendations";
  if (["training", "study", "study-plan"].includes(value)) return "training";
  if (["games", "replay"].includes(value)) return "games";
  if (["data", "stats", "table"].includes(value)) return "data";
  if (value === "feedback") return "feedback";
  if (value === "tools" || value === "debug") return "tools";

  return "overview";
}

export default function OpeningFitUXCleanup({ data, username, onJump, activeView, onViewChange }) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const currentTab = normaliseTab(activeView);

  useEffect(() => {
    if (!data) return;

    const markLegacyNavs = () => {
      const candidates = Array.from(
        document.querySelectorAll("nav, .tabs, .appTabs, .viewTabs, .dashboardTabs, .sectionTabs, div")
      );

      candidates.forEach((element) => {
        const text = (element.textContent || "").replace(/\s+/g, " ").trim();

        const looksLikeOldViewNav =
          text.includes("Overview") &&
          text.includes("Repertoire") &&
          text.includes("Training") &&
          text.includes("Games") &&
          text.includes("Progress") &&
          text.includes("Feedback");

        const isNewTabbedNav = element.classList.contains("ofTabbedNav");
        const isBottomNav = element.className && String(element.className).toLowerCase().includes("bottom");

        if (looksLikeOldViewNav && !isNewTabbedNav && !isBottomNav) {
          element.classList.add("ofLegacySectionNavHidden");
        }
      });
    };

    markLegacyNavs();
    const timer = window.setTimeout(markLegacyNavs, 300);

    return () => window.clearTimeout(timer);
  }, [data, activeView]);

  const summary = useMemo(() => {
    const openings = getOpenings(data);

    return {
      games: getGames(data),
      style: getStyle(data),
      topOpening: openingName(openings[0]),
    };
  }, [data]);

  useEffect(() => {
    if (!data) {
      document.body.classList.remove("openingfitTabbedResults");
      document.body.classList.remove("showOpeningFitTools");
      document.body.removeAttribute("data-openingfit-tab");
      return;
    }

    document.body.classList.add("openingfitTabbedResults");
    document.body.setAttribute("data-openingfit-tab", currentTab);
    document.body.classList.toggle("showOpeningFitTools", toolsOpen || currentTab === "tools");

    return () => {
      document.body.classList.remove("openingfitTabbedResults");
      document.body.classList.remove("showOpeningFitTools");
      document.body.removeAttribute("data-openingfit-tab");
    };
  }, [data, currentTab, toolsOpen]);

  useEffect(() => {
    if (!data) return;

    const timer = window.setTimeout(() => {
      const target = document.getElementById("report-start") || document.getElementById("openingfit-report");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [data]);

  if (!data) return null;

  const go = (view, target) => {
    if (view && onViewChange) onViewChange(view);
    if (view === "tools") setToolsOpen(true);

    window.setTimeout(() => {
      const fallback = document.getElementById("report-start");
      const direct = target ? document.getElementById(target) : null;

      if (direct) direct.scrollIntoView({ behavior: "smooth", block: "start" });
      else if (fallback) fallback.scrollIntoView({ behavior: "smooth", block: "start" });
      else if (target) onJump?.(target);
    }, 80);
  };

  const tabs = [
    { key: "overview", label: "Summary", view: "overview", target: "openingfit-report" },
    { key: "recommendations", label: "Openings", view: "recommendations", target: "keep-improve-avoid" },
    { key: "training", label: "Study Plan", view: "training", target: "study-planner" },
    { key: "games", label: "Games", view: "games", target: "game-replay" },
    { key: "data", label: "Stats", view: "data", target: "top-openings-table" },
    { key: "feedback", label: "Feedback", view: "feedback", target: "feedback" },
    { key: "tools", label: "Tools", view: "tools", target: "functionality-hub" },
  ];

  return (
    <>
      <div id="report-start" className="ofReportStartAnchor" />

      <section className="ofUXReportHeader">
        <div className="ofUXReportCopy">
          <div className="ofEyebrow">Your report</div>

          <h2>{username ? `${username}'s OpeningFit report` : "Your OpeningFit report"}</h2>

          <p>
            Use the tabs below instead of scrolling through everything. Start with the summary,
            then move into openings, study plan, games, stats, or feedback.
          </p>
        </div>

        <div className="ofUXQuickStats">
          <article>
            <span>Games</span>
            <strong>{summary.games || "—"}</strong>
          </article>

          <article>
            <span>Top opening</span>
            <strong>{summary.topOpening}</strong>
          </article>

          <article>
            <span>Style</span>
            <strong>{summary.style}</strong>
          </article>
        </div>
      </section>

      <nav className="ofUXStickyNav ofTabbedNav" aria-label="OpeningFit report navigation">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={currentTab === tab.key ? "active" : ""}
            onClick={() => go(tab.view, tab.target)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={currentTab === "tools" || toolsOpen ? "ofDeveloperToolsOpen" : "ofDeveloperToolsClosed"}>
        <div className="ofDeveloperToolsNotice">
          <strong>{currentTab === "tools" || toolsOpen ? "Tools visible." : "Tools hidden."}</strong>
          <span> Diagnostics, backend checks, and beta utilities are kept away from the main report.</span>
        </div>
      </div>
    </>
  );
}
