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

export default function OpeningFitUXCleanup({ data, username, onJump, activeView, onViewChange }) {
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("showOpeningFitTools", toolsOpen);
    return () => document.body.classList.remove("showOpeningFitTools");
  }, [toolsOpen]);

  const summary = useMemo(() => {
    const openings = getOpenings(data);
    return {
      games: getGames(data),
      style: getStyle(data),
      topOpening: openingName(openings[0]),
      openingCount: openings.length,
    };
  }, [data]);

  useEffect(() => {
    if (!data) return;

    const timer = window.setTimeout(() => {
      const target =
        document.getElementById("report-start") ||
        document.getElementById("openingfit-report") ||
        document.getElementById("study-planner");

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [data]);

  if (!data) return null;

  const go = (view, target) => {
    if (view && onViewChange) {
      onViewChange(view);
    }

    window.setTimeout(() => {
      if (target) {
        onJump?.(target);
      }
    }, 80);
  };

  return (
    <>
      <div id="report-start" className="ofReportStartAnchor" />

      <section className="ofUXReportHeader">
        <div className="ofUXReportCopy">
          <div className="ofEyebrow">Your report</div>

          <h2>
            {username ? `${username}'s OpeningFit report` : "Your OpeningFit report"}
          </h2>

          <p>
            Start with the summary, then work through the plan. The detailed stats and
            QA tools are now kept lower down so the report feels easier to use.
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

      <nav className="ofUXStickyNav" aria-label="OpeningFit report navigation">
        <button type="button" onClick={() => go("overview", "openingfit-report")}>
          Summary
        </button>

        <button type="button" onClick={() => go("recommendations", "keep-improve-avoid")}>
          Openings
        </button>

        <button type="button" onClick={() => go("training", "study-planner")}>
          Study plan
        </button>

        <button type="button" onClick={() => go("games", "game-replay")}>
          Games
        </button>

        <button type="button" onClick={() => go("data", "top-openings-table")}>
          Stats
        </button>

        <button type="button" onClick={() => go("feedback", "feedback")}>
          Feedback
        </button>

        <button
          type="button"
          className={toolsOpen ? "active" : ""}
          onClick={() => setToolsOpen((value) => !value)}
        >
          Tools
        </button>
      </nav>

      <div className={toolsOpen ? "ofDeveloperToolsOpen" : "ofDeveloperToolsClosed"}>
        <div className="ofDeveloperToolsNotice">
          <strong>Beta tools are {toolsOpen ? "visible" : "hidden"}.</strong>
          <span>
            Import doctor, functionality checks, backend status, and trust/debug panels are kept
            out of the main reading flow.
          </span>
        </div>
      </div>
    </>
  );
}
