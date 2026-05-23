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
import OpeningFitRepertoirePlan from "./components/OpeningFitRepertoirePlan";
import OpeningEvidenceBlock, { getOpeningConfidence, getOpeningContext, getOpeningSignal } from "./components/OpeningEvidence";
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
import { useAuth } from "./context/AuthDataProvider";


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
import {
  canGiveAvoidVerdict,
  displayOpeningName,
  getLevelToneCopy,
  getPlayerLevelText,
  getSmartLevelAwareRecommendation,
  getSmartPlayerLevelProfile,
  isAdvancedOrStrongerLevel,
  isMasterLevel,
} from "./components/playerLevelLogic";
import AccountRestoreSync from "./components/AccountRestoreSync";
import { DEMO_REPORT } from "./demoReportData";
import OpeningFitDiagnosisFirst from "./components/OpeningFitDiagnosisFirst";
import FounderPassOutcomePanel from "./components/FounderPassOutcomePanel";
import ReportCommandBar from "./components/ReportCommandBar";
import SeoLandingPage, {
  SEO_LINKS,
  SEO_PAGES,
  SITE_URL,
  getSeoData,
  getSeoJsonLd,
} from "./components/SeoLandingPage.jsx";

const SAMPLE_OPENING_FIT_REPORT = {
  username: "DemoPlayer",
  playerName: "DemoPlayer",
  requestedUsername: "DemoPlayer",
  platform: "demo",
  importPlatform: "demo",
  gamesImported: 84,
  totalGames: 84,
  gamesFound: 84,
  gamesAnalysed: 84,
  gamesAnalyzed: 84,
  skippedGames: 0,
  monthsChecked: 3,
  importedAt: new Date().toISOString(),
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
  return (
    opening.side ||
    opening.colour ||
    opening.color ||
    opening.player_color ||
    opening.playerColor ||
    opening.player_colour ||
    opening.as ||
    ""
  );
}

function getOpeningContextTitle(opening, fallback = "Opening signal") {
  if (!opening) return fallback;

  const name = getOpeningName(opening);
  const context = getOpeningContext(opening);

  if (context.type === "white") return `${name} as White`;
  if (context.type === "black") return `${name} as Black`;
  if (context.type === "faced") {
    if (String(context.detail || "").toLowerCase().includes("white")) {
      return `Facing ${name} as White`;
    }
    if (String(context.detail || "").toLowerCase().includes("black")) {
      return `Facing ${name} as Black`;
    }
    return `${name} you faced`;
  }

  return `${name} (mixed signal)`;
}

function getOpeningIdentityKey(opening) {
  if (!opening) return "";
  const context = getOpeningContext(opening);
  return [
    getOpeningName(opening).toLowerCase(),
    context.type || "mixed",
    context.detail || context.label || "",
  ].join("|");
}

function isSameOpeningContext(a, b) {
  if (!a || !b) return false;
  return getOpeningIdentityKey(a) === getOpeningIdentityKey(b);
}

function pickDistinctOpening(candidates, used = []) {
  return candidates.find(
    (opening) =>
      opening &&
      getOpeningIdentityKey(opening) &&
      !used.some((usedOpening) => isSameOpeningContext(opening, usedOpening))
  );
}

function canTreatAsRepertoireOpening(opening) {
  if (!opening) return false;
  const context = getOpeningContext(opening);
  const signal = getOpeningSignal(opening);
  return context.canRecommend && signal.canBePrimary;
}

function commandVerdictClass(verdict) {
  const lower = String(verdict || "").toLowerCase();
  if (lower.includes("keep") || lower.includes("main") || lower.includes("reliable")) return "verdict keep";
  if (lower.includes("too little") || lower.includes("interesting") || lower.includes("early pattern") || lower.includes("low confidence")) return "verdict test";
  if (lower.includes("avoid")) return "verdict improve";
  if (lower.includes("review") || lower.includes("improve") || lower.includes("unstable")) return "verdict improve";
  return "verdict test";
}

function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === "light";

  return (
    <button
      className="themeToggle"
      type="button"
      onClick={onToggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      <span>{isLight ? "Light" : "Dark"}</span>
      <strong>{isLight ? "☀" : "☾"}</strong>
    </button>
  );
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
  "queen's gambit declined",
  "queen's gambit accepted",
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
      black_vs_d4: "played as Black vs 1.d4",
      black_vs_other: "played as Black vs other first moves",
      black_vs_d4_other: "played as Black vs 1.d4 / other first moves",
      unknown_mixed: "unknown / mixed",
    }[context] || "unknown / mixed"
  );
}

const BLACK_REPERTOIRE_CONTEXTS = new Set([
  "black_vs_e4",
  "black_vs_d4",
  "black_vs_other",
  "black_vs_d4_other",
]);

function normalizeBlackRepertoireContext(context, item = null) {
  if (context !== "black_vs_d4_other") return context;

  const firstMoveBucket = firstMoveBucketForOpening(item || {});
  return firstMoveBucket && firstMoveBucket !== "black_vs_e4"
    ? firstMoveBucket
    : "black_vs_d4";
}

function itemContext(item, fallback = "unknown_mixed") {
  const raw =
    item?.context ||
    item?.repertoireContext ||
    item?.repertoire_context ||
    item?.category ||
    "";
  const context = String(raw).trim();

  if (["played_as_white", "unknown_mixed"].includes(context)) {
    return context;
  }

  const firstMoveBucket = firstMoveBucketForOpening(item);

  if (BLACK_REPERTOIRE_CONTEXTS.has(context)) {
    return normalizeBlackRepertoireContext(context, item);
  }

  const side = String(getOpeningSide(item)).toLowerCase();

  if (side.includes("white")) return "played_as_white";
  if (side.includes("black")) {
    if (firstMoveBucket) return firstMoveBucket;
    return fallback === "played_as_white"
      ? "unknown_mixed"
      : normalizeBlackRepertoireContext(fallback, item);
  }

  if (fallback !== "played_as_white" && firstMoveBucket) return firstMoveBucket;

  return normalizeBlackRepertoireContext(fallback, item);
}

function contextIsCompatible(name, context) {
  const hint = openingNameColourHint(name);

  if (context === "played_as_white") return hint !== "black";
  if (BLACK_REPERTOIRE_CONTEXTS.has(context)) return hint !== "white";

  return false;
}

function normalizeRecommendationItem(item, fallbackContext = "unknown_mixed") {
  const source = typeof item === "string" ? { name: item } : item || {};
  const name = getOpeningName(source);
  const context = itemContext(source, fallbackContext);
  const compatible = contextIsCompatible(name, context);
  const safeContext = compatible ? context : "unknown_mixed";
  const normalizedBase = {
    ...source,
    name,
    context: safeContext,
    contextLabel: contextLabel(safeContext),
  };

  return {
    ...normalizedBase,
    confidenceLabel: source.confidenceLabel || getOpeningConfidence(normalizedBase),
    confidenceReason: source.confidenceReason || getOpeningConfidenceReason(normalizedBase),
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
      black_vs_d4: "black_vs_d4",
      black_vs_other: "black_vs_other",
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
    ? recommendations.sections.flatMap((section) => {
        const items = normalizeRecommendationSection(section.items, section.key);

        if (section.key !== "black_vs_d4_other") {
          return [
            {
              key: section.key,
              title: section.title,
              items,
            },
          ];
        }

        return [
          {
            key: "black_vs_d4",
            title: "Black vs 1.d4",
            items: items.filter((item) => item.context === "black_vs_d4"),
          },
          {
            key: "black_vs_other",
            title: "Black vs other first moves",
            items: items.filter((item) => item.context === "black_vs_other"),
          },
        ];
      })
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
    recommendations.black_vs_d4 ||
      recommendations.blackVsD4Detailed ||
      recommendations.blackVsD4 ||
      [],
    "black_vs_d4"
  );
  const blackVsOther = normalizeRecommendationSection(
    recommendations.black_vs_other ||
      recommendations.blackVsOtherDetailed ||
      recommendations.blackVsOther ||
      [],
    "black_vs_other"
  );
  const legacyBlackVsD4Other = normalizeRecommendationSection(
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
      key: "black_vs_d4",
      title: "Black vs 1.d4",
      items: [...blackVsD4, ...legacyBlackVsD4Other.filter((item) => item.context === "black_vs_d4")],
    },
    {
      key: "black_vs_other",
      title: "Black vs other first moves",
      items: [...blackVsOther, ...legacyBlackVsD4Other.filter((item) => item.context === "black_vs_other")],
    },
    { key: "experimental_rare", title: "Experimental / rare openings", items: experimental },
    { key: "too_little_data", title: "Too little data", items: tooLittle },
  ];
}

const REPERTOIRE_SECTION_ORDER = [
  {
    key: "white_repertoire",
    title: "As White",
    context: "played_as_white",
    empty: "No clean White repertoire signal yet.",
    roleLabel: "Main opening or setup",
  },
  {
    key: "black_vs_e4",
    title: "As Black vs 1.e4",
    context: "black_vs_e4",
    empty: "No clean Black response to 1.e4 yet.",
    roleLabel: "Main defence",
  },
  {
    key: "black_vs_d4",
    title: "As Black vs 1.d4",
    context: "black_vs_d4",
    empty: "No clean Black response to 1.d4 yet.",
    roleLabel: "Main defence",
  },
  {
    key: "black_vs_other",
    title: "As Black vs other first moves",
    context: "black_vs_other",
    empty: "No clean Black response to 1.c4, 1.Nf3, or other starts yet.",
    roleLabel: "Main setup",
  },
];

const REPERTOIRE_BUCKETS = [
  { key: "bestFit", title: "Best fit" },
  { key: "needsReview", title: "Needs review" },
  { key: "risky", title: "Risky / unstable" },
  { key: "notEnoughData", title: "Not enough data" },
];

function repertoireBucketForOpening(opening) {
  const signal = getOpeningSignal(opening);
  const score = getWinRate(opening);
  const games = getOpeningGames(opening);
  const verdict = String(
    opening?.verdict ||
      opening?.fitVerdict ||
      opening?.recommendation ||
      ""
  ).toLowerCase();

  if (
    opening?.forceNotEnoughData ||
    !signal.canBePrimary ||
    opening?.context === "unknown_mixed" ||
    games < 2
  ) {
    return "notEnoughData";
  }

  if (
    verdict.includes("avoid") ||
    verdict.includes("risky") ||
    verdict.includes("unstable") ||
    score < 40
  ) {
    return "risky";
  }

  if (
    verdict.includes("review") ||
    verdict.includes("improve") ||
    verdict.includes("mixed") ||
    score < 55
  ) {
    return "needsReview";
  }

  return "bestFit";
}

function uniqueOpeningsByNameAndContext(items) {
  const seen = new Set();
  const result = [];

  items.forEach((item) => {
    const name = getOpeningName(item);
    const context = item?.context || itemContext(item);
    const key = `${String(name).toLowerCase()}::${context}`;

    if (!name || isUnknownOpeningName(name) || seen.has(key)) return;

    seen.add(key);
    result.push(item);
  });

  return result;
}

