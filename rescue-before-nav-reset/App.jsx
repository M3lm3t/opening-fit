import OpeningFitUXCleanup from "./components/OpeningFitUXCleanup.jsx";
import OpeningFitStudyPlanner from "./components/OpeningFitStudyPlanner.jsx";
import OpeningFitImportDoctor from "./components/OpeningFitImportDoctor.jsx";
import OpeningFitFunctionalityHub from "./components/OpeningFitFunctionalityHub.jsx";
import OpeningFitFunctionalTools from "./components/OpeningFitFunctionalTools.jsx";
import OpeningFitFinalCTA from "./components/OpeningFitFinalCTA.jsx";
import OpeningFitTrustBar from "./components/OpeningFitTrustBar.jsx";
import PolishedOpeningFitReportHero from "./components/OpeningFitReportHero.jsx";
import OpeningFitTrustSections from "./components/OpeningFitTrustSections.jsx";
import OpeningFitPolishToast from "./components/OpeningFitPolishToast.jsx";
import "./components/OpeningFitPolish.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import "./App.css";
import OpeningReportSummary from "./components/OpeningReportSummary";
import RepertoireStudyPlan from "./components/RepertoireStudyPlan";
import PremiumDashboard from "./components/PremiumDashboard";
import ImportLoadingOverlay from "./components/ImportLoadingOverlay";
import AccountPanel from "./components/AccountPanel";
import GameReplayBoard from "./components/GameReplayBoard";
import OpeningPracticeBoard from "./components/OpeningPracticeBoard";
import PremiumPanel from "./components/PremiumPanel";
import ResultsCommandCenter from "./components/ResultsCommandCenter";
import OpeningHealthScore from "./components/OpeningHealthScore";
import ProgressTracker from "./components/ProgressTracker";
import ShareReport from "./components/ShareReport";
import PremiumCoachPlan from "./components/PremiumCoachPlan";
import MyRepertoire from "./components/MyRepertoire";
import PremiumTrustStrip from "./components/PremiumTrustStrip";
import LandingModal from "./components/LandingModal";
import OpeningFitTrustUpgrade from "./components/OpeningFitTrustUpgrade";
import FounderPassLoginUpgrade from "./components/FounderPassLoginUpgrade";
import CheckoutStatusNotice from "./components/CheckoutStatusNotice";
import TrustFaq from "./components/TrustFaq";
import { Analytics } from "@vercel/analytics/react";
import OpeningDetailsModal from "./components/OpeningDetailsModal";
import OpeningSnapshot from "./components/OpeningSnapshot";
import RetentionHub from "./components/RetentionHub";
import InteractiveRepertoire from "./components/InteractiveRepertoire";
import DashboardHome from "./components/DashboardHome";
import MobileBottomNav from "./components/MobileBottomNav";
import LaunchReadySections from "./components/LaunchReadySections";


import { CoachSummaryCard, SeriousAppTabs, SeriousPremiumStrip, NextBestActions } from "./components/SeriousAppUpgrade";

import ReportHistoryVault from "./components/ReportHistoryVault";

import AppActionRouter, { AppOpeningHealthScore } from "./components/AppActionRouter";

import OpeningDiagnosisPanel from "./components/OpeningDiagnosisPanel";
import EvidenceBackedOpeningDiagnosis from "./components/EvidenceBackedOpeningDiagnosis";

import ShipReadyPanel from "./components/ShipReadyPanel";

import { CoachVerdict, RecommendedRepertoire, PremiumPath } from "./components/ProductPolish";

import CleanReportHeader from "./components/CleanReportHeader";

import IntelligentCoachInsights from "./components/IntelligentCoachInsights";

import OpeningClassificationNotice from "./components/OpeningClassificationNotice";
import { displayOpeningName, getSmartLevelAwareRecommendation, getSmartPlayerLevelProfile } from "./components/playerLevelLogic";
import AccountRestoreSync from "./components/AccountRestoreSync";
import { DEMO_REPORT } from "./demoReportData";
import OpeningFitDiagnosisFirst from "./components/OpeningFitDiagnosisFirst";
import FounderPassOutcomePanel from "./components/FounderPassOutcomePanel";
import ReportCommandBar from "./components/ReportCommandBar";

const SAMPLE_OPENING_FIT_REPORT = {
  username: "DemoPlayer",
  playerName: "DemoPlayer",
  requestedUsername: "DemoPlayer",
  gamesImported: 84,
  totalGames: 84,
  styleLabel: "Attacking practical player",
  styleSummary:
    "Your strongest results come from active piece play, open centres, and positions where you can develop quickly before choosing a direct attacking plan.",
  openings: [
    {
      name: "Vienna Game",
      games: 18,
      winRate: 67,
      colour: "white",
      verdict: "keep",
    },
    {
      name: "Italian Game",
      games: 14,
      winRate: 61,
      colour: "white",
      verdict: "keep",
    },
    {
      name: "Scandinavian Defence",
      games: 16,
      winRate: 44,
      colour: "black",
      verdict: "improve",
    },
    {
      name: "Caro-Kann Defence",
      games: 11,
      winRate: 55,
      colour: "black",
      verdict: "keep",
    },
    {
      name: "King's Gambit",
      games: 7,
      winRate: 29,
      colour: "white",
      verdict: "avoid",
    },
    {
      name: "Sicilian Defence sidelines",
      games: 9,
      winRate: 33,
      colour: "black",
      verdict: "avoid",
    },
  ],
  topOpenings: [
    {
      name: "Vienna Game",
      games: 18,
      winRate: 67,
      colour: "white",
    },
    {
      name: "Italian Game",
      games: 14,
      winRate: 61,
      colour: "white",
    },
    {
      name: "Caro-Kann Defence",
      games: 11,
      winRate: 55,
      colour: "black",
    },
  ],
  openingStats: {
    "Vienna Game": {
      games: 18,
      winRate: 67,
      colour: "white",
    },
    "Italian Game": {
      games: 14,
      winRate: 61,
      colour: "white",
    },
    "Scandinavian Defence": {
      games: 16,
      winRate: 44,
      colour: "black",
    },
    "Caro-Kann Defence": {
      games: 11,
      winRate: 55,
      colour: "black",
    },
    "King's Gambit": {
      games: 7,
      winRate: 29,
      colour: "white",
    },
  },
  recommendations: [
    {
      name: "Vienna Game",
      games: 18,
      winRate: 67,
      colour: "white",
    },
    {
      name: "Caro-Kann Defence",
      games: 11,
      winRate: 55,
      colour: "black",
    },
  ],
};

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

