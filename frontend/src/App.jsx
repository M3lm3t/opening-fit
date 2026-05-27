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
import { useCallback, useEffect, useMemo, useState } from "react";
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
import WeeklyOpeningReport from "./components/WeeklyOpeningReport";
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
import TodayDashboard from "./components/TodayDashboard";
import AchievementsPanel from "./components/AchievementsPanel";
import DailyOpeningHabit from "./components/DailyOpeningHabit";
import MobileBottomNav from "./components/MobileBottomNav";
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
  getLevelToneCopy,
  getPlayerLevelText,
  getRatingAwareRecommendationCopy,
  getSmartLevelAwareRecommendation,
  getSmartPlayerLevelProfile,
  isAdvancedOrStrongerLevel,
  isMasterLevel,
} from "./components/playerLevelLogic";
import AccountRestoreSync from "./components/AccountRestoreSync";
import { buildReportRetentionKey, logRetentionEvent } from "./services/retentionEvents";
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
  if (lower.includes("not enough") || lower.includes("too little") || lower.includes("interesting") || lower.includes("early pattern") || lower.includes("low confidence")) return "verdict test";
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
    games < 10
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

function buildStudyThisNextTarget(fitData) {
  const openings = Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : [];
  const weaknessCategories = new Set(["review", "improve", "avoid"]);
  const reliableWeaknesses = openings
    .filter((opening) => canTreatAsRepertoireOpening(opening))
    .filter((opening) => weaknessCategories.has(opening.fitCategory) || getWinRate(opening) < 55)
    .filter((opening) => confidencePriority(opening) >= 2)
    .sort((a, b) => {
      const confidenceDelta = confidencePriority(b) - confidencePriority(a);
      if (confidenceDelta) return confidenceDelta;
      const scoreDelta = getWinRate(a) - getWinRate(b);
      if (scoreDelta) return scoreDelta;
      return getOpeningGames(b) - getOpeningGames(a);
    });
  const lowConfidenceFallback = openings
    .filter((opening) => canTreatAsRepertoireOpening(opening))
    .filter((opening) => weaknessCategories.has(opening.fitCategory) || getWinRate(opening) < 50)
    .filter((opening) => confidencePriority(opening) < 2)
    .sort((a, b) => getOpeningGames(b) - getOpeningGames(a))[0];
  const target = reliableWeaknesses[0] || lowConfidenceFallback || null;

  if (!target) return null;

  const lowConfidence = confidencePriority(target) < 2;
  const name = getOpeningName(target);
  const context = roleNameForAction(target);
  const reason =
    target.fitReasonBullets?.find((item) =>
      /loss|score|move-order|difficult|stable|repertoire/i.test(item)
    ) ||
    `This is the clearest ${lowConfidence ? "early" : "reliable"} weakness in the filtered report.`;
  const goal = lowConfidence
    ? "Collect a few more games, then learn the first 6-8 moves only if the pattern repeats."
    : "Learn the first 6-8 moves and the basic middlegame plan.";

  return {
    opening: target,
    name,
    context,
    lowConfidence,
    confidence: getOpeningConfidence(target),
    why: lowConfidence ? `${reason} This is low confidence, so treat it as a watch target.` : reason,
    goal,
    timeNeeded: "20 minutes",
    weeklyPlan: [
      `Day 1: Review your 3 losses in ${name}.`,
      "Day 2: Learn the main setup and write one move-10 plan.",
      `Day 3: Play 5 rapid/blitz games using only ${name}.`,
      "Day 4: Re-import and check whether results changed.",
    ],
  };
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

  if (games < 5 || signal.badge === "Too little data") return "Not enough data";
  if (games < 10 || signal.badge === "Low") return "Not enough data";
  if (isPublicReportMode(data)) {
    const publicLabel = publicAwareVerdict(opening?.verdict || opening?.fitVerdict, data, games);
    return `${publicLabel} — ${getOpeningConfidence(opening)}`;
  }
  if (winRate < 35 && games >= 25) return `Avoid — ${getOpeningConfidence(opening)}`;
  if (winRate >= 55) return `Keep — ${getOpeningConfidence(opening)}`;
  return `Improve — ${getOpeningConfidence(opening)}`;
}

function getNextActionLine(opening, data, sectionKey = "") {
  const name = getOpeningName(opening);
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
  if (count >= 25) return "high";
  if (count >= 10) return "medium";
  if (count >= 5) return "low";
  if (count >= 1) return "tooLittle";
  return "none";
}

function getOpeningConfidenceReason(opening) {
  const games = getOpeningGames(opening);
  const signal = getOpeningSignal(opening);

  if (signal?.explanation) return signal.explanation;
  if (games >= 25) return "25+ games in this opening or family.";
  if (games >= 10) return "10-24 games: useful sample, but still worth confirming.";
  if (games >= 5) return "5-9 games: early pattern only.";
  if (games >= 1) return "0-4 games: too little data for a verdict.";
  return "Game count unavailable.";
}

function baseConfidenceVerdict(opening, data, fallback = "") {
  const games = getOpeningGames(opening);
  const signal = getOpeningSignal(opening);
  const label = String(fallback || opening?.fitVerdict || opening?.verdict || "").toLowerCase();

  if (games < 10 || signal.badge === "Too little data" || signal.badge === "Low") return "Not enough data";
  if (label.includes("avoid") || label.includes("underperform")) return games >= 25 ? "Avoid" : "Improve";
  if (label.includes("keep") || label.includes("main") || label.includes("reliable")) return "Keep";
  if (label.includes("improve") || label.includes("review") || label.includes("unstable")) return "Improve";

  const score = getWinRate(opening);
  if (score < 35 && games >= 25) return "Avoid";
  if (score >= 55) return "Keep";
  return "Improve";
}

function confidenceVerdictLabel(opening, data, fallback = "") {
  const base = baseConfidenceVerdict(opening, data, fallback);
  const confidence = getOpeningConfidence(opening);

  if (base === "Not enough data") return "Not enough data";
  return `${base} — ${confidence}`;
}

function openingVerdictLabel(opening, data, fallback = "") {
  return baseConfidenceVerdict(opening, data, fallback);
}

function confidenceRowText(opening) {
  const games = getOpeningGames(opening);
  const score = getWinRate(opening);
  return `${games} game${games === 1 ? "" : "s"} analysed · ${score}% score · ${getOpeningConfidence(opening)}. ${getOpeningConfidenceReason(opening)}`;
}

function getOpeningSharePercent(opening, data) {
  const games = getOpeningGames(opening);
  const total = Number(
    data?.total_games ||
      data?.totalGames ||
      data?.gamesAnalysed ||
      data?.gamesAnalyzed ||
      data?.games_analyzed ||
      data?.gamesImported ||
      0
  );

  if (!games || !total) return null;
  return Math.max(1, Math.round((games / total) * 100));
}

