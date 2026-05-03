import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import "./App.css";
import GameReplayBoard from "./components/GameReplayBoard";
import OpeningPracticeBoard from "./components/OpeningPracticeBoard";
import LandingModal from "./components/LandingModal";
import { Analytics } from "@vercel/analytics/react";
import OpeningDetailsModal from "./components/OpeningDetailsModal";
import OpeningSnapshot from "./components/OpeningSnapshot";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

const STORAGE_KEY = "openingFit:lastAnalysis";
const USERNAME_KEY = "openingFit:lastUsername";
const PREMIUM_KEY = "openingFit:isPremiumDemo";
const PLATFORM_KEY = "openingFit:lastPlatform";
const IMPORT_MONTHS_KEY = "openingFit:lastImportMonths";

const platforms = {
  chesscom: {
    label: "Chess.com",
    apiPath: "chesscom",
    usernamePlaceholder: "Chess.com username",
  },
  lichess: {
    label: "Lichess",
    apiPath: "lichess",
    usernamePlaceholder: "Lichess username",
  },
};

const closedSections = {
  fit: false,
  style: false,
  recommendations: false,
  verdicts: false,
  chart: false,
  training: false,
  replay: false,
  preferred: false,
  top: false,
};

const premiumFeatures = [
  "12 months of game history",
  "Full opening table",
  "Keep / Improve / Avoid verdicts",
  "Advanced personal training plan",
  "Saved import history",
  "Future Stockfish analysis",
];

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getMovesFromPgn(pgnText) {
  if (!pgnText) return [];

  try {
    const chess = new Chess();
    chess.loadPgn(pgnText);
    return chess.history();
  } catch {
    return [];
  }
}

function safeDate(value) {
  if (!value) return "Today";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Today";
  }
}

function getOpeningName(opening) {
  if (typeof opening === "string") return opening;

  return (
    opening?.name ||
    opening?.opening ||
    opening?.openingName ||
    opening?.ecoName ||
    "Unknown Opening"
  );
}

function getOpeningGames(opening) {
  if (typeof opening === "string") return 0;
  return safeNumber(opening?.games ?? opening?.count ?? opening?.total);
}

