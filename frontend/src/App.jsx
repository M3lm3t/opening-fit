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
import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import "./App.css";
import OpeningReportSummary from "./components/OpeningReportSummary";
import RepertoireStudyPlan from "./components/RepertoireStudyPlan";
import PremiumDashboard from "./components/PremiumDashboard";
import ImportLoadingOverlay from "./components/ImportLoadingOverlay";
import AccountPanel from "./components/AccountPanel";
import GameReplayBoard from "./components/GameReplayBoard";
import OpeningPracticeLinesPanel from "./components/OpeningPracticeLinesPanel";
import PremiumPanel from "./components/PremiumPanel";
import ResultsCommandCenter from "./components/ResultsCommandCenter";
import OpeningHealthScore from "./components/OpeningHealthScore";
import ProgressTracker from "./components/ProgressTracker";
import ShareReport from "./components/ShareReport";
import PremiumCoachPlan from "./components/PremiumCoachPlan";
import MyRepertoire from "./components/MyRepertoire";
import PremiumTrustStrip from "./components/PremiumTrustStrip";
import LandingModal from "./components/LandingModal";
import ReportSnapshot from "./components/ReportSnapshot";
import OpeningCoachPlan from "./components/OpeningCoachPlan";
import OpeningProgressTracker from "./components/OpeningProgressTracker";
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
import { displayOpeningName, getPlayerLevelText, getSmartLevelAwareRecommendation, getSmartPlayerLevelProfile } from "./components/playerLevelLogic";
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
const OPENING_SAMPLE_PERCENT_KEY = "openingFit:openingSamplePercent";

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

const SITE_URL = "https://www.openingfit.com";

const HOME_SEO = {
  title: "Opening Fit | Chess Opening Analysis & Repertoire Builder",
  description:
    "Opening Fit analyses your Chess.com or Lichess games to find which openings fit your play style, what to keep, what to improve, and what to study next.",
  path: "/",
  h1: "Find the chess openings that fit how you actually play",
};

const SEO_LINKS = [
  ["Chess Opening Analysis", "/chess-opening-analysis"],
  ["Chess Repertoire Builder", "/chess-repertoire-builder"],
  ["Chess.com Opening Analysis", "/chesscom-opening-analysis"],
  ["Lichess Opening Analysis", "/lichess-opening-analysis"],
  ["Find Openings for Your Style", "/best-chess-openings-for-your-style"],
  ["FAQ", "/faq"],
];

const SEO_PAGES = {
  "/chess-opening-analysis": {
    title: "Chess Opening Analysis from Your Real Games | Opening Fit",
    description:
      "Analyse your real Chess.com or Lichess games to see which chess openings score best, where weak lines repeat, and what to study next.",
    h1: "Chess opening analysis based on your actual games",
    intro:
      "Opening Fit turns public online games into a practical opening report, so your repertoire decisions come from positions you actually reach.",
    sections: [
      ["Analyse your Chess.com or Lichess games", "Import public games and review the openings you play most often as White and Black."],
      ["See which openings score best", "Compare results, sample size, and fit so strong openings are easy to keep in your repertoire."],
      ["Find weak lines and repeat problems", "Spot openings where one recurring line is hurting results without treating the whole opening as bad."],
      ["Turn the report into a practical study plan", "Use the report to decide what to keep, what to repair, and what to study in short sessions."],
    ],
  },
  "/chess-repertoire-builder": {
    title: "Chess Repertoire Builder for Real Online Games | Opening Fit",
    description:
      "Build a chess repertoire around your own online games, using opening results, style fit, and repair targets.",
    h1: "Build a chess repertoire around how you actually play",
    intro:
      "Opening Fit helps you choose openings from your own evidence instead of copying random grandmaster repertoires.",
    sections: [
      ["Do not copy random grandmaster openings", "A good repertoire should fit your rating, style, memory, and typical middlegames."],
      ["Use your own results", "Start from the Chess.com or Lichess openings that already appear in your games."],
      ["Keep openings that suit you", "Protect reliable choices that score well and create positions you understand."],
      ["Repair openings with line-level weaknesses", "Improve can mean one variation needs attention, not that the whole opening is wrong for you."],
      ["Replace openings that create bad positions for you", "When an opening repeatedly gives you uncomfortable positions, the report can flag it for review."],
    ],
  },
  "/chesscom-opening-analysis": {
    title: "Chess.com Opening Analysis Tool | Opening Fit",
    description:
      "Import public Chess.com games and analyse your openings by colour, result, sample size, and study priority.",
    h1: "Analyse your Chess.com openings",
    intro:
      "Opening Fit reads public Chess.com games and turns your opening history into a compact repertoire report.",
    sections: [
      ["Import public Chess.com games", "Enter a username and choose the import window to analyse recent public games."],
      ["Find your best and worst openings", "See which openings are reliable, which need repair, and which may be risky right now."],
      ["See opening results by colour", "Separate White and Black patterns so repertoire choices stay practical."],
      ["Get a simple study plan", "Turn the findings into a focused plan instead of a long theory list."],
    ],
  },
  "/lichess-opening-analysis": {
    title: "Lichess Opening Analysis Tool | Opening Fit",
    description:
      "Import public Lichess games and analyse opening patterns, colour results, and practical repertoire choices.",
    h1: "Analyse your Lichess openings",
    intro:
      "Opening Fit uses your public Lichess games to show opening patterns and study priorities from real results.",
    sections: [
      ["Import public Lichess games", "Use a Lichess username to create an opening report from recent public games."],
      ["Find opening patterns", "Review common openings, recurring problems, and choices that match your style."],
      ["Compare White and Black results", "Understand where each side of your repertoire is strongest or most fragile."],
      ["Build a practical repertoire", "Keep useful openings, repair weak lines, and focus study time where it matters."],
    ],
  },
  "/best-chess-openings-for-your-style": {
    title: "Find the Best Chess Openings for Your Style | Opening Fit",
    description:
      "Find chess openings that fit your style using real Chess.com and Lichess games instead of a quiz.",
    h1: "Find chess openings that fit your style",
    intro:
      "Opening Fit looks at your real games to connect opening choices with the kinds of positions you handle well.",
    sections: [
      ["Tactical vs positional openings", "Some players score best in active positions; others do better with slower plans and structure."],
      ["Open vs closed positions", "Your games can reveal whether open centres, locked pawn chains, or flexible structures fit you best."],
      ["Aggressive vs solid repertoires", "A good repertoire can be ambitious or steady, as long as it matches your decisions at the board."],
      ["Real games instead of a quiz", "Opening Fit uses Chess.com and Lichess results rather than asking you to guess your style."],
    ],
  },
  "/about": {
    title: "About Opening Fit | Chess Opening Analysis",
    description:
      "Opening Fit is a chess opening analysis and repertoire builder for Chess.com and Lichess players.",
    h1: "About Opening Fit",
    intro:
      "Opening Fit helps chess players understand which openings fit their real online games, then turns that evidence into a compact report and study plan.",
    sections: [
      ["Built around real games", "The app analyses public Chess.com and Lichess games rather than generic opening lists."],
      ["Designed for practical study", "Reports focus on what to keep, what to improve, and what to study next."],
      ["Free report available", "You can import games without logging in and view a free opening report."],
    ],
  },
  "/faq": {
    title: "Opening Fit FAQ | Chess Opening Analysis Questions",
    description:
      "Common questions about Opening Fit, Chess.com opening analysis, Lichess opening analysis, and chess repertoire reports.",
    h1: "Opening Fit FAQ",
    intro:
      "Quick answers about using Opening Fit for chess opening analysis and repertoire building.",
    faqs: [
      ["Is OpeningFit free?", "A free report is available. Paid access unlocks deeper analysis and longer-term study features."],
      ["Does it work with Chess.com?", "Yes. Opening Fit can import public Chess.com games by username."],
      ["Does it work with Lichess?", "Yes. Opening Fit can import public Lichess games by username."],
      ["Do I need to log in?", "No login is required for the basic import flow because the app uses public games."],
      ["What does Keep / Improve / Avoid mean?", "Keep means the opening is working well, Improve means a line or pattern needs repair, and Avoid means the opening may be a poor practical fit for now."],
      ["Is this a chess engine?", "No. Opening Fit is not an engine. It analyses opening results, patterns, and study priorities from your games."],
      ["How is this different from Chessable or an opening trainer?", "Opening Fit helps decide what to study from your own games; opening trainers usually help memorise chosen lines."],
    ],
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

const clampOpeningSamplePercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(20, Math.max(0, Math.round(parsed)));
};

const getOpeningSampleMinimumGames = (totalGames, samplePercent) => {
  const cleanPercent = clampOpeningSamplePercent(samplePercent);
  const cleanTotal = Math.max(0, Number(totalGames) || 0);

  if (!cleanPercent || !cleanTotal) return 1;

  return Math.max(2, Math.ceil((cleanTotal * cleanPercent) / 100));
};

const filterOpeningsBySamplePercent = (items, totalGames, samplePercent) => {
  if (!Array.isArray(items)) return [];

  const minimumGames = getOpeningSampleMinimumGames(totalGames, samplePercent);

  if (minimumGames <= 1) return items;

  return items.filter((item) => {
    if (typeof item === "string") return true;
    return getOpeningGames(item) >= minimumGames;
  });
};

const premiumFeatures = [
  "Line-level opening diagnosis",
  "12-month trend view",
  "Saved report history",
  "Confidence-aware opening verdicts",
  "Full 7-day study plan",
  "Deeper move-order explanations",
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

function getOpeningLosses(opening) {
  if (!opening || typeof opening === "string") return 0;
  return safeNumber(opening?.losses ?? opening?.l ?? opening?.lost);
}

function getOpeningWins(opening) {
  if (!opening || typeof opening === "string") return 0;
  return safeNumber(opening?.wins ?? opening?.w);
}

function getOpeningDraws(opening) {
  if (!opening || typeof opening === "string") return 0;
  return safeNumber(opening?.draws ?? opening?.d);
}

function getOpeningSide(opening) {
  if (!opening || typeof opening === "string") return "";
  return opening.side || opening.colour || opening.color || "";
}

const SAFE_CONTEXT_FALLBACK_COPY =
  "We found this opening pattern, but not enough colour/context data to recommend it confidently.";
const PUBLIC_ACCOUNT_CAUTION_COPY =
  "This appears to be a high-level or public account. OpeningFit is analysing recent online results only, not judging the player’s actual opening knowledge.";

const BLACK_OPENING_NAME_PATTERNS = [
  "defence",
  "defense",
  "sicilian",
  "french",
  "caro-kann",
  "scandinavian",
  "pirc",
  "modern defence",
  "modern defense",
  "alekhine",
  "dutch",
  "nimzo",
  "queen's indian",
  "king's indian",
  "grunfeld",
  "grünfeld",
  "slav",
  "benoni",
  "benko",
  "englund",
];

const WHITE_OPENING_NAME_PATTERNS = [
  "london",
  "vienna",
  "italian",
  "ruy lopez",
  "spanish",
  "scotch",
  "king's gambit",
  "queen's gambit",
  "english opening",
  "réti",
  "reti",
  "colle",
  "stonewall attack",
  "trompowsky",
  "wayward queen",
  "danish gambit",
  "king's pawn game",
  "queen pawn game",
  "queen's pawn game",
  "center game",
  "centre game",
  "zukertort opening",
  "polish opening",
  "bird's opening",
];

function openingNameColourHint(name = "") {
  const lower = String(name).toLowerCase();

  if (BLACK_OPENING_NAME_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return "black";
  }

  if (WHITE_OPENING_NAME_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return "white";
  }

  return "unknown";
}

function contextLabel(context = "") {
  return (
    {
      played_as_white: "played as White",
      black_vs_e4: "played as Black vs 1.e4",
      black_vs_d4_other: "played as Black vs 1.d4 / 1.c4 / 1.Nf3",
      unknown_mixed: "unknown / mixed",
    }[context] || "unknown / mixed"
  );
}

function itemContext(item, fallback = "unknown_mixed") {
  const raw =
    item?.context ||
    item?.repertoireContext ||
    item?.repertoire_context ||
    item?.category ||
    "";
  const context = String(raw).trim();

  if (
    ["played_as_white", "black_vs_e4", "black_vs_d4_other", "unknown_mixed"].includes(
      context
    )
  ) {
    return context;
  }

  const side = String(getOpeningSide(item)).toLowerCase();

  if (side.includes("white")) return "played_as_white";
  if (side.includes("black")) return fallback === "played_as_white" ? "unknown_mixed" : fallback;

  return fallback;
}

function contextIsCompatible(name, context) {
  const hint = openingNameColourHint(name);

  if (context === "played_as_white") return hint !== "black";
  if (context === "black_vs_e4" || context === "black_vs_d4_other") return hint !== "white";

  return false;
}

function normalizeRecommendationItem(item, fallbackContext = "unknown_mixed") {
  const source = typeof item === "string" ? { name: item } : item || {};
  const name = getOpeningName(source);
  const context = itemContext(source, fallbackContext);
  const compatible = contextIsCompatible(name, context);
  const safeContext = compatible ? context : "unknown_mixed";

  return {
    ...source,
    name,
    context: safeContext,
    contextLabel: contextLabel(safeContext),
    recommendationCopy:
      safeContext === "unknown_mixed"
        ? source.recommendationCopy || SAFE_CONTEXT_FALLBACK_COPY
        : source.recommendationCopy || "",
  };
}

function normalizeRecommendationSection(items, fallbackContext) {
  const contextFallback =
    {
      white_repertoire: "played_as_white",
      black_vs_e4: "black_vs_e4",
      black_vs_d4_other: "black_vs_d4_other",
      experimental_rare: "unknown_mixed",
      too_little_data: "unknown_mixed",
    }[fallbackContext] || fallbackContext;

  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeRecommendationItem(item, contextFallback))
    .filter((item) => !isUnknownOpeningName(item.name));
}

function getColourAwareRecommendationSections(data) {
  const recommendations =
    data?.opening_recommendations ||
    data?.openingRecommendations ||
    data?.recommendedOpenings ||
    {};

  const fromBackend = Array.isArray(recommendations.sections)
    ? recommendations.sections.map((section) => ({
        key: section.key,
        title: section.title,
        items: normalizeRecommendationSection(section.items, section.key),
      }))
    : null;

  if (fromBackend) return fromBackend;

  const white = normalizeRecommendationSection(
    recommendations.white_repertoire ||
      recommendations.whiteDetailed ||
      recommendations.white ||
      data?.preferred_white ||
      [],
    "played_as_white"
  );
  const blackVsE4 = normalizeRecommendationSection(
    recommendations.black_vs_e4 ||
      recommendations.blackVsE4Detailed ||
      recommendations.blackVsE4 ||
      recommendations.blackDetailed ||
      recommendations.black ||
      data?.preferred_black ||
      [],
    "black_vs_e4"
  );
  const blackVsD4 = normalizeRecommendationSection(
    recommendations.black_vs_d4_other ||
      recommendations.blackVsD4OtherDetailed ||
      recommendations.blackVsD4Other ||
      [],
    "black_vs_d4_other"
  );
  const experimental = normalizeRecommendationSection(
    recommendations.experimental_rare || recommendations.experimentalRare || [],
    "unknown_mixed"
  );
  const tooLittle = normalizeRecommendationSection(
    recommendations.too_little_data || recommendations.tooLittleData || [],
    "unknown_mixed"
  );

  return [
    { key: "white_repertoire", title: "White repertoire", items: white },
    { key: "black_vs_e4", title: "Black vs 1.e4", items: blackVsE4 },
    {
      key: "black_vs_d4_other",
      title: "Black vs 1.d4 / 1.c4 / 1.Nf3",
      items: blackVsD4,
    },
    { key: "experimental_rare", title: "Experimental / rare openings", items: experimental },
    { key: "too_little_data", title: "Too little data", items: tooLittle },
  ];
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
      "Your imported games show mixed opening results. Start with the repeated openings that have the largest sample and highest score.",
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

function getProfileRating(data) {
  const directValues = [
    data?.rating,
    data?.currentRating,
    data?.current_rating,
    data?.chesscomRating,
    data?.chesscom_rating,
    data?.lichessRating,
    data?.lichess_rating,
    data?.rapidRating,
    data?.rapid_rating,
    data?.blitzRating,
    data?.blitz_rating,
    data?.bulletRating,
    data?.bullet_rating,
    data?.player_level?.rating,
    data?.playerLevel?.rating,
  ];

  const cleanRatings = directValues
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 100 && value < 3500);

  if (cleanRatings.length) return Math.max(...cleanRatings);

  const recentGames = Array.isArray(data?.recent_games)
    ? data.recent_games
    : Array.isArray(data?.recentGames)
    ? data.recentGames
    : [];

  const gameRatings = recentGames
    .flatMap((game) => [
      game?.player_rating,
      game?.playerRating,
      game?.rating,
      game?.white_rating,
      game?.whiteRating,
      game?.black_rating,
      game?.blackRating,
    ])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 100 && value < 3500);

  if (!gameRatings.length) return 0;

  gameRatings.sort((a, b) => a - b);
  return gameRatings[Math.floor(gameRatings.length / 2)];
}