function firstMoveBucketForOpening(opening) {
  const text = String(
    opening?.context ||
      opening?.repertoireContext ||
      opening?.contextLabel ||
      opening?.firstMove ||
      opening?.first_move ||
      opening?.opponentFirstMove ||
      opening?.opponent_first_move ||
      opening?.name ||
      ""
  ).toLowerCase();
  const cleanFirstMove = String(
    opening?.firstWhiteMove ||
      opening?.first_white_move ||
      opening?.whiteFirstMove ||
      opening?.white_first_move ||
      opening?.opponentFirstMove ||
      opening?.opponent_first_move ||
      opening?.firstMove ||
      opening?.first_move ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(/^1\./, "");

  if (cleanFirstMove === "e4") return "black_vs_e4";

  if (cleanFirstMove === "d4") return "black_vs_d4";

  if (["c4", "nf3", "g3", "b3"].includes(cleanFirstMove)) return "black_vs_other";

  if (text.includes("black_vs_e4") || text.includes("vs 1.e4") || text.includes("vs e4")) {
    return "black_vs_e4";
  }

  if (
    (text.includes("black_vs_d4") && !text.includes("black_vs_d4_other")) ||
    text.includes("vs 1.d4") ||
    text.includes("vs d4") ||
    text.includes("queen's gambit") ||
    text.includes("dutch") ||
    text.includes("nimzo") ||
    text.includes("king's indian") ||
    text.includes("queen's indian") ||
    text.includes("slav") ||
    text.includes("benoni") ||
    text.includes("benko") ||
    text.includes("englund")
  ) {
    return "black_vs_d4";
  }

  if (
    text.includes("black_vs_other") ||
    text.includes("other first") ||
    text.includes("vs 1.c4") ||
    text.includes("vs c4") ||
    text.includes("1.c4") ||
    text.includes("vs 1.nf3") ||
    text.includes("vs nf3") ||
    text.includes("1.nf3") ||
    text.includes("english opening") ||
    text.includes("reti") ||
    text.includes("réti") ||
    text.includes("bird's opening") ||
    text.includes("polish opening")
  ) {
    return "black_vs_other";
  }

  return "";
}

function buildRepertoireReportSections(data) {
  const colourSections = getColourAwareRecommendationSections(data);
  const findSectionItems = (key) =>
    colourSections.find((section) => section.key === key)?.items || [];
  const sectionFallbackItems = (section) => {
    const bestOpenings = Array.isArray(data?.best_openings) ? data.best_openings : [];
    const topOpenings = Array.isArray(data?.top_openings) ? data.top_openings : [];
    const preferredWhite = Array.isArray(data?.preferred_white) ? data.preferred_white : [];
    const preferredBlack = Array.isArray(data?.preferred_black) ? data.preferred_black : [];
    const candidates = [
      ...(section.key === "white_repertoire" ? preferredWhite : []),
      ...(section.key !== "white_repertoire" ? preferredBlack : []),
      ...bestOpenings,
      ...topOpenings,
    ];

    return candidates.filter((item) => {
      const name = getOpeningName(item);
      const explicitContext = itemContext(item, "unknown_mixed");
      const bucket = firstMoveBucketForOpening(item);
      const hint = openingNameColourHint(name);
      const side = String(getOpeningSide(item)).toLowerCase();

      if (!contextIsCompatible(name, section.context)) return false;
      if (explicitContext === section.context) return true;

      if (section.context === "played_as_white") return hint === "white";
      if (section.context === "black_vs_e4") {
        return (hint === "black" || side.includes("black")) && bucket === "black_vs_e4";
      }
      if (section.context === "black_vs_d4") {
        return (hint === "black" || side.includes("black")) && bucket === "black_vs_d4";
      }
      return (hint === "black" || side.includes("black")) && bucket === "black_vs_other";
    });
  };

  return REPERTOIRE_SECTION_ORDER.map((section) => {
    const uncertainItems = findSectionItems("too_little_data").filter((item) => {
      const context = itemContext(item);
      const hint = openingNameColourHint(getOpeningName(item));

      if (context === section.context) return true;
      if (section.context === "played_as_white") return hint === "white";
      if (section.context === "black_vs_e4") {
        return hint === "black" && firstMoveBucketForOpening(item) === "black_vs_e4";
      }
      if (section.context === "black_vs_d4") {
        return hint === "black" && firstMoveBucketForOpening(item) === "black_vs_d4";
      }
      return hint === "black" && firstMoveBucketForOpening(item) === "black_vs_other";
    });
    const sectionItems = normalizeRecommendationSection(
      findSectionItems(section.key),
      section.context
    );
    const rareItems = normalizeRecommendationSection(
      findSectionItems("experimental_rare").filter((item) => itemContext(item) === section.context),
      section.context
    );
    const notEnoughItems = normalizeRecommendationSection(
      uncertainItems.map((item) => ({
        ...item,
        context: section.context,
        forceNotEnoughData: true,
      })),
      section.context
    );
    const fallbackItems = normalizeRecommendationSection(
      sectionFallbackItems(section),
      section.context
    );
    const items = uniqueOpeningsByNameAndContext([
      ...sectionItems,
      ...rareItems,
      ...notEnoughItems,
      ...fallbackItems,
    ]).sort((a, b) => {
      const scoreDelta = getWinRate(b) - getWinRate(a);
      if (scoreDelta) return scoreDelta;
      return getOpeningGames(b) - getOpeningGames(a);
    });
    const buckets = {
      bestFit: [],
      needsReview: [],
      risky: [],
      notEnoughData: [],
    };

    items.forEach((item) => {
      buckets[repertoireBucketForOpening(item)].push(item);
    });

    return {
      ...section,
      buckets,
      totalItems: items.length,
      primary: buckets.bestFit[0] || buckets.needsReview[0] || buckets.risky[0] || null,
    };
  });
}

function sectionHealth(section) {
  if (section?.buckets?.bestFit?.length) return "stable";
  if (section?.buckets?.needsReview?.length) return "needs review";
  if (section?.buckets?.risky?.length) return "unstable";
  return "not enough evidence";
}

function repertoireShapeSummary(sections) {
  const white = sections.find((section) => section.key === "white_repertoire");
  const e4 = sections.find((section) => section.key === "black_vs_e4");
  const d4 = sections.find((section) => section.key === "black_vs_d4");
  const other = sections.find((section) => section.key === "black_vs_other");
  const study = sections.find((section) => section.buckets.risky.length || section.buckets.needsReview.length);

  const whiteHealth = sectionHealth(white);
  const e4Health = sectionHealth(e4);
  const d4Health = sectionHealth(d4);
  const otherHealth = sectionHealth(other);

  return {
    text: `Your White repertoire looks ${whiteHealth}, your Black responses to 1.e4 look ${e4Health}, your 1.d4 defences show ${d4Health}, and other first moves look ${otherHealth}.`,
    white: white?.primary?.name || "Needs more White games",
    e4: e4?.primary?.name || "Needs more games against 1.e4",
    d4: d4?.primary?.name || "Needs more games against 1.d4",
    other: other?.primary?.name || "Needs more games against other starts",
    study:
      study?.buckets.risky[0]?.name ||
      study?.buckets.needsReview[0]?.name ||
      "Collect more colour-specific games before changing the repertoire",
  };
}

function colourAwareBucketCopy(sectionKey, bucketKey) {
  if (sectionKey === "white_repertoire") {
    return {
      bestFit: "As White, this looks like a strong practical fit.",
      needsReview: "As White, this is playable but worth reviewing before you build around it.",
      risky: "As White, this is producing unstable results.",
      notEnoughData: "As White, there is not enough evidence yet.",
    }[bucketKey];
  }

  if (sectionKey === "black_vs_e4") {
    return {
      bestFit: "Against 1.e4, this defence looks like your best current fit.",
      needsReview: "Against 1.e4, this defence is producing mixed results.",
      risky: "Against 1.e4, this defence looks risky or unstable.",
      notEnoughData: "Against 1.e4, there is not enough evidence yet.",
    }[bucketKey];
  }

  if (sectionKey === "black_vs_d4") {
    return {
      bestFit: "Against 1.d4, this defence looks like your best current fit.",
      needsReview: "Against 1.d4, this defence needs review.",
      risky: "Against 1.d4, this defence looks risky or unstable.",
      notEnoughData: "Against 1.d4, there is not enough evidence yet.",
    }[bucketKey];
  }

  return {
    bestFit: "Against other first moves, this setup looks like your best current fit.",
    needsReview: "Against other first moves, this setup needs review.",
    risky: "Against other first moves, this setup looks risky or unstable.",
    notEnoughData: "Against other first moves, there is not enough evidence yet.",
  }[bucketKey];
}

function confidencePriority(opening) {
  const label = String(getOpeningConfidence(opening)).toLowerCase();
  const signal = getOpeningSignal(opening);

  if (label.includes("high") || signal.tier === "strong") return 3;
  if (label.includes("medium") || signal.tier === "medium") return 2;
  return 0;
}

function evidenceSort(a, b) {
  const confidenceDelta = confidencePriority(b) - confidencePriority(a);
  if (confidenceDelta) return confidenceDelta;
  return getOpeningGames(b) - getOpeningGames(a);
}

function roleNameForAction(opening) {
  const context = itemContext(opening);

  if (context === "played_as_white") return "as White";
  if (context === "black_vs_e4") return "as Black vs 1.e4";
  if (context === "black_vs_d4") return "as Black vs 1.d4";
  if (context === "black_vs_other") return "as Black vs other first moves";
  return "in your repertoire";
}

function buildOpeningFitVerdict(fitData, sections = []) {
  const reliableOpenings = [...(fitData?.scoredOpenings || [])]
    .filter((opening) => confidencePriority(opening) >= 2 && canTreatAsRepertoireOpening(opening))
    .sort(evidenceSort);
  const rolePrimaries = sections
    .map((section) => getRolePrimaryOpening(section))
    .filter(Boolean)
    .filter((opening) => confidencePriority(opening) >= 2 && canTreatAsRepertoireOpening(opening))
    .sort(evidenceSort);
  const evidenceOpenings = uniqueOpeningsByNameAndContext([
    ...rolePrimaries,
    ...reliableOpenings,
  ]).sort(evidenceSort);
  const keep =
    evidenceOpenings.find((opening) => {
      const label = String(opening.fitVerdict || opening.verdict || "").toLowerCase();
      return opening.fitCategory === "keep" || label.includes("keep") || getWinRate(opening) >= 55;
    }) || null;
  const improve =
    evidenceOpenings.find((opening) => {
      if (keep && isSameOpeningContext(opening, keep)) return false;
      const label = String(opening.fitVerdict || opening.verdict || "").toLowerCase();
      return (
        ["review", "improve"].includes(opening.fitCategory) ||
        label.includes("improve") ||
        label.includes("review") ||
        getWinRate(opening) < 55
      );
    }) || null;
  const risky =
    evidenceOpenings.find((opening) => {
      if ((keep && isSameOpeningContext(opening, keep)) || (improve && isSameOpeningContext(opening, improve))) {
        return false;
      }
      const name = getOpeningName(opening).toLowerCase();
      return name.includes("gambit") || opening.fitSeverity === "danger" || getWinRate(opening) < 40;
    }) || null;

  const whiteSection = sections.find((section) => section.key === "white_repertoire");
  const blackSections = sections.filter((section) => section.key !== "white_repertoire");
  const whitePrimary = getRolePrimaryOpening(whiteSection);
  const blackPrimary = blackSections
    .map((section) => getRolePrimaryOpening(section))
    .filter(Boolean)
    .filter((opening) => confidencePriority(opening) >= 2)
    .sort(evidenceSort)[0];
  const whiteReliable = whitePrimary && confidencePriority(whitePrimary) >= 2;
  const blackReliable = blackPrimary && confidencePriority(blackPrimary) >= 2;
  const whiteName = whiteReliable ? getOpeningName(whitePrimary) : "one main White system";
  const blackName = blackReliable ? getOpeningName(blackPrimary) : "one Black defence";
  const whiteScore = whiteReliable ? getWinRate(whitePrimary) : null;
  const blackScore = blackReliable ? getWinRate(blackPrimary) : null;
  const opportunity =
    whiteReliable && blackReliable && whiteScore < blackScore
      ? `Your biggest opportunity is to stabilise ${whiteName} as White instead of switching plans.`
      : improve
        ? `Your biggest opportunity is to clean up ${getOpeningName(improve)} ${roleNameForAction(improve)}.`
        : "Your biggest opportunity is to pick one repeatable White system and one repeatable Black defence long enough for the data to become clear.";
  const profile = blackReliable
    ? `You are getting your clearest repertoire signal from ${blackName} ${roleNameForAction(blackPrimary)}. ${whiteReliable ? `${whiteName} is your main White signal, but it needs a more consistent plan.` : "Your White repertoire is less clear and needs one main system."} ${opportunity}`
    : `${whiteReliable ? `${whiteName} is your clearest White-side signal.` : "Your report does not yet show a fully stable opening anchor."} ${opportunity}`;

  const actions = [];

  if (keep) {
    actions.push(`Keep playing ${getOpeningName(keep)} ${roleNameForAction(keep)}.`);
  }

  if (improve) {
    actions.push(`Improve your ${getOpeningName(improve)} move order ${roleNameForAction(improve)}.`);
  }

  if (risky) {
    actions.push(`Stop experimenting with ${getOpeningName(risky)} until your results stabilise.`);
  }

  const fallbackActions = [
    whiteReliable
      ? `Make ${whiteName} your main White system for the next focused block.`
      : "Choose one main White system and stop switching for the next focused block.",
    blackReliable
      ? `Keep ${blackName} as your main Black reference point.`
      : "Choose one main Black defence and repeat it long enough to build a reliable sample.",
    "Do not make major repertoire changes from low-confidence opening samples.",
  ];

  fallbackActions.forEach((action) => {
    if (actions.length < 3 && !actions.includes(action)) actions.push(action);
  });

  return {
    profile,
    actions: actions.slice(0, 3),
    evidenceNote: evidenceOpenings.length
      ? "Top actions use high-confidence evidence first, then medium-confidence evidence. Low-confidence samples stay out of major recommendations."
      : "There is not enough medium-confidence evidence yet, so the advice focuses on consistency before repertoire changes.",
  };
}

function weakDataReason(opening) {
  const context = getOpeningContext(opening);
  const signal = getOpeningSignal(opening);
  const games = getOpeningGames(opening);

  if (context.type === "mixed" || context.type === "faced" || itemContext(opening) === "unknown_mixed") {
    return "context unclear";
  }

  if (games <= 2 || signal.tier === "tooLittle" || signal.tier === "none") {
    return "sample too small";
  }

  if (games <= 7 || signal.tier === "low") {
    return "early signal only";
  }

  return "not a clear repertoire signal";
}

function buildInterestingButThinOpenings(data, fitData, sections = []) {
  const recommendations =
    data?.opening_recommendations ||
    data?.openingRecommendations ||
    data?.recommendedOpenings ||
    {};
  const recommendationItems = [
    ...(Array.isArray(recommendations.experimental_rare) ? recommendations.experimental_rare : []),
    ...(Array.isArray(recommendations.experimentalRare) ? recommendations.experimentalRare : []),
    ...(Array.isArray(recommendations.too_little_data) ? recommendations.too_little_data : []),
    ...(Array.isArray(recommendations.tooLittleData) ? recommendations.tooLittleData : []),
  ];
  const bucketItems = sections.flatMap((section) => section?.buckets?.notEnoughData || []);
  const scoredItems = (fitData?.scoredOpenings || []).filter((opening) => {
    const games = getOpeningGames(opening);
    const context = getOpeningContext(opening);
    const signal = getOpeningSignal(opening);

    return (
      games >= 1 &&
      (games <= 7 ||
        !signal.canBePrimary ||
        context.type === "mixed" ||
        context.type === "faced" ||
        itemContext(opening) === "unknown_mixed")
    );
  });

  return uniqueOpeningsByNameAndContext([
    ...bucketItems,
    ...recommendationItems,
    ...scoredItems,
  ])
    .filter((opening) => {
      const games = getOpeningGames(opening);
      return games >= 1 && !isUnknownOpeningName(getOpeningName(opening));
    })
    .sort((a, b) => {
      const confidenceDelta = confidencePriority(b) - confidencePriority(a);
      if (confidenceDelta) return confidenceDelta;
      return getOpeningGames(b) - getOpeningGames(a);
    })
    .slice(0, 8)
    .map((opening) => ({
      ...opening,
      weakDataReason: weakDataReason(opening),
    }));
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

function pushUniqueReason(reasons, text) {
  if (text && !reasons.includes(text)) reasons.push(text);
}

function getOpeningLossRate(opening) {
  const games = getOpeningGames(opening);
  const losses = getOpeningLosses(opening);

  if (!games) return null;
  return Math.round((losses / games) * 100);
}

function getOpeningFitReasonBullets(opening, data, smartVerdict, playerStyle) {
  const reasons = [];
  const name = getOpeningName(opening);
  const tags = getOpeningTags(name);
  const games = getOpeningGames(opening);
  const score = getWinRate(opening);
  const lossRate = getOpeningLossRate(opening);
  const wins = getOpeningWins(opening);
  const draws = getOpeningDraws(opening);
  const losses = getOpeningLosses(opening);
  const context = itemContext(opening);
  const signal = getOpeningSignal(opening);
  const levelProfile = getSmartPlayerLevelProfile(data);
  const category = smartVerdict?.category || "";
  const verdictLabel = String(smartVerdict?.label || opening?.fitVerdict || opening?.verdict || "").toLowerCase();
  const isPositive = category === "keep" || verdictLabel.includes("keep") || score >= 55;
  const isConcern = !isPositive || ["review", "improve", "avoid"].includes(category);

  if (!signal.canBePrimary || games <= 7) {
    pushUniqueReason(
      reasons,
      `${games} game${games === 1 ? "" : "s"} is still a small sample, so this should be treated as a watch signal rather than a main repertoire verdict.`
    );
  }

  if (isPositive) {
    if (tags.includes("solid")) {
      pushUniqueReason(reasons, "Solid structure: this opening tends to reach steadier pawn structures with fewer forced early tactics.");
    }

    if (tags.includes("system") || tags.includes("solid") || tags.includes("classical")) {
      pushUniqueReason(reasons, "Simple plans: the setup gives you repeatable development patterns instead of asking you to solve a new sharp position every game.");
    }

    if (context.startsWith("black") && score >= 52) {
      pushUniqueReason(reasons, `Strong results as Black: your imported games show a ${score}% score in this Black-side role.`);
    }

    if (lossRate !== null && lossRate <= 32 && games >= 5) {
      pushUniqueReason(reasons, `Low loss rate: only ${lossRate}% of the sample is losses, which suggests you are reaching playable middlegames more often.`);
    }

    if (games >= 8 && confidencePriority(opening) >= 2) {
      pushUniqueReason(reasons, `Consistent results across multiple games: ${games} games gives this signal more weight than a one-off result.`);
    }

    if (wins > losses && draws > 0) {
      pushUniqueReason(reasons, "Good conversion from balanced positions: when games stay close enough to produce draws, your wins still outnumber your losses.");
    }

    if (["beginner", "developing", "intermediate"].some((word) => String(levelProfile.label || levelProfile.level || "").toLowerCase().includes(word)) || getProfileRating(data) < 1600) {
      pushUniqueReason(reasons, "Good match for your current rating level: the plans are clear enough to repeat without needing heavy memorised theory.");
    }

    if (playerStyle?.title && tags.some((tag) => String(playerStyle.title).toLowerCase().includes(tag))) {
      pushUniqueReason(reasons, `Style match: it lines up with your ${playerStyle.title.toLowerCase()} profile from the rest of your opening results.`);
    }
  }

  if (isConcern) {
    if (lossRate !== null && lossRate >= 45 && games >= 5) {
      pushUniqueReason(reasons, `Too many losses: ${lossRate}% of this sample is losses, so the opening is not reliably getting you into safe middlegames yet.`);
    }

    if ((tags.includes("sharp") || tags.includes("attacking")) && score < 50) {
      pushUniqueReason(reasons, `Low score in sharp positions: this opening often creates tactical middlegames, and your current score there is ${score}%.`);
    }

    if (name.toLowerCase().includes("gambit") && score < 50) {
      pushUniqueReason(reasons, "Poor results after gambit positions: the compensation is not showing up clearly in your results yet.");
    }

    if (games >= 8 && score < 50) {
      pushUniqueReason(reasons, "Repeated early move-order issues are likely: the problem appears across multiple games, not just one unlucky result.");
    }

    if ((tags.includes("sharp") || name.toLowerCase().includes("gambit")) && lossRate !== null && lossRate >= 40) {
      pushUniqueReason(reasons, "The opening is creating difficult middlegames for you: the loss rate is high in positions that demand precise early choices.");
    }

    if (context === "played_as_white" && score < 50 && games >= 5) {
      pushUniqueReason(reasons, "Your White repertoire is less stable here: the score suggests the setup needs a clearer move order before you build around it.");
    }
  }

  if (!reasons.length) {
    pushUniqueReason(
      reasons,
      `${games} game${games === 1 ? "" : "s"} with a ${score}% score gives OpeningFit a starting point, but not enough detail for a deeper fit claim yet.`
    );
  }

  return reasons.slice(0, 4);
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
    rating >= 2400 ||
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
    rating >= 1800 ||
    level.includes("advanced") ||
    level.includes("club") ||
    level.includes("strong")
  ) {
    return "club";
  }

  if (rating >= 1400 || level.includes("intermediate")) return "club";

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

  if (!getOpeningSignal({ games, score: 50 }).canBePrimary) return "Not enough context to judge";

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

function getDataFirstVerdict(opening, data) {
  const winRate = getWinRate(opening);
  const signal = getOpeningSignal(opening);
  const games = getOpeningGames(opening);

  if (games <= 2 || signal.badge === "Too little data") return "Too little data — not used for verdict";
  if (games <= 7 || signal.badge === "Low confidence") return "Interesting signal — Low confidence";
  if (isPublicReportMode(data)) {
    const publicLabel = publicAwareVerdict(opening?.verdict || opening?.fitVerdict, data, games);
    return `${publicLabel} — ${getOpeningConfidence(opening)}`;
  }
  if (winRate >= 55) return `Keep — ${getOpeningConfidence(opening)}`;
  return `Improve — ${getOpeningConfidence(opening)}`;
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
  const level = getSmartPlayerLevelProfile(data).level;
  const levelCopy = getLevelToneCopy(level);

  if (!getOpeningSignal(opening).canBePrimary || sectionKey === "too_little_data" || opening?.context === "unknown_mixed") {
    return `Next action: collect more games before changing anything in ${name}.`;
  }

  if (publicMode) {
    return `Next action: compare ${name} by time control, opponent pool, and game context.`;
  }

  if (isAdvancedOrStrongerLevel(level)) {
    return `Next action: ${levelCopy.action.replace(/\.$/, "")} in ${name}.`;
  }

  if (sectionKey === "white_repertoire") {
    return `Next action: review your last 3 ${name} games as White and write one move-10 plan.`;
  }

  if (sectionKey === "black_vs_e4") {
    return `Next action: review your last 3 ${name} games vs 1.e4 and fix one repeated branch.`;
  }

  if (sectionKey === "black_vs_d4") {
    return `Next action: review your last 3 ${name} games vs 1.d4.`;
  }

  if (sectionKey === "black_vs_other" || sectionKey === "black_vs_d4_other") {
    return `Next action: review your last 3 ${name} games vs 1.c4, 1.Nf3, or other first moves.`;
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
  if (count >= 20) return "high";
  if (count >= 8) return "medium";
  if (count >= 3) return "low";
  if (count >= 1) return "tooLittle";
  return "none";
}

function getOpeningConfidenceReason(opening) {
  const games = getOpeningGames(opening);
  const signal = getOpeningSignal(opening);

  if (signal?.explanation) return signal.explanation;
  if (games >= 20) return "20+ games in this opening or family.";
  if (games >= 8) return "8-19 games: useful sample, but still worth confirming.";
  if (games >= 3) return "3-7 games: early pattern only.";
  if (games >= 1) return "1-2 games: too little data for a verdict.";
  return "Game count unavailable.";
}

function baseConfidenceVerdict(opening, data, fallback = "") {
  const games = getOpeningGames(opening);
  const signal = getOpeningSignal(opening);
  const label = String(fallback || opening?.fitVerdict || opening?.verdict || "").toLowerCase();

  if (games <= 2 || signal.badge === "Too little data") return "Too little data";
  if (games <= 7 || signal.badge === "Low confidence") return "Interesting signal";
  if (label.includes("keep") || label.includes("main") || label.includes("reliable")) return "Keep";
  if (label.includes("improve") || label.includes("review") || label.includes("avoid") || label.includes("unstable") || label.includes("underperform")) return "Improve";

  const score = getWinRate(opening);
  if (score >= 55) return "Keep";
  return "Improve";
}

function confidenceVerdictLabel(opening, data, fallback = "") {
  const base = baseConfidenceVerdict(opening, data, fallback);
  const confidence = getOpeningConfidence(opening);

  if (base === "Too little data") return "Too little data — not used for verdict";
  return `${base} — ${confidence}`;
}

function confidenceRowText(opening) {
  const games = getOpeningGames(opening);
  const score = getWinRate(opening);
  return `${games} game${games === 1 ? "" : "s"} analysed · ${score}% score · ${getOpeningConfidence(opening)}. ${getOpeningConfidenceReason(opening)}`;
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
  const signal = getOpeningSignal(opening);
  const isMainWeapon = index <= 2 && signal.tier === "strong";
  const largeSample = sampleTier === "high";
  const frequentlyPlayed = isMainWeapon || games >= 10;
  const baseline = getPlayerBaselineScore(data);
  const levelProfile = getSmartPlayerLevelProfile(data);
  const level = levelProfile.level;
  const levelCopy = getLevelToneCopy(level);
  const advancedOrHigher = isAdvancedOrStrongerLevel(level);
  const masterLevel = isMasterLevel(level);
  const highRatedPlayer = advancedOrHigher || ["club", "strong", "elite"].includes(tier);
  const belowBaseline = winRate < baseline;
  const slightlyBelowBaseline = belowBaseline && baseline - winRate <= 8;
  const rating = getProfileRating(data);
  const opposition = getAverageOppositionRating(opening, data);
  const strongOpposition =
    rating && opposition ? opposition >= Math.max(1800, rating - 100) : false;
  const highRatedRepertoireMessage =
    masterLevel
      ? "This looks like a serious part of the repertoire. At your level, this is likely about move-order precision, opponent preparation, or a recent trend in one branch, not basic understanding."
      : "This may be a practical review area. Recent results are below the usual baseline, but this is more likely a branch or structure issue than a reason to abandon the opening.";

  if (games <= 2 || signal.badge === "Too little data") {
    return {
      label: "Too little data",
      category: "neutral",
      tone: "neutral",
      severity: "neutral",
      message: "Only 1-2 games. Not enough data for a full verdict.",
    };
  }

  if (games <= 7 || signal.badge === "Low confidence") {
    return {
      label: "Interesting signal",
      category: "neutral",
      tone: "neutral",
      severity: "neutral",
      message:
        "Early pattern from 3-7 games. Treat this as a watch signal, not a firm keep/improve/avoid verdict.",
    };
  }

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

  if (signal.tier === "none" || signal.tier === "low") {
    return {
      label: publicMode ? "Not enough context to judge" : "Experimental / not enough data",
      category: "neutral",
      tone: "neutral",
      severity: "neutral",
      message:
        publicMode
          ? "This is too small a recent online sample for a hard verdict. It may be an experiment, a content game, or a one-off opponent-specific choice."
          : "Too few games to make a firm call. Treat this as a trend to watch, not a recommendation.",
    };
  }

  if (masterLevel && frequentlyPlayed && games >= 10) {
    return {
      label: winRate >= 45 ? "Main weapon" : levelCopy.lowResultLabel,
      category: winRate >= 45 ? "keep" : "review",
      tone: winRate >= 45 ? "positive" : "warning",
      severity: winRate >= 45 ? "positive" : "warning",
      message: highRatedRepertoireMessage,
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

    if (largeSample && canGiveAvoidVerdict({ level, games, score: winRate })) {
      return {
        label: levelCopy.lowResultLabel,
        category: "review",
        tone: "warning",
        severity: "warning",
        message:
          "This is a large sample with unusually poor recent results. Even then, for a master-level player this should be treated as a trend and preparation audit before calling the opening a bad choice.",
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

  if (isMainWeapon && getOpeningSignal(opening).tier === "strong" && winRate >= 42) {
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
      category: advancedOrHigher ? "review" : "improve",
      tone: "warning",
      severity: "warning",
      message:
        advancedOrHigher
          ? levelCopy.reason
          : "This does not mean the whole opening is bad. It means one branch, move order, or opening-to-middlegame transition is likely costing points.",
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
    label: publicMode ? "Recent underperformer" : "Improve",
    category: "review",
    tone: "warning",
    severity: "warning",
    message:
      publicMode
        ? "This is a lower-scoring recent online sample. Treat it as trend evidence only, not a judgement of the player's opening knowledge."
        : advancedOrHigher
          ? levelCopy.reason
          : "The data points to a recurring problem inside this opening. Review the damaging line first before deciding whether the whole opening should leave the repertoire.",
  };
}

function getOpeningExplanation(opening, data, index = 0) {
  const name = getOpeningName(opening);
  const smartVerdict = getSmartOpeningVerdict(opening, data, index);

  if (isUnknownOpeningName(name)) {
    return smartVerdict.message;
  }

  if (smartVerdict.category === "keep") {
    return `${name} fits your current repertoire because the imported games show a repeatable, evidence-backed pattern.`;
  }

  if (smartVerdict.category === "review" || smartVerdict.category === "improve" || smartVerdict.category === "avoid") {
    return `${name} is not a clean fit yet because the results point to a specific recurring problem rather than a stable repertoire weapon.`;
  }

  return smartVerdict.message || `${name} needs more evidence before OpeningFit can make a strong fit claim.`;
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
    const context = getOpeningContext(opening);
    const key = `${name.toLowerCase()}::${context.type}::${context.detail}`;

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
      .map((opening, index) => {
        const context = getOpeningContext(opening);
        return [`${getOpeningName(opening).toLowerCase()}::${context.type}::${context.detail}`, index];
      })
  );

  const scoredOpenings = cleanOpenings
    .map((opening) => {
      const score = calculateOpeningFitScore(opening, playerStyle);
      const context = getOpeningContext(opening);
      const rank =
        volumeRank.get(`${getOpeningName(opening).toLowerCase()}::${context.type}::${context.detail}`) ??
        99;
      const smartVerdict = getSmartOpeningVerdict(opening, data, rank);
      const signal = getOpeningSignal(opening);
      const fitReasonBullets = getOpeningFitReasonBullets(opening, data, smartVerdict, playerStyle);
      const fitScore =
        signal.tier === "low" || signal.tier === "none"
          ? Math.min(score, 54)
          : smartVerdict.label === "Main weapon" ||
              smartVerdict.label === "Reliable choice"
            ? Math.max(score, signal.tier === "strong" ? 78 : 68)
            : smartVerdict.category === "review"
              ? Math.max(score, 58)
              : score;

      return {
        ...opening,
        fitScore,
        fitVerdict: smartVerdict.label,
        fitDisplayVerdict: confidenceVerdictLabel(opening, data, smartVerdict.label),
        fitCategory: smartVerdict.category,
        fitTone: smartVerdict.tone,
        fitSeverity: smartVerdict.severity,
        fitConfidence: signal.badge,
        fitConfidenceReason: getOpeningConfidenceReason(opening),
        fitReasonBullets,
        fitSignalTier: signal.tier,
        fitSignalExplanation: signal.explanation,
        fitSampleTier: getOpeningSampleTier(getOpeningGames(opening)),
        fitExplanation: getOpeningExplanation(
          opening,
          data,
          rank
        ),
      };
    })
    .sort((a, b) => {
      const tierRank = { strong: 3, medium: 2, low: 1, none: 0 };
      const byTier = (tierRank[b.fitSignalTier] ?? 0) - (tierRank[a.fitSignalTier] ?? 0);
      if (byTier !== 0) return byTier;
      return b.fitScore - a.fitScore;
    });

  const recognised = scoredOpenings.filter(
    (opening) => !isUnknownOpeningName(getOpeningName(opening))
  );

  const bestOpening =
    recognised.find((opening) => canTreatAsRepertoireOpening(opening)) ||
    recognised[0] ||
    scoredOpenings[0] ||
    null;

  const concernRank = {
    avoid: 0,
    review: 1,
    improve: 2,
    neutral: 3,
    keep: 4,
  };

  const weakestOpening =
    [...recognised]
      .filter((opening) => getOpeningSignal(opening).canBePrimary)
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
        <span className="premiumBadge">Founder Pass</span>
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
  const bestCanBeRepertoire = canTreatAsRepertoireOpening(bestOpening);

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
          <span className="fitLabel">
            {bestCanBeRepertoire
              ? publicMode
                ? "Recent strength"
                : "Best clean repertoire fit"
              : "Signal to verify"}
          </span>
          <strong>
            {bestOpening ? getOpeningContextTitle(bestOpening) : "Not enough data"}
          </strong>
          {bestOpening ? (
            <p>
              {bestOpening.fitScore}/100 — {bestOpening.fitDisplayVerdict || confidenceVerdictLabel(bestOpening, {}, bestOpening.fitVerdict)}
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
              {weakestOpening.fitScore}/100 — {weakestOpening.fitDisplayVerdict || confidenceVerdictLabel(weakestOpening, {}, weakestOpening.fitVerdict)}
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
          ? !bestCanBeRepertoire
            ? `${getOpeningContextTitle(bestOpening)} is not clean enough to use as a repertoire recommendation yet. Track more side-specific games first.`
            : publicMode
            ? `Use ${getOpeningName(bestOpening)} as the recent strength sample, then compare lower-scoring samples by time control and opponent pool.`
            : `Build your short repertoire around ${getOpeningContextTitle(
                bestOpening
              )}, then review your least stable opening.`
          : "Import more games to get a stronger recommendation."}

        {bestOpening && bestCanBeRepertoire ? (
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

function FitReasonList({ opening, compact = false }) {
  const reasons = Array.isArray(opening?.fitReasonBullets)
    ? opening.fitReasonBullets.filter(Boolean)
    : [];

  if (!reasons.length) return null;

  return (
    <ul className={`fitReasonList ${compact ? "fitReasonListCompact" : ""}`}>
      {reasons.slice(0, compact ? 3 : 4).map((reason, index) => (
        <li key={`${reason}-${index}`}>{reason}</li>
      ))}
    </ul>
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
          const canPractice = canTreatAsRepertoireOpening(opening);

          return (
            <button
              className="fitOpeningRow"
              key={`${name}-${index}`}
              type="button"
              disabled={!canPractice}
              onClick={() => canPractice && onPractice(name)}
            >
              <div className="fitOpeningMain">
                <div>
                  <strong>{getOpeningContextTitle(opening, name)}</strong>
                  <p>
                    {confidenceRowText(opening)}
                  </p>
                </div>

                <div className="fitOpeningScore">
                  {opening.fitScore}
                  <span>/100</span>
                </div>
              </div>

              <p className="fitOpeningReason">
                {opening.fitDisplayVerdict || confidenceVerdictLabel(opening, {}, opening.fitVerdict)}.{" "}
                {opening.fitConfidenceReason || opening.fitExplanation}
              </p>
              <FitReasonList opening={opening} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatImportPlatform(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("lichess")) return "Lichess";
  if (raw.includes("chess.com") || raw.includes("chesscom")) return "Chess.com";
  if (raw.includes("demo")) return "Demo report";
  return value || "Chess platform";
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getImportSummary(data) {
  const archives = data?.archivesChecked || data?.archives_checked || [];
  const archiveGames = Array.isArray(archives)
    ? archives.reduce(
        (total, item) =>
          total +
          (numberOrNull(item?.gamesFound ?? item?.games_found ?? item?.games) || 0),
        0
      )
    : 0;
  const gamesAnalysed =
    numberOrNull(
      data?.gamesAnalysed ??
        data?.gamesAnalyzed ??
        data?.games_analyzed ??
        data?.gamesImported ??
        data?.games_imported ??
        data?.totalGames ??
        data?.total_games
    ) || 0;
  const gamesFound =
    numberOrNull(data?.gamesFound ?? data?.games_found) ||
    archiveGames ||
    gamesAnalysed ||
    0;
  const skipped =
    numberOrNull(data?.skippedGames ?? data?.skipped_games) ??
    Math.max(0, gamesFound - gamesAnalysed);
  const months =
    numberOrNull(
      data?.monthsChecked ??
        data?.months_checked ??
        data?.monthsImported ??
        data?.months_imported
    ) || null;
  const platform = formatImportPlatform(
    data?.importPlatform || data?.import_platform || data?.platform || data?.source
  );
  const username =
    data?.username ||
    data?.playerName ||
    data?.player_name ||
    data?.requestedUsername ||
    data?.requested_username ||
    "Imported user";
  const importedAt =
    data?.importedAt ||
    data?.imported_at ||
    data?.lastUpdated ||
    data?.last_updated ||
    data?.savedProfile?.lastUpdated ||
    "";
  const confidence =
    gamesAnalysed >= 50
      ? "Strongest signals are based on repeated openings, not one-off games."
      : gamesAnalysed >= 10
        ? "Useful early sample. Repeated openings are more reliable than one-off games."
        : "Small import sample. Treat recommendations as watch signals until more games are analysed.";

  return {
    platform,
    username,
    gamesFound,
    gamesAnalysed,
    skipped,
    months,
    importedAt,
    confidence,
  };
}

function ImportSummaryCard({ data }) {
  if (!data) return null;

  const summary = getImportSummary(data);
  const rangeText = summary.months
    ? `from the last ${summary.months} month${summary.months === 1 ? "" : "s"}`
    : "from the selected recent range";
  const analysedText = summary.gamesAnalysed
    ? `Analysed ${summary.gamesAnalysed} recent ${summary.platform} game${summary.gamesAnalysed === 1 ? "" : "s"} ${rangeText}.`
    : `Prepared a ${summary.platform} import summary for ${summary.username}.`;
  const meta = [
    ["Platform", summary.platform],
    ["Username", summary.username],
    ["Range", summary.months ? `${summary.months} month${summary.months === 1 ? "" : "s"}` : "Recent games"],
    ["Found", summary.gamesFound ? `${summary.gamesFound}` : "Unavailable"],
    ["Analysed", summary.gamesAnalysed ? `${summary.gamesAnalysed}` : "Unavailable"],
    ...(summary.skipped ? [["Skipped", `${summary.skipped}`]] : []),
    ["Updated", summary.importedAt ? safeDate(summary.importedAt) : "Just now"],
  ];

  return (
    <section className="importSummaryCard" aria-label="Import summary">
      <div className="importSummaryMain">
        <span>Import summary</span>
        <strong>{analysedText}</strong>
        <p>
          Some very short or unclear games may be ignored for opening recommendations.{" "}
          {summary.confidence}
        </p>
      </div>

      <div className="importSummaryMeta">
        {meta.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
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
      : ["master", "elite", "expert"].includes(profile.level)
      ? "Treat this as a repertoire audit, not a beginner verdict."
      : profile.level === "advanced"
      ? "The fastest gain is repertoire refinement: one branch, one move order, one recurring structure."
      : profile.level === "beginner" || profile.level === "developing" || profile.level === "improver"
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

function OpeningFitMethodCard() {
  return (
    <section className="openingMethodCard" aria-label="Opening Fit method">
      <div>
        <span>Method</span>
        <strong>Pattern analysis, not engine analysis</strong>
      </div>
      <p>
        OpeningFit reviews your recent public games, groups them by opening,
        filters tiny samples, compares results by colour, and turns the patterns
        into practical repertoire suggestions.
      </p>
    </section>
  );
}

const importQualityLabel = (usableGames) => {
  const games = Number(usableGames) || 0;
  if (games >= 100) return "Excellent";
  if (games >= 50) return "Good";
  if (games >= 15) return "Limited";
  return "Too little data";
};

const importQualityCopy = (usableGames) => {
  const games = Number(usableGames) || 0;

  if (games >= 100) {
    return `${games} usable games found. Strong sample size for a reliable opening report.`;
  }

  if (games >= 50) {
    return `${games} usable games found. Enough data for a useful opening report.`;
  }

  if (games >= 15) {
    return `Only ${games} usable games found. Treat this as a light snapshot, not a final repertoire recommendation.`;
  }

  return `Only ${games} usable game${games === 1 ? "" : "s"} found. Import more games before making repertoire decisions from this report.`;
};

const monthYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});

const normaliseTimestamp = (value) => {
  if (!value) return null;
  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return numeric > 100000000000 ? numeric : numeric * 1000;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatImportRange = (data) => {
  const explicit =
    data?.timeRange ||
    data?.time_range ||
    data?.dateRange ||
    data?.date_range ||
    data?.importWindow ||
    data?.import_window;

  if (explicit) return explicit;

  const games = [
    ...(Array.isArray(data?.recent_games) ? data.recent_games : []),
    ...(Array.isArray(data?.recentGames) ? data.recentGames : []),
  ];
  const timestamps = games
    .map((game) =>
      normaliseTimestamp(
        game?.end_time ||
          game?.endTime ||
          game?.played_at ||
          game?.playedAt ||
          game?.date
      )
    )
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (timestamps.length) {
    const start = monthYearFormatter.format(new Date(timestamps[0]));
    const end = monthYearFormatter.format(new Date(timestamps[timestamps.length - 1]));
    return start === end ? start : `${start} - ${end}`;
  }

  const months = Number(data?.monthsChecked || data?.months_checked || data?.importMonths);
  const importedAt = normaliseTimestamp(data?.importedAt || data?.imported_at || data?.lastUpdated);

  if (months && importedAt) {
    const end = new Date(importedAt);
    const start = new Date(importedAt);
    start.setMonth(start.getMonth() - Math.max(months - 1, 0));
    return `${monthYearFormatter.format(start)} - ${monthYearFormatter.format(end)}`;
  }

  return months ? `Last ${months} month${months === 1 ? "" : "s"}` : "Recent import";
};

const normaliseSkippedReasons = (data, skippedGames) => {
  const knownReasons = [
    ["bullet", "Bullet games"],
    ["variants", "Variants"],
    ["veryShort", "Very short games"],
    ["missingOpening", "Missing opening/ECO data"],
    ["outsideWindow", "Games outside selected import window"],
  ];
  const source =
    data?.skippedGameReasons ||
    data?.skipped_game_reasons ||
    data?.skippedReasons ||
    data?.skipped_reasons ||
    data?.importSummary?.skippedReasons ||
    data?.import_summary?.skipped_reasons ||
    null;

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (typeof item === "string") return { label: item, count: null };
        return {
          label: item?.label || item?.reason || item?.name || "Other skipped games",
          count: item?.count ?? item?.games ?? null,
        };
      })
      .filter((item) => item.label);
  }

  if (source && typeof source === "object") {
    return knownReasons
      .map(([key, label]) => ({
        label,
        count:
          source[key] ??
          source[label] ??
          source[label.toLowerCase()] ??
          source[label.replaceAll("/", "").replaceAll(" ", "_").toLowerCase()] ??
          0,
      }))
      .filter((item) => Number(item.count) > 0);
  }

  return skippedGames > 0
    ? [{ label: "Reason breakdown not separately reported by this import", count: skippedGames }]
    : [];
};

function ImportQualitySummary({ data }) {
  if (!data) return null;

  const platformKey = String(data.platform || data.importPlatform || data.source || "").toLowerCase();
  const isImportedPlatform =
    platformKey.includes("chesscom") ||
    platformKey.includes("chess.com") ||
    platformKey.includes("lichess");

  if (!isImportedPlatform) return null;

  const platformLabel =
    platformKey.includes("lichess") ? "Lichess" : "Chess.com";
  const username =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    data.requested_username ||
    "Unknown";
  const gamesFound =
    data.gamesFound ??
    data.games_found ??
    data.totalGames ??
    data.total_games ??
    data.gamesImported ??
    0;
  const gamesAnalysed =
    data.gamesAnalysed ??
    data.gamesAnalyzed ??
    data.games_analyzed ??
    data.gamesImported ??
    data.games_imported ??
    0;
  const skippedGames =
    data.skippedGames ??
    data.skipped_games ??
    Math.max(0, Number(gamesFound || 0) - Number(gamesAnalysed || 0));
  const months =
    data.importMonths ||
    data.import_months ||
    data.monthsChecked ||
    data.months_checked ||
    "Recent";
  const quality = importQualityLabel(gamesAnalysed);
  const skippedReasons = normaliseSkippedReasons(data, Number(skippedGames) || 0);

  return (
    <section className="importQualitySummary" aria-label="Import quality summary">
      <div className="importQualityHeader">
        <div>
          <p className="eyebrow">Import quality summary</p>
          <h2>Imported data used for this report</h2>
        </div>
        <div className={`importQualityBadge quality-${quality.toLowerCase().replaceAll(" ", "-")}`}>
          <span>Analysis quality</span>
          <strong>{quality}</strong>
        </div>
      </div>

      <div className="importQualityGrid">
        <div>
          <span>Platform</span>
          <strong>{platformLabel}</strong>
        </div>
        <div>
          <span>Username</span>
          <strong>{username}</strong>
        </div>
        <div>
          <span>Games found</span>
          <strong>{gamesFound || 0}</strong>
        </div>
        <div>
          <span>Games analysed</span>
          <strong>{gamesAnalysed || 0}</strong>
        </div>
        <div>
          <span>Skipped</span>
          <strong>{skippedGames || 0}</strong>
        </div>
        <div>
          <span>Time range</span>
          <strong>{formatImportRange(data)}</strong>
        </div>
        <div>
          <span>Import months selected</span>
          <strong>{months === "Recent" ? months : `${months} month${Number(months) === 1 ? "" : "s"}`}</strong>
        </div>
      </div>

      <p className="importQualityCopy">{importQualityCopy(gamesAnalysed)}</p>

      {skippedReasons.length ? (
        <div className="skippedReasons">
          <span>Skipped-game reasons</span>
          <div>
            {skippedReasons.map((reason) => (
              <small key={`${reason.label}-${reason.count ?? "unknown"}`}>
                {reason.label}
                {reason.count !== null && reason.count !== undefined ? `: ${reason.count}` : ""}
              </small>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CompactReportSummary({ data, fitData, onViewChange }) {
  if (!data) return null;

  const publicMode = isPublicReportMode(data);
  const profile = getSmartPlayerLevelProfile(data);
  const openings = fitData?.scoredOpenings || [];
  const reliableOpenings = openings.filter((opening) => getOpeningSignal(opening).canBePrimary);
  const best = getOpeningSignal(fitData?.bestOpening || {}).canBePrimary
    ? fitData.bestOpening
    : pickDistinctOpening(
        [
          ...reliableOpenings.filter((opening) => opening.fitCategory === "keep"),
          ...reliableOpenings,
        ],
        []
      ) || null;
  const repair =
    pickDistinctOpening(
      [
        ...reliableOpenings.filter((opening) => ["review", "improve"].includes(opening.fitCategory)),
        getOpeningSignal(fitData?.weakestOpening || {}).canBePrimary ? fitData.weakestOpening : null,
        ...reliableOpenings,
      ],
      [best]
    ) || null;
  const avoid =
    pickDistinctOpening(
      [
        ...reliableOpenings.filter((opening) => opening.fitCategory === "avoid"),
        ...reliableOpenings.filter((opening) => opening.fitSeverity === "danger"),
      ],
      [best, repair]
    ) || null;
  const playerName =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    "Your report";
  const platformLabel =
    data.platform === "lichess" || data.importPlatform === "lichess"
      ? "Lichess"
      : data.platform === "chesscom" || data.importPlatform === "chesscom"
        ? "Chess.com"
        : data.platform || data.importPlatform || "Chess profile";
  const games =
    data.total_games ||
    data.gamesImported ||
    data.games_imported ||
    data.games_analyzed ||
    0;
  const score = fitData?.overallScore || data?.openingFitScore || data?.opening_fit_score || 0;
  const repertoireReportSections = buildRepertoireReportSections(data);
  const repertoireShape = repertoireShapeSummary(repertoireReportSections);
  const openingFitVerdict = buildOpeningFitVerdict(fitData, repertoireReportSections);
  const interestingThinOpenings = buildInterestingButThinOpenings(data, fitData, repertoireReportSections);
  const months =
    data.monthsChecked ||
    data.months_checked ||
    data.importMonths ||
    data.import_months ||
    null;
  const timeRange = months
    ? `Last ${months} month${Number(months) === 1 ? "" : "s"}`
    : data.dateRange || data.date_range || "Recent import";
  const summarySentence = repertoireShape.text;
  const nextFocus = repair || avoid || best;
  const nextFocusName = nextFocus ? getOpeningName(nextFocus) : repertoireShape.study;
  const nextFocusContext = nextFocus ? getOpeningContextTitle(nextFocus) : "your next study target";
  const nextBestAction = nextFocus
    ? `This week: review ${nextFocusContext} and play 5 rapid games testing the same line.`
    : "This week: collect more colour-specific games before changing your repertoire.";

  const card = (label, opening, fallback, className, action) => (
    <article className={`commandHeroCard ${className || ""}`}>
      <span>{label}</span>
      <strong>{opening ? getOpeningContextTitle(opening) : fallback}</strong>
      {opening ? (
        <p>
          {confidenceRowText(opening)}
        </p>
      ) : (
        <p>Not enough reliable data yet.</p>
      )}
      <small>{action}</small>
    </article>
  );

  return (
    <section className="reportCommandCenter" id="style-profile">
      <div className="reportCommandHero">
        <div>
          <p className="eyebrow">Opening Fit report</p>
          <h1>Your OpeningFit report for {playerName}</h1>
          <p>{summarySentence}</p>
        </div>

        <div className="reportHealthDial">
          <span>Repertoire health</span>
          <strong>{score || "—"}</strong>
          <small>/100</small>
        </div>
      </div>

      <div className="reportHeroMeta">
        <div>
          <span>Platform</span>
          <strong>{platformLabel}</strong>
        </div>
        <div>
          <span>Games analysed</span>
          <strong>{games || "—"}</strong>
        </div>
        <div>
          <span>Time range</span>
          <strong>{timeRange}</strong>
        </div>
        <div>
          <span>Player level</span>
          <strong>{profile.shortLabel || profile.label}</strong>
        </div>
      </div>

      <section className="openingFitVerdictCard" aria-labelledby="openingfit-verdict-title">
        <div className="openingFitVerdictIntro">
          <p className="eyebrow">OpeningFit verdict</p>
          <h2 id="openingfit-verdict-title">What this means for your repertoire</h2>
          <p>{openingFitVerdict.profile}</p>
          <small>{openingFitVerdict.evidenceNote}</small>
        </div>

        <div className="openingFitVerdictActions">
          <span>Top 3 actions</span>
          <ol>
            {openingFitVerdict.actions.map((action, index) => (
              <li key={`${action}-${index}`}>{action}</li>
            ))}
          </ol>
        </div>
      </section>

      {interestingThinOpenings.length ? (
        <section className="interestingThinDataCard" aria-labelledby="interesting-thin-title">
          <div className="interestingThinDataHeader">
            <div>
              <p className="eyebrow">Interesting but not enough data</p>
              <h2 id="interesting-thin-title">Interesting but not enough data</h2>
            </div>
            <span>{interestingThinOpenings.length}</span>
          </div>

          <p>
            These openings were found in your games, but they are not included in your main verdict because the sample size is too small.
          </p>

          <ul className="interestingThinDataList">
            {interestingThinOpenings.map((opening, index) => {
              const games = getOpeningGames(opening);

              return (
                <li key={`${getOpeningName(opening)}-${itemContext(opening)}-${index}`}>
                  <strong>{getOpeningName(opening)}</strong>
                  <span>
                    {games} game{games === 1 ? "" : "s"} · {opening.weakDataReason}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="commandHeroGrid">
        {card(
          publicMode ? "Recent strength" : "Best fit",
          best,
          "Not enough data",
          "best",
          "Keep this as your reference point."
        )}
        {card(
          publicMode ? "Lower-scoring sample" : "Biggest leak",
          repair || avoid,
          "No clear leak yet",
          "repair",
          "Review the first repeated branch."
        )}
        {card(
          "Next study focus",
          nextFocus,
          nextFocusName,
          "study",
          "Turn this into one short training block."
        )}
      </div>

      <div className="nextBestActionCard">
        <div>
          <span>Next best action</span>
          <strong>{nextBestAction}</strong>
        </div>
        <button type="button" onClick={() => onViewChange?.("training")}>
          Open plan
        </button>
      </div>

      <div className="repertoireShapeCard compactRepertoireShapeCard">
        <p className="eyebrow">Your repertoire shape</p>
        <div className="repertoireShapeAnswers">
          <div>
            <span>Play as White</span>
            <strong>{repertoireShape.white}</strong>
          </div>
          <div>
            <span>Against e4</span>
            <strong>{repertoireShape.e4}</strong>
          </div>
          <div>
            <span>Against d4</span>
            <strong>{repertoireShape.d4}</strong>
          </div>
          <div>
            <span>Other first moves</span>
            <strong>{repertoireShape.other}</strong>
          </div>
          <div>
            <span>Study next</span>
            <strong>{repertoireShape.study}</strong>
          </div>
        </div>
      </div>

      <article className="upgradeAuditPreviewCard">
        <div>
          <span>Founder Pass</span>
          <h3>Want the full repertoire audit?</h3>
          <p>
            Your free report shows the headline patterns. Founder Pass unlocks
            the full colour-split repertoire review, confidence-scored verdicts,
            and a practical training plan.
          </p>
        </div>
        <button type="button" onClick={() => onViewChange?.("upgrade")}>
          Unlock Founder Pass
        </button>
      </article>

      <button className="commandUpgradeCta" type="button" onClick={() => onViewChange?.("upgrade")}>
        Unlock your full repertoire audit
      </button>
    </section>
  );
}

function RepertoireCommandPanel({ data, onPractice }) {
  const sections = buildRepertoireReportSections(data);

  return (
    <section className="commandPanel">
      <div className="commandPanelHeader">
        <p className="eyebrow">Repertoire</p>
        <h2>What to play by colour</h2>
      </div>

      <div className="colourRepertoireGrid commandRepertoireGrid">
        {sections.map((section) => (
          <article className="colourRepertoireSection" key={section.key}>
            <div className="colourRepertoireHeader">
              <p className="eyebrow">{sectionHealth(section)}</p>
              <h3>{section.title}</h3>
            </div>

            <div className="colourRepertoireBuckets">
              {REPERTOIRE_BUCKETS.map((bucket) => {
                const items = section.buckets[bucket.key] || [];
                const first = items[0];

                return (
                  <div className="repertoireBucket" key={`${section.key}-${bucket.key}`}>
                    <div className="repertoireBucketHeader">
                      <h4>{bucket.title}</h4>
                      <span>{items.length}</span>
                    </div>
                    <p>{colourAwareBucketCopy(section.key, bucket.key)}</p>
                    {first ? (
                      <button
                        type="button"
                        className="commandMiniOpening"
                        onClick={() => onPractice?.(first.name)}
                      >
                        <strong>{first.name}</strong>
                        <span>
                          {confidenceRowText(first)}
                        </span>
                      </button>
                    ) : (
                      <small className="commandEmptyText">{section.empty}</small>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function getRolePrimaryOpening(section) {
  const items = [
    ...(section?.buckets?.bestFit || []),
    ...(section?.buckets?.needsReview || []),
    ...(section?.buckets?.risky || []),
  ].filter((opening) => getOpeningSignal(opening).canBePrimary && canTreatAsRepertoireOpening(opening));

  return (
    [...items].sort((a, b) => {
      const confidenceDelta = confidencePriority(b) - confidencePriority(a);
      if (confidenceDelta) return confidenceDelta;
      return getOpeningGames(b) - getOpeningGames(a);
    })[0] ||
    null
  );
}

function resultTrendText(opening) {
  if (!opening) return "Not enough data";

  const score = getWinRate(opening);
  const wins = getOpeningWins(opening);
  const draws = getOpeningDraws(opening);
  const losses = getOpeningLosses(opening);
  const record = wins || draws || losses ? ` (${wins}W-${draws}D-${losses}L)` : "";

  return Number.isFinite(score) ? `${score}% score${record}` : "Score unavailable";
}

function roleOpeningExplanation(opening, section) {
  if (!opening) return section.empty;

  const signal = getOpeningSignal(opening);
  const name = getOpeningName(opening);

  if (!signal.canBePrimary) return getOpeningConfidenceReason(opening);

  if (section.key === "white_repertoire") {
    return `This is the clearest White-side repertoire signal from your imported games: ${name} was played as White, not as an opening you merely faced.`;
  }

  if (section.key === "black_vs_e4") {
    return `This is your clearest response when White starts 1.e4, based on games where you had the Black pieces.`;
  }

  if (section.key === "black_vs_d4") {
    return `This is your clearest response when White starts 1.d4, kept separate from flank openings and other first moves.`;
  }

  return `This is your clearest setup against non-1.e4 and non-1.d4 starts such as 1.c4, 1.Nf3, or other first moves.`;
}

function RepertoireRoleCard({ section, data, onPractice }) {
  const opening = getRolePrimaryOpening(section);
  const canPractice = canTreatAsRepertoireOpening(opening);
  const verdict = opening
    ? opening.fitDisplayVerdict || confidenceVerdictLabel(opening, data, opening.fitVerdict || opening.verdict)
    : "Not enough data";

  return (
    <article className={`roleReportCard ${opening ? `confidence-${getOpeningSignal(opening).className || "medium"}` : ""}`}>
      <div className="roleReportHeader">
        <div>
          <p className="eyebrow">{sectionHealth(section)}</p>
          <h3>{section.title}</h3>
        </div>
        <em className={commandVerdictClass(verdict)}>{verdict}</em>
      </div>

      {opening ? (
        <>
          <dl className="roleReportStats">
            <div>
              <dt>{section.roleLabel}</dt>
              <dd>{getOpeningName(opening)}</dd>
            </div>
            <div>
              <dt>Games analysed</dt>
              <dd>{getOpeningGames(opening)}</dd>
            </div>
            <div>
              <dt>Score / result trend</dt>
              <dd>{resultTrendText(opening)}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{getOpeningConfidence(opening)}</dd>
            </div>
          </dl>

          <p className="roleReportExplanation">
            {opening.fitExplanation || roleOpeningExplanation(opening, section)}
          </p>
          <FitReasonList opening={opening} compact />

          {canPractice ? (
            <button type="button" className="secondaryBtn rolePracticeBtn" onClick={() => onPractice?.(getOpeningName(opening))}>
              Practise this role
            </button>
          ) : null}
        </>
      ) : (
        <EmptyState title="No role signal yet" text={section.empty} />
      )}
    </article>
  );
}

function OpeningsCommandPanel({ data, onPractice }) {
  const sections = buildRepertoireReportSections(data);

  return (
    <section className="commandPanel" id="section-verdicts">
      <div className="commandPanelHeader">
        <p className="eyebrow">Openings</p>
        <h2>Report by repertoire role</h2>
        <p>
          Openings are grouped by how they function in your repertoire, so White openings you faced are not treated as Black recommendations.
        </p>
      </div>

      <div className="roleReportGrid">
        {sections.map((section) => (
          <RepertoireRoleCard
            key={section.key}
            section={section}
            data={data}
            onPractice={onPractice}
          />
        ))}
      </div>
    </section>
  );
}

function WeakSpotsCommandPanel({ data, fitData, onPractice, onViewChange }) {
  const weak = [...(fitData?.scoredOpenings || [])]
    .filter((item) => ["avoid", "review", "improve"].includes(item.fitCategory))
    .sort((a, b) => {
      const rank = { avoid: 0, review: 1, improve: 2 };
      const categoryDiff = (rank[a.fitCategory] ?? 3) - (rank[b.fitCategory] ?? 3);
      if (categoryDiff) return categoryDiff;
      return (a.fitScore || 100) - (b.fitScore || 100);
    });
  const focus = weak[0];

  return (
    <section className="commandPanel">
      <div className="commandPanelHeader">
        <p className="eyebrow">Weak spots</p>
        <h2>Where points are leaking</h2>
      </div>

      {focus ? (
        <article className="nextBestActionCard weakSpotFeature">
          <div>
            <span>Primary leak</span>
            <strong>{getOpeningContextTitle(focus)}</strong>
            <p>{focus.fitExplanation}</p>
            <FitReasonList opening={focus} compact />
          </div>
          <button type="button" onClick={() => onViewChange?.("training")}>
            Build drill
          </button>
        </article>
      ) : (
        <EmptyState title="No urgent leak found" text="Your current import does not show a clear repeated weak spot." />
      )}

      <div className="commandOpeningList">
        {weak.slice(0, 8).map((item, index) => (
          <button
            className={`commandOpeningRow confidence-${getOpeningSignal(item).className || "medium"}`}
            type="button"
            key={`${getOpeningName(item)}-${index}`}
            onClick={() => onPractice?.(getOpeningName(item))}
          >
            <div>
              <strong>{getOpeningContextTitle(item)}</strong>
              <span>{confidenceRowText(item)}</span>
              <small>{item.fitReasonBullets?.[0] || item.fitConfidenceReason || getOpeningConfidenceReason(item)}</small>
            </div>
            <em className={commandVerdictClass(item.fitDisplayVerdict || item.fitVerdict)}>
              {item.fitDisplayVerdict || confidenceVerdictLabel(item, data, item.fitVerdict)}
            </em>
          </button>
        ))}
      </div>
    </section>
  );
}

function buildSevenDayPlanCopy(level, targetName) {
  const cleanLevel = String(level || "").toLowerCase();

  if (isMasterLevel(cleanLevel)) {
    return {
      expectedOutcome:
        "A clearer read on whether the result drop is preparation, move-order precision, or recent opponent targeting.",
      successMetric:
        `Success: identify one recurring prep issue in ${targetName} and test the same correction in 4 out of your next 5 games.`,
      days: [
        "Review 3 recent losses and tag the first move-order or prep moment where the position drifted.",
        "Choose one precision improvement or safer transposition to test.",
        "Play 3-5 rapid/blitz games deliberately entering the same target branch.",
        "Check whether the middlegame matched your intended structure and prep file.",
        "Review the most common opponent response and note the practical adjustment.",
        "Repeat the opening and log recurring problems by branch, clock pressure, and opponent rating band.",
        "Decide whether this remains a main weapon, needs maintenance, or should be parked for specific pairings.",
      ],
    };
  }

  if (cleanLevel === "advanced" || cleanLevel === "expert" || cleanLevel === "strong") {
    return {
      expectedOutcome:
        "A more reliable version of the opening, focused on move-order issues and repertoire refinement.",
      successMetric:
        `Success: reach a playable middlegame in 4 out of your next 5 games with ${targetName}.`,
      days: [
        "Review 3 recent losses and mark the first repeated move-order or structure problem.",
        "Learn one safer line or cleaner move order for that exact branch.",
        "Play 3-5 rapid/blitz games using the target opening.",
        "Check whether you reached a playable middlegame with your intended pawn structure.",
        "Review the most common opponent response and prepare one practical answer.",
        "Repeat the opening in games and note recurring move-order or plan problems.",
        "Decide whether to keep it, improve the branch, or replace it in that repertoire slot.",
      ],
    };
  }

  if (cleanLevel === "intermediate") {
    return {
      expectedOutcome:
        "A repeatable plan you can trust, plus awareness of the common trap or response causing problems.",
      successMetric:
        `Success: reach a familiar middlegame in 4 out of your next 5 games with ${targetName}.`,
      days: [
        "Review 3 recent losses and find the first moment your plan became unclear.",
        "Learn one simple improvement or safer line you can repeat.",
        "Play 3-5 rapid/blitz games using the target opening.",
        "Check whether you reached a playable middlegame with a clear plan.",
        "Review the most common opponent response and learn one answer.",
        "Repeat the opening and write down recurring problems after each game.",
        "Decide whether to keep, improve, or replace this opening.",
      ],
    };
  }

  return {
    expectedOutcome:
      "A simpler opening habit and fewer early positions where you feel lost.",
    successMetric:
      `Success: get developed, castle, and reach a playable middlegame in 4 out of your next 5 games with ${targetName}.`,
    days: [
      "Review 3 recent losses and find where you first felt unsure.",
      "Learn one simple safer setup. Keep it short.",
      "Play 3-5 rapid/blitz games using the same opening.",
      "Check whether your pieces got developed and your king was safe.",
      "Review the move your opponents played most often and learn one easy reply.",
      "Repeat the opening and write down one recurring problem.",
      "Decide whether to keep, improve, or replace this opening.",
    ],
  };
}

function SevenDayOpeningFitPlan({ data, fitData, recentGames = [], onPractice }) {
  const profile = getSmartPlayerLevelProfile(data);
  const openings = fitData?.scoredOpenings || [];
  const reliableWeak = [...openings]
    .filter((opening) => {
      const games = getOpeningGames(opening);
      return getOpeningSignal(opening).canBePrimary && games >= 5 && ["avoid", "review", "improve"].includes(opening.fitCategory);
    })
    .sort((a, b) => {
      const rank = { avoid: 0, review: 1, improve: 2 };
      const byCategory = (rank[a.fitCategory] ?? 3) - (rank[b.fitCategory] ?? 3);
      if (byCategory) return byCategory;
      return (a.fitScore || 100) - (b.fitScore || 100);
    });
  const repertoireSections = buildRepertoireReportSections(data);
  const gapSection = repertoireSections.find((section) => !section.primary || sectionHealth(section) === "not enough evidence");
  const target = reliableWeak[0] || fitData?.weakestOpening || fitData?.bestOpening || null;
  const targetName = target ? getOpeningName(target) : gapSection?.title || "your biggest repertoire gap";
  const targetContext = target ? getOpeningContextTitle(target) : gapSection?.title || "Biggest repertoire gap";
  const confidence = target
    ? getOpeningConfidence(target)
    : gapSection
      ? "Low confidence"
      : "Needs more data";
  const why = target
    ? `${targetContext} was selected because it is the clearest reliable lower-scoring opening in this report.`
    : `${targetName} was selected because the report does not yet have enough evidence in that repertoire slot.`;
  const plan = buildSevenDayPlanCopy(profile.level, targetName);
  const matchingGames = recentGames
    .filter((game) => String(game.opening || "").toLowerCase().includes(String(targetName || "").toLowerCase().split(":")[0]))
    .slice(0, 3);

  return (
    <section className="sevenDayPlanShell" id="seven-day-plan">
      <div className="sevenDayPlanHeader">
        <div>
          <p className="eyebrow">7-day OpeningFit Plan</p>
          <h2>{targetName}</h2>
          <p>{why}</p>
        </div>
        <div className="sevenDayPlanMeta">
          <span>Confidence</span>
          <strong>{confidence}</strong>
        </div>
      </div>

      <div className="sevenDayPlanStats">
        <div>
          <span>Target opening</span>
          <strong>{targetContext}</strong>
        </div>
        <div>
          <span>Expected outcome</span>
          <strong>{plan.expectedOutcome}</strong>
        </div>
        <div>
          <span>Success metric</span>
          <strong>{plan.successMetric}</strong>
        </div>
      </div>

      <div className="sevenDayGrid">
        {plan.days.map((text, index) => (
          <article className="sevenDayCard" key={text}>
            <span>Day {index + 1}</span>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <div className="sevenDayActions">
        {target ? (
          <button type="button" onClick={() => onPractice?.(targetName)}>
            Practise {targetName}
          </button>
        ) : null}
        <small>
          {matchingGames.length
            ? `${matchingGames.length} recent games match this target opening.`
            : "Use your next games to build the sample for this target."}
        </small>
      </div>
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
    if (onViewChange) onViewChange("data");

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
        { key: "repertoire", label: "Repertoire", view: "repertoire", target: "app-results", path: "/" },
        { key: "openings", label: "Openings", view: "openings", target: "section-verdicts", path: "/" },
        { key: "weakspots", label: "Weak spots", view: "weakspots", target: "app-results", path: "/" },
        { key: "training", label: "Study plan", view: "training", target: "section-training", path: "/" },
        { key: "data", label: "Data", view: "data", target: "section-replay", path: "/" },
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

  const navigate = (event, route) => {
    event?.preventDefault();
    event?.stopPropagation();

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
                onClick={(event) => navigate(event, route)}
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
    { key: "repertoire", label: "Repertoire", icon: "♙" },
    { key: "openings", label: "Openings", icon: "◎" },
    { key: "weakspots", label: "Weak spots", icon: "!" },
    { key: "training", label: "Training plan", icon: "◷" },
    { key: "data", label: "Data", icon: "♟" },
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
    <section className="appTabsCard compactReportNav commandTabs" id="app-view-tabs">
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
        {SEO_LINKS.slice(0, 5).map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
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

function CompactSeoFooter() {
  return (
    <footer className="compactSeoFooter">
      <nav aria-label="Opening Fit SEO links">
        <a href="/">Home</a>
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

function LandingSampleResultPreview({ onOpeningClick }) {
  const rows = [
    {
      verdict: "Keep",
      className: "keep",
      opening: "Caro-Kann Defence",
      context: "as Black",
      line: "1.e4 c6",
      text: "Reliable results, stable middlegames.",
      actionOpening: "Caro-Kann Defence",
    },
    {
      verdict: "Improve",
      className: "improve",
      opening: "Italian Game",
      context: "as White",
      line: "1.e4 e5 2.Nf3",
      text: "Good positions, but results drop after early exchanges.",
      actionOpening: "Italian Game",
    },
    {
      verdict: "Watch",
      className: "avoid",
      opening: "Unsound gambit lines",
      context: "low confidence",
      line: "sample too small",
      text: "Fun, but poor score and too few reliable games.",
    },
  ];

  return (
    <article className="landingSampleResultPreview" aria-label="Sample Opening Fit result">
      <div className="landingSampleResultHeader">
        <div>
          <span>Opening Fit sample</span>
          <h3>What your report looks like</h3>
        </div>
      </div>

      <div className="landingOpeningLineChips" aria-label="Sample opening lines">
        <span>1.e4 c6</span>
        <span>1.d4 Nf6</span>
        <span>1.e4 e5</span>
      </div>

      <div className="landingSampleResultRows">
        {rows.map((row) => (
          <div className="landingSampleResultRow" key={`${row.verdict}-${row.opening}`}>
            <span className={`verdict ${row.className}`}>{row.verdict}</span>
            <div>
              {row.actionOpening && typeof onOpeningClick === "function" ? (
                <button
                  className="inlineOpeningBtn"
                  type="button"
                  onClick={() => onOpeningClick(row.actionOpening)}
                >
                  {row.opening} <small>{row.context}</small>
                </button>
              ) : (
                <strong>
                  {row.opening} <small>{row.context}</small>
                </strong>
              )}
              <span className="openingLineChip">{row.line}</span>
              <p>{row.text}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function LandingSection({ onOpeningClick }) {
  const features = [
    {
      icon: "♟",
      title: "Import your games",
      text: "Pull recent Chess.com or Lichess games and analyse the openings you actually reach.",
    },
    {
      icon: "◎",
      title: "Colour-aware verdicts",
      text: "Separate openings you play as White, as Black, and openings you only face.",
    },
    {
      icon: "◷",
      title: "Confidence labels",
      text: "Sample-size guardrails stop one-off games becoming fake certainty.",
    },
    {
      icon: "→",
      title: "Train smarter",
      text: "Get one next study action based on your own repeated opening patterns.",
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
        <div className="landingHeroBoardPattern" aria-hidden="true" />
        <div className="floatingRepertoireCard floatingRepertoireCardWhite" aria-hidden="true">
          <span>White</span>
          <strong>Italian Game</strong>
          <small>stable fit · 64%</small>
        </div>
        <div className="floatingRepertoireCard floatingRepertoireCardBlack" aria-hidden="true">
          <span>Black vs e4</span>
          <strong>Caro-Kann</strong>
          <small>review Advance line</small>
        </div>
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
              <span>Colour-aware opening verdicts from your games</span>
            </div>

            <h1>Know what to keep, fix, and study in your openings.</h1>

            <p className="landingSubtext">
              Opening Fit imports your games and turns them into a practical
              repertoire plan: keep the openings that work, improve the lines
              that wobble, and watch low-confidence experiments.
            </p>

            <div className="landingHeroActions">
              <a className="landingPrimaryBtn" href="#app-dashboard">
                Import games
              </a>
              <a className="landingSecondaryBtn" href="#sample-report">
                See sample result
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
            <LandingSampleResultPreview onOpeningClick={onOpeningClick} />
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
          <h2>Start with a snapshot. Unlock the full repertoire audit.</h2>
        </div>

        <div className="landingPricingGrid">
          <article className="landingPriceCard">
            <p className="landingMiniLabel">Free</p>
            <h3>Quick opening snapshot</h3>
            <p>Good for seeing the headline patterns in your recent games.</p>

            <ul>
              <li>Limited recent Chess.com or Lichess games</li>
              <li>Quick opening snapshot</li>
              <li>Basic top openings</li>
              <li>Basic recommendation</li>
            </ul>
          </article>

          <article className="landingPriceCard landingPriceCardPremium">
            <div className="landingPriceTop">
              <div>
                <p className="landingMiniLabel">Founder Pass</p>
                <h3>Full repertoire audit</h3>
              </div>

              <span className="landingPriceBadge">£8 once-off</span>
            </div>

            <p>
              Unlock better opening decisions: what to keep, what to improve,
              and what to drop from your practical repertoire.
            </p>

            <ul>
              <li>12 months of games</li>
              <li>White / Black split</li>
              <li>Keep / Improve / Avoid verdicts</li>
              <li>Confidence scoring and weak spot diagnosis</li>
              <li>7-day training plan and saved report history</li>
              <li>Future deeper analysis features</li>
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
              : `${playerName} should start with the strongest side-specific Opening Fit recommendation first.`}
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

      const itemContextLabel = getOpeningContext(item).label;

      return (
        arr.findIndex(
          (other) =>
            String(other.displayName).toLowerCase() ===
              String(item.displayName).toLowerCase() &&
            getOpeningContext(other).label === itemContextLabel
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

  const primaryCandidates = ranked.filter((item) => getOpeningSignal(item).canBePrimary);
  const watchCandidates = ranked.filter((item) => !getOpeningSignal(item).canBePrimary);
  const bestOverall = primaryCandidates[0] || null;
  const improveOpening =
    pickDistinctOpening(
      [
        ...weakest.filter((item) => getOpeningSignal(item).canBePrimary),
        ...primaryCandidates,
      ],
      [bestOverall]
    ) || null;
  const avoidOpening =
    pickDistinctOpening(
      [
        ...weakest.filter((item) => getOpeningSignal(item).canBePrimary),
        ...watchCandidates,
      ],
      [bestOverall, improveOpening]
    ) || null;
  const colourAwareSections = getColourAwareRecommendationSections(data);
  const findSection = (key) =>
    colourAwareSections.find((section) => section.key === key)?.items || [];

  const whiteOpenings = ranked.filter((item) => getOpeningContext(item).type === "white");
  const blackOpenings = ranked.filter((item) => getOpeningContext(item).type === "black");

  const pickPrimarySignal = (items) =>
    items.find((item) => getOpeningSignal(item).canBePrimary) || items[0];

  const whiteSignals = [
    ...findSection("white_repertoire"),
    ...whiteOpenings.filter((item) =>
      contextIsCompatible(item.displayName, "played_as_white")
    ),
  ];
  const blackSignals = [
    ...findSection("black_vs_e4"),
    ...findSection("black_vs_d4"),
    ...findSection("black_vs_other"),
    ...blackOpenings.filter((item) =>
      contextIsCompatible(item.displayName, "black_vs_e4")
    ),
  ];

  const bestWhite = pickPrimarySignal(whiteSignals);
  const bestBlack = pickPrimarySignal(blackSignals);
  const mixedSignals = ranked.filter((item) => {
    const context = getOpeningContext(item);
    return context.type === "mixed" || context.type === "faced";
  });

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

    if (opening && !getOpeningSignal(opening).canBeFirm) {
      return getOpeningSignal(opening).explanation;
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
    ? `${bestWhite.displayName || bestWhite.name} is a White-side signal. Use it only as a White repertoire focus.`
    : "Import more White games to unlock a clearer White repertoire recommendation.";

  const blackRecommendation = bestBlack
    ? `${bestBlack.displayName || bestBlack.name} is a Black-side signal. Use it only as a Black repertoire focus for that context.`
    : "Import more Black games to unlock a clearer Black repertoire recommendation.";

  const studyOpening =
    improveOpening?.displayName ||
    bestOverall?.displayName ||
    "your most common opening";
  const adviceAction = (opening, type) => {
    if (opening && !canTreatAsRepertoireOpening(opening)) {
      const name = opening?.displayName || opening?.name || "this opening";
      return `Next action: track ${name} by side/context before treating it as repertoire advice.`;
    }

    if (publicMode) {
      return `Next action: compare ${opening?.displayName || opening?.name || "this sample"} by time control and opponent pool.`;
    }

    if (type === "keep") {
      return `Next action: replay your last win in ${opening?.displayName || opening?.name || "this opening"} and save the move-10 plan.`;
    }

    return `Next action: review your last 3 ${opening?.displayName || opening?.name || "opening"} losses and mark the first repeated problem.`;
  };
  const adviceTitle = (label, opening, fallback) => {
    if (!opening) return fallback;
    const prefix = canTreatAsRepertoireOpening(opening) ? label : "Track";
    return `${prefix}: ${getOpeningContextTitle(opening)}`;
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
          <h3>{adviceTitle(publicMode ? "Recent strength" : "Keep", bestOverall, publicMode ? "Recent strength sample" : "No clean repertoire recommendation yet")}</h3>
          <OpeningEvidenceBlock
            opening={{
              ...(bestOverall || {}),
              reason: explainFit(bestOverall, "keep"),
              nextAction: adviceAction(bestOverall, "keep"),
            }}
            data={data}
            compact
          />
          <div className="adviceMeta">{formatGames(bestOverall)} reviewed</div>
        </article>

        <article className="adviceCard improve">
          <div className="adviceTopline">
            <span>{publicMode ? "Lower-scoring sample" : "Promising but unstable"}</span>
            <small>{formatScore(improveOpening)}</small>
          </div>
          <h3>{adviceTitle(publicMode ? "Lower-scoring sample" : "Improve", improveOpening, publicMode ? "Noisy recent sample" : "Review your common losses")}</h3>
          <OpeningEvidenceBlock
            opening={{
              ...(improveOpening || {}),
              reason: explainFit(improveOpening, "improve"),
              nextAction: adviceAction(improveOpening, "improve"),
            }}
            data={data}
            compact
          />
          <div className="adviceMeta">{formatGames(improveOpening)} reviewed</div>
        </article>

        <article className="adviceCard avoid">
          <div className="adviceTopline">
            <span>{publicMode ? "Experimental/content-game possible" : "Needs review"}</span>
            <small>{formatScore(avoidOpening)}</small>
          </div>
          <h3>{adviceTitle(publicMode ? "Experimental sample" : "Review", avoidOpening, "Low-sample experiments")}</h3>
          <OpeningEvidenceBlock
            opening={{
              ...(avoidOpening || {}),
              reason: explainFit(avoidOpening, "avoid"),
              nextAction: adviceAction(avoidOpening, "avoid"),
            }}
            data={data}
            compact
          />
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
              {bestWhite ? (
                <OpeningEvidenceBlock
                  opening={{
                    ...bestWhite,
                    reason: whiteRecommendation,
                    nextAction: `Review your last 3 ${bestWhite.displayName || bestWhite.name} games as White.`,
                  }}
                  data={data}
                  slot="white_repertoire"
                  compact
                />
              ) : (
                <p>{whiteRecommendation}</p>
              )}
            </div>

            <div className="repertoireRow">
              <span>As Black</span>
              <strong>{bestBlack?.displayName || bestBlack?.name || "Needs more Black games"}</strong>
              {bestBlack ? (
                <OpeningEvidenceBlock
                  opening={{
                    ...bestBlack,
                    reason: blackRecommendation,
                    nextAction: `Review the first branch that repeats in ${bestBlack.displayName || bestBlack.name}.`,
                  }}
                  data={data}
                  slot={bestBlack?.context || "black_repertoire"}
                  compact
                />
              ) : (
                <p>{blackRecommendation}</p>
              )}
            </div>

            <div className="repertoireRow">
              <span>Style fit</span>
              <strong>{styleLabel}</strong>
              <p>
                Your study plan should focus on openings that repeatedly give you
                positions you understand, not random openings with one lucky win.
              </p>
            </div>

            <div className="repertoireRow">
              <span>Mixed / faced signals</span>
              <strong>
                {mixedSignals.length
                  ? mixedSignals.slice(0, 2).map((item) => item.displayName || item.name).join(", ")
                  : "No unclear side signals"}
              </strong>
              <p>
                {mixedSignals.length
                  ? "These appear in your games, but Opening Fit is not treating them as clean repertoire recommendations until the side/context is clear."
                  : "No opponent-only or mixed-side opening signals are currently driving the plan."}
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
      ? canTreatAsRepertoireOpening(bestOpening)
        ? `Build around ${getOpeningContextTitle(bestOpening)} positions and use weaker openings as your next study targets.`
        : `Track ${getOpeningContextTitle(bestOpening)} by side/context before treating it as a repertoire recommendation.`
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
  const {
    user: supabaseUser,
    saveReport: saveCloudReport,
    recordActivity: recordCloudActivity,
  } = useAuth();

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

  useEffect(() => {
    setAccountUser(supabaseUser || null);
  }, [supabaseUser]);

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
      monthsChecked: incoming.monthsChecked ?? incoming.months_checked ?? 0,
      gamesFound:
        incoming.gamesFound ??
        incoming.games_found ??
        incoming.gamesImported ??
        incoming.totalGames ??
        incoming.total_games ??
        0,
      gamesAnalysed:
        incoming.gamesAnalysed ??
        incoming.gamesAnalyzed ??
        incoming.games_analyzed ??
        incoming.gamesImported ??
        incoming.totalGames ??
        incoming.total_games ??
        0,
      gamesAnalyzed:
        incoming.gamesAnalyzed ??
        incoming.gamesAnalysed ??
        incoming.games_analyzed ??
        incoming.gamesImported ??
        incoming.totalGames ??
        incoming.total_games ??
        0,
      skippedGames:
        incoming.skippedGames ?? incoming.skipped_games ?? 0,
      importPlatform:
        incoming.importPlatform ?? incoming.import_platform ?? incoming.platform ?? platform,
      importedAt:
        incoming.importedAt ??
        incoming.imported_at ??
        incoming.lastUpdated ??
        incoming.last_updated ??
        incoming.savedProfile?.lastUpdated ??
        new Date().toISOString(),
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

      if (supabaseUser?.id) {
        try {
          await saveCloudReport(cleanData, {
            username: cleanData.username || cleanUsername,
            platform: selectedPlatformKey,
            games: cleanData.gamesImported ?? cleanData.total_games,
          });
          await recordCloudActivity("report_imported", {
            username: cleanData.username || cleanUsername,
            platform: selectedPlatformKey,
            games: cleanData.gamesImported ?? cleanData.total_games,
          });
        } catch (cloudError) {
          console.warn("Could not save imported report to Supabase", cloudError);
        }
      }

      rememberLandingSeen({ keepPublicLanding: false });
      setActiveView("overview");

      setSavedProfileMessage(
        `Import complete for ${
          cleanData.username || cleanUsername
        }. Saved ${supabaseUser?.id ? "to your account" : "locally"} so you can load it next time.`
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
      normalizeRecommendationSection(
        data?.opening_recommendations?.whiteDetailed ||
          data?.recommendedOpenings?.whiteDetailed ||
          [],
        "played_as_white"
      )
    );
  }, [data, showUnknownOpenings]);

  const blackDetailedRecommendations = useMemo(() => {
    return filterUnknownOpenings(
      normalizeRecommendationSection(
        data?.opening_recommendations?.blackDetailed ||
          data?.recommendedOpenings?.blackDetailed ||
          [],
        "unknown_mixed"
      )
    );
  }, [data, showUnknownOpenings]);

  const colourAwareRecommendationSections = useMemo(() => {
    return getColourAwareRecommendationSections(data).map((section) => ({
      ...section,
      items: filterUnknownOpenings(section.items || []),
    }));
  }, [data, showUnknownOpenings]);

  const repertoireReportSections = useMemo(() => {
    return buildRepertoireReportSections({
      ...data,
      opening_recommendations: {
        ...(data?.opening_recommendations || {}),
        sections: colourAwareRecommendationSections,
      },
    }).map((section) => ({
      ...section,
      buckets: Object.fromEntries(
        Object.entries(section.buckets).map(([key, items]) => [
          key,
          filterUnknownOpenings(items || []),
        ])
      ),
    }));
  }, [data, colourAwareRecommendationSections, showUnknownOpenings]);

  const repertoireShape = useMemo(
    () => repertoireShapeSummary(repertoireReportSections),
    [repertoireReportSections]
  );

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
          ? `${getOpeningContextTitle(bestFit)} is the recent strength sample in this import at ${bestFit.fitScore}/100.`
          : canTreatAsRepertoireOpening(bestFit)
            ? `${getOpeningContextTitle(bestFit)} currently looks like your strongest clean Opening Fit. It scores ${bestFit.fitScore}/100 and matches the ${levelProfile.shortLabel.toLowerCase()} profile read.`
            : `${getOpeningContextTitle(bestFit)} is visible in the data, but the side/context is not clean enough for a repertoire recommendation yet.`
      );
    }

    if (top && levelProfile.level !== "elite") {
      const topTitle = getOpeningContextTitle(top);
      const topContext = getOpeningContext(top);
      summary.push(
        topContext.canRecommend
          ? `Your most common opening signal is ${topTitle}. Because it appears often, improving this side-specific line should give you the biggest overall return.`
          : `Your most common opening signal is ${topTitle}. Track it by side before treating it as a repertoire decision.`
      );
    }

    if (weakFit && getOpeningName(weakFit) !== getOpeningName(bestFit)) {
      summary.push(
        publicMode
          ? `${getOpeningContextTitle(weakFit)} is a lower-scoring recent sample at ${weakFit.fitScore}/100. Do not treat this as a hard opening verdict.`
          : `${getOpeningContextTitle(weakFit)} may need attention. It currently scores ${weakFit.fitScore}/100, so review your last 3 games there and mark the first repeated branch.`
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

    const advancedOrHigher = ["advanced", "expert", "master", "elite", "strong"].includes(levelProfile.level);

    if (advancedOrHigher) {
      plan.push({
        title: levelProfile.level === "master" || levelProfile.level === "elite"
          ? "Audit trends, do not replace weapons"
          : "Refine, do not replace",
        text: levelProfile.level === "master" || levelProfile.level === "elite"
          ? "At this level, a lower score is more likely about move-order precision, opponent preparation, or a recent trend in one branch than basic opening understanding."
          : "This player likely already has opening knowledge. Focus on weak branches, repeated structures, and recent performance changes rather than generic opening swaps.",
        action: null,
        opening: null,
      });
    }

    if (levelProfile.level === "beginner" || levelProfile.level === "developing" || levelProfile.level === "improver") {
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
      if (canTreatAsRepertoireOpening(bestFit)) {
        plan.push({
          title: advancedOrHigher
            ? `Maintain ${getOpeningContextTitle(bestFit)}`
            : `Build around ${getOpeningContextTitle(bestFit)}`,
          text: advancedOrHigher
            ? `This is the strongest clean signal at ${bestFit.fitScore}/100. Use it as a stable reference point and check whether recent opponents are steering you into one branch.`
            : `This is your best current clean Opening Fit at ${bestFit.fitScore}/100. Keep it in that side of your repertoire and learn one simple plan after the first few moves.`,
          action: `Practise ${getOpeningName(bestFit)}`,
          opening: getOpeningName(bestFit),
        });
      } else {
        plan.push({
          title: `Track ${getOpeningContextTitle(bestFit)}`,
          text: "This appears in the data, but Opening Fit is not treating it as a clean repertoire recommendation until the side/context is clearer.",
          action: null,
          opening: null,
        });
      }
    }

    if (mainOpening && getOpeningName(mainOpening) !== getOpeningName(bestFit)) {
      const canPracticeMain = canTreatAsRepertoireOpening(mainOpening);
      plan.push({
        title: canPracticeMain
          ? `Make ${getOpeningContextTitle(mainOpening)} more reliable`
          : `Separate the context for ${getOpeningContextTitle(mainOpening)}`,
        text: canPracticeMain
          ? `You have played this ${mainOpening.games} times in that context, so small improvements there will affect a lot of your games. Review the first 6 moves and the main middlegame plan.`
          : "This appears often, but the current data does not prove it is an opening you should play. Separate played and faced games first.",
        action: canPracticeMain ? `Practise ${mainOpening.name}` : null,
        opening: canPracticeMain ? mainOpening.name : null,
      });
    }

    if (weakFit && getOpeningName(weakFit) !== getOpeningName(bestFit)) {
      const canPracticeWeak = canTreatAsRepertoireOpening(weakFit);
      plan.push({
        title: canPracticeWeak
          ? advancedOrHigher
            ? `Analyse ${getOpeningContextTitle(weakFit)}`
            : `Repair ${getOpeningContextTitle(weakFit)}`
          : `Track ${getOpeningContextTitle(weakFit)} before judging it`,
        text: canPracticeWeak
          ? advancedOrHigher
            ? `This may be a practical review area at ${weakFit.fitScore}/100. Check move-order precision, opponent prep, and the first recurring branch where the score drops.`
            : `This side-specific opening signal is your lowest current fit at ${weakFit.fitScore}/100. Try one simpler variation before changing the whole opening.`
          : "This is not clean enough to call a repertoire weakness. Treat it as a trend to separate by side/context.",
        action: canPracticeWeak ? `Practise ${getOpeningName(weakFit)}` : null,
        opening: canPracticeWeak ? getOpeningName(weakFit) : null,
      });
    }

    if (whitePick) {
      const levelCopy = getLevelToneCopy(levelProfile.level);
      plan.push({
        title: advancedOrHigher
          ? `Audit your White ${whitePick.name} sample`
          : `Build your White repertoire around ${whitePick.name}`,
        text: advancedOrHigher
          ? `This appears often in your White games. ${levelCopy.reason}`
          : "This appears often in your White games. Learn the first 6 moves, then one simple plan for what to do after development.",
        action: "Practise as White",
        opening: whitePick.name,
      });
    }

    if (blackPick) {
      const levelCopy = getLevelToneCopy(levelProfile.level);
      plan.push({
        title: advancedOrHigher
          ? `Audit your Black ${blackPick.name} sample`
          : `Tighten your Black repertoire with ${blackPick.name}`,
        text: advancedOrHigher
          ? `This is one of your regular Black openings. ${levelCopy.action}`
          : "This is one of your regular Black openings. Focus on reaching a familiar setup instead of memorising too many sidelines.",
        action: "Practise as Black",
        opening: blackPick.name,
      });
    }

    if (Array.isArray(data?.training_plan) && data.training_plan.length) {
      data.training_plan.forEach((step, index) => {
        if (typeof step === "string") {
          const unsafeForStrongPlayer = /learn the basics|stop playing|avoid this opening|drop this opening|stick with|first 6 to 8 moves well/i.test(step);
          plan.push({
            title: `Backend suggestion ${index + 1}`,
            text:
              advancedOrHigher && unsafeForStrongPlayer
                ? getLevelToneCopy(levelProfile.level).training
                : step,
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
      content: seoData.description,
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
      content: seoData.description,
    });
    setMetaAttribute('meta[name="twitter:url"]', {
      name: "twitter:url",
      content: seoData.url,
    });
    setMetaAttribute('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: `${SITE_URL}/og-image.png`,
    });
    setMetaAttribute('meta[name="theme-color"]', {
      name: "theme-color",
      content: "#020617",
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
    return <SeoLandingPage page={seoData} ThemeToggle={ThemeToggle} Analytics={Analytics} />;
  }



  return (
    <>
      <div className={`page ${theme} ${isPublicLanding ? "publicLandingPage" : "appReportPage"}`} data-theme={theme}>
        <ThemeToggle
          theme={theme}
          onToggle={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
        />

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
                <h1>Know what to keep, fix, and study in your openings</h1>
                <p className="subtext">
                  Import your Chess.com or Lichess games and get a practical
                  repertoire plan: colour-aware verdicts, confidence labels,
                  and one clear study action from your actual games.
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
                <button
                  className="secondaryBtn"
                  type="button"
                  onClick={loadDemoReport}
                  disabled={loading}
                >
                  View sample
                </button>
              </div>
            </div>

            <LandingSampleResultPreview onOpeningClick={startOpeningPractice} />

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
              <span>Colour-aware</span>
              <span>Sample-size aware</span>
              <span>Based on actual games</span>
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

              <ImportQualitySummary data={data} />

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
                  <NextStudySession
                    fitData={fitData}
                    recentGames={filteredRecentGames}
                    onPractice={startOpeningPractice}
                    onViewChange={setActiveView}
                  />
                </>
              ) : null}

              {activeView === "repertoire" ? (
                <RepertoireCommandPanel data={data} onPractice={startOpeningPractice} />
              ) : null}

              {activeView === "openings" ? (
                <OpeningsCommandPanel
                  data={data}
                  fitData={fitData}
                  onPractice={startOpeningPractice}
                />
              ) : null}

              {activeView === "weakspots" ? (
                <WeakSpotsCommandPanel
                  data={data}
                  fitData={fitData}
                  onPractice={startOpeningPractice}
                  onViewChange={setActiveView}
                />
              ) : null}

              {false && activeView === "recommendations" ? (
                <>
                  <OpeningFitRepertoirePlan data={data} />

                  <OpeningFitFullReport data={data} />

                  <div id="section-fit">
                    <OpeningFitSummaryCard
                      fitData={fitData}
                      onPractice={startOpeningPractice}
                    />
                  </div>

                  <Section
                    title="Detailed evidence"
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

                  <div id="section-recommendations">
                <Section
                  title="Opening Suggestions"
                  isOpen={openSections.recommendations}
                  onToggle={() => toggleSection("recommendations")}
                >
                  <div className="repertoireShapeCard">
                    <p className="eyebrow">Your repertoire shape</p>
                    <h3>Your repertoire shape</h3>
                    <p>{repertoireShape.text}</p>
                    <div className="repertoireShapeAnswers">
                      <div>
                        <span>Play as White</span>
                        <strong>{repertoireShape.white}</strong>
                      </div>
                      <div>
                        <span>Against e4</span>
                        <strong>{repertoireShape.e4}</strong>
                      </div>
                      <div>
                        <span>Against d4</span>
                        <strong>{repertoireShape.d4}</strong>
                      </div>
                      <div>
                        <span>Other first moves</span>
                        <strong>{repertoireShape.other}</strong>
                      </div>
                      <div>
                        <span>Study next</span>
                        <strong>{repertoireShape.study}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="colourRepertoireGrid">
                    {repertoireReportSections.map((section) => (
                      <article className="colourRepertoireSection" key={section.key}>
                        <div className="colourRepertoireHeader">
                          <p className="eyebrow">{sectionHealth(section)}</p>
                          <h3>{section.title}</h3>
                        </div>

                        <div className="colourRepertoireBuckets">
                          {REPERTOIRE_BUCKETS.map((bucket) => {
                            const items = section.buckets[bucket.key] || [];

                            return (
                              <div className="repertoireBucket" key={`${section.key}-${bucket.key}`}>
                                <div className="repertoireBucketHeader">
                                  <h4>{bucket.title}</h4>
                                  <span>{items.length}</span>
                                </div>
                                <p>{colourAwareBucketCopy(section.key, bucket.key)}</p>

                                <div className="list">
                                  {items.length ? (
                                    items.slice(0, 3).map((item, index) => {
                                      const signal = getOpeningSignal(item);
                                      const shouldHold = !signal.canBePrimary;
                                      const verdict = shouldHold
                                        ? confidenceVerdictLabel(item, data)
                                        : getDataFirstVerdict(item, data);
                                      const evidenceItem = {
                                        ...item,
                                        confidence: getOpeningConfidence(item),
                                        verdict,
                                        reason: getOpeningConfidenceReason(item),
                                        nextAction: getNextActionLine(item, data, section.key),
                                      };

                                      return (
                                        <button
                                          className="listItem openingPracticeLink evidenceListItem"
                                          key={`${section.key}-${bucket.key}-${item.name}-${index}`}
                                          type="button"
                                          onClick={() =>
                                            !shouldHold && startOpeningPractice(item.name)
                                          }
                                        >
                                          <div>
                                            <strong>{verdict}: {item.name}</strong>
                                            <OpeningEvidenceBlock
                                              opening={evidenceItem}
                                              data={data}
                                              slot={section.key}
                                              compact
                                            />
                                          </div>
                                          <span>{shouldHold ? "Track" : "Practice"}</span>
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <EmptyState
                                      title={bucket.key === "notEnoughData" ? "No unclear samples here" : `No ${bucket.title.toLowerCase()} yet`}
                                      text={bucket.key === "notEnoughData" ? section.empty : "This bucket will fill once your games show a colour-specific signal."}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>

                  {isPremium && whiteDetailedRecommendations.length ? (
                    <div className="recommendationDetails">
                      <h3>White-side opening evidence</h3>

                      <div className="openingExplainGrid">
                        {whiteDetailedRecommendations.map((opening) => (
                          <article
                            className="openingExplainCard"
                            key={opening.name}
                          >
                            <h4>{getOpeningContextTitle(opening, opening.name)}</h4>
                            <OpeningEvidenceBlock
                              opening={{
                                ...opening,
                                reason: opening.reason,
                                nextAction: opening.plan,
                              }}
                              data={data}
                              slot="white_repertoire"
                              compact
                            />
                            {opening.mistakeToAvoid ? (
                              <p>
                                <strong>Watch:</strong> {opening.mistakeToAvoid}
                              </p>
                            ) : null}
                            <span>{opening.difficulty}</span>

                            <button
                              className="secondaryBtn explainPracticeBtn"
                              type="button"
                              disabled={!canTreatAsRepertoireOpening(opening)}
                              onClick={() =>
                                canTreatAsRepertoireOpening(opening) &&
                                startOpeningPractice(opening.name)
                              }
                            >
                              {canTreatAsRepertoireOpening(opening) ? "Practise" : "Track"}
                            </button>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : !isPremium ? (
                    <LockedPremiumCard
                      title="Detailed opening explanations are premium"
                      text="Your free report shows the headline patterns. Founder Pass unlocks the full colour-split repertoire review and confidence-scored verdicts."
                    />
                  ) : null}

                  {isPremium && blackDetailedRecommendations.length ? (
                    <div className="recommendationDetails">
                      <h3>Black-side opening evidence</h3>

                      <div className="openingExplainGrid">
                        {blackDetailedRecommendations.map((opening) => (
                          <article
                            className="openingExplainCard"
                            key={opening.name}
                          >
                            <h4>{getOpeningContextTitle(opening, opening.name)}</h4>
                            <OpeningEvidenceBlock
                              opening={{
                                ...opening,
                                reason: opening.reason,
                                nextAction: opening.plan,
                              }}
                              data={data}
                              slot="black_repertoire"
                              compact
                            />
                            {opening.mistakeToAvoid ? (
                              <p>
                                <strong>Watch:</strong> {opening.mistakeToAvoid}
                              </p>
                            ) : null}
                            <span>{opening.difficulty}</span>

                            <button
                              className="secondaryBtn explainPracticeBtn"
                              type="button"
                              disabled={!canTreatAsRepertoireOpening(opening)}
                              onClick={() =>
                                canTreatAsRepertoireOpening(opening) &&
                                startOpeningPractice(opening.name)
                              }
                            >
                              {canTreatAsRepertoireOpening(opening) ? "Practise" : "Track"}
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
                        const canPractice = canTreatAsRepertoireOpening(item);
                        const displayVerdict =
                          item.fitDisplayVerdict || confidenceVerdictLabel(item, data, item.fitVerdict);

                        return (
                          <button
                            className={`listItem openingPracticeLink evidenceListItem confidence-${getOpeningSignal(item).className || "medium"}`}
                            key={index}
                            type="button"
                            disabled={!canPractice}
                            onClick={() =>
                              canPractice && startOpeningPractice(getOpeningName(item))
                            }
                          >
                            <div>
                              <strong>{getOpeningContextTitle(item)}</strong>
                              <OpeningEvidenceBlock
                                opening={{
                                  ...item,
                                  winRate: rate,
                                  verdict: displayVerdict,
                                  reason: item.fitConfidenceReason || item.fitExplanation,
                                }}
                                data={data}
                                compact
                              />
                            </div>

                            <div className="rightStat">
                              <div>{rate}%</div>
                              <small>{getOpeningGames(item)} games</small>
                              <div className={verdictClass(displayVerdict)}>
                                {displayVerdict}
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
                  <SevenDayOpeningFitPlan
                    data={data}
                    fitData={fitData}
                    recentGames={filteredRecentGames}
                    onPractice={startOpeningPractice}
                  />

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
                      title="Full repertoire audit locked"
                      text="Founder Pass unlocks weak spot diagnosis, a 7-day training plan, and saved report history."
                    />
                  ) : null}
                </Section>
              </div>
              </div>
                </>
              ) : null}

              {activeView === "data" ? (
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

              {false && activeView === "recommendations" ? (
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

              {false && activeView === "recommendations" ? (
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
                                  <OpeningEvidenceBlock
                                    opening={{
                                      ...opening,
                                      winRate: rate,
                                      verdict:
                                        fitOpening?.fitDisplayVerdict ||
                                        confidenceVerdictLabel(fitOpening || opening, data, fitOpening?.fitVerdict),
                                      reason:
                                        fitOpening?.fitConfidenceReason ||
                                        fitOpening?.fitExplanation,
                                    }}
                                    data={data}
                                    compact
                                    hideReason
                                    hideNextAction
                                  />
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
                          title="Full repertoire audit locked"
                          text={`Your free report shows the headline patterns. Founder Pass unlocks all ${filteredTopOpenings.length} tracked openings with fuller context.`}
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
              {false && activeView === "overview" ? (
                <RetentionHub data={data} />
              ) : null}

              {false && activeView === "repertoire" ? (
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

        {false ? <div className="landingWrap">
          <Footer />
        </div> : null}
      </div>

      <Analytics />
    </>
  );
}