function Section({ title, isOpen, onToggle, children, badge = null,
  onViewChange,}) {
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

function OpeningFitScoreList({ fitData, onPractice }) {
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
              onClick={() => onPractice(name)}
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

function NextStudySession({ fitData, recentGames = [], onPractice, onViewChange }) {
  const [savedMessage, setSavedMessage] = useState("");

  if (!fitData || !fitData.scoredOpenings?.length) return null;

  const bestOpening = fitData.bestOpening;
  const weakestOpening = fitData.weakestOpening;
  const scoredOpenings = fitData.scoredOpenings || [];

  const bestName = bestOpening ? getOpeningName(bestOpening) : "your strongest opening";
  const weakName = weakestOpening ? getOpeningName(weakestOpening) : "your weakest opening";

  const reviewGames = recentGames.filter((game) => {
    const gameOpening = String(game?.opening || game?.name || "").toLowerCase();
    return weakestOpening && gameOpening.includes(weakName.toLowerCase());
  });

  const fallbackGames = recentGames.slice(0, 3);
  const gamesToReview = reviewGames.length ? reviewGames.slice(0, 3) : fallbackGames;

  const whitePick =
    scoredOpenings.find((opening) => {
      const side = getOpeningSide(opening).toLowerCase();
      const name = getOpeningName(opening).toLowerCase();
      return side.includes("white") || /vienna|italian|london|queen|ruy|scotch|english|reti|gambit/.test(name);
    }) || bestOpening;

  const blackPick =
    scoredOpenings.find((opening) => {
      const side = getOpeningSide(opening).toLowerCase();
      const name = getOpeningName(opening).toLowerCase();
      return side.includes("black") || /sicilian|caro|french|scandinavian|pirc|modern|dutch|king|nimzo|slav|grunfeld|defence|defense/.test(name);
    }) || scoredOpenings.find((opening) => getOpeningName(opening) !== getOpeningName(whitePick)) || bestOpening;

  const saveStudySession = () => {
    const payload = {
      savedAt: new Date().toISOString(),
      bestOpening: bestName,
      weakestOpening: weakName,
      whiteOpening: whitePick ? getOpeningName(whitePick) : "",
      blackOpening: blackPick ? getOpeningName(blackPick) : "",
      tasks: [
        `Review ${weakName}`,
        `Practise ${bestName}`,
        "Play a focused block using your saved repertoire",
      ],
    };

    localStorage.setItem("openingFit:nextStudySession", JSON.stringify(payload));
    setSavedMessage("Study session saved in this browser.");
  };

  const goToGames = () => {
    if (onViewChange) onViewChange("games");

    setTimeout(() => {
      const el = document.getElementById("app-results");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  return (
    <section className="nextStudyShell card">
      <div className="nextStudyHero">
        <div>
          <p className="eyebrow">Next Study Session</p>
          <h2>Your next 20 minutes of opening work</h2>
          <p className="muted">
            Opening Fit has turned your report into a focused training loop:
            review the weak spot, practise the best fit, then play a simple repertoire.
          </p>
        </div>

        <div className="nextStudyScore">
          <strong>{fitData.overallScore || "—"}</strong>
          <span>fit score</span>
        </div>
      </div>

      <div className="nextStudyGrid">
        <article className="nextStudyCard nextStudyCardWarning">
          <div className="nextStudyCardTop">
            <span>1</span>
            <p>Review weak spot</p>
          </div>

          <h3>{weakName}</h3>

          <p>
            {weakestOpening
              ? `This is currently your lowest fit at ${weakestOpening.fitScore}/100. Review where your positions start becoming uncomfortable.`
              : "Import more games to identify a clear weak opening."}
          </p>

          <div className="nextStudyMeta">
            <span>{weakestOpening ? `${getOpeningGames(weakestOpening)} games` : "Needs data"}</span>
            <span>{weakestOpening ? `${getWinRate(weakestOpening)}% score` : "—"}</span>
          </div>

          <button className="secondaryBtn" type="button" onClick={goToGames}>
            Review games
          </button>
        </article>

        <article className="nextStudyCard nextStudyCardBest">
          <div className="nextStudyCardTop">
            <span>2</span>
            <p>Practise best fit</p>
          </div>

          <h3>{bestName}</h3>

          <p>
            {bestOpening
              ? `This is your strongest current opening fit at ${bestOpening.fitScore}/100. Learn the first few moves and one simple middlegame plan.`
              : "Import more games to identify your strongest opening."}
          </p>

          <div className="nextStudyMeta">
            <span>{bestOpening ? `${getOpeningGames(bestOpening)} games` : "Needs data"}</span>
            <span>{bestOpening ? `${getWinRate(bestOpening)}% score` : "—"}</span>
          </div>

          <button
            className="primaryBtn"
            type="button"
            onClick={() => bestOpening && onPractice(bestName)}
            disabled={!bestOpening}
          >
            Practise line
          </button>
        </article>

        <article className="nextStudyCard nextStudyCardRepertoire">
          <div className="nextStudyCardTop">
            <span>3</span>
            <p>Use simple repertoire</p>
          </div>

          <h3>Play a focused block</h3>

          <div className="nextStudyRepertoire">
            <div>
              <span>White</span>
              <strong>{whitePick ? getOpeningName(whitePick) : "Needs more games"}</strong>
            </div>

            <div>
              <span>Black</span>
              <strong>{blackPick ? getOpeningName(blackPick) : "Needs more games"}</strong>
            </div>
          </div>

          <p>
            For your next games, avoid switching openings randomly. Play these choices and compare the next import.
          </p>

          <button className="secondaryBtn" type="button" onClick={saveStudySession}>
            Save study session
          </button>
        </article>
      </div>

      {gamesToReview.length ? (
        <div className="nextStudyGames">
          <div className="nextStudySubhead">
            <h3>Games worth reviewing</h3>
            <button type="button" onClick={goToGames}>
              Open game replay
            </button>
          </div>

          <div className="nextStudyGameList">
            {gamesToReview.map((game, index) => (
              <button className="nextStudyGameItem" type="button" key={index} onClick={goToGames}>
                <strong>{game.opening || "Recent game"}</strong>
                <span>
                  {game.white_username || game.whiteUsername || "White"} vs{" "}
                  {game.black_username || game.blackUsername || "Black"} ·{" "}
                  {game.result || "Result unknown"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {savedMessage ? <p className="successMessage">{savedMessage}</p> : null}
    </section>
  );
}

function FloatingAppMenu({ data, onJump, onPractice, activeView, onViewChange }) {
  const [open, setOpen] = useState(false);

  const mainItems = [
    { label: "Import", target: "app-dashboard" },
    { label: "Ratings", target: "rating-openings" },
    { label: "Premium", target: "premium" },
    { label: "Feedback", target: "feedback", view: "feedback" },
  ];

  const appViews = [
    { key: "overview", label: "Overview" },
    { key: "recommendations", label: "Recommendations" },
    { key: "training", label: "Study Session" },
    { key: "games", label: "Games" },
    { key: "data", label: "Data" },
    { key: "repertoire", label: "Interactive" },
    { key: "feedback", label: "Feedback" },
  ];

  const setBodyTab = (view) => {
    document.body.classList.add("openingfitTabbedResults");
    document.body.setAttribute("data-openingfit-tab", view);
  };

  const scrollToElement = (target) => {
    if (!target) return false;

    const offset = window.innerWidth <= 760 ? 86 : 108;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });

    return true;
  };

  const findTarget = (ids = []) => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }

    return (
      document.getElementById("app-results") ||
      document.querySelector(".reportNavScrollAnchor") ||
      document.querySelector(".appTabsCard") ||
      document.getElementById("openingfit-report") ||
      document.getElementById("opening-fit-report") ||
      document.getElementById("app-dashboard")
    );
  };

  const scrollMain = (targetId) => {
    const run = () => {
      const target = findTarget([targetId, "app-dashboard"]);
      if (scrollToElement(target)) {
        try {
          window.history.replaceState(null, "", `#${target.id || targetId}`);
        } catch {
          // Ignore hash update failures.
        }
      }
    };

    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    setTimeout(run, 120);
    setTimeout(run, 360);
    setTimeout(run, 700);
  };

  const scrollReport = (view) => {
    const nextView = view || "overview";

    const reportTargets = {
      overview: ["openingfit-report", "app-results", "app-dashboard"],
      recommendations: ["app-results", "opening-fit-report", "keep-improve-avoid", "opening-suggestions"],
      training: ["app-results", "training-plan", "study-plan"],
      games: ["app-results", "game-replay", "games"],
      data: ["app-results", "top-openings", "opening-data"],
      repertoire: ["app-results", "interactive-repertoire", "opening-practice", "repertoire"],
      feedback: ["feedback", "app-results"],
    };

    if (typeof onViewChange === "function") {
      onViewChange(nextView);
    }

    setBodyTab(nextView);

    const run = () => {
      const target = findTarget(reportTargets[nextView] || ["app-results"]);
      if (scrollToElement(target)) {
        try {
          window.history.replaceState(null, "", `#${target.id || "app-results"}`);
        } catch {
          // Ignore hash update failures.
        }
      }
    };

    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    setTimeout(run, 120);
    setTimeout(run, 360);
    setTimeout(run, 700);
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
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
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
                  if (item.view) {
                    scrollReport(item.view);
                  } else {
                    if (typeof onJump === "function") {
                      onJump(item.target);
                    }
                    scrollMain(item.target);
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
                    onClick={() => {
                      scrollReport(item.key);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
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
    { key: "training", label: "Study Session", icon: "🚀" },
    { key: "games", label: "Games", icon: "♟️" },
    { key: "data", label: "Data", icon: "📊" },
    { key: "repertoire", label: "Interactive", icon: "🧩" },
    { key: "feedback", label: "Feedback", icon: "💬" },
  ];

  const selectTab = (view) => {
    if (typeof onChange === "function") {
      onChange(view);
    }

    document.body.classList.add("openingfitTabbedResults");
    document.body.setAttribute("data-openingfit-tab", view);

    const run = () => {
      const target =
        document.getElementById("app-results") ||
        document.querySelector(".appTabsCard") ||
        document.getElementById("openingfit-report") ||
        document.getElementById("app-dashboard");

      if (!target) return;

      const offset = window.innerWidth <= 760 ? 86 : 108;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    };

    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    setTimeout(run, 120);
    setTimeout(run, 360);
  };

  return (
    <section className="card appTabsCard" id="app-results">
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
            onClick={() => selectTab(tab.key)}
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

function SeoLandingSection() {
  return (
    <section className="landingContentSection seoLandingSection" id="chess-opening-analysis">
      <div className="landingSectionHeading">
        <p className="landingEyebrow">Chess opening analysis</p>
        <h2>Find the chess openings that actually fit your games.</h2>
        <p>
          Opening Fit helps chess players analyse their real online games and turn
          opening results into a practical study plan. Instead of guessing which
          chess opening to learn next, you can import your Chess.com or Lichess
          games and see which openings are working, which need attention, and
          which ones may not suit your current playing style.
        </p>
      </div>

      <div className="seoFeatureGrid">
        <article className="seoFeatureCard">
          <h3>Chess.com and Lichess opening insights</h3>
          <p>
            Import recent games and review your most common openings, win rates,
            preferred choices as White and Black, and recurring weak spots.
          </p>
        </article>

        <article className="seoFeatureCard">
          <h3>Personal chess repertoire builder</h3>
          <p>
            Build a simple repertoire around openings that give you familiar
            middlegame plans instead of memorising random theory.
          </p>
        </article>

        <article className="seoFeatureCard">
          <h3>Opening training for club players</h3>
          <p>
            Get a focused next study session: review your weakest opening,
            practise your best fit, then play a cleaner block of games.
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
            <a href="#roadmap">Roadmap</a>
            <a href="#privacy">Privacy</a>
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

      <SeoLandingSection />

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

      <LaunchReadySections />
    </div>
  );
}





const REPORT_HISTORY_KEY = "openingFit:reportHistory";

function ReportExportAndHistory({ data, onLoadReport }) {
  const [savedReports, setSavedReports] = useState([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) || "[]");
      setSavedReports(Array.isArray(stored) ? stored : []);
    } catch {
      setSavedReports([]);
    }
  }, []);

  if (!data) return null;

  const playerName =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    data.requested_username ||
    "Opening Fit report";

  const gamesImported =
    data.gamesImported ||
    data.games_imported ||
    data.totalGames ||
    data.total_games ||
    data.gameCount ||
    data.game_count ||
    "Recent";

  const styleLabel =
    data.styleLabel ||
    data.style_label ||
    data.primaryStyle ||
    data.primary_style ||
    data.styleProfile?.label ||
    data.style_profile?.label ||
    "Opening report";

  const reportDate = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const saveReport = () => {
    const reportRecord = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      playerName,
      gamesImported,
      styleLabel,
      data,
    };

    const updated = [
      reportRecord,
      ...savedReports.filter((report) => report.playerName !== playerName),
    ].slice(0, 8);

    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(updated));
    setSavedReports(updated);
  };

  const clearReports = () => {
    localStorage.removeItem(REPORT_HISTORY_KEY);
    setSavedReports([]);
  };

  const exportPdf = () => {
    const previousTitle = document.title;
    document.title = `Opening Fit Report - ${playerName}`;
    window.print();

    setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  };

  const loadReport = (report) => {
    if (!report?.data || !onLoadReport) return;
    onLoadReport(report.data);

    setTimeout(() => {
      const reportTop = document.getElementById("opening-fit-report");
      if (reportTop) {
        reportTop.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  return (
    <section className="exportHistoryShell" id="report-history">
      <div className="exportHistoryIntro">
        <span>Export & history</span>
        <h2>Save this report or export it as a PDF.</h2>
        <p>
          Keep a local copy of your Opening Fit reports so you can compare your
          opening progress over time.
        </p>

        <div className="exportHistoryActions">
          <button type="button" onClick={exportPdf} className="exportPrimaryBtn">
            Export / print PDF
          </button>

          <button type="button" onClick={saveReport} className="exportSecondaryBtn">
            Save report
          </button>
        </div>

        <small>
          Saved reports are stored in this browser only. Cloud sync can be added
          later with Supabase accounts.
        </small>
      </div>

      <div className="currentReportSummary">
        <span>Current report</span>
        <strong>{playerName}</strong>
        <p>
          {gamesImported} games reviewed · {styleLabel} · {reportDate}
        </p>
      </div>

      <div className="savedReportsPanel">
        <div className="savedReportsHeader">
          <div>
            <span>Saved history</span>
            <h3>{savedReports.length ? "Previous reports" : "No saved reports yet"}</h3>
          </div>

          {savedReports.length ? (
            <button type="button" onClick={clearReports}>
              Clear
            </button>
          ) : null}
        </div>

        {savedReports.length ? (
          <div className="savedReportsList">
            {savedReports.map((report) => (
              <button
                type="button"
                key={report.id}
                className="savedReportItem"
                onClick={() => loadReport(report)}
              >
                <strong>{report.playerName}</strong>
                <span>
                  {report.gamesImported} games · {report.styleLabel}
                </span>
                <small>
                  Saved{" "}
                  {new Date(report.savedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="emptySavedReports">
            Save your current report, then come back after more games to compare
            how your openings are changing.
          </p>
        )}
      </div>
    </section>
  );
}


function OpponentPrepPreview({ data }) {
  const [opponentName, setOpponentName] = useState("");
  const [preparedOpponent, setPreparedOpponent] = useState("");

  if (!data) return null;

  const playerName =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    "you";

  const cleanOpponent = preparedOpponent.trim();

  const hasPrep = cleanOpponent.length > 0;

  const prepSeed = cleanOpponent
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  const opponentWhiteChoices = [
    "London System",
    "Italian Game",
    "Queen's Gambit",
    "Vienna Game",
    "Scotch Game",
  ];

  const opponentBlackChoices = [
    "Caro-Kann Defence",
    "Sicilian Defence",
    "French Defence",
    "Scandinavian Defence",
    "King's Indian setup",
  ];

  const whiteChoice =
    opponentWhiteChoices[prepSeed % opponentWhiteChoices.length];

  const blackChoice =
    opponentBlackChoices[(prepSeed + 2) % opponentBlackChoices.length];

  const weakness =
    prepSeed % 2 === 0
      ? "They may struggle when the position opens quickly and they have to calculate forcing lines."
      : "They may struggle when you avoid their main setup and make them solve unfamiliar middlegame plans.";

  const recommendation =
    prepSeed % 2 === 0
      ? "Prepare one direct attacking line and keep your development simple."
      : "Prepare a solid setup first, then look for pawn breaks once they commit their pieces.";

  const handlePrep = () => {
    if (!opponentName.trim()) return;
    setPreparedOpponent(opponentName.trim());
  };

  return (
    <section className="opponentPrepShell" id="opponent-prep">
      <div className="opponentPrepIntro">
        <span>Premium preview</span>
        <h2>Opponent prep mode</h2>
        <p>
          Enter an opponent username and Opening Fit can become a prep tool:
          what they are likely to play, what to expect, and what you should study
          before the game.
        </p>

        <div className="opponentPrepInputRow">
          <input
            value={opponentName}
            onChange={(event) => setOpponentName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handlePrep();
            }}
            placeholder="Enter opponent username"
            aria-label="Opponent username"
          />

          <button type="button" onClick={handlePrep}>
            Preview prep
          </button>
        </div>

        <small>
          Demo mode for now. Full opponent prep can later use public Chess.com
          and Lichess games.
        </small>
      </div>

      <div className="opponentPrepCards">
        <article className="opponentPrepCard">
          <span>Opponent</span>
          <strong>{hasPrep ? cleanOpponent : "Example opponent"}</strong>
          <p>
            {hasPrep
              ? `Prep snapshot generated for ${cleanOpponent}.`
              : "Type a username to preview how opponent preparation could look."}
          </p>
        </article>

        <article className="opponentPrepCard">
          <span>Likely as White</span>
          <strong>{hasPrep ? whiteChoice : "London System"}</strong>
          <p>
            Prepare a simple response that gets you into familiar middlegame
            structures.
          </p>
        </article>

        <article className="opponentPrepCard">
          <span>Likely as Black</span>
          <strong>{hasPrep ? blackChoice : "Caro-Kann Defence"}</strong>
          <p>
            Choose your opening plan before the game so you are not improvising
            on move two.
          </p>
        </article>

        <article className="opponentPrepCard highlight">
          <span>Prep recommendation</span>
          <strong>{hasPrep ? recommendation : "Use your strongest fit opening"}</strong>
          <p>
            {hasPrep
              ? weakness
              : `${playerName} should build around their strongest Opening Fit recommendation first.`}
          </p>
        </article>
      </div>
    </section>
  );
}


function OpeningFitFullReport({ data }) {
  if (!data) return null;

  const asArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") {
      return Object.entries(value).map(([name, stats]) => ({
        name,
        ...(stats && typeof stats === "object" ? stats : {}),
      }));
    }
    return [];
  };

  const getName = (item) =>
    item?.name ||
    item?.opening ||
    item?.opening_name ||
    item?.eco_name ||
    item?.family ||
    item?.label ||
    "Opening";

  const getGames = (item) =>
    Number(
      item?.games ??
        item?.total ??
        item?.count ??
        item?.played ??
        item?.sample ??
        0
    );

  const getWinRate = (item) => {
    const raw =
      item?.winRate ??
      item?.win_rate ??
      item?.score ??
      item?.scoreRate ??
      item?.score_rate ??
      item?.percentage;

    if (raw === undefined || raw === null || raw === "") return null;

    const number = Number(String(raw).replace("%", ""));
    if (Number.isNaN(number)) return null;

    return number <= 1 ? Math.round(number * 100) : Math.round(number);
  };

  const getColour = (item) =>
    String(
      item?.colour ||
        item?.color ||
        item?.side ||
        item?.as ||
        item?.player_color ||
        ""
    ).toLowerCase();

  const openingSources = [
    data.openings,
    data.openingStats,
    data.opening_stats,
    data.topOpenings,
    data.top_openings,
    data.openingWinRates,
    data.opening_win_rates,
    data.verdicts,
    data.openingVerdicts,
    data.opening_verdicts,
    data.keepImproveAvoid,
    data.keep_improve_avoid,
    data.openingTable,
    data.opening_table,
    data.recommendations,
    data.openingRecommendations,
    data.opening_recommendations,
  ];

  const openings = openingSources
    .flatMap(asArray)
    .map((item) => ({
      ...item,
      displayName: getName(item),
      games: getGames(item),
      winRate: getWinRate(item),
      colour: getColour(item),
    }))
    .filter((item, index, arr) => {
      const name = String(item.displayName || "").toLowerCase();

      if (
        !item.displayName ||
        item.displayName === "Opening" ||
        name.includes("unknown") ||
        name.includes("uncommon") ||
        item.games <= 0
      ) {
        return false;
      }

      return (
        arr.findIndex(
          (other) =>
            String(other.displayName).toLowerCase() ===
            String(item.displayName).toLowerCase()
        ) === index
      );
    });

  const ranked = [...openings].sort((a, b) => {
    const aRate = a.winRate ?? -1;
    const bRate = b.winRate ?? -1;
    if (bRate !== aRate) return bRate - aRate;
    return b.games - a.games;
  });

  const weakest = [...openings]
    .filter((item) => item.winRate !== null && item.games >= 2)
    .sort((a, b) => a.winRate - b.winRate);

  const bestOverall = ranked.find((item) => item.games >= 2) || ranked[0];
  const improveOpening = weakest[0] || ranked[1] || ranked[0];
  const avoidOpening = weakest[1] || weakest[0] || ranked[2] || ranked[0];

  const whiteOpenings = ranked.filter((item) => item.colour.includes("white"));
  const blackOpenings = ranked.filter((item) => item.colour.includes("black"));

  const bestWhite =
    whiteOpenings[0] ||
    ranked.find((item) =>
      /vienna|italian|london|queen|ruy|scotch|english|reti|gambit/i.test(
        item.displayName
      )
    ) ||
    ranked[0];

  const bestBlack =
    blackOpenings[0] ||
    ranked.find((item) =>
      /sicilian|caro|french|scandinavian|pirc|modern|dutch|king|nimzo|slav|grunfeld|defence|defense/i.test(
        item.displayName
      )
    ) ||
    ranked[1] ||
    ranked[0];

  const formatScore = (item) =>
    item?.winRate !== null && item?.winRate !== undefined
      ? `${item.winRate}%`
      : "Not enough data";

  const formatGames = (item) =>
    item?.games ? `${item.games} game${item.games === 1 ? "" : "s"}` : "Recent games";

  const styleLabel =
    data.styleLabel ||
    data.style_label ||
    data.primaryStyle ||
    data.primary_style ||
    data.styleProfile?.label ||
    data.style_profile?.label ||
    data.styleProfile?.primary_style ||
    data.style_profile?.primary_style ||
    "Practical opening player";

  const playerName =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    data.requested_username ||
    "your games";

  const explainFit = (opening, type) => {
    if (!opening) {
      return "Import more games to make this recommendation more accurate.";
    }

    if (type === "keep") {
      return `This is currently one of your strongest choices. The results suggest it fits the positions you are already handling well.`;
    }

    if (type === "improve") {
      return `This opening is worth studying because you already play it, but the results suggest there are recurring positions costing you points.`;
    }

    if (type === "avoid") {
      return `Pause this for now unless you specifically want to study it. Your current results suggest there are easier ways to build a reliable repertoire.`;
    }

    return "Use this as a practical guide for what to study next.";
  };

  const whiteRecommendation = bestWhite
    ? `Use ${bestWhite.displayName} as your main White focus for the next block of games.`
    : "Import more White games to unlock a clearer White repertoire recommendation.";

  const blackRecommendation = bestBlack
    ? `Use ${bestBlack.displayName} as your main Black focus and review your common early middlegame positions.`
    : "Import more Black games to unlock a clearer Black repertoire recommendation.";

  const studyOpening =
    improveOpening?.displayName ||
    bestOverall?.displayName ||
    "your most common opening";

  return (
    <section className="fullReportShell" id="opening-fit-report">
      <div className="fullReportHeader">
        <span>Report upgrade</span>
        <h2>What Opening Fit recommends next</h2>
        <p>
          This turns {playerName}’s recent games into a practical opening plan:
          what to keep, what to improve, and what to avoid.
        </p>
      </div>

      <div className="adviceGrid" id="keep-improve-avoid">
        <article className="adviceCard keep">
          <div className="adviceTopline">
            <span>Keep</span>
            <small>{formatScore(bestOverall)}</small>
          </div>
          <h3>{bestOverall?.displayName || "Keep building your main repertoire"}</h3>
          <p>{explainFit(bestOverall, "keep")}</p>
          <div className="adviceMeta">{formatGames(bestOverall)} reviewed</div>
        </article>

        <article className="adviceCard improve">
          <div className="adviceTopline">
            <span>Improve</span>
            <small>{formatScore(improveOpening)}</small>
          </div>
          <h3>{improveOpening?.displayName || "Review your common losses"}</h3>
          <p>{explainFit(improveOpening, "improve")}</p>
          <div className="adviceMeta">{formatGames(improveOpening)} reviewed</div>
        </article>

        <article className="adviceCard avoid">
          <div className="adviceTopline">
            <span>Avoid for now</span>
            <small>{formatScore(avoidOpening)}</small>
          </div>
          <h3>{avoidOpening?.displayName || "Low-sample experiments"}</h3>
          <p>{explainFit(avoidOpening, "avoid")}</p>
          <div className="adviceMeta">{formatGames(avoidOpening)} reviewed</div>
        </article>
      </div>

      <div className="reportTwoColumn">
        <article className="repertoireBuilder" id="opening-suggestions">
          <div className="sectionLabel">Repertoire builder</div>
          <h2>Your suggested opening setup</h2>

          <div className="repertoireRows">
            <div className="repertoireRow">
              <span>As White</span>
              <strong>{bestWhite?.displayName || "Needs more White games"}</strong>
              <p>{whiteRecommendation}</p>
            </div>

            <div className="repertoireRow">
              <span>As Black</span>
              <strong>{bestBlack?.displayName || "Needs more Black games"}</strong>
              <p>{blackRecommendation}</p>
            </div>

            <div className="repertoireRow">
              <span>Style fit</span>
              <strong>{styleLabel}</strong>
              <p>
                Your study plan should focus on openings that repeatedly give you
                positions you understand, not random openings with one lucky win.
              </p>
            </div>
          </div>
        </article>

        <article className="studyPlanCard">
          <div className="sectionLabel">Study plan</div>
          <h2>Your next 7 days</h2>

          <ol className="studySteps">
            <li>
              <strong>Day 1:</strong> Replay your best recent game in{" "}
              {bestOverall?.displayName || "your strongest opening"}.
            </li>
            <li>
              <strong>Day 2:</strong> Review one loss in {studyOpening} and find
              the first move where the position became uncomfortable.
            </li>
            <li>
              <strong>Day 3:</strong> Pick one simple setup and avoid switching
              openings for a few games.
            </li>
            <li>
              <strong>Day 4–7:</strong> Play a focused block using only your
              recommended White and Black choices.
            </li>
          </ol>
        </article>
      </div>

      <div className="premiumRoadmapStrip">
        <div>
          <span>Coming next</span>
          <h2>Premium-style features being built</h2>
          <p>
            Saved report history, PDF exports, opponent prep, deeper opening
            explanations, and progress tracking.
          </p>
        </div>

        
        {data ? <PremiumDashboard data={data} /> : null}

<div className="roadmapPills">
          <span>PDF export</span>
          <span>Opponent prep</span>
          <span>Saved history</span>
          <span>Progress tracking</span>
        </div>
      </div>
    </section>
  );
}


function OpeningFitReportHero({ data,
  onViewChange,}) {
  if (!data) return null;

  const asArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") {
      return Object.entries(value).map(([name, stats]) => ({
        name,
        ...(stats && typeof stats === "object" ? stats : {}),
      }));
    }
    return [];
  };

  const getName = (item) =>
    item?.name ||
    item?.opening ||
    item?.opening_name ||
    item?.eco_name ||
    item?.family ||
    "Opening";

  const getGames = (item) =>
    Number(
      item?.games ??
        item?.total ??
        item?.count ??
        item?.played ??
        item?.sample ??
        0
    );

  const getWinRate = (item) => {
    const raw =
      item?.winRate ??
      item?.win_rate ??
      item?.score ??
      item?.scoreRate ??
      item?.score_rate ??
      item?.percentage;

    if (raw === undefined || raw === null || raw === "") return null;

    const number = Number(String(raw).replace("%", ""));
    if (Number.isNaN(number)) return null;

    return number <= 1 ? Math.round(number * 100) : Math.round(number);
  };

  const openingSources = [
    data.openings,
    data.openingStats,
    data.opening_stats,
    data.topOpenings,
    data.top_openings,
    data.openingWinRates,
    data.opening_win_rates,
    data.verdicts,
    data.openingVerdicts,
    data.opening_verdicts,
    data.keepImproveAvoid,
    data.keep_improve_avoid,
    data.openingTable,
    data.opening_table,
  ];

  const openings = openingSources
    .flatMap(asArray)
    .map((item) => ({
      ...item,
      displayName: getName(item),
      games: getGames(item),
      winRate: getWinRate(item),
    }))
    .filter((item) => {
      const name = String(item.displayName || "").toLowerCase();
      return (
        item.displayName &&
        item.displayName !== "Opening" &&
        !name.includes("unknown") &&
        !name.includes("uncommon") &&
        item.games > 0
      );
    });

  const ranked = [...openings].sort((a, b) => {
    const aRate = a.winRate ?? -1;
    const bRate = b.winRate ?? -1;

    if (bRate !== aRate) return bRate - aRate;
    return b.games - a.games;
  });

  const bestOpening = ranked.find((item) => item.games >= 2) || ranked[0];

  const weakOpening =
    [...openings]
      .filter((item) => item.games >= 2 && item.winRate !== null)
      .sort((a, b) => a.winRate - b.winRate)[0] || openings[1];

  const playerName =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    data.requested_username ||
    "your games";

  const gamesImported =
    data.gamesImported ||
    data.games_imported ||
    data.totalGames ||
    data.total_games ||
    data.gameCount ||
    data.game_count ||
    openings.reduce((sum, item) => sum + item.games, 0);

  const styleSummary =
    data.styleSummary ||
    data.style_summary ||
    data.summary ||
    data.styleProfile?.summary ||
    data.style_profile?.summary ||
    data.profile?.summary ||
    "Opening Fit has reviewed your recent games and built a practical opening snapshot from your results.";

  const styleLabel =
    data.styleLabel ||
    data.style_label ||
    data.primaryStyle ||
    data.primary_style ||
    data.styleProfile?.label ||
    data.style_profile?.label ||
    data.styleProfile?.primary_style ||
    data.style_profile?.primary_style ||
    "Practical repertoire";

  const bestName = bestOpening?.displayName || "Not enough data yet";
  const bestRate =
    bestOpening?.winRate !== null && bestOpening?.winRate !== undefined
      ? `${bestOpening.winRate}%`
      : "—";

  const weakName = weakOpening?.displayName || "Keep importing games";
  const weakRate =
    weakOpening?.winRate !== null && weakOpening?.winRate !== undefined
      ? `${weakOpening.winRate}%`
      : "—";

  const recommendation =
    bestOpening?.displayName && bestOpening.displayName !== "Not enough data yet"
      ? `Build around ${bestOpening.displayName} positions and use weaker openings as your next study targets.`
      : "Import more games to unlock clearer opening recommendations.";


  const handleReportHeroAction = (view, targetId) => {
    if (typeof onViewChange === "function") {
      onViewChange(view);
    }

    window.setTimeout(() => {
      const target =
        document.getElementById(targetId) ||
        document.getElementById("app-results") ||
        document.getElementById("opening-diagnosis") ||
        document.getElementById("app-dashboard");

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 180);
  };

  return (
    <section className="reportHero">
      <div className="reportHeroMain">
        <span className="reportEyebrow">Your Opening Fit Report</span>

        <h1>
          {playerName}
          <span> — opening snapshot</span>
        </h1>

        <p>{styleSummary}</p>

        <div className="reportHeroActions">
          <button
            type="button"
            className="reportPrimaryLink"
            onClick={() => handleReportHeroAction("recommendations", "opening-suggestions")}
          >
            View recommendations
          </button>
          <button
            type="button"
            className="reportSecondaryLink"
            onClick={() => handleReportHeroAction("recommendations", "keep-improve-avoid")}
          >
            See verdicts
          </button>
        </div>
      </div>

      <div className="reportHeroCards">
        <article className="reportMetricCard best">
          <span>Best opening</span>
          <strong>{bestName}</strong>
          <small>
            {bestRate} score
            {bestOpening?.games ? ` · ${bestOpening.games} games` : ""}
          </small>
        </article>

        <article className="reportMetricCard improve">
          <span>Needs work</span>
          <strong>{weakName}</strong>
          <small>
            {weakRate} score
            {weakOpening?.games ? ` · ${weakOpening.games} games` : ""}
          </small>
        </article>

        <article className="reportMetricCard style">
          <span>Style read</span>
          <strong>{styleLabel}</strong>
          <small>{gamesImported || "Recent"} games reviewed</small>
        </article>

        <article className="reportMetricCard plan">
          <span>Next step</span>
          <strong>{recommendation}</strong>
          <small>Use this as your opening study focus.</small>
        </article>
      </div>
    </section>
  );
}


export default 
function App() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const resetPublicLandingScroll = () => {
      const hasSavedReport = Boolean(localStorage.getItem(STORAGE_KEY));
      const landingSeen = localStorage.getItem("openingfit_landing_seen") === "true";
      const hasHash = Boolean(window.location.hash && window.location.hash !== "#");

      if (!hasSavedReport && !landingSeen && !hasHash) {
        window.scrollTo(0, 0);

        const landing = document.getElementById("public-landing-top");
        if (landing) {
          landing.scrollIntoView({ block: "start", inline: "nearest" });
        }
      }
    };

    const resetSoon = () => {
      requestAnimationFrame(() => {
        resetPublicLandingScroll();
        setTimeout(resetPublicLandingScroll, 120);
      });
    };

    resetSoon();

    const handleVisibility = () => {
      if (!document.hidden) resetSoon();
    };

    window.addEventListener("pageshow", resetSoon);
    window.addEventListener("focus", resetSoon);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pageshow", resetSoon);
      window.removeEventListener("focus", resetSoon);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);


  const [isPremium, setIsPremium] = useState(() => {
    return localStorage.getItem(PREMIUM_KEY) === "true";
  });

  const unlockPremiumDemo = () => {
    localStorage.setItem(PREMIUM_KEY, "true");
    setIsPremium(true);
  };

  const resetPremiumDemo = () => {
    localStorage.removeItem(PREMIUM_KEY);
    setIsPremium(false);
  };

  const [theme, setTheme] = useState(() => localStorage.getItem("openingFit:theme") || "dark");
  const [username, setUsername] = useState("");
  const [accountUser, setAccountUser] = useState(null);
  const [platform, setPlatform] = useState("chesscom");
  const [importMonths, setImportMonths] = useState(3);
  const [apiStatus, setApiStatus] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const loadDemoReport = () => {
    setData(DEMO_REPORT);

    if (typeof setActiveView === "function") {
      setActiveView("overview");
    }

    if (typeof setShowLanding === "function") {
      setShowLanding(false);
    }

    setTimeout(() => {
      const el =
        document.getElementById("app-dashboard") ||
        document.getElementById("report") ||
        document.querySelector(".app-dashboard") ||
        document.querySelector(".report-shell");

      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleFounderPassClick = () => {
    window.dispatchEvent(
      new CustomEvent("openingfit:founder-pass-intent", {
        detail: {
          source: "trust-upgrade",
          plan: "founder_pass",
        },
      })
    );

    setTimeout(() => {
      const accountTarget =
        document.getElementById("account") ||
        document.getElementById("login") ||
        document.querySelector(".accountPanel") ||
        document.querySelector(".account-panel") ||
        document.querySelector("[data-section='account']");

      if (accountTarget) {
        accountTarget.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
  };


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
  const [activeView, setActiveView] = useState("overview");
  const reportNavigationRequestedRef = useRef(false);

  const scrollToReportTarget = (targetId = "app-results") => {
    const target =
      (targetId ? document.getElementById(targetId) : null) ||
      document.getElementById("app-results") ||
      document.querySelector("[data-report-nav-anchor='true']") ||
      document.querySelector(".appTabsCard") ||
      document.getElementById("opening-fit-report") ||
      document.getElementById("openingfit-report") ||
      document.getElementById("app-dashboard");

    if (!target) return;

    const offset = window.innerWidth <= 760 ? 84 : 104;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  };

  const navigateReportView = (view, targetId = "app-results") => {
    reportNavigationRequestedRef.current = true;
    setActiveView(view);

    window.setTimeout(() => scrollToReportTarget(targetId), 0);
    window.setTimeout(() => scrollToReportTarget(targetId), 140);
    window.setTimeout(() => scrollToReportTarget(targetId), 360);
  };

  useEffect(() => {
    if (!data || !reportNavigationRequestedRef.current) return;

    reportNavigationRequestedRef.current = false;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToReportTarget("app-results");
      });
    });
  }, [activeView, data]);
  const shouldShowLandingIntro = () => {
    const landingSeen = localStorage.getItem("openingfit_landing_seen") === "true";
    const hasAppHash = window.location.hash && window.location.hash !== "#";
    return !landingSeen && !hasAppHash;
  };

  const [showLanding, setShowLanding] = useState(shouldShowLandingIntro);

  // This is intentionally session-only.
  // First visit: public/example landing is visible behind the modal.
  // Close modal: public/example landing stays visible.
  // Refresh after close: localStorage prevents it coming back.
  const [showPublicLanding, setShowPublicLanding] = useState(shouldShowLandingIntro);

  const rememberLandingSeen = ({ keepPublicLanding = true } = {}) => {
    localStorage.setItem("openingfit_landing_seen", "true");
    setShowLanding(false);
    setShowPublicLanding(Boolean(keepPublicLanding));
  };



  useEffect(() => {
    localStorage.setItem("openingFit:theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme);
  }, [theme]);

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
        rememberLandingSeen();
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
      rememberLandingSeen({ keepPublicLanding: false });
      setActiveView("overview");

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
      setOpenSections(closedSections);
      rememberLandingSeen({ keepPublicLanding: false });
      setActiveView("overview");
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
    const levelProfile = getSmartPlayerLevelProfile(data);
    const levelAware = getSmartLevelAwareRecommendation(data, fitData);
    const summary = [];

    summary.push(levelAware.summary);
    summary.push(levelAware.primaryAction);

    const bestFit = fitData.bestOpening;
    const weakFit = fitData.weakestOpening;
    const top = filteredTopOpenings[0];

    if (bestFit) {
      summary.push(
        `${displayOpeningName(bestFit, data)} currently looks like your strongest Opening Fit. It scores ${bestFit.fitScore}/100 and matches the ${levelProfile.shortLabel.toLowerCase()} profile read.`
      );
    }

    if (top && levelProfile.level !== "elite") {
      summary.push(
        `Your most common opening is ${displayOpeningName(top, data)}. Because it appears often, improving this opening should give you the biggest overall return.`
      );
    }

    if (weakFit && getOpeningName(weakFit) !== getOpeningName(bestFit)) {
      summary.push(
        `${displayOpeningName(weakFit, data)} may need attention. It currently scores ${weakFit.fitScore}/100, so review the first few moves and common plans.`
      );
    }

    if (summary.length === 0) {
      summary.push(
        "Import more games to unlock a stronger personalised recommendation summary."
      );
    }

    return summary;
  }, [data, fitData, filteredTopOpenings]);

  const personalTrainingPlan = useMemo(() => {
    const plan = [];
    const levelProfile = getSmartPlayerLevelProfile(data);

    const bestFit = fitData.bestOpening;
    const weakFit = fitData.weakestOpening;

    if (levelProfile.level === "elite") {
      return [
        {
          title: "Run this as a repertoire audit",
          text: "This account is too strong for beginner-style coaching. Focus on trend changes, underperforming sidelines, colour splits, and opponent-prep value.",
          action: null,
          opening: null,
        },
        {
          title: "Check high-volume openings first",
          text: "Prioritise openings with enough games to show a real trend. Low-sample results should be treated as noise at elite level.",
          action: null,
          opening: null,
        },
        {
          title: "Look for preparation gaps",
          text: "The useful question is not “what simple opening should they play?” but “which parts of the existing repertoire are scoring below expectation?”",
          action: null,
          opening: null,
        },
      ];
    }

    if (levelProfile.level === "advanced") {
      plan.push({
        title: "Refine, do not replace",
        text: "This player likely already has opening knowledge. Focus on weak branches, repeated structures, and recent performance changes rather than generic opening swaps.",
        action: null,
        opening: null,
      });
    }

    if (levelProfile.level === "beginner" || levelProfile.level === "improver") {
      plan.push({
        title: "Simplify the repertoire first",
        text: "Use fewer openings for the next block of games. Pick one White setup and one simple Black setup so the same middlegame plans appear repeatedly.",
        action: null,
        opening: null,
      });
    }

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

  const isPublicLanding = !data && showPublicLanding;


  const hasReport = Boolean(
    data &&
      (
        data.username ||
        data.player ||
        data.games_analyzed ||
        data.gamesImported ||
        data.total_games ||
        data.top_openings?.length ||
        data.opening_stats?.length ||
        data.openings?.length
      )
  );


  useEffect(() => {
    if (hasReport) {
      setShowLanding(false);
      try {
        localStorage.setItem("openingFit:landingSeen", "true");
      } catch {
        // Ignore storage failures.
      }
    }
  }, [hasReport]);




  const jumpToReportView = (view) => {
    if (typeof setActiveView === "function") {
      setActiveView(view);
    }

    setTimeout(() => {
      const target =
        document.getElementById("app-results") ||
        document.getElementById("opening-diagnosis") ||
        document.getElementById("app-dashboard") ||
        document.getElementById("opening-health");

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
  };


  return (
    <>
      <div className={`page ${theme} ${isPublicLanding ? "publicLandingPage" : "appReportPage"}`} data-theme={theme}>
        {data ? (
          <>
            <OpeningFitUXCleanup
              data={data}
              username={username}
              onJump={jumpToSection}
              activeView={activeView}
              onViewChange={setActiveView}
            />

            <OpeningFitImportDoctor username={username} />

            <div id="account">
              <AccountPanel onUserChange={setAccountUser} />
            </div>

            <FounderPassLoginUpgrade accountUser={accountUser} />

            <CheckoutStatusNotice
              onRestoreAccess={() => {
                window.dispatchEvent(
                  new CustomEvent("openingfit:founder-pass-intent", {
                    detail: {
                      source: "checkout-success",
                      plan: "founder_pass",
                    },
                  })
                );
              }}
            />

            <AppActionRouter onViewChange={setActiveView} />
            <AccountRestoreSync
              user={accountUser}
              username={username}
              setUsername={setUsername}
              platform={platform}
              setPlatform={setPlatform}
              data={data}
              setData={setData}
              setIsPremium={setIsPremium}
            />

            <FloatingAppMenu
              data={data}
              onJump={jumpToSection}
              onPractice={startOpeningPractice}
              activeView={activeView}
              onViewChange={setActiveView}
            />

            <MobileBottomNav
              data={data}
              activeView={activeView}
              onViewChange={setActiveView}
            />
          </>
        ) : null}

        {loading ? <ImportLoadingOverlay platform={platform} /> : null}

        {data ? <OpeningFitTrustBar data={data} /> : null}

        {data ? (
          <OpeningFitTrustUpgrade
            onFounderPass={handleFounderPassClick}
            onDemo={loadDemoReport}
            onImport={() => {
              const el =
                document.getElementById("app-dashboard") ||
                document.getElementById("import") ||
                document.querySelector("input");

              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            onSample={() => {
              const el = document.getElementById("sample-report");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        ) : null}

        {showLanding && !hasReport ? (
          <LandingModal
            username={username}
            setUsername={setUsername}
            platform={platform}
            setPlatform={setPlatform}
            onImport={importGames}
            loading={loading}
            onClose={rememberLandingSeen}
            theme={theme}
            onThemeToggle={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
            onDemoReport={() => {
            const cleanDemo = normaliseData(SAMPLE_OPENING_FIT_REPORT);
            setData(cleanDemo);
            setUsername("DemoPlayer");
            setPlatform("chesscom");
            rememberLandingSeen({ keepPublicLanding: false });
            setActiveView("overview");

            setTimeout(() => {
              const el = document.getElementById("app-results");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
          }}
        />

        
) : null}


        {isPublicLanding ? (
          <div className="publicLandingTop" id="public-landing-top">
            <LandingSection onOpeningClick={startOpeningPractice} />
            <TrustFaq />
          </div>
        ) : null}

        <main className="container appShell" id="app-dashboard">
          <header className="hero heroCard">
            <div className="heroTop">
              <div className="heroTitleWrap">
                <p className="eyebrow">Opening Fit App</p>
                <h1>Analyse your chess openings</h1>
                <p className="subtext">
                  Your personal chess opening dashboard. Import your games, get a
                  clean Opening Fit report, then follow a focused study session
                  built from your real results.
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

            </div>

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
              <CleanReportHeader
                data={data}
                fitData={fitData}
                onViewChange={setActiveView}
              />

              <IntelligentCoachInsights data={data} />

              <OpeningClassificationNotice data={data} />

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
                onChange={setActiveView}
              />

              {activeView === "overview" ? (
                <>
                  <div id="report-view-overview" className="reportViewAnchor" aria-hidden="true" />
                  <PolishedOpeningFitReportHero
                    data={data}
                    username={username}
                    onNavigate={navigateReportView}
                    onJump={jumpToSection}
                  />

                  
                  <div
                    id="app-results"
                    className="reportNavScrollAnchor"
                    aria-hidden="true"
                  />
<div className="compactReportGrid">
                    <CoachSummaryCard data={data} onViewChange={setActiveView} />
                    <AppOpeningHealthScore data={data} onViewChange={setActiveView} />
                  </div>

                  <NextBestActions data={data} onViewChange={setActiveView} />

                  <div id="section-fit">
                    <OpeningFitSummaryCard
                      fitData={fitData}
                      onPractice={startOpeningPractice}
                    />
                  </div>

                  <OpeningDiagnosisPanel data={data} onViewChange={setActiveView} />

                  <EvidenceBackedOpeningDiagnosis
                    data={data}
                    onPractice={startOpeningPractice}
                  />

                  <ResultsCommandCenter
                    data={data}
                    onPractice={startOpeningPractice}
                  />

                  <div className="compactReportGrid">
                    <OpeningHealthScore data={data} />
                    <ProgressTracker data={data} />
                  </div>

                  <ShareReport data={data} />

                  {!isPremium ? (
                    <section className="card premiumCard compactPremiumCard">
                      <div className="premiumHeader">
                        <span className="premiumBadge">Premium Preview</span>
                        <h2>Unlock the full Opening Fit report</h2>
                      </div>

                      <p>
                        Free gives you a useful opening snapshot. Premium will focus on longer
                        imports, deeper stats, stronger training plans, and saved progress.
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

                  <RetentionHub data={data} />
                </>
              ) : null}

              {activeView === "recommendations" ? (
                <>
                  <div id="report-view-recommendations" className="reportViewAnchor" aria-hidden="true" />
                  <OpeningFitFullReport data={data} />

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
                          onViewChange={setActiveView}
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
                  <div id="report-view-data" className="reportViewAnchor" aria-hidden="true" />
                  <OpeningReportSummary
                    data={data}
                    username={username}
                    platform={platform}
                  />

                  <div id="training-plan"><RepertoireStudyPlan data={data} /></div>

                  <ReportHistoryVault data={data} onLoadReport={setData} />

          
        {data ? (
          <OpeningFitDiagnosisFirst
            data={data}
            isPremium={isPremium}
            onUpgrade={() => {
              const el = document.getElementById("premium");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onViewChange={setActiveView}
          />
        ) : null}



        {data ? (
          <ReportCommandBar
            data={data}
            activeView={activeView}
            onViewChange={setActiveView}
            isPremium={isPremium}
            onUpgrade={() => {
              const el = document.getElementById("premium");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        ) : null}

        {data && !isPremium ? (
          <FounderPassOutcomePanel
            data={data}
            isPremium={isPremium}
            onUpgrade={() => {
              const el = document.getElementById("premium");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onViewChange={setActiveView}
          />
        ) : null}


        <ReportExportAndHistory
                    data={data}
                    onLoadReport={(reportData) => {
                      setData(reportData);
                    }}
                  />

                  <OpeningFitFunctionalityHub
                    data={data}
                    username={username}
                    onLoadReport={setData}
                    onJump={jumpToSection}
                  />

                  <OpeningFitFunctionalTools
                    data={data}
                    username={username}
                    onLoadReport={setData}
                    onJump={jumpToSection}
                  />

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

        {data ? (
          <div className="productPolishFlow">
            <CoachVerdict data={data} />
            <RecommendedRepertoire data={data} />
            <PremiumPath />
          </div>
        ) : null}



              {activeView === "training" ? (
                <>
                  <div id="report-view-training" className="reportViewAnchor" aria-hidden="true" />
                  <NextStudySession
                    fitData={fitData}
                    recentGames={filteredRecentGames}
                    onPractice={startOpeningPractice}
                    onViewChange={setActiveView}
                  />

                  <OpeningFitStudyPlanner data={data} username={username} />

                  <PremiumCoachPlan
                    data={data}
                    isPremium={isPremium}
                    onUnlockDemo={unlockPremiumDemo}
                  />

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
                  <div id="report-view-games" className="reportViewAnchor" aria-hidden="true" />
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
                              <tr key={index}>
                                <td>
                                  <button
                                    className="tableOpeningBtn"
                                    type="button"
                                    onClick={() =>
                                      startOpeningPractice(opening.name)
                                    }
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
              {activeView === "overview" ? (
                <RetentionHub data={data} />
              ) : null}

              {activeView === "repertoire" ? (
                <>
                  <div id="report-view-repertoire" className="reportViewAnchor" aria-hidden="true" />
                  <MyRepertoire
                    data={data}
                    isPremium={isPremium}
                    onUnlockDemo={unlockPremiumDemo}
                  />

                  <InteractiveRepertoire
                    data={data}
                    onPractice={startOpeningPractice}
                  />

                  <PremiumPanel
                    data={data}
                    isPremium={isPremium}
                    onUnlockDemo={unlockPremiumDemo}
                    onResetDemo={resetPremiumDemo}
                  />

                  <PremiumTrustStrip />
                </>
              ) : null}

              {activeView !== "feedback" ? (
                <OpeningFitFinalCTA
                  data={data}
                  username={username}
                  onJump={jumpToSection}
                />
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

      <Analytics />
    </>
  );
}