function getPlayerTier(data) {
  const rating = getProfileRating(data);
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

  if (
    rating >= 2500 ||
    titledPlayer ||
    level.includes("elite") ||
    level.includes("master") ||
    level.includes("gm") ||
    level.includes("grandmaster") ||
    level.includes("international master")
  ) {
    return "elite";
  }

  if (
    rating >= 2200 ||
    level.includes("expert") ||
    level.includes("candidate master") ||
    level.includes("national master")
  ) {
    return "strong";
  }

  if (
    rating >= 1600 ||
    level.includes("advanced") ||
    level.includes("club") ||
    level.includes("strong")
  ) {
    return "club";
  }

  return "developing";
}

function getReportMode(data) {
  const direct = data?.reportMode || data?.report_mode;

  if (
    ["normal_user", "high_rated_user", "public_account_possible"].includes(direct)
  ) {
    return direct;
  }

  const tier = getPlayerTier(data);
  const totalGames = safeNumber(data?.total_games ?? data?.totalGames ?? data?.gamesImported);

  if (tier === "elite" || totalGames >= 250) return "public_account_possible";
  if (tier === "strong") return "high_rated_user";

  return "normal_user";
}

function isPublicReportMode(data) {
  return getReportMode(data) !== "normal_user";
}

function publicAwareVerdict(label, data, games = 0) {
  if (!isPublicReportMode(data)) return label;

  if (games > 0 && games < 8) return "Not enough context to judge";

  const lower = String(label || "").toLowerCase();

  if (lower.includes("main") || lower.includes("reliable") || lower.includes("keep")) {
    return "Recent strength";
  }

  if (lower.includes("avoid") || lower.includes("needs review")) {
    return "Recent underperformer";
  }

  if (lower.includes("promising") || lower.includes("improve") || lower.includes("unstable")) {
    return "Lower-scoring sample";
  }

  if (lower.includes("experimental") || lower.includes("not enough")) {
    return "Not enough context to judge";
  }

  return label || "Recent sample";
}

function publicAccountCaution(data) {
  return data?.publicAccountCaution || data?.public_account_caution || PUBLIC_ACCOUNT_CAUTION_COPY;
}

function getRecommendationConfidence(opening) {
  const games = getOpeningGames(opening);

  if (games >= 20) return "High confidence";
  if (games >= 8) return "Medium confidence";
  if (games >= 3) return "Low confidence";
  return "Too little data";
}

function getDataFirstVerdict(opening, data) {
  const games = getOpeningGames(opening);
  const winRate = getWinRate(opening);

  if (games < 3) return "Too little data";
  if (isPublicReportMode(data)) return publicAwareVerdict(opening?.verdict || opening?.fitVerdict, data, games);
  if (winRate >= 55) return "Keep";
  if (winRate >= 42) return "Improve";
  return "Review";
}

function getEvidenceLine(opening, data) {
  const games = getOpeningGames(opening);
  const winRate = getWinRate(opening);
  const losses = getOpeningLosses(opening);
  const wins = getOpeningWins(opening);
  const draws = getOpeningDraws(opening);
  const context = opening?.contextLabel || contextLabel(itemContext(opening));
  const resultParts = [];

  if (wins || draws || losses) {
    resultParts.push(`${wins}W-${draws}D-${losses}L`);
  }

  if (!games) {
    return `Evidence: ${context}; no stable sample yet.`;
  }

  const sampleText = `${games} game${games === 1 ? "" : "s"}`;
  const scoreText = Number.isFinite(winRate) ? `${winRate}% score` : "score unavailable";
  const resultText = resultParts.length ? `, ${resultParts.join("")}` : "";

  if (isPublicReportMode(data)) {
    return `Evidence: ${sampleText} in this import as ${context}, ${scoreText}${resultText}.`;
  }

  return `Evidence: ${sampleText} as ${context}, ${scoreText}${resultText}.`;
}