function getWinRate(opening) {
  if (!opening || typeof opening === "string") return 0;

  if (opening.win_rate !== undefined) return safeNumber(opening.win_rate);
  if (opening.winRate !== undefined) return safeNumber(opening.winRate);

  const games = safeNumber(opening.games);
  const wins = safeNumber(opening.wins ?? opening.w);
  const draws = safeNumber(opening.draws ?? opening.d);

  if (!games) return 0;
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function getOpeningSide(opening) {
  if (!opening || typeof opening === "string") return "";
  return opening.side || opening.colour || opening.color || "";
}

function isUnknownOpeningName(name) {
  const normalized = (name || "").toLowerCase().trim();

  return (
    normalized === "" ||
    normalized === "unknown" ||
    normalized === "unknown opening" ||
    normalized === "uncommon opening" ||
    normalized.includes("unknown")
  );
}

function getOpeningTags(name = "") {
  const lower = name.toLowerCase();
  const tags = [];

  if (
    lower.includes("gambit") ||
    lower.includes("vienna") ||
    lower.includes("king's gambit") ||
    lower.includes("smith-morra") ||
    lower.includes("scotch") ||
    lower.includes("danish")
  ) {
    tags.push("attacking");
  }

  if (
    lower.includes("london") ||
    lower.includes("colle") ||
    lower.includes("system")
  ) {
    tags.push("system");
  }

  if (
    lower.includes("caro") ||
    lower.includes("slav") ||
    lower.includes("queen's gambit declined") ||
    lower.includes("french")
  ) {
    tags.push("solid");
  }

  if (
    lower.includes("sicilian") ||
    lower.includes("king's indian") ||
    lower.includes("grunfeld") ||
    lower.includes("grünfeld") ||
    lower.includes("najdorf") ||
    lower.includes("dragon")
  ) {
    tags.push("sharp");
  }

  if (
    lower.includes("italian") ||
    lower.includes("ruy lopez") ||
    lower.includes("queen's gambit") ||
    lower.includes("english") ||
    lower.includes("four knights")
  ) {
    tags.push("classical");
  }

  return tags;
}

function getPlayerStyleFromOpenings(openings = []) {
  const tagScores = {
    attacking: 0,
    solid: 0,
    system: 0,
    sharp: 0,
    classical: 0,
  };

  openings.forEach((opening) => {
    const name = getOpeningName(opening);

    if (isUnknownOpeningName(name)) return;

    const games = Math.max(getOpeningGames(opening), 1);
    const winRate = getWinRate(opening);
    const weight = games * Math.max(winRate, 35);

    getOpeningTags(name).forEach((tag) => {
      tagScores[tag] += weight;
    });
  });

  const sorted = Object.entries(tagScores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[0];

  if (top === "attacking") {
    return {
      title: "Tactical Attacker",
      description:
        "You seem to perform best when the game opens up and you get active piece play early.",
    };
  }

  if (top === "solid") {
    return {
      title: "Solid Builder",
      description:
        "You seem to do well in structured positions with clear plans and reliable pawn structures.",
    };
  }

  if (top === "system") {
    return {
      title: "System Player",
      description:
        "You seem comfortable using repeatable setups where you understand the plans more than memorising long theory.",
    };
  }

  if (top === "sharp") {
    return {
      title: "Chaos Handler",
      description:
        "You seem willing to enter complicated positions where tactics and initiative matter.",
    };
  }

  return {
    title: "Balanced Improver",
    description:
      "Your games show a mixed style. You may benefit most from a simple, reliable repertoire with a few active options.",
  };
}

function calculateOpeningFitScore(opening, playerStyle) {
  const name = getOpeningName(opening);
  const games = getOpeningGames(opening);
  const winRate = getWinRate(opening);
  const tags = getOpeningTags(name);

  let score = 45;

  score += Math.min(games * 3, 18);

  if (winRate >= 70) score += 28;
  else if (winRate >= 60) score += 22;
  else if (winRate >= 50) score += 14;
  else if (winRate >= 40) score += 6;
  else score -= 8;

  if (playerStyle?.title === "Tactical Attacker" && tags.includes("attacking")) {
    score += 12;
  }

  if (playerStyle?.title === "Solid Builder" && tags.includes("solid")) {
    score += 12;
  }

  if (playerStyle?.title === "System Player" && tags.includes("system")) {
    score += 12;
  }

  if (playerStyle?.title === "Chaos Handler" && tags.includes("sharp")) {
    score += 12;
  }

  if (tags.includes("classical")) {
    score += 5;
  }

  if (isUnknownOpeningName(name)) {
    score -= 25;
  }

  return Math.max(1, Math.min(100, Math.round(score)));
}

function getOpeningVerdict(opening, score) {
  const games = getOpeningGames(opening);
  const winRate = getWinRate(opening);

  if (score >= 75 && games >= 2) return "Keep";
  if (score >= 55) return "Improve";
  if (winRate < 40 || score < 55) return "Avoid for now";

  return "Improve";
}

function getOpeningExplanation(opening, score, playerStyle) {
  const name = getOpeningName(opening);
  const games = getOpeningGames(opening);
  const winRate = getWinRate(opening);
  const tags = getOpeningTags(name);
  const verdict = getOpeningVerdict(opening, score);

  if (isUnknownOpeningName(name)) {
    return "This opening was not clearly classified. It is worth reviewing the PGN or playing more recognised opening lines so the report can give better advice.";
  }

  if (verdict === "Keep") {
    return `This looks like a strong fit. You score well with it, it appears in your games enough to be meaningful, and it suits your ${playerStyle.title.toLowerCase()} profile.`;
  }

  if (verdict === "Improve") {
    if (games < 3) {
      return "This opening has potential, but you have not played it enough yet. Keep testing it before making it a main part of your repertoire.";
    }

    if (winRate >= 50) {
      return "Your results are decent here, but there is room to improve. This could become a reliable weapon with a clearer plan after the opening.";
    }

    return "This opening is not failing badly, but your results suggest you need a simpler plan or a more comfortable variation.";
  }

  if (tags.includes("sharp")) {
    return "This may be too sharp or theory-heavy for your current results. Consider a simpler alternative until your confidence improves.";
  }

  return "Your results suggest this opening is not fitting you well right now. It may be worth replacing it or keeping it as a lower-priority side option.";
}

function buildOpeningFitData(data) {
  const openings = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.preferred_white) ? data.preferred_white : []),
    ...(Array.isArray(data?.preferred_black) ? data.preferred_black : []),
  ];

  const mergedMap = new Map();

  openings.forEach((opening) => {
    const name = getOpeningName(opening);
    const key = name.toLowerCase();

    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        ...opening,
        name,
        games: getOpeningGames(opening),
        win_rate: getWinRate(opening),
      });
      return;
    }

    const existing = mergedMap.get(key);
    const existingGames = getOpeningGames(existing);
    const incomingGames = getOpeningGames(opening);

    if (incomingGames > existingGames) {
      mergedMap.set(key, {
        ...existing,
        ...opening,
        name,
        games: incomingGames,
        win_rate: getWinRate(opening) || getWinRate(existing),
      });
    }
  });

  const cleanOpenings = Array.from(mergedMap.values());
  const playerStyle = getPlayerStyleFromOpenings(cleanOpenings);

  const scoredOpenings = cleanOpenings
    .map((opening) => {
      const score = calculateOpeningFitScore(opening, playerStyle);
      const verdict = getOpeningVerdict(opening, score);

      return {
        ...opening,
        fitScore: score,
        fitVerdict: verdict,
        fitExplanation: getOpeningExplanation(opening, score, playerStyle),
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  const recognised = scoredOpenings.filter(
    (opening) => !isUnknownOpeningName(getOpeningName(opening))
  );

  const bestOpening = recognised[0] || scoredOpenings[0] || null;

  const weakestOpening =
    [...recognised]
      .filter((opening) => getOpeningGames(opening) >= 2)
      .sort((a, b) => a.fitScore - b.fitScore)[0] ||
    [...recognised].sort((a, b) => a.fitScore - b.fitScore)[0] ||
    null;

  const overallScore =
    recognised.length > 0
      ? Math.round(
          recognised
            .slice(0, 8)
            .reduce((total, opening) => total + opening.fitScore, 0) /
            Math.min(recognised.length, 8)
        )
      : 0;

  return {
    playerStyle,
    scoredOpenings,
    bestOpening,
    weakestOpening,
    overallScore,
  };
}

function Section({ title, isOpen, onToggle, children, badge = null }) {
  return (
    <section className="card collapsibleCard">
      <button className="sectionToggle" onClick={onToggle} type="button">
        <div className="sectionToggleLeft">
          <span className="sectionArrow">{isOpen ? "▾" : "▸"}</span>
          <h2>{title}</h2>
        </div>

        {badge ? <span className="sectionBadge">{badge}</span> : null}
      </button>

      {isOpen && <div className="sectionBody">{children}</div>}
    </section>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="emptyState">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function LockedPremiumCard({ title, text }) {
  return (
    <div className="premiumLockedInline">
      <div>
        <span className="premiumBadge">Premium</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <span className="lockIcon">🔒</span>
    </div>
  );
}

function OpeningFitSummaryCard({ fitData, onPractice }) {
  if (!fitData || !fitData.scoredOpenings?.length) return null;

  const {
    playerStyle,
    bestOpening,
    weakestOpening,
    overallScore,
    scoredOpenings,
  } = fitData;

  const keepCount = scoredOpenings.filter(
    (opening) => opening.fitVerdict === "Keep"
  ).length;

  const improveCount = scoredOpenings.filter(
    (opening) => opening.fitVerdict === "Improve"
  ).length;

  const avoidCount = scoredOpenings.filter(
    (opening) => opening.fitVerdict === "Avoid for now"
  ).length;

  return (
    <section className="card openingFitHeroCard">
      <div className="fitHeroTop">
        <div>
          <p className="eyebrow">Opening Fit Result</p>
          <h2>{playerStyle.title}</h2>
          <p className="muted">{playerStyle.description}</p>
        </div>

        <div className="fitScoreCircle">
          <strong>{overallScore}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="fitHeroGrid">
        <div className="fitMiniCard">
          <span className="fitLabel">Best current fit</span>
          <strong>
            {bestOpening ? getOpeningName(bestOpening) : "Not enough data"}
          </strong>
          {bestOpening ? (
            <p>
              {bestOpening.fitScore}/100 — {bestOpening.fitVerdict}
            </p>
          ) : null}
        </div>

        <div className="fitMiniCard">
          <span className="fitLabel">Biggest weakness</span>
          <strong>
            {weakestOpening ? getOpeningName(weakestOpening) : "Not enough data"}
          </strong>
          {weakestOpening ? (
            <p>
              {weakestOpening.fitScore}/100 — {weakestOpening.fitVerdict}
            </p>
          ) : null}
        </div>

        <div className="fitMiniCard">
          <span className="fitLabel">Opening verdicts</span>
          <strong>
            {keepCount} Keep · {improveCount} Improve · {avoidCount} Avoid
          </strong>
          <p>Based on your imported games and opening results.</p>
        </div>
      </div>

      <div className="fitRecommendationBox">
        <strong>Recommended next step:</strong>{" "}
        {bestOpening
          ? `Build your short repertoire around ${getOpeningName(
              bestOpening
            )}, then improve or replace your weakest opening.`
          : "Import more games to get a stronger recommendation."}

        {bestOpening ? (
          <button
            className="secondaryBtn fitPracticeBtn"
            type="button"
            onClick={() => onPractice(getOpeningName(bestOpening))}
          >
            Practise best fit
          </button>
        ) : null}
      </div>
    </section>
  );
}

function OpeningFitScoreList({ fitData, onPractice, onSelectOpening }) {
  if (!fitData || !fitData.scoredOpenings?.length) return null;

  return (
    <section className="card openingFitScoreCard">
      <div className="sectionHeaderSimple">
        <div>
          <p className="eyebrow">Opening Fit Scores</p>
          <h2>Keep / Improve / Avoid</h2>
          <p className="muted">
            These scores estimate which openings fit your results and playing
            style.
          </p>
        </div>
      </div>

      <div className="fitOpeningList">
        {fitData.scoredOpenings.slice(0, 10).map((opening, index) => {
          const name = getOpeningName(opening);
          const games = getOpeningGames(opening);
          const winRate = getWinRate(opening);

          return (
            <button
              className="fitOpeningRow"
              key={`${name}-${index}`}
              type="button"
              onClick={() => onSelectOpening?.(opening)}
            >
              <div className="fitOpeningMain">
                <div>
                  <strong>{name}</strong>
                  <p>
                    {games} games · {winRate}% score · {opening.fitVerdict}
                  </p>
                </div>

                <div className="fitOpeningScore">
                  {opening.fitScore}
                  <span>/100</span>
                </div>
              </div>

              <p className="fitOpeningReason">{opening.fitExplanation}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FloatingAppMenu({ data, onJump, onPractice, activeView, onViewChange }) {
  const [open, setOpen] = useState(false);

  const mainItems = [
    { label: "Import", target: "app-dashboard" },
    { label: "Ratings", target: "rating-openings" },
    { label: "Premium", target: "premium" },
    { label: "Feedback", target: "feedback" },
  ];

  const appViews = [
    { key: "overview", label: "Overview" },
    { key: "recommendations", label: "Recommendations" },
    { key: "training", label: "Training" },
    { key: "games", label: "Games" },
    { key: "data", label: "Data" },
    { key: "feedback", label: "Feedback" },
  ];

  const mainOpening = data?.top_openings?.[0]?.name;

  const handleView = (view) => {
    onViewChange(view);
    setOpen(false);

    setTimeout(() => {
      const el = document.getElementById("app-results") || document.getElementById("app-dashboard");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  return (
    <div className={`floatingMenu ${open ? "floatingMenuOpen" : ""}`}>
      <button
        className="floatingMenuToggle"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open navigation menu"
      >
        ☰
      </button>

      {open ? (
        <div className="floatingMenuPanel">
          <div className="floatingMenuHeader">
            <strong>Opening Fit Menu</strong>
            <button type="button" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <p className="floatingMenuLabel">Main</p>
          <div className="floatingMenuButtons">
            {mainItems.map((item) => (
              <button
                key={item.target}
                type="button"
                onClick={() => {
                  if (item.target === "feedback") {
                    onViewChange("feedback");

                    setTimeout(() => {
                      const el = document.getElementById("feedback");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 80);
                  } else {
                    onJump(item.target);
                  }

                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {data || activeView === "feedback" ? (
            <>
              <p className="floatingMenuLabel">Report pages</p>
              <div className="floatingMenuButtons floatingMenuButtonsSingle">
                {appViews.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={activeView === item.key ? "floatingMenuActiveItem" : ""}
                    onClick={() => handleView(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {mainOpening ? (
                <button
                  className="floatingPracticeButton"
                  type="button"
                  onClick={() => {
                    onPractice(mainOpening);
                    setOpen(false);
                  }}
                >
                  Practise {mainOpening}
                </button>
              ) : null}
            </>
          ) : (
            <p className="floatingMenuHint">
              Import games first to unlock report pages.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AppViewTabs({ activeView, onChange }) {
  const tabs = [
    { key: "overview", label: "Overview", icon: "🏠" },
    { key: "recommendations", label: "Recommendations", icon: "🎯" },
    { key: "training", label: "Training", icon: "🚀" },
    { key: "games", label: "Games", icon: "♟️" },
    { key: "data", label: "Data", icon: "📊" },
    { key: "feedback", label: "Feedback", icon: "💬" },
  ];

  return (
    <section className="card appTabsCard">
      <div className="appTabsHeader">
        <div>
          <p className="eyebrow">Report navigation</p>
          <h2>Your Opening Fit report</h2>
        </div>
      </div>

      <div className="appTabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`appTabButton ${
              activeView === tab.key ? "appTabButtonActive" : ""
            }`}
            onClick={() => onChange(tab.key)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section className="landingContentSection aboutSection" id="about">
      <div className="landingSectionHeading">
        <p className="landingEyebrow">Who it is for</p>
        <h2>Built for beginner and club players.</h2>
        <p>
          Opening Fit is designed for players who want practical opening advice
          without memorising huge theory files. It looks at what you already
          play, finds patterns in your results, and helps you build a simple
          repertoire that fits your style.
        </p>
      </div>

      <div className="aboutGrid">
        <article className="aboutCard">
          <h3>Not an engine report</h3>
          <p>
            The goal is not to overwhelm you with computer lines. The goal is to
            help you understand which openings feel natural and which ones need
            attention.
          </p>
        </article>

        <article className="aboutCard">
          <h3>Made for practical training</h3>
          <p>
            Use the report to decide what to keep, what to repair, and what to
            practise next on the board.
          </p>
        </article>

        <article className="aboutCard">
          <h3>Simple repertoire building</h3>
          <p>
            Start with a few openings you trust, learn the first moves, then add
            plans over time instead of chasing every sideline.
          </p>
        </article>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="siteFooter">
      <div>
        <div className="landingBrand footerBrand">
          <div className="landingBrandIcon">♞</div>
          <div>
            <p className="landingBrandTitle">Opening Fit</p>
            <p className="landingBrandSubtitle">
              Practical chess opening advice for club players
            </p>
          </div>
        </div>

        <p className="footerDisclaimer">
          Opening popularity and rating-range suggestions are general guides.
          They can vary by platform, time control, region, and current chess
          trends. Opening Fit is for training guidance, not guaranteed results.
        </p>
      </div>

      <div className="footerLinks">
        <a href="#app-dashboard">Launch app</a>
        <a href="#rating-openings">Rating ranges</a>
        <a href="#premium">Premium</a>
      </div>
    </footer>
  );
}

function RatingOpeningGuide({ onOpeningClick }) {
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);

  const ratingRanges = [
    {
      range: "Under 800",
      label: "Beginner",
      description:
        "Players often use simple development openings, early queen moves, and direct attacks.",
      white: ["Italian Game", "Four Knights Game", "Queen's Pawn Opening"],
      black: ["Scandinavian Defence", "French Defence", "King's Pawn Game"],
    },
    {
      range: "800–1200",
      label: "Improving player",
      description:
        "Openings become more recognisable, but simple plans still perform best.",
      white: ["London System", "Italian Game", "Vienna Game"],
      black: ["Caro-Kann Defence", "Scandinavian Defence", "Sicilian Defence"],
    },
    {
      range: "1200–1600",
      label: "Club player",
      description:
        "Players start choosing openings based on style and familiar middlegame plans.",
      white: ["Vienna Game", "Queen's Gambit", "Ruy Lopez"],
      black: ["Caro-Kann Defence", "Sicilian Defence", "King's Indian Defence"],
    },
    {
      range: "1600–2000",
      label: "Strong club player",
      description:
        "Opening choices become more structured, with more preparation and fewer random sidelines.",
      white: ["Ruy Lopez", "Queen's Gambit", "English Opening"],
      black: ["Sicilian Defence", "Nimzo-Indian Defence", "Caro-Kann Defence"],
    },
    {
      range: "2000+",
      label: "Advanced",
      description:
        "Players usually have prepared repertoires and choose openings to create specific structures.",
      white: ["Ruy Lopez", "Catalan Opening", "Queen's Gambit"],
      black: ["Sicilian Najdorf", "Nimzo-Indian Defence", "Grünfeld Defence"],
    },
  ];

  return (
    <section
      className={`ratingGuideSection ${
        mobileGuideOpen ? "ratingGuideOpen" : "ratingGuideClosed"
      }`}
      id="rating-openings"
    >
      <div className="landingSectionHeading ratingGuideHeading">
        <p className="landingEyebrow">Opening trends</p>
        <h2>Popular openings by rating range.</h2>
        <p>
          A quick guide to the openings players commonly choose at different
          levels. Click any opening to practise a supported main line.
        </p>

        <button
          className="mobileSectionRevealBtn"
          type="button"
          onClick={() => setMobileGuideOpen((prev) => !prev)}
        >
          {mobileGuideOpen ? "Hide rating guide" : "Show rating guide"}
        </button>
      </div>

      <div className="ratingGuideBody">
        <div className="ratingGuideGrid">
          {ratingRanges.map((item) => (
            <article className="ratingGuideCard" key={item.range}>
              <div className="ratingGuideTop">
                <h3>{item.range}</h3>
                <p>{item.label}</p>
              </div>

              <p className="ratingGuideDescription">{item.description}</p>

              <div className="ratingOpeningColumns">
                <div>
                  <h4>Common as White</h4>
                  <div className="ratingOpeningList">
                    {item.white.map((opening) => (
                      <button
                        key={opening}
                        type="button"
                        className="ratingOpeningBtn"
                        onClick={() => onOpeningClick(opening)}
                      >
                        {opening}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4>Common as Black</h4>
                  <div className="ratingOpeningList">
                    {item.black.map((opening) => (
                      <button
                        key={opening}
                        type="button"
                        className="ratingOpeningBtn"
                        onClick={() => onOpeningClick(opening)}
                      >
                        {opening}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingSection({ onOpeningClick }) {
  const features = [
    {
      icon: "♟️",
      title: "Import your games",
      text: "Enter your Chess.com or Lichess username and analyse your recent games.",
    },
    {
      icon: "📊",
      title: "Find your patterns",
      text: "See which openings you play most and where your results are strongest.",
    },
    {
      icon: "🎯",
      title: "Get opening ideas",
      text: "Receive simple repertoire suggestions based on your real games.",
    },
    {
      icon: "🚀",
      title: "Train smarter",
      text: "Get a personal plan based on your strongest openings and weak spots.",
    },
  ];

  const steps = [
    {
      title: "Enter username",
      text: "Add your Chess.com or Lichess username.",
    },
    {
      title: "Import games",
      text: "Opening Fit reviews your recent games.",
    },
    {
      title: "View your report",
      text: "See your style profile, win rates, and opening trends.",
    },
    {
      title: "Train your repertoire",
      text: "Keep what works, improve weak areas, and practise main lines.",
    },
  ];

  return (
    <div className="landingWrap">
      <header className="landingHero">
        <div className="landingNav">
          <div className="landingBrand">
            <div className="landingBrandIcon">♞</div>
            <div>
              <p className="landingBrandTitle">Opening Fit</p>
              <p className="landingBrandSubtitle">
                Find openings that match your style
              </p>
            </div>
          </div>

          <nav className="landingNavLinks">
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#how-it-works">How it works</a>
            <a href="#rating-openings">Rating ranges</a>
            <a href="#premium">Premium</a>
            <a href="#app-dashboard">Launch app</a>
          </nav>
        </div>

        <div className="landingHeroGrid">
          <div className="landingHeroCopy">
            <div className="landingPill">
              <span>New</span>
              <span className="landingDot">•</span>
              <span>Personalised chess opening recommendations</span>
            </div>

            <h1>Build a chess repertoire that fits how you actually play.</h1>

            <p className="landingSubtext">
              Opening Fit reviews your recent games, finds your strongest
              opening patterns, and recommends practical repertoire ideas based
              on your own results.
            </p>

            <div className="landingHeroActions">
              <a className="landingPrimaryBtn" href="#app-dashboard">
                Import games
              </a>
              <a className="landingSecondaryBtn" href="#rating-openings">
                Browse rating ranges
              </a>
            </div>

            <div className="landingStats">
              <div className="landingStatCard">
                <strong>Fast</strong>
                <span>game import</span>
              </div>

              <div className="landingStatCard">
                <strong>Simple</strong>
                <span>opening advice</span>
              </div>

              <div className="landingStatCard">
                <strong>Practice</strong>
                <span>main lines</span>
              </div>
            </div>
          </div>

          <div className="landingPreviewCard" id="sample-report">
            <div className="landingPreviewTop">
              <div>
                <p className="landingMiniLabel">Sample Style Profile</p>
                <h3>Aggressive counterpuncher</h3>
              </div>

              <span className="landingFitBadge">Strong fit</span>
            </div>

            <div className="landingPreviewGrid">
              <div className="landingInfoCard">
                <p className="landingMiniLabel">White repertoire</p>
                <button
                  className="landingOpeningBtn"
                  type="button"
                  onClick={() => onOpeningClick("Vienna Game")}
                >
                  Vienna Game
                </button>
                <p>Active development, attacking chances, and clear plans.</p>
              </div>

              <div className="landingInfoCard">
                <p className="landingMiniLabel">Black repertoire</p>
                <button
                  className="landingOpeningBtn"
                  type="button"
                  onClick={() => onOpeningClick("Scandinavian Defence")}
                >
                  Scandinavian Defence
                </button>
                <p>Direct positions with practical club-level ideas.</p>
              </div>
            </div>

            <div className="landingInfoCard">
              <p className="landingMiniLabel">Opening verdicts</p>
              <h4>Keep / Improve / Avoid</h4>

              <div className="landingVerdictList">
                <div className="landingVerdictRow">
                  <div>
                    <button
                      className="inlineOpeningBtn"
                      type="button"
                      onClick={() => onOpeningClick("Vienna Game")}
                    >
                      Vienna Game
                    </button>
                    <span>Strong recent results</span>
                  </div>
                  <span className="verdict keep">Keep</span>
                </div>

                <div className="landingVerdictRow">
                  <div>
                    <button
                      className="inlineOpeningBtn"
                      type="button"
                      onClick={() => onOpeningClick("Italian Game")}
                    >
                      Italian Game
                    </button>
                    <span>Playable, but needs work</span>
                  </div>
                  <span className="verdict improve">Improve</span>
                </div>

                <div className="landingVerdictRow">
                  <div>
                    <strong>Random sidelines</strong>
                    <span>Low consistency</span>
                  </div>
                  <span className="verdict avoid">Avoid</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="landingContentSection" id="features">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">Why it works</p>
          <h2>Clear opening advice without theory overload.</h2>
          <p>
            Most improving players do not need hundreds of opening lines. They
            need simple choices based on what is already happening in their
            games.
          </p>
        </div>

        <div className="landingFeatureGrid">
          {features.map((feature) => (
            <article className="landingFeatureCard" key={feature.title}>
              <div className="landingFeatureIcon">{feature.icon}</div>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <AboutSection />

      <section className="landingContentSection" id="how-it-works">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">How it works</p>
          <h2>From games to repertoire in four steps.</h2>
        </div>

        <div className="landingStepsList">
          {steps.map((step, index) => (
            <div className="landingStepCard" key={step.title}>
              <div className="landingStepNumber">{index + 1}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <RatingOpeningGuide onOpeningClick={onOpeningClick} />

      <section className="landingContentSection" id="premium">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">Pricing</p>
          <h2>Start free. Upgrade when you want deeper analysis.</h2>
        </div>

        <div className="landingPricingGrid">
          <article className="landingPriceCard">
            <p className="landingMiniLabel">Free</p>
            <h3>Opening snapshot</h3>
            <p>Good for trying the app and seeing your main opening trends.</p>

            <ul>
              <li>Import recent Chess.com and Lichess games</li>
              <li>View your style profile</li>
              <li>See top openings and win rates</li>
              <li>Basic opening suggestions</li>
              <li>Practise supported opening lines</li>
              <li>Popular openings by rating range</li>
            </ul>
          </article>

          <article className="landingPriceCard landingPriceCardPremium">
            <div className="landingPriceTop">
              <div>
                <p className="landingMiniLabel">Premium</p>
                <h3>Full repertoire builder</h3>
              </div>

              <span className="landingPriceBadge">£8 once-off</span>
            </div>

            <p>
              For players who want clearer verdicts, stronger recommendations,
              and a more useful training plan.
            </p>

            <ul>
              <li>Longer game import history</li>
              <li>Full opening history and trend tracking</li>
              <li>More practice lines and repertoire tools</li>
              <li>Deeper personal training plans</li>
              <li>Save reports and favourite openings</li>
              <li>Future PDF export and progress tracking</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("chesscom");
  const [importMonths, setImportMonths] = useState(3);
  const [apiStatus, setApiStatus] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [showUnknownOpenings, setShowUnknownOpenings] = useState(false);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [practiceOpening, setPracticeOpening] = useState(null);
  const [openSections, setOpenSections] = useState(closedSections);
  const [savedProfileMessage, setSavedProfileMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [localSavedAt, setLocalSavedAt] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [activeView, setActiveView] = useState("overview");
  const [showLanding, setShowLanding] = useState(true);
  const [selectedOpening, setSelectedOpening] = useState(null);

  useEffect(() => {
    const savedUsername = localStorage.getItem(USERNAME_KEY);
    const savedPremium = localStorage.getItem(PREMIUM_KEY);
    const savedPlatform = localStorage.getItem(PLATFORM_KEY);
    const savedMonths = localStorage.getItem(IMPORT_MONTHS_KEY);
    const savedAnalysis = localStorage.getItem(STORAGE_KEY);

    if (savedUsername) setUsername(savedUsername);
    if (savedPremium === "true") setIsPremium(true);

    if (savedMonths) {
      const parsedMonths = Number(savedMonths);
      if ([1, 3, 6, 12].includes(parsedMonths)) {
        setImportMonths(parsedMonths);
      }
    }

    if (savedPlatform && platforms[savedPlatform]) {
      setPlatform(savedPlatform);
    }

    if (savedAnalysis) {
      try {
        const parsed = JSON.parse(savedAnalysis);

        if (parsed?.analysis) {
          setLocalSavedAt(parsed.savedAt || "");
          setSavedProfileMessage(
            `Saved local report found${
              parsed.username ? ` for ${parsed.username}` : ""
            }. Click Load Saved Profile to open it.`
          );
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkApiHealth() {
      try {
        const response = await fetch(`${API_BASE}/api/health`);

        if (!mounted) return;

        if (response.ok) {
          setApiStatus("online");
        } else {
          setApiStatus("warning");
        }
      } catch {
        if (mounted) setApiStatus("offline");
      }
    }

    checkApiHealth();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(PREMIUM_KEY, String(isPremium));
  }, [isPremium]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowLanding(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function trackEvent(event, eventData = {}) {
    try {
      await fetch(`${API_BASE}/api/analytics/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event,
          data: eventData,
        }),
      });
    } catch {
      // Analytics should never break the app.
    }
  }

  function getFriendlyError(errorText) {
    if (!errorText) {
      return "Something went wrong. Please try again.";
    }

    const lower = String(errorText).toLowerCase();

    if (lower.includes("no saved profile")) {
      return "No saved backend profile found yet. I will still check your local browser save if one exists.";
    }

    if (lower.includes("demo profile could not be loaded")) {
      return "Demo could not be loaded. Your live backend may not be deployed or your frontend may not be pointing to the backend URL.";
    }

    if (lower.includes("not found") || lower.includes("could not find")) {
      return "Could not find that username. Check the spelling and try again.";
    }

    if (lower.includes("no games")) {
      return "This profile exists, but no recent public games were found.";
    }

    if (lower.includes("rate limiting") || lower.includes("429")) {
      return "The chess platform is temporarily limiting requests. Try again in a minute.";
    }

    if (
      lower.includes("failed to fetch") ||
      lower.includes("connection refused") ||
      lower.includes("could not connect")
    ) {
      return "Could not connect to the backend. Make sure FastAPI is running, or check your live backend URL.";
    }

    if (lower.includes("404") && platform === "lichess") {
      return "Lichess is selected, but the backend Lichess route may not be added yet. Chess.com should still work.";
    }

    try {
      const parsed = JSON.parse(errorText);
      return parsed.detail || parsed.message || errorText;
    } catch {
      return errorText;
    }
  }

  function getFeedbackError(errorText) {
    if (!errorText) {
      return "Could not send feedback. Please try again.";
    }

    try {
      const parsed = JSON.parse(errorText);

      if (parsed?.detail) return parsed.detail;
      if (parsed?.message) return parsed.message;
    } catch {
      // Keep using text below.
    }

    const lower = String(errorText).toLowerCase();

    if (
      lower.includes("failed to fetch") ||
      lower.includes("connection refused") ||
      lower.includes("could not connect")
    ) {
      return "Could not connect to the backend. Make sure FastAPI is running, or check your live backend URL.";
    }

    if (lower.includes("404") || lower.includes("not found")) {
      return "Feedback route was not found. Check that your backend has POST /api/feedback and that the live backend is deployed.";
    }

    if (lower.includes("405")) {
      return "Feedback route exists, but it does not accept POST requests. Check your backend /api/feedback method.";
    }

    return "Could not send feedback. Please try again.";
  }

  const normaliseData = (incoming) => {
    if (!incoming) return incoming;

    return {
      ...incoming,
      total_games:
        incoming.total_games ?? incoming.totalGames ?? incoming.gamesImported ?? 0,
      months_checked: incoming.months_checked ?? incoming.monthsChecked ?? 0,
      top_openings: incoming.top_openings ?? incoming.topOpenings ?? [],
      best_openings: incoming.best_openings ?? incoming.bestOpenings ?? [],
      preferred_white: incoming.preferred_white ?? incoming.preferredWhite ?? [],
      preferred_black: incoming.preferred_black ?? incoming.preferredBlack ?? [],
      recent_games: incoming.recent_games ?? incoming.recentGames ?? [],
      style_profile: incoming.style_profile ?? incoming.styleProfile ?? {},
      opening_recommendations:
        incoming.opening_recommendations ??
        incoming.openingRecommendations ??
        incoming.recommendedOpenings ??
        {},
      training_plan: incoming.training_plan ?? incoming.trainingPlan ?? [],
      premium_preview: incoming.premium_preview ?? incoming.premiumPreview ?? {},
      recommendations: incoming.recommendations ?? [],
      lockedFeatures: incoming.lockedFeatures ?? [],
      lastUpdated:
        incoming.lastUpdated ??
        incoming.last_updated ??
        incoming.savedProfile?.lastUpdated ??
        new Date().toISOString(),
    };
  };

  const saveLocalAnalysis = (analysis, cleanUsername) => {
    const savedAt = new Date().toISOString();

    const payload = {
      username: cleanUsername,
      platform,
      savedAt,
      analysis: {
        ...analysis,
        lastUpdated: analysis.lastUpdated || savedAt,
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(USERNAME_KEY, cleanUsername);
    localStorage.setItem(PLATFORM_KEY, platform);
    setLocalSavedAt(savedAt);
  };

  const scrollToId = (id) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const scrollToResults = () => scrollToId("app-results");

  const loadLocalAnalysis = () => {
    const savedAnalysis = localStorage.getItem(STORAGE_KEY);

    if (!savedAnalysis) return false;

    try {
      const parsed = JSON.parse(savedAnalysis);

      if (!parsed?.analysis) return false;

      const cleanData = normaliseData(parsed.analysis);

      setData(cleanData);
      setUsername(parsed.username || cleanData.username || "");
      if (parsed.platform && platforms[parsed.platform]) {
        setPlatform(parsed.platform);
      }
      setSelectedGameIndex(0);
      setPracticeOpening(null);
      setSelectedOpening(null);
      setOpenSections(closedSections);
      setLocalSavedAt(parsed.savedAt || "");

      setSavedProfileMessage(
        `Loaded local saved report${
          parsed.username ? ` for ${parsed.username}` : ""
        }. Saved: ${safeDate(parsed.savedAt)}`
      );

      scrollToResults();
      return true;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
  };

  const clearLocalAnalysis = () => {
    localStorage.removeItem(STORAGE_KEY);
    setLocalSavedAt("");
    setSavedProfileMessage("Local saved report cleared.");
  };

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const openOnly = (key) => {
    setOpenSections({
      ...closedSections,
      [key]: true,
    });

    scrollToId(`section-${key}`);
  };

  const jumpToSection = (target) => {
    const sectionKey = target.replace("section-", "");

    if (closedSections[sectionKey] !== undefined) {
      setOpenSections((prev) => ({
        ...prev,
        [sectionKey]: true,
      }));
    }

    setTimeout(() => {
      const el = document.getElementById(target);

      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 18;
        window.scrollTo({
          top: Math.max(y, 0),
          behavior: "smooth",
        });
        return;
      }

      const fallback = document.getElementById("app-dashboard");
      if (fallback) {
        fallback.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 160);
  };

  const startOpeningPractice = (openingName) => {
    if (!openingName) return;

    setPracticeOpening(openingName);
    scrollToId("opening-practice");
  };

  const isUnknownOpening = (name) => isUnknownOpeningName(name);

  const filterUnknownOpenings = (items) => {
    if (!Array.isArray(items)) return [];
    if (showUnknownOpenings) return items;

    return items.filter((item) => {
      const name =
        typeof item === "string" ? item : item?.name || item?.opening || "";

      return !isUnknownOpening(name);
    });
  };

  const monthsToImport = isPremium ? importMonths : Math.min(importMonths, 3);

  const importGames = async () => {
    setLoading(true);
    setLoadingStep(
      `Finding your recent ${platforms[platform]?.label || "chess"} games...`
    );
    setError("");
    setSavedProfileMessage("");
    setData(null);
    setSelectedGameIndex(0);
    setPracticeOpening(null);
    setSelectedOpening(null);
    setOpenSections(closedSections);

    const cleanUsername = username.trim();

    try {
      if (!cleanUsername) {
        throw new Error("Please enter a username.");
      }

      const selectedPlatform = platforms[platform] || platforms.chesscom;

      localStorage.setItem(USERNAME_KEY, cleanUsername);
      localStorage.setItem(PLATFORM_KEY, platform);
      localStorage.setItem(IMPORT_MONTHS_KEY, String(monthsToImport));

      await trackEvent("frontend_import_started", {
        username: cleanUsername,
        platform,
        months: monthsToImport,
        premiumDemo: isPremium,
      });

      setLoadingStep(
        isPremium
          ? `Fetching up to 12 months of ${selectedPlatform.label} games...`
          : `Fetching your recent ${selectedPlatform.label} games...`
      );

      const res = await fetch(
        `${API_BASE}/api/import/${selectedPlatform.apiPath}/${encodeURIComponent(
          cleanUsername
        )}?months=${monthsToImport}`
      );

      const text = await res.text();
      let json = null;

      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok || !json) {
        throw new Error(
          json?.detail ||
            text ||
            "We could not import those games right now. Please check the username and try again."
        );
      }

      setLoadingStep("Detecting your opening patterns...");
      await new Promise((resolve) => setTimeout(resolve, 250));

      setLoadingStep("Building your style profile and recommendations...");
      await new Promise((resolve) => setTimeout(resolve, 250));

      const cleanData = normaliseData(json);
      setData(cleanData);
      saveLocalAnalysis(cleanData, cleanUsername);

      setSavedProfileMessage(
        `Import complete for ${
          cleanData.username || cleanUsername
        }. Saved locally so you can load it next time.`
      );

      await trackEvent("frontend_import_completed", {
        username: cleanUsername,
        platform,
        gamesImported: cleanData.gamesImported ?? cleanData.total_games,
        months: monthsToImport,
      });

      scrollToResults();
    } catch (err) {
      setError(getFriendlyError(err.message));
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const loadSavedProfile = async () => {
    const cleanUsername = username.trim();

    setError("");
    setSavedProfileMessage("");

    if (!cleanUsername) {
      const loadedLocal = loadLocalAnalysis();

      if (!loadedLocal) {
        setError("Enter a username first, or import games once.");
      }

      return;
    }

    if (cleanUsername.toLowerCase() === "demoplayer") {
      setError("");
      setSavedProfileMessage(
        "DemoPlayer is a demo account, not a saved profile. Use Try Demo Account instead."
      );
      return;
    }

    setLoading(true);
    setLoadingStep("Looking for your saved Opening Fit profile...");

    try {
      const response = await fetch(
        `${API_BASE}/api/profile/${encodeURIComponent(cleanUsername)}?platform=${encodeURIComponent(platform)}`
      );

      const text = await response.text();
      let profile = null;

      try {
        profile = JSON.parse(text);
      } catch {
        profile = null;
      }

      if (!response.ok || !profile) {
        const loadedLocal = loadLocalAnalysis();

        if (loadedLocal) return;

        throw new Error(
          profile?.detail ||
            "No saved profile found yet. Import this username first, then you can load it next time."
        );
      }

      const latestResult = normaliseData(profile.latestResult);

      if (!latestResult) {
        const loadedLocal = loadLocalAnalysis();

        if (loadedLocal) return;

        throw new Error(
          "Saved profile found, but it did not contain any saved analysis. Import games again to refresh it."
        );
      }

      setData(latestResult);
      saveLocalAnalysis(latestResult, profile.username || cleanUsername);
      setOpenSections(closedSections);
      setSelectedGameIndex(0);
      setPracticeOpening(null);
      setSelectedOpening(null);

      setSavedProfileMessage(
        `Loaded saved backend profile for ${
          profile.username
        }. Last updated: ${safeDate(profile.lastUpdated)}`
      );

      await trackEvent("frontend_saved_profile_loaded", {
        username: cleanUsername,
        platform,
      });

      scrollToResults();
    } catch (err) {
      setError(getFriendlyError(err.message));
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const loadDemoAccount = async () => {
    setError("");
    setSavedProfileMessage("");
    setLoading(true);
    setLoadingStep("Loading demo profile so you can preview Opening Fit...");

    try {
      const response = await fetch(`${API_BASE}/api/demo`);
      const text = await response.text();

      let demoData = null;

      try {
        demoData = JSON.parse(text);
      } catch {
        demoData = null;
      }

      if (!response.ok || !demoData) {
        throw new Error(
          text ||
            "Demo profile could not be loaded. The live backend may not have the /api/demo route deployed yet."
        );
      }

      const cleanDemoData = normaliseData(demoData);

      setData(cleanDemoData);
      setUsername("DemoPlayer");
      setSelectedGameIndex(0);
      setPracticeOpening(null);
      setSelectedOpening(null);
      setOpenSections(closedSections);
      setSavedProfileMessage(
        "Demo profile loaded. This is sample data, so use Import Games for your real saved profile."
      );

      await trackEvent("frontend_demo_loaded", {
        username: "DemoPlayer",
      });

      scrollToResults();
    } catch (err) {
      setError(getFriendlyError(err.message));
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const submitFeedback = async () => {
    const message = feedbackMessage.trim();

    if (!message) {
      setFeedbackStatus("Please type a message first.");
      return;
    }

    setFeedbackSending(true);
    setFeedbackStatus("Sending feedback...");

    try {
      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          contact: feedbackContact.trim() || null,
          username: username.trim() || null,
          platform,
          page: "Opening Fit app",
          createdAt: new Date().toISOString(),
        }),
      });

      const text = await response.text();

      let parsed = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        throw new Error(parsed?.detail || parsed?.message || text);
      }

      setFeedbackMessage("");
      setFeedbackContact("");
      setFeedbackStatus("Thanks — feedback saved.");
    } catch (err) {
      setFeedbackStatus(getFeedbackError(err.message));
    } finally {
      setFeedbackSending(false);
    }
  };

  const verdictClass = (verdict) => {
    if (verdict === "Keep") return "verdict keep";
    if (verdict === "Improve") return "verdict improve";
    if (verdict === "Avoid" || verdict === "Avoid for now") {
      return "verdict avoid";
    }
    return "verdict test";
  };

  const filteredTopOpenings = useMemo(() => {
    return filterUnknownOpenings(data?.top_openings || []);
  }, [data, showUnknownOpenings]);

  const filteredBestOpenings = useMemo(() => {
    return filterUnknownOpenings(data?.best_openings || []);
  }, [data, showUnknownOpenings]);

  const filteredPreferredWhite = useMemo(() => {
    return filterUnknownOpenings(data?.preferred_white || []);
  }, [data, showUnknownOpenings]);

  const filteredPreferredBlack = useMemo(() => {
    return filterUnknownOpenings(data?.preferred_black || []);
  }, [data, showUnknownOpenings]);

  const filteredRecentGames = useMemo(() => {
    return filterUnknownOpenings(data?.recent_games || []);
  }, [data, showUnknownOpenings]);

  const chartData = useMemo(() => {
    return filteredTopOpenings.slice(0, isPremium ? 10 : 6);
  }, [filteredTopOpenings, isPremium]);

  const fitData = useMemo(() => {
    return buildOpeningFitData({
      ...data,
      top_openings: filteredTopOpenings,
      best_openings: filteredBestOpenings,
      preferred_white: filteredPreferredWhite,
      preferred_black: filteredPreferredBlack,
    });
  }, [
    data,
    filteredTopOpenings,
    filteredBestOpenings,
    filteredPreferredWhite,
    filteredPreferredBlack,
  ]);

  const whiteDetailedRecommendations = useMemo(() => {
    return filterUnknownOpenings(
      data?.opening_recommendations?.whiteDetailed ||
        data?.recommendedOpenings?.whiteDetailed ||
        []
    );
  }, [data, showUnknownOpenings]);

  const blackDetailedRecommendations = useMemo(() => {
    return filterUnknownOpenings(
      data?.opening_recommendations?.blackDetailed ||
        data?.recommendedOpenings?.blackDetailed ||
        []
    );
  }, [data, showUnknownOpenings]);

  const smartRecommendationSummary = useMemo(() => {
    const summary = [];

    const bestFit = fitData.bestOpening;
    const weakFit = fitData.weakestOpening;
    const top = filteredTopOpenings[0];

    if (bestFit) {
      summary.push(
        `${getOpeningName(bestFit)} currently looks like your strongest Opening Fit. It scores ${bestFit.fitScore}/100 and matches your ${fitData.playerStyle.title.toLowerCase()} profile.`
      );
    }

    if (top) {
      summary.push(
        `Your most common opening is ${top.name}. Because it appears often, improving this opening should give you the biggest overall return.`
      );
    }

    if (weakFit && getOpeningName(weakFit) !== getOpeningName(bestFit)) {
      summary.push(
        `${getOpeningName(weakFit)} may need attention. It currently scores ${weakFit.fitScore}/100, so review the first few moves and common plans.`
      );
    }

    if (summary.length === 0) {
      summary.push(
        "Import more games to unlock a stronger personalised recommendation summary."
      );
    }

    return summary;
  }, [fitData, filteredTopOpenings]);

  const personalTrainingPlan = useMemo(() => {
    const plan = [];

    const bestFit = fitData.bestOpening;
    const weakFit = fitData.weakestOpening;

    const mostPlayed = [...filteredTopOpenings]
      .filter((item) => (item.games || 0) >= 3)
      .sort((a, b) => (b.games || 0) - (a.games || 0));

    const mainOpening = mostPlayed[0];
    const whitePick = filteredPreferredWhite?.[0];
    const blackPick = filteredPreferredBlack?.[0];

    if (bestFit) {
      plan.push({
        title: `Build around ${getOpeningName(bestFit)}`,
        text: `This is your best current Opening Fit at ${bestFit.fitScore}/100. Keep it in your repertoire and learn one simple plan after the first few moves.`,
        action: `Practise ${getOpeningName(bestFit)}`,
        opening: getOpeningName(bestFit),
      });
    }

    if (mainOpening && getOpeningName(mainOpening) !== getOpeningName(bestFit)) {
      plan.push({
        title: `Make ${mainOpening.name} more reliable`,
        text: `You have played this ${mainOpening.games} times, so small improvements here will affect a lot of your games. Review the first 6 moves and the main middlegame plan.`,
        action: `Practise ${mainOpening.name}`,
        opening: mainOpening.name,
      });
    }

    if (weakFit && getOpeningName(weakFit) !== getOpeningName(bestFit)) {
      plan.push({
        title: `Repair or replace ${getOpeningName(weakFit)}`,
        text: `This opening is your weakest current fit at ${weakFit.fitScore}/100. Try one simpler variation before dropping it completely.`,
        action: `Practise ${getOpeningName(weakFit)}`,
        opening: getOpeningName(weakFit),
      });
    }

    if (whitePick) {
      plan.push({
        title: `Build your White repertoire around ${whitePick.name}`,
        text: "This appears often in your White games. Learn the first 6 moves, then one simple plan for what to do after development.",
        action: "Practise as White",
        opening: whitePick.name,
      });
    }

    if (blackPick) {
      plan.push({
        title: `Tighten your Black repertoire with ${blackPick.name}`,
        text: "This is one of your regular Black openings. Focus on reaching a familiar setup instead of memorising too many sidelines.",
        action: "Practise as Black",
        opening: blackPick.name,
      });
    }

    if (Array.isArray(data?.training_plan) && data.training_plan.length) {
      data.training_plan.forEach((step, index) => {
        if (typeof step === "string") {
          plan.push({
            title: `Backend suggestion ${index + 1}`,
            text: step,
            action: null,
            opening: null,
          });
        }
      });
    }

    if (plan.length === 0) {
      return [
        {
          title: "Import more games to unlock a personal plan",
          text: "Once Opening Fit has enough games, it will identify your strongest openings, weak spots, and training priorities.",
          action: null,
          opening: null,
        },
      ];
    }

    const uniquePlan = [];
    const seenTitles = new Set();

    plan.forEach((item) => {
      if (!seenTitles.has(item.title)) {
        seenTitles.add(item.title);
        uniquePlan.push(item);
      }
    });

    return uniquePlan.slice(0, isPremium ? 8 : 4);
  }, [
    data,
    fitData,
    filteredTopOpenings,
    filteredPreferredWhite,
    filteredPreferredBlack,
    isPremium,
  ]);

  const allOpeningsForSnapshot = useMemo(() => {
    const combined = [];

    if (Array.isArray(filteredTopOpenings)) combined.push(...filteredTopOpenings);
    if (Array.isArray(filteredBestOpenings)) combined.push(...filteredBestOpenings);
    if (Array.isArray(filteredPreferredWhite)) combined.push(...filteredPreferredWhite);
    if (Array.isArray(filteredPreferredBlack)) combined.push(...filteredPreferredBlack);
    if (Array.isArray(fitData?.scoredOpenings)) combined.push(...fitData.scoredOpenings);

    const merged = new Map();

    combined.forEach((opening) => {
      const name = getOpeningName(opening);
      if (isUnknownOpeningName(name)) return;

      const key = name.toLowerCase();
      const existing = merged.get(key);

      if (!existing || getOpeningGames(opening) > getOpeningGames(existing)) {
        merged.set(key, {
          ...opening,
          name,
          games: getOpeningGames(opening),
          win_rate: getWinRate(opening),
          verdict: opening.fitVerdict || opening.verdict || getOpeningVerdict(opening, opening.fitScore || 50),
        });
      }
    });

    return Array.from(merged.values());
  }, [
    filteredTopOpenings,
    filteredBestOpenings,
    filteredPreferredWhite,
    filteredPreferredBlack,
    fitData,
  ]);

  const selectedGame = filteredRecentGames?.[selectedGameIndex] || null;

  const selectedReplayGame = useMemo(() => {
    if (!selectedGame) return null;

    const parsedMoves =
      Array.isArray(selectedGame.moves) && selectedGame.moves.length
        ? selectedGame.moves
        : getMovesFromPgn(selectedGame.pgn);

    return {
      id: selectedGame.url || selectedGame.pgn || `${selectedGameIndex}`,
      white:
        selectedGame.white_username ||
        selectedGame.whiteUsername ||
        selectedGame.white ||
        "White",
      black:
        selectedGame.black_username ||
        selectedGame.blackUsername ||
        selectedGame.black ||
        "Black",
      result: selectedGame.result || "",
      moves: parsedMoves,
    };
  }, [selectedGame, selectedGameIndex]);

  useEffect(() => {
    setSelectedGameIndex(0);
  }, [showUnknownOpenings]);

  return (
    <>
      <div className="page">
        <FloatingAppMenu
          data={data}
          onJump={jumpToSection}
          onPractice={startOpeningPractice}
          activeView={activeView}
          onViewChange={setActiveView}
        />

        {showLanding ? (
          <LandingModal
            username={username}
            setUsername={setUsername}
            platform={platform}
            setPlatform={setPlatform}
            onImport={importGames}
            loading={loading}
            onClose={() => setShowLanding(false)}
          />
        ) : null}

        <LandingSection onOpeningClick={startOpeningPractice} />

        <main className="container appShell" id="app-dashboard">
          <header className="hero heroCard">
            <div className="heroTop">
              <div className="heroTitleWrap">
                <p className="eyebrow">Opening Fit App</p>
                <h1>Analyse your chess openings</h1>
                <p className="subtext">
                  Import your recent games and get a clean report showing your
                  playing style, best openings, weak spots, and simple repertoire
                  suggestions.
                </p>
              </div>
            </div>

            <div className="searchRow topBar appActionPanel">
              <div className="platformSelector">
                <button
                  type="button"
                  className={`platformButton ${
                    platform === "chesscom" ? "platformButtonActive" : ""
                  }`}
                  onClick={() => setPlatform("chesscom")}
                >
                  Chess.com
                </button>

                <button
                  type="button"
                  className={`platformButton ${
                    platform === "lichess" ? "platformButtonActive" : ""
                  }`}
                  onClick={() => setPlatform("lichess")}
                >
                  Lichess
                </button>
              </div>

              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={
                  platforms[platform]?.usernamePlaceholder || "Chess username"
                }
              />

              <select
                className="input monthSelect"
                value={importMonths}
                onChange={(e) => setImportMonths(Number(e.target.value))}
                aria-label="Months to import"
              >
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={6} disabled={!isPremium}>
                  6 months {isPremium ? "" : "— Premium"}
                </option>
                <option value={12} disabled={!isPremium}>
                  12 months {isPremium ? "" : "— Premium"}
                </option>
              </select>

              <div className="appActionButtons">
                <button
                  className="primaryBtn"
                  type="button"
                  onClick={importGames}
                  disabled={loading || !username.trim()}
                >
                  {loading
                    ? "Working..."
                    : isPremium
                    ? `Import ${monthsToImport} Month${
                        monthsToImport === 1 ? "" : "s"
                      } from ${platforms[platform]?.label || "Platform"}`
                    : `Import ${monthsToImport} Month${
                        monthsToImport === 1 ? "" : "s"
                      } from ${platforms[platform]?.label || "Platform"}`}
                </button>

                <button
                  className="secondaryButton savedProfileButton"
                  type="button"
                  onClick={loadSavedProfile}
                  disabled={loading}
                >
                  Load Saved Profile
                </button>

                <button
                  className="ghostButton demoAccountButton"
                  type="button"
                  onClick={loadDemoAccount}
                  disabled={loading}
                >
                  Try Demo Account
                </button>

                <button
                  className="ghostButton"
                  type="button"
                  onClick={importGames}
                  disabled={loading || !username.trim()}
                >
                  Refresh Games
                </button>
              </div>
            </div>

            <div className="filtersRow">
              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={showUnknownOpenings}
                  onChange={(e) => setShowUnknownOpenings(e.target.checked)}
                />
                <span>Show unclassified openings</span>
              </label>

              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                />
                <span>Premium demo mode</span>
              </label>
            </div>

            {!isPremium && importMonths > 3 ? (
              <p className="statusMessage">
                Free mode imports up to 3 months. Turn on Premium demo mode to preview 6 or 12 month imports.
              </p>
            ) : null}

            {apiStatus !== "online" ? (
              <p className="statusMessage">
                Backend status: {apiStatus}. Some features may not work until
                your backend is running.
              </p>
            ) : null}

            {localSavedAt ? (
              <div className="savedHistoryRow">
                <span>Local saved report: {safeDate(localSavedAt)}</span>
                <button
                  className="ghostButton"
                  type="button"
                  onClick={clearLocalAnalysis}
                >
                  Clear local save
                </button>
              </div>
            ) : null}

            {loadingStep ? <p className="statusMessage">{loadingStep}</p> : null}

            {savedProfileMessage ? (
              <p className="successMessage">{savedProfileMessage}</p>
            ) : null}
          </header>

          {loading && (
            <section className="card loadingCard">
              <div className="loadingSpinner" />
              <div>
                <h3>Preparing your report</h3>
                <p>{loadingStep || "Opening Fit is working..."}</p>
              </div>
            </section>
          )}

          {practiceOpening && (
            <div id="opening-practice">
              <OpeningPracticeBoard
                openingName={practiceOpening}
                onClose={() => setPracticeOpening(null)}
              />
            </div>
          )}

          {error && <div className="errorBox">{error}</div>}

          {!data && !loading && !error && (
            <section className="placeholderGrid grid3">
              <div className="card smallCard">
                <h3>Style profile</h3>
                <p>
                  Discover whether your games are tactical, solid, direct, or
                  positional.
                </p>
              </div>

              <div className="card smallCard">
                <h3>Opening verdicts</h3>
                <p>See which openings to keep, improve, or avoid.</p>
              </div>

              <div className="card smallCard">
                <h3>Personal plan</h3>
                <p>
                  Get training steps based on the openings you actually play.
                </p>
              </div>
            </section>
          )}

          {data && (
            <div id="app-results">
              <section className="statsGrid">
                <div className="card statCard">
                  <span className="statLabel">Player</span>
                  <span className="statValue">{data.username}</span>
                </div>

                <div className="card statCard">
                  <span className="statLabel">Platform</span>
                  <span className="statValue smallStatValue">
                    {platforms[platform]?.label || "Chess"}
                  </span>
                </div>

                <div className="card statCard">
                  <span className="statLabel">Games analysed</span>
                  <span className="statValue">{data.total_games}</span>
                </div>

                <div className="card statCard">
                  <span className="statLabel">Recent activity</span>
                  <span className="statValue">
                    {data.months_checked || monthsToImport} month
                    {(data.months_checked || monthsToImport) === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="card statCard">
                  <span className="statLabel">Plan</span>
                  <span className="statValue smallStatValue">
                    {isPremium ? "Premium demo" : "Free"}
                  </span>
                </div>

                <div className="card statCard">
                  <span className="statLabel">Last updated</span>
                  <span className="statValue smallStatValue">
                    {data.lastUpdated
                      ? new Date(data.lastUpdated).toLocaleDateString()
                      : "Today"}
                  </span>
                </div>
              </section>

              <AppViewTabs
                activeView={activeView}
                onChange={(view) => {
                  setActiveView(view);

                  setTimeout(() => {
                    const el = document.getElementById("app-results");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 80);
                }}
              />

              <OpeningSnapshot
                openings={allOpeningsForSnapshot}
                onSelectOpening={setSelectedOpening}
              />

              {activeView === "overview" ? (
                <>
                  <div id="section-fit">
                <OpeningFitSummaryCard
                  fitData={fitData}
                  onPractice={startOpeningPractice}
                />

                <OpeningFitScoreList
                  fitData={fitData}
                  onPractice={startOpeningPractice}
                  onSelectOpening={setSelectedOpening}
                />
              </div>

              <section className="card quickNavCard">
                <h2>Quick View</h2>

                <div className="quickNavGrid">
                  <button
                    className="quickNavBtn secondaryBtn"
                    type="button"
                    onClick={() => jumpToSection("section-fit")}
                  >
                    Fit Score
                  </button>
                  <button
                    className="quickNavBtn secondaryBtn"
                    type="button"
                    onClick={() => jumpToSection("section-style")}
                  >
                    Style Profile
                  </button>
                  <button
                    className="quickNavBtn secondaryBtn"
                    type="button"
                    onClick={() => jumpToSection("section-recommendations")}
                  >
                    Opening Suggestions
                  </button>
                  <button
                    className="quickNavBtn secondaryBtn"
                    type="button"
                    onClick={() => jumpToSection("section-verdicts")}
                  >
                    Keep / Improve / Avoid
                  </button>
                  <button
                    className="quickNavBtn secondaryBtn"
                    type="button"
                    onClick={() => jumpToSection("section-chart")}
                  >
                    Win Rate Chart
                  </button>
                  <button
                    className="quickNavBtn secondaryBtn"
                    type="button"
                    onClick={() => jumpToSection("section-training")}
                  >
                    Personal Plan
                  </button>
                  <button
                    className="quickNavBtn secondaryBtn"
                    type="button"
                    onClick={() => jumpToSection("section-replay")}
                  >
                    Game Replay
                  </button>
                </div>
              </section>

              {!isPremium ? (
                <section className="card premiumCard">
                  <div className="premiumHeader">
                    <span className="premiumBadge">Premium Preview</span>
                    <h2>Unlock the full Opening Fit report</h2>
                  </div>

                  <p>
                    You are viewing the free version. Premium will unlock deeper
                    opening stats, longer imports, advanced training plans and
                    future Stockfish analysis.
                  </p>

                  <div className="lockedFeatureGrid">
                    {premiumFeatures.map((feature) => (
                      <div className="lockedFeature" key={feature}>
                        🔒 {feature}
                      </div>
                    ))}
                  </div>

                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={() => setIsPremium(true)}
                  >
                    Preview Premium Mode
                  </button>
                </section>
              ) : null}

              <div id="section-style">
                <Section
                  title="Style Profile"
                  isOpen={openSections.style}
                  onToggle={() => toggleSection("style")}
                  badge={filterUnknownOpenings(
                    data.style_profile?.labels || []
                  ).join(" · ")}
                >
                  <div className="twoCol">
                    <div>
                      <div className="chips">
                        {filterUnknownOpenings(
                          data.style_profile?.labels || []
                        ).map((label, index) => (
                          <span className="chip" key={index}>
                            {label}
                          </span>
                        ))}
                      </div>

                      <p className="profileSummary">
                        {data.style_profile?.summary ||
                          "Your style profile will appear here once enough games are analysed."}
                      </p>

                      <h3>Top Opening Families</h3>

                      <div className="list">
                        {filterUnknownOpenings(
                          data.style_profile?.top_opening_families || []
                        ).length ? (
                          filterUnknownOpenings(
                            data.style_profile?.top_opening_families || []
                          ).map((item, index) => (
                            <button
                              className="listItem openingPracticeLink"
                              key={index}
                              type="button"
                              onClick={() => startOpeningPractice(item)}
                            >
                              <strong>{item}</strong>
                              <span>Practice</span>
                            </button>
                          ))
                        ) : (
                          <EmptyState
                            title="No opening families yet"
                            text="Import more games to detect your most common opening families."
                          />
                        )}
                      </div>
                    </div>

                    <div className="premiumMiniCard">
                      <p className="premiumLabel">
                        {isPremium ? "Premium Active" : "Premium Preview"}
                      </p>
                      <h3>Best Openings For You</h3>

                      <div className="list">
                        {fitData.scoredOpenings.length ? (
                          fitData.scoredOpenings.slice(0, 4).map((item, index) => {
                            const rate = getWinRate(item);

                            return (
                              <button
                                className="listItem openingPracticeLink"
                                key={index}
                                type="button"
                                onClick={() =>
                                  startOpeningPractice(getOpeningName(item))
                                }
                              >
                                <div>
                                  <strong>{getOpeningName(item)}</strong>
                                  <div className="smallText">
                                    {getOpeningGames(item)} games · Fit{" "}
                                    {item.fitScore}/100
                                  </div>
                                </div>

                                <div className="rightStat">
                                  <div>{rate}%</div>
                                  <div className={verdictClass(item.fitVerdict)}>
                                    {item.fitVerdict}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <EmptyState
                            title="No premium preview yet"
                            text="Once there are enough recognised openings, your best-fit openings will appear here."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </Section>
              </div>
                </>
              ) : null}

              {activeView === "recommendations" ? (
                <>
                  <div id="section-recommendations">
                <Section
                  title="Opening Suggestions"
                  isOpen={openSections.recommendations}
                  onToggle={() => toggleSection("recommendations")}
                >
                  <div className="twoCol">
                    <div>
                      <h3>Recommended as White</h3>
                      <div className="list">
                        {filterUnknownOpenings(
                          data.opening_recommendations?.white || []
                        ).length ? (
                          filterUnknownOpenings(
                            data.opening_recommendations?.white || []
                          ).map((item, index) => (
                            <button
                              className="listItem openingPracticeLink"
                              key={index}
                              type="button"
                              onClick={() => startOpeningPractice(item)}
                            >
                              <strong>{item}</strong>
                              <span>Practice</span>
                            </button>
                          ))
                        ) : (
                          <EmptyState
                            title="No White suggestions yet"
                            text="Import more games to unlock stronger White repertoire suggestions."
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <h3>Recommended as Black</h3>
                      <div className="list">
                        {filterUnknownOpenings(
                          data.opening_recommendations?.black || []
                        ).length ? (
                          filterUnknownOpenings(
                            data.opening_recommendations?.black || []
                          ).map((item, index) => (
                            <button
                              className="listItem openingPracticeLink"
                              key={index}
                              type="button"
                              onClick={() => startOpeningPractice(item)}
                            >
                              <strong>{item}</strong>
                              <span>Practice</span>
                            </button>
                          ))
                        ) : (
                          <EmptyState
                            title="No Black suggestions yet"
                            text="Import more games to unlock stronger Black repertoire suggestions."
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {isPremium && whiteDetailedRecommendations.length ? (
                    <div className="recommendationDetails">
                      <h3>Why these openings fit you as White</h3>

                      <div className="openingExplainGrid">
                        {whiteDetailedRecommendations.map((opening) => (
                          <article
                            className="openingExplainCard"
                            key={opening.name}
                          >
                            <h4>{opening.name}</h4>
                            <p>{opening.reason}</p>
                            <p>
                              <strong>Simple plan:</strong> {opening.plan}
                            </p>
                            <p>
                              <strong>Avoid:</strong> {opening.mistakeToAvoid}
                            </p>
                            <span>{opening.difficulty}</span>

                            <button
                              className="secondaryBtn explainPracticeBtn"
                              type="button"
                              onClick={() => startOpeningPractice(opening.name)}
                            >
                              Practise
                            </button>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : !isPremium ? (
                    <LockedPremiumCard
                      title="Detailed opening explanations are premium"
                      text="Free shows basic suggestions. Premium explains why each opening fits you and what mistakes to avoid."
                    />
                  ) : null}

                  {isPremium && blackDetailedRecommendations.length ? (
                    <div className="recommendationDetails">
                      <h3>Why these openings fit you as Black</h3>

                      <div className="openingExplainGrid">
                        {blackDetailedRecommendations.map((opening) => (
                          <article
                            className="openingExplainCard"
                            key={opening.name}
                          >
                            <h4>{opening.name}</h4>
                            <p>{opening.reason}</p>
                            <p>
                              <strong>Simple plan:</strong> {opening.plan}
                            </p>
                            <p>
                              <strong>Avoid:</strong> {opening.mistakeToAvoid}
                            </p>
                            <span>{opening.difficulty}</span>

                            <button
                              className="secondaryBtn explainPracticeBtn"
                              type="button"
                              onClick={() => startOpeningPractice(opening.name)}
                            >
                              Practise
                            </button>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="spacerTop">
                    <h3>Summary</h3>
                    <div className="list">
                      {smartRecommendationSummary.map((item, index) => (
                        <div className="listItem" key={index}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>
              </div>

              <div id="section-verdicts">
                <Section
                  title="Keep / Improve / Avoid"
                  isOpen={openSections.verdicts}
                  onToggle={() => toggleSection("verdicts")}
                  badge={`${fitData.scoredOpenings.length} tracked`}
                >
                  <div className="list">
                    {fitData.scoredOpenings.length ? (
                      fitData.scoredOpenings.map((item, index) => {
                        const rate = getWinRate(item);

                        return (
                          <button
                            className="listItem openingPracticeLink"
                            key={index}
                            type="button"
                            onClick={() =>
                              startOpeningPractice(getOpeningName(item))
                            }
                          >
                            <div>
                              <strong>{getOpeningName(item)}</strong>
                              <div className="smallText">
                                {getOpeningGames(item)} games · {rate}% score ·
                                Fit {item.fitScore}/100
                              </div>
                              <div className="smallText">
                                {item.fitExplanation}
                              </div>
                            </div>

                            <div className="rightStat">
                              <div>{rate}%</div>
                              <div className={verdictClass(item.fitVerdict)}>
                                {item.fitVerdict}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <EmptyState
                        title="No opening verdicts yet"
                        text="Verdicts appear once you have enough recognised openings in your imported games."
                      />
                    )}
                  </div>
                </Section>
              </div>
                </>
              ) : null}

              {activeView === "data" ? (
                <>
                  <div id="section-chart">
                <Section
                  title="Opening Win Rate"
                  isOpen={openSections.chart}
                  onToggle={() => toggleSection("chart")}
                  badge={`${chartData.length} openings`}
                >
                  <div className="chartList">
                    {chartData.length ? (
                      chartData.map((item, index) => {
                        const rate = item.win_rate ?? item.winRate ?? 0;

                        return (
                          <button
                            className="chartRow openingChartPracticeLink"
                            key={index}
                            type="button"
                            onClick={() => startOpeningPractice(item.name)}
                          >
                            <div className="chartLabel">{item.name}</div>

                            <div className="chartBarWrap">
                              <div
                                className="chartBar"
                                style={{
                                  width: `${Math.max(rate || 0, 2)}%`,
                                }}
                              />
                            </div>

                            <div className="chartValue">{rate}%</div>
                          </button>
                        );
                      })
                    ) : (
                      <EmptyState
                        title="No chart data yet"
                        text="Win-rate charts appear after Opening Fit finds recognised openings in your games."
                      />
                    )}
                  </div>
                </Section>
              </div>
                </>
              ) : null}

              {activeView === "training" ? (
                <>
                  <div id="section-training">
                <Section
                  title="Personal Training Plan"
                  isOpen={openSections.training}
                  onToggle={() => toggleSection("training")}
                  badge={`${personalTrainingPlan.length} steps`}
                >
                  <div className="trainingPlanList">
                    {personalTrainingPlan.map((item, index) => (
                      <div className="trainingPlanItem" key={index}>
                        <div className="trainingStepNumber">{index + 1}</div>

                        <div className="trainingStepContent">
                          <h3>{item.title}</h3>
                          <p>{item.text}</p>

                          {item.opening ? (
                            <button
                              className="secondaryBtn trainingPracticeBtn"
                              type="button"
                              onClick={() => startOpeningPractice(item.opening)}
                            >
                              {item.action || "Practice opening"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!isPremium ? (
                    <LockedPremiumCard
                      title="Advanced training plan locked"
                      text="Premium will show more steps, deeper weaknesses, and longer import history."
                    />
                  ) : null}
                </Section>
              </div>
                </>
              ) : null}

              {activeView === "games" ? (
                <>
                  <div id="section-replay">
                <Section
                  title="Game Replay"
                  isOpen={openSections.replay}
                  onToggle={() => toggleSection("replay")}
                  badge={selectedGame ? selectedGame.opening : null}
                >
                  <div className="analysisGrid boardSection">
                    <div className="movesPanel">
                      <h3>Recent Games</h3>

                      <div className="gamePickerList">
                        {filteredRecentGames.length ? (
                          filteredRecentGames.map((game, index) => (
                            <button
                              key={index}
                              type="button"
                              className={`gamePickerButton ${
                                selectedGameIndex === index
                                  ? "gamePickerButtonActive"
                                  : ""
                              }`}
                              onClick={() => setSelectedGameIndex(index)}
                            >
                              <div className="gamePickerTop">
                                <strong>{game.opening}</strong>
                                <span>{game.result}</span>
                              </div>

                              <div className="smallText">
                                {game.white_username || game.whiteUsername} vs{" "}
                                {game.black_username || game.blackUsername} ·{" "}
                                {game.time_class || game.timeClass || "-"}
                              </div>
                            </button>
                          ))
                        ) : (
                          <EmptyState
                            title="No replay games found"
                            text="Recent games will appear here when the import includes PGN or move data."
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      {selectedGame && selectedReplayGame ? (
                        <>
                          <div className="boardMeta">
                            <div>
                              <strong>Opening:</strong>{" "}
                              <button
                                className="tableOpeningBtn"
                                type="button"
                                onClick={() =>
                                  startOpeningPractice(selectedGame.opening)
                                }
                              >
                                {selectedGame.opening}
                              </button>
                            </div>

                            <div>
                              <strong>Result:</strong> {selectedGame.result}
                            </div>

                            <div>
                              <strong>Players:</strong>{" "}
                              {selectedGame.white_username ||
                                selectedGame.whiteUsername}{" "}
                              vs{" "}
                              {selectedGame.black_username ||
                                selectedGame.blackUsername}
                            </div>
                          </div>

                          <GameReplayBoard
                            game={selectedReplayGame}
                            title="Game Replay"
                            initialOrientation="white"
                          />
                        </>
                      ) : (
                        <EmptyState
                          title="No game selected"
                          text="Choose a recent game from the list to replay it."
                        />
                      )}
                    </div>
                  </div>
                </Section>
              </div>
                </>
              ) : null}

              {activeView === "recommendations" ? (
                <>
                  <div id="section-preferred">
                <Section
                  title="Preferred Openings"
                  isOpen={openSections.preferred}
                  onToggle={() => toggleSection("preferred")}
                >
                  <div className="twoCol">
                    <div>
                      <h3>Preferred as White</h3>
                      <div className="list">
                        {filteredPreferredWhite.length ? (
                          filteredPreferredWhite.map((item, index) => (
                            <button
                              className="listItem openingPracticeLink"
                              key={index}
                              type="button"
                              onClick={() => startOpeningPractice(item.name)}
                            >
                              <strong>{item.name}</strong>
                              <span>{item.games} games</span>
                            </button>
                          ))
                        ) : (
                          <EmptyState
                            title="No preferred White openings yet"
                            text="Import more games to detect your most common White openings."
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <h3>Preferred as Black</h3>
                      <div className="list">
                        {filteredPreferredBlack.length ? (
                          filteredPreferredBlack.map((item, index) => (
                            <button
                              className="listItem openingPracticeLink"
                              key={index}
                              type="button"
                              onClick={() => startOpeningPractice(item.name)}
                            >
                              <strong>{item.name}</strong>
                              <span>{item.games} games</span>
                            </button>
                          ))
                        ) : (
                          <EmptyState
                            title="No preferred Black openings yet"
                            text="Import more games to detect your most common Black openings."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </Section>
              </div>
                </>
              ) : null}

              {activeView === "data" ? (
                <>
                  <div id="section-top">
                <Section
                  title="Top Openings Table"
                  isOpen={openSections.top}
                  onToggle={() => toggleSection("top")}
                  badge={`${filteredTopOpenings.length} rows`}
                >
                  {filteredTopOpenings.length ? (
                    <div className="tableWrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Opening</th>
                            <th>Games</th>
                            <th>W</th>
                            <th>D</th>
                            <th>L</th>
                            <th>Win %</th>
                            <th>Fit</th>
                          </tr>
                        </thead>

                        <tbody>
                          {(isPremium
                            ? filteredTopOpenings
                            : filteredTopOpenings.slice(0, 8)
                          ).map((opening, index) => {
                            const rate = opening.win_rate ?? opening.winRate ?? 0;
                            const fitOpening = fitData.scoredOpenings.find(
                              (item) =>
                                getOpeningName(item).toLowerCase() ===
                                getOpeningName(opening).toLowerCase()
                            );

                            return (
                              <tr
                                key={index}
                                className="clickableOpening"
                                onClick={() => setSelectedOpening(fitOpening || opening)}
                              >
                                <td>
                                  <button
                                    className="tableOpeningBtn"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      startOpeningPractice(opening.name);
                                    }}
                                  >
                                    {opening.name}
                                  </button>
                                </td>
                                <td>{opening.games}</td>
                                <td>{opening.wins}</td>
                                <td>{opening.draws}</td>
                                <td>{opening.losses}</td>
                                <td>{rate}%</td>
                                <td>{fitOpening?.fitScore || "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {!isPremium && filteredTopOpenings.length > 8 ? (
                        <LockedPremiumCard
                          title="Full opening table locked"
                          text={`Free shows your top 8 rows. Premium would show all ${filteredTopOpenings.length} tracked openings.`}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <EmptyState
                      title="No top openings yet"
                      text="Opening table data appears once recognised openings are found in your imported games."
                    />
                  )}
                </Section>
              </div>
                </>
              ) : null}
            </div>
          )}

          {activeView === "feedback" ? (
            <section className="card feedbackCard" id="feedback">
            <h2>Help improve Opening Fit</h2>
            <p>
              Found a bug, confusing result, or feature idea? Send quick feedback
              before launch.
            </p>

            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="What should be improved?"
              rows={4}
            />

            <input
              value={feedbackContact}
              onChange={(e) => setFeedbackContact(e.target.value)}
              placeholder="Email or TikTok username optional"
            />

            <button
              className="secondaryButton"
              type="button"
              onClick={submitFeedback}
              disabled={feedbackSending}
            >
              {feedbackSending ? "Sending..." : "Send Feedback"}
            </button>

            {feedbackStatus ? (
              <p className="statusMessage">{feedbackStatus}</p>
            ) : null}
            </section>
          ) : null}
        </main>

        {!showLanding && activeView !== "feedback" ? (
          <div className="landingWrap">
            <section className="card feedbackCard" id="feedback-static">
              <h2>Help improve Opening Fit</h2>
              <p>
                Found a bug, confusing result, or feature idea? Send quick feedback
                before launch.
              </p>

              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="What should be improved?"
                rows={4}
              />

              <input
                value={feedbackContact}
                onChange={(e) => setFeedbackContact(e.target.value)}
                placeholder="Email or TikTok username optional"
              />

              <button
                className="secondaryButton"
                type="button"
                onClick={submitFeedback}
                disabled={feedbackSending}
              >
                {feedbackSending ? "Sending..." : "Send Feedback"}
              </button>

              {feedbackStatus ? (
                <p className="statusMessage">{feedbackStatus}</p>
              ) : null}
            </section>
          </div>
        ) : null}

        <div className="landingWrap">
          <Footer />
        </div>
      </div>

      <OpeningDetailsModal
        opening={selectedOpening}
        onClose={() => setSelectedOpening(null)}
      />

      <Analytics />
    </>
  );
}