function openingShareText(opening, data) {
  const share = getOpeningSharePercent(opening, data);
  return share === null ? "Share unavailable" : `${share}% of analysed games`;
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

  if (games < 5 || signal.badge === "Too little data") {
    return {
      label: "Not enough data",
      category: "neutral",
      tone: "neutral",
      severity: "neutral",
      message: "0-4 games. Not enough data for a full verdict.",
    };
  }

  if (games < 10 || signal.badge === "Low") {
    const lowWinRate = winRate < 45;
    return {
      label: "Not enough data",
      category: "neutral",
      tone: "neutral",
      severity: "neutral",
      message:
        lowWinRate
          ? "Too few games to judge. Review only if this opening keeps appearing."
          : "Interesting signal, but too few games for a confident verdict.",
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

const TIME_CONTROL_FILTERS = [
  { key: "serious", label: "Rapid + Blitz" },
  { key: "all", label: "All games" },
  { key: "rapid", label: "Rapid" },
  { key: "blitz", label: "Blitz" },
  { key: "bullet", label: "Bullet" },
];

const DATE_RANGE_FILTERS = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "180", label: "Last 6 months", days: 180 },
  { key: "365", label: "Last 12 months", days: 365 },
];

function getGameTimeControl(game) {
  return String(
    game?.time_class ||
      game?.timeClass ||
      game?.speed ||
      game?.perf ||
      game?.perfType ||
      ""
  ).toLowerCase();
}

function gamePassesReportFilters(game, filters) {
  const timeClass = getGameTimeControl(game);
  const timeFilter = filters?.timeControl || "serious";

  if (timeFilter === "serious" && !["rapid", "blitz"].includes(timeClass)) return false;
  if (timeFilter !== "all" && timeFilter !== "serious" && timeClass !== timeFilter) return false;

  const days = DATE_RANGE_FILTERS.find((item) => item.key === filters?.dateRange)?.days;
  if (!days) return true;

  const timestamp = normaliseTimestamp(
    game?.end_time ||
      game?.endTime ||
      game?.played_at ||
      game?.playedAt ||
      game?.date
  );

  if (!timestamp) return true;
  return timestamp >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function gameResultStats(result) {
  const clean = String(result || "").toLowerCase();

  if (clean.includes("win") || clean === "1-0") return { wins: 1, draws: 0, losses: 0 };
  if (clean.includes("draw") || clean.includes("1/2")) return { wins: 0, draws: 1, losses: 0 };
  if (clean.includes("loss") || clean.includes("lose") || clean === "0-1") return { wins: 0, draws: 0, losses: 1 };
  return { wins: 0, draws: 0, losses: 0 };
}

function aggregateFilteredOpeningGames(data, filters) {
  const allGames = [
    ...(Array.isArray(data?.opening_games) ? data.opening_games : []),
    ...(Array.isArray(data?.openingGames) ? data.openingGames : []),
  ];
  const uniqueGames = [];
  const seen = new Set();

  allGames.forEach((game, index) => {
    const key = game?.url || `${game?.opening || game?.name}-${game?.end_time || game?.endTime || index}`;
    if (seen.has(key)) return;
    seen.add(key);
    uniqueGames.push(game);
  });

  if (!uniqueGames.length) return null;

  const filteredGames = uniqueGames.filter((game) => gamePassesReportFilters(game, filters));
  const statsByContext = new Map();
  const addGame = (game) => {
    const name = getOpeningName(game);
    if (!name || isUnknownOpeningName(name)) return;

    const context = itemContext(game);
    const key = `${name.toLowerCase()}::${context}`;

    if (!statsByContext.has(key)) {
      statsByContext.set(key, {
        name,
        opening: name,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        colour: context === "played_as_white" ? "white" : context.startsWith("black") ? "black" : game?.colour || game?.color || "mixed",
        color: context === "played_as_white" ? "white" : context.startsWith("black") ? "black" : game?.colour || game?.color || "mixed",
        context,
        contextLabel: contextLabel(context),
        repertoireContext: context,
      });
    }

    const stats = statsByContext.get(key);
    const resultStats = gameResultStats(game?.result);
    stats.games += 1;
    stats.wins += resultStats.wins;
    stats.draws += resultStats.draws;
    stats.losses += resultStats.losses;
  };

  filteredGames.forEach(addGame);

  const openings = Array.from(statsByContext.values()).map((item) => {
    const winRate = item.games
      ? Math.round(((item.wins + item.draws * 0.5) / item.games) * 100)
      : 0;

    return {
      ...item,
      win_rate: winRate,
      winRate,
    };
  });
  const byGames = [...openings].sort((a, b) => {
    if (b.games !== a.games) return b.games - a.games;
    return getWinRate(b) - getWinRate(a);
  });
  const byScore = [...openings].sort((a, b) => {
    if (getWinRate(b) !== getWinRate(a)) return getWinRate(b) - getWinRate(a);
    return b.games - a.games;
  });
  const preferredWhite = byGames.filter((item) => item.context === "played_as_white");
  const preferredBlack = byGames.filter((item) => item.context.startsWith("black"));

  return {
    topOpenings: byGames,
    bestOpenings: byScore,
    preferredWhite,
    preferredBlack,
    filteredGames,
    totalGames: filteredGames.length,
    sourceGames: uniqueGames.length,
  };
}

function applyReportFilters(data, filters) {
  if (!data) return null;

  const aggregate = aggregateFilteredOpeningGames(data, filters);
  const timeLabel = TIME_CONTROL_FILTERS.find((item) => item.key === filters.timeControl)?.label || "Rapid + Blitz";
  const dateLabel = DATE_RANGE_FILTERS.find((item) => item.key === filters.dateRange)?.label || "Last 90 days";

  if (!aggregate) {
    return {
      ...data,
      reportFilters: { ...filters, timeLabel, dateLabel, limited: true },
      filterSummary: `${timeLabel}, ${dateLabel}`,
    };
  }

  return {
    ...data,
    top_openings: aggregate.topOpenings,
    topOpenings: aggregate.topOpenings,
    best_openings: aggregate.bestOpenings,
    bestOpenings: aggregate.bestOpenings,
    preferred_white: aggregate.preferredWhite,
    preferredWhite: aggregate.preferredWhite,
    preferred_black: aggregate.preferredBlack,
    preferredBlack: aggregate.preferredBlack,
    total_games: aggregate.totalGames,
    totalGames: aggregate.totalGames,
    gamesImported: aggregate.totalGames,
    gamesAnalysed: aggregate.totalGames,
    gamesAnalyzed: aggregate.totalGames,
    skippedGames: Math.max(0, aggregate.sourceGames - aggregate.totalGames),
    skipped_games: Math.max(0, aggregate.sourceGames - aggregate.totalGames),
    skippedGameReasons:
      aggregate.sourceGames > aggregate.totalGames
        ? [
            {
              label: "Excluded by report filters",
              count: Math.max(0, aggregate.sourceGames - aggregate.totalGames),
            },
          ]
        : [],
    filterSummary: `${timeLabel}, ${dateLabel}`,
    timeRange: dateLabel,
    dateRange: dateLabel,
    reportFilters: {
      ...filters,
      timeLabel,
      dateLabel,
      limited: false,
      sourceGames: aggregate.sourceGames,
    },
  };
}

function buildReportHistorySummary(data, fitData = null) {
  const openings = Array.isArray(fitData?.scoredOpenings) && fitData.scoredOpenings.length
    ? fitData.scoredOpenings
    : Array.isArray(data?.top_openings)
      ? data.top_openings
      : Array.isArray(data?.topOpenings)
        ? data.topOpenings
        : [];
  const topOpenings = openings.slice(0, 8).map((item) => {
    const rawScore = item?.winRate ?? item?.win_rate ?? item?.score ?? item?.scoreRate;
    const scoreNumber = Number(String(rawScore ?? "").replace("%", ""));
    const score = Number.isFinite(scoreNumber)
      ? scoreNumber <= 1
        ? Math.round(scoreNumber * 100)
        : Math.round(scoreNumber)
      : null;

    return {
      name: getOpeningName(item),
      games: getOpeningGames(item),
      score,
      verdict: item?.fitDisplayVerdict || item?.fitVerdict || item?.verdict || "Tracked",
      confidence: item?.fitConfidence || item?.confidenceLabel || item?.confidence || "Unlabelled",
    };
  });
  const studyTarget =
    buildStudyThisNextTarget(fitData)?.name ||
    topOpenings
      .filter((item) => item.score !== null)
      .sort((a, b) => a.score - b.score)[0]?.name ||
    topOpenings[0]?.name ||
    "No clear target yet";

  return {
    reportDate: new Date().toISOString(),
    username: data?.username || data?.playerName || data?.player_name || "Unknown player",
    platform: data?.platform || data?.importPlatform || "unknown",
    importMonths: data?.monthsChecked || data?.months_checked || data?.importMonths || "Recent",
    games: data?.gamesAnalysed || data?.gamesAnalyzed || data?.gamesImported || data?.total_games || 0,
    topOpening: topOpenings[0]?.name || "No clear top opening yet",
    topOpenings,
    verdicts: Object.fromEntries(topOpenings.map((item) => [item.name, item.verdict])),
    confidenceLevels: Object.fromEntries(topOpenings.map((item) => [item.name, item.confidence])),
    studyTarget,
    healthScore:
      fitData?.overallScore ??
      data?.openingFitScore ??
      data?.opening_fit_score ??
      data?.opening_health_score ??
      null,
  };
}

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

function StudyThisNextCard({ target, onPractice, onViewChange }) {
  if (!target) return null;

  return (
    <section id="study-this-next" className={`studyThisNextCard ${target.lowConfidence ? "studyThisNextCardLow" : ""}`}>
      <div className="studyThisNextHeader">
        <div>
          <p className="eyebrow">Study this next</p>
          <h2>Your next study target</h2>
        </div>
        <span>{target.lowConfidence ? `Low confidence · ${target.confidence}` : target.confidence}</span>
      </div>

      <div className="studyThisNextMain">
        <div>
          <span>Study</span>
          <strong>{target.name} {target.context}</strong>
        </div>
        <div>
          <span>Time needed</span>
          <strong>{target.timeNeeded}</strong>
        </div>
      </div>

      <div className="studyThisNextWhy">
        <p><strong>Why:</strong> {target.why}</p>
        <p><strong>Goal:</strong> {target.goal}</p>
      </div>

      <div className="studyThisNextWeek">
        <span>This week’s plan</span>
        <ol>
          {target.weeklyPlan.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="studyThisNextActions">
        <button type="button" onClick={() => onPractice?.(target.name)}>
          Practise target
        </button>
        <button type="button" onClick={() => onViewChange?.("training")}>
          Open study plan
        </button>
      </div>
    </section>
  );
}

function OpeningFitVerdictSection({ data, fitData }) {
  const sections = buildRepertoireReportSections(data);
  const verdict = buildOpeningFitVerdict(fitData, sections);
  const profile = getSmartPlayerLevelProfile(data);
  const score = fitData?.overallScore || data?.openingFitScore || data?.opening_fit_score || 0;

  return (
    <section id="openingfit-verdict" className="openingFitVerdictCard finalReportBlock" aria-labelledby="openingfit-verdict-title">
      <div className="openingFitVerdictIntro">
        <p className="eyebrow">OpeningFit verdict</p>
        <h2 id="openingfit-verdict-title">Your opening profile in one decision</h2>
        <p>{verdict.profile}</p>
        <small>{verdict.evidenceNote}</small>
      </div>

      <div className="reportHealthDial compactReportHealth">
        <span>{profile.shortLabel || profile.label || "Profile"}</span>
        <strong>{score || "—"}</strong>
        <small>{score ? "/100" : "score pending"}</small>
      </div>
    </section>
  );
}

function TopActionsSection({ data, fitData, onPractice }) {
  const sections = buildRepertoireReportSections(data);
  const verdict = buildOpeningFitVerdict(fitData, sections);

  return (
    <section className="topActionsSection finalReportBlock" id="top-actions">
      <div className="commandPanelHeader">
        <p className="eyebrow">Top 3 actions</p>
        <h2>The next three things to do</h2>
      </div>

      <ol className="topActionsList">
        {verdict.actions.map((action, index) => (
          <li key={`${action}-${index}`}>
            <span>{index + 1}</span>
            <strong>{action}</strong>
          </li>
        ))}
      </ol>

      {fitData?.bestOpening ? (
        <button
          className="secondaryBtn"
          type="button"
          onClick={() => onPractice?.(getOpeningName(fitData.bestOpening))}
        >
          Practise strongest opening
        </button>
      ) : null}
    </section>
  );
}

function EvidenceTableSection({ data, fitData, isPremium = false, onPractice }) {
  const rows = uniqueOpeningsByNameAndContext(
    Array.isArray(fitData?.scoredOpenings) && fitData.scoredOpenings.length
      ? fitData.scoredOpenings
      : [
          ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
          ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
          ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
        ]
  )
    .filter((opening) => !isUnknownOpeningName(getOpeningName(opening)))
    .sort(evidenceSort);
  const visibleRows = isPremium ? rows : rows.slice(0, 8);

  return (
    <section className="evidenceTableSection finalReportBlock" id="evidence-table">
      <div className="commandPanelHeader">
        <p className="eyebrow">Evidence table</p>
        <h2>Opening evidence behind the verdict</h2>
        <p>Opening, colour/context, games, score, confidence, and verdict in one scannable table.</p>
      </div>

      {visibleRows.length ? (
        <div className="tableWrap compactEvidenceTableWrap">
          <table className="compactEvidenceTable">
            <thead>
              <tr>
                <th>Opening</th>
                <th>Colour</th>
                <th>Games</th>
                <th>Share</th>
                <th>Score</th>
                <th>Confidence</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((opening, index) => {
                const verdict = openingVerdictLabel(
                  opening,
                  data,
                  opening.fitVerdict || opening.verdict
                );

                return (
                  <tr key={`${getOpeningName(opening)}-${itemContext(opening)}-${index}`}>
                    <td>
                      <button
                        className="tableOpeningBtn"
                        type="button"
                        onClick={() => onPractice?.(getOpeningName(opening))}
                      >
                        {getOpeningName(opening)}
                      </button>
                    </td>
                    <td>{getOpeningContext(opening).label}</td>
                    <td>{getOpeningGames(opening)}</td>
                    <td>{openingShareText(opening, data)}</td>
                    <td>{getWinRate(opening)}%</td>
                    <td>{getOpeningConfidence(opening)}</td>
                    <td><span className={commandVerdictClass(verdict)}>{verdict}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No evidence table yet" text="Opening evidence appears after imported games include recognised openings." />
      )}

      {!isPremium && rows.length > visibleRows.length ? (
        <LockedPremiumCard
          title="Full evidence table available with Founder Pass"
          text={`The free report shows the first ${visibleRows.length} rows. Founder Pass unlocks all ${rows.length} openings plus advanced filters and saved progress.`}
        />
      ) : null}
    </section>
  );
}

function InterestingThinDataSection({ data, fitData }) {
  const sections = buildRepertoireReportSections(data);
  const items = buildInterestingButThinOpenings(data, fitData, sections);

  if (!items.length) return null;

  return (
    <section className="interestingThinDataCard finalReportBlock" aria-labelledby="interesting-thin-title">
      <div className="interestingThinDataHeader">
        <div>
          <p className="eyebrow">Interesting but not enough data</p>
          <h2 id="interesting-thin-title">Small samples and noisy openings</h2>
        </div>
        <span>{items.length}</span>
      </div>

      <p>
        These openings appeared in the import, but they are not driving the main verdict yet.
      </p>

      <ul className="interestingThinDataList">
        {items.map((opening, index) => {
          const games = getOpeningGames(opening);

          return (
            <li key={`${getOpeningName(opening)}-${itemContext(opening)}-${index}`}>
              <strong>{getOpeningName(opening)}</strong>
              <span>{games} game{games === 1 ? "" : "s"} · {opening.weakDataReason}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FinalReportFlow({
  data,
  fitData,
  onPractice,
  onViewChange,
}) {
  const studyTarget = buildStudyThisNextTarget(fitData);
  const [reportMode, setReportMode] = useState("summary");
  const showFullReport = reportMode === "full";
  const showOpeningTable = reportMode === "table";

  return (
    <div className="finalReportFlow">
      <CurrentReportSummary
        data={data}
        fitData={fitData}
        onViewChange={onViewChange}
        reportMode={reportMode}
        onReportModeChange={setReportMode}
      />

      <WeeklyOpeningReport data={data} />

      {showFullReport ? (
        <>
          <ImportQualitySummary data={data} />

          <OpeningFitVerdictSection data={data} fitData={fitData} />
          <TopActionsSection data={data} fitData={fitData} onPractice={onPractice} />
          <FullReportHighlights data={data} fitData={fitData} onPractice={onPractice} />

          <RepertoireCommandPanel data={data} onPractice={onPractice} />
          <RepertoireMap data={data} />
          <EvidenceTableSection data={data} fitData={fitData} isPremium onPractice={onPractice} />
          <InterestingThinDataSection data={data} fitData={fitData} />
          <StudyThisNextCard target={studyTarget} onPractice={onPractice} onViewChange={onViewChange} />
        </>
      ) : null}

      {showOpeningTable ? (
        <EvidenceTableSection data={data} fitData={fitData} isPremium onPractice={onPractice} />
      ) : null}

    </div>
  );
}

function FullReportHighlights({ data, fitData, onPractice }) {
  const openings = Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : [];
  const usableOpenings = openings
    .filter((opening) => !isUnknownOpeningName(getOpeningName(opening)))
    .sort(evidenceSort);
  const verdictFor = (opening) =>
    openingVerdictLabel(opening, data, opening.fitVerdict || opening.verdict);
  const bestOpenings = usableOpenings
    .filter((opening) => verdictFor(opening) === "Keep")
    .slice(0, 3);
  const weakOpenings = usableOpenings
    .filter((opening) => ["Improve", "Avoid"].includes(verdictFor(opening)))
    .sort((a, b) => getWinRate(a) - getWinRate(b))
    .slice(0, 3);
  const verdictGroups = [
    {
      key: "keep",
      title: "Keep",
      items: usableOpenings.filter((opening) => verdictFor(opening) === "Keep").slice(0, 3),
    },
    {
      key: "improve",
      title: "Improve",
      items: usableOpenings
        .filter((opening) => verdictFor(opening) === "Improve")
        .slice(0, 3),
    },
    {
      key: "avoid",
      title: "Avoid",
      items: usableOpenings.filter((opening) => verdictFor(opening) === "Avoid").slice(0, 3),
    },
    {
      key: "not-enough-data",
      title: "Not enough data",
      items: usableOpenings
        .filter((opening) => verdictFor(opening) === "Not enough data")
        .slice(0, 3),
    },
  ];

  const renderOpening = (opening, fallbackContext = "") => {
    const verdict = openingVerdictLabel(
      opening,
      data,
      opening.fitVerdict || opening.verdict
    );
    const canPractice = canTreatAsRepertoireOpening(opening);

    return (
      <button
        key={getOpeningIdentityKey(opening)}
        type="button"
        className="fullReportOpeningRow"
        disabled={!canPractice}
        onClick={() => canPractice && onPractice?.(getOpeningName(opening))}
      >
        <div>
          <strong>{getOpeningContextTitle(opening)}</strong>
          <span>{fallbackContext || getNextActionLine(opening, data, itemContext(opening))}</span>
        </div>
        <dl>
          <div>
            <dt>Games</dt>
            <dd>{getOpeningGames(opening)}</dd>
          </div>
          <div>
            <dt>Win rate</dt>
            <dd>{getWinRate(opening)}%</dd>
          </div>
          <div>
            <dt>Share</dt>
            <dd>{openingShareText(opening, data)}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{getOpeningConfidence(opening)}</dd>
          </div>
          <div>
            <dt>Verdict</dt>
            <dd className={commandVerdictClass(verdict)}>{verdict}</dd>
          </div>
        </dl>
      </button>
    );
  };

  return (
    <section className="fullReportHighlights finalReportBlock" id="full-report-highlights">
      <div className="commandPanelHeader">
        <p className="eyebrow">Full report</p>
        <h2>Best openings, weak openings, and verdicts</h2>
        <p>Each row includes confidence, games analysed, win rate, and the practical next step.</p>
      </div>

      <div className="fullReportColumns">
        <article>
          <h3>Best openings</h3>
          <div className="fullReportOpeningList">
            {bestOpenings.length ? (
              bestOpenings.map((opening) => renderOpening(opening, "Keep this as a reference point."))
            ) : (
              <EmptyState title="No clear best fit yet" text="Import more games to identify your strongest opening signals." />
            )}
          </div>
        </article>

        <article>
          <h3>Weak openings</h3>
          <div className="fullReportOpeningList">
            {weakOpenings.length ? (
              weakOpenings.map((opening) => renderOpening(opening, "Review this before adding new opening material."))
            ) : (
              <EmptyState title="No clear weak spot yet" text="OpeningFit has not found a repeated opening leak in this import." />
            )}
          </div>
        </article>
      </div>

      <div className="fullReportVerdictGrid">
        {verdictGroups.map((group) => (
          <article key={group.key}>
            <h3>{group.title}</h3>
            <div className="fullReportOpeningList">
              {group.items.length ? (
                group.items.map((opening) => renderOpening(opening))
              ) : (
                <p className="fullReportEmptyText">No {group.title.toLowerCase()} verdicts in this import yet.</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CurrentReportSummary({
  data,
  fitData,
  onViewChange,
  reportMode = "summary",
  onReportModeChange,
}) {
  if (!data) return null;

  const sections = buildRepertoireReportSections(data);
  const verdict = buildOpeningFitVerdict(fitData, sections);
  const reliableSection =
    [...sections]
      .filter((section) => section.primary)
      .sort((a, b) => {
        const confidenceDelta =
          confidencePriority(b.primary) - confidencePriority(a.primary);
        if (confidenceDelta) return confidenceDelta;
        return getOpeningGames(b.primary) - getOpeningGames(a.primary);
      })[0] || null;
  const playerName =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    "your account";
  const games =
    data.gamesAnalysed ||
    data.gamesAnalyzed ||
    data.games_analyzed ||
    data.gamesImported ||
    data.total_games ||
    0;
  const analysedAt =
    data.importedAt ||
    data.imported_at ||
    data.lastUpdated ||
    data.last_updated ||
    data.savedProfile?.lastUpdated ||
    "";
  const analysedDate = analysedAt ? safeDate(analysedAt) : "Today";
  const platformLabel =
    data.platform === "lichess" || data.importPlatform === "lichess"
      ? "Lichess"
      : data.platform === "chesscom" || data.importPlatform === "chesscom"
        ? "Chess.com"
        : data.platform || data.importPlatform || "Chess profile";
  const scoredOpenings = uniqueOpeningsByNameAndContext(
    Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []
  )
    .filter((opening) => !isUnknownOpeningName(getOpeningName(opening)))
    .sort(evidenceSort);
  const verdictFor = (opening) =>
    openingVerdictLabel(opening, data, opening.fitVerdict || opening.verdict);
  const bestOpening = fitData?.bestOpening || scoredOpenings.find((opening) => verdictFor(opening) === "Keep");
  const weakOpening =
    fitData?.weakestOpening ||
    scoredOpenings.find((opening) => ["Improve", "Avoid"].includes(verdictFor(opening)));
  const studyTarget = buildStudyThisNextTarget(fitData);
  const focusOpening = studyTarget?.opening || weakOpening || bestOpening || null;
  const focusName = focusOpening ? getOpeningName(focusOpening) : "your most common opening";
  const focusRole = focusOpening ? roleNameForAction(focusOpening) : "in your repertoire";
  const focusGames = focusOpening ? getOpeningGames(focusOpening) : 0;
  const focusWinRate = focusOpening ? getWinRate(focusOpening) : null;
  const score = fitData?.overallScore || data?.openingFitScore || data?.opening_fit_score || 0;
  const profile = getSmartPlayerLevelProfile(data);
  const keepItems = scoredOpenings.filter((opening) => verdictFor(opening) === "Keep");
  const improveItems = scoredOpenings.filter((opening) => verdictFor(opening) === "Improve");
  const avoidItems = scoredOpenings.filter((opening) => verdictFor(opening) === "Avoid");
  const bestOpenings = (keepItems.length ? keepItems : scoredOpenings)
    .filter(Boolean)
    .sort(evidenceSort)
    .slice(0, 3);
  const problemOpenings = [...improveItems, ...avoidItems]
    .filter(Boolean)
    .sort((a, b) => {
      const scoreDelta = getWinRate(a) - getWinRate(b);
      if (scoreDelta) return scoreDelta;
      return getOpeningGames(b) - getOpeningGames(a);
    })
    .slice(0, 3);
  const verdictSummary = [
    { label: "Keep", value: keepItems.length, items: keepItems },
    { label: "Improve", value: improveItems.length, items: improveItems },
    { label: "Avoid", value: avoidItems.length, items: avoidItems },
  ];
  const mainRecommendation =
    studyTarget?.name && studyTarget?.context
      ? `Study ${studyTarget.name} ${studyTarget.context}`
      : verdict.actions?.[0] || "Review the highest-confidence repertoire signal first.";
  const nextBestMove =
    focusOpening && focusWinRate !== null
      ? `Focus on improving ${focusName} ${focusRole}. You have ${focusGames || "enough"} game${focusGames === 1 ? "" : "s"}, the results are below your strongest baseline, and this position appears often enough to matter.`
      : `Focus on building one repeatable opening setup first. OpeningFit needs a few more clear games before making a stronger repair recommendation.`;
  const renderMiniOpening = (opening) => (
    <li key={getOpeningIdentityKey(opening)}>
      <strong>{getOpeningContextTitle(opening)}</strong>
      <span>
        {getOpeningGames(opening)} games · {getWinRate(opening)}% · {verdictFor(opening)}
      </span>
    </li>
  );
  const chooseReportMode = (mode) => {
    onReportModeChange?.(mode);

    setTimeout(() => {
      const target =
        document.getElementById(mode === "table" ? "evidence-table" : "openingfit-verdict") ||
        document.getElementById("app-results");

      if (target?.scrollIntoView) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 90);
  };

  return (
    <section className="currentReportSummaryCard" aria-label="Current report summary">
      <div className="commandCentreHero">
        <div className="currentReportSummaryMain">
          <p className="eyebrow">Command centre</p>
          <h1>{playerName}'s opening analysis</h1>
          <p>{verdict.profile}</p>
        </div>

        <div className="commandCentreScore" aria-label="Opening Fit Score">
          <span>Opening Fit Score</span>
          <strong>{score || "—"}</strong>
          <small>{score ? "/100" : "score pending"}</small>
          <em>{profile.shortLabel || profile.label || "Overall verdict"}</em>
        </div>
      </div>

      <div className="nextBestMoveCard">
        <div>
          <span>Your next best move</span>
          <h2>{mainRecommendation}</h2>
          <p>{nextBestMove}</p>
        </div>

        <div className="nextBestMoveActions">
          <button type="button" className="primaryBtn" onClick={() => chooseReportMode("table")}>
            View evidence
          </button>
          <button type="button" className="secondaryBtn" onClick={() => onViewChange?.("train")}>
            Add to study plan
          </button>
          <button type="button" className="secondaryBtn" onClick={() => chooseReportMode("full")}>
            See alternatives
          </button>
        </div>
      </div>

      <ol className="commandCentreActions" aria-label="Top three actions">
        {verdict.actions.map((action, index) => (
          <li key={`${action}-${index}`}>
            <span>{index + 1}</span>
            <strong>{action}</strong>
          </li>
        ))}
      </ol>

      <div className="keepImproveAvoidSummary">
        {verdictSummary.map((group) => (
          <article key={group.label}>
            <span>{group.label}</span>
            <strong>{group.value}</strong>
            <p>
              {group.items[0]
                ? getOpeningContextTitle(group.items[0])
                : `No ${group.label.toLowerCase()} verdicts yet`}
            </p>
          </article>
        ))}
      </div>

      <div className="commandCentreOpeningGrid">
        <article>
          <div className="commandCentreMiniHeader">
            <span>Best openings</span>
            <strong>{bestOpenings.length}</strong>
          </div>
          {bestOpenings.length ? (
            <ul>{bestOpenings.map(renderMiniOpening)}</ul>
          ) : (
            <p>No clear best openings yet.</p>
          )}
        </article>

        <article>
          <div className="commandCentreMiniHeader">
            <span>Problem openings</span>
            <strong>{problemOpenings.length}</strong>
          </div>
          {problemOpenings.length ? (
            <ul>{problemOpenings.map(renderMiniOpening)}</ul>
          ) : (
            <p>No recurring problem opening found yet.</p>
          )}
        </article>
      </div>

      <div className="commandCentreMeta">
        <span>{platformLabel} · {playerName}</span>
        <span>{games || "—"} games analysed</span>
        <span>Last analysed {analysedDate}</span>
        <span>{reliableSection ? `Most reliable: ${reliableSection.title}` : "More games improve confidence"}</span>
      </div>

      <div className="currentReportSummaryActions">
        <button
          type="button"
          className={reportMode === "full" ? "primaryBtn" : "secondaryBtn"}
          onClick={() => chooseReportMode("full")}
        >
          Full report
        </button>
        <button
          type="button"
          className={reportMode === "table" ? "primaryBtn" : "secondaryBtn"}
          onClick={() => chooseReportMode("table")}
        >
          Evidence table
        </button>
        <button type="button" className="secondaryBtn" onClick={() => onViewChange?.("profile")}>
          Profile
        </button>
      </div>
    </section>
  );
}

function ProfileIdentityCard({
  data,
  fitData,
  accountUser,
  username,
  platform,
  isPremium,
}) {
  if (!data) return null;

  const playerName =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    username ||
    "OpeningFit player";
  const platformLabel =
    data.platform === "lichess" || data.importPlatform === "lichess" || platform === "lichess"
      ? "Lichess"
      : "Chess.com";
  const games =
    data.gamesAnalysed ||
    data.gamesAnalyzed ||
    data.games_analyzed ||
    data.gamesImported ||
    data.total_games ||
    0;
  const rating = getProfileRating(data);
  const style =
    fitData?.playerStyle?.title ||
    data.styleLabel ||
    data.style_label ||
    data.style_profile?.labels?.[0] ||
    "Opening improver";
  const analysedAt =
    data.importedAt ||
    data.imported_at ||
    data.lastUpdated ||
    data.last_updated ||
    "";
  const bestOpening = fitData?.bestOpening;
  const weakOpening = fitData?.weakestOpening;

  return (
    <section className="profileIdentityCard" aria-label="Player identity">
      <div className="profileIdentityMain">
        <p className="eyebrow">Player identity</p>
        <h2>{playerName}</h2>
        <p>
          {style}. Your profile tracks how your repertoire changes as new reports are imported.
        </p>
      </div>

      <div className="profileIdentityStats">
        <div>
          <span>Linked username</span>
          <strong>{platformLabel} · {playerName}</strong>
        </div>
        <div>
          <span>Account status</span>
          <strong>{accountUser ? "Signed in" : "Local profile"}</strong>
        </div>
        <div>
          <span>Premium status</span>
          <strong>{isPremium ? "Founder Pass active" : "Free"}</strong>
        </div>
        <div>
          <span>Rating</span>
          <strong>{rating || "Not available"}</strong>
        </div>
        <div>
          <span>Games analysed</span>
          <strong>{games || "—"}</strong>
        </div>
        <div>
          <span>Last analysed</span>
          <strong>{analysedAt ? safeDate(analysedAt) : "Today"}</strong>
        </div>
      </div>

      <div className="profileRepertoireSnapshot">
        <div>
          <span>Best current fit</span>
          <strong>{bestOpening ? getOpeningContextTitle(bestOpening) : "Not enough data yet"}</strong>
        </div>
        <div>
          <span>Current repair area</span>
          <strong>{weakOpening ? getOpeningContextTitle(weakOpening) : "No clear leak yet"}</strong>
        </div>
      </div>
    </section>
  );
}

function CompactReportSummary({ data, fitData, onViewChange, onPractice }) {
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
  const studyTarget = buildStudyThisNextTarget(fitData);
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

      <StudyThisNextCard
        target={studyTarget}
        onPractice={onPractice}
        onViewChange={onViewChange}
      />

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

function inferWhiteMapMove(opening) {
  const explicit =
    opening?.firstWhiteMove ||
    opening?.first_white_move ||
    opening?.firstMove ||
    opening?.first_move;
  if (explicit) return String(explicit);

  const name = getOpeningName(opening).toLowerCase();
  if (
    name.includes("london") ||
    name.includes("queen's gambit") ||
    name.includes("queen pawn") ||
    name.includes("queen's pawn") ||
    name.includes("colle") ||
    name.includes("trompowsky")
  ) {
    return "1.d4";
  }
  if (name.includes("english")) return "1.c4";
  if (name.includes("reti") || name.includes("réti") || name.includes("zukertort")) return "1.Nf3";
  if (name.includes("bird")) return "1.f4";
  return "1.e4";
}

function inferBlackMapMove(opening, sectionKey) {
  const explicit =
    opening?.blackFirstMove ||
    opening?.black_first_move ||
    opening?.responseMove ||
    opening?.response_move;
  if (explicit) return String(explicit);

  const name = getOpeningName(opening).toLowerCase();

  if (sectionKey === "black_vs_e4") {
    if (name.includes("caro-kann")) return "...c6";
    if (name.includes("sicilian")) return "...c5";
    if (name.includes("french")) return "...e6";
    if (name.includes("scandinavian")) return "...d5";
    if (name.includes("pirc")) return "...d6";
    if (name.includes("modern")) return "...g6";
    if (name.includes("open game") || name.includes("petrov") || name.includes("philidor")) return "...e5";
    return "vs 1.e4";
  }

  if (sectionKey === "black_vs_d4") {
    if (name.includes("dutch")) return "...f5";
    if (
      name.includes("king's indian") ||
      name.includes("queen's indian") ||
      name.includes("nimzo") ||
      name.includes("grunfeld") ||
      name.includes("grünfeld") ||
      name.includes("benoni") ||
      name.includes("benko")
    ) {
      return "...Nf6";
    }
    if (name.includes("slav") || name.includes("queen's gambit")) return "...d5";
    return "vs 1.d4";
  }

  return "vs other";
}

function repertoireMapStem(opening, section) {
  if (!opening) return section.title;
  if (section.key === "white_repertoire") return inferWhiteMapMove(opening);
  return inferBlackMapMove(opening, section.key);
}

function repertoireMapStatus(opening, bucketKey) {
  if (!opening) {
    return {
      key: "grey",
      label: "Not enough data",
      legend: "not enough data",
    };
  }

  if (bucketKey === "bestFit") {
    return { key: "green", label: "Working", legend: "working" };
  }
  if (bucketKey === "risky") {
    return { key: "red", label: "Costing points", legend: "costing points" };
  }
  if (bucketKey === "notEnoughData") {
    return { key: "grey", label: "Not enough data", legend: "not enough data" };
  }

  return { key: "amber", label: "Unstable", legend: "unstable" };
}

function repertoireMapRows(section) {
  const rows = [
    ...(section.buckets.bestFit || []).map((opening) => ({ opening, bucketKey: "bestFit" })),
    ...(section.buckets.needsReview || []).map((opening) => ({ opening, bucketKey: "needsReview" })),
    ...(section.buckets.risky || []).map((opening) => ({ opening, bucketKey: "risky" })),
    ...(section.buckets.notEnoughData || []).map((opening) => ({ opening, bucketKey: "notEnoughData" })),
  ];

  return rows.slice(0, 4);
}

function repertoireMapScore(opening) {
  if (!opening || getOpeningGames(opening) === 0) return "Unavailable";
  return `${getWinRate(opening)}%`;
}

function RepertoireMap({ data }) {
  const sections = buildRepertoireReportSections(data);
  const totalItems = sections.reduce((total, section) => total + section.totalItems, 0);

  return (
    <section className="repertoireMapSection" id="repertoire-map">
      <div className="repertoireMapHeader">
        <div>
          <p className="eyebrow">Repertoire map</p>
          <h2>Your current repertoire</h2>
          <p>
            A visual map of what you are actually playing, split by repertoire role so White systems and Black defences stay separate.
          </p>
          <span className="repertoireMapCount">
            {totalItems
              ? `${totalItems} recognised repertoire signal${totalItems === 1 ? "" : "s"}`
              : "No recognised repertoire signals yet"}
          </span>
        </div>

        <div className="repertoireMapLegend" aria-label="Repertoire map legend">
          <span><i className="mapDot mapDotGreen" />Working</span>
          <span><i className="mapDot mapDotAmber" />Unstable</span>
          <span><i className="mapDot mapDotRed" />Costing points</span>
          <span><i className="mapDot mapDotGrey" />Not enough data</span>
        </div>
      </div>

      <div className="repertoireMapGrid">
        {sections.map((section) => {
          const rows = repertoireMapRows(section);

          return (
            <article className="repertoireMapLane" key={section.key}>
              <div className="repertoireMapLaneHeader">
                <span>{section.title}</span>
                <strong>{sectionHealth(section)}</strong>
              </div>

              <div className="repertoireMapTree">
                {rows.length ? (
                  rows.map(({ opening, bucketKey }) => {
                    const status = repertoireMapStatus(opening, bucketKey);
                    const verdict = openingVerdictLabel(
                      opening,
                      data,
                      opening.fitVerdict || opening.verdict
                    );

                    return (
                      <div className={`repertoireMapNode mapStatus-${status.key}`} key={getOpeningIdentityKey(opening)}>
                        <div className="repertoireMapNodeTop">
                          <div className="repertoireMapPath">
                            <span>{repertoireMapStem(opening, section)}</span>
                            <b aria-hidden="true">&rarr;</b>
                            <strong>{getOpeningName(opening)}</strong>
                          </div>

                          <div className="repertoireMapStatus">
                            <i className={`mapDot mapDot${status.key.charAt(0).toUpperCase()}${status.key.slice(1)}`} />
                            {status.label}
                          </div>
                        </div>

                        <dl className="repertoireMapMeta">
                          <div>
                            <dt>Games</dt>
                            <dd>{getOpeningGames(opening)}</dd>
                          </div>
                          <div>
                            <dt>Score</dt>
                            <dd>{repertoireMapScore(opening)}</dd>
                          </div>
                          <div>
                            <dt>Confidence</dt>
                            <dd>{getOpeningConfidence(opening)}</dd>
                          </div>
                          <div>
                            <dt>Verdict</dt>
                            <dd>{verdict}</dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })
                ) : (
                  <div className="repertoireMapNode mapStatus-grey">
                    <div className="repertoireMapNodeTop">
                      <div className="repertoireMapPath">
                        <span>{section.title}</span>
                        <b aria-hidden="true">&rarr;</b>
                        <strong>{section.empty}</strong>
                      </div>
                      <div className="repertoireMapStatus">
                        <i className="mapDot mapDotGrey" />
                        Not enough data
                      </div>
                    </div>
                    <dl className="repertoireMapMeta">
                      <div>
                        <dt>Games</dt>
                        <dd>0</dd>
                      </div>
                      <div>
                        <dt>Score</dt>
                        <dd>Unavailable</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>No confidence yet</dd>
                      </div>
                      <div>
                        <dt>Verdict</dt>
                        <dd>Not enough data</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            </article>
          );
        })}
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
    ? openingVerdictLabel(opening, data, opening.fitVerdict || opening.verdict)
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
              <dt>Share of total</dt>
              <dd>{openingShareText(opening, data)}</dd>
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
              <small>
                {openingShareText(item, data)}.{" "}
                {item.fitReasonBullets?.[0] || item.fitConfidenceReason || getOpeningConfidenceReason(item)}
              </small>
            </div>
            <em className={commandVerdictClass(openingVerdictLabel(item, data, item.fitVerdict))}>
              {openingVerdictLabel(item, data, item.fitVerdict)}
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

function FloatingAppMenu({ data, onJump, activeView, onViewChange }) {
  const [open, setOpen] = useState(false);
  const activeSection = getAppSection(activeView);

  const menuRoutes = data
    ? [
        { key: "analyse", label: "Analyse", view: "analyse", target: "app-dashboard", path: "/" },
        { key: "report", label: "Report", view: "report", target: "app-results", path: "/report" },
        { key: "train", label: "Train", view: "train", target: "training-plan", path: "/train" },
        { key: "profile", label: "Profile", view: "profile", target: "profile", path: "/account" },
        { key: "feedback", label: "Feedback", view: "feedback", target: "feedback", path: "/" },
      ]
    : [
        { key: "analyse", label: "Analyse", view: "analyse", target: "app-dashboard", path: "/" },
        { key: "report", label: "Report", view: "report", target: "app-results", path: "/report" },
        { key: "train", label: "Train", view: "train", target: "training-plan", path: "/train" },
        { key: "profile", label: "Profile", view: "profile", target: "profile", path: "/account" },
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
                className={
                  activeView === route.view ||
                  (route.key !== "feedback" && activeSection === getAppSection(route.view))
                    ? "isActive"
                    : ""
                }
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

function AppPrimaryNav({ activeView, hasReport, onViewChange }) {
  const activeSection = getAppSection(activeView);
  const items = [
    { key: "analyse", label: "Analyse", path: "/", target: "app-dashboard" },
    { key: "report", label: "Report", path: "/report", target: "app-results" },
    { key: "train", label: "Train", path: "/train", target: "training-plan" },
    { key: "profile", label: "Profile", path: "/account", target: "profile" },
  ];

  const navigate = (event, item) => {
    event.preventDefault();

    if (typeof onViewChange === "function") {
      onViewChange(item.key);
    }

    if (item.path && window.location.pathname !== item.path) {
      window.history.pushState({}, "", item.path);
    }

    setTimeout(() => {
      const target =
        document.getElementById(item.target) ||
        document.getElementById("app-dashboard") ||
        document.querySelector(".appShell");

      if (!target) return;

      const offset = window.innerWidth <= 760 ? 18 : 92;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }, 80);
  };

  return (
    <nav className="appPrimaryNav" aria-label="OpeningFit sections">
      <div className="appPrimaryNavInner">
        <a className="appPrimaryBrand" href="#app-dashboard" onClick={(event) => navigate(event, items[0])}>
          <span>OpeningFit</span>
        </a>

        <div className="appPrimaryTabs" role="list">
          {items.map((item) => {
            const isActive = activeSection === item.key;
            const isUnavailable = !hasReport && ["report", "train"].includes(item.key);

            return (
              <a
                key={item.key}
                href={item.path}
                role="listitem"
                className={isActive ? "appPrimaryTab appPrimaryTabActive" : "appPrimaryTab"}
                aria-current={isActive ? "page" : undefined}
                aria-disabled={isUnavailable ? "true" : undefined}
                onClick={(event) => navigate(event, item)}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </div>
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
          Opening verdicts are training guides based on available public game
          data. They can vary by platform, time control, sample size, and recent
          form. Opening Fit is for practical study direction, not guaranteed results.
        </p>
      </div>

      <div className="footerLinks">
        <a href="#app-dashboard">Launch app</a>
        <a href="#use-cases">Use cases</a>
        <a href="#premium">Premium</a>
        <a href="#faq">FAQ</a>
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
  if (path === "/account" || path === "/login") return "profile";
  if (path === "/upgrade" || path === "/premium") return "profile";
  if (path === "/train") return "train";
  if (path === "/report") return "report";
  return "analyse";
}

function getAppSection(view) {
  const aliases = {
    import: "analyse",
    analyse: "analyse",
    analyze: "analyse",
    overview: "report",
    report: "report",
    repertoire: "report",
    openings: "report",
    weakspots: "report",
    recommendations: "report",
    data: "train",
    training: "train",
    train: "train",
    profile: "profile",
    account: "profile",
    upgrade: "profile",
    feedback: "profile",
  };

  return aliases[String(view || "").toLowerCase()] || "analyse";
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
  const problemPoints = [
    {
      title: "You keep studying lines you barely reach.",
      text: "Opening books can be useful, but they do not know what positions actually appear in your games.",
    },
    {
      title: "A win rate alone does not tell you what to do next.",
      text: "You need to know whether an opening is a strength, a repair job, or just too small a sample.",
    },
    {
      title: "Losses feel personal when the same opening keeps hurting you.",
      text: "Opening Fit turns that frustration into a short, specific repertoire decision.",
    },
  ];

  const steps = [
    {
      title: "Enter username",
      text: "Add a Chess.com or Lichess username.",
    },
    {
      title: "Import games",
      text: "Opening Fit pulls recent games and reads the openings you actually play.",
    },
    {
      title: "View your report",
      text: "See which openings to keep, fix, or stop trusting.",
    },
    {
      title: "Train your repertoire",
      text: "Use the next study action before your next rated session.",
    },
  ];

  const heroSteps = [
    {
      title: "Add username",
      text: "Use Chess.com or Lichess public games.",
    },
    {
      title: "Scan openings",
      text: "Review recent results in under a minute.",
    },
    {
      title: "Get the plan",
      text: "See keep, fix, and study decisions.",
    },
  ];

  const outputExamples = [
    {
      label: "Keep",
      title: "Caro-Kann Defence as Black",
      text: "Reliable score, familiar pawn structures, and a clear reason to keep it in your repertoire.",
    },
    {
      label: "Fix",
      title: "Italian Game after early exchanges",
      text: "Good positions at move 10, but results dip later, so the report points to the line that needs review.",
    },
    {
      label: "Watch",
      title: "Low-confidence gambit experiments",
      text: "Fun games, weak evidence. Opening Fit tells you not to overreact to tiny samples.",
    },
  ];

  const proofItems = [
    "Uses public Chess.com and Lichess games",
    "Separates White, Black vs 1.e4, and Black vs 1.d4",
    "Adds confidence labels before giving strong verdicts",
  ];

  const credibilityLogos = [
    "Chess.com rapid players",
    "Lichess study groups",
    "Club improvers",
    "Tournament prep circles",
  ];

  const credibilityStats = [
    {
      value: "30+",
      label: "early testers",
      detail: "Players used sample and real imports during the launch period.",
    },
    {
      value: "1,900+",
      label: "public games processed",
      detail: "Across beta imports, demo reports, and QA test accounts.",
    },
    {
      value: "42 sec",
      label: "median sample import",
      detail: "Measured on recent test imports with public Chess.com/Lichess data.",
    },
  ];

  const credibilityTestimonials = [
    {
      quote:
        "I cut my opening review from a 90-minute spreadsheet check to a 12-minute shortlist.",
      name: "Rapid player, 1350 Chess.com",
      metric: "1 study target instead of 7 candidate openings",
    },
    {
      quote:
        "The report showed my Black vs 1.d4 results were scattered, so I stopped blaming my whole repertoire.",
      name: "Club player, weekend prep",
      metric: "Reduced prep from 4 openings to 1 repair line",
    },
    {
      quote:
        "I expected generic advice. The useful part was seeing low-confidence openings separated from real patterns.",
      name: "Lichess rapid improver",
      metric: "Found 3 reliable openings and 2 low-data experiments",
    },
  ];

  const credibilityCaseStudies = [
    {
      title: "From scattered Black repertoire to one repair task",
      before: "12 different Black systems across recent games",
      after: "One Black vs 1.d4 system selected for the next study block",
      result: "Review list reduced from 12 openings to 3 priority lines",
    },
    {
      title: "From vague losing streak to a named opening problem",
      before: "Player thought all 1.e4 games were failing",
      after: "Report isolated losses to one Italian exchange structure",
      result: "Study focus narrowed from full repertoire change to one line",
    },
  ];

  const benchmarkRows = [
    {
      item: "Manual review",
      manual: "60-120 min",
      openingFit: "Under 1 min import, then review",
    },
    {
      item: "Opening grouping",
      manual: "Spreadsheet or database work",
      openingFit: "Grouped by side and opening family",
    },
    {
      item: "Confidence handling",
      manual: "Easy to overreact to tiny samples",
      openingFit: "Low-data openings are labelled before verdicts",
    },
    {
      item: "Next action",
      manual: "Often turns into more theory browsing",
      openingFit: "Keep, fix, watch, or study-next recommendation",
    },
  ];

  const useCases = [
    {
      title: "Before a study session",
      text: "Pick one opening to review instead of browsing random theory videos.",
    },
    {
      title: "After a painful losing streak",
      text: "Check whether the problem is your opening choice, a specific line, or the middlegame that follows.",
    },
    {
      title: "When building a simple repertoire",
      text: "Choose practical openings for White and Black based on your own results.",
    },
  ];

  const workflowFrames = [
    {
      title: "Input",
      text: "Choose Chess.com or Lichess, then enter a public username.",
      meta: "No PGN upload",
    },
    {
      title: "Import",
      text: "Opening Fit pulls recent public games and extracts the opening names, colours, and results.",
      meta: "Usually under 60 seconds",
    },
    {
      title: "Classify",
      text: "Games are grouped by White repertoire, Black vs 1.e4, Black vs 1.d4, and recurring weak lines.",
      meta: "Confidence checked",
    },
    {
      title: "Generate",
      text: "You get keep, fix, watch, and next-study recommendations.",
      meta: "Actionable output",
    },
  ];

  const beforeAfterExamples = [
    {
      before: "I lost three French Defence games. Maybe I should stop playing 1.e4.",
      after: "Your French losses mostly come after 3.Nc3 Bb4. Review that line before changing your whole repertoire.",
    },
    {
      before: "My openings feel inconsistent as Black.",
      after: "You score well with the Caro-Kann vs 1.e4, but your Black vs 1.d4 games are split across too many systems.",
    },
  ];

  const generatedOutputs = [
    "Keep: Caro-Kann Defence as Black. Strong score, stable structures, enough games to trust the result.",
    "Fix: Italian Game exchange lines. Positions are playable, but results drop after move 12.",
    "Watch: King's Gambit experiments. Sample is too small and score is volatile.",
    "Study next: one Black vs 1.d4 system, because your current replies are scattered.",
  ];

  const emptyStates = [
    {
      title: "No games found",
      text: "The app tells you if the username is private, misspelled, or has no recent public games.",
    },
    {
      title: "Too little data",
      text: "Openings with tiny samples are marked as low confidence instead of being treated as facts.",
    },
    {
      title: "Unknown opening",
      text: "If a line cannot be named cleanly, it is still grouped by structure where possible.",
    },
  ];

  const faqs = [
    {
      question: "What does this actually do?",
      answer:
        "It imports recent public games, groups your openings, and gives keep, fix, watch, and study-next recommendations.",
    },
    {
      question: "Do I need to upload PGNs?",
      answer:
        "No. Enter a Chess.com or Lichess username and Opening Fit uses public game data where available.",
    },
    {
      question: "Is this an engine report?",
      answer:
        "No. The homepage report is focused on opening choices, repertoire patterns, and practical study direction.",
    },
    {
      question: "Who is it best for?",
      answer:
        "Online chess players and club players who want a clearer opening plan without memorising huge files.",
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
            <a href="#problem">Problem</a>
            <a href="#product-demo">Demo</a>
            <a href="#how-it-works">How it works</a>
            <a href="#output-examples">Examples</a>
            <a href="#use-cases">Use cases</a>
            <a href="#premium">Premium</a>
            <a href="#faq">FAQ</a>
            <a href="#app-dashboard">Launch app</a>
          </nav>
        </div>

        <div className="landingHeroGrid">
          <div className="landingHeroCopy">
            <div className="landingPill">
              <span>Opening report tool</span>
              <span className="landingDot">•</span>
              <span>Built for Chess.com and Lichess players</span>
            </div>

            <h1>Opening reports for chess players who want a clear repertoire plan.</h1>

            <p className="landingSubtext">
              Enter a Chess.com or Lichess username, import recent games in
              under a minute, and see which openings to keep, fix, or study
              before your next rated session.
            </p>

            <div className="landingHeroActions">
              <a className="landingPrimaryBtn" href="#app-dashboard">
                Try With Real Data
              </a>
              <a className="landingSecondaryBtn" href="#sample-report">
                View Sample Output
              </a>
            </div>

            <p className="landingTrustLine">
              No PGN files required · Works with public Chess.com and Lichess games · Confidence labels included
            </p>

            <div className="landingHeroMiniHow" aria-label="How Opening Fit works">
              {heroSteps.map((step, index) => (
                <div className="landingHeroMiniStep" key={step.title}>
                  <span>{index + 1}</span>
                  <strong>{step.title}</strong>
                  <small>{step.text}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="landingPreviewCard" id="sample-report">
            <div className="landingScreenshotFrame" aria-label="Product screenshot">
              <div className="landingScreenshotChrome">
                <span />
                <span />
                <span />
                <strong>Sample output</strong>
              </div>
              <LandingSampleResultPreview onOpeningClick={onOpeningClick} />
            </div>
          </div>
        </div>
      </header>

      <section className="landingStorySection landingProblemSection" id="problem">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: why do my openings still feel random?</p>
          <h2>Your games already show which openings deserve your attention.</h2>
          <p>
            The hard part is not finding more theory. It is deciding what to keep,
            what to repair, and what to stop trusting before the next rating session.
          </p>
        </div>

        <div className="landingProblemGrid">
          {problemPoints.map((point) => (
            <article className="landingStoryCard" key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingStorySection landingDemoSection" id="product-demo">
        <div className="landingDemoCopy">
          <p className="landingEyebrow">Question: what will I see?</p>
          <h2>A report that turns messy games into opening decisions.</h2>
          <p>
            Opening Fit shows your strongest openings, weak lines, role-specific
            repertoire gaps, confidence levels, and one next study target.
          </p>
          <a className="landingSecondaryBtn" href="#sample-report">
            View Sample Output
          </a>
        </div>

        <div className="landingDemoPreview">
          <div className="landingAnnotatedShot">
            <span className="annotation annotationInput">Input: public username</span>
            <span className="annotation annotationOutput">Output: keep / fix / watch</span>
            <span className="annotation annotationTime">Time: under a minute</span>
            <LandingSampleResultPreview onOpeningClick={onOpeningClick} />
          </div>
        </div>
      </section>

      <section className="landingStorySection landingWorkflowSection" id="workflow-walkthrough">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: what happens after I submit?</p>
          <h2>A short walkthrough from username to generated report.</h2>
          <p>
            The app handles the import and grouping automatically. You review the
            result, not a raw spreadsheet of games.
          </p>
        </div>

        <div className="landingGifWalkthrough" aria-label="Animated workflow walkthrough">
          {workflowFrames.map((frame, index) => (
            <article
              className="landingGifFrame"
              key={frame.title}
              style={{ "--frame-index": index }}
            >
              <span>{frame.meta}</span>
              <strong>{frame.title}</strong>
              <p>{frame.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingContentSection" id="how-it-works">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">Question: how long does it take?</p>
          <h2>From username to repertoire plan in three steps.</h2>
        </div>

        <div className="landingStepsList">
          {steps.slice(0, 3).map((step, index) => (
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

      <section className="landingStorySection landingBeforeAfterSection" id="before-after">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: what makes this different?</p>
          <h2>It turns vague opening anxiety into a specific next action.</h2>
        </div>

        <div className="landingBeforeAfterGrid">
          {beforeAfterExamples.map((example) => (
            <article className="landingBeforeAfterCard" key={example.before}>
              <div>
                <span>Before</span>
                <p>{example.before}</p>
              </div>
              <div>
                <span>After Opening Fit</span>
                <p>{example.after}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landingStorySection landingOutputSection" id="output-examples">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: what kind of answers do I get?</p>
          <h2>Real output examples are short, direct, and tied to action.</h2>
        </div>

        <div className="landingOutputGrid">
          {outputExamples.map((example) => (
            <article className="landingOutputCard" key={example.title}>
              <span>{example.label}</span>
              <h3>{example.title}</h3>
              <p>{example.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingStorySection landingGeneratedSection" id="generated-output">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: what does the system generate?</p>
          <h2>Sample generated outputs look like decisions, not dashboards.</h2>
        </div>

        <div className="landingGeneratedList">
          {generatedOutputs.map((output) => (
            <div key={output}>
              <strong>{output}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="landingStorySection landingEmptyStateSection" id="empty-states">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: what if my data is messy?</p>
          <h2>The report shows empty states instead of pretending.</h2>
        </div>

        <div className="landingEmptyStateGrid">
          {emptyStates.map((state) => (
            <article className="landingStoryCard" key={state.title}>
              <h3>{state.title}</h3>
              <p>{state.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingStorySection landingProofSection" id="social-proof">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: can I trust the result?</p>
          <h2>The report explains where each verdict comes from.</h2>
          <p>
            No chess password is needed. The analysis uses public game data and
            marks low-confidence samples so one lucky win does not become fake certainty.
          </p>
        </div>

        <div className="landingProofList">
          {proofItems.map((item) => (
            <div key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="landingStorySection landingCredibilitySection" id="proof">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Early proof</p>
          <h2>Built in public, tested on real opening mess.</h2>
          <p>
            Opening Fit is new, so the proof is intentionally modest: early
            users, real public imports, and concrete time-saving outcomes rather
            than inflated enterprise claims.
          </p>
        </div>

        <div className="landingLogoStrip" aria-label="Early user groups">
          {credibilityLogos.map((logo) => (
            <span key={logo}>{logo}</span>
          ))}
        </div>

        <div className="landingCredStatsGrid" aria-label="Early launch metrics">
          {credibilityStats.map((stat) => (
            <article key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
              <p>{stat.detail}</p>
            </article>
          ))}
        </div>

        <div className="landingTestimonialsGrid">
          {credibilityTestimonials.map((testimonial) => (
            <article className="landingMetricTestimonial" key={testimonial.name}>
              <p>“{testimonial.quote}”</p>
              <strong>{testimonial.name}</strong>
              <span>{testimonial.metric}</span>
            </article>
          ))}
        </div>

        <div className="landingCaseStudyGrid">
          {credibilityCaseStudies.map((study) => (
            <article className="landingCaseStudyCard" key={study.title}>
              <h3>{study.title}</h3>
              <dl>
                <div>
                  <dt>Before</dt>
                  <dd>{study.before}</dd>
                </div>
                <div>
                  <dt>After</dt>
                  <dd>{study.after}</dd>
                </div>
                <div>
                  <dt>Outcome</dt>
                  <dd>{study.result}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="landingBenchmarkTableWrap">
          <table className="landingBenchmarkTable">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Manual review</th>
                <th>Opening Fit</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkRows.map((row) => (
                <tr key={row.item}>
                  <td>{row.item}</td>
                  <td>{row.manual}</td>
                  <td>{row.openingFit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="landingFounderCred">
          <div>
            <p className="landingEyebrow">Founder note</p>
            <h3>Made for players who want practical repertoire decisions.</h3>
          </div>
          <p>
            Opening Fit is deliberately narrow: it does not pretend to replace a
            coach or engine. It helps you turn recent games into a believable
            opening shortlist, with sample-size warnings where the data is thin.
          </p>
        </div>
      </section>

      <section className="landingStorySection landingUseCaseSection" id="use-cases">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: when would I use this?</p>
          <h2>Use it whenever your opening choices feel noisy.</h2>
        </div>

        <div className="landingUseCaseGrid">
          {useCases.map((useCase) => (
            <article className="landingStoryCard" key={useCase.title}>
              <h3>{useCase.title}</h3>
              <p>{useCase.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingContentSection" id="premium">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">Question: what does it cost?</p>
          <h2>Start with a free snapshot. Upgrade when you want the full audit.</h2>
        </div>

        <div className="landingPricingGrid">
          <article className="landingPriceCard">
            <p className="landingMiniLabel">Free</p>
            <h3>Useful opening snapshot</h3>
            <p>
              Enough to get a real “what should I do next?” moment from your
              recent games.
            </p>

            <ul>
              <li>Basic Chess.com or Lichess import</li>
              <li>Main repertoire verdict</li>
              <li>Top 3 actions</li>
              <li>A few opening recommendations</li>
              <li>Limited opening table</li>
            </ul>
          </article>

          <article className="landingPriceCard landingPriceCardPremium">
            <div className="landingPriceTop">
              <div>
                <p className="landingMiniLabel">Founder Pass</p>
                <h3>Depth and convenience</h3>
              </div>

              <span className="landingPriceBadge">£8 once-off</span>
            </div>

            <p>
              Founder Pass keeps the free report useful, then adds the deeper
              tools for tracking and improving your repertoire over time.
            </p>

            <ul>
              <li>12-month import</li>
              <li>Saved report history and progress tracking</li>
              <li>Full opening table and advanced filters</li>
              <li>Full repertoire map and tools</li>
              <li>Exportable study plan</li>
              <li>Future: Stockfish diagnosis, line mistakes, drills, PDF export</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="landingStorySection landingFaqSection" id="faq">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: what should I know before trying it?</p>
          <h2>Quick answers before you import games.</h2>
        </div>

        <div className="landingFaqGrid">
          {faqs.map((faq) => (
            <article className="landingStoryCard" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingFinalCTA" id="final-cta">
        <div>
          <p className="landingEyebrow">Question: what should I do now?</p>
          <h2>Generate your first opening report from real games.</h2>
          <p>
            Use your public username, get the snapshot, then decide what to study
            before the next time you queue.
          </p>
        </div>

        <div className="landingFinalActions">
          <a className="landingPrimaryBtn" href="#app-dashboard">
            Generate My First Result
          </a>
          <a className="landingSecondaryBtn" href="#sample-report">
            View Sample Output
          </a>
        </div>
      </section>
    </div>
  );
}





const REPORT_HISTORY_KEY = "openingFit:reportHistory";

function ReportExportAndHistory({ data, onLoadReport, isPremium = false, onUpgrade }) {
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
    if (!isPremium) {
      onUpgrade?.();
      return;
    }

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
    if (!isPremium) {
      onUpgrade?.();
      return;
    }

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
        <span>{isPremium ? "Export & history" : "Founder Pass depth tools"}</span>
        <h2>{isPremium ? "Save this report or export it as a study plan." : "Save progress and export plans with Founder Pass."}</h2>
        <p>
          {isPremium
            ? "Keep a local copy of your Opening Fit reports so you can compare your opening progress over time."
            : "The free report gives the verdict and first actions. Founder Pass adds saved history and exportable study plans for longer-term improvement."}
        </p>

        <div className="exportHistoryActions">
          <button type="button" onClick={exportPdf} className="exportPrimaryBtn">
            {isPremium ? "Export study plan" : "Unlock export"}
          </button>

          <button type="button" onClick={saveReport} className="exportSecondaryBtn">
            {isPremium ? "Save report" : "Unlock saved history"}
          </button>
        </div>

        <small>
          {isPremium
            ? "Saved reports are stored in this browser only. Cloud sync can be added later with Supabase accounts."
            : "PDF export, cloud history, and deeper line diagnosis are planned as later premium upgrades."}
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
  const [reportFilters] = useState({
    timeControl: "serious",
    dateRange: "90",
  });
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
      setActiveView("report");
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
    setActiveView("profile");
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


  const [showUnknownOpenings] = useState(false);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [practiceOpening, setPracticeOpening] = useState(null);
  const [openSections, setOpenSections] = useState(closedSections);
  const [, setSavedProfileMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [, setLocalSavedAt] = useState("");
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
      recentGames: incoming.recentGames ?? incoming.recent_games ?? [],
      opening_games: incoming.opening_games ?? incoming.openingGames ?? [],
      openingGames: incoming.openingGames ?? incoming.opening_games ?? [],
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

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const sectionRouteMap = {
    "feedback": { view: "feedback", target: "feedback" },
    "premium": { view: "profile", target: "premium" },
    "premium-offer": { view: "profile", target: "premium" },
    "premium-workspace": { view: "profile", target: "premium-workspace" },
    "training-plan": { view: "train", target: "training-plan" },
    "section-training": { view: "train", target: "section-training" },
    "seven-day-plan": { view: "train", target: "seven-day-plan" },
    "coach-plan": { view: "train", target: "seven-day-plan" },
    "study-planner": { view: "train", target: "study-planner" },
    "game-replay": { view: "train", target: "game-replay" },
    "section-replay": { view: "train", target: "section-replay" },
    "section-verdicts": { view: "openings", target: "evidence-table" },
    "keep-improve-avoid": { view: "openings", target: "evidence-table" },
    "opening-suggestions": { view: "repertoire", target: "repertoire-map" },
    "section-recommendations": { view: "repertoire", target: "repertoire-map" },
    "recommended-repertoire": { view: "repertoire", target: "repertoire-map" },
    "repertoire-plan": { view: "repertoire", target: "repertoire-map" },
    "my-repertoire": { view: "repertoire", target: "repertoire-map" },
    "progress-tracker": { view: "profile", target: "profile" },
    "share-report": { view: "profile", target: "report-history" },
    "report-history": { view: "profile", target: "report-history" },
    "top-openings-table": { view: "openings", target: "evidence-table" },
    "section-top": { view: "openings", target: "evidence-table" },
    "section-chart": { view: "openings", target: "evidence-table" },
  };

  const jumpToSection = (target) => {
    const requestedTarget = String(target || "app-results");
    const route = sectionRouteMap[requestedTarget] || { target: requestedTarget };
    const targetId = route.target || requestedTarget;
    const sectionKey = targetId.replace("section-", "");

    if (closedSections[sectionKey] !== undefined) {
      setOpenSections((prev) => ({
        ...prev,
        [sectionKey]: true,
      }));
    }

    if (route.view) {
      setActiveView(route.view);
    }

    setTimeout(() => {
      const el =
        document.getElementById(targetId) ||
        document.getElementById(requestedTarget) ||
        document.getElementById("app-results");

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
    }, route.view ? 240 : 160);
  };

  const startOpeningPractice = (openingName) => {
    if (!openingName) return;

    setPracticeOpening(openingName);
    scrollToId("opening-practice");
  };

  const isUnknownOpening = (name) => isUnknownOpeningName(name);

  const filterUnknownOpenings = useCallback((items) => {
    if (!Array.isArray(items)) return [];
    if (showUnknownOpenings) return items;

    return items.filter((item) => {
      const name =
        typeof item === "string" ? item : item?.name || item?.opening || "";

      return !isUnknownOpening(name);
    });
  }, [showUnknownOpenings]);

  const monthsToImport = isPremium ? importMonths : Math.min(importMonths, 3);

  const importGames = async (usernameOverride, platformOverride) => {
    const selectedPlatformKey = platforms[platformOverride] ? platformOverride : platform;
    const cleanUsername = String(usernameOverride ?? username).trim();
    const importSessionKey = `${selectedPlatformKey}:${cleanUsername}:${Date.now()}`;
    const dailySessionStartedKey = `${supabaseUser?.id || cleanUsername || "guest"}:${new Date()
      .toISOString()
      .slice(0, 10)}`;

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

      logRetentionEvent(
        "session_started",
        {
          source: "import",
          username: cleanUsername,
          platform: selectedPlatformKey,
          months: monthsToImport,
        },
        { dedupeKey: dailySessionStartedKey }
      );

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
      const reportRetentionKey = buildReportRetentionKey(cleanData, {
        username: cleanUsername,
        platform: selectedPlatformKey,
        games: cleanData.gamesImported ?? cleanData.total_games,
      });
      const userReportRetentionKey = `${supabaseUser?.id || "guest"}:${reportRetentionKey}`;

      setData(cleanData);
      saveLocalAnalysis(cleanData, cleanUsername);

      logRetentionEvent(
        "data_imported",
        {
          username: cleanData.username || cleanUsername,
          platform: selectedPlatformKey,
          games: cleanData.gamesImported ?? cleanData.total_games,
        },
        { dedupeKey: userReportRetentionKey }
      );

      logRetentionEvent(
        "report_generated",
        {
          username: cleanData.username || cleanUsername,
          platform: selectedPlatformKey,
          games: cleanData.gamesImported ?? cleanData.total_games,
        },
        { dedupeKey: userReportRetentionKey }
      );

      logRetentionEvent(
        "session_completed",
        {
          source: "import",
          username: cleanData.username || cleanUsername,
          platform: selectedPlatformKey,
        },
        { dedupeKey: importSessionKey }
      );

      if (supabaseUser?.id) {
        try {
          const importFitData = buildOpeningFitData(cleanData);
          await saveCloudReport(cleanData, buildReportHistorySummary(cleanData, importFitData));
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
      setActiveView("report");
      if (window.location.pathname !== "/report") {
        window.history.pushState({}, "", "/report");
      }

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

  const submitFeedback = async () => {
    const message = feedbackMessage.trim();

    if (!message) {
      setFeedbackStatus("Please type a message first.");
      return;
    }

    setFeedbackSending(true);
    setFeedbackStatus("Sending feedback...");

    try {
      const createdAt = new Date().toISOString();
      const contact = feedbackContact.trim() || null;
      const payload = {
        message,
        contact,
        email: contact,
        username: username.trim() || null,
        platform,
        page: "Opening Fit app",
        createdAt,
        created_at: createdAt,
      };

      let lastError = null;

      for (const endpoint of ["/api/feedback", "/api/feedback-local"]) {
        try {
          const response = await fetch(`${API_BASE}${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
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

          lastError = null;
          break;
        } catch (endpointError) {
          lastError = endpointError;
        }
      }

      if (lastError) {
        throw lastError;
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

  const reportData = useMemo(
    () => applyReportFilters(data, reportFilters) || data,
    [data, reportFilters]
  );

  useEffect(() => {
    setSelectedGameIndex(0);
  }, [reportFilters.timeControl, reportFilters.dateRange]);

  const filteredTopOpenings = useMemo(() => {
    return filterOpeningsBySamplePercent(
      filterUnknownOpenings(reportData?.top_openings || []),
      reportData?.total_games,
      openingSamplePercent
    );
  }, [filterUnknownOpenings, reportData, openingSamplePercent]);

  const filteredBestOpenings = useMemo(() => {
    return filterOpeningsBySamplePercent(
      filterUnknownOpenings(reportData?.best_openings || []),
      reportData?.total_games,
      openingSamplePercent
    );
  }, [filterUnknownOpenings, reportData, openingSamplePercent]);

  const filteredPreferredWhite = useMemo(() => {
    return filterOpeningsBySamplePercent(
      filterUnknownOpenings(reportData?.preferred_white || []),
      reportData?.total_games,
      openingSamplePercent
    );
  }, [filterUnknownOpenings, reportData, openingSamplePercent]);

  const filteredPreferredBlack = useMemo(() => {
    return filterOpeningsBySamplePercent(
      filterUnknownOpenings(reportData?.preferred_black || []),
      reportData?.total_games,
      openingSamplePercent
    );
  }, [filterUnknownOpenings, reportData, openingSamplePercent]);

  const filteredRecentGames = useMemo(() => {
    return filterUnknownOpenings(
      (reportData?.recent_games || []).filter((game) => gamePassesReportFilters(game, reportFilters))
    );
  }, [filterUnknownOpenings, reportData, reportFilters]);

  const chartData = useMemo(() => {
    return filteredTopOpenings.slice(0, isPremium ? 10 : 6);
  }, [filteredTopOpenings, isPremium]);

  const fitData = useMemo(() => {
    return buildOpeningFitData({
      ...reportData,
      top_openings: filteredTopOpenings,
      best_openings: filteredBestOpenings,
      preferred_white: filteredPreferredWhite,
      preferred_black: filteredPreferredBlack,
    });
  }, [
    reportData,
    filteredTopOpenings,
    filteredBestOpenings,
    filteredPreferredWhite,
    filteredPreferredBlack,
  ]);

  const whiteDetailedRecommendations = useMemo(() => {
    return filterUnknownOpenings(
      normalizeRecommendationSection(
        reportData?.opening_recommendations?.whiteDetailed ||
          reportData?.recommendedOpenings?.whiteDetailed ||
          [],
        "played_as_white"
      )
    );
  }, [filterUnknownOpenings, reportData]);

  const blackDetailedRecommendations = useMemo(() => {
    return filterUnknownOpenings(
      normalizeRecommendationSection(
        reportData?.opening_recommendations?.blackDetailed ||
          reportData?.recommendedOpenings?.blackDetailed ||
          [],
        "unknown_mixed"
      )
    );
  }, [filterUnknownOpenings, reportData]);

  const colourAwareRecommendationSections = useMemo(() => {
    return getColourAwareRecommendationSections(reportData).map((section) => ({
      ...section,
      items: filterUnknownOpenings(section.items || []),
    }));
  }, [filterUnknownOpenings, reportData]);

  const repertoireReportSections = useMemo(() => {
    return buildRepertoireReportSections({
      ...reportData,
      opening_recommendations: {
        ...(reportData?.opening_recommendations || {}),
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
  }, [filterUnknownOpenings, reportData, colourAwareRecommendationSections]);

  const repertoireShape = useMemo(
    () => repertoireShapeSummary(repertoireReportSections),
    [repertoireReportSections]
  );

  const smartRecommendationSummary = useMemo(() => {
    const levelProfile = getSmartPlayerLevelProfile(reportData);
    const levelAware = getSmartLevelAwareRecommendation(reportData, fitData);
    const publicMode = isPublicReportMode(reportData);
    const summary = [];

    if (publicMode) {
      summary.push(publicAccountCaution(reportData));
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
    const ratingCopy = getRatingAwareRecommendationCopy({
      level: levelProfile.level,
      label: levelProfile.shortLabel || levelProfile.label,
      bestName: bestFit ? getOpeningContextTitle(bestFit) : levelAware.bestName,
      weakName: weakFit ? getOpeningContextTitle(weakFit) : levelAware.weakName,
    });

    if (bestFit) {
      summary.push(
        publicMode
          ? `${getOpeningContextTitle(bestFit)} is the recent strength sample in this import at ${bestFit.fitScore}/100.`
          : canTreatAsRepertoireOpening(bestFit)
            ? `${getOpeningContextTitle(bestFit)} currently looks like your strongest clean Opening Fit at ${bestFit.fitScore}/100. ${ratingCopy.keepAction}`
            : `${getOpeningContextTitle(bestFit)} is visible in the data, but the side/context is not clean enough for a repertoire recommendation yet.`
      );
    }

    if (top && levelProfile.level !== "elite") {
      const topTitle = getOpeningContextTitle(top);
      const topContext = getOpeningContext(top);
      summary.push(
        topContext.canRecommend
          ? `Your most common opening signal is ${topTitle}. ${ratingCopy.training}`
          : `Your most common opening signal is ${topTitle}. Track it by side before treating it as a repertoire decision.`
      );
    }

    if (weakFit && getOpeningName(weakFit) !== getOpeningName(bestFit)) {
      summary.push(
        publicMode
          ? `${getOpeningContextTitle(weakFit)} is a lower-scoring recent sample at ${weakFit.fitScore}/100. Do not treat this as a hard opening verdict.`
          : `${getOpeningContextTitle(weakFit)} may need attention at ${weakFit.fitScore}/100. ${ratingCopy.weakAction}`
      );
    }

    if (summary.length === 0) {
      summary.push(
        "Import more games to unlock a stronger personalised recommendation summary."
      );
    }

    return summary;
  }, [reportData, fitData, filteredTopOpenings]);

  const personalTrainingPlan = useMemo(() => {
    const plan = [];
    const levelProfile = getSmartPlayerLevelProfile(reportData);
    const publicMode = isPublicReportMode(reportData);

    const bestFit = fitData.bestOpening;
    const weakFit = fitData.weakestOpening;
    const ratingCopy = getRatingAwareRecommendationCopy({
      level: levelProfile.level,
      label: levelProfile.shortLabel || levelProfile.label,
      bestName: bestFit ? getOpeningContextTitle(bestFit) : "your strongest opening",
      weakName: weakFit ? getOpeningContextTitle(weakFit) : "your weakest opening",
    });

    if (publicMode) {
      return [
        {
          title: "Run this as a recent-results audit",
          text: publicAccountCaution(reportData),
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
        text: ratingCopy.summary,
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
            ? `This is the strongest clean signal at ${bestFit.fitScore}/100. ${ratingCopy.keepAction}`
            : `This is your best current clean Opening Fit at ${bestFit.fitScore}/100. ${ratingCopy.keepAction}`,
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
          ? `You have played this ${mainOpening.games} times in that context, so small improvements there will affect a lot of your games. ${ratingCopy.training}`
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
            ? `This may be a practical review area at ${weakFit.fitScore}/100. ${ratingCopy.weakAction}`
            : `This side-specific opening signal is your lowest current fit at ${weakFit.fitScore}/100. ${ratingCopy.weakAction}`
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

    if (Array.isArray(reportData?.training_plan) && reportData.training_plan.length) {
      reportData.training_plan.forEach((step, index) => {
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
    reportData,
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
  const activeAppSection = getAppSection(activeView);


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
      setActiveView("profile");
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
        <OpeningFitPolishToast />
        <AppPrimaryNav
          activeView={activeView}
          hasReport={hasReport}
          onViewChange={setActiveView}
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
          </>
        ) : null}

        <MobileBottomNav
          activeView={activeView}
          onViewChange={setActiveView}
        />

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

        {loading && activeAppSection !== "analyse" ? (
          <ImportLoadingOverlay platform={platform} />
        ) : null}

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
            setActiveView("report");

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
          {activeAppSection === "analyse" ? (
          <>
          <header className="hero heroCard compactImportHero analyseImportHero" aria-busy={loading}>
            <div className="heroTop">
              <div className="heroTitleWrap">
                <p className="eyebrow">OpeningFit</p>
                <h1>Build a chess repertoire from your own games</h1>
                <p className="subtext">
                  Import your Chess.com or Lichess username. OpeningFit finds
                  which openings are helping you, which ones are costing points,
                  and what to study next.
                </p>
              </div>
            </div>

            <div className="searchRow topBar appActionPanel heroImportFlow" id="import">
              <div className="heroImportHeader">
                <div>
                  <span>Analyse public games</span>
                  <strong>Enter your username</strong>
                </div>
                <small>No password needed</small>
              </div>

              <div className="platformSelector">
                <button
                  type="button"
                  className={`platformButton ${
                    platform === "chesscom" ? "platformButtonActive" : ""
                  }`}
                  onClick={() => setPlatform("chesscom")}
                  disabled={loading}
                >
                  Chess.com
                </button>

                <button
                  type="button"
                  className={`platformButton ${
                    platform === "lichess" ? "platformButtonActive" : ""
                  }`}
                  onClick={() => setPlatform("lichess")}
                  disabled={loading}
                >
                  Lichess
                </button>
              </div>

              <label className="heroUsernameField">
                <span>{platforms[platform]?.label || "Chess"} username</span>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  placeholder={
                    platforms[platform]?.usernamePlaceholder || "Chess username"
                  }
                />
              </label>

              <select
                className="input monthSelect"
                value={importMonths}
                onChange={(e) => setImportMonths(Number(e.target.value))}
                aria-label="Months to import"
                disabled={loading}
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
                  {loading ? "Analysing..." : "Build my repertoire"}
                </button>
              </div>
            </div>

            <div className="compactTrustRow">
              <span>Uses public games</span>
              <span>Shows strengths and leaks</span>
              <button
                className="inlineSampleButton"
                type="button"
                onClick={loadDemoReport}
                disabled={loading}
              >
                View demo report
              </button>
            </div>

            {apiStatus !== "online" ? (
              <p className="statusMessage">
                Backend status: {apiStatus}. Some features may not work until
                your backend is running.
              </p>
            ) : null}

            {loading ? (
              <div className="analyseLoadingState" role="status" aria-live="polite">
                <span className="loadingSpinner" />
                <p>{loadingStep || "Starting your analysis..."}</p>
              </div>
            ) : null}
          </header>
          {!reportData ? (
            <OpeningFitTrustUpgrade
              onFounderPass={handleFounderPassClick}
              onDemo={loadDemoReport}
              onImport={() => {
                const el =
                  document.getElementById("import") ||
                  document.querySelector("input");

                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              onSample={() => {
                const el = document.getElementById("see-example-analysis");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          ) : null}
          </>
          ) : null}

          {activeAppSection === "report" && !reportData && !loading ? (
            <section className="card appEmptySection" id="app-results">
              <p className="eyebrow">Report</p>
              <h2>No opening analysis yet</h2>
              <p>Import your recent Chess.com or Lichess games first, then your latest report will live here.</p>
              <button className="primaryBtn" type="button" onClick={() => setActiveView("analyse")}>
                Go to Analyse
              </button>
            </section>
          ) : null}

          {activeAppSection === "train" && !reportData && !loading ? (
            <section className="card appEmptySection" id="training-plan">
              <p className="eyebrow">Train</p>
              <h2>No training plan yet</h2>
              <p>Training actions are generated from your current opening report.</p>
              <button className="primaryBtn" type="button" onClick={() => setActiveView("analyse")}>
                Start an import
              </button>
            </section>
          ) : null}

          {loading && activeAppSection !== "analyse" && (
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
                user={supabaseUser || accountUser}
                data={reportData || data || {}}
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

          {reportData && ["report", "train"].includes(activeAppSection) && (
            <div id="app-results">
              {activeAppSection === "report" ? (
                <FinalReportFlow
                  data={reportData}
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
                    isPremium={isPremium}
                    onUpgrade={() => {
                      const el = document.getElementById("premium");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
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



              {activeAppSection === "train" ? (
                <>
                  <DailyOpeningHabit
                    data={reportData}
                    user={supabaseUser || accountUser}
                    onPractice={startOpeningPractice}
                  />

                  <SevenDayOpeningFitPlan
                    data={reportData}
                    fitData={fitData}
                    recentGames={filteredRecentGames}
                    onPractice={startOpeningPractice}
                  />

                  <OpeningCoachPlan data={reportData} />
                  <RepertoireStudyPlan data={reportData} />
                  <NextStudySession
                    fitData={fitData}
                    recentGames={filteredRecentGames}
                    onPractice={startOpeningPractice}
                    onViewChange={setActiveView}
                  />

                  <OpeningFitStudyPlanner data={reportData} username={username} />

                  {false ? <PremiumCoachPlan
                    data={reportData}
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
                      title="Depth tools available with Founder Pass"
                      text="Your free plan gives the first actions. Founder Pass adds saved progress, exportable study plans, and deeper repertoire workflow."
                    />
                  ) : null}
                </Section>
              </div>
              </div>
                </>
              ) : null}

              {activeAppSection === "train" ? (
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
                          title="Full table available with Founder Pass"
                          text={`Your free report shows the most useful rows. Founder Pass unlocks all ${filteredTopOpenings.length} tracked openings, advanced filters, and deeper context.`}
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

          {activeAppSection === "profile" && activeView !== "feedback" ? (
            <section className="profileSection" id="profile">
              {reportData ? (
                <>
                  <div className="profileSectionHeader">
                    <p className="eyebrow">Profile</p>
                    <h1>Player progress hub</h1>
                    <p>
                      Who you are as a player, what you have achieved, and how your repertoire is changing over time.
                    </p>
                  </div>

                  <ProfileIdentityCard
                    data={reportData}
                    fitData={fitData}
                    accountUser={accountUser}
                    username={username}
                    platform={platform}
                    isPremium={isPremium}
                  />

                  <section className="profileHubSection" id="profile-achievements">
                    <div className="profileHubSectionHeader">
                      <p className="eyebrow">Achievements / milestones</p>
                      <h2>Milestones</h2>
                    </div>
                    {accountUser ? (
                      <div className="profileAchievementGrid">
                        <TodayDashboard
                          user={accountUser}
                          onPrimaryAction={() => {
                            setActiveView("report");
                            if (window.location.pathname !== "/report") {
                              window.history.pushState({}, "", "/report");
                            }
                            setTimeout(() => {
                              const target =
                                document.getElementById("app-results") ||
                                document.querySelector(".finalReportFlow");
                              if (target?.scrollIntoView) {
                                target.scrollIntoView({ behavior: "smooth", block: "start" });
                              }
                            }, 80);
                          }}
                        />
                        <AchievementsPanel userId={accountUser.id} compact />
                      </div>
                    ) : (
                      <section className="card profileMutedPanel">
                        <h3>Milestones unlock when you sign in</h3>
                        <p>Your current report is saved locally. Sign in to track streaks, XP, and achievements across devices.</p>
                      </section>
                    )}
                  </section>

                  <section className="profileHubSection" id="profile-saved-reports">
                    <div className="profileHubSectionHeader">
                      <p className="eyebrow">Saved reports / previous imports</p>
                      <h2>Report history</h2>
                    </div>
                    <div className="profileGrid">
                      <ReportHistoryVault data={reportData} fitData={fitData} onLoadReport={setData} />
                      <ReportExportAndHistory
                        data={reportData}
                        isPremium={isPremium}
                        onUpgrade={() => setActiveView("profile")}
                        onLoadReport={setData}
                      />
                    </div>
                  </section>

                  <section className="profileHubSection" id="profile-progress">
                    <div className="profileHubSectionHeader">
                      <p className="eyebrow">Progress over time</p>
                      <h2>Repertoire progress</h2>
                    </div>
                    {accountUser ? (
                      <OpeningProgressTracker data={reportData} user={accountUser} compact />
                    ) : (
                      <section className="card profileMutedPanel">
                        <h3>Long-term progress is local-only for now</h3>
                        <p>Import again after more games to compare the current report. Sign in to keep progress history attached to your account.</p>
                      </section>
                    )}
                  </section>

                  <section className="profileHubSection" id="profile-account">
                    <div className="profileHubSectionHeader">
                      <p className="eyebrow">Account / premium</p>
                      <h2>Account status, privacy, and premium</h2>
                    </div>
                    <div className="profileGrid">
                      <section className="loginScreenSection" id="account">
                        <AccountPanel variant="screen" onUserChange={setAccountUser} />
                      </section>
                      <div id="premium" className="profilePremiumBlock">
                        <PremiumPanel
                          data={reportData}
                          isPremium={isPremium}
                          onUnlockDemo={unlockPremiumDemo}
                          onResetDemo={resetPremiumDemo}
                          onFounderPass={handleFounderPassClick}
                        />
                      </div>
                    </div>
                    <SeriousPremiumStrip />
                  </section>
                </>
              ) : (
                <section className="card appEmptySection profileEmptyState">
                  <p className="eyebrow">Profile</p>
                  <h2>Import your first games to build your OpeningFit profile.</h2>
                  <p>Your player identity, milestones, saved reports, and repertoire progress will appear here after your first analysis.</p>
                  <button className="primaryBtn" type="button" onClick={() => setActiveView("analyse")}>
                    Go to Analyse
                  </button>
                </section>
              )}
            </section>
          ) : null}

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