function getNextActionLine(opening, data, sectionKey = "") {
  const name = getOpeningName(opening);
  const games = getOpeningGames(opening);
  const context = opening?.contextLabel || contextLabel(itemContext(opening));
  const publicMode = isPublicReportMode(data);

  if (games < 3 || sectionKey === "too_little_data" || opening?.context === "unknown_mixed") {
    return `Next action: collect more games before changing anything in ${name}.`;
  }

  if (publicMode) {
    return `Next action: compare ${name} by time control, opponent pool, and game context.`;
  }

  if (sectionKey === "white_repertoire") {
    return `Next action: review your last 3 ${name} games as White and write one move-10 plan.`;
  }

  if (sectionKey === "black_vs_e4") {
    return `Next action: review your last 3 ${name} games vs 1.e4 and fix one repeated branch.`;
  }

  if (sectionKey === "black_vs_d4_other") {
    return `Next action: review your last 3 ${name} games vs 1.d4, 1.c4, or 1.Nf3.`;
  }

  return `Next action: review your last 3 ${name} games in ${context}.`;
}

function getPlayerBaselineScore(data) {
  const value = [
    data?.score,
    data?.scoreRate,
    data?.score_rate,
    data?.winRate,
    data?.win_rate,
    data?.overallScore,
    data?.overall_score,
    data?.summary?.score,
    data?.summary?.winRate,
  ]
    .map((item) => safeNumber(item, NaN))
    .find((item) => Number.isFinite(item) && item > 0);

  if (!value) return 50;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function getOpeningSampleTier(games) {
  const count = Number(games || 0);
  if (count >= 20) return "large";
  if (count >= 8) return "medium";
  if (count >= 3) return "small";
  return "tiny";
}

function getAverageOppositionRating(opening, data) {
  const direct = Number(
    opening?.averageOpponentRating ??
      opening?.average_opponent_rating ??
      opening?.avgOpponentRating ??
      opening?.avg_opponent_rating ??
      opening?.opponentRating ??
      opening?.opponent_rating ??
      data?.averageOpponentRating ??
      data?.average_opponent_rating ??
      0
  );

  return Number.isFinite(direct) ? direct : 0;
}

function getSmartOpeningVerdict(opening, data, index = 0) {
  const games = getOpeningGames(opening);
  const winRate = getWinRate(opening);
  const tier = getPlayerTier(data);
  const publicMode = isPublicReportMode(data);
  const sampleTier = getOpeningSampleTier(games);
  const isMainWeapon = index <= 2 && games >= 8;
  const largeSample = sampleTier === "large";
  const frequentlyPlayed = isMainWeapon || games >= 20;
  const baseline = getPlayerBaselineScore(data);
  const highRatedPlayer = ["club", "strong", "elite"].includes(tier);
  const belowBaseline = winRate < baseline;
  const slightlyBelowBaseline = belowBaseline && baseline - winRate <= 8;
  const rating = getProfileRating(data);
  const opposition = getAverageOppositionRating(opening, data);
  const strongOpposition =
    rating && opposition ? opposition >= Math.max(1800, rating - 100) : false;
  const highRatedRepertoireMessage =
    "This looks like a serious part of your repertoire. Recent results are below your usual baseline, but this is more likely a form trend than a reason to abandon the opening.";

  if (isUnknownOpeningName(getOpeningName(opening))) {
    return {
      label: publicMode ? "Not enough context to judge" : "Needs review",
      category: "review",
      tone: "neutral",
      severity: "neutral",
      message:
        publicMode
          ? "This opening was not clearly classified, so OpeningFit is not making a hard judgement from this sample."
          : "This opening was not clearly classified. Review the move order before treating it as a repertoire problem.",
    };
  }

  if (sampleTier === "tiny") {
    return {
      label: publicMode ? "Not enough context to judge" : "Experimental / not enough data",
      category: "neutral",
      tone: "neutral",
      severity: "neutral",
      message:
        publicMode
          ? "This is too small a recent online sample for a hard verdict. It may be an experiment, a content game, or a one-off opponent-specific choice."
          : "There is not enough data here to make a confident recommendation yet. Treat this as a note, not a verdict.",
    };
  }

  if (sampleTier === "small") {
    return {
      label: publicMode ? "Not enough context to judge" : "Low-confidence sample",
      category: "neutral",
      tone: "neutral",
      severity: "neutral",
      message:
        publicMode
          ? "This is a small, noisy sample from recent online games. OpeningFit is tracking it without judging the player's opening knowledge."
          : "This opening has appeared a few times, but the sample is still too small for confident advice. Keep tracking it before changing the repertoire.",
    };
  }

  if (highRatedPlayer && frequentlyPlayed && belowBaseline && winRate >= 35) {
    return {
      label: isMainWeapon ? "Main weapon" : "Reliable choice",
      category: slightlyBelowBaseline ? "keep" : "review",
      tone: slightlyBelowBaseline ? "positive" : "warning",
      severity: slightlyBelowBaseline ? "positive" : "warning",
      message: highRatedRepertoireMessage,
    };
  }

  if (tier === "elite") {
    if (isMainWeapon && winRate >= 45) {
      return {
        label: "Main weapon",
        category: "keep",
        tone: "positive",
        severity: "positive",
        message:
          belowBaseline
            ? highRatedRepertoireMessage
            : "This looks like a regular part of the repertoire. Recent results are worth reviewing, but the data points to targeted fine-tuning rather than replacing the opening.",
      };
    }

    if (isMainWeapon) {
      return {
        label: "Lower-scoring sample",
        category: "review",
        tone: "warning",
        severity: "warning",
        message:
          highRatedRepertoireMessage,
      };
    }

    if (largeSample && games >= 20 && winRate < 25) {
      return {
        label: "Recent underperformer",
        category: "review",
        tone: "warning",
        severity: "warning",
        message:
          "This is a large sample with unusually poor recent results. Even then, for an elite player this should be treated as a performance check before calling the opening a bad choice.",
      };
    }

    if (winRate < 45) {
      return {
        label: "Lower-scoring sample",
        category: "review",
        tone: "warning",
        severity: "warning",
        message:
          "Recent results in this opening are below the player's usual level. For a top player, frame this as a performance review, not beginner improvement advice.",
      };
    }

    return {
      label: "Reliable choice",
      category: "keep",
      tone: "positive",
      severity: "positive",
      message:
        "This opening is performing well enough to remain part of the repertoire. Look for refinements rather than replacement ideas.",
    };
  }

  if (tier === "strong") {
    if (isMainWeapon && winRate >= 45) {
      return {
        label: "Main weapon",
        category: "keep",
        tone: "positive",
        severity: "positive",
        message:
          belowBaseline
            ? highRatedRepertoireMessage
            : "This is used often enough to look like a trusted part of the repertoire. Review recent losses for patterns, but do not treat this as an opening to abandon.",
      };
    }

    if (isMainWeapon && winRate >= 35) {
      return {
        label: "Promising but unstable",
        category: "review",
        tone: "warning",
        severity: "warning",
        message:
          "This is probably still a useful part of the repertoire. Fine-tune the specific variations or middlegame structures where the recent results are slipping.",
      };
    }

    if (winRate < 40) {
      return {
        label: publicMode ? "Recent underperformer" : "Needs review",
        category: "review",
        tone: "warning",
        severity: "warning",
        message: strongOpposition
          ? "Recent results are under pressure against strong opposition. Review recurring loss patterns before deciding whether the opening itself is the issue."
          : "Recent results suggest this line is worth reviewing. The issue may be a branch or structure, not the opening choice itself.",
      };
    }

    return {
      label: "Reliable choice",
      category: "keep",
      tone: "positive",
      severity: "positive",
      message:
        "This opening is performing well enough to stay in the repertoire. Use the games to refine plans rather than replace the opening.",
    };
  }

  if (isMainWeapon && games >= 8 && winRate >= 42) {
    return {
      label: "Main weapon",
      category: "keep",
      tone: "positive",
      severity: "positive",
      message:
        "This is one of the player's main openings and the results are playable. Keep it, but review the recurring positions that decide games.",
    };
  }

  if (winRate >= 55) {
    return {
      label: "Reliable choice",
      category: "keep",
      tone: "positive",
      severity: "positive",
      message:
        "This opening is working well and should stay in the repertoire.",
    };
  }

  if (winRate >= 45) {
    return {
      label: "Promising but unstable",
      category: "improve",
      tone: "warning",
      severity: "warning",
      message:
        "This does not mean the whole opening is bad. It means one branch, move order, or opening-to-middlegame transition is likely costing points.",
    };
  }

  if (isMainWeapon && winRate >= 35) {
    return {
      label: "Promising but unstable",
      category: "review",
      tone: "warning",
      severity: "warning",
      message:
        "Because this is a main opening, do not abandon it too quickly. Review the specific line or structure where the losses start to repeat.",
    };
  }

  return {
    label: publicMode ? "Recent underperformer" : "Needs review",
    category: "avoid",
    tone: "danger",
    severity: "danger",
    message:
      publicMode
        ? "This is a lower-scoring recent online sample. Treat it as trend evidence only, not a judgement of the player's opening knowledge."
        : "The data points to a recurring problem inside this opening. Review the damaging line first before deciding whether the whole opening should leave the repertoire.",
  };
}

function getOpeningExplanation(opening, score, playerStyle, data, index = 0) {
  const name = getOpeningName(opening);
  const smartVerdict = getSmartOpeningVerdict(opening, data, index);

  if (isUnknownOpeningName(name)) {
    return smartVerdict.message;
  }

  if (smartVerdict.message) {
    return smartVerdict.message;
  }

  if (smartVerdict.category === "keep") {
    return `This looks like a strong fit. You score well with it, it appears in your games enough to be meaningful, and it suits your ${playerStyle.title.toLowerCase()} profile.`;
  }

  return smartVerdict.message;
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
  const volumeRank = new Map(
    [...cleanOpenings]
      .sort((a, b) => getOpeningGames(b) - getOpeningGames(a))
      .map((opening, index) => [getOpeningName(opening).toLowerCase(), index])
  );

  const scoredOpenings = cleanOpenings
    .map((opening) => {
      const score = calculateOpeningFitScore(opening, playerStyle);
      const rank = volumeRank.get(getOpeningName(opening).toLowerCase()) ?? 99;
      const smartVerdict = getSmartOpeningVerdict(opening, data, rank);
      const fitScore =
        smartVerdict.label === "Main weapon" ||
        smartVerdict.label === "Reliable choice"
          ? Math.max(score, 78)
          : smartVerdict.category === "review"
          ? Math.max(score, 58)
          : score;

      return {
        ...opening,
        fitScore,
        fitVerdict: smartVerdict.label,
        fitCategory: smartVerdict.category,
        fitTone: smartVerdict.tone,
        fitSeverity: smartVerdict.severity,
        fitSampleTier: getOpeningSampleTier(getOpeningGames(opening)),
        fitExplanation: getOpeningExplanation(
          opening,
          fitScore,
          playerStyle,
          data,
          rank
        ),
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  const recognised = scoredOpenings.filter(
    (opening) => !isUnknownOpeningName(getOpeningName(opening))
  );

  const bestOpening = recognised[0] || scoredOpenings[0] || null;

  const concernRank = {
    avoid: 0,
    review: 1,
    improve: 2,
    neutral: 3,
    keep: 4,
  };

  const weakestOpening =
    [...recognised]
      .filter((opening) => getOpeningGames(opening) >= 3)
      .sort((a, b) => {
        const categoryDiff =
          (concernRank[a.fitCategory] ?? 3) - (concernRank[b.fitCategory] ?? 3);
        if (categoryDiff) return categoryDiff;
        return a.fitScore - b.fitScore;
      })[0] ||
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
  const backendScore = safeNumber(data?.openingFitScore ?? data?.opening_fit_score, 0);
  const openingIdentity =
    data?.openingIdentity || data?.opening_identity || playerStyle.title || "Opening identity pending";
  const identityExplanation =
    data?.openingIdentityExplanation ||
    data?.opening_identity_explanation ||
    playerStyle.description ||
    "Import more games to turn this into a clearer opening identity.";

  return {
    playerStyle,
    playerTier: getPlayerTier(data),
    reportMode: getReportMode(data),
    scoredOpenings,
    bestOpening,
    weakestOpening,
    overallScore: backendScore || overallScore,
    scoreExplanation:
      data?.openingFitScoreExplanation ||
      data?.opening_fit_score_explanation ||
      "OpeningFit combines repertoire stability, White and Black performance, sample confidence, clear lower-scoring samples, and recent consistency.",
    openingIdentity,
    identityExplanation,
    scoreBreakdown: data?.openingFitScoreBreakdown || {},
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
  const publicMode = fitData.reportMode !== "normal_user";

  const keepCount = scoredOpenings.filter(
    (opening) => opening.fitCategory === "keep"
  ).length;

  const reviewCount = scoredOpenings.filter(
    (opening) =>
      opening.fitCategory === "review" || opening.fitCategory === "improve"
  ).length;

  const avoidCount = scoredOpenings.filter(
    (opening) => opening.fitCategory === "avoid"
  ).length;

  return (
    <section className="card openingFitHeroCard">
      <div className="fitHeroTop">
        <div>
          <p className="eyebrow">Opening Fit Result</p>
          <h2>{playerStyle.title}</h2>
          <p className="muted">{playerStyle.description}</p>
          {publicMode ? <p className="muted">{PUBLIC_ACCOUNT_CAUTION_COPY}</p> : null}
        </div>

        <div className="fitScoreCircle">
          <strong>{overallScore}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="fitHeroGrid">
        <div className="fitMiniCard">
          <span className="fitLabel">{publicMode ? "Recent strength" : "Best current fit"}</span>
          <strong>
            {bestOpening ? getOpeningName(bestOpening) : "Not enough data"}
          </strong>
          {bestOpening ? (
            <p>
              {bestOpening.fitScore}/100 — {publicAwareVerdict(bestOpening.fitVerdict, { reportMode: fitData.reportMode }, getOpeningGames(bestOpening))}
            </p>
          ) : null}
        </div>

        <div className="fitMiniCard">
          <span className="fitLabel">{publicMode ? "Lower-scoring sample" : "Biggest weakness"}</span>
          <strong>
            {weakestOpening ? getOpeningName(weakestOpening) : "Not enough data"}
          </strong>
          {weakestOpening ? (
            <p>
              {weakestOpening.fitScore}/100 — {publicAwareVerdict(weakestOpening.fitVerdict, { reportMode: fitData.reportMode }, getOpeningGames(weakestOpening))}
            </p>
          ) : null}
        </div>

        <div className="fitMiniCard">
          <span className="fitLabel">{publicMode ? "Recent sample labels" : "Opening verdicts"}</span>
          <strong>
            {publicMode
              ? `${keepCount} Strength · ${reviewCount} Lower-scoring · ${avoidCount} Noisy`
              : `${keepCount} Reliable · ${reviewCount} Review · ${avoidCount} Caution`}
          </strong>
          <p>
            {publicMode
              ? "Based only on recent imported online games."
              : "Based on your imported games and opening results."}
          </p>
        </div>
      </div>

      <div className="fitRecommendationBox">
        <strong>Recommended next step:</strong>{" "}
        {bestOpening
          ? publicMode
            ? `Use ${getOpeningName(bestOpening)} as the recent strength sample, then compare lower-scoring samples by time control and opponent pool.`
            : `Build your short repertoire around ${getOpeningName(
                bestOpening
              )}, then review your least stable opening.`
          : "Import more games to get a stronger recommendation."}

        {bestOpening ? (
          <button
            className="secondaryBtn fitPracticeBtn"
            type="button"
            onClick={() => onPractice(getOpeningName(bestOpening))}
          >
            {publicMode ? "Review sample" : "Practise best fit"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function OpeningFitScoreList({ fitData, onPractice }) {
  if (!fitData || !fitData.scoredOpenings?.length) return null;
  const publicMode = fitData.reportMode !== "normal_user";

  return (
    <section className="card openingFitScoreCard">
      <div className="sectionHeaderSimple">
        <div>
          <p className="eyebrow">Opening Fit Scores</p>
          <h2>Opening verdicts</h2>
          <p className="muted">
            {publicMode
              ? "These labels describe recent online performance samples only."
              : "These scores estimate which openings fit your results and playing style."}
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
                    {games} games · {winRate}% score ·{" "}
                    {publicAwareVerdict(opening.fitVerdict, { reportMode: fitData.reportMode }, games)}
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

function BiggestInsightCard({ data, fitData }) {
  if (!data || !fitData?.scoredOpenings?.length) return null;

  const publicMode = isPublicReportMode(data);
  const profile = getSmartPlayerLevelProfile(data);
  const recommendation = getSmartLevelAwareRecommendation(data, fitData);
  const openings = fitData.scoredOpenings || [];
  const stable = openings.find((opening) => opening.fitCategory === "keep") || fitData.bestOpening;
  const review =
    openings.find((opening) => ["review", "improve", "avoid"].includes(opening.fitCategory)) ||
    fitData.weakestOpening;
  const white = openings.find((opening) =>
    String(getOpeningSide(opening)).toLowerCase().includes("white")
  );
  const black = openings.find((opening) =>
    String(getOpeningSide(opening)).toLowerCase().includes("black")
  );
  const sideFocus = white && black
    ? getWinRate(white) < getWinRate(black)
      ? "White"
      : "Black"
    : white
    ? "White"
    : black
    ? "Black"
    : "your most repeated side";
  const stableName = stable ? getOpeningName(stable) : recommendation.bestName;
  const reviewName = review ? getOpeningName(review) : recommendation.weakName;
  const ratingLabel = profile.rating ? `${profile.rating} rating` : profile.label;
  const levelText =
    publicMode
      ? publicAccountCaution(data)
      : profile.level === "elite" || profile.level === "strong"
      ? "Treat this as a repertoire audit, not a beginner verdict."
      : profile.level === "beginner" || profile.level === "improver"
      ? "The fastest gain is simpler choices and familiar positions."
      : "The fastest gain is repairing one repeat branch while keeping your stable openings.";

  return (
    <section className="card biggestInsightCard">
      <p className="eyebrow">Biggest insight</p>
      <h2>{recommendation.title}</h2>
      <p>
        {publicMode
          ? `${levelText} The ${sideFocus} sample shows ${stableName} as a recent strength and ${reviewName} as a lower-scoring sample to compare by time control, opponent pool, and game context.`
          : `${levelText} Your ${sideFocus} results point toward keeping ${stableName} as the reference point and reviewing ${reviewName} for a specific line, move order, or early middlegame structure.`}
      </p>
      <div className="fitMiniGrid">
        <div className="fitMiniCard">
          <span className="fitLabel">Level read</span>
          <strong>{ratingLabel}</strong>
          <p>{profile.trainingFocus}</p>
        </div>
        <div className="fitMiniCard">
          <span className="fitLabel">Action</span>
          <strong>20 minutes today</strong>
          <p>{recommendation.primaryAction}</p>
        </div>
      </div>
    </section>
  );
}

function CompactReportSummary({ data, fitData, onViewChange }) {
  if (!data) return null;

  const publicMode = isPublicReportMode(data);
  const openings = fitData?.scoredOpenings || [];
  const best = fitData?.bestOpening || openings[0] || null;
  const repair =
    openings.find((opening) => ["review", "improve"].includes(opening.fitCategory)) ||
    fitData?.weakestOpening ||
    openings[1] ||
    null;
  const avoid =
    openings.find((opening) => opening.fitCategory === "avoid") ||
    openings.find((opening) => opening.fitSeverity === "danger") ||
    repair;
  const playerName =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    "Your report";
  const games =
    data.total_games ||
    data.gamesImported ||
    data.games_imported ||
    data.games_analyzed ||
    0;
  const score = fitData?.overallScore || data?.openingFitScore || data?.opening_fit_score || 0;
  const scoreExplanation =
    fitData?.scoreExplanation ||
    data?.openingFitScoreExplanation ||
    data?.opening_fit_score_explanation ||
    "OpeningFit combines repertoire stability, White and Black performance, sample confidence, clear lower-scoring samples, and recent consistency.";
  const identity =
    fitData?.openingIdentity ||
    data?.openingIdentity ||
    data?.opening_identity ||
    "Opening identity pending";
  const identityExplanation =
    fitData?.identityExplanation ||
    data?.openingIdentityExplanation ||
    data?.opening_identity_explanation ||
    "Import more games to turn this into a clearer opening identity.";

  const card = (label, opening, fallback, className) => (
    <article className={`compactVerdictCard ${className || ""}`}>
      <span>{label}</span>
      <strong>{opening ? getOpeningName(opening) : fallback}</strong>
      <p>
        {opening
          ? `${getOpeningGames(opening)} games · ${getWinRate(opening)}% score`
          : "Import more games before changing the repertoire."}
      </p>
    </article>
  );

  return (
    <section className="compactReportDashboard" id="style-profile">
      <div className="compactReportTitle">
        <p className="eyebrow">Opening Fit report</p>
        <h1>{playerName} opening dashboard</h1>
        <span>{games ? `${games} games analysed` : "Report ready"}</span>
      </div>

      <div className="openingIdentityHero">
        <article className="openingScoreHeroCard">
          <span>OpeningFit Score</span>
          <div className="openingScoreHeroValue">
            <strong>{score || "—"}</strong>
            <small>/100</small>
          </div>
          <p>{scoreExplanation}</p>
        </article>

        <article className="openingIdentityCard">
          <span>Opening Identity</span>
          <strong>{identity}</strong>
          <p>{identityExplanation}</p>
        </article>
      </div>

      <BiggestInsightCard data={data} fitData={fitData} />

      <div className="compactVerdictGrid">
        {card(publicMode ? "Recent strength" : "Best fit", best, "Not enough data", "best")}
        {card(publicMode ? "Lower-scoring sample" : "Needs repair", repair, "No repair target yet", "repair")}
        {card(publicMode ? "Experimental/content-game possible" : "Avoid for now", avoid, "No avoid target yet", "avoid")}
      </div>

      <button
        className="primaryBtn compactStudyCta"
        type="button"
        onClick={() => onViewChange?.("training")}
      >
        {publicMode ? "Review recent performance trends" : "Start my 20-minute study plan"}
      </button>
    </section>
  );
}

function NextStudySession({ fitData, recentGames = [], onPractice, onViewChange }) {
  const [savedMessage, setSavedMessage] = useState("");

  if (!fitData || !fitData.scoredOpenings?.length) return null;

  const scoredOpenings = fitData.scoredOpenings || [];
  const publicMode = fitData.reportMode !== "normal_user";
  const usableWeaknesses = scoredOpenings
    .filter((opening) => {
      const name = getOpeningName(opening);
      const games = getOpeningGames(opening);
      return (
        name &&
        name !== "Unknown opening" &&
        games >= 5 &&
        ["avoid", "review", "improve"].includes(opening.fitCategory)
      );
    })
    .sort((a, b) => {
      const severity = { avoid: 0, review: 1, improve: 2 };
      const categoryDiff = (severity[a.fitCategory] ?? 3) - (severity[b.fitCategory] ?? 3);
      if (categoryDiff) return categoryDiff;
      return a.fitScore - b.fitScore;
    });

  const studyOpening = usableWeaknesses[0] || null;
  const hasFocusedSession = Boolean(studyOpening);
  const studyName = studyOpening ? getOpeningName(studyOpening) : "one chosen opening";
  const studyGames = studyOpening ? getOpeningGames(studyOpening) : 0;
  const studyScore = studyOpening ? getWinRate(studyOpening) : 0;
  const studySide = studyOpening
    ? studyOpening.contextLabel || contextLabel(itemContext(studyOpening)) || getOpeningSide(studyOpening) || "in your games"
    : "in your next games";
  const averageScore = scoredOpenings.length
    ? Math.round(
        scoredOpenings.reduce((total, opening) => total + getWinRate(opening), 0) /
          scoredOpenings.length
      )
    : 50;
  const belowAverage = hasFocusedSession && studyScore < averageScore;
  const reasonText = hasFocusedSession
    ? publicMode
      ? `You played ${studyName} ${studyGames} times ${studySide}, and this is the clearest lower-scoring recent sample to review without overclaiming.`
      : `You played ${studyName} ${studyGames} times ${studySide}, scored ${studyScore}%, and ${belowAverage ? "it sits below your opening average" : "it is the clearest repeated weakness in the report"}.`
    : "The current samples are too small or noisy for a confident opening-specific session.";
  const reviewTask = hasFocusedSession
    ? `Review the first 6 moves of ${studyName} and write your usual setup in one sentence.`
    : "Choose one White opening or one Black defence and play it consistently for the next 10 games.";
  const practiceTask = hasFocusedSession
    ? `Practise the main ${studyName} structure: setup, typical pawn break, and one safe plan after move 10.`
    : "Play 10 more games with that one chosen opening. Do not switch lines unless the opponent forces it.";
  const gameReviewTask = hasFocusedSession
    ? `Review your last 2 ${studyName} losses, or the closest recent games, and mark where you first left your plan.`
    : "After the games, review the first 8 moves and note the position where you felt unsure most often.";
  const nextImportCheck = hasFocusedSession
    ? `After the next import, check whether ${studyName} gained sample size, improved its score, and produced fewer early uncomfortable positions.`
    : "After the next import, check whether the chosen opening has at least 5 games and a clear score trend.";

  const reviewGames = recentGames.filter((game) => {
    const gameOpening = String(game?.opening || game?.name || "").toLowerCase();
    return hasFocusedSession && gameOpening.includes(studyName.toLowerCase());
  });

  const gamesToReview = reviewGames.length ? reviewGames.slice(0, 2) : recentGames.slice(0, 2);

  const saveStudySession = () => {
    const payload = {
      savedAt: new Date().toISOString(),
      opening: studyName,
      focused: hasFocusedSession,
      why: reasonText,
      tasks: [
        reviewTask,
        practiceTask,
        gameReviewTask,
        nextImportCheck,
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
    <section className="nextStudyShell card nextStudySession" id="next-study-session">
      <div className="nextStudyHero">
        <div>
          <p className="eyebrow">Next 20-minute study session</p>
          <h2>
            {hasFocusedSession
              ? `Study: ${studyName}`
              : "General session: build a clearer sample"}
          </h2>
          <p className="muted">
            {hasFocusedSession
              ? reasonText
              : "Play 10 more games with one chosen opening, then re-import."}
          </p>
        </div>

        <div className="nextStudyScore">
          <strong>20</strong>
          <span>minutes</span>
        </div>
      </div>

      <div className="nextStudySessionPlan">
        <article className="nextStudyCard nextStudyCardWarning">
          <span className="nextStudyStepLabel">Opening to study</span>
          <h3>{studyName}</h3>
          <p>{reasonText}</p>
          <div className="nextStudyMeta">
            <span>{hasFocusedSession ? `${studyGames} games` : "General sample"}</span>
            <span>{hasFocusedSession ? `${studyScore}% score` : "No hard verdict"}</span>
          </div>
        </article>

        <article className="nextStudyTask">
          <span>5 min</span>
          <strong>Review task</strong>
          <p>{reviewTask}</p>
        </article>

        <article className="nextStudyTask nextStudyTaskPrimary">
          <span>10 min</span>
          <strong>Practice task</strong>
          <p>{practiceTask}</p>
          {hasFocusedSession && onPractice ? (
            <button className="primaryBtn" type="button" onClick={() => onPractice(studyName)}>
              Practise line
            </button>
          ) : null}
        </article>

        <article className="nextStudyTask">
          <span>5 min</span>
          <strong>Game review task</strong>
          <p>{gameReviewTask}</p>
          <button className="secondaryBtn" type="button" onClick={goToGames}>
            Review games
          </button>
        </article>

        <article className="nextStudyTask nextStudyCheck">
          <span>Next import</span>
          <strong>What to check</strong>
          <p>{nextImportCheck}</p>
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

  const menuRoutes = data
    ? [
        { key: "overview", label: "Overview", view: "overview", target: "app-results", path: "/" },
        { key: "recommendations", label: "Openings", view: "recommendations", target: "section-recommendations", path: "/" },
        { key: "training", label: "Study plan", view: "training", target: "section-training", path: "/" },
        { key: "games", label: "Games", view: "games", target: "section-replay", path: "/" },
        { key: "upgrade", label: "Upgrade", view: "upgrade", target: "premium", path: "/upgrade" },
        { key: "account", label: "Login / Payment", view: "account", target: "account", path: "/account" },
        { key: "feedback", label: "Feedback", view: "feedback", target: "feedback", path: "/" },
      ]
    : [
        { key: "import", label: "Import", target: "app-dashboard", path: "/" },
        { key: "account", label: "Login / Payment", view: "account", target: "account", path: "/account" },
        { key: "upgrade", label: "Founder Pass", view: "account", target: "account", path: "/account" },
        { key: "feedback", label: "Feedback", view: "feedback", target: "feedback", path: "/" },
      ];

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

  const scrollToTarget = (targetId) => {
    const target =
      document.getElementById(targetId) ||
      document.getElementById("app-results") ||
      document.getElementById("app-dashboard");

    scrollToElement(target);
  };

  const navigate = (route) => {
    if (route.view && typeof onViewChange === "function") {
      onViewChange(route.view);
    }

    if (route.path && window.location.pathname !== route.path) {
      window.history.pushState({}, "", route.path);
    }

    if (!route.view && typeof onJump === "function") {
      onJump(route.target);
    }

    setOpen(false);

    [80, 220, 480].forEach((delay) => {
      setTimeout(() => scrollToTarget(route.target), delay);
    });
  };

  return (
    <nav className={`openingAppMenu ${open ? "openingAppMenuOpen" : ""}`} aria-label="Opening Fit navigation">
      <button
        className="openingAppMenuToggle"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      >
        {open ? "×" : "☰"}
      </button>

      {open ? (
        <div className="openingAppMenuPanel">
          <div className="openingAppMenuHeader">
            <strong>Opening Fit</strong>
            <span>{data ? "Report navigation" : "Start here"}</span>
          </div>

          <div className="openingAppMenuGrid">
            {menuRoutes.map((route) => (
              <button
                key={route.key}
                type="button"
                className={activeView === route.view ? "isActive" : ""}
                onClick={() => navigate(route)}
              >
                {route.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}


function AppViewTabs({ activeView, onChange }) {
  const tabs = [
    { key: "overview", label: "Overview", icon: "⌂" },
    { key: "recommendations", label: "Openings", icon: "◎" },
    { key: "training", label: "Study Plan", icon: "◷" },
    { key: "games", label: "Games", icon: "♟" },
    { key: "upgrade", label: "Upgrade", icon: "◆" },
  ];

  const selectTab = (view) => {
    if (typeof onChange === "function") {
      onChange(view);
    }

    const scrollToTabs = () => {
      const target =
        document.getElementById("app-results") ||
        document.querySelector(".appTabsCard");

      if (!target) return;

      const offset = window.innerWidth <= 760 ? 86 : 108;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    };

    setTimeout(scrollToTabs, 80);
  };

  return (
    <section className="card appTabsCard compactReportNav" id="app-view-tabs">
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

function getCurrentPath() {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : "/";
}

function getInitialAppView() {
  const path = getCurrentPath();
  if (path === "/account" || path === "/login") return "account";
  if (path === "/upgrade" || path === "/premium") return "upgrade";
  return "overview";
}

function getSeoData(path) {
  const page = SEO_PAGES[path];
  if (!page) return { ...HOME_SEO, url: `${SITE_URL}/` };
  return { ...page, path, url: `${SITE_URL}${path}` };
}

function setMetaAttribute(selector, attributes) {
  let tag = document.head.querySelector(selector);

  if (!tag) {
    tag = document.createElement("meta");
    document.head.appendChild(tag);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    tag.setAttribute(key, value);
  });
}

function setCanonical(url) {
  let link = document.head.querySelector('link[rel="canonical"]');

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.setAttribute("href", url);
}

function getSeoJsonLd(seoData) {
  if (seoData.path === "/faq") {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: seoData.faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      })),
    };
  }

  if (seoData.path && seoData.path !== "/") {
    return {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: seoData.title,
      url: seoData.url,
      description: seoData.description,
      isPartOf: {
        "@type": "WebSite",
        name: "Opening Fit",
        url: `${SITE_URL}/`,
      },
    };
  }

  return null;
}

function CompactSeoFooter() {
  return (
    <footer className="compactSeoFooter">
      <nav aria-label="Opening Fit SEO links">
        {SEO_LINKS.map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <p>
        Chess opening analysis, repertoire builder, Chess.com and Lichess
        opening report, study plan, and keep / improve / avoid guidance.
        Founder Pass lifetime access: £8.
      </p>
    </footer>
  );
}

function SeoRoutePage({ page }) {
  return (
    <>
      <div className="page dark publicLandingPage" data-theme="dark">
        <main className="container appShell seoRouteShell">
          <section className="hero heroCard compactImportHero seoRouteHero">
            <p className="eyebrow">Opening Fit</p>
            <h1>{page.h1}</h1>
            <p className="subtext">{page.intro}</p>
            <a className="primaryBtn seoRouteCta" href="/">
              Start a free opening report
            </a>
          </section>

          {page.faqs ? (
            <section className="seoRouteGrid seoFaqList" aria-label="FAQ">
              {page.faqs.map(([question, answer]) => (
                <article className="seoRouteCard" key={question}>
                  <h2>{question}</h2>
                  <p>{answer}</p>
                </article>
              ))}
            </section>
          ) : (
            <section className="seoRouteGrid">
              {page.sections.map(([title, text]) => (
                <article className="seoRouteCard" key={title}>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </article>
              ))}
            </section>
          )}

          <CompactSeoFooter />
        </main>
      </div>
      <Analytics />
    </>
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

      {/* Diagnostic card for large imports with low qualification */}
      {data?.import_debug ? (
        (() => {
          const dbg = data.import_debug;
          const imported = dbg.gamesFetched || dbg.gamesFetched === 0 ? dbg.gamesFetched : gamesImported;
          const openingsDetected = dbg.openingsDetected || (data.top_openings || []).length || 0;
          const qualifiedCount = (dbg.qualifiedOpenings || []).length || 0;

          if (imported >= 200 && qualifiedCount < 5) {
            return (
              <div className="importDiagnosticCard">
                <strong>Diagnostic</strong>
                <p>
                  Imported {imported} games. Detected openings in {openingsDetected}. Your games are spread across {openingsDetected} opening names, so we’re showing lower-confidence patterns.
                </p>
              </div>
            );
          }

          return null;
        })()
      ) : null}

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
  const publicMode = isPublicReportMode(data);

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
  const colourAwareSections = getColourAwareRecommendationSections(data);
  const findSection = (key) =>
    colourAwareSections.find((section) => section.key === key)?.items || [];

  const whiteOpenings = ranked.filter((item) => item.colour.includes("white"));
  const blackOpenings = ranked.filter((item) => item.colour.includes("black"));

  const bestWhite =
    findSection("white_repertoire")[0] ||
    whiteOpenings.find((item) =>
      contextIsCompatible(item.displayName, "played_as_white")
    );

  const bestBlack =
    findSection("black_vs_e4")[0] ||
    findSection("black_vs_d4_other")[0] ||
    blackOpenings.find((item) =>
      contextIsCompatible(item.displayName, "black_vs_e4")
    );

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
      return publicMode
        ? "This is a recent strength in the imported online sample."
        : `This is currently one of your strongest choices. The results suggest it fits the positions you are already handling well.`;
    }

    if (type === "improve") {
      return publicMode
        ? "This is a lower-scoring recent sample. Compare time control, opponent pool, and whether these were experimental or content-style games before drawing conclusions."
        : `This is not a verdict that the whole opening is bad. It means one line, move order, or early middlegame structure is hurting the overall score.`;
    }

    if (type === "avoid") {
      return publicMode
        ? "This sample is too contextual for a hard verdict. Treat it as recent online trend evidence only."
        : `Treat this as a review target first. If the same branch keeps causing trouble, simplify that line before replacing the entire opening.`;
    }

    return "Use this as a practical guide for what to study next.";
  };

  const whiteRecommendation = bestWhite
    ? `Use ${bestWhite.displayName || bestWhite.name} as your main White focus for the next block of games.`
    : "Import more White games to unlock a clearer White repertoire recommendation.";

  const blackRecommendation = bestBlack
    ? `Use ${bestBlack.displayName || bestBlack.name} as your main Black focus and review the positions for that specific first-move context.`
    : "Import more Black games to unlock a clearer Black repertoire recommendation.";

  const studyOpening =
    improveOpening?.displayName ||
    bestOverall?.displayName ||
    "your most common opening";
  const adviceEvidence = (opening) => getEvidenceLine(opening || {}, data).replace(/^Evidence: /, "");
  const adviceAction = (opening, type) => {
    if (publicMode) {
      return `Next action: compare ${opening?.displayName || opening?.name || "this sample"} by time control and opponent pool.`;
    }

    if (type === "keep") {
      return `Next action: replay your last win in ${opening?.displayName || opening?.name || "this opening"} and save the move-10 plan.`;
    }

    return `Next action: review your last 3 ${opening?.displayName || opening?.name || "opening"} losses and mark the first repeated problem.`;
  };

  return (
    <section className="fullReportShell" id="opening-fit-report">
      <div className="fullReportHeader">
        <span>Report upgrade</span>
        <h2>What Opening Fit recommends next</h2>
        <p>
          {publicMode
            ? `${publicAccountCaution(data)} This report frames ${playerName}'s imported games as recent online performance trends.`
            : `This turns ${playerName}'s recent games into a practical opening plan: what is reliable, what branch needs review, and where the study time should go next.`}
        </p>
      </div>

      <div className="adviceGrid" id="keep-improve-avoid">
        <article className="adviceCard keep">
          <div className="adviceTopline">
            <span>{publicMode ? "Recent strength" : "Keep"}</span>
            <small>{formatScore(bestOverall)}</small>
          </div>
          <h3>{bestOverall?.displayName || (publicMode ? "Recent strength sample" : "Keep building your main repertoire")}</h3>
          <p><strong>Evidence:</strong> {adviceEvidence(bestOverall)}</p>
          <p><strong>{adviceAction(bestOverall, "keep")}</strong></p>
          <div className="adviceMeta">{formatGames(bestOverall)} reviewed</div>
        </article>

        <article className="adviceCard improve">
          <div className="adviceTopline">
            <span>{publicMode ? "Lower-scoring sample" : "Promising but unstable"}</span>
            <small>{formatScore(improveOpening)}</small>
          </div>
          <h3>{improveOpening?.displayName || (publicMode ? "Noisy recent sample" : "Review your common losses")}</h3>
          <p><strong>Evidence:</strong> {adviceEvidence(improveOpening)}</p>
          <p><strong>{adviceAction(improveOpening, "improve")}</strong></p>
          <div className="adviceMeta">{formatGames(improveOpening)} reviewed</div>
        </article>

        <article className="adviceCard avoid">
          <div className="adviceTopline">
            <span>{publicMode ? "Experimental/content-game possible" : "Needs review"}</span>
            <small>{formatScore(avoidOpening)}</small>
          </div>
          <h3>{avoidOpening?.displayName || "Low-sample experiments"}</h3>
          <p><strong>Evidence:</strong> {adviceEvidence(avoidOpening)}</p>
          <p><strong>{adviceAction(avoidOpening, "avoid")}</strong></p>
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
              <strong>{bestWhite?.displayName || bestWhite?.name || "Needs more White games"}</strong>
              <p>{whiteRecommendation}</p>
            </div>

            <div className="repertoireRow">
              <span>As Black</span>
              <strong>{bestBlack?.displayName || bestBlack?.name || "Needs more Black games"}</strong>
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
          <h2>{publicMode ? "Recent trend review" : "Your next 7 days"}</h2>

          <ol className="studySteps">
            {publicMode ? (
              <>
                <li>
                  <strong>Step 1:</strong> Separate games by time control, opponent rating, and event context.
                </li>
                <li>
                  <strong>Step 2:</strong> Compare the lower-scoring sample in {studyOpening} with the player's broader repertoire before making claims.
                </li>
                <li>
                  <strong>Step 3:</strong> Treat tiny samples as experimental/content-game possible.
                </li>
              </>
            ) : (
              <>
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
                  <strong>Day 4-7:</strong> Play a focused block using only your
                  recommended White and Black choices.
                </li>
              </>
            )}
          </ol>
        </article>
      </div>

      <div className="premiumRoadmapStrip">
        <div>
          <span>Premium tools</span>
          <h2>Deeper report actions</h2>
          <p>
            Save report history, export your report, prepare for opponents,
            review deeper opening explanations, and track progress over time.
          </p>
        </div>

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


function OpeningFitReportHero({ data }) {
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
          <a href="#opening-suggestions" className="reportPrimaryLink">
            View recommendations
          </a>
          <a href="#keep-improve-avoid" className="reportSecondaryLink">
            See verdicts
          </a>
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
  const [openingSamplePercent, setOpeningSamplePercent] = useState(() =>
    clampOpeningSamplePercent(localStorage.getItem(OPENING_SAMPLE_PERCENT_KEY) ?? 2)
  );
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
    setActiveView("account");
    if (window.location.pathname !== "/account") {
      window.history.pushState({}, "", "/account");
    }

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
  const [activeView, setActiveView] = useState(getInitialAppView);
  const shouldShowLandingIntro = () => {
    const landingSeen = localStorage.getItem("openingfit_landing_seen") === "true";
    const hasSavedReport = Boolean(localStorage.getItem(STORAGE_KEY));
    const hasAppHash = window.location.hash && window.location.hash !== "#";
    return !hasSavedReport && !landingSeen && !hasAppHash;
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
    const savedSamplePercent = localStorage.getItem(OPENING_SAMPLE_PERCENT_KEY);
    const savedAnalysis = localStorage.getItem(STORAGE_KEY);

    if (savedUsername) setUsername(savedUsername);
    if (savedPremium === "true") setIsPremium(true);

    if (savedMonths) {
      const parsedMonths = Number(savedMonths);
      if ([1, 3, 6, 12].includes(parsedMonths)) {
        setImportMonths(parsedMonths);
      }
    }

    if (savedSamplePercent !== null) {
      setOpeningSamplePercent(clampOpeningSamplePercent(savedSamplePercent));
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
    localStorage.setItem(
      OPENING_SAMPLE_PERCENT_KEY,
      String(openingSamplePercent)
    );
  }, [openingSamplePercent]);

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
      reportMode: incoming.reportMode ?? incoming.report_mode ?? "normal_user",
      report_mode: incoming.report_mode ?? incoming.reportMode ?? "normal_user",
      reportModeReasons: incoming.reportModeReasons ?? incoming.report_mode_reasons ?? [],
      publicAccountCaution:
        incoming.publicAccountCaution ?? incoming.public_account_caution ?? "",
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

  const importGames = async (usernameOverride, platformOverride) => {
    const selectedPlatformKey = platforms[platformOverride] ? platformOverride : platform;
    const cleanUsername = String(usernameOverride ?? username).trim();

    setLoading(true);
    setLoadingStep(
      `Finding your recent ${platforms[selectedPlatformKey]?.label || "chess"} games...`
    );
    setError("");
    setSavedProfileMessage("");
    setData(null);
    setSelectedGameIndex(0);
    setPracticeOpening(null);
    setOpenSections(closedSections);

    try {
      if (!cleanUsername) {
        throw new Error("Please enter a username.");
      }

      const selectedPlatform = platforms[selectedPlatformKey] || platforms.chesscom;

      localStorage.setItem(USERNAME_KEY, cleanUsername);
      localStorage.setItem(PLATFORM_KEY, selectedPlatformKey);
      localStorage.setItem(IMPORT_MONTHS_KEY, String(monthsToImport));
      setUsername(cleanUsername);
      setPlatform(selectedPlatformKey);

      await trackEvent("frontend_import_started", {
        username: cleanUsername,
        platform: selectedPlatformKey,
        months: monthsToImport,
        openingSamplePercent,
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
        platform: selectedPlatformKey,
        gamesImported: cleanData.gamesImported ?? cleanData.total_games,
        months: monthsToImport,
        openingSamplePercent,
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
    const normalized = String(verdict || "").toLowerCase();

    if (
      normalized.includes("keep") ||
      normalized.includes("core weapon") ||
      normalized.includes("trusted weapon") ||
      normalized.includes("main weapon") ||
      normalized.includes("reliable choice")
    ) {
      return "verdict keep";
    }

    if (
      normalized.includes("improve") ||
      normalized.includes("review") ||
      normalized.includes("performance check") ||
      normalized.includes("fine-tune") ||
      normalized.includes("deep review") ||
      normalized.includes("promising but unstable")
    ) {
      return "verdict improve";
    }

    if (normalized.includes("avoid")) {
      return "verdict avoid";
    }

    return "verdict test";
  };

  const filteredTopOpenings = useMemo(() => {
    return filterOpeningsBySamplePercent(
      filterUnknownOpenings(data?.top_openings || []),
      data?.total_games,
      openingSamplePercent
    );
  }, [data, showUnknownOpenings, openingSamplePercent]);

  const filteredBestOpenings = useMemo(() => {
    return filterOpeningsBySamplePercent(
      filterUnknownOpenings(data?.best_openings || []),
      data?.total_games,
      openingSamplePercent
    );
  }, [data, showUnknownOpenings, openingSamplePercent]);

  const filteredPreferredWhite = useMemo(() => {
    return filterOpeningsBySamplePercent(
      filterUnknownOpenings(data?.preferred_white || []),
      data?.total_games,
      openingSamplePercent
    );
  }, [data, showUnknownOpenings, openingSamplePercent]);

  const filteredPreferredBlack = useMemo(() => {
    return filterOpeningsBySamplePercent(
      filterUnknownOpenings(data?.preferred_black || []),
      data?.total_games,
      openingSamplePercent
    );
  }, [data, showUnknownOpenings, openingSamplePercent]);

  const filteredRecentGames = useMemo(() => {
    return filterUnknownOpenings(data?.recent_games || []);
  }, [data, showUnknownOpenings]);

  const chartData = useMemo(() => {
    return filteredTopOpenings.slice(0, isPremium ? 10 : 6);
  }, [filteredTopOpenings, isPremium]);

  const openingSampleMinimumGames = getOpeningSampleMinimumGames(
    data?.total_games,
    openingSamplePercent
  );

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

  const colourAwareRecommendationSections = useMemo(() => {
    return getColourAwareRecommendationSections(data).map((section) => ({
      ...section,
      items: filterUnknownOpenings(section.items || []),
    }));
  }, [data, showUnknownOpenings]);

  const smartRecommendationSummary = useMemo(() => {
    const levelProfile = getSmartPlayerLevelProfile(data);
    const levelAware = getSmartLevelAwareRecommendation(data, fitData);
    const publicMode = isPublicReportMode(data);
    const summary = [];

    if (publicMode) {
      summary.push(publicAccountCaution(data));
      summary.push(
        "Treat these as recent online performance trends. Small samples may be experiments, prep choices, or content-game noise."
      );
    } else {
      summary.push(levelAware.summary);
      summary.push(levelAware.primaryAction);
    }

    const bestFit = fitData.bestOpening;
    const weakFit = fitData.weakestOpening;
    const top = filteredTopOpenings[0];

    if (bestFit) {
      summary.push(
        publicMode
          ? `${displayOpeningName(bestFit, data)} is the recent strength sample in this import at ${bestFit.fitScore}/100.`
          : `${displayOpeningName(bestFit, data)} currently looks like your strongest Opening Fit. It scores ${bestFit.fitScore}/100 and matches the ${levelProfile.shortLabel.toLowerCase()} profile read.`
      );
    }

    if (top && levelProfile.level !== "elite") {
      summary.push(
        `Your most common opening is ${displayOpeningName(top, data)}. Because it appears often, improving this opening should give you the biggest overall return.`
      );
    }

    if (weakFit && getOpeningName(weakFit) !== getOpeningName(bestFit)) {
      summary.push(
        publicMode
          ? `${displayOpeningName(weakFit, data)} is a lower-scoring recent sample at ${weakFit.fitScore}/100. Do not treat this as a hard opening verdict.`
          : `${displayOpeningName(weakFit, data)} may need attention. It currently scores ${weakFit.fitScore}/100, so review the first few moves and common plans.`
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
    const publicMode = isPublicReportMode(data);

    const bestFit = fitData.bestOpening;
    const weakFit = fitData.weakestOpening;

    if (publicMode) {
      return [
        {
          title: "Run this as a recent-results audit",
          text: publicAccountCaution(data),
          action: null,
          opening: null,
        },
        {
          title: "Check high-volume samples first",
          text: "Prioritise openings with enough games to show a recent trend. Low-sample results should be treated as noise or experiment/context evidence.",
          action: null,
          opening: null,
        },
        {
          title: "Look for context before conclusions",
          text: "Compare time control, opponent rating, colour/context, and event purpose before describing any line as underperforming.",
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

  const currentPath = getCurrentPath();
  const seoPage = SEO_PAGES[currentPath] || null;
  const seoData = useMemo(() => getSeoData(currentPath), [currentPath]);

  useEffect(() => {
    document.title = seoData.title;
    setCanonical(seoData.url);
    setMetaAttribute('meta[name="description"]', {
      name: "description",
      content: seoData.description,
    });
    setMetaAttribute('meta[property="og:title"]', {
      property: "og:title",
      content: seoData.title,
    });
    setMetaAttribute('meta[property="og:description"]', {
      property: "og:description",
      content:
        currentPath === "/"
          ? "Analyse your real Chess.com and Lichess games to build a practical opening repertoire."
          : seoData.description,
    });
    setMetaAttribute('meta[property="og:url"]', {
      property: "og:url",
      content: seoData.url,
    });
    setMetaAttribute('meta[property="og:type"]', {
      property: "og:type",
      content: "website",
    });
    setMetaAttribute('meta[property="og:image"]', {
      property: "og:image",
      content: `${SITE_URL}/og-image.png`,
    });
    setMetaAttribute('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });
    setMetaAttribute('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: seoData.title,
    });
    setMetaAttribute('meta[name="twitter:description"]', {
      name: "twitter:description",
      content:
        currentPath === "/"
          ? "Find the chess openings that fit how you actually play."
          : seoData.description,
    });
    setMetaAttribute('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: `${SITE_URL}/og-image.png`,
    });

    const existingJsonLd = document.getElementById("seo-route-jsonld");
    if (existingJsonLd) existingJsonLd.remove();

    const jsonLd = getSeoJsonLd(seoData);
    if (jsonLd) {
      const script = document.createElement("script");
      script.id = "seo-route-jsonld";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [currentPath, seoData]);

  useEffect(() => {
    const openAccountPage = () => {
      setActiveView("account");
      if (window.location.pathname !== "/account") {
        window.history.pushState({}, "", "/account");
      }

      setTimeout(() => {
        const accountTarget =
          document.getElementById("account") ||
          document.querySelector(".accountPanel");

        if (accountTarget?.scrollIntoView) {
          accountTarget.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 120);
    };

    window.addEventListener("openingfit:open-account-payment", openAccountPage);

    return () => {
      window.removeEventListener("openingfit:open-account-payment", openAccountPage);
    };
  }, []);

  useEffect(() => {
    const syncViewFromPath = () => {
      setActiveView(getInitialAppView());
    };

    window.addEventListener("popstate", syncViewFromPath);

    return () => {
      window.removeEventListener("popstate", syncViewFromPath);
    };
  }, []);

  if (seoPage) {
    return <SeoRoutePage page={seoData} />;
  }



  return (
    <>
      <div className={`page ${theme} ${isPublicLanding ? "publicLandingPage" : "appReportPage"}`} data-theme={theme}>
        {data ? (
          <>
            {false ? <OpeningFitUXCleanup
              data={data}
              username={username}
              onJump={jumpToSection}
              activeView={activeView}
              onViewChange={setActiveView}
            /> : null}

            <OpeningFitImportDoctor username={username} />

            {false ? <AppActionRouter onViewChange={setActiveView} /> : null}
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

            <MobileBottomNav
              data={data}
              activeView={activeView}
              onViewChange={setActiveView}
            />
          </>
        ) : null}

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

        <FloatingAppMenu
          data={data}
          onJump={jumpToSection}
          onPractice={startOpeningPractice}
          activeView={activeView}
          onViewChange={setActiveView}
        />

        {loading ? <ImportLoadingOverlay platform={platform} /> : null}

        {false && data ? <OpeningFitTrustBar data={data} /> : null}

        {false && data ? (
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

        {false && showLanding && !hasReport ? (
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


        {false && isPublicLanding ? (
          <div className="publicLandingTop" id="public-landing-top">
            <LandingSection onOpeningClick={startOpeningPractice} />
            <TrustFaq />
          </div>
        ) : null}

        <main className="container appShell" id="app-dashboard">
          {!data && !loading ? (
          <header className="hero heroCard compactImportHero">
              <div className="heroTop">
              <div className="heroTitleWrap">
                <p className="eyebrow">Opening Fit</p>
                <h1>Find the chess openings that fit how you actually play</h1>
                <p className="subtext">
                  Chess opening analysis for your public Chess.com or Lichess
                  games, with a compact opening report, repertoire builder,
                  keep / improve / avoid guidance, and a focused study plan.
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
                  onClick={() => importGames()}
                  disabled={loading || !username.trim()}
                >
                  {loading ? "Analysing..." : "Analyse"}
                </button>
              </div>
            </div>

            {false ? (
            <div className="filtersRow importFiltersRow">
              <label className="openingSampleControl">
                <span className="openingSampleControlTop">
                  <span>Opening sample filter</span>
                  <strong>{openingSamplePercent}%</strong>
                </span>

                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={openingSamplePercent}
                  onChange={(event) =>
                    setOpeningSamplePercent(
                      clampOpeningSamplePercent(event.target.value)
                    )
                  }
                  aria-label="Minimum percentage of games for an opening to appear in the report"
                />

                <span className="openingSampleHelp">
                  {openingSamplePercent === 0
                    ? "Showing every recognised opening, including one-game experiments."
                    : data?.total_games
                    ? `Ignoring openings below ${openingSampleMinimumGames} games in this report.`
                    : "After import, one-game openings will be ignored by default."}
                </span>
              </label>
            </div>
            ) : null}

            <div className="compactTrustRow">
              <span>No login required</span>
              <span>Uses public games</span>
              <span>Free report available</span>
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
          ) : null}

          {!data && !loading ? <CompactSeoFooter /> : null}

          {activeView === "account" ? <section className="loginScreenSection" id="account">
            <AccountPanel variant="screen" onUserChange={setAccountUser} />
          </section> : null}

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
              <OpeningPracticeLinesPanel
                openingName={practiceOpening}
                opening={practiceOpening}
                onClose={() => setPracticeOpening(null)}
              />
            </div>
          )}

          {error && <div className="errorBox">{error}</div>}

          {false && !data && !loading && !error && (
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

          {data && activeView !== "account" && (
            <div id="app-results">
              <CompactReportSummary
                data={data}
                fitData={fitData}
                onViewChange={setActiveView}
              />

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

              {activeView === "overview" ? (
                <>
                  <div className="compactReportGrid">
                    <ReportSnapshot data={data} onViewChange={setActiveView} />
                    <AppOpeningHealthScore data={data} onViewChange={setActiveView} />
                  </div>

                  <div id="section-fit">
                    <OpeningFitSummaryCard
                      fitData={fitData}
                      onPractice={startOpeningPractice}
                    />
                  </div>

                  <NextStudySession
                    fitData={fitData}
                    recentGames={filteredRecentGames}
                    onPractice={startOpeningPractice}
                    onViewChange={setActiveView}
                  />

                  <Section
                    title="Optional detailed evidence"
                    isOpen={openSections.fit}
                    onToggle={() => toggleSection("fit")}
                    badge="Evidence"
                  >
                    <IntelligentCoachInsights data={data} />
                    <OpeningClassificationNotice data={data} />
                    <OpeningDiagnosisPanel data={data} onViewChange={setActiveView} />
                    <EvidenceBackedOpeningDiagnosis
                      data={data}
                      onPractice={startOpeningPractice}
                    />
                  </Section>
                </>
              ) : null}

              {activeView === "recommendations" ? (
                <>
                  <OpeningFitFullReport data={data} />

                  <div id="section-recommendations">
                <Section
                  title="Opening Suggestions"
                  isOpen={openSections.recommendations}
                  onToggle={() => toggleSection("recommendations")}
                >
                  <div className="repertoirePreviewGrid">
                    {colourAwareRecommendationSections.map((section) => (
                      <div className="repertoireCard" key={section.key}>
                        <h3>{section.title}</h3>
                        <div className="list">
                          {section.items.length ? (
                            section.items.map((item, index) => {
                              const isAmbiguous =
                                section.key === "too_little_data" ||
                                item.context === "unknown_mixed";
                              const verdict = isAmbiguous
                                ? "Not enough context"
                                : getDataFirstVerdict(item, data);
                              const confidence = getRecommendationConfidence(item);
                              const evidenceLine = isAmbiguous
                                ? item.recommendationCopy || SAFE_CONTEXT_FALLBACK_COPY
                                : getEvidenceLine(item, data);
                              const nextAction = getNextActionLine(item, data, section.key);

                              return (
                                <button
                                  className="listItem openingPracticeLink"
                                  key={`${section.key}-${item.name}-${index}`}
                                  type="button"
                                  onClick={() =>
                                    !isAmbiguous && startOpeningPractice(item.name)
                                  }
                                >
                                  <div>
                                    <strong>{verdict}: {item.name}</strong>
                                    <div className="smallText">
                                      Confidence: {confidence}
                                    </div>
                                    <div className="smallText">{evidenceLine}</div>
                                    <div className="smallText">{nextAction}</div>
                                  </div>
                                  <span>{isAmbiguous ? "Hold" : "Practice"}</span>
                                </button>
                              );
                            })
                          ) : (
                            <EmptyState
                              title={`No ${section.title.toLowerCase()} yet`}
                              text={
                                section.key === "too_little_data"
                                  ? "Ambiguous opening patterns will appear here instead of being treated as confident advice."
                                  : "Import more games to unlock a confident colour-aware recommendation."
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))}
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
                  title="Opening verdicts"
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

              {activeView === "upgrade" ? (
                <>
                  <div id="premium">
                    <PremiumPanel
                      data={data}
                      isPremium={isPremium}
                      onUnlockDemo={unlockPremiumDemo}
                      onResetDemo={resetPremiumDemo}
                      onFounderPass={handleFounderPassClick}
                    />
                  </div>

                  <PremiumDashboard
                    data={data}
                    username={username}
                    isPremium={isPremium}
                    onFounderPass={handleFounderPassClick}
                    onUnlockDemo={unlockPremiumDemo}
                    onPractice={startOpeningPractice}
                  />

                  <SeriousPremiumStrip />

                  <OpeningReportSummary
                    data={data}
                    username={username}
                    platform={platform}
                  />

                  <RepertoireStudyPlan data={data} />

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



        {false && data ? (
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

        {false && data ? (
          <div className="productPolishFlow">
            <CoachVerdict data={data} />
            <RecommendedRepertoire data={data} />
            <PremiumPath />
          </div>
        ) : null}



              {activeView === "training" ? (
                <>
                  <OpeningCoachPlan data={data} />
                  <NextStudySession
                    fitData={fitData}
                    recentGames={filteredRecentGames}
                    onPractice={startOpeningPractice}
                    onViewChange={setActiveView}
                  />

                  <OpeningFitStudyPlanner data={data} username={username} />

                  {false ? <PremiumCoachPlan
                    data={data}
                    isPremium={isPremium}
                    onUnlockDemo={unlockPremiumDemo}
                  /> : null}

                  <div id="training-plan">
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
              </div>
                </>
              ) : null}

              {activeView === "games" ? (
                <>
                  <div id="game-replay">
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

              {activeView === "upgrade" ? (
                <>
                  <div id="top-openings-table">
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
              </div>
                </>
              ) : null}
              {activeView === "overview" ? (
                <RetentionHub data={data} />
              ) : null}

              {activeView === "repertoire" ? (
                <>
                  <MyRepertoire
                    data={data}
                    isPremium={isPremium}
                    onUnlockDemo={unlockPremiumDemo}
                  />

                  <InteractiveRepertoire
                    data={data}
                    onPractice={startOpeningPractice}
                  />

                  <div id="premium">
                    <PremiumPanel
                      data={data}
                      isPremium={isPremium}
                      onUnlockDemo={unlockPremiumDemo}
                      onResetDemo={resetPremiumDemo}
                      onFounderPass={handleFounderPassClick}
                    />
                  </div>

                  <PremiumTrustStrip />
                </>
              ) : null}

              {false && activeView !== "feedback" ? (
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

        {!data && !showLanding && activeView !== "feedback" ? (
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

        {false ? <div className="landingWrap">
          <Footer />
        </div> : null}
      </div>

      <Analytics />
    </>
  );
}
