import OpeningFitStudyPlanner from "./components/OpeningFitStudyPlanner.jsx";
import OpeningFitRetentionCommandCenter from "./components/OpeningFitRetentionCommandCenter.jsx";
import OpeningFitProgressionDashboard from "./components/OpeningFitProgressionDashboard.jsx";
import OpeningFitRetentionSystems from "./components/OpeningFitRetentionSystems.jsx";
import OpeningFitImportDoctor from "./components/OpeningFitImportDoctor.jsx";
import OpeningFitFunctionalityHub from "./components/OpeningFitFunctionalityHub.jsx";
import OpeningFitFunctionalTools from "./components/OpeningFitFunctionalTools.jsx";
import OpeningFitPolishToast from "./components/OpeningFitPolishToast.jsx";
import "./components/OpeningFitPolish.css";
import "./components/WeakLineDetection.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import "./App.css";
import OpeningReportSummary from "./components/OpeningReportSummary";
import RepertoireStudyPlan from "./components/RepertoireStudyPlan";
import PremiumDashboard from "./components/PremiumDashboard";
import ImportLoadingOverlay from "./components/ImportLoadingOverlay";
import AccountPanel from "./components/AccountPanel";
import GameReplayBoard from "./components/GameReplayBoard";
import OpeningPracticeLinesPanel from "./components/OpeningPracticeLinesPanel";
import { findOpeningPracticePack } from "./data/openingPracticeLines";
import PremiumPanel from "./components/PremiumPanel";
import ResultsCommandCenter from "./components/ResultsCommandCenter";
import OpeningHealthScore from "./components/OpeningHealthScore";
import ProgressTracker from "./components/ProgressTracker";
import ShareReport from "./components/ShareReport";
import MyRepertoire from "./components/MyRepertoire";
import PremiumTrustStrip from "./components/PremiumTrustStrip";
import ReportSnapshot from "./components/ReportSnapshot";
import OpeningCoachPlan from "./components/OpeningCoachPlan";
import OpeningProgressTracker from "./components/OpeningProgressTracker";
import WeeklyOpeningReport, { buildWeeklyOpeningSnapshot } from "./components/WeeklyOpeningReport";
import OpeningGamificationProgress from "./components/OpeningGamificationProgress";
import TodayTrainingCard from "./components/TodayTrainingCard";
import OpeningFitRepertoirePlan from "./components/OpeningFitRepertoirePlan";
import OpeningEvidenceBlock, { getOpeningConfidence, getOpeningContext, getOpeningSignal } from "./components/OpeningEvidence";
import FounderPassLoginUpgrade from "./components/FounderPassLoginUpgrade";
import CheckoutStatusNotice from "./components/CheckoutStatusNotice";
import { Analytics } from "@vercel/analytics/react";
import OpeningDetailsModal from "./components/OpeningDetailsModal";
import OpeningSnapshot from "./components/OpeningSnapshot";
import RetentionHub from "./components/RetentionHub";
import InteractiveRepertoire from "./components/InteractiveRepertoire";
import DashboardHome from "./components/DashboardHome";
import TodayDashboard from "./components/TodayDashboard";
import AchievementsPanel from "./components/AchievementsPanel";
import DailyOpeningHabit from "./components/DailyOpeningHabit";
import { useAuth } from "./context/AuthDataProvider";
import { getAppSection, navigateApp, scrollToAppTarget } from "./appNavigation";


import { CoachSummaryCard, SeriousAppTabs, SeriousPremiumStrip, NextBestActions } from "./components/SeriousAppUpgrade";

import ReportHistoryVault from "./components/ReportHistoryVault";

import AppActionRouter from "./components/AppActionRouter";

import OpeningDiagnosisPanel from "./components/OpeningDiagnosisPanel";
import EvidenceBackedOpeningDiagnosis from "./components/EvidenceBackedOpeningDiagnosis";

import ShipReadyPanel from "./components/ShipReadyPanel";


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
import { buildOpeningHealthSnapshot } from "./services/openingHealth";
import { mergeWeakLines } from "./services/weakLineDetection";
import { buildOpeningGamificationSnapshot } from "./services/openingGamification";
import { buildTrainingRecommendations } from "./services/trainingRecommendations";
import { DEMO_REPORT } from "./demoReportData";
import OpeningFitDiagnosisFirst from "./components/OpeningFitDiagnosisFirst";
import FounderPassOutcomePanel from "./components/FounderPassOutcomePanel";
import ReportCommandBar from "./components/ReportCommandBar";
import MobileBottomNav from "./components/MobileBottomNav.jsx";
import OpeningLandingPage, {
  OpeningHubPage,
  OpeningNotFoundPage,
  getOpeningPageJsonLd,
} from "./components/OpeningLandingPage.jsx";
import SeoLandingPage, {
  DEFAULT_SHARE_IMAGE,
  SEO_LINKS,
  SEO_PAGES,
  SITE_URL,
  getSeoData,
  getSeoJsonLd,
} from "./components/SeoLandingPage.jsx";
import {
  getOpeningSeoPage,
  getOpeningSeoSlugFromPath,
} from "./data/openingSeoPages.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

const STORAGE_KEY = "openingFit:lastAnalysis";
const USERNAME_KEY = "openingFit:lastUsername";
const PLATFORM_KEY = "openingFit:lastPlatform";
const IMPORT_MONTHS_KEY = "openingFit:lastImportMonths";
const OPENING_SAMPLE_PERCENT_KEY = "openingFit:openingSamplePercent";
const ANALYSIS_TIME_FORMAT_KEY = "openingFit:lastAnalysisTimeFormat";
const AUTH_RETURN_PATH_KEY = "openingFit:authReturnPath";

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

function isDemoAnalysis(report) {
  const source = String(report?.platform || report?.importPlatform || report?.import_platform || "").toLowerCase();
  const username = String(report?.username || report?.playerName || report?.player_name || "").toLowerCase();
  return source === "demo" || username === "demoplayer" || report === DEMO_REPORT;
}

function getImportedGameCount(report) {
  return safeNumber(
    report?.gamesImported ??
      report?.games_imported ??
      report?.gamesAnalysed ??
      report?.gamesAnalyzed ??
      report?.games_analyzed ??
      report?.gamesFound ??
      report?.games_found ??
      report?.totalGames ??
      report?.total_games
  );
}

function countOpeningItems(value) {
  if (!value) return 0;
  if (Array.isArray(value)) {
    return value.reduce((total, item) => {
      if (!item) return total;
      if (typeof item === "string") return total + (isUnknownOpeningName(item) ? 0 : 1);
      if (Array.isArray(item?.items)) return total + countOpeningItems(item.items);
      return total + (isUnknownOpeningName(getOpeningName(item)) ? 0 : 1);
    }, 0);
  }
  if (typeof value === "object") {
    return Object.values(value).reduce((total, item) => total + countOpeningItems(item), 0);
  }
  return 0;
}

function getClassifiedOpeningCount(report) {
  const detectedOpenings = countOpeningItems([
    ...(Array.isArray(report?.best_openings) ? report.best_openings : []),
    ...(Array.isArray(report?.bestOpenings) ? report.bestOpenings : []),
    ...(Array.isArray(report?.top_openings) ? report.top_openings : []),
    ...(Array.isArray(report?.topOpenings) ? report.topOpenings : []),
    ...(Array.isArray(report?.opening_stats) ? report.opening_stats : []),
    ...(Array.isArray(report?.openingStats) ? report.openingStats : []),
  ]);
  const recommendationOpenings = countOpeningItems(
    report?.opening_recommendations || report?.openingRecommendations || {}
  );
  const playedOpenings = countOpeningItems([
    ...(Array.isArray(report?.preferred_white) ? report.preferred_white : []),
    ...(Array.isArray(report?.preferred_black) ? report.preferred_black : []),
    ...(Array.isArray(report?.preferredWhite) ? report.preferredWhite : []),
    ...(Array.isArray(report?.preferredBlack) ? report.preferredBlack : []),
  ]);

  return detectedOpenings + recommendationOpenings + playedOpenings;
}

function formatGameCount(count) {
  return `${count} game${count === 1 ? "" : "s"}`;
}

function buildImportOutcome(report, platformLabel) {
  const gamesImported = getImportedGameCount(report);
  const openingSignals = getClassifiedOpeningCount(report);
  const platformName = platformLabel || "the selected platform";

  if (!gamesImported) {
    return {
      tone: "warning",
      title: "No recent public games found",
      message: `We reached ${platformName}, but did not find recent public games to analyse. Check the username, privacy settings, and selected platform, then try again.`,
      meta: `${platformName} import`,
    };
  }

  if (!openingSignals) {
    return {
      tone: "warning",
      title: "Games imported, but openings were too thin to classify",
      message: `We imported ${formatGameCount(gamesImported)} from ${platformName}, but there were not enough repeated or classified opening positions to build strong verdicts yet.`,
      meta: `${formatGameCount(gamesImported)} imported`,
    };
  }

  if (openingSignals < 3 || gamesImported < 5) {
    return {
      tone: "warning",
      title: "Import complete with a light opening sample",
      message: `We imported ${formatGameCount(gamesImported)} from ${platformName}. Your report is ready, but the opening sample is still small, so recommendations are starter signals.`,
      meta: `${formatGameCount(gamesImported)} imported`,
    };
  }

  return {
    tone: "success",
    title: `Imported ${formatGameCount(gamesImported)} from ${platformName}`,
    message: "Your OpeningFit report is ready with opening verdicts, recommendations, and training focus.",
    meta: `${openingSignals} opening signal${openingSignals === 1 ? "" : "s"} found`,
  };
}

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

function getOpeningVariationName(item) {
  if (!item || typeof item === "string") return "";

  const direct =
    item.variation ||
    item.variationName ||
    item.openingVariation ||
    item.opening_variation ||
    item.line ||
    item.lineName ||
    item.ecoVariation ||
    item.subOpening ||
    item.sub_opening ||
    "";

  if (direct) return String(direct).trim();

  const opening = String(item.opening || item.name || item.ecoName || "");
  if (opening.includes(":")) return opening.split(":").slice(1).join(":").trim();

  return "";
}

function extractOpeningMovesFromPgn(pgnText) {
  return String(pgnText || "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ")
    .split(/\s+/)
    .map((move) => move.trim())
    .filter((move) => move && !move.startsWith("$"))
    .slice(0, 10);
}

function getOpeningMoveLine(item) {
  if (!item || typeof item === "string") return "";

  const direct =
    item.moveLine ||
    item.move_line ||
    item.movesText ||
    item.moves_text ||
    item.lineMoves ||
    item.line_moves ||
    item.variationMoves ||
    item.variation_moves ||
    "";

  if (Array.isArray(direct)) return direct.slice(0, 10).join(" ");
  if (direct) return String(direct).trim();

  if (Array.isArray(item.moves)) return item.moves.slice(0, 10).join(" ");

  const parsed = extractOpeningMovesFromPgn(item.pgn || item.PGN || "");
  return parsed.length ? parsed.join(" ") : "";
}

function normaliseSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lineMatchesOpeningFilter(item, filters = {}) {
  const query = normaliseSearchText(filters.openingQuery || filters.openingVariation || filters.openingName || "");
  if (!query) return true;

  const haystack = normaliseSearchText(
    [
      getOpeningName(item),
      getOpeningVariationName(item),
      getOpeningMoveLine(item),
      item?.eco,
      item?.ecoCode,
    ].filter(Boolean).join(" ")
  );

  return haystack.includes(query);
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

function getOpeningSideLabel(opening) {
  const context = getOpeningContext(opening);
  if (context.type === "white") return "White";
  if (context.type === "black") return "Black";
  if (context.type === "faced") return "Faced";
  return "Both";
}

function getOpeningStatusLabel(opening, data = {}) {
  const verdict = openingVerdictLabel(opening, data, opening?.fitVerdict || opening?.verdict);
  if (verdict === "Keep") return "Keep";
  if (verdict === "Avoid") return "Avoid";
  if (verdict === "Improve") return "Improve";
  return "Try next";
}

function getOpeningCardAction(opening, data = {}) {
  const status = getOpeningStatusLabel(opening, data);
  if (status === "Keep") return "Add to repertoire";
  if (status === "Avoid") return "Review games";
  if (status === "Improve") return "Practise line";
  if (status === "Try next") return "Study this";
  return "Study this";
}

function getOpeningStatusIcon(status) {
  if (status === "Keep") return "✓";
  if (status === "Improve") return "!";
  if (status === "Avoid") return "×";
  return "+";
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

function buildSingleRecommendedAction(data = {}) {
  const existing = data?.recommendedAction || data?.recommended_action || data?.nextAction || data?.next_action;
  if (typeof existing === "string" && existing.trim()) return existing.trim();

  const asArray = (value) => (Array.isArray(value) ? value : []);
  const openingRecommendations = data?.opening_recommendations || data?.openingRecommendations || {};
  const candidates = [
    ...asArray(data?.best_openings),
    ...asArray(data?.bestOpenings),
    ...asArray(data?.top_openings),
    ...asArray(data?.topOpenings),
    ...asArray(openingRecommendations?.whiteDetailed),
    ...asArray(openingRecommendations?.blackDetailed),
    ...asArray(openingRecommendations?.white_repertoire),
    ...asArray(openingRecommendations?.black_vs_e4),
    ...asArray(openingRecommendations?.black_vs_d4),
    ...asArray(openingRecommendations?.black_vs_other),
  ].filter((opening) => opening && getOpeningName(opening) !== "Unknown Opening");

  const cleanOpening = candidates.find((opening) => canTreatAsRepertoireOpening(opening));
  const weakOpening = [...candidates]
    .filter((opening) => canTreatAsRepertoireOpening(opening) && safeNumber(opening?.losses) >= 3)
    .sort((a, b) => safeNumber(b.losses) - safeNumber(a.losses))[0];

  if (weakOpening) {
    return `Review these 3 losses in ${getOpeningContextTitle(weakOpening)}.`;
  }

  if (cleanOpening) {
    const score = safeNumber(cleanOpening?.fitScore ?? cleanOpening?.openingFitScore ?? cleanOpening?.score);
    const verdict = String(cleanOpening?.verdict || cleanOpening?.fitVerdict || "").toLowerCase();
    if (score >= 70 || verdict.includes("keep")) {
      return `Train this line: ${getOpeningContextTitle(cleanOpening)}.`;
    }
    return `Play 5 games with ${getOpeningContextTitle(cleanOpening)}.`;
  }

  const whitePick = asArray(data?.preferred_white || data?.preferredWhite)[0];
  if (whitePick) return `Play 5 games with ${getOpeningName(whitePick)} as White.`;

  const blackPick = asArray(data?.preferred_black || data?.preferredBlack)[0];
  if (blackPick) return `Play 5 games with ${getOpeningName(blackPick)} as Black.`;

  return "Play 5 games, then run a fresh analysis.";
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
  { key: "notEnoughData", title: "We need a few more games" },
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
      label: "We need a few more games",
      category: "neutral",
      tone: "neutral",
      severity: "neutral",
      message: "We need a few more games before we can give a confident verdict.",
    };
  }

  if (games < 10 || signal.badge === "Low") {
    const lowWinRate = winRate < 45;
    return {
      label: "We need a few more games",
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
      label: publicMode ? "We need a few more games" : "Early signal",
      category: "neutral",
      tone: "neutral",
      severity: "neutral",
      message:
        publicMode
          ? "This is too small a recent online sample for a hard verdict. It may be an experiment, a content game, or a one-off opponent-specific choice."
          : "We need a few more games before making this a main recommendation.",
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
    recommendedAction: buildSingleRecommendedAction(data),
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
      <div className="emptyStateIcon" aria-hidden="true">+</div>
      <div>
        <span className="emptyStateLabel">Next best action</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
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
  const recommendedAction = fitData.recommendedAction || buildSingleRecommendedAction(fitData);

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
        {recommendedAction}

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
          const status = getOpeningStatusLabel(opening);
          const action = getOpeningCardAction(opening);
          const games = getOpeningGames(opening);
          const winRate = getWinRate(opening);
          const fitScore = safeNumber(opening.fitScore ?? opening.openingFitScore ?? winRate, 0);
          const coachText =
            opening.fitReasonBullets?.[0] ||
            opening.fitConfidenceReason ||
            opening.fitExplanation ||
            getOpeningConfidenceReason(opening);

          return (
            <button
              className={`fitOpeningRow openingRecommendationCard status-${status.toLowerCase().replace(/\s+/g, "-")}`}
              key={`${name}-${index}`}
              type="button"
              aria-disabled={!canPractice}
              onClick={() => canPractice && onPractice(name)}
            >
              <div className="openingRecommendationTop">
                <div className="openingRecommendationTitleBlock">
                  <div className={`openingCardIcon openingCardIcon-${status.toLowerCase().replace(/\s+/g, "-")}`} aria-hidden="true">
                    {getOpeningStatusIcon(status)}
                  </div>
                  <div>
                    <div className="openingRecommendationBadges">
                      <span className="openingSideBadge">{getOpeningSideLabel(opening)}</span>
                      <span className={`openingStatusBadge openingStatusBadge-${status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {status}
                      </span>
                    </div>
                    <strong>{getOpeningContextTitle(opening, name)}</strong>
                  </div>
                </div>
                <div className="openingFitScorePill">
                  <span>{fitScore ? "Fit" : "Confidence"}</span>
                  <strong>{fitScore || getOpeningConfidence(opening)}</strong>
                </div>
              </div>

              <div className="openingRecommendationMetrics">
                <div>
                  <span>Fit score</span>
                  <strong>{fitScore || "—"}{fitScore ? "/100" : ""}</strong>
                </div>
                <div>
                  <span>Win rate</span>
                  <strong>{winRate ? `${winRate}%` : "—"}</strong>
                </div>
                <div>
                  <span>Sample</span>
                  <strong>{games || "—"} games</strong>
                </div>
              </div>

              <div className="openingScoreBars" aria-hidden="true">
                <div>
                  <span style={{ width: `${Math.max(4, Math.min(100, fitScore || 0))}%` }} />
                </div>
                <div>
                  <span style={{ width: `${Math.max(4, Math.min(100, winRate || 0))}%` }} />
                </div>
              </div>

              <p className="fitOpeningReason openingCoachSummary">
                {opening.fitDisplayVerdict || confidenceVerdictLabel(opening, {}, opening.fitVerdict)}. {coachText}
              </p>

              <FitReasonList opening={opening} />

              <div className="openingRecommendationAction">
                <span>{getOpeningConfidence(opening)}</span>
                <strong>{action}</strong>
              </div>
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
  { key: "bullet", label: "Bullet" },
  { key: "blitz", label: "Blitz" },
  { key: "rapid", label: "Rapid" },
  { key: "classical", label: "Classical" },
  { key: "daily", label: "Daily / Correspondence" },
  { key: "custom", label: "All Time Controls" },
  { key: "serious", label: "Rapid + Blitz" },
  { key: "all", label: "All Time Controls" },
];

const ANALYSIS_TIME_FORMAT_OPTIONS = [
  { key: "bullet", label: "Bullet", description: "Fastest games" },
  { key: "blitz", label: "Blitz", description: "Short games" },
  { key: "rapid", label: "Rapid", description: "Longer online games" },
  { key: "classical", label: "Classical", description: "Long time controls" },
  { key: "daily", label: "Daily / Correspondence", description: "Turn-based games" },
  { key: "custom", label: "All Time Controls", description: "Include every available format" },
];

function normalizeAnalysisTimeFormat(value) {
  const key = String(value || "").toLowerCase();
  return ANALYSIS_TIME_FORMAT_OPTIONS.some((item) => item.key === key) ? key : "custom";
}

function getAnalysisTimeFormatLabel(value) {
  return (
    ANALYSIS_TIME_FORMAT_OPTIONS.find((item) => item.key === normalizeAnalysisTimeFormat(value))?.label ||
    "All Time Controls"
  );
}

function getReportTimeControlFilter(value) {
  const key = normalizeAnalysisTimeFormat(value);
  return key === "custom" ? "all" : key;
}

const DATE_RANGE_FILTERS = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "180", label: "Last 6 months", days: 180 },
  { key: "365", label: "Last 12 months", days: 365 },
];

function getGameTimeControl(game) {
  const explicit = String(
    game?.time_class ||
      game?.timeClass ||
      game?.speed ||
      game?.perf ||
      game?.perfType ||
      ""
  ).toLowerCase();

  if (explicit.includes("correspondence") || explicit.includes("daily")) return "daily";
  if (explicit.includes("standard")) return "classical";
  if (["bullet", "blitz", "rapid", "classical", "daily"].includes(explicit)) return explicit;

  return detectTimeControlFromPgn(game?.pgn || game?.PGN || game?.rawPgn || "")?.key || explicit;
}

function getPgnHeaderValue(pgnText, headerName) {
  const pattern = new RegExp(`\\[${headerName}\\s+"([^"]+)"\\]`, "i");
  return String(pgnText || "").match(pattern)?.[1] || "";
}

function classifyTimeControlValue(value) {
  const clean = String(value || "").trim().toLowerCase();

  if (!clean || clean === "?" || clean === "-") return null;
  if (clean.includes("daily") || clean.includes("correspondence")) return "daily";
  if (clean.includes("classical") || clean.includes("standard")) return "classical";
  if (clean.includes("rapid")) return "rapid";
  if (clean.includes("blitz")) return "blitz";
  if (clean.includes("bullet")) return "bullet";
  if (clean.includes("/")) return "daily";

  const firstPart = clean.split(":")[0] || clean;
  const [baseRaw, incrementRaw] = firstPart.split("+");
  const baseSeconds = Number(baseRaw);
  const incrementSeconds = Number(incrementRaw || 0);

  if (!Number.isFinite(baseSeconds)) return null;
  if (baseSeconds >= 86400) return "daily";

  const estimatedSeconds = baseSeconds + incrementSeconds * 40;
  if (estimatedSeconds < 180) return "bullet";
  if (estimatedSeconds < 600) return "blitz";
  if (estimatedSeconds < 1800) return "rapid";
  return "classical";
}

function detectTimeControlFromPgn(pgnText) {
  const raw = getPgnHeaderValue(pgnText, "TimeControl");
  const key = classifyTimeControlValue(raw);
  return key ? { key, label: getAnalysisTimeFormatLabel(key), raw } : null;
}

function detectReportTimeFormat(data) {
  const games = [
    ...(Array.isArray(data?.recent_games) ? data.recent_games : []),
    ...(Array.isArray(data?.recentGames) ? data.recentGames : []),
    ...(Array.isArray(data?.opening_games) ? data.opening_games : []),
    ...(Array.isArray(data?.openingGames) ? data.openingGames : []),
  ];
  const counts = new Map();
  const rawSamples = [];

  games.forEach((game) => {
    const key = getGameTimeControl(game);
    const normalized = normalizeAnalysisTimeFormat(key);
    if (normalized !== "custom") {
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }

    const pgnDetection = detectTimeControlFromPgn(game?.pgn || game?.PGN || game?.rawPgn || "");
    if (pgnDetection?.raw && rawSamples.length < 3) rawSamples.push(pgnDetection.raw);
  });

  const [key, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  if (!key) {
    return {
      key: "custom",
      label: "All Time Controls",
      source: games.length ? "metadata unavailable" : "no games",
      confidence: "unknown",
      rawSamples,
    };
  }

  return {
    key,
    label: getAnalysisTimeFormatLabel(key),
    source: "game metadata",
    confidence: count === games.length ? "all games" : "dominant",
    gamesMatched: count,
    gamesChecked: games.length,
    rawSamples,
  };
}

const FRONTEND_STARTER_OPENINGS = {
  beginner: {
    white: ["Italian Game", "London System", "Queen's Gambit"],
    blackVsE4: ["e5 systems", "Caro-Kann Defence"],
    blackVsD4: ["Queen's Gambit Declined setup"],
  },
  aggressive: {
    white: ["Italian Game", "Scotch Game", "Vienna Game", "King's Gambit"],
    blackVsE4: ["Scandinavian Defence", "Caro-Kann Defence", "e5 systems"],
    blackVsD4: ["Queen's Gambit Declined", "Dutch Defence"],
  },
  solid: {
    white: ["London System", "Italian Game", "Queen's Gambit"],
    blackVsE4: ["Caro-Kann Defence", "French Defence", "e5 systems"],
    blackVsD4: ["Queen's Gambit Declined", "Slav Defence"],
  },
  positional: {
    white: ["Queen's Gambit", "Colle System", "Catalan-style setups"],
    blackVsE4: ["Caro-Kann Defence", "French Defence"],
    blackVsD4: ["Queen's Gambit Declined", "Slav Defence", "King's Indian as future option"],
  },
};

const FRONTEND_OPENING_DETAILS = {
  "Italian Game": ["1. e4 e5", "2. Nf3 Nc6", "3. Bc4"],
  "Scotch Game": ["1. e4 e5", "2. Nf3 Nc6", "3. d4"],
  "Vienna Game": ["1. e4 e5", "2. Nc3 Nf6", "3. Bc4"],
  "King's Gambit": ["1. e4 e5", "2. f4"],
  "London System": ["1. d4 d5", "2. Bf4 Nf6", "3. e3"],
  "Queen's Gambit": ["1. d4 d5", "2. c4"],
  "Colle System": ["1. d4 d5", "2. Nf3 Nf6", "3. e3"],
  "Catalan-style setups": ["1. d4 d5", "2. c4 e6", "3. g3"],
  "e5 systems": ["1. e4 e5", "2. Nf3 Nc6"],
  "Scandinavian Defence": ["1. e4 d5", "2. exd5 Qxd5", "3. Nc3 Qa5"],
  "Caro-Kann Defence": ["1. e4 c6", "2. d4 d5"],
  "French Defence": ["1. e4 e6", "2. d4 d5"],
  "Queen's Gambit Declined": ["1. d4 d5", "2. c4 e6"],
  "Queen's Gambit Declined setup": ["1. d4 d5", "2. c4 e6", "3. Nc3 Nf6"],
  "Slav Defence": ["1. d4 d5", "2. c4 c6"],
  "Dutch Defence": ["1. d4 f5"],
  "King's Indian as future option": ["1. d4 Nf6", "2. c4 g6", "3. Nc3 Bg7"],
};

const FRONTEND_OPENING_STUDY_DETAILS = {
  "Italian Game": {
    mainPlan: "Develop quickly, castle, then build pressure on the centre and f7 with natural piece play.",
    commonMistake: "Do not launch an attack before your king is safe and your minor pieces are developed.",
  },
  "Scotch Game": {
    mainPlan: "Open the centre early, use active pieces, and make Black solve concrete development problems.",
    commonMistake: "Avoid trading into a quiet position without a plan for your active pieces.",
  },
  "Vienna Game": {
    mainPlan: "Develop flexibly, keep attacking chances, and only use f4 ideas when your pieces support them.",
    commonMistake: "Do not push pawns for an attack while your kingside pieces are still asleep.",
  },
  "King's Gambit": {
    mainPlan: "Use the f-pawn to fight for initiative, then develop fast before Black consolidates.",
    commonMistake: "Do not sacrifice material and then spend tempi moving the same piece repeatedly.",
  },
  "London System": {
    mainPlan: "Build a repeatable setup with Bf4, e3, Nf3, Bd3 and castle before choosing a central break.",
    commonMistake: "Do not play the same setup automatically if Black gives you a clear central opportunity.",
  },
  "Queen's Gambit": {
    mainPlan: "Challenge Black's centre with c4, develop calmly, and play for long-term central pressure.",
    commonMistake: "Do not chase the gambit pawn before your pieces are ready.",
  },
  "Caro-Kann Defence": {
    mainPlan: "Build a solid centre, develop safely, and counterattack once your structure is stable.",
    commonMistake: "Do not become too passive; look for the right ...c5 or ...e5 break.",
  },
  "French Defence": {
    mainPlan: "Challenge White's centre with a strong pawn chain, then prepare ...c5 and piece activity.",
    commonMistake: "Do not ignore the light-squared bishop and queenside development.",
  },
  "Scandinavian Defence": {
    mainPlan: "Challenge the centre immediately, move the queen once to safety, then develop quickly.",
    commonMistake: "Do not waste time with repeated queen moves after the opening.",
  },
  "Queen's Gambit Declined": {
    mainPlan: "Hold the centre, develop solidly, castle, and prepare central counterplay.",
    commonMistake: "Do not grab pawns before your development is complete.",
  },
  "Queen's Gambit Declined setup": {
    mainPlan: "Use a simple d5/e6/Nf6/Be7/castle setup against most d4 systems.",
    commonMistake: "Do not switch defences every game before learning one reliable structure.",
  },
  "Slav Defence": {
    mainPlan: "Support the d5 pawn with ...c6, develop actively, and keep a sturdy centre.",
    commonMistake: "Do not weaken the centre before your pieces are ready.",
  },
  "Dutch Defence": {
    mainPlan: "Fight for kingside space while developing carefully and protecting your own king.",
    commonMistake: "Do not overextend the kingside before castling and completing development.",
  },
};

function lowDataReliability(data) {
  const games = safeNumber(data?.gamesAnalysed ?? data?.gamesAnalyzed ?? data?.gamesImported ?? data?.total_games);
  const openings = [
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
  ].filter((item) => !isUnknownOpeningName(getOpeningName(item)));
  const repeated = openings.filter((item) => getOpeningGames(item) >= 3);
  const knownGames = openings.reduce((total, item) => total + getOpeningGames(item), 0);
  const reasons = [];

  if (games < 10) reasons.push("fewer than 10 analysed games");
  if (!repeated.length) reasons.push("no repeated opening pattern yet");
  if (knownGames < Math.max(3, Math.round(games * 0.45))) reasons.push("recognised opening coverage is low");

  return {
    lowData: games < 10 || !repeated.length || knownGames < Math.max(3, Math.round(games * 0.45)),
    gamesAnalyzed: games,
    recognizedOpeningGames: knownGames,
    repeatedOpeningCount: repeated.length,
    reasons: reasons.length ? reasons : ["opening history is strong enough for detected-opening recommendations"],
  };
}

function starterProfileKind(styleProfile = {}, games = 0) {
  const labels = (styleProfile.labels || []).map((item) => String(item).toLowerCase());
  const scores = styleProfile.scores || {};
  if (games < 10 || labels.includes("developing")) return "beginner";
  if (labels.includes("aggressive") || labels.includes("tactical") || safeNumber(scores.tactical) >= 4) return "aggressive";
  if (labels.includes("solid") && safeNumber(scores.tactical) < 3) return "positional";
  return "solid";
}

function frontendStarterItem(name, role, styleProfile, reliability) {
  const labels = styleProfile.labels?.length ? styleProfile.labels.join(", ") : "developing";
  const future = /king's gambit|dutch|catalan|king's indian/i.test(name);
  const confidence = reliability.gamesAnalyzed >= 5 && !future ? "Medium Confidence" : "Low Confidence";

  return {
    name,
    role,
    label: "Style-Based Recommendation",
    recommendationType: "style_based",
    confidence,
    confidenceLevel: confidence,
    whyItFits: `${name} fits your current ${labels.toLowerCase()} profile because it gives you a clearer opening plan while OpeningFit collects more repertoire evidence.`,
    corePlan: "Develop pieces, keep your king safe, and use the pawn structure to guide your middlegame plan.",
    commonMistakeAvoided: "This helps avoid random early moves and repeated queen moves before development.",
    starterMoveSequence: FRONTEND_OPENING_DETAILS[name] || [],
    futureUpgrade: future,
  };
}

function buildFrontendStyleBasedRecommendations(data) {
  const styleProfile = data?.styleProfile || data?.style_profile || {};
  const reliability = lowDataReliability(data || {});
  const kind = starterProfileKind(styleProfile, reliability.gamesAnalyzed);
  const names = FRONTEND_STARTER_OPENINGS[kind] || FRONTEND_STARTER_OPENINGS.beginner;
  const sectionTitles = {
    white: "White",
    blackVsE4: "Black vs 1.e4",
    blackVsD4: "Black vs 1.d4",
  };

  return {
    enabled: reliability.lowData,
    optional: !reliability.lowData,
    title: "Starter Opening Recommendations",
    message: "We couldn't find enough repeated opening data yet, so OpeningFit is recommending openings based on your playing style.",
    analysisVersion: "style-starters-v1-frontend",
    generatedAt: new Date().toISOString(),
    gamesAnalyzed: reliability.gamesAnalyzed,
    styleProfile,
    dataReliability: reliability,
    sections: Object.entries(names).map(([key, items]) => ({
      key,
      title: sectionTitles[key] || key,
      items: items.map((name) => frontendStarterItem(name, key, styleProfile, reliability)),
    })),
    futureUpgradeOpenings: [
      "Sicilian Najdorf",
      "Dragon Sicilian",
      "Grünfeld Defence",
      "Benoni Defence",
      "Advanced Catalan systems",
      "Highly theoretical King's Indian lines",
    ].map((name) => ({
      name,
      label: "Future Upgrade Opening",
      reason: "Theory-heavy opening. Add this later after your starter repertoire is stable.",
    })),
  };
}

function gamePassesReportFilters(game, filters) {
  const timeClass = getGameTimeControl(game);
  const timeFilter = filters?.timeControl || "serious";

  if (timeFilter === "serious" && !["rapid", "blitz"].includes(timeClass)) return false;
  if (timeFilter !== "all" && timeFilter !== "serious" && timeClass !== timeFilter) return false;
  if (!lineMatchesOpeningFilter(game, filters)) return false;

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

function buildWeakLineReason(line, parentOpening) {
  const parentRate = parentOpening ? getWinRate(parentOpening) : null;
  const parentText =
    parentRate !== null && parentRate !== undefined
      ? ` The overall ${line.opening} score is ${parentRate}%, so this looks like a specific variation problem.`
      : "";

  if (line.lossRate >= 60) {
    return `${line.lossRate}% of this line sample is losses across ${line.games} games.${parentText}`;
  }

  if (line.winRate <= 35) {
    return `The line scores only ${line.winRate}% across ${line.games} games, below the safe opening threshold.${parentText}`;
  }

  return `This variation is underperforming compared with the rest of the opening sample.${parentText}`;
}

function findWeakLinesFromGames(filteredGames, openings) {
  if (!Array.isArray(filteredGames) || !filteredGames.length) return [];

  const openingByName = new Map(
    (openings || []).map((opening) => [normaliseSearchText(getOpeningName(opening)), opening])
  );
  const statsByLine = new Map();

  filteredGames.forEach((game, index) => {
    const opening = getOpeningName(game);
    if (!opening || isUnknownOpeningName(opening)) return;

    const variation = getOpeningVariationName(game);
    const moveLine = getOpeningMoveLine(game);
    const lineLabel = variation || moveLine;
    if (!lineLabel) return;

    const context = itemContext(game);
    const key = `${normaliseSearchText(opening)}::${normaliseSearchText(lineLabel)}::${context}`;

    if (!statsByLine.has(key)) {
      statsByLine.set(key, {
        id: `weak-line-${statsByLine.size + 1}`,
        opening,
        name: opening,
        variation: variation || "",
        line: lineLabel,
        moveLine,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        context,
        contextLabel: contextLabel(context),
        sampleGames: [],
      });
    }

    const stats = statsByLine.get(key);
    const resultStats = gameResultStats(game?.result);
    stats.games += 1;
    stats.wins += resultStats.wins;
    stats.draws += resultStats.draws;
    stats.losses += resultStats.losses;
    if (stats.sampleGames.length < 3) stats.sampleGames.push(game?.url || game?.id || index);
  });

  return Array.from(statsByLine.values())
    .map((line) => {
      const winRate = line.games
        ? Math.round(((line.wins + line.draws * 0.5) / line.games) * 100)
        : 0;
      const lossRate = line.games ? Math.round((line.losses / line.games) * 100) : 0;
      const parent = openingByName.get(normaliseSearchText(line.opening));

      return {
        ...line,
        winRate,
        win_rate: winRate,
        lossRate,
        loss_rate: lossRate,
        parentWinRate: parent ? getWinRate(parent) : null,
      };
    })
    .filter((line) => {
      if (line.games < 3) return false;
      const parentLooksOkay = line.parentWinRate === null || line.parentWinRate >= 45;
      return line.lossRate >= 55 || line.winRate <= 35 || (parentLooksOkay && line.games >= 4 && line.winRate <= 42);
    })
    .map((line) => ({
      ...line,
      flagReason: buildWeakLineReason(line, openingByName.get(normaliseSearchText(line.opening))),
      trainingTarget: {
        name: line.opening,
        opening: line.opening,
        variation: line.variation || line.line,
        moveLine: line.moveLine,
        line: line.line,
        weakLine: true,
      },
    }))
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      if (b.lossRate !== a.lossRate) return b.lossRate - a.lossRate;
      return a.winRate - b.winRate;
    })
    .slice(0, 12);
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
  const weakLines = findWeakLinesFromGames(filteredGames, byGames);

  return {
    topOpenings: byGames,
    bestOpenings: byScore,
    preferredWhite,
    preferredBlack,
    weakLines,
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
  const openingLabel = filters.openingQuery ? `, ${filters.openingQuery}` : "";

  if (!aggregate) {
    return {
      ...data,
      reportFilters: { ...filters, timeLabel, dateLabel, limited: true },
      filterSummary: `${timeLabel}, ${dateLabel}${openingLabel}`,
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
    weak_lines: aggregate.weakLines,
    weakLines: aggregate.weakLines,
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
    filterSummary: `${timeLabel}, ${dateLabel}${openingLabel}`,
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
  const progressSnapshot = buildOpeningFitProgressSnapshot(data, fitData);
  const openingHealth = buildOpeningHealthSnapshot(data, fitData);
  const weakLines = mergeWeakLines(data);

  return {
    reportDate: new Date().toISOString(),
    username: data?.username || data?.playerName || data?.player_name || "Unknown player",
    platform: data?.platform || data?.importPlatform || "unknown",
    importMonths: data?.monthsChecked || data?.months_checked || data?.importMonths || "Recent",
    analysisTimeFormat: data?.analysisTimeFormat || data?.analysis_time_format || "custom",
    analysisTimeFormatLabel:
      data?.analysisTimeFormatLabel ||
      data?.analysis_time_format_label ||
      getAnalysisTimeFormatLabel(data?.analysisTimeFormat || data?.analysis_time_format),
    detectedTimeFormat: data?.detectedTimeFormat || data?.detected_time_format || null,
    effectiveTimeFormat: data?.effectiveTimeFormat || data?.effective_time_format || "custom",
    effectiveTimeFormatLabel:
      data?.effectiveTimeFormatLabel ||
      data?.effective_time_format_label ||
      getAnalysisTimeFormatLabel(data?.effectiveTimeFormat || data?.effective_time_format),
    styleProfile: data?.styleProfile || data?.style_profile || null,
    styleBasedRecommendations:
      data?.styleBasedRecommendations ||
      data?.style_based_recommendations ||
      null,
    games: data?.gamesAnalysed || data?.gamesAnalyzed || data?.gamesImported || data?.total_games || 0,
    topOpening: topOpenings[0]?.name || "No clear top opening yet",
    topOpenings,
    verdicts: Object.fromEntries(topOpenings.map((item) => [item.name, item.verdict])),
    confidenceLevels: Object.fromEntries(topOpenings.map((item) => [item.name, item.confidence])),
    studyTarget,
    healthScore:
      openingHealth.score ??
      fitData?.overallScore ??
      data?.openingFitScore ??
      data?.opening_fit_score ??
      data?.opening_health_score ??
      null,
    openingHealth,
    weakLines,
    openingFitProgress: progressSnapshot,
  };
}

function getProgressScoreValue(value) {
  const number = Number(String(value ?? "").replace("%", ""));
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number <= 1 ? number * 100 : number)));
}

function getProgressDateLabel(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "Recent analysis";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getProgressStyleSummary(data = {}) {
  const styleProfile = data?.styleProfile || data?.style_profile || {};
  const labels = [
    styleProfile.primaryStyle,
    styleProfile.primary_style,
    styleProfile.label,
    styleProfile.style,
    ...(Array.isArray(styleProfile.labels) ? styleProfile.labels : []),
  ]
    .filter(Boolean)
    .map((item) => String(item).replace(/[_-]+/g, " ").trim())
    .filter(Boolean);

  const unique = [...new Set(labels)];
  if (styleProfile.summary) return styleProfile.summary;
  if (unique.length) return unique.slice(0, 3).join(" / ");
  if (data?.styleLabel || data?.style_label) return data.styleLabel || data.style_label;
  return "Developing style profile";
}

function getProgressRecommendationCandidate(data = {}, fitData = null) {
  const scored = Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : [];
  const clearFit = scored.find((item) => getOpeningSignal(item).canBePrimary);
  const best = getOpeningSignal(fitData?.bestOpening || {}).canBePrimary ? fitData.bestOpening : null;
  const topOpening =
    clearFit ||
    best ||
    (Array.isArray(data?.best_openings) ? data.best_openings[0] : null) ||
    (Array.isArray(data?.top_openings) ? data.top_openings[0] : null) ||
    (Array.isArray(data?.topOpenings) ? data.topOpenings[0] : null);

  if (topOpening) return topOpening;

  const styleRec = data?.styleBasedRecommendations || data?.style_based_recommendations || null;
  const styleItem = styleRec?.sections?.flatMap((section) => section.items || [])?.[0];
  if (styleItem) return styleItem;

  const openingRec = data?.opening_recommendations || data?.openingRecommendations || null;
  const recommendationItem =
    openingRec?.whiteDetailed?.[0] ||
    openingRec?.white_repertoire?.[0] ||
    openingRec?.white?.[0] ||
    openingRec?.blackVsE4Detailed?.[0] ||
    openingRec?.black_vs_e4?.[0] ||
    openingRec?.blackVsE4?.[0];

  return recommendationItem || null;
}

function getProgressRecommendationConfidence(item, data = {}) {
  const raw =
    item?.fitConfidence ||
    item?.confidenceLabel ||
    item?.confidence_level ||
    item?.confidenceLevel ||
    item?.confidence ||
    data?.recommendationConfidence ||
    data?.recommendation_confidence ||
    "";
  if (!raw) return "Low Confidence";

  const text = String(raw).trim();
  if (/high/i.test(text)) return "High Confidence";
  if (/medium|moderate/i.test(text)) return "Medium Confidence";
  if (/low/i.test(text)) return "Low Confidence";
  return text;
}

function getProgressFromReportRow(row) {
  if (!row) return null;
  const summary = row.summary || row.snapshot || {};
  const progress = summary.openingFitProgress || summary.opening_fit_progress || row.coach_progress?.openingFitProgress;
  if (progress) return progress;

  return {
    username: summary.username || row.username || "Unknown player",
    platform: summary.platform || row.platform || "unknown",
    gamesAnalysed: Number(summary.games || row.report?.gamesImported || row.report?.total_games || 0) || 0,
    lastAnalysisDate: summary.reportDate || row.created_at || row.updated_at || "",
    mainOpeningRecommendation: summary.topOpening || summary.studyTarget || "No clear recommendation yet",
    recommendationConfidence:
      summary.confidenceLevels?.[summary.topOpening] || summary.recommendationConfidence || "Low Confidence",
    repertoireConfidenceScore: getProgressScoreValue(summary.healthScore),
    styleProfileSummary: getProgressStyleSummary(summary),
    suggestedNextAction: summary.studyTarget ? `Review ${summary.studyTarget} next.` : "Analyse more games to strengthen your profile.",
  };
}

function findPreviousProgressSnapshot(current, reportHistory = []) {
  if (!current || !Array.isArray(reportHistory)) return null;
  const currentTime = Date.parse(current.lastAnalysisDate || "");

  return reportHistory
    .map((row) => ({
      row,
      progress: getProgressFromReportRow(row),
      time: Date.parse(row?.summary?.reportDate || row?.created_at || row?.updated_at || ""),
    }))
    .filter(({ progress }) => {
      if (!progress) return false;
      const samePlayer =
        String(progress.username || "").toLowerCase() === String(current.username || "").toLowerCase() &&
        String(progress.platform || "").toLowerCase() === String(current.platform || "").toLowerCase();
      if (!samePlayer) return false;

      const sameSnapshot =
        progress.gamesAnalysed === current.gamesAnalysed &&
        progress.mainOpeningRecommendation === current.mainOpeningRecommendation &&
        progress.repertoireConfidenceScore === current.repertoireConfidenceScore;

      const rowTime = Date.parse(progress.lastAnalysisDate || "");
      const sameRecentTime =
        Number.isFinite(rowTime) &&
        Number.isFinite(currentTime) &&
        Math.abs(rowTime - currentTime) < 120000;

      return !(sameSnapshot && sameRecentTime);
    })
    .sort((a, b) => (Number.isFinite(b.time) ? b.time : 0) - (Number.isFinite(a.time) ? a.time : 0))[0]?.progress || null;
}

function describeProgressChange(current, previous) {
  if (!previous) return "First saved baseline created. Come back after another analysis to see what changed.";

  const gamesDelta = (current.gamesAnalysed || 0) - (previous.gamesAnalysed || 0);
  const scoreDelta =
    current.repertoireConfidenceScore !== null && previous.repertoireConfidenceScore !== null
      ? current.repertoireConfidenceScore - previous.repertoireConfidenceScore
      : null;

  if (current.mainOpeningRecommendation !== previous.mainOpeningRecommendation) {
    return `Main recommendation changed from ${previous.mainOpeningRecommendation} to ${current.mainOpeningRecommendation}.`;
  }

  if (Number.isFinite(scoreDelta) && scoreDelta !== 0) {
    return `Repertoire confidence ${scoreDelta > 0 ? "improved" : "moved"} by ${Math.abs(scoreDelta)} point${Math.abs(scoreDelta) === 1 ? "" : "s"} since last time.`;
  }

  if (gamesDelta > 0) {
    return `${gamesDelta} more game${gamesDelta === 1 ? "" : "s"} added to the recommendation sample.`;
  }

  return "No major change yet. Analyse a fresh batch after a few more games.";
}

function buildOpeningFitProgressSnapshot(data = {}, fitData = null, reportHistory = []) {
  const gamesAnalysed = Number(getProfileGameCount(data)) || 0;
  const score = getProgressScoreValue(
    fitData?.overallScore ??
      data?.openingFitScore ??
      data?.opening_fit_score ??
      data?.opening_health_score
  );
  const recommendation = getProgressRecommendationCandidate(data, fitData);
  const openingHealth = buildOpeningHealthSnapshot(data, fitData, reportHistory);
  const weakLines = mergeWeakLines(data);
  const mainOpeningRecommendation = recommendation ? getOpeningName(recommendation) : "No clear recommendation yet";
  const gamesNeeded = Math.max(0, 10 - gamesAnalysed);

  const current = {
    username: data?.username || data?.playerName || data?.player_name || "Unknown player",
    platform: data?.platform || data?.importPlatform || data?.import_platform || "unknown",
    gamesAnalysed,
    lastAnalysisDate:
      data?.importedAt ||
      data?.imported_at ||
      data?.lastUpdated ||
      data?.last_updated ||
      new Date().toISOString(),
    mainOpeningRecommendation,
    recommendationConfidence: getProgressRecommendationConfidence(recommendation, data),
    repertoireConfidenceScore: openingHealth.score ?? score,
    openingHealth,
    weakLines,
    styleProfileSummary: getProgressStyleSummary(data),
    gamesNeededForStrongerRecommendation: gamesNeeded,
    suggestedNextAction: gamesNeeded
      ? `OpeningFit needs ${gamesNeeded} more game${gamesNeeded === 1 ? "" : "s"} to give a stronger recommendation.`
      : mainOpeningRecommendation !== "No clear recommendation yet"
        ? `Review ${mainOpeningRecommendation} and analyse again after your next 5 games.`
        : "Analyse another batch after your next few games to unlock a clearer recommendation.",
  };
  const previous = findPreviousProgressSnapshot(current, reportHistory);

  return {
    ...current,
    whatChangedSinceLastTime: describeProgressChange(current, previous),
    previousAnalysisDate: previous?.lastAnalysisDate || null,
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
        <button type="button" onClick={() => onViewChange?.("train")}>
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

function normaliseNextStepOpening(item, data, fitData, index = 0) {
  const name = getOpeningName(item);
  if (!name || isUnknownOpeningName(name)) return null;

  const details = FRONTEND_OPENING_STUDY_DETAILS[name] || {};
  const firstMoves =
    item?.starterMoveSequence ||
    item?.starter_move_sequence ||
    item?.firstMoves ||
    item?.first_moves ||
    FRONTEND_OPENING_DETAILS[name] ||
    [];
  const whyItFits =
    item?.whyItFits ||
    item?.why_it_fits ||
    item?.fitExplanation ||
    item?.recommendationCopy ||
    getOpeningExplanation(item, data, index);
  const mainPlan =
    item?.corePlan ||
    item?.core_plan ||
    item?.plan ||
    item?.mainPlan ||
    details.mainPlan ||
    "Develop pieces, castle, and aim for a clear middlegame plan instead of memorising long theory.";
  const commonMistake =
    item?.commonMistakeAvoided ||
    item?.common_mistake_avoided ||
    item?.mistakeToAvoid ||
    item?.mistake_to_avoid ||
    details.commonMistake ||
    "Avoid random early pawn moves and repeated queen moves before development is complete.";
  const confidence =
    item?.confidenceLevel ||
    item?.confidence_level ||
    item?.fitConfidence ||
    item?.confidenceLabel ||
    item?.confidence ||
    getOpeningConfidence(item) ||
    "Low Confidence";

  return {
    name,
    confidence,
    whyItFits,
    firstMoves,
    mainPlan,
    commonMistake,
    learnBullets:
      item?.learnBullets ||
      item?.learn_bullets ||
      details.learnBullets ||
      ["Piece coordination", "Safe development", "Clear plans after the opening"],
    studyTask: `Your next task: play 5 games using the ${name}, then return to OpeningFit to update your profile.`,
  };
}

function confidenceStars(confidence = "") {
  const text = String(confidence).toLowerCase();
  if (text.includes("high")) return "★★★★★";
  if (text.includes("medium") || text.includes("moderate")) return "★★★☆☆";
  return "★★☆☆☆";
}

function coachConfidenceLabel(confidence = "") {
  const text = String(confidence).toLowerCase();
  if (text.includes("high")) return "High confidence";
  if (text.includes("medium") || text.includes("moderate")) return "Medium confidence";
  if (text.includes("low")) return "Low confidence";
  return confidence || "Building confidence";
}

function buildNextStepOpenings(data, fitData) {
  const styleRec = data?.styleBasedRecommendations || data?.style_based_recommendations || {};
  const styleItems = Array.isArray(styleRec.sections)
    ? styleRec.sections.flatMap((section) => section.items || [])
    : [];
  const recommendationBuckets = data?.opening_recommendations || data?.openingRecommendations || {};
  const bucketItems = [
    recommendationBuckets.whiteDetailed,
    recommendationBuckets.white_repertoire,
    recommendationBuckets.white,
    recommendationBuckets.blackVsE4Detailed,
    recommendationBuckets.black_vs_e4,
    recommendationBuckets.blackVsE4,
    recommendationBuckets.blackVsD4Detailed,
    recommendationBuckets.black_vs_d4,
    recommendationBuckets.blackVsD4,
    recommendationBuckets.blackVsD4OtherDetailed,
    recommendationBuckets.black_vs_d4_other,
    recommendationBuckets.blackVsD4Other,
  ].flatMap((source) => (Array.isArray(source) ? source : []));
  const studyTarget = buildStudyThisNextTarget(fitData)?.opening;
  const scored = Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : [];
  const candidates = [
    studyTarget,
    ...styleItems,
    ...bucketItems,
    ...scored.filter((opening) => getOpeningSignal(opening).canBePrimary),
    fitData?.bestOpening,
  ].filter(Boolean);
  const seen = new Set();

  return candidates
    .map((item, index) => normaliseNextStepOpening(item, data, fitData, index))
    .filter(Boolean)
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function buildDetectedOpeningSnapshot(data, fitData) {
  const sources = [
    ...(Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []),
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.topOpenings) ? data.topOpenings : []),
  ];
  const seen = new Set();

  return sources
    .map((opening) => ({
      name: getOpeningName(opening),
      games: getOpeningGames(opening),
      score: getWinRate(opening),
      confidence:
        opening?.fitConfidence ||
        opening?.confidenceLabel ||
        opening?.confidence ||
        getOpeningConfidence(opening) ||
        "Unlabelled",
      verdict: opening?.fitDisplayVerdict || opening?.fitVerdict || opening?.verdict || "Tracked",
      context: itemContext(opening),
    }))
    .filter((opening) => opening.name && !isUnknownOpeningName(opening.name))
    .filter((opening) => {
      const key = `${opening.name.toLowerCase()}::${opening.context}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function buildRecommendationHistorySnapshot(data, fitData) {
  const progress = buildOpeningFitProgressSnapshot(data, fitData);
  const recommendedOpenings = buildNextStepOpenings(data, fitData).map((opening) => ({
    name: opening.name,
    confidence: opening.confidence,
    whyItFits: opening.whyItFits,
    firstMoves: opening.firstMoves,
    mainPlan: opening.mainPlan,
    commonMistake: opening.commonMistake,
    studyTask: opening.studyTask,
  }));
  const detectedOpenings = buildDetectedOpeningSnapshot(data, fitData);

  return {
    userId: null,
    analysisDate: progress.lastAnalysisDate || new Date().toISOString(),
    gamesAnalysed: progress.gamesAnalysed || 0,
    detectedOpenings,
    recommendedOpenings,
    confidenceScore: progress.repertoireConfidenceScore,
    styleProfile: data?.styleProfile || data?.style_profile || null,
    styleProfileSummary: progress.styleProfileSummary,
    timeControlFilter:
      data?.analysisTimeFormat ||
      data?.analysis_time_format ||
      data?.effectiveTimeFormat ||
      data?.effective_time_format ||
      "custom",
    analysisVersion:
      data?.analysisVersion ||
      data?.analysis_version ||
      data?.version ||
      "retention-history-v1",
    currentRecommendation: recommendedOpenings[0]?.name || progress.mainOpeningRecommendation,
    recommendationConfidence: progress.recommendationConfidence,
    progress,
  };
}

function normalizeRecommendationHistoryRow(row) {
  if (!row) return null;
  const snapshot = row.snapshot || {};

  return {
    id: row.id || snapshot.id,
    analysisDate: row.analysis_date || snapshot.analysisDate || snapshot.analysis_date || row.created_at || "",
    gamesAnalysed:
      Number(row.games_analysed ?? snapshot.gamesAnalysed ?? snapshot.games_analysed ?? 0) || 0,
    detectedOpenings: row.detected_openings || snapshot.detectedOpenings || snapshot.detected_openings || [],
    recommendedOpenings: row.recommended_openings || snapshot.recommendedOpenings || snapshot.recommended_openings || [],
    confidenceScore: getProgressScoreValue(row.confidence_score ?? snapshot.confidenceScore ?? snapshot.confidence_score),
    styleProfile: row.style_profile || snapshot.styleProfile || snapshot.style_profile || null,
    styleProfileSummary:
      snapshot.styleProfileSummary ||
      snapshot.progress?.styleProfileSummary ||
      getProgressStyleSummary(row.style_profile || snapshot),
    timeControlFilter: row.time_control_filter || snapshot.timeControlFilter || snapshot.time_control_filter || "custom",
    analysisVersion: row.analysis_version || snapshot.analysisVersion || snapshot.analysis_version || "retention-history-v1",
    currentRecommendation:
      snapshot.currentRecommendation ||
      snapshot.current_recommendation ||
      (row.recommended_openings || snapshot.recommendedOpenings || [])[0]?.name ||
      "No clear recommendation yet",
    recommendationConfidence:
      snapshot.recommendationConfidence ||
      snapshot.recommendation_confidence ||
      (row.recommended_openings || snapshot.recommendedOpenings || [])[0]?.confidence ||
      "Low Confidence",
  };
}

function getRecommendationHistoryChange(current, previous) {
  if (!current) return "No recommendation history yet.";
  if (!previous) return "First recommendation snapshot saved. Analyse again after more games to see what changed.";

  if (current.currentRecommendation !== previous.currentRecommendation) {
    return `Current recommendation changed from ${previous.currentRecommendation} to ${current.currentRecommendation}.`;
  }

  const confidenceDelta =
    current.confidenceScore !== null && previous.confidenceScore !== null
      ? current.confidenceScore - previous.confidenceScore
      : null;

  if (Number.isFinite(confidenceDelta) && confidenceDelta !== 0) {
    return `${current.currentRecommendation} fit score ${confidenceDelta > 0 ? "increased" : "changed"} from ${previous.confidenceScore}% to ${current.confidenceScore}%.`;
  }

  if (current.styleProfileSummary !== previous.styleProfileSummary) {
    return `OpeningFit now has more evidence that your style is ${current.styleProfileSummary.toLowerCase()}.`;
  }

  const gamesDelta = current.gamesAnalysed - previous.gamesAnalysed;
  if (gamesDelta > 0) {
    return `${gamesDelta} more game${gamesDelta === 1 ? "" : "s"} added to the evidence behind this recommendation.`;
  }

  return "No major recommendation change yet. Play more games, then reanalyse to update the profile.";
}

function getAnalysisTrustSignals(data, fitData) {
  const games =
    data?.gamesAnalysed ||
    data?.gamesAnalyzed ||
    data?.games_analyzed ||
    data?.gamesImported ||
    data?.total_games ||
    0;
  const detectedOpenings = buildDetectedOpeningSnapshot(data, fitData);
  const recommendedOpenings = buildNextStepOpenings(data, fitData);
  const confidenceScore = getProgressScoreValue(
    fitData?.overallScore ??
      data?.openingFitScore ??
      data?.opening_fit_score ??
      data?.opening_health_score
  );
  const styleRec = data?.styleBasedRecommendations || data?.style_based_recommendations || {};
  const lowData =
    Boolean(styleRec?.enabled || styleRec?.dataReliability?.lowData || styleRec?.data_reliability?.low_data) ||
    !detectedOpenings.some((opening) => Number(opening.games || 0) >= 3);
  const confidenceLevel =
    confidenceScore === null
      ? recommendedOpenings[0]?.confidence || "Building confidence"
      : confidenceScore >= 70
        ? "High confidence"
        : confidenceScore >= 45
          ? "Medium confidence"
          : "Low confidence";

  return {
    games,
    openingsDetected: detectedOpenings.length,
    confidenceLevel,
    confidenceScore,
    basis: lowData
      ? "Style-based suggestions while opening data is limited"
      : "Real opening data from your analysed games",
  };
}

function AnalysisTrustSignalsPanel({ data, fitData }) {
  if (!data) return null;

  const trust = getAnalysisTrustSignals(data, fitData);

  return (
    <section className="analysisTrustSignalsPanel" aria-label="Analysis trust signals">
      <div>
        <p className="eyebrow">Why trust this report</p>
        <h2>OpeningFit shows the evidence behind the recommendation</h2>
        <p>Your recommendations improve when you come back after playing more games.</p>
      </div>

      <div className="analysisTrustSignalGrid">
        <article>
          <span>Games analysed</span>
          <strong>{trust.games || 0}</strong>
          <p>Recent public games feeding this report.</p>
        </article>
        <article>
          <span>Openings detected</span>
          <strong>{trust.openingsDetected}</strong>
          <p>Your most played opening patterns found in the sample.</p>
        </article>
        <article>
          <span>How sure are we?</span>
          <strong>{trust.confidenceScore !== null ? `${trust.confidenceScore}%` : trust.confidenceLevel}</strong>
          <div className="analysisTrustMeter" aria-hidden="true">
            <span style={{ width: `${trust.confidenceScore ?? 42}%` }} />
          </div>
          <p>{trust.confidenceLevel}</p>
        </article>
        <article>
          <span>Why this advice?</span>
          <strong>{trust.basis}</strong>
          <p>Starter suggestions are clearly separated from your played openings.</p>
        </article>
      </div>
    </section>
  );
}

function ComeBackAfterPlayingPrompt({ data, fitData, onAnalyse }) {
  if (!data) return null;

  const trust = getAnalysisTrustSignals(data, fitData);
  const games = Number(trust.games || 0);
  const nextTarget = games < 10 ? 10 : Math.ceil((games + 1) / 10) * 10;
  const lowData = games < 10 || /style-based/i.test(trust.basis);
  const confidenceText =
    String(trust.confidenceLevel || "Medium confidence")
      .replace(/\s+confidence/i, "")
      .replace(/^./, (char) => char.toUpperCase()) || "Medium";

  return (
    <section className="comeBackPrompt" aria-label="When to come back">
      <div>
        <p className="eyebrow">Next update</p>
        <h2>Play 5 more games, then come back to improve your recommendation.</h2>
        <p>
          {lowData
            ? `You only have ${games} game${games === 1 ? "" : "s"} analysed. OpeningFit can give starter suggestions now, but your recommendations will improve after 5-10 games.`
            : "Your opening data is clear. Reanalyse weekly to track changes in your repertoire."}
        </p>
      </div>

      <div className="comeBackPromptStats">
        <article>
          <span>Next update target</span>
          <strong>{nextTarget} games analysed</strong>
        </article>
        <article>
          <span>Current confidence</span>
          <strong>{confidenceText}</strong>
        </article>
        <article>
          <span>Plan</span>
          <strong>Analyse again after more games for a stronger repertoire plan.</strong>
        </article>
      </div>

      <button type="button" className="secondaryButton" onClick={onAnalyse}>
        Analyse again later
      </button>
    </section>
  );
}

function PostAnalysisActionFlow({ data, fitData, onPractice, onViewChange }) {
  if (!data) return null;

  const scoredOpenings = uniqueOpeningsByNameAndContext(
    Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []
  )
    .filter((opening) => !isUnknownOpeningName(getOpeningName(opening)))
    .sort(evidenceSort);
  const verdictFor = (opening) =>
    openingVerdictLabel(opening, data, opening?.fitVerdict || opening?.verdict);
  const keepOpenings = scoredOpenings.filter((opening) => verdictFor(opening) === "Keep");
  const repairOpenings = scoredOpenings.filter((opening) =>
    ["Improve", "Avoid"].includes(verdictFor(opening))
  );
  const strength = fitData?.bestOpening || keepOpenings[0] || scoredOpenings[0] || null;
  const weakness =
    fitData?.weakestOpening ||
    [...repairOpenings].sort((a, b) => {
      const scoreDelta = getWinRate(a) - getWinRate(b);
      if (scoreDelta) return scoreDelta;
      return getOpeningGames(b) - getOpeningGames(a);
    })[0] ||
    scoredOpenings[1] ||
    null;
  const nextStepOpenings = buildNextStepOpenings(data, fitData);
  const studyTarget = buildStudyThisNextTarget(fitData);
  const actionOpening =
    nextStepOpenings[0] ||
    (studyTarget ? normaliseNextStepOpening(studyTarget.opening, data, fitData, 0) : null);
  const trust = getAnalysisTrustSignals(data, fitData);
  const score =
    getProgressScoreValue(
      fitData?.overallScore ??
        data?.openingFitScore ??
        data?.opening_fit_score ??
        data?.opening_health_score
    ) ?? trust.confidenceScore;
  const strengthName = strength ? getOpeningName(strength) : "No clear strength yet";
  const weaknessName = weakness ? getOpeningName(weakness) : "We need a few more games";
  const actionName = actionOpening?.name || studyTarget?.name || weaknessName;
  const strengthConfidence = strength ? getOpeningConfidence(strength) : trust.confidenceLevel;
  const weaknessConfidence = weakness ? getOpeningConfidence(weakness) : "Low confidence";
  const actionConfidence = actionOpening?.confidence || studyTarget?.confidence || trust.confidenceLevel;
  const riskyOpening = repairOpenings.find((opening) => verdictFor(opening) === "Avoid") || weakness;

  const scrollToImport = () => {
    onViewChange?.("analyse");
    setTimeout(() => {
      const target = document.getElementById("import") || document.querySelector(".analyseImportHero");
      if (target?.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const scrollToNextSteps = () => {
    setTimeout(() => {
      const target = document.getElementById("analysis-next-steps") || document.getElementById("app-results");
      if (target?.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const cards = [
    {
      key: "score",
      section: "SECTION 1",
      title: "Your Repertoire Score",
      value: score !== null ? `${score} / 100` : "Building",
      meta: `${trust.games || 0} games analysed`,
      tone: "score",
      problem: "How strong and clear is my opening profile?",
      explanation:
        score !== null
          ? `OpeningFit rates your current repertoire clarity at ${score}/100 based on the games in this report.`
          : "OpeningFit needs a few more games before it can give this a reliable score.",
      action: "Play 5 more games, then reanalyse to make the score more accurate.",
      cta: "Analyse My Games",
      onClick: scrollToImport,
    },
    {
      key: "strength",
      section: "SECTION 2",
      title: "Biggest Strength",
      label: "Strongest Opening",
      value: strengthName,
      meta: strength ? `${getWinRate(strength)}% fit score` : "Still learning",
      confidence: strengthConfidence,
      tone: "strength",
      problem: "What should I keep playing?",
      explanation: strength
        ? `${getOpeningContextTitle(strength)} is your clearest positive signal right now.`
        : "No repeated strong opening has appeared yet, so start with one simple setup and collect more games.",
      action: strength
        ? `Keep ${strengthName} in your repertoire and review the first plan after move 6.`
        : "Pick one starter opening, play it for a week, and return with fresh games.",
      cta: "Train Opening",
      onClick: () => (strength ? onPractice?.(strengthName) : onViewChange?.("train")),
    },
    {
      key: "weakness",
      section: "SECTION 3",
      title: "Biggest Weakness",
      label: "Needs Repair",
      value: weaknessName,
      meta: weakness ? `${getWinRate(weakness)}% fit score` : "More games needed",
      confidence: weaknessConfidence,
      tone: "weakness",
      problem: "What is costing me points?",
      explanation: weakness
        ? `${getOpeningContextTitle(weakness)} is the opening pattern most worth repairing before you add new ideas.`
        : "OpeningFit has not found a repeated problem yet. That is normal for a small game sample.",
      action: weakness
        ? `Repair ${weaknessName} by learning the first 6 moves and one simple middlegame plan.`
        : "Avoid spreading your study across too many openings until one pattern repeats.",
      cta: "Repair Opening",
      onClick: () => (weakness ? onPractice?.(weaknessName) : onViewChange?.("train")),
    },
    {
      key: "action",
      section: "SECTION 4",
      title: "Recommended Opening Action",
      label: weakness ? "Suggested Focus" : "Starter Recommendation",
      value: actionName,
      meta: coachConfidenceLabel(actionConfidence),
      confidence: actionConfidence,
      tone: "action",
      problem: "What should I do next?",
      explanation:
        actionOpening?.whyItFits ||
        studyTarget?.why ||
        "This is the most useful next step from your current report.",
      action:
        actionOpening?.studyTask ||
        studyTarget?.goal ||
        `Play 5 games with ${actionName}, then come back to update your OpeningFit profile.`,
      cta: weakness ? "Find Alternative" : "Start Training",
      onClick: weakness ? scrollToNextSteps : () => onPractice?.(actionName),
    },
  ];

  const studyPlan = [
    weakness ? `Repair ${weaknessName}` : "Choose one repeatable starter opening",
    strength ? `Review ${strengthName} responses` : "Play 5 games with the same setup",
    riskyOpening ? `Avoid ${getOpeningName(riskyOpening)} experiments for now` : "Come back after 5 more games",
  ];

  return (
    <section className="postAnalysisFlow" aria-label="Post-analysis action plan">
      <div className="postAnalysisFlowHeader">
        <p className="eyebrow">Your report path</p>
        <h2>Here is what to do next</h2>
        <p>
          OpeningFit turns this report into a simple training loop: repair one weakness, keep one strength, then
          reanalyse after more games.
        </p>
      </div>

      <div className="postAnalysisHierarchy">
        {cards.map((card) => (
          <article className={`postAnalysisCard postAnalysisCard--${card.tone}`} key={card.key}>
            <div className="postAnalysisCardTop">
              <span>{card.section}</span>
              <strong>{card.title}</strong>
            </div>
            {card.label ? <p className="postAnalysisLabel">{card.label}</p> : null}
            <h3>{card.value}</h3>
            <p className="postAnalysisMeta">
              {card.meta}
              {card.confidence ? (
                <span aria-label={coachConfidenceLabel(card.confidence)}>
                  {confidenceStars(card.confidence)}
                </span>
              ) : null}
            </p>
            <dl>
              <div>
                <dt>Problem</dt>
                <dd>{card.problem}</dd>
              </div>
              <div>
                <dt>Explanation</dt>
                <dd>{card.explanation}</dd>
              </div>
              <div>
                <dt>Recommended action</dt>
                <dd>{card.action}</dd>
              </div>
            </dl>
            <button
              type="button"
              className={card.key === "score" ? "secondaryButton" : "primaryBtn"}
              onClick={card.onClick}
            >
              {card.cta}
            </button>
          </article>
        ))}

        <article className="postAnalysisCard postAnalysisCard--study">
          <div className="postAnalysisCardTop">
            <span>SECTION 5</span>
            <strong>Study Plan</strong>
          </div>
          <p className="postAnalysisLabel">This Week's Study Plan</p>
          <ol className="postAnalysisStudyList">
            {studyPlan.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <dl>
            <div>
              <dt>Problem</dt>
              <dd>It is easy to finish a report and study too many things at once.</dd>
            </div>
            <div>
              <dt>Explanation</dt>
              <dd>A focused week gives OpeningFit clearer evidence when you come back.</dd>
            </div>
            <div>
              <dt>Recommended action</dt>
              <dd>Train once, play 5 games, then reanalyse to see what changed.</dd>
            </div>
          </dl>
          <button type="button" className="primaryBtn" onClick={() => onViewChange?.("train")}>
            Start Training
          </button>
        </article>
      </div>
    </section>
  );
}

function MobileReportQuickGuide({ data, fitData, onPractice, onViewChange }) {
  if (!data) return null;

  const scoredOpenings = uniqueOpeningsByNameAndContext(
    Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []
  )
    .filter((opening) => !isUnknownOpeningName(getOpeningName(opening)))
    .sort(evidenceSort);
  const verdictFor = (opening) =>
    openingVerdictLabel(opening, data, opening?.fitVerdict || opening?.verdict);
  const keepOpening =
    fitData?.bestOpening ||
    scoredOpenings.find((opening) => verdictFor(opening) === "Keep") ||
    scoredOpenings[0] ||
    null;
  const improveOpening =
    fitData?.weakestOpening ||
    scoredOpenings.find((opening) => verdictFor(opening) === "Improve") ||
    scoredOpenings.find((opening) => verdictFor(opening) === "Avoid") ||
    scoredOpenings[1] ||
    null;
  const nextStepOpenings = buildNextStepOpenings(data, fitData);
  const replaceOpening =
    scoredOpenings.find((opening) => verdictFor(opening) === "Avoid") ||
    (nextStepOpenings[0]
      ? {
          ...nextStepOpenings[0],
          fitDisplayVerdict: "Replace",
        }
      : null);
  const quickNav = [
    { label: "Overview", target: "mobile-report-overview" },
    { label: "Strengths", target: "mobile-report-strengths" },
    { label: "Weaknesses", target: "mobile-report-weaknesses" },
    { label: "Study Plan", target: "analysis-next-steps" },
  ];
  const scrollToTarget = (targetId) => {
    const target = document.getElementById(targetId) || document.getElementById("app-results");
    if (target?.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const cards = [
    {
      key: "keep",
      label: "Keep",
      opening: keepOpening,
      fallback: "No clear strength yet",
      score: keepOpening ? getWinRate(keepOpening) : null,
      reason: keepOpening ? "Strong results" : "Analyse more games",
      cta: "Train",
      target: "mobile-report-strengths",
      onClick: () => (keepOpening ? onPractice?.(getOpeningName(keepOpening)) : onViewChange?.("train")),
    },
    {
      key: "improve",
      label: "Improve",
      opening: improveOpening,
      fallback: "Repair target pending",
      score: improveOpening ? getWinRate(improveOpening) : null,
      reason: improveOpening ? "Repeated early losses" : "We need a few more games",
      cta: "Repair",
      target: "mobile-report-weaknesses",
      onClick: () => (improveOpening ? onPractice?.(getOpeningName(improveOpening)) : onViewChange?.("train")),
    },
    {
      key: "replace",
      label: "Replace",
      opening: replaceOpening,
      fallback: "No replacement needed yet",
      score: replaceOpening ? getWinRate(replaceOpening) : null,
      reason: replaceOpening ? "Creating avoidable risk" : "Current data is not clear enough",
      cta: "Find Alternative",
      target: "analysis-next-steps",
      onClick: () => scrollToTarget("analysis-next-steps"),
    },
  ];

  return (
    <section className="mobileReportGuide" id="mobile-report-overview" aria-label="Mobile report overview">
      <nav className="mobileReportQuickNav" aria-label="Report quick navigation">
        {quickNav.map((item) => (
          <button key={item.target} type="button" onClick={() => scrollToTarget(item.target)}>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mobileReportActionGrid" aria-label="Report action cards">
        {cards.map((card) => {
          const name = card.opening ? getOpeningName(card.opening) : card.fallback;

          return (
            <article
              className={`mobileReportActionCard mobileReportActionCard--${card.key}`}
              id={card.target}
              key={card.key}
            >
              <span>{card.label}</span>
              <strong>{name}</strong>
              <em>{card.score !== null ? `${card.score}%` : "Soon"}</em>
              <p>{card.reason}</p>
              <button type="button" className="primaryBtn" onClick={card.onClick}>
                {card.cta}
              </button>
            </article>
          );
        })}
      </div>

      <div className="mobileReportStickyCta" aria-label="Report next action">
        <button type="button" className="primaryBtn" onClick={() => scrollToTarget("analysis-next-steps")}>
          Open Study Plan
        </button>
      </div>
    </section>
  );
}

function AnalysisNextStepsPanel({ data, fitData, onPractice, onViewChange }) {
  const { user, recordActivity, saveRecommendationHistory } = useAuth();
  const [status, setStatus] = useState("");
  const openings = buildNextStepOpenings(data, fitData);
  const primaryOpening = openings[0]?.name || buildStudyThisNextTarget(fitData)?.name || "your recommended opening";
  const featuredOpening = openings[0] || normaliseNextStepOpening({ name: "Italian Game" }, data, fitData);

  if (!data) return null;

  const saveRecommendation = async () => {
    const savedAt = new Date().toISOString();
    const payload = {
      savedAt,
      username: data?.username || data?.playerName || data?.player_name || "Unknown player",
      openings,
    };

    try {
      const current = JSON.parse(localStorage.getItem("openingFit:savedRecommendations") || "[]");
      const next = [payload, ...(Array.isArray(current) ? current : [])].slice(0, 20);
      localStorage.setItem("openingFit:savedRecommendations", JSON.stringify(next));

      if (user?.id && recordActivity) {
        await saveRecommendationHistory?.(buildRecommendationHistorySnapshot(data, fitData));
        await recordActivity("recommendation_saved", {
          saved_at: savedAt,
          openings: openings.map((item) => item.name),
        });
      }

      setStatus("Recommendation saved. Come back after a few games and analyse again.");
    } catch (error) {
      console.warn("Could not save recommendation", error);
      setStatus("Could not save this recommendation right now.");
    }
  };

  return (
    <section className="analysisNextStepsPanel" id="analysis-next-steps">
      <div className="analysisNextStepsHeader">
        <div>
          <p className="eyebrow">What should I play?</p>
          <h2>Your next opening to try</h2>
          <p>Start with one opening, play a few games, then come back so OpeningFit can sharpen the plan.</p>
        </div>
      </div>

      {featuredOpening ? (
        <article className="premiumRecommendationCard">
          <div className="premiumRecommendationTop">
            <span>Good fit match</span>
            <strong>{featuredOpening.name}</strong>
            <div className="premiumConfidenceVisual" aria-label={coachConfidenceLabel(featuredOpening.confidence)}>
              <span>{coachConfidenceLabel(featuredOpening.confidence)}</span>
              <em>{confidenceStars(featuredOpening.confidence)}</em>
            </div>
          </div>

          <div className="premiumRecommendationBody">
            <div>
              <span>Why this fits</span>
              <p>{featuredOpening.whyItFits}</p>
            </div>
            <div>
              <span>What you'll learn</span>
              <ul>
                {(featuredOpening.learnBullets || []).slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <span>Your next task</span>
              <p>{featuredOpening.studyTask}</p>
            </div>
          </div>

          <div className="premiumRecommendationActions">
            <button type="button" className="primaryBtn" onClick={() => onPractice?.(featuredOpening.name)}>
              Train Opening
            </button>
            <button type="button" className="secondaryButton" onClick={() => onViewChange?.("train")}>
              Learn More
            </button>
            <button
              type="button"
              className="secondaryButton"
              onClick={() => {
                onViewChange?.("analyse");
                setTimeout(() => {
                  const target = document.getElementById("import") || document.querySelector(".analyseImportHero");
                  if (target?.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 80);
              }}
            >
              Analyse More Games
            </button>
          </div>
        </article>
      ) : null}

      <div className="analysisNextStepActions">
        <button type="button" className="primaryBtn" onClick={saveRecommendation}>
          Save this recommendation
        </button>
        <button type="button" className="secondaryButton" onClick={() => onPractice?.(primaryOpening)}>
          Learn this opening
        </button>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => {
            onViewChange?.("analyse");
            setTimeout(() => {
              const target = document.getElementById("import") || document.querySelector(".analyseImportHero");
              if (target?.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 80);
          }}
        >
          Analyse more games to improve confidence
        </button>
      </div>

      {status ? <p className="analysisNextStepsStatus">{status}</p> : null}

      <div className="analysisNextOpeningGrid">
        {(openings.length ? openings : [normaliseNextStepOpening({ name: "Italian Game" }, data, fitData)]).map((opening) => (
          <article className="analysisNextOpeningCard" key={opening.name}>
            <div className="analysisNextOpeningTop">
              <span>{coachConfidenceLabel(opening.confidence)} {confidenceStars(opening.confidence)}</span>
              <strong>{opening.name}</strong>
            </div>
            <dl>
              <div>
                <dt>Why it fits</dt>
                <dd>{opening.whyItFits}</dd>
              </div>
              <div>
                <dt>First moves</dt>
                <dd>{opening.firstMoves?.length ? opening.firstMoves.join(" · ") : "Learn the first 6 moves and stop there for now."}</dd>
              </div>
              <div>
                <dt>Main plan</dt>
                <dd>{opening.mainPlan}</dd>
              </div>
              <div>
                <dt>Common mistake to avoid</dt>
                <dd>{opening.commonMistake}</dd>
              </div>
              <div>
                <dt>Beginner-friendly study task</dt>
                <dd>{opening.studyTask}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportOpeningFilters({ filters, onFiltersChange, data }) {
  const activeFilters = filters || {};
  const updateFilter = (key, value) => {
    onFiltersChange?.((current) => ({
      ...(current || {}),
      [key]: value,
    }));
  };
  const clearOpeningQuery = () => updateFilter("openingQuery", "");
  const hasOpeningQuery = Boolean(String(activeFilters.openingQuery || "").trim());

  return (
    <section className="reportFilters reportOpeningFilters" aria-label="Report filters">
      <div className="reportFiltersHeader">
        <div>
          <p className="eyebrow">Report filters</p>
          <h2>Focus by opening or variation</h2>
        </div>
        <span>{data?.filterSummary || "Current report"}</span>
      </div>

      <div className="reportFilterControls">
        <label className="reportOpeningSearch">
          <span>Opening / variation</span>
          <input
            className="input"
            type="search"
            value={activeFilters.openingQuery || ""}
            onChange={(event) => updateFilter("openingQuery", event.target.value)}
            placeholder="Italian, Caro-Kann Advance, 1.e4 c6..."
          />
        </label>

        <div>
          <span>Time control</span>
          <div className="segmentedControl compactSegmentedControl">
            {TIME_CONTROL_FILTERS.filter((item) => ["serious", "blitz", "rapid", "all"].includes(item.key)).map((item) => (
              <button
                key={item.key}
                type="button"
                className={activeFilters.timeControl === item.key ? "active" : ""}
                onClick={() => updateFilter("timeControl", item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span>Date range</span>
          <div className="segmentedControl compactSegmentedControl">
            {DATE_RANGE_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={activeFilters.dateRange === item.key ? "active" : ""}
                onClick={() => updateFilter("dateRange", item.key)}
              >
                {item.label.replace("Last ", "")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p>
        {hasOpeningQuery
          ? "Only games matching that opening, variation, or move line are included in the report below."
          : "Use this to isolate one opening family or variation without changing the existing time and date filters."}
        {hasOpeningQuery ? (
          <button className="inlineFilterClear" type="button" onClick={clearOpeningQuery}>
            Clear opening filter
          </button>
        ) : null}
      </p>
    </section>
  );
}

function FinalReportFlow({
  data,
  fitData,
  activeView,
  onPractice,
  onViewChange,
  onNavigate,
  onLoadReport,
  recentGames = [],
  isPremium = false,
  reportHistory = [],
  openingFitUserState = [],
  reportFilters,
  onReportFiltersChange,
}) {
  const studyTarget = buildStudyThisNextTarget(fitData);
  const [reportMode, setReportMode] = useState("summary");
  const showFullReport = reportMode === "full";
  const showOpeningTable = reportMode === "table";

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleReportMode = (event) => {
      const mode = event.detail?.mode;
      if (["summary", "full", "table"].includes(mode)) {
        setReportMode(mode);
      }
    };

    window.addEventListener("openingfit:set-report-mode", handleReportMode);
    return () => window.removeEventListener("openingfit:set-report-mode", handleReportMode);
  }, []);

  return (
    <div className="finalReportFlow">
      <ReportCommandBar
        data={data}
        activeView={activeView}
        reportMode={reportMode}
        onReportModeChange={setReportMode}
        onNavigate={onNavigate}
        isPremium={isPremium}
        onUpgrade={() => onNavigate?.("premium")}
      />

      <CurrentReportSummary
        data={data}
        fitData={fitData}
        onViewChange={(view) => onNavigate?.(view) || onViewChange?.(view)}
        reportMode={reportMode}
        onReportModeChange={setReportMode}
      />

      <NextBestTrainingActionCard
        data={data}
        fitData={fitData}
        onStartTraining={() => {
          onNavigate?.({
            view: "train",
            path: "/train",
            target: "today-training",
            fallbackIds: ["training-plan", "opening-practice"],
          });
        }}
      />

      <OpeningFitScoreList
        fitData={fitData}
        onPractice={onPractice}
      />

      <OpeningHealthScore
        data={data}
        fitData={fitData}
        history={reportHistory}
      />

      <ReportOpeningFilters
        filters={reportFilters}
        onFiltersChange={onReportFiltersChange}
        data={data}
      />

      <MobileReportQuickGuide
        data={data}
        fitData={fitData}
        onPractice={onPractice}
        onViewChange={(view) => onNavigate?.(view) || onViewChange?.(view)}
      />

      <AnalysisNextStepsPanel
        data={data}
        fitData={fitData}
        onPractice={onPractice}
        onViewChange={(view) => onNavigate?.(view) || onViewChange?.(view)}
      />

      <WeakSpotsCommandPanel
        data={data}
        fitData={fitData}
        onPractice={onPractice}
        onViewChange={(view) => onNavigate?.(view) || onViewChange?.(view)}
      />

      <ReportTrainingPreview
        data={data}
        fitData={fitData}
        studyTarget={studyTarget}
        recentGames={recentGames}
        onPractice={onPractice}
        onNavigate={onNavigate}
      />

      {showFullReport ? (
        <>
          <FullReportHighlights data={data} fitData={fitData} onPractice={onPractice} />

          <RepertoireCommandPanel data={data} onPractice={onPractice} />
          <RepertoireMap data={data} />
          <EvidenceTableSection data={data} fitData={fitData} isPremium={isPremium} onPractice={onPractice} />
          <InterestingThinDataSection data={data} fitData={fitData} />
        </>
      ) : null}

      {showOpeningTable ? (
        <EvidenceTableSection data={data} fitData={fitData} isPremium={isPremium} onPractice={onPractice} />
      ) : null}

      <AnalysisTrustSignalsPanel data={data} fitData={fitData} />
      <ImportQualitySummary data={data} />
      <WeeklyOpeningReport
        data={data}
        savedHistory={
          openingFitUserState
            .flatMap((row) => row?.coach_progress?.weeklyOpeningSnapshots || [])
            .filter(Boolean)
        }
      />
      <OpeningGamificationProgress
        data={data}
        fitData={fitData}
        savedProgress={
          openingFitUserState
            .map((row) => row?.coach_progress?.openingGamification || null)
            .filter(Boolean)[0] || null
        }
      />

      <ComeBackAfterPlayingPrompt
        data={data}
        fitData={fitData}
        onAnalyse={() => onNavigate?.("analyse") || onViewChange?.("analyse")}
      />

      <ReportExportAndHistory
        data={data}
        isPremium={isPremium}
        onUpgrade={() => onNavigate?.("premium")}
        onLoadReport={onLoadReport}
      />
    </div>
  );
}

function NextBestTrainingActionCard({ data, fitData, onStartTraining }) {
  const plan = useMemo(() => buildTrainingRecommendations(data, fitData), [data, fitData]);
  const action = plan.primary;

  if (!data || !action) return null;

  return (
    <section className="nextBestTrainingAction" aria-label="Your next best training action">
      <div>
        <p className="eyebrow">Your Next Best Action</p>
        <h2>We found the best thing for you to train next.</h2>
        <p>
          <strong>{action.opening}</strong>
          {action.variation ? ` · ${action.variation}` : ""}. {action.reason}. {action.why}
        </p>
      </div>
      <button type="button" onClick={() => onStartTraining?.(action)}>
        Start Training
      </button>
    </section>
  );
}

function ReportTrainingPreview({ data, fitData, studyTarget, recentGames = [], onPractice, onNavigate }) {
  if (!data) return null;

  const targetName =
    studyTarget?.name ||
    getOpeningName(fitData?.weakestOpening) ||
    getOpeningName(fitData?.bestOpening) ||
    "your recommended opening";
  const replayGame = Array.isArray(recentGames) ? recentGames.find(Boolean) : null;
  const replayOpening = replayGame?.opening || replayGame?.eco || replayGame?.name || "latest imported game";

  return (
    <section className="reportTrainingPreview" id="report-training-preview" aria-label="Training and replay preview">
      <div className="commandPanelHeader">
        <p className="eyebrow">Train next</p>
        <h2>Turn the report into one study session</h2>
        <p>Practice the main target first. Replay and raw game details are available after the advice.</p>
      </div>

      <div className="reportTrainingPreviewGrid">
        <article>
          <span>Practice board</span>
          <strong>{targetName}</strong>
          <p>{studyTarget?.goal || "Learn one clean line and the first middlegame plan."}</p>
          <button type="button" className="primaryBtn" onClick={() => onPractice?.(targetName)}>
            Practice target
          </button>
        </article>

        <article>
          <span>Training plan</span>
          <strong>{studyTarget?.timeNeeded || "10-15 minutes"}</strong>
          <p>{studyTarget?.why || "Keep the session focused so your next import has clearer evidence."}</p>
          <button type="button" className="secondaryBtn" onClick={() => onNavigate?.("training")}>
            Open training
          </button>
        </article>

        <article>
          <span>Replay</span>
          <strong>{replayOpening}</strong>
          <p>
            {replayGame
              ? "Replay a recent imported game after you understand the main recommendation."
              : "Replay appears when imported games include PGN or move data."}
          </p>
          <button type="button" className="secondaryBtn" onClick={() => onNavigate?.("games")} disabled={!replayGame}>
            Open replay
          </button>
        </article>
      </div>
    </section>
  );
}

function FullReportHighlights({ data, fitData, onPractice }) {
  const openings = Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : [];
  const usableOpenings = openings
    .filter((opening) => !isUnknownOpeningName(getOpeningName(opening)))
    .sort(evidenceSort);
  const verdictFor = (opening) =>
    openingVerdictLabel(opening, data, opening.fitVerdict || opening.verdict);
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
  const visibleVerdictGroups = verdictGroups.filter((group) => group.items.length);

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
        <p className="eyebrow">Opening verdicts</p>
        <h2>Keep, improve, and avoid decisions</h2>
        <p>These are the clearest verdicts from your imported games. Empty verdict groups are hidden.</p>
      </div>

      <div className="fullReportVerdictGrid">
        {visibleVerdictGroups.length ? visibleVerdictGroups.map((group) => (
          <article key={group.key}>
            <h3>{group.title}</h3>
            <div className="fullReportOpeningList">
              {group.items.map((opening) => renderOpening(opening))}
            </div>
          </article>
        )) : (
          <EmptyState title="No confident verdict groups yet" text="OpeningFit found games, but the opening sample is too thin for a keep/improve/avoid split." />
        )}
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
  const bestOpeningTitle = bestOpening ? getOpeningContextTitle(bestOpening) : "Not enough data yet";
  const weakOpeningTitle = weakOpening ? getOpeningContextTitle(weakOpening) : "No recurring leak yet";
  const avoidOpening = avoidItems[0] || null;
  const dashboardStats = [
    { label: "Player", value: playerName, detail: platformLabel, tone: "player" },
    { label: "Date analysed", value: analysedDate, detail: `${games || "—"} games analysed`, tone: "date" },
    { label: "Opening Fit Score", value: score || "—", detail: score ? "/100 repertoire health" : "Score pending", tone: "score" },
    { label: "Top recommendation", value: mainRecommendation, detail: focusOpening ? getOpeningContextTitle(focusOpening) : "One clear next step", tone: "recommendation" },
  ];
  const insightCards = [
    {
      marker: "✓",
      label: "Keep playing",
      title: bestOpeningTitle,
      value: bestOpening ? `${getWinRate(bestOpening)}%` : "—",
      bar: bestOpening ? getWinRate(bestOpening) : 0,
      tone: "keep",
      text: bestOpening ? "Your strongest reliable signal." : "Import more games to confirm a keeper.",
    },
    {
      marker: "!",
      label: "Needs work",
      title: weakOpeningTitle,
      value: weakOpening ? `${getWinRate(weakOpening)}%` : "—",
      bar: weakOpening ? getWinRate(weakOpening) : 0,
      tone: "improve",
      text: weakOpening ? "Review the first repeated branch." : "No repeated repair target yet.",
    },
    {
      marker: "×",
      label: "Avoid for now",
      title: avoidOpening ? getOpeningContextTitle(avoidOpening) : "No hard avoid",
      value: avoidOpening ? `${getWinRate(avoidOpening)}%` : "—",
      bar: avoidOpening ? getWinRate(avoidOpening) : 0,
      tone: "avoid",
      text: avoidOpening ? "Treat as a review target before playing again." : "Nothing is clearly dangerous yet.",
    },
    {
      marker: "♙",
      label: "Your best opening",
      title: bestOpeningTitle,
      value: bestOpening ? `${getOpeningGames(bestOpening)} games` : "—",
      bar: bestOpening ? Math.min(100, getOpeningGames(bestOpening) * 8) : 0,
      tone: "best",
      text: bestOpening ? "Use this as your reference point." : "Build a bigger sample first.",
    },
    {
      marker: "↯",
      label: "Your biggest leak",
      title: weakOpeningTitle,
      value: weakOpening ? `${getOpeningGames(weakOpening)} games` : "—",
      bar: weakOpening ? Math.max(8, 100 - getWinRate(weakOpening)) : 0,
      tone: "leak",
      text: weakOpening ? "This is where a small fix can matter." : "No leak detected yet.",
    },
  ];
  const openingChips = [
    bestOpening ? { label: "Best opening", value: getOpeningContextTitle(bestOpening), tone: "keep" } : null,
    weakOpening ? { label: "Biggest leak", value: getOpeningContextTitle(weakOpening), tone: "improve" } : null,
    avoidOpening ? { label: "Avoid", value: getOpeningContextTitle(avoidOpening), tone: "avoid" } : null,
    focusOpening ? { label: "Study next", value: getOpeningContextTitle(focusOpening), tone: "study" } : null,
  ].filter(Boolean);
  const nextBestMove =
    focusOpening && focusWinRate !== null
      ? `Focus on improving ${focusName} ${focusRole}. You have ${focusGames || "enough"} game${focusGames === 1 ? "" : "s"}, the results are below your strongest baseline, and this position appears often enough to matter.`
      : `Focus on building one repeatable opening setup first. OpeningFit needs a few more clear games before making a stronger repair recommendation.`;
  const coachingCards = [
    {
      label: "Best opening",
      title: bestOpeningTitle,
      text: bestOpening
        ? `${getWinRate(bestOpening)}% result over ${getOpeningGames(bestOpening)} game${getOpeningGames(bestOpening) === 1 ? "" : "s"}. Keep this as a stable repertoire anchor.`
        : "No stable best opening yet. Import more games or keep one setup for a few sessions.",
      tone: "keep",
    },
    {
      label: "Biggest leak",
      title: weakOpeningTitle,
      text: weakOpening
        ? `${getWinRate(weakOpening)}% result over ${getOpeningGames(weakOpening)} game${getOpeningGames(weakOpening) === 1 ? "" : "s"}. Review one loss before playing it again.`
        : "No repeated leak is visible yet. Keep building a cleaner sample.",
      tone: "improve",
    },
    {
      label: "Coach note",
      title: focusName,
      text: nextBestMove,
      tone: "coach",
    },
  ];
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
        document.getElementById(mode === "table" ? "evidence-table" : "full-report-highlights") ||
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
          <p className="eyebrow">Personal chess dashboard</p>
          <h1>{playerName}'s OpeningFit dashboard</h1>
          <div className="currentReportMetaInline" aria-label="Report details">
            <span>{platformLabel}</span>
            <span>{games || "—"} games</span>
            <span>{analysedDate}</span>
          </div>
          <p>{verdict.profile}</p>
        </div>

        <div className="commandCentreScore" aria-label="Opening Fit Score">
          <span>Opening Fit Score</span>
          <strong>{score || "—"}</strong>
          <small>{score ? "/100" : "score pending"}</small>
          <em>{profile.shortLabel || profile.label || "Overall verdict"}</em>
        </div>
      </div>

      <div className="reportDashboardStats" aria-label="Report dashboard stats">
        {dashboardStats.map((item) => (
          <article className={`reportDashboardStat reportDashboardStat-${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>

      <div className="reportOpeningChipRail" aria-label="Opening highlights">
        {openingChips.map((chip) => (
          <span className={`reportOpeningChip reportOpeningChip-${chip.tone}`} key={`${chip.label}-${chip.value}`}>
            <small>{chip.label}</small>
            {chip.value}
          </span>
        ))}
      </div>

      <div className="nextBestMoveCard">
        <div>
          <span>What should I do next?</span>
          <h2>{mainRecommendation}</h2>
          <p>{nextBestMove}</p>
        </div>

        <div className="nextBestMoveActions">
          <button type="button" className="primaryBtn" onClick={() => chooseReportMode("table")}>
            View evidence
          </button>
          <button type="button" className="secondaryBtn" onClick={() => onViewChange?.("training")}>
            Start training
          </button>
          <button type="button" className="secondaryBtn" onClick={() => chooseReportMode("full")}>
            Compare options
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

      <div className="dashboardInsightGrid" aria-label="Key opening insights">
        {insightCards.map((item) => (
          <article className={`dashboardInsightCard dashboardInsightCard-${item.tone}`} key={item.label}>
            <div className="dashboardInsightTopline">
              <i aria-hidden="true">{item.marker}</i>
              <div>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
              </div>
            </div>
            <em>{item.value}</em>
            <p>{item.text}</p>
            <div className="dashboardProgressBar" aria-hidden="true">
              <span style={{ width: `${Math.max(4, Math.min(100, item.bar || 0))}%` }} />
            </div>
          </article>
        ))}
      </div>

      <div className="reportCoachCardGrid" aria-label="Short coaching summary">
        {coachingCards.map((card) => (
          <article className={`reportCoachCard reportCoachCard-${card.tone}`} key={`${card.label}-${card.title}`}>
            <span>{card.label}</span>
            <strong>{card.title}</strong>
            <p>{card.text}</p>
          </article>
        ))}
      </div>

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
            <span>Your Current Repertoire</span>
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
            <span>Openings to improve</span>
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
    data?.style_profile?.labels?.[0] ||
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

function formatProfileDate(value) {
  if (!value) return "Not analysed yet";

  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Not analysed yet";
  }
}

function getProfilePlayerName(data, fallback = "") {
  return (
    data?.username ||
    data?.playerName ||
    data?.player_name ||
    data?.requestedUsername ||
    data?.requested_username ||
    fallback ||
    "OpeningFit player"
  );
}

function getProfilePlatformLabel(data, fallback = "") {
  const raw = String(data?.platform || data?.importPlatform || data?.import_platform || fallback || "").toLowerCase();
  if (raw.includes("lichess")) return "Lichess";
  if (raw.includes("chesscom") || raw.includes("chess.com")) return "Chess.com";
  return "Connected chess account";
}

function getProfileImportDate(data) {
  return (
    data?.importedAt ||
    data?.imported_at ||
    data?.lastUpdated ||
    data?.last_updated ||
    data?.savedProfile?.lastUpdated ||
    ""
  );
}

function getProfileGameCount(data) {
  return (
    data?.gamesAnalysed ||
    data?.gamesAnalyzed ||
    data?.games_analyzed ||
    data?.gamesImported ||
    data?.games_imported ||
    data?.totalGames ||
    data?.total_games ||
    0
  );
}

function getProfileMonthsChecked(data) {
  return data?.monthsChecked || data?.months_checked || data?.importMonths || data?.import_months || "Recent";
}

function getProfileStyleSummary(data, fitData) {
  return (
    fitData?.playerStyle?.summary ||
    data?.styleSummary ||
    data?.style_summary ||
    data?.styleProfile?.summary ||
    data?.style_profile?.summary ||
    "Import more games to build a clearer picture of your opening style."
  );
}

function getProfileStyleLabel(data, fitData) {
  return (
    fitData?.playerStyle?.title ||
    data?.styleLabel ||
    data?.style_label ||
    data?.styleProfile?.label ||
    data?.style_profile?.label ||
    data?.style_profile?.labels?.[0] ||
    "Opening profile"
  );
}

function getFirstOpeningName(items) {
  const list = Array.isArray(items) ? items : [];
  const found = list.find((item) => getOpeningName(item) && !String(getOpeningName(item)).toLowerCase().includes("unknown"));
  return found ? getOpeningContextTitle(found) : "";
}

function getProfileOpeningFacts(data, fitData) {
  const preferredWhite = getFirstOpeningName(data?.preferred_white || data?.preferredWhite);
  const preferredBlack = getFirstOpeningName(data?.preferred_black || data?.preferredBlack);
  const strongest = fitData?.bestOpening ? getOpeningContextTitle(fitData.bestOpening) : getFirstOpeningName(data?.best_openings || data?.bestOpenings);
  const needsWork = fitData?.weakestOpening ? getOpeningContextTitle(fitData.weakestOpening) : "";

  return {
    preferredWhite: preferredWhite || "Not enough White games yet",
    preferredBlack: preferredBlack || "Not enough Black games yet",
    strongest: strongest || "No clear strongest opening yet",
    needsWork: needsWork || "No clear repair area yet",
  };
}

function getProfilePlanLabel({ isPremium, isPremiumPreview, accountUser }) {
  if (isPremium) return "Founder Pass active";
  if (isPremiumPreview) return "Premium preview";
  if (accountUser) return "Free plan";
  return "Local profile";
}

function buildProfileInsights(data, fitData) {
  const insights = [];
  const openingFacts = getProfileOpeningFacts(data, fitData);
  const studyTarget = buildStudyThisNextTarget(fitData);
  const score = fitData?.overallScore ?? data?.openingFitScore ?? data?.opening_fit_score ?? null;

  if (openingFacts.strongest && !openingFacts.strongest.includes("No clear")) {
    insights.push(`${openingFacts.strongest} is your clearest strength in this report.`);
  }

  if (studyTarget?.name || studyTarget?.opening) {
    insights.push(`Next study target: ${studyTarget.name || studyTarget.opening}.`);
  } else if (openingFacts.needsWork && !openingFacts.needsWork.includes("No clear")) {
    insights.push(`${openingFacts.needsWork} is the main area to review before adding new lines.`);
  }

  if (score !== null && score !== undefined) {
    insights.push(`Opening Fit score: ${Math.round(Number(score)) || score}/100.`);
  }

  if (!insights.length) {
    insights.push("Import a larger sample to unlock stronger opening trends.");
  }

  return insights.slice(0, 3);
}

function normalizeProfileHistoryItem(item) {
  const summary = item?.summary || item?.snapshot || {};
  const report = item?.report || item?.data || null;
  const createdAt =
    item?.created_at ||
    item?.createdAt ||
    item?.savedAt ||
    item?.updated_at ||
    summary.reportDate ||
    summary.savedAt ||
    "";

  return {
    id: item?.id || `${summary.username || item?.username || item?.playerName || "report"}-${createdAt || Math.random()}`,
    createdAt,
    platform: summary.platform || item?.platform || report?.platform || report?.importPlatform || "chess",
    username:
      summary.username ||
      item?.username ||
      item?.playerName ||
      report?.username ||
      report?.playerName ||
      "OpeningFit player",
    games:
      summary.games ||
      item?.games ||
      item?.gamesImported ||
      report?.gamesImported ||
      report?.gamesAnalysed ||
      report?.totalGames ||
      "Recent",
    months: summary.importMonths || report?.monthsChecked || report?.importMonths || "Recent",
    data: report,
  };
}

function readLocalProfileHistory() {
  if (typeof window === "undefined") return [];

  const keys = ["openingFit:reportHistory:v1", REPORT_HISTORY_KEY];
  return keys.flatMap((key) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
}

function ProfileSummaryCard({
  data,
  fitData,
  accountUser,
  username,
  platform,
  isPremium,
  isPremiumPreview,
  onAnalyse,
  onOpenReport,
}) {
  const playerName = getProfilePlayerName(data, username);
  const platformLabel = getProfilePlatformLabel(data, platform);
  const planLabel = getProfilePlanLabel({ isPremium, isPremiumPreview, accountUser });
  const analysedAt = getProfileImportDate(data);
  const games = getProfileGameCount(data);
  const score = fitData?.overallScore ?? data?.openingFitScore ?? data?.opening_fit_score ?? null;

  return (
    <section className="profileHeroDashboard">
      <div className="profileHeroCopy">
        <p className="eyebrow">Profile</p>
        <h1>Your OpeningFit Profile</h1>
        <p>
          A practical snapshot of what OpeningFit knows about your chess, what you have saved, and what to do next.
        </p>
        <div className="profileHeroActions">
          <button type="button" className="primaryBtn" onClick={onAnalyse}>
            Analyse new games
          </button>
          {data ? (
            <button type="button" className="secondaryButton" onClick={onOpenReport}>
              View latest report
            </button>
          ) : null}
        </div>
      </div>

      <div className="profileHeroMetaGrid">
        <article>
          <span>Connected chess account</span>
          <strong>{platformLabel}</strong>
          <small>{playerName}</small>
        </article>
        <article>
          <span>Last analysed</span>
          <strong>{formatProfileDate(analysedAt)}</strong>
          <small>{games || "No"} games analysed</small>
        </article>
        <article>
          <span>Plan</span>
          <strong>{planLabel}</strong>
          <small>{accountUser?.email ? "Signed in" : "Browser profile"}</small>
        </article>
        <article>
          <span>Opening Fit</span>
          <strong>{score !== null && score !== undefined ? `${Math.round(Number(score)) || score}/100` : "Pending"}</strong>
          <small>{getProfileStyleLabel(data, fitData)}</small>
        </article>
      </div>
    </section>
  );
}

function ChessProfileCard({ data, fitData }) {
  const style = getProfileStyleLabel(data, fitData);
  const summary = getProfileStyleSummary(data, fitData);
  const facts = getProfileOpeningFacts(data, fitData);

  return (
    <section className="profileDashboardCard chessProfileCard">
      <div className="profileCardHeader">
        <p className="eyebrow">Chess profile</p>
        <h2>What your openings show</h2>
        <p>{summary}</p>
      </div>

      <div className="chessProfileStyle">
        <span>Playing style</span>
        <strong>{style}</strong>
      </div>

      <div className="chessProfileGrid">
        <article>
          <span>Preferred White opening</span>
          <strong>{facts.preferredWhite}</strong>
        </article>
        <article>
          <span>Preferred Black opening</span>
          <strong>{facts.preferredBlack}</strong>
        </article>
        <article>
          <span>Strongest opening</span>
          <strong>{facts.strongest}</strong>
        </article>
        <article>
          <span>Needs work</span>
          <strong>{facts.needsWork}</strong>
        </article>
      </div>
    </section>
  );
}

function LatestReportCard({ data, fitData, username, platform, onOpenReport }) {
  const playerName = getProfilePlayerName(data, username);
  const platformLabel = getProfilePlatformLabel(data, platform);
  const insights = buildProfileInsights(data, fitData);

  return (
    <section className="profileDashboardCard latestProfileReportCard">
      <div className="profileCardHeader">
        <p className="eyebrow">Latest report</p>
        <h2>Most recent import</h2>
      </div>

      <div className="latestReportMeta">
        <div>
          <span>Date</span>
          <strong>{formatProfileDate(getProfileImportDate(data))}</strong>
        </div>
        <div>
          <span>Account</span>
          <strong>{platformLabel}</strong>
          <small>{playerName}</small>
        </div>
        <div>
          <span>Games</span>
          <strong>{getProfileGameCount(data) || "Recent"}</strong>
          <small>{getProfileMonthsChecked(data)} months checked</small>
        </div>
      </div>

      <ul className="latestReportInsights">
        {insights.map((insight) => (
          <li key={insight}>{insight}</li>
        ))}
      </ul>

      <button type="button" className="secondaryButton" onClick={onOpenReport}>
        Open latest report
      </button>
    </section>
  );
}

function SavedReportsProfileCard({ onLoadReport, onCreateReport }) {
  const { user, reportHistory } = useAuth();
  const [localReports, setLocalReports] = useState([]);

  useEffect(() => {
    if (user?.id) {
      setLocalReports([]);
      return;
    }
    setLocalReports(readLocalProfileHistory().map(normalizeProfileHistoryItem));
  }, [user?.id]);

  const reports = useMemo(() => {
    const source = user?.id
      ? (Array.isArray(reportHistory) ? reportHistory : [])
      : (Array.isArray(localReports) ? localReports : []);
    const seen = new Set();
    return source
      .map(normalizeProfileHistoryItem)
      .filter((item) => {
        const key = `${item.username}-${item.platform}-${item.createdAt}-${item.games}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [localReports, reportHistory, user?.id]);

  const viewReport = (item) => {
    if (item.data && typeof onLoadReport === "function") {
      onLoadReport(item.data);
    }
  };

  return (
    <section className="profileDashboardCard savedReportsProfileCard" id="profile-saved-reports">
      <div className="profileCardHeader profileCardHeaderSplit">
        <div>
          <p className="eyebrow">Saved reports</p>
          <h2>Report history</h2>
          <p>Previous imports you can return to when you want to compare your opening progress.</p>
        </div>
      </div>

      {reports.length ? (
        <div className="profileSavedReportList">
          {reports.map((item) => (
            <article className="profileSavedReportRow" key={item.id}>
              <div>
                <strong>{formatProfileDate(item.createdAt)}</strong>
                <span>{getProfilePlatformLabel({ platform: item.platform })} · {item.username}</span>
              </div>
              <div>
                <span>Games analysed</span>
                <strong>{item.games}</strong>
              </div>
              <div>
                <span>Import window</span>
                <strong>{item.months}</strong>
              </div>
              <button type="button" className="secondaryButton" onClick={() => viewReport(item)} disabled={!item.data}>
                View
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="profileEmptyReports">
          <strong>No saved reports yet.</strong>
          <p>Import your Chess.com or Lichess games to create your first OpeningFit profile.</p>
          <button type="button" className="primaryBtn" onClick={onCreateReport}>
            Create my first report
          </button>
        </div>
      )}
    </section>
  );
}

function ProfileAchievementsCard({ data, fitData, isPremium }) {
  const games = Number(getProfileGameCount(data)) || 0;
  const facts = getProfileOpeningFacts(data, fitData);
  const hasWhite = !facts.preferredWhite.includes("Not enough");
  const hasBlack = !facts.preferredBlack.includes("Not enough");
  const hasTrend = Boolean(fitData?.bestOpening || fitData?.weakestOpening || data?.openingFitScore);

  const achievements = [
    {
      title: "First report created",
      text: "Your profile has an opening baseline.",
      done: Boolean(data),
    },
    {
      title: "100 games analysed",
      text: games >= 100 ? `${games} games analysed.` : `${Math.max(0, 100 - games)} more games to reach a larger sample.`,
      done: games >= 100,
    },
    {
      title: "Opening trend found",
      text: hasTrend ? "OpeningFit found a clear repertoire signal." : "Import more games to strengthen the trend.",
      done: hasTrend,
    },
    {
      title: "White repertoire reviewed",
      text: hasWhite ? facts.preferredWhite : "Needs more White games.",
      done: hasWhite,
    },
    {
      title: "Black repertoire reviewed",
      text: hasBlack ? facts.preferredBlack : "Needs more Black games.",
      done: hasBlack,
    },
    {
      title: "Founder Pass member",
      text: isPremium ? "Founder Pass is active on this profile." : "Unlock deeper history and advanced analysis.",
      done: isPremium,
    },
  ];

  return (
    <section className="profileDashboardCard profileAchievementsCard" id="profile-achievements">
      <div className="profileCardHeader">
        <p className="eyebrow">Progress</p>
        <h2>Profile milestones</h2>
        <p>Product progress that helps you understand whether your OpeningFit profile is becoming more useful.</p>
      </div>
      <div className="profileAchievementList">
        {achievements.map((item) => (
          <article className={item.done ? "profileAchievementDone" : ""} key={item.title}>
            <span>{item.done ? "Complete" : "Next"}</span>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function OpeningFitProgressCard({
  data,
  fitData,
  accountUser,
  reportHistory = [],
  openingFitUserState = [],
  onAnalyse,
  onOpenReport,
}) {
  const safeOpeningFitUserState = Array.isArray(openingFitUserState) ? openingFitUserState : [];
  const latestStoredProgress =
    safeOpeningFitUserState
      .map((row) => row?.coach_progress?.openingFitProgress || row?.coach_progress?.opening_fit_progress || null)
      .filter(Boolean)
      .sort(
        (a, b) =>
          Date.parse(b.lastAnalysisDate || b.last_analysis_date || "") -
          Date.parse(a.lastAnalysisDate || a.last_analysis_date || "")
      )[0] || null;
  const progress =
    data
      ? buildOpeningFitProgressSnapshot(data, fitData, reportHistory)
      : latestStoredProgress;

  if (!accountUser?.id || !progress) return null;

  const score = progress.repertoireConfidenceScore;
  const gamesNeeded = Number(progress.gamesNeededForStrongerRecommendation || 0);
  const styleSummary = progress.styleProfileSummary || "Developing style profile";

  return (
    <section className="profileDashboardCard openingFitProgressCard" id="openingfit-progress">
      <div className="profileCardHeader profileCardHeaderSplit">
        <div>
          <p className="eyebrow">Your OpeningFit Progress</p>
          <h2>Your repertoire profile is saved and evolving</h2>
          <p>
            {score !== null
              ? `Your repertoire confidence is ${score}%. ${
                  gamesNeeded
                    ? `Analyse more games to improve your recommendations.`
                    : "Keep refreshing it as your repertoire changes."
                }`
              : "Analyse more games to improve your recommendations."}
          </p>
        </div>
        <div className="openingFitProgressScore" aria-label={`Repertoire confidence ${score ?? "not ready"}`}>
          <span>Confidence</span>
          <strong>{score !== null ? `${score}%` : "—"}</strong>
        </div>
      </div>

      <div className="openingFitProgressGrid">
        <article>
          <span>Games analysed</span>
          <strong>{progress.gamesAnalysed || 0}</strong>
          <p>{gamesNeeded ? `OpeningFit needs ${gamesNeeded} more games to give a stronger recommendation.` : "Enough games for a stronger profile read."}</p>
        </article>
        <article>
          <span>Last analysis</span>
          <strong>{getProgressDateLabel(progress.lastAnalysisDate)}</strong>
          <p>{progress.platform || "OpeningFit"} profile for {progress.username || "your account"}.</p>
        </article>
        <article>
          <span>Main recommendation</span>
          <strong>{progress.mainOpeningRecommendation}</strong>
          <p>{progress.recommendationConfidence || "Low Confidence"}</p>
        </article>
        <article>
          <span>Style profile</span>
          <strong>{styleSummary}</strong>
          <p>Your style is currently showing as {styleSummary.toLowerCase()}.</p>
        </article>
      </div>

      <div className="openingFitProgressInsightGrid">
        <article>
          <span>What changed since last time</span>
          <strong>{progress.whatChangedSinceLastTime}</strong>
        </article>
        <article>
          <span>Suggested next action</span>
          <strong>{progress.suggestedNextAction}</strong>
        </article>
      </div>

      <div className="openingFitProgressActions">
        <button type="button" className="primaryBtn" onClick={onAnalyse}>
          Analyse more games
        </button>
        {data ? (
          <button type="button" className="secondaryButton" onClick={onOpenReport}>
            View latest report
          </button>
        ) : null}
      </div>
    </section>
  );
}

function RecommendationHistorySection({
  data,
  fitData,
  accountUser,
  recommendationHistory = [],
  authLoading = false,
  profileLoading = false,
  authHydrated = true,
  onAnalyse,
  onViewRepertoire,
}) {
  if (authLoading || profileLoading || !authHydrated) {
    return (
      <section className="profileDashboardCard recommendationHistoryCard" id="recommendation-history">
        <div className="profileCardHeader">
          <p className="eyebrow">Recommendation History</p>
          <h2>Loading your history</h2>
          <p>OpeningFit is checking your account and saved recommendation snapshots.</p>
        </div>
      </section>
    );
  }

  if (!accountUser?.id) {
    return (
      <section className="profileDashboardCard recommendationHistoryCard" id="recommendation-history">
        <div className="profileCardHeader">
          <p className="eyebrow">Recommendation History</p>
          <h2>Login to save history</h2>
          <p>Create a free account or log in to keep recommendation history across devices.</p>
        </div>
        <button type="button" className="primaryBtn" onClick={onAnalyse}>
          Analyse your first games
        </button>
      </section>
    );
  }

  const activeSnapshot = data ? buildRecommendationHistorySnapshot(data, fitData) : null;
  const safeRecommendationHistory = Array.isArray(recommendationHistory) ? recommendationHistory : [];
  const savedRows = safeRecommendationHistory
    .map(normalizeRecommendationHistoryRow)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.analysisDate || "") - Date.parse(a.analysisDate || ""));
  const current = activeSnapshot
    ? normalizeRecommendationHistoryRow({ snapshot: activeSnapshot })
    : savedRows[0] || null;
  const previous = savedRows.find((row) => {
    if (!current) return false;
    const sameDate = row.analysisDate && current.analysisDate && row.analysisDate === current.analysisDate;
    const sameRecommendation = row.currentRecommendation === current.currentRecommendation;
    const sameScore = row.confidenceScore === current.confidenceScore;
    return !(sameDate && sameRecommendation && sameScore);
  }) || null;

  if (!current) {
    return (
      <section className="profileDashboardCard recommendationHistoryCard" id="recommendation-history">
        <div className="profileCardHeader">
          <p className="eyebrow">Recommendation History</p>
          <h2>Track how your OpeningFit profile changes</h2>
          <p>Analyse your first games to start a recommendation history timeline.</p>
        </div>
        <button type="button" className="primaryBtn" onClick={onAnalyse}>
          Analyse your first games
        </button>
      </section>
    );
  }

  const confidenceChange =
    current.confidenceScore !== null && previous?.confidenceScore !== null
      ? current.confidenceScore - previous.confidenceScore
      : null;
  const changeText = getRecommendationHistoryChange(current, previous);
  const detectedNames = (current.detectedOpenings || []).slice(0, 4).map((item) => item.name || item).filter(Boolean);
  const recommendedNames = (current.recommendedOpenings || []).slice(0, 4).map((item) => item.name || item).filter(Boolean);

  return (
    <section className="profileDashboardCard recommendationHistoryCard" id="recommendation-history">
      <div className="profileCardHeader profileCardHeaderSplit">
        <div>
          <p className="eyebrow">Recommendation History</p>
          <h2>See how your opening profile is changing</h2>
          <p>{changeText}</p>
        </div>
        <div className="recommendationHistoryDelta">
          <span>Confidence change</span>
          <strong>
            {Number.isFinite(confidenceChange)
              ? `${confidenceChange > 0 ? "+" : ""}${confidenceChange}%`
              : "New"}
          </strong>
        </div>
      </div>

      <div className="recommendationHistoryCompare">
        <article>
          <span>Current recommendation</span>
          <strong>{current.currentRecommendation}</strong>
          <p>
            {current.confidenceScore !== null ? `${current.confidenceScore}% confidence` : current.recommendationConfidence}
          </p>
        </article>
        <article>
          <span>Previous recommendation</span>
          <strong>{previous?.currentRecommendation || "No previous snapshot yet"}</strong>
          <p>
            {previous?.confidenceScore !== null && previous?.confidenceScore !== undefined
              ? `${previous.confidenceScore}% confidence`
              : "Analyse again after more games."}
          </p>
        </article>
        <article>
          <span>What changed</span>
          <strong>{changeText}</strong>
          <p>{current.styleProfileSummary || "Style profile still developing."}</p>
        </article>
        <article>
          <span>Time control</span>
          <strong>{getAnalysisTimeFormatLabel(current.timeControlFilter)}</strong>
          <p>{current.gamesAnalysed} game{current.gamesAnalysed === 1 ? "" : "s"} analysed · {current.analysisVersion}</p>
        </article>
      </div>

      <div className="recommendationHistoryLists">
        <div>
          <span>Detected openings</span>
          <strong>{detectedNames.length ? detectedNames.join(", ") : "Not enough detected openings yet"}</strong>
        </div>
        <div>
          <span>Recommended openings</span>
          <strong>{recommendedNames.length ? recommendedNames.join(", ") : current.currentRecommendation}</strong>
        </div>
      </div>

      <div className="recommendationHistoryActions">
        <button type="button" className="primaryBtn" onClick={onAnalyse}>
          Analyse more games
        </button>
        <button type="button" className="secondaryButton" onClick={onViewRepertoire}>
          View recommendation details
        </button>
      </div>
    </section>
  );
}

function getLatestCloudReport(reportHistory = []) {
  return [...(reportHistory || [])]
    .filter(Boolean)
    .sort(
      (a, b) =>
        Date.parse(b?.summary?.reportDate || b?.created_at || b?.updated_at || "") -
        Date.parse(a?.summary?.reportDate || a?.created_at || a?.updated_at || "")
    )[0] || null;
}

function getReturnDashboardProgress({ data, fitData, reportHistory = [], openingFitUserState = [] }) {
  if (data) return buildOpeningFitProgressSnapshot(data, fitData, reportHistory);

  const storedProgress =
    openingFitUserState
      .map((row) => row?.coach_progress?.openingFitProgress || row?.coach_progress?.opening_fit_progress || null)
      .filter(Boolean)
      .sort(
        (a, b) =>
          Date.parse(b.lastAnalysisDate || b.last_analysis_date || "") -
          Date.parse(a.lastAnalysisDate || a.last_analysis_date || "")
      )[0] || null;

  if (storedProgress) return storedProgress;

  return getProgressFromReportRow(getLatestCloudReport(reportHistory));
}

function getReturnDashboardRecommendations(progress, latestReport) {
  const summary = latestReport?.summary || {};
  const topOpenings = Array.isArray(summary.topOpenings) ? summary.topOpenings : [];
  const names = [
    progress?.mainOpeningRecommendation,
    ...topOpenings.map((item) => item?.name),
    summary.studyTarget,
    latestReport?.report?.opening_recommendations?.white?.[0],
  ]
    .filter(Boolean)
    .map((item) => (typeof item === "string" ? item : getOpeningName(item)))
    .filter((item) => item && item !== "No clear recommendation yet");

  return [...new Set(names)].slice(0, 3);
}

function getDaysSinceDashboardDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  const diff = Date.now() - date.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / 86400000);
}

function getDashboardOpeningSignals(data, fitData, latestReport) {
  const scoredOpenings = uniqueOpeningsByNameAndContext(
    Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []
  )
    .filter((opening) => !isUnknownOpeningName(getOpeningName(opening)))
    .sort(evidenceSort);
  const summaryTopOpenings = Array.isArray(latestReport?.summary?.topOpenings)
    ? latestReport.summary.topOpenings
    : [];
  const verdictFor = (opening) =>
    openingVerdictLabel(opening, data, opening?.fitVerdict || opening?.verdict);
  const repairOpenings = scoredOpenings.filter((opening) =>
    ["Improve", "Avoid"].includes(verdictFor(opening))
  );
  const strength =
    fitData?.bestOpening ||
    scoredOpenings.find((opening) => verdictFor(opening) === "Keep") ||
    scoredOpenings[0] ||
    summaryTopOpenings[0] ||
    null;
  const weakness =
    fitData?.weakestOpening ||
    buildStudyThisNextTarget(fitData)?.opening ||
    [...repairOpenings].sort((a, b) => {
      const scoreDelta = getWinRate(a) - getWinRate(b);
      if (scoreDelta) return scoreDelta;
      return getOpeningGames(b) - getOpeningGames(a);
    })[0] ||
    summaryTopOpenings.find((opening) => /improve|avoid|repair/i.test(opening?.verdict || "")) ||
    null;

  return { strength, weakness };
}

function getDashboardDeltaSummary(progress, reportHistory = []) {
  if (!progress) {
    return {
      scoreDelta: null,
      stabilityDelta: null,
    };
  }

  const previous = findPreviousProgressSnapshot(progress, reportHistory);
  const currentScore =
    progress?.repertoireConfidenceScore === null || progress?.repertoireConfidenceScore === undefined
      ? null
      : getProgressScoreValue(progress.repertoireConfidenceScore);
  const previousScore =
    previous?.repertoireConfidenceScore === null || previous?.repertoireConfidenceScore === undefined
      ? null
      : getProgressScoreValue(previous.repertoireConfidenceScore);
  const scoreDelta =
    currentScore !== null && previousScore !== null
      ? currentScore - previousScore
      : null;
  const gamesDelta =
    previous && Number.isFinite(Number(progress?.gamesAnalysed)) && Number.isFinite(Number(previous?.gamesAnalysed))
      ? Number(progress.gamesAnalysed) - Number(previous.gamesAnalysed)
      : null;
  const stabilityDelta =
    scoreDelta !== null
      ? Math.round(scoreDelta / 2)
      : gamesDelta !== null
        ? Math.max(0, Math.min(12, gamesDelta * 2))
        : null;

  return {
    scoreDelta,
    stabilityDelta,
  };
}

function ReturnUserDashboard({
  user,
  data,
  fitData,
  reportHistory = [],
  openingFitUserState = [],
  onAnalyse,
  onViewRepertoire,
  onImproveRecommendation,
  onStudyPlan,
  onProgress,
  onHistory,
  onSettings,
}) {
  if (!user?.id) return null;

  const latestReport = getLatestCloudReport(reportHistory);
  const progress = getReturnDashboardProgress({ data, fitData, reportHistory, openingFitUserState });
  const hasPreviousData = Boolean(progress || latestReport || data);
  const recommendations = getReturnDashboardRecommendations(progress, latestReport);
  const { strength, weakness } = getDashboardOpeningSignals(data, fitData, latestReport);
  const deltas = getDashboardDeltaSummary(progress, reportHistory);
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "there";
  const score = progress?.repertoireConfidenceScore;
  const confidence = progress?.recommendationConfidence || "Building confidence";
  const games =
    progress?.gamesAnalysed ||
    latestReport?.summary?.games ||
    latestReport?.report?.gamesImported ||
    latestReport?.report?.total_games ||
    0;
  const lastImportDate =
    progress?.lastAnalysisDate ||
    latestReport?.summary?.reportDate ||
    latestReport?.created_at ||
    latestReport?.updated_at ||
    "";
  const daysSinceImport = getDaysSinceDashboardDate(lastImportDate);
  const lastImportCopy =
    daysSinceImport === null
      ? "No import yet"
      : daysSinceImport === 0
        ? "Today"
        : `${daysSinceImport} day${daysSinceImport === 1 ? "" : "s"} ago`;
  const strengthName = strength ? getOpeningName(strength) : recommendations[0] || "First weapon pending";
  const strengthConfidence =
    strength?.confidence ||
    strength?.fitConfidence ||
    strength?.confidenceLabel ||
    progress?.recommendationConfidence ||
    confidence;
  const weaknessName = weakness ? getOpeningName(weakness) : recommendations[1] || "No repair target yet";
  const studyNext =
    progress?.suggestedNextAction ||
    (recommendations[0] ? `Study ${recommendations[0]} next.` : "Analyse your first games to build your OpeningFit profile.");
  const scoreDeltaLabel =
    deltas.scoreDelta === null
      ? "New baseline"
      : `${deltas.scoreDelta >= 0 ? "+" : ""}${deltas.scoreDelta} since last report`;
  const stabilityDeltaLabel =
    deltas.stabilityDelta === null
      ? "Tracking soon"
      : `${deltas.stabilityDelta >= 0 ? "+" : ""}${deltas.stabilityDelta} opening stability`;
  const dashboardNavItems = [
    { label: "My White Repertoire", action: onViewRepertoire },
    { label: "My Black Repertoire", action: onViewRepertoire },
    { label: "Weaknesses", action: onImproveRecommendation },
    { label: "Study Plan", action: onStudyPlan },
    { label: "Progress", action: onProgress },
    { label: "History", action: onHistory },
    { label: "Settings", action: onSettings },
  ];

  return (
    <section className="returnUserDashboard" id="return-user-dashboard">
      <div className="returnDashboardHero">
        <div>
          <p className="eyebrow">OpeningFit home base</p>
          <h1>{hasPreviousData ? `Welcome back, ${displayName}` : "Let's build your OpeningFit dashboard"}</h1>
          <p>
            {hasPreviousData
              ? "Your repertoire is saved here. Check your focus, study one thing, then come back after more games."
              : "Analyse your first games to build your repertoire score, study plan, and progress history."}
          </p>
        </div>
        <div className="returnDashboardScore" aria-label={`Current repertoire score ${score ?? confidence}`}>
          <span>Current Repertoire Score</span>
          <strong>{score !== null && score !== undefined ? score : "—"}</strong>
          <small>{scoreDeltaLabel}</small>
        </div>
      </div>

      <nav className="returnDashboardNav" aria-label="Player repertoire navigation">
        {dashboardNavItems.map((item) => (
          <button key={item.label} type="button" onClick={item.action}>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="returnDashboardGrid">
        <article className="returnDashboardTileFocus">
          <span>Today's Focus</span>
          <strong>Repair: {weaknessName}</strong>
          <p>{weakness ? "This is the clearest opening repair target in your current profile." : studyNext}</p>
          <button type="button" className="secondaryButton" onClick={onStudyPlan}>
            Continue Study
          </button>
        </article>
        <article className="returnDashboardTileWeapon">
          <span>Strongest Weapon</span>
          <strong>{strengthName}</strong>
          <p>{coachConfidenceLabel(strengthConfidence)} {confidenceStars(strengthConfidence)}</p>
          <button type="button" className="secondaryButton" onClick={() => onStudyPlan?.(strengthName)}>
            Train
          </button>
        </article>
        <article className="returnDashboardTileProgress">
          <span>Recent Progress</span>
          <strong>
            {deltas.scoreDelta === null
              ? progress?.whatChangedSinceLastTime || "First baseline ready"
              : `${deltas.scoreDelta >= 0 ? "+" : ""}${deltas.scoreDelta} repertoire confidence`}
          </strong>
          <p>{stabilityDeltaLabel}</p>
        </article>
        <article className="returnDashboardTileAction">
          <span>Recommended Action</span>
          <strong>{hasPreviousData ? "Run a fresh analysis" : "Analyse your first games"}</strong>
          <p>Last import: {lastImportCopy}. {games ? `${games} games feed this profile.` : "Your first import starts the loop."}</p>
          <button type="button" className="primaryBtn" onClick={onAnalyse}>
            Analyse New Games
          </button>
        </article>
      </div>

      <div className="returnDashboardActions">
        <button type="button" className="primaryBtn" onClick={onAnalyse}>
          Analyse New Games
        </button>
        <button type="button" className="secondaryButton" onClick={onViewRepertoire} disabled={!hasPreviousData}>
          View My Repertoire
        </button>
        <button type="button" className="secondaryButton" onClick={onStudyPlan}>
          Open Study Plan
        </button>
      </div>
    </section>
  );
}

function FounderPassProfileCard({ isPremium, onFounderPass }) {
  const valueBullets = [
    "Save reports",
    "Track progress",
    "Deeper opening insights",
    "More history",
    "Premium training plan",
  ];
  const trustItems = ["Built for club players", "One-time early supporter access", "No theory overload"];

  return (
    <section className={isPremium ? "profileFounderCard profileFounderCardActive" : "profileFounderCard"}>
      <div className="profileFounderMain">
        <p className="eyebrow">Founder Pass</p>
        <h2>{isPremium ? "Founder Pass active" : "Upgrade your OpeningFit dashboard"}</h2>
        <p>
          {isPremium
            ? "Your profile has Founder Pass access. Future premium analysis will stay attached to this account."
            : "Turn the free snapshot into a saved progress system for your repertoire, training plan, and deeper opening history."}
        </p>
        <div className="profileFounderTrust">
          {trustItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="profileFounderValue">
        {valueBullets.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <div className="profileFounderOffer">
        <span>One-time early supporter price</span>
        <strong>£8</strong>
        <div className="profileFounderOfferBadges" aria-label="Founder Pass offer details">
          <span>Pay once</span>
          <span>Lifetime early access</span>
        </div>
        <small>Lifetime Founder Pass while OpeningFit is early.</small>
        {!isPremium ? (
          <button type="button" className="primaryBtn" onClick={onFounderPass}>
            Get Founder Pass - £8
          </button>
        ) : (
          <span className="profileFounderStatus">Active</span>
        )}
      </div>
    </section>
  );
}

function OpeningFitProfileDashboard({
  data,
  fitData,
  accountUser,
  username,
  platform,
  isPremium,
  isPremiumPreview,
  onAnalyse,
  onOpenReport,
  onLoadReport,
  onFounderPass,
  onUserChange,
  reportHistory,
  openingFitUserState,
  recommendationHistory,
  authLoading = false,
  profileLoading = false,
  authHydrated = true,
}) {
  const hasStoredProgress =
    accountUser?.id &&
    (Array.isArray(openingFitUserState) ? openingFitUserState : []).some(
      (row) => row?.coach_progress?.openingFitProgress || row?.coach_progress?.opening_fit_progress
    );

  if (!data) {
    return (
      <div className="profileDashboard profileDashboardNoReport">
      <section className="profileNoReportState">
        <p className="eyebrow">Profile</p>
        <h1>Let's build your opening profile.</h1>
        <p>
          We'll study your games and suggest openings that match your style.
        </p>
        <button className="primaryBtn" type="button" onClick={onAnalyse}>
          Analyse Username
        </button>
      </section>

        <div className="profileDashboardGrid profileAccountPremiumGrid">
          <section className="profileDashboardCard profileAccountCard" id="profile-account">
            <span className="profileLoginAnchor" id="login" aria-hidden="true" />
            <div className="profileCardHeader">
              <p className="eyebrow">Account security</p>
              <h2>Account settings</h2>
              <p>Manage login, connected usernames, and saved account data.</p>
            </div>
            <AccountPanel variant="screen" onUserChange={onUserChange} />
          </section>

          <FounderPassProfileCard isPremium={isPremium} onFounderPass={onFounderPass} />
        </div>

        {hasStoredProgress ? (
          <OpeningFitProgressCard
            data={null}
            fitData={fitData}
            accountUser={accountUser}
            reportHistory={reportHistory}
            openingFitUserState={openingFitUserState}
            onAnalyse={onAnalyse}
            onOpenReport={onOpenReport}
          />
        ) : null}

        <OpeningGamificationProgress
          data={null}
          fitData={fitData}
          savedProgress={
            (Array.isArray(openingFitUserState) ? openingFitUserState : [])
              .map((row) => row?.coach_progress?.openingGamification || null)
              .filter(Boolean)[0] || null
          }
        />

        <RecommendationHistorySection
          data={null}
          fitData={fitData}
          accountUser={accountUser}
          recommendationHistory={recommendationHistory}
          authLoading={authLoading}
          profileLoading={profileLoading}
          authHydrated={authHydrated}
          onAnalyse={onAnalyse}
          onViewRepertoire={onOpenReport}
        />
      </div>
    );
  }

  return (
    <div className="profileDashboard">
      <ProfileSummaryCard
        data={data}
        fitData={fitData}
        accountUser={accountUser}
        username={username}
        platform={platform}
        isPremium={isPremium}
        isPremiumPreview={isPremiumPreview}
        onAnalyse={onAnalyse}
        onOpenReport={onOpenReport}
      />

      <div className="profileDashboardGrid">
        <ChessProfileCard data={data} fitData={fitData} />
        <LatestReportCard
          data={data}
          fitData={fitData}
          username={username}
          platform={platform}
          onOpenReport={onOpenReport}
        />
      </div>

      <SavedReportsProfileCard onLoadReport={onLoadReport} onCreateReport={onAnalyse} />
      <OpeningFitProgressCard
        data={data}
        fitData={fitData}
        accountUser={accountUser}
        reportHistory={reportHistory}
        openingFitUserState={openingFitUserState}
        onAnalyse={onAnalyse}
        onOpenReport={onOpenReport}
      />
      <OpeningGamificationProgress
        data={data}
        fitData={fitData}
        savedProgress={
          (Array.isArray(openingFitUserState) ? openingFitUserState : [])
            .map((row) => row?.coach_progress?.openingGamification || null)
            .filter(Boolean)[0] || null
        }
      />
      <RecommendationHistorySection
        data={data}
        fitData={fitData}
        accountUser={accountUser}
        recommendationHistory={recommendationHistory}
        authLoading={authLoading}
        profileLoading={profileLoading}
        authHydrated={authHydrated}
        onAnalyse={onAnalyse}
        onViewRepertoire={onOpenReport}
      />
      <ProfileAchievementsCard data={data} fitData={fitData} isPremium={isPremium} />

      <div className="profileDashboardGrid profileAccountPremiumGrid">
        <section className="profileDashboardCard profileAccountCard" id="profile-account">
          <span className="profileLoginAnchor" id="login" aria-hidden="true" />
          <div className="profileCardHeader">
            <p className="eyebrow">Account security</p>
            <h2>Account settings</h2>
            <p>Manage login, connected usernames, and saved account data.</p>
          </div>
          <AccountPanel variant="screen" onUserChange={onUserChange} />
        </section>

        <FounderPassProfileCard isPremium={isPremium} onFounderPass={onFounderPass} />
      </div>
    </div>
  );
}

function StyleBasedStarterRecommendations({ data, fitData, onPractice }) {
  const styleRec =
    data?.styleBasedRecommendations ||
    data?.style_based_recommendations ||
    buildFrontendStyleBasedRecommendations(data);
  const reliability = styleRec?.dataReliability || styleRec?.data_reliability || {};
  const lowData = Boolean(styleRec?.enabled || reliability.lowData || reliability.low_data);
  const hasDetectedOpenings = (fitData?.scoredOpenings || []).some(
    (opening) => getOpeningSignal(opening).canBePrimary && getOpeningGames(opening) >= 3
  );
  const [enabled, setEnabled] = useState(lowData);
  const [activeTab, setActiveTab] = useState(lowData ? "style" : "detected");

  useEffect(() => {
    setEnabled(lowData);
    setActiveTab(lowData ? "style" : "detected");
  }, [lowData, data?.importedAt, data?.lastUpdated]);

  if (!styleRec?.sections?.length) return null;
  if (!lowData && !enabled) return null;

  const visible = enabled && (activeTab === "style" || !hasDetectedOpenings);
  const reasons = reliability.reasons || [];

  return (
    <section className="styleStarterPanel" id="style-based-suggestions">
      <div className="styleStarterHeader">
        <div>
          <p className="eyebrow">Optional recommendation layer</p>
          <h2>{lowData ? "Starter Opening Recommendations" : "Style-Based Suggestions"}</h2>
          <p>
            {lowData
              ? "We couldn't find enough repeated opening data yet, so OpeningFit is recommending openings based on your playing style."
              : "Your detected openings remain primary. These style-based suggestions are optional."}
          </p>
        </div>

        <label className="styleStarterToggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span>Use style-based recommendations when opening data is limited</span>
        </label>
      </div>

      {hasDetectedOpenings ? (
        <div className="styleStarterTabs" role="tablist" aria-label="Recommendation source">
          <button
            type="button"
            className={activeTab === "detected" ? "styleStarterTabActive" : ""}
            onClick={() => setActiveTab("detected")}
          >
            Detected Openings
          </button>
          <button
            type="button"
            className={activeTab === "style" ? "styleStarterTabActive" : ""}
            onClick={() => setActiveTab("style")}
            disabled={!enabled}
          >
            Style-Based Suggestions
          </button>
        </div>
      ) : null}

      {activeTab === "detected" && hasDetectedOpenings ? (
        <div className="styleStarterDetectedNote">
          <strong>Your Detected Openings stay primary.</strong>
          <span>Use the main repertoire report for evidence-backed opening detection.</span>
        </div>
      ) : null}

      {visible ? (
        <>
          <div className="styleStarterReliability">
            <strong>{styleRec?.styleProfile?.primaryStyle || styleRec?.style_profile?.primaryStyle || "Developing style"}</strong>
            <span>
              {reliability.gamesAnalyzed ?? reliability.games_analyzed ?? "Few"} games analysed
              {reasons.length ? ` · ${reasons.slice(0, 2).join(" · ")}` : ""}
            </span>
          </div>

          <div className="styleStarterSections">
            {styleRec.sections.map((section) => (
              <article className="styleStarterSection" key={section.key}>
                <h3>{section.title}</h3>
                <div className="styleStarterCards">
                  {(section.items || []).map((item) => (
                    <div className="styleStarterCard" key={`${section.key}-${item.name}`}>
                      <div className="styleStarterCardTop">
                        <span>{item.label || "Style-Based Recommendation"}</span>
                        <strong>{item.confidenceLevel || item.confidence || "Low Confidence"}</strong>
                      </div>
                      <h4>{item.name}</h4>
                      <p>{item.whyItFits || item.why_it_fits}</p>
                      <dl>
                        <div>
                          <dt>Core plan</dt>
                          <dd>{item.corePlan || item.core_plan}</dd>
                        </div>
                        <div>
                          <dt>Common mistake avoided</dt>
                          <dd>{item.commonMistakeAvoided || item.common_mistake_avoided}</dd>
                        </div>
                      </dl>
                      {Array.isArray(item.starterMoveSequence || item.starter_move_sequence) ? (
                        <div className="styleStarterMoves">
                          {(item.starterMoveSequence || item.starter_move_sequence).map((move) => (
                            <span key={move}>{move}</span>
                          ))}
                        </div>
                      ) : null}
                      {item.futureUpgrade || item.future_upgrade ? (
                        <em>Future Upgrade Opening</em>
                      ) : null}
                      <button type="button" onClick={() => onPractice?.(item.name)}>
                        Practise this line
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {styleRec.futureUpgradeOpenings?.length || styleRec.future_upgrade_openings?.length ? (
            <div className="styleStarterFuture">
              <strong>Future Upgrade Openings</strong>
              <span>
                {(styleRec.futureUpgradeOpenings || styleRec.future_upgrade_openings)
                  .slice(0, 5)
                  .map((item) => item.name)
                  .join(", ")}
              </span>
            </div>
          ) : null}
        </>
      ) : null}
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

      <StyleBasedStarterRecommendations
        data={data}
        fitData={fitData}
        onPractice={onPractice}
      />

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
        <button type="button" onClick={() => onViewChange?.("train")}>
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
        <button type="button" onClick={() => onViewChange?.("profile")}>
          Pricing
        </button>
      </article>

      <button className="commandUpgradeCta" type="button" onClick={() => onViewChange?.("profile")}>
        Pricing
      </button>
    </section>
  );
}

function RepertoireCommandPanel({ data, onPractice }) {
  const sections = buildRepertoireReportSections(data);

  return (
    <section className="commandPanel" id="recommended-repertoire">
      <div className="commandPanelHeader">
        <p className="eyebrow">Recommended repertoire</p>
        <h2>What to play by colour</h2>
        <p>Only roles with useful evidence are expanded. Empty roles stay out of the way until your games create a signal.</p>
      </div>

      <div className="colourRepertoireGrid commandRepertoireGrid">
        {sections.map((section) => {
          const populatedBuckets = REPERTOIRE_BUCKETS.map((bucket) => {
            const items = section.buckets[bucket.key] || [];
            const first = items[0];

            return first ? { bucket, items, first } : null;
          }).filter(Boolean);

          return (
            <article className="colourRepertoireSection" key={section.key}>
              <div className="colourRepertoireHeader">
                <p className="eyebrow">{sectionHealth(section)}</p>
                <h3>{section.title}</h3>
              </div>

              <div className="colourRepertoireBuckets">
                {populatedBuckets.length ? populatedBuckets.slice(0, 3).map(({ bucket, items, first }) => (
                  <div className="repertoireBucket" key={`${section.key}-${bucket.key}`}>
                    <div className="repertoireBucketHeader">
                      <h4>{bucket.title}</h4>
                      <span>{items.length}</span>
                    </div>
                    <p>{colourAwareBucketCopy(section.key, bucket.key)}</p>
                    <button
                      type="button"
                      className="commandMiniOpening"
                      onClick={() => onPractice?.(first.name)}
                    >
                      <strong>{first.name}</strong>
                      <span>{confidenceRowText(first)}</span>
                    </button>
                  </div>
                )) : (
                  <EmptyState title="No role signal yet" text={section.empty} />
                )}
              </div>
            </article>
          );
        })}
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
  const { user, recordActivity } = useAuth();
  const weakLines = mergeWeakLines(data);
  const [selectedLine, setSelectedLine] = useState(null);
  const weak = [...(fitData?.scoredOpenings || [])]
    .filter((item) => ["avoid", "review", "improve"].includes(item.fitCategory))
    .sort((a, b) => {
      const rank = { avoid: 0, review: 1, improve: 2 };
      const categoryDiff = (rank[a.fitCategory] ?? 3) - (rank[b.fitCategory] ?? 3);
      if (categoryDiff) return categoryDiff;
      return (a.fitScore || 100) - (b.fitScore || 100);
    });
  const focus = weak[0];
  const trainSelectedLine = async () => {
    if (!selectedLine) return;

    if (user?.id && recordActivity) {
      try {
        await recordActivity("weak_line_training_started", {
          opening: selectedLine.opening,
          variation: selectedLine.variation || selectedLine.line,
          move_line: selectedLine.moveLine,
          games: selectedLine.games,
          win_rate: selectedLine.winRate,
          loss_rate: selectedLine.lossRate,
          points: 40,
        });
      } catch (error) {
        console.warn("OpeningFit could not record weak-line training activity.", error);
      }
    }

    onPractice?.(selectedLine.trainingTarget || selectedLine.opening);
  };

  return (
    <section className="commandPanel weakLinesSection" id="weak-lines">
      <div className="commandPanelHeader">
        <p className="eyebrow">Weak lines</p>
        <h2>Specific variations causing trouble</h2>
        <p>
          These are opening lines with enough repeated games to review. OpeningFit flags the variation first, before blaming the whole opening.
        </p>
      </div>

      {weakLines.length ? (
        <div className="weakLineGrid">
          {weakLines.slice(0, 6).map((line) => (
            <article className="weakLineCard" key={`${line.opening}-${line.line}-${line.context}`}>
              <div className="weakLineCardTop">
                <div>
                  <span>{line.contextLabel || "Opening line"}</span>
                  <strong>{line.opening}</strong>
                </div>
                <em>{line.games} games</em>
              </div>

              <h3>{line.line}</h3>
              {line.moveLine && line.moveLine !== line.line ? <p className="weakLineMoves">{line.moveLine}</p> : null}

              <dl className="weakLineStats">
                <div>
                  <dt>Win rate</dt>
                  <dd>{line.winRate}%</dd>
                </div>
                <div>
                  <dt>Loss rate</dt>
                  <dd>{line.lossRate}%</dd>
                </div>
                <div>
                  <dt>Sample</dt>
                  <dd>{line.games >= 5 ? "Reliable" : "Early"}</dd>
                </div>
              </dl>

              <p>{line.flagReason}</p>

              <button type="button" onClick={() => setSelectedLine(line)}>
                Train this line
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No repeated weak line yet"
          text="OpeningFit needs at least a few games in the same variation before it flags a weak line."
        />
      )}

      {selectedLine ? (
        <article className="weakLineTrainingPanel" aria-live="polite">
          <div className="weakLineCardTop">
            <div>
              <span>Train this line</span>
              <strong>{selectedLine.opening}</strong>
            </div>
            <em>{selectedLine.games} games</em>
          </div>

          <h3>{selectedLine.variation || selectedLine.line}</h3>
          <p className="weakLineMoves">{selectedLine.moveLine}</p>
          <p>
            This exact move sequence is scoring {selectedLine.winRate}% with a {selectedLine.lossRate}% loss rate.
            Start by checking where your plan changes after the final move shown.
          </p>

          <div className="weakLineContinuationList">
            <span>Common continuations</span>
            {selectedLine.commonContinuations?.length ? (
              <ul>
                {selectedLine.commonContinuations.map((item) => (
                  <li key={item.move}>
                    {item.move} <small>{item.count} game{item.count === 1 ? "" : "s"}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No clear continuation yet. Review the next 2-3 moves from your losses.</p>
            )}
          </div>

          <div className="weakLineTrainingActions">
            <button type="button" onClick={trainSelectedLine}>
              Open practice board
            </button>
            <button type="button" onClick={() => setSelectedLine(null)}>
              Close
            </button>
          </div>
        </article>
      ) : null}

      {focus ? (
        <article className="nextBestActionCard weakSpotFeature">
          <div>
            <span>Opening-level fallback</span>
            <strong>{getOpeningContextTitle(focus)}</strong>
            <p>{focus.fitExplanation}</p>
            <FitReasonList opening={focus} compact />
          </div>
          <button type="button" onClick={() => onPractice?.(getOpeningName(focus)) || onViewChange?.("train")}>
            Train opening
          </button>
        </article>
      ) : (
        <EmptyState title="No opening-level leak found" text="Your current import does not show a clear repeated weak opening." />
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

function FloatingAppMenu({ data, activeView, onNavigate }) {
  const [open, setOpen] = useState(false);
  const activeSection = getAppSection(activeView);

  const menuRoutes = [
    { key: "analyse", label: "Analyse", activeSections: ["analyse"] },
    { key: "report", label: "Report", activeSections: ["report"] },
    { key: "training", label: "Training", activeViews: ["train", "training", "interactive", "practice"] },
    { key: "profile", label: "Profile", activeViews: ["profile", "account", "login", "history", "progress"] },
    { key: "premium", label: "Premium", activeViews: ["premium", "upgrade"], activePaths: ["/premium"] },
    { key: "feedback", label: "Feedback", activeSections: ["feedback"] },
  ];

  const isRouteActive = (route) => {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
    return (
      route.activeViews?.includes(activeView) ||
      route.activeSections?.includes(activeSection) ||
      route.activePaths?.includes(currentPath) ||
      activeView === route.key
    );
  };

  const navigate = (event, route) => {
    event?.preventDefault();
    event?.stopPropagation();

    setOpen(false);
    onNavigate?.(route.key);
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
                className={isRouteActive(route) ? "isActive" : ""}
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

function AppPrimaryNav({
  activeView,
  accountUser,
  onNavigate,
  onExampleReport,
  onLogin,
  onPricing,
  theme,
  onThemeToggle,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const items = accountUser
    ? [
        { key: "analyse", label: "Home" },
        { key: "report", label: "Report" },
        { key: "training", label: "Train" },
        { key: "account", label: "Profile" },
        { key: "pricing", label: "Premium", path: "/premium", target: "premium", action: onPricing },
      ]
    : [
        { key: "analyse", label: "Home" },
        { key: "example", label: "Report", path: "/report", target: "app-results", action: onExampleReport },
        { key: "training", label: "Train" },
        { key: "pricing", label: "Premium", path: "/premium", target: "premium", action: onPricing },
        { key: "login", label: "Login", path: "/login", target: "login", action: onLogin },
      ];
  const primaryAction = accountUser
    ? { key: "analyse", label: "Analyse New Games" }
    : { key: "analyse", label: "Get Started" };
  const mobileMenuId = "openingfit-mobile-menu";
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  const isPrimaryNavItemActive = (item) => {
    const isPremiumPath = currentPath === "/premium" || currentPath === "/upgrade";
    if (item.key === "account" && isPremiumPath) return false;
    if (item.key === activeView) return true;

    const activeViewsByKey = {
      analyse: ["analyse", "home", "import"],
      report: ["report", "overview", "recommendations", "repertoire", "openings", "weakspots", "verdicts"],
      recommendations: ["report", "overview", "recommendations", "repertoire", "openings", "weakspots", "verdicts"],
      example: ["report", "overview", "recommendations", "repertoire", "openings", "weakspots", "verdicts"],
      training: ["train", "training", "interactive", "practice"],
      games: ["games", "data"],
      history: ["history"],
      account: ["profile", "account", "progress"],
      pricing: ["premium", "upgrade"],
      login: ["login"],
    };

    if (activeViewsByKey[item.key]?.includes(activeView)) return true;
    if (item.key === "pricing" && currentPath === "/premium") return true;
    if (item.key === "login" && currentPath === "/login") return true;
    if (item.key === "account" && currentPath === "/account" && !["history"].includes(activeView)) return true;

    return false;
  };

  const navigate = (event, item) => {
    event.preventDefault();
    setMobileMenuOpen(false);

    if (typeof item.action === "function") {
      item.action(event);
      return;
    }

    onNavigate?.(item.key);
  };

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <nav className="appPrimaryNav" aria-label="OpeningFit sections">
      <div className="appPrimaryNavInner">
        <a className="appPrimaryBrand" href="#app-dashboard" onClick={(event) => navigate(event, primaryAction)}>
          <span>OpeningFit</span>
        </a>

        <div className="appPrimaryTabs" role="list">
          {items.map((item) => {
            const isActive = isPrimaryNavItemActive(item);

            return (
              <a
                key={item.key}
                href={item.path || "#app-dashboard"}
                role="listitem"
                className={isActive ? "appPrimaryTab appPrimaryTabActive" : "appPrimaryTab"}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => navigate(event, item)}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <a className="appPrimaryGetStarted" href="/" onClick={(event) => navigate(event, primaryAction)}>
          {primaryAction.label}
        </a>

        <button
          className="appPrimaryMenuToggle"
          type="button"
          aria-controls={mobileMenuId}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close OpeningFit menu" : "Open OpeningFit menu"}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{mobileMenuOpen ? "×" : "☰"}</span>
        </button>
      </div>

      <div
        className={`appPrimaryMobilePanel ${mobileMenuOpen ? "appPrimaryMobilePanelOpen" : ""}`}
        id={mobileMenuId}
        hidden={!mobileMenuOpen}
      >
        <div className="appPrimaryMobileHeader">
          <strong>OpeningFit</strong>
          <span>{accountUser ? "Account connected" : "Analyse first. Save after login."}</span>
        </div>

        <div className="appPrimaryMobileLinks">
          {[primaryAction, ...items].map((item) => {
            const isActive = isPrimaryNavItemActive(item);
            return (
              <a
                key={`${item.key}-${item.label}`}
                href={item.path || "#app-dashboard"}
                className={isActive ? "appPrimaryMobileLink appPrimaryMobileLinkActive" : "appPrimaryMobileLink"}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => navigate(event, item)}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <button className="appPrimaryMobileTheme" type="button" onClick={onThemeToggle}>
          <span>{theme === "light" ? "Light mode" : "Dark mode"}</span>
          <strong>{theme === "light" ? "Switch to dark" : "Switch to light"}</strong>
        </button>
      </div>
    </nav>
  );
}

function AccountSyncStatusBar({
  user,
  isSupabaseConfigured,
  authLoading,
  profileLoading,
  authHydrated,
  hasPremiumAccess,
  syncStatus,
  lastSavedAt,
  syncError,
  onAccount,
  onSignOut,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusRef = useRef(null);
  const savedTime = useMemo(() => {
    if (!lastSavedAt) return "";
    const date = new Date(lastSavedAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastSavedAt]);

  let label = "Logged out";
  let identity = "Account";
  let detail = "Create a free account to save reports and sync across devices.";
  let tone = "loggedOut";
  let plan = "Free";
  let action = "Login";

  if (!isSupabaseConfigured) {
    label = "Logged out";
    identity = "Cloud off";
    detail = "Supabase env vars missing. Cloud accounts and saving are not connected.";
    tone = "error";
    action = "Account";
  } else if (authLoading || !authHydrated) {
    label = "Checking account...";
    identity = "Checking";
    detail = "OpeningFit is checking your Supabase session.";
    tone = "loading";
    action = "Account";
  } else if (profileLoading) {
    label = "Restoring saved data...";
    identity = "Restoring";
    detail = "Loading your profile, reports, settings, and recommendations from Supabase.";
    tone = "loading";
    action = "Account";
  } else if (user?.id) {
    identity = user.email || "OpeningFit user";
    label = "Logged in";
    plan = hasPremiumAccess ? "Founder" : "Free";
    action = "Account";

    if (syncStatus === "saving") {
      detail = "Saving...";
      tone = "saving";
    } else if (syncStatus === "error") {
      detail = syncError || "Save failed — retry";
      tone = "error";
    } else {
      detail = savedTime ? `Cloud sync active · Saved ${savedTime}` : "Cloud sync active · Saved";
      tone = "synced";
    }
  }

  const initials = useMemo(() => {
    if (!user?.id) return "OF";
    const source = identity || user?.email || "OF";
    const [first = "", second = ""] = source.split(/[\s@._-]+/).filter(Boolean);
    return `${first[0] || "O"}${second[0] || "F"}`.toUpperCase();
  }, [identity, user?.email, user?.id]);

  useEffect(() => {
    if (!isExpanded) return undefined;

    const closeOnOutside = (event) => {
      if (!statusRef.current?.contains(event.target)) {
        setIsExpanded(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsExpanded(false);
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExpanded]);

  const handleAccountAction = (event) => {
    event.stopPropagation();
    setIsExpanded(false);
    onAccount?.(event);
  };

  const handleSignOut = async (event) => {
    event.stopPropagation();
    await onSignOut?.();
    setIsExpanded(false);
  };

  return (
    <section
      className={`accountSyncStatusBar accountSyncStatusBar--${tone} ${isExpanded ? "accountSyncStatusBar--expanded" : ""}`}
      ref={statusRef}
      aria-label="Account status"
    >
      <button
        className="accountSyncChip"
        type="button"
        aria-expanded={isExpanded}
        aria-controls="account-sync-details"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="accountSyncAvatar" aria-hidden="true">{initials}</span>
        <span className="accountSyncCompactText">
          <span>{label}</span>
          <strong>{identity}</strong>
        </span>
        <span className="accountSyncPlan">{plan}</span>
        <span className="accountSyncChevron" aria-hidden="true">⌄</span>
      </button>

      <div className="accountSyncDetails" id="account-sync-details" hidden={!isExpanded}>
        <div className="accountSyncDetailsHeader">
          <span>{label}</span>
          <strong>{identity}</strong>
          <small>{detail}</small>
        </div>

        <dl className="accountSyncMeta">
          <div>
            <dt>Access</dt>
            <dd>{hasPremiumAccess ? "Founder Pass active" : "Free plan"}</dd>
          </div>
          <div>
            <dt>Cloud save</dt>
            <dd>{detail}</dd>
          </div>
          {syncError ? (
            <div>
              <dt>Sync issue</dt>
              <dd>{syncError}</dd>
            </div>
          ) : null}
        </dl>

        <div className="accountSyncActions">
          <button type="button" onClick={handleAccountAction}>
            {syncStatus === "error" ? "Retry sync" : action}
          </button>
          {user?.id ? (
            <button className="accountSyncSignOut" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}


function AppViewTabs({ activeView, onNavigate }) {
  const tabs = [
    { key: "overview", label: "Overview", icon: "⌂" },
    { key: "repertoire", label: "Repertoire", icon: "♙" },
    { key: "openings", label: "Openings", icon: "◎" },
    { key: "weakspots", label: "Weak spots", icon: "!" },
    { key: "training", label: "Training plan", icon: "◷" },
    { key: "data", label: "Data", icon: "♟" },
  ];

  const selectTab = (view) => onNavigate?.(view);

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

function isPrivateSeoPath(path) {
  return ["/account", "/login", "/report", "/train", "/premium", "/upgrade"].includes(path);
}

function getInitialAppView() {
  const path = getCurrentPath();
  if (path === "/account" || path === "/login") return "profile";
  if (path === "/upgrade" || path === "/premium") return "upgrade";
  if (path === "/train") return "train";
  if (path === "/report") return "report";
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.analysis) return "report";
  } catch {
    // Ignore invalid saved reports; hydration will clean them up.
  }
  return "analyse";
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
      title: "Import Games",
      text: "Enter a Chess.com or Lichess username.",
    },
    {
      title: "Analyse Openings",
      text: "OpeningFit finds what to keep, improve, or replace.",
    },
    {
      title: "Get Study Plan",
      text: "Leave with one practical opening task.",
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
      text: "Review recent opening results.",
    },
    {
      title: "Get the plan",
      text: "See keep, fix, and study decisions.",
    },
  ];

  const outputExamples = [
    {
      label: "Keep",
      title: "Vienna Game",
      text: "Strong results. Keep training it.",
    },
    {
      label: "Improve",
      title: "Scandinavian Defence",
      text: "Repeated early losses. Repair the first plan.",
    },
    {
      label: "Replace",
      title: "Englund Gambit",
      text: "Creating avoidable risk. Find a safer alternative.",
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
      value: "Public",
      label: "game imports",
      detail: "OpeningFit works from public Chess.com and Lichess game history.",
    },
    {
      value: "Colour-aware",
      label: "opening grouping",
      detail: "White choices and Black responses are kept separate in the report.",
    },
    {
      value: "Confidence",
      label: "before verdicts",
      detail: "Small samples are labelled before OpeningFit makes a strong recommendation.",
    },
  ];

  const credibilityTestimonials = [
    {
      quote:
        "A player with scattered White results can use the report to choose one study target instead of reviewing every opening at once.",
      name: "Example workflow",
      metric: "One study target instead of a long candidate list",
    },
    {
      quote:
        "A player struggling as Black can check whether the issue is all 1.d4 games or one repeated structure.",
      name: "Example workflow",
      metric: "Narrow prep from broad repertoire change to one repair line",
    },
    {
      quote:
        "A player trying new gambits can see which openings are low-data experiments before replacing a stable repertoire choice.",
      name: "Example workflow",
      metric: "Separate reliable openings from experiments",
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
      openingFit: "Automated import, then focused review",
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

  const differentiationPillars = [
    {
      label: "Repertoire fingerprint",
      title: "Your openings are treated like a pattern, not a database search.",
      text: "Opening Fit splits White, Black vs 1.e4, and Black vs 1.d4 so your plan has shape.",
    },
    {
      label: "Confidence gate",
      title: "Small samples do not get loud verdicts.",
      text: "Thin evidence is marked as watch, not dressed up as a recommendation.",
    },
    {
      label: "One-line repair",
      title: "The output is a next action, not a theory rabbit hole.",
      text: "You leave with one opening to keep, one to fix, and one study target.",
    },
  ];

  const differentiationComparisons = [
    {
      alternative: "Opening databases",
      gap: "Show theory popularity.",
      openingFit: "Shows what works in your games.",
    },
    {
      alternative: "Engines",
      gap: "Find move mistakes.",
      openingFit: "Finds repertoire decisions.",
    },
    {
      alternative: "Spreadsheets",
      gap: "Require manual sorting.",
      openingFit: "Groups sides and verdicts automatically.",
    },
    {
      alternative: "Generic courses",
      gap: "Teach someone else’s repertoire.",
      openingFit: "Builds from your recent results.",
    },
  ];

  const useCases = [
    {
      title: "Before a study session",
      text: "Pick one opening instead of browsing theory.",
    },
    {
      title: "After a painful losing streak",
      text: "Find whether the leak is the opening or the line.",
    },
    {
      title: "When building a simple repertoire",
      text: "Choose practical openings from your own results.",
    },
  ];

  const workflowFrames = [
    {
      title: "Input",
      text: "Enter a public username.",
      meta: "No PGN upload",
    },
    {
      title: "Import",
      text: "Recent games are scanned.",
      meta: "Usually under 60 seconds",
    },
    {
      title: "Classify",
      text: "Openings are grouped by side.",
      meta: "Confidence checked",
    },
    {
      title: "Generate",
      text: "Get keep, fix, and study-next actions.",
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
    "Keep: Caro-Kann. Stable score, enough games.",
    "Fix: Italian exchange lines. Results drop after move 12.",
    "Watch: King's Gambit. Sample is too small.",
    "Study next: one Black vs 1.d4 system.",
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
          <small>stable fit · review plan</small>
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
            <a href="#why-opening-fit">Why different</a>
            <a href="#product-demo">Demo</a>
            <a href="#how-it-works">How it works</a>
            <a href="#output-examples">Examples</a>
            <a href="#use-cases">Use cases</a>
            <a href="/openings">Openings</a>
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

            <h1>Find Chess Openings That Match Your Playing Style</h1>

            <p className="landingSubtext">
              Import your Chess.com or Lichess games and discover which openings fit your results,
              strengths, and weaknesses.
            </p>

            <div className="landingHeroActions">
              <a className="landingPrimaryBtn" href="#app-dashboard">
                Analyse username
              </a>
              <a className="landingSecondaryBtn" href="#sample-report">
                View sample report
              </a>
            </div>

            <p className="landingTrustLine">
              No PGN upload · Public games only · Confidence labels included
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

      <div className="landingMobileStickyCta" aria-label="Start Opening Fit">
        <a className="landingPrimaryBtn" href="#app-dashboard">
          Analyse username
        </a>
        <a className="landingSecondaryBtn" href="#sample-report">
          Sample
        </a>
      </div>

      <section className="landingStorySection landingProblemSection" id="problem">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Question: why do my openings still feel random?</p>
          <h2>Your games already show which openings deserve your attention.</h2>
          <p>
            Decide what to keep, repair, or stop trusting before your next session.
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

      <section className="landingStorySection landingDifferenceSection" id="why-opening-fit">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Why Opening Fit</p>
          <h2>Not more chess data. A decision layer for your repertoire.</h2>
          <p>
            Most tools show moves, evals, or master games. Opening Fit answers:
            what should you keep, fix, watch, or study next?
          </p>
        </div>

        <div className="landingFingerprintDemo" aria-label="Opening Fit repertoire fingerprint demo">
          <div className="fingerprintBoard" aria-hidden="true">
            <span className="fingerprintSquare fingerprintKeep">Keep</span>
            <span />
            <span className="fingerprintSquare fingerprintFix">Fix</span>
            <span />
            <span />
            <span className="fingerprintSquare fingerprintWatch">Watch</span>
            <span />
            <span className="fingerprintSquare fingerprintStudy">Study</span>
            <span />
          </div>
          <div className="fingerprintCopy">
            <span>Repertoire fingerprint</span>
            <strong>White: stable. Black vs e4: strong. Black vs d4: scattered.</strong>
            <p>
              The memorable bit: your report becomes a small map of opening
              decisions, not a wall of theory.
            </p>
          </div>
        </div>

        <div className="landingDifferentiatorGrid">
          {differentiationPillars.map((pillar) => (
            <article className="landingDifferentiatorCard" key={pillar.label}>
              <span>{pillar.label}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </article>
          ))}
        </div>

        <div className="landingAlternativeGrid">
          {differentiationComparisons.map((item) => (
            <article className="landingAlternativeCard" key={item.alternative}>
              <h3>{item.alternative}</h3>
              <p>{item.gap}</p>
              <strong>{item.openingFit}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="landingStorySection landingDemoSection" id="product-demo">
        <div className="landingDemoCopy">
          <p className="landingEyebrow">Question: what will I see?</p>
          <h2>A report that turns messy games into opening decisions.</h2>
          <p>
            See strengths, weak lines, confidence, and one next study target.
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
            The app imports and groups games. You review the result.
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
          <p className="landingEyebrow">How it works</p>
          <h2>From username to study plan in three steps.</h2>
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
          <p className="landingEyebrow">Example result</p>
          <h2>Keep, improve, or replace.</h2>
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
            Public games only. Low-confidence samples are marked clearly.
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
          <p className="landingEyebrow">Social proof</p>
          <h2>Players use OpeningFit to make opening study simpler.</h2>
          <p>
            The workflow is designed to turn messy game history into one clear study target.
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
            Opening Fit does not replace a coach or engine. It turns recent
            games into a believable opening shortlist.
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

      <section className="landingStorySection landingProblemSection" id="opening-choice">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Chess opening analysis</p>
          <h2>Stop Guessing Which Openings To Play</h2>
          <p>
            Most players pick openings from YouTube or grandmaster games. OpeningFit looks at your own games and helps you choose openings that actually fit how you play.
          </p>
          <p>
            Use it for chess opening analysis, chess opening recommendations, and a chess repertoire builder workflow: analyse Chess.com games, analyse Lichess games, then shape an opening repertoire around personalised chess openings.
          </p>
        </div>

        <div className="landingProblemGrid">
          <article className="landingStoryCard">
            <h3>Personalised chess openings</h3>
            <p>
              Analyse Chess.com games or analyse Lichess games to see which positions already match your strengths.
            </p>
          </article>
          <article className="landingStoryCard">
            <h3>Chess opening recommendations</h3>
            <p>
              OpeningFit turns your results and weaknesses into practical recommendations instead of generic theory lists.
            </p>
          </article>
          <article className="landingStoryCard">
            <h3>Chess repertoire builder</h3>
            <p>
              Build an opening repertoire around the lines you understand, then repair the choices that keep costing points.
            </p>
          </article>
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
          <h2>Get your opening plan from real games.</h2>
          <p>
            Use your public username, get the snapshot, then pick what to study next.
          </p>
        </div>

        <div className="landingFinalActions">
          <a className="landingPrimaryBtn" href="#app-dashboard">
            Analyse username
          </a>
          <a className="landingSecondaryBtn" href="#sample-report">
            View sample report
          </a>
        </div>
      </section>
    </div>
  );
}





const REPORT_HISTORY_KEY = "openingFit:reportHistory";

function ReportExportAndHistory({ data, onLoadReport, isPremium = false, onUpgrade }) {
  const {
    user: cloudUser,
    reportHistory: cloudReportHistory,
    saveReport: saveCloudReportFromAuth,
    deleteUserData,
    refreshUserData,
  } = useAuth();
  const [savedReports, setSavedReports] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("");

  useEffect(() => {
    if (cloudUser?.id) {
      const cloudReports = (cloudReportHistory || []).map((item) => ({
        id: item.id,
        savedAt: item.created_at || item.updated_at || new Date().toISOString(),
        playerName: item.username || item.summary?.username || "Opening Fit report",
        gamesImported: item.summary?.games || item.report?.gamesImported || item.report?.total_games || "Recent",
        styleLabel: item.summary?.styleLabel || item.report?.styleLabel || "Opening report",
        data: item.report,
        cloud: true,
      }));
      setSavedReports(cloudReports);
      return;
    }

    try {
      const stored = JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) || "[]");
      setSavedReports(Array.isArray(stored) ? stored : []);
    } catch {
      setSavedReports([]);
    }
  }, [cloudReportHistory, cloudUser?.id]);

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

  const handleSaveReport = async () => {
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

    if (cloudUser?.id && saveCloudReportFromAuth) {
      setHistoryStatus("Saving report to your account...");
      try {
        await saveCloudReportFromAuth(data, {
          username: playerName,
          platform: data.platform || data.importPlatform || data.import_platform || "unknown",
          games: gamesImported,
          styleLabel,
          savedAt: reportRecord.savedAt,
        });
        await refreshUserData?.();
        setHistoryStatus("Report saved to your OpeningFit account.");
        return;
      } catch (cloudError) {
        console.warn("Could not save report to Supabase", cloudError);
        setHistoryStatus("Cloud save failed. Saved a browser copy instead.");
      }
    }

    const updated = [
      reportRecord,
      ...savedReports.filter((report) => report.playerName !== playerName),
    ].slice(0, 8);
    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(updated));
    setSavedReports(updated);
  };

  const clearReports = async () => {
    if (cloudUser?.id && savedReports.some((report) => report.cloud)) {
      setHistoryStatus("Clearing cloud history...");
      try {
        await Promise.all(
          savedReports
            .filter((report) => report.cloud && report.id)
            .map((report) => deleteUserData?.("report_history", report.id))
        );
        await refreshUserData?.();
        setHistoryStatus("Cloud report history cleared.");
        return;
      } catch (cloudError) {
        console.warn("Could not clear Supabase report history", cloudError);
        setHistoryStatus("Cloud clear failed. Please try again.");
        return;
      }
    }

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
      const reportTop = document.getElementById("app-results") || document.getElementById("opening-fit-report");
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

          <button type="button" onClick={handleSaveReport} className="exportSecondaryBtn">
            {isPremium ? "Save report" : "Unlock saved history"}
          </button>
        </div>

        <small>
          {isPremium
            ? cloudUser?.id
              ? "Saved reports are stored in your OpeningFit account and restored after login."
              : "Saved reports are stored in this browser until you sign in."
            : "PDF export, cloud history, and deeper line diagnosis are planned as later premium upgrades."}
        </small>
        {historyStatus ? <small>{historyStatus}</small> : null}
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

  const recommendation = buildSingleRecommendedAction(data);

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
    loading: authLoading,
    hydrated: authHydrated,
    hasPremiumAccess,
    saveReport: saveCloudReport,
    recordActivity: recordCloudActivity,
    reportHistory: cloudReportHistory,
    recommendationHistory,
    saveRecommendationHistory,
    openingFitUserState,
    upsertUserData: upsertCloudUserData,
    refreshUserData,
    profileLoading,
    syncStatus,
    lastSavedAt,
    syncError,
    isSupabaseConfigured,
    supabase: supabaseClient,
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


  const isPremium = Boolean(hasPremiumAccess);
  const [isPremiumPreview, setIsPremiumPreview] = useState(false);

  const unlockPremiumDemo = () => {
    setIsPremiumPreview(true);
  };

  const resetPremiumDemo = () => {
    setIsPremiumPreview(false);
  };

  const [theme, setTheme] = useState(() => localStorage.getItem("openingFit:theme") || "dark");
  const [username, setUsername] = useState("");
  const [accountUser, setAccountUser] = useState(null);
  const [platform, setPlatform] = useState("chesscom");
  const [importMonths, setImportMonths] = useState(3);
  const [analysisTimeFormat, setAnalysisTimeFormat] = useState(() =>
    normalizeAnalysisTimeFormat(localStorage.getItem(ANALYSIS_TIME_FORMAT_KEY) || "custom")
  );
  const [reportFilters, setReportFilters] = useState(() => ({
    timeControl: getReportTimeControlFilter(
      localStorage.getItem(ANALYSIS_TIME_FORMAT_KEY) || "custom"
    ),
    dateRange: "90",
    openingQuery: "",
  }));
  const [openingSamplePercent, setOpeningSamplePercent] = useState(() =>
    clampOpeningSamplePercent(localStorage.getItem(OPENING_SAMPLE_PERCENT_KEY) ?? 2)
  );
  const [apiStatus, setApiStatus] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [loadingElapsedSeconds, setLoadingElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const [data, setData] = useState(null);
  const [activeView, setActiveView] = useState(getInitialAppView);
  const importAbortRef = useRef(null);
  const parsedPgnMovesCacheRef = useRef(new Map());

  useEffect(() => {
    setAccountUser(supabaseUser || null);
  }, [supabaseUser]);

  const loadDemoReport = () => {
    if (!data || isDemoAnalysis(data)) {
      setData(DEMO_REPORT);
      setImportStatus({
        tone: "info",
        title: "Sample report loaded",
        message: "This is demo data. Import a real Chess.com or Lichess username when you are ready.",
        meta: "Demo only",
      });
    } else {
      setImportStatus({
        tone: "info",
        title: "Keeping your imported report",
        message: "Your real analysis is already loaded, so the sample report was not allowed to replace it.",
        meta: "Real report protected",
      });
    }
    setError("");

    if (typeof setActiveView === "function") {
      setActiveView("report");
    }

    if (window.location.pathname !== "/report") {
      window.history.pushState({}, "", "/report");
    }

    setTimeout(() => {
      scrollToAppTarget("app-results");
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

  const openPricingPage = (event) => {
    event?.preventDefault?.();
    setActiveView("profile");

    if (window.location.pathname !== "/premium") {
      window.history.pushState({}, "", "/premium");
    }

    setTimeout(() => {
      scrollToAppTarget("premium", { fallbackIds: ["profile"] });
    }, 100);
  };

  const openLoginPage = useCallback((event) => {
    event?.preventDefault?.();
    const currentPath = `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;
    if (!accountUser && currentPath !== "/login") {
      localStorage.setItem(AUTH_RETURN_PATH_KEY, currentPath);
    }
    setActiveView("profile");

    const targetPath = accountUser ? "/account" : "/login";

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, "", targetPath);
    }

    setTimeout(() => {
      scrollToAppTarget(accountUser ? "profile-account" : "login", {
        fallbackIds: ["profile"],
      });
    }, 120);
  }, [accountUser, setActiveView]);

  const retryAccountSync = async (event) => {
    event?.preventDefault?.();

    if (!supabaseUser?.id) {
      openLoginPage(event);
      return;
    }

    try {
      setCloudSaveWarning("");
      await refreshUserData?.(supabaseUser);
      setCloudSaveStatus("saved");
    } catch (retryError) {
      console.warn("OpeningFit Supabase retry failed", retryError);
      setCloudSaveStatus("failed");
      setCloudSaveWarning(retryError?.message || "Could not restore Supabase sync.");
    }
  };

  const handleAccountSignOut = async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    setAccountUser(null);
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
  const [cloudSaveWarning, setCloudSaveWarning] = useState("");
  const [cloudSaveStatus, setCloudSaveStatus] = useState("");
  const previousAuthUserIdRef = useRef(undefined);
  const shouldShowLandingIntro = () => {
    const landingSeen = localStorage.getItem("openingfit_landing_seen") === "true";
    const hasSavedReport = Boolean(localStorage.getItem(STORAGE_KEY));
    const hasAppHash = window.location.hash && window.location.hash !== "#";
    return !hasSavedReport && !landingSeen && !hasAppHash;
  };

  // This is intentionally session-only.
  const [showPublicLanding, setShowPublicLanding] = useState(shouldShowLandingIntro);

  useEffect(() => {
    if (!loading) {
      setLoadingElapsedSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    setLoadingElapsedSeconds(0);

    const interval = window.setInterval(() => {
      setLoadingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!authHydrated) return;

    const currentUserId = supabaseUser?.id || null;
    const previousUserId = previousAuthUserIdRef.current;

    if (!previousUserId && currentUserId) {
      const returnPath = localStorage.getItem(AUTH_RETURN_PATH_KEY);
      if (returnPath) {
        localStorage.removeItem(AUTH_RETURN_PATH_KEY);
        const cleanReturnPath = returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/";

        if (window.location.pathname === "/login" || window.location.pathname === "/account") {
          window.history.replaceState({}, "", cleanReturnPath);
          setActiveView(getInitialAppView());
        }
      }
    }

    if (previousUserId && previousUserId !== currentUserId) {
      setData(null);
      setSelectedGameIndex(0);
      setPracticeOpening(null);
      setSavedProfileMessage("");
      setError("");
      setCloudSaveWarning("");
      setCloudSaveStatus("");
    }

    previousAuthUserIdRef.current = currentUserId;
  }, [authHydrated, supabaseUser?.id]);

  const rememberLandingSeen = ({ keepPublicLanding = true } = {}) => {
    localStorage.setItem("openingfit_landing_seen", "true");
    setShowPublicLanding(Boolean(keepPublicLanding));
  };



  useEffect(() => {
    localStorage.setItem("openingFit:theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (authLoading || !authHydrated) return;
    if (supabaseUser?.id) return;

    const savedUsername = localStorage.getItem(USERNAME_KEY);
    const savedPlatform = localStorage.getItem(PLATFORM_KEY);
    const savedMonths = localStorage.getItem(IMPORT_MONTHS_KEY);
    const savedSamplePercent = localStorage.getItem(OPENING_SAMPLE_PERCENT_KEY);
    const savedAnalysisTimeFormat = localStorage.getItem(ANALYSIS_TIME_FORMAT_KEY);
    const savedAnalysis = localStorage.getItem(STORAGE_KEY);

    if (savedUsername) setUsername(savedUsername);

    if (savedMonths) {
      const parsedMonths = Number(savedMonths);
      if ([1, 3, 6, 12].includes(parsedMonths)) {
        setImportMonths(parsedMonths);
      }
    }

    if (savedSamplePercent !== null) {
      setOpeningSamplePercent(clampOpeningSamplePercent(savedSamplePercent));
    }

    if (savedAnalysisTimeFormat) {
      setAnalysisTimeFormat(normalizeAnalysisTimeFormat(savedAnalysisTimeFormat));
    }

    if (savedPlatform && platforms[savedPlatform]) {
      setPlatform(savedPlatform);
    }

    if (savedAnalysis) {
      try {
        const parsed = JSON.parse(savedAnalysis);

        if (parsed?.analysis) {
          setData(parsed.analysis);
          setLocalSavedAt(parsed.savedAt || "");
          setShowPublicLanding(false);
          if (getCurrentPath() === "/") {
            setActiveView("report");
            window.history.replaceState({}, "", "/report");
          }
          setSavedProfileMessage(
            `Saved local report found${
              parsed.username ? ` for ${parsed.username}` : ""
            }.`
          );
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [authHydrated, authLoading, supabaseUser?.id]);

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
    localStorage.setItem(
      OPENING_SAMPLE_PERCENT_KEY,
      String(openingSamplePercent)
    );
  }, [openingSamplePercent]);

  useEffect(() => {
    const normalized = normalizeAnalysisTimeFormat(analysisTimeFormat);
    localStorage.setItem(ANALYSIS_TIME_FORMAT_KEY, normalized);
    setReportFilters((current) => ({
      ...current,
      timeControl: getReportTimeControlFilter(normalized),
    }));
  }, [analysisTimeFormat]);

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

  function getFriendlyError(errorText, selectedPlatformKey = platform) {
    if (!errorText) {
      return "Something went wrong. Please try again.";
    }

    const lower = String(errorText).toLowerCase();
    const platformLabel = platforms[selectedPlatformKey]?.label || "the selected platform";

    if (lower.includes("abort") || lower.includes("cancel")) {
      return "Import cancelled. You can adjust the username or platform and try again.";
    }

    if (lower.includes("no saved profile")) {
      return "No saved backend profile found yet. I will still check your local browser save if one exists.";
    }

    if (lower.includes("demo profile could not be loaded")) {
      return "Demo could not be loaded. Your live backend may not be deployed or your frontend may not be pointing to the backend URL.";
    }

    if (lower.includes("not found") || lower.includes("could not find")) {
      return `Could not find that username on ${platformLabel}. Check the spelling, selected platform, and capitalization, then try again.`;
    }

    if (
      lower.includes("private") ||
      lower.includes("forbidden") ||
      lower.includes("unavailable") ||
      lower.includes("profile is closed") ||
      lower.includes("profile unavailable")
    ) {
      return `We found the ${platformLabel} account, but its games or profile are not publicly available right now. OpeningFit only uses public games.`;
    }

    if (lower.includes("no games") || lower.includes("not enough games")) {
      return `We reached ${platformLabel}, but did not find enough recent public games to build a report. Try a longer import window or play a few more public games first.`;
    }

    if (lower.includes("rate limiting") || lower.includes("429")) {
      return `${platformLabel} is temporarily limiting requests. Wait a minute, then try again.`;
    }

    if (
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("connection refused") ||
      lower.includes("could not connect") ||
      lower.includes("load failed")
    ) {
      return "OpeningFit could not reach the import service. The backend may be waking up or temporarily unavailable. Please try again in a moment.";
    }

    if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504")) {
      return "The import service hit a temporary problem while analysing those games. Please retry in a moment.";
    }

    if (lower.includes("404") && selectedPlatformKey === "lichess") {
      return "OpeningFit could not find that Lichess account or the Lichess import route was unavailable. Check the username and try again.";
    }

    try {
      const parsed = JSON.parse(errorText);
      return getFriendlyError(parsed.detail || parsed.message || "", selectedPlatformKey);
    } catch {
      return "OpeningFit could not finish the import. Check the username and platform, then try again.";
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

    const selectedTimeFormat = normalizeAnalysisTimeFormat(
      incoming.analysisTimeFormat ||
        incoming.analysis_time_format ||
        incoming.selectedTimeFormat ||
        incoming.selected_time_format ||
        analysisTimeFormat
    );
    const detectedTimeFormat =
      incoming.detectedTimeFormat ||
      incoming.detected_time_format ||
      detectReportTimeFormat(incoming);
    const weakLines = mergeWeakLines(incoming);
    const recommendedAction = buildSingleRecommendedAction(incoming);

    return {
      ...incoming,
      analysisTimeFormat: selectedTimeFormat,
      analysis_time_format: selectedTimeFormat,
      analysisTimeFormatLabel: getAnalysisTimeFormatLabel(selectedTimeFormat),
      analysis_time_format_label: getAnalysisTimeFormatLabel(selectedTimeFormat),
      detectedTimeFormat,
      detected_time_format: detectedTimeFormat,
      effectiveTimeFormat:
        selectedTimeFormat === "custom" ? detectedTimeFormat?.key || "custom" : selectedTimeFormat,
      effective_time_format:
        selectedTimeFormat === "custom" ? detectedTimeFormat?.key || "custom" : selectedTimeFormat,
      effectiveTimeFormatLabel:
        selectedTimeFormat === "custom"
          ? detectedTimeFormat?.label || "All Time Controls"
          : getAnalysisTimeFormatLabel(selectedTimeFormat),
      effective_time_format_label:
        selectedTimeFormat === "custom"
          ? detectedTimeFormat?.label || "All Time Controls"
          : getAnalysisTimeFormatLabel(selectedTimeFormat),
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
      weak_lines: weakLines,
      weakLines,
      style_profile: incoming.style_profile ?? incoming.styleProfile ?? {},
      styleBasedRecommendations:
        incoming.styleBasedRecommendations ??
        incoming.style_based_recommendations ??
        buildFrontendStyleBasedRecommendations(incoming, detectedTimeFormat, selectedTimeFormat),
      style_based_recommendations:
        incoming.style_based_recommendations ??
        incoming.styleBasedRecommendations ??
        buildFrontendStyleBasedRecommendations(incoming, detectedTimeFormat, selectedTimeFormat),
      opening_recommendations:
        incoming.opening_recommendations ??
        incoming.openingRecommendations ??
        incoming.recommendedOpenings ??
        {},
      training_plan: incoming.training_plan ?? incoming.trainingPlan ?? [],
      premium_preview: incoming.premium_preview ?? incoming.premiumPreview ?? {},
      recommendations: incoming.recommendations ?? [],
      recommended_action: recommendedAction,
      recommendedAction,
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

  const saveLocalAnalysis = (analysis, cleanUsername, selectedPlatformKey = platform) => {
    const savedAt = new Date().toISOString();

    const payload = {
      username: cleanUsername,
      platform: selectedPlatformKey,
      savedAt,
      analysis: {
        ...analysis,
        lastUpdated: analysis.lastUpdated || savedAt,
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(USERNAME_KEY, cleanUsername);
    localStorage.setItem(PLATFORM_KEY, selectedPlatformKey);
    localStorage.setItem(
      ANALYSIS_TIME_FORMAT_KEY,
      normalizeAnalysisTimeFormat(analysis.analysisTimeFormat || analysisTimeFormat)
    );
    setLocalSavedAt(savedAt);
  };

  const saveOpeningFitProgressState = async (report, summary, progressSnapshot) => {
    if (!supabaseUser?.id || !upsertCloudUserData || !progressSnapshot) return null;
    const openingHealth = progressSnapshot.openingHealth || summary?.openingHealth || null;
    const weakLines = summary?.weakLines || mergeWeakLines(report);

    const nextUsername =
      report?.username ||
      report?.playerName ||
      report?.player_name ||
      username ||
      "Unknown player";
    const nextPlatform =
      report?.platform ||
      report?.importPlatform ||
      report?.import_platform ||
      platform ||
      "unknown";
    const existingState = (openingFitUserState || []).find(
      (row) =>
        String(row?.username || "").toLowerCase() === String(nextUsername).toLowerCase() &&
        String(row?.platform || "").toLowerCase() === String(nextPlatform).toLowerCase()
    );
    const existingProgressHistory = Array.isArray(existingState?.progress_history)
      ? existingState.progress_history
      : [];
    const existingImportHistory = Array.isArray(existingState?.import_history)
      ? existingState.import_history
      : [];
    const existingWeeklySnapshots = Array.isArray(existingState?.coach_progress?.weeklyOpeningSnapshots)
      ? existingState.coach_progress.weeklyOpeningSnapshots
      : [];
    const weeklyOpeningReport = buildWeeklyOpeningSnapshot(report, existingWeeklySnapshots);
    const openingGamification = buildOpeningGamificationSnapshot(
      report,
      null,
      existingState?.coach_progress?.openingGamification || {}
    );
    const dedupeDate = progressSnapshot.lastAnalysisDate || summary?.reportDate || new Date().toISOString();
    const nextProgressHistory = [
      progressSnapshot,
      ...existingProgressHistory.filter(
        (item) =>
          !(
            item?.lastAnalysisDate === dedupeDate &&
            item?.mainOpeningRecommendation === progressSnapshot.mainOpeningRecommendation
          )
      ),
    ].slice(0, 12);
    const nextImportHistory = [
      {
        reportDate: summary?.reportDate || dedupeDate,
        games: progressSnapshot.gamesAnalysed || 0,
        score: progressSnapshot.repertoireConfidenceScore,
        mainOpeningRecommendation: progressSnapshot.mainOpeningRecommendation,
      },
      ...existingImportHistory.filter((item) => item?.reportDate !== summary?.reportDate),
    ].slice(0, 20);
    const nextWeeklySnapshots = [
      weeklyOpeningReport,
      ...existingWeeklySnapshots.filter(
        (item) => item?.weekKey !== weeklyOpeningReport.weekKey && item?.id !== weeklyOpeningReport.id
      ),
    ].slice(0, 16);

    return upsertCloudUserData(
      "openingfit_user_state",
      {
        ...(existingState?.id ? { id: existingState.id } : {}),
        platform: nextPlatform,
        username: nextUsername,
        last_report: report,
        coach_progress: {
          ...(existingState?.coach_progress || {}),
          openingFitProgress: progressSnapshot,
          openingHealth,
          weakLines,
          weeklyOpeningReport,
          weeklyOpeningSnapshots: nextWeeklySnapshots,
          openingGamification,
          latestSummary: summary,
        },
        progress_history: nextProgressHistory,
        import_history: nextImportHistory,
      },
      { onConflict: "user_id,platform,username" }
    );
  };

  const scrollToId = (id) => {
    setTimeout(() => {
      scrollToAppTarget(id);
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
    "premium": { view: "upgrade", target: "premium" },
    "premium-offer": { view: "upgrade", target: "premium" },
    "premium-workspace": { view: "upgrade", target: "premium-workspace" },
    "training-plan": { view: "train", target: "training-plan" },
    "section-training": { view: "train", target: "section-training" },
    "seven-day-plan": { view: "train", target: "seven-day-plan" },
    "coach-plan": { view: "train", target: "seven-day-plan" },
    "study-planner": { view: "train", target: "study-planner" },
    "game-replay": { view: "train", target: "game-replay" },
    "section-replay": { view: "train", target: "section-replay" },
    "section-verdicts": { view: "report", target: "evidence-table", reportMode: "table" },
    "keep-improve-avoid": { view: "report", target: "evidence-table", reportMode: "table" },
    "opening-suggestions": { view: "report", target: "repertoire-map", reportMode: "full" },
    "section-recommendations": { view: "report", target: "repertoire-map", reportMode: "full" },
    "recommended-repertoire": { view: "report", target: "repertoire-map", reportMode: "full" },
    "repertoire-plan": { view: "report", target: "repertoire-map", reportMode: "full" },
    "my-repertoire": { view: "report", target: "repertoire-map", reportMode: "full" },
    "progress-tracker": { view: "profile", target: "profile" },
    "share-report": { view: "profile", target: "report-history" },
    "report-history": { view: "profile", target: "report-history" },
    "top-openings-table": { view: "report", target: "evidence-table", reportMode: "table" },
    "section-top": { view: "report", target: "evidence-table", reportMode: "table" },
    "section-chart": { view: "report", target: "evidence-table", reportMode: "table" },
  };

  const handleAppNavigate = (routeOrKey, options = {}) => {
    const requested =
      typeof routeOrKey === "string"
        ? sectionRouteMap[routeOrKey] || routeOrKey
        : routeOrKey;
    navigateApp(requested, {
      ...options,
      setView: setActiveView,
    });
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

    handleAppNavigate({ ...route, target: targetId });
  };

  const startOpeningPractice = (openingName) => {
    if (!openingName) return;

    setPracticeOpening(openingName);
    scrollToId("opening-practice");
  };

  const practiceOpeningName = practiceOpening ? getOpeningName(practiceOpening) : "";
  const practiceLineFocus = practiceOpening
    ? getOpeningVariationName(practiceOpening) || getOpeningMoveLine(practiceOpening) || practiceOpening?.line || ""
    : "";

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

  const selectImportPlatform = (nextPlatform) => {
    if (!platforms[nextPlatform] || loading) return;
    setPlatform(nextPlatform);
    setError("");
    setImportStatus(null);
    setLoadingStep("");
  };

  const cancelImport = () => {
    if (importAbortRef.current) {
      importAbortRef.current.abort();
    }

    setLoading(false);
    setLoadingStep("");
    setError("");
    setImportStatus({
      tone: "info",
      title: "Import cancelled",
      message: "No changes were made to your current report. You can edit the username or switch platform and try again.",
      meta: "Stopped by you",
    });
  };

  const importGames = async (usernameOverride, platformOverride) => {
    if (loading) return;

    const selectedPlatformKey = platforms[platformOverride] ? platformOverride : platform;
    const cleanUsername = String(usernameOverride ?? username).trim();
    const selectedPlatform = platforms[selectedPlatformKey] || platforms.chesscom;

    if (!cleanUsername) {
      setError("");
      setImportStatus({
        tone: "warning",
        title: "Username needed",
        message: `Enter a ${selectedPlatform.label} username first. OpeningFit only needs the public username, never a password.`,
        meta: selectedPlatform.label,
      });
      return;
    }

    const importSessionKey = `${selectedPlatformKey}:${cleanUsername}:${Date.now()}`;
    const dailySessionStartedKey = `${supabaseUser?.id || cleanUsername || "guest"}:${new Date()
      .toISOString()
      .slice(0, 10)}`;
    const abortController = new AbortController();
    importAbortRef.current = abortController;

    setLoading(true);
    setLoadingStep(
      `Finding your recent ${platforms[selectedPlatformKey]?.label || "chess"} games...`
    );
    setError("");
    setImportStatus({
      tone: "info",
      title: `Importing ${selectedPlatform.label} games`,
      message: `Checking public games for ${cleanUsername}. This can take longer if the backend is waking up.`,
      meta: "Import started",
    });
    setCloudSaveWarning("");
    setCloudSaveStatus("");
    setSavedProfileMessage("");
    setSelectedGameIndex(0);
    setPracticeOpening(null);
    setOpenSections(closedSections);

    try {
      localStorage.setItem(USERNAME_KEY, cleanUsername);
      localStorage.setItem(PLATFORM_KEY, selectedPlatformKey);
      localStorage.setItem(IMPORT_MONTHS_KEY, String(monthsToImport));
      localStorage.setItem(ANALYSIS_TIME_FORMAT_KEY, normalizeAnalysisTimeFormat(analysisTimeFormat));
      setUsername(cleanUsername);
      setPlatform(selectedPlatformKey);

      logRetentionEvent(
        "session_started",
        {
          source: "import",
          username: cleanUsername,
          platform: selectedPlatformKey,
          months: monthsToImport,
          analysisTimeFormat: normalizeAnalysisTimeFormat(analysisTimeFormat),
        },
        { dedupeKey: dailySessionStartedKey }
      );

      await trackEvent("frontend_import_started", {
        username: cleanUsername,
        platform: selectedPlatformKey,
        months: monthsToImport,
        openingSamplePercent,
        analysisTimeFormat: normalizeAnalysisTimeFormat(analysisTimeFormat),
        analysisTimeFormatLabel: getAnalysisTimeFormatLabel(analysisTimeFormat),
        premiumPreview: isPremiumPreview,
        hasPremiumAccess: isPremium,
      });

      setLoadingStep(
        isPremium
          ? `Fetching up to 12 months of ${selectedPlatform.label} games...`
          : `Fetching your recent ${selectedPlatform.label} games...`
      );

      const res = await fetch(
        `${API_BASE}/api/import/${selectedPlatform.apiPath}/${encodeURIComponent(
          cleanUsername
        )}?months=${monthsToImport}`,
        { signal: abortController.signal }
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

      setLoadingStep("Detecting openings...");
      await new Promise((resolve) => setTimeout(resolve, 250));

      setLoadingStep("Building style profile...");
      await new Promise((resolve) => setTimeout(resolve, 250));

      const normalizedImportData = normaliseData(json);
      const cleanData = {
        ...normalizedImportData,
        username: normalizedImportData.username || normalizedImportData.playerName || cleanUsername,
        importPlatform: normalizedImportData.importPlatform || selectedPlatformKey,
        import_platform: normalizedImportData.import_platform || selectedPlatformKey,
        platform: normalizedImportData.platform || selectedPlatformKey,
      };
      const importOutcome = buildImportOutcome(cleanData, selectedPlatform.label);

      if (!getImportedGameCount(cleanData)) {
        setError("");
        setImportStatus(importOutcome);
        setLoadingStep("No public games found.");
        await trackEvent("frontend_import_no_games", {
          username: cleanUsername,
          platform: selectedPlatformKey,
          months: monthsToImport,
        });
        return;
      }

      setLoadingStep("Comparing openings...");
      await new Promise((resolve) => setTimeout(resolve, 180));
      const reportRetentionKey = buildReportRetentionKey(cleanData, {
        username: cleanUsername,
        platform: selectedPlatformKey,
        games: cleanData.gamesImported ?? cleanData.total_games,
      });
      const userReportRetentionKey = `${supabaseUser?.id || "guest"}:${reportRetentionKey}`;

      setData(cleanData);
      setImportStatus(importOutcome);
      saveLocalAnalysis(cleanData, cleanUsername, selectedPlatformKey);

      logRetentionEvent(
        "data_imported",
        {
          username: cleanData.username || cleanUsername,
          platform: selectedPlatformKey,
          games: cleanData.gamesImported ?? cleanData.total_games,
          analysisTimeFormat: cleanData.analysisTimeFormat,
          detectedTimeFormat: cleanData.detectedTimeFormat,
        },
        { dedupeKey: userReportRetentionKey }
      );

      logRetentionEvent(
        "report_generated",
        {
          username: cleanData.username || cleanUsername,
          platform: selectedPlatformKey,
          games: cleanData.gamesImported ?? cleanData.total_games,
          analysisTimeFormat: cleanData.analysisTimeFormat,
          detectedTimeFormat: cleanData.detectedTimeFormat,
        },
        { dedupeKey: userReportRetentionKey }
      );

      logRetentionEvent(
        "session_completed",
        {
          source: "import",
          username: cleanData.username || cleanUsername,
          platform: selectedPlatformKey,
          analysisTimeFormat: cleanData.analysisTimeFormat,
          detectedTimeFormat: cleanData.detectedTimeFormat,
        },
        { dedupeKey: importSessionKey }
      );

      if (supabaseUser?.id) {
        try {
          setCloudSaveStatus("saving");
          setLoadingStep("Generating recommendations...");
          const importFitData = buildOpeningFitData(cleanData);
          const reportSummary = buildReportHistorySummary(cleanData, importFitData);
          const progressSnapshot = buildOpeningFitProgressSnapshot(
            cleanData,
            importFitData,
            cloudReportHistory || []
          );
          const recommendationSnapshot = buildRecommendationHistorySnapshot(cleanData, importFitData);
          const openingGamification = buildOpeningGamificationSnapshot(cleanData, importFitData);
          reportSummary.openingFitProgress = progressSnapshot;
          reportSummary.openingGamification = openingGamification;

          await saveCloudReport(cleanData, reportSummary);
          await saveOpeningFitProgressState(cleanData, reportSummary, progressSnapshot);
          const weeklyOpeningReport = buildWeeklyOpeningSnapshot(cleanData, openingFitUserState?.[0]?.coach_progress?.weeklyOpeningSnapshots || []);
          await saveRecommendationHistory?.(recommendationSnapshot);
          await recordCloudActivity("report_imported", {
            username: cleanData.username || cleanUsername,
            platform: selectedPlatformKey,
            games: cleanData.gamesImported ?? cleanData.total_games,
            analysis_time_format: cleanData.analysisTimeFormat,
            detected_time_format: cleanData.detectedTimeFormat,
            openingfit_progress: progressSnapshot,
            opening_health: progressSnapshot.openingHealth || reportSummary.openingHealth,
            weak_lines: progressSnapshot.weakLines || reportSummary.weakLines,
            weekly_opening_report: weeklyOpeningReport,
            opening_gamification: openingGamification,
            recommendation_snapshot: recommendationSnapshot,
            dedupe_key: `report_imported:${userReportRetentionKey}`,
          });
          await refreshUserData?.(supabaseUser);
          setCloudSaveStatus("saved");
        } catch (cloudError) {
          console.warn("Could not save imported report to Supabase", cloudError);
          setCloudSaveStatus("failed");
          setCloudSaveWarning(
            "We analysed your games, but could not save your results. Your report is kept locally."
          );
        }
      } else {
        setCloudSaveStatus("local");
      }

      setLoadingStep("Preparing results...");

      rememberLandingSeen({ keepPublicLanding: false });
      setActiveView("report");
      if (window.location.pathname !== "/report") {
        window.history.pushState({}, "", "/report");
      }

      setSavedProfileMessage(
        `${importOutcome.title}. Saved ${supabaseUser?.id ? "to your account" : "locally"} so you can load it next time.`
      );

      await trackEvent("frontend_import_completed", {
        username: cleanUsername,
        platform: selectedPlatformKey,
        gamesImported: cleanData.gamesImported ?? cleanData.total_games,
        months: monthsToImport,
        openingSamplePercent,
        analysisTimeFormat: cleanData.analysisTimeFormat,
        detectedTimeFormat: cleanData.detectedTimeFormat,
      });

      scrollToResults();
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("");
        setImportStatus({
          tone: "info",
          title: "Import cancelled",
          message: "No changes were made to your current report. You can adjust the username or platform and try again.",
          meta: "Stopped by you",
        });
        return;
      }

      setError(getFriendlyError(err.message, selectedPlatformKey));
      setImportStatus({
        tone: "warning",
        title: "Import did not finish",
        message: `OpeningFit could not create a ${selectedPlatform.label} report for ${cleanUsername}. The message below explains what happened.`,
        meta: selectedPlatform.label,
      });
    } finally {
      if (importAbortRef.current === abortController) {
        importAbortRef.current = null;
      }
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
  }, [reportFilters.timeControl, reportFilters.dateRange, reportFilters.openingQuery]);

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

  const featuredTrainOpening = useMemo(() => {
    const planOpening = personalTrainingPlan.find((item) => item.opening)?.opening;
    const candidates = [
      planOpening,
      fitData.bestOpening ? getOpeningName(fitData.bestOpening) : null,
      filteredPreferredWhite?.[0]?.name,
      filteredPreferredBlack?.[0]?.name,
      filteredTopOpenings?.[0] ? getOpeningName(filteredTopOpenings[0]) : null,
      filteredRecentGames?.[0]?.opening,
    ].filter((name) => name && !isUnknownOpeningName(name));

    return (
      candidates.find((name) => findOpeningPracticePack(name)) ||
      candidates[0] ||
      "Italian Game"
    );
  }, [
    personalTrainingPlan,
    fitData.bestOpening,
    filteredPreferredWhite,
    filteredPreferredBlack,
    filteredTopOpenings,
    filteredRecentGames,
  ]);

  const selectedGame = filteredRecentGames?.[selectedGameIndex] || null;

  const selectedReplayGame = useMemo(() => {
    if (!selectedGame) return null;

    let parsedMoves = Array.isArray(selectedGame.moves) && selectedGame.moves.length
      ? selectedGame.moves
      : null;

    if (!parsedMoves) {
      const pgn = selectedGame.pgn || selectedGame.PGN || selectedGame.rawPgn || "";
      const cacheKey = selectedGame.url || pgn;

      if (cacheKey && parsedPgnMovesCacheRef.current.has(cacheKey)) {
        parsedMoves = parsedPgnMovesCacheRef.current.get(cacheKey);
      } else {
        parsedMoves = getMovesFromPgn(pgn);

        if (cacheKey) {
          parsedPgnMovesCacheRef.current.set(cacheKey, parsedMoves);
        }
      }
    }

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
  const currentAnalysisPlatformLabel = platforms[platform]?.label || "your chess platform";
  const latestCloudReport = getLatestCloudReport(cloudReportHistory);

  const loadLatestCloudReport = () => {
    if (latestCloudReport?.report) {
      setData(latestCloudReport.report);
      return latestCloudReport.report;
    }

    return null;
  };

  const goToAnalyseImport = () => {
    handleAppNavigate("analyse");
  };

  const goToReturnUserRepertoire = () => {
    loadLatestCloudReport();
    handleAppNavigate("recommendations");
  };

  const goToReturnUserWeaknesses = () => {
    loadLatestCloudReport();
    handleAppNavigate("weakspots");
  };

  const goToReturnUserStudyPlan = () => {
    loadLatestCloudReport();
    handleAppNavigate({ view: "train", path: "/train", target: "study-planner" });
  };

  const goToReturnUserProfileSection = (targetId = "profile") => {
    loadLatestCloudReport();
    handleAppNavigate({ view: "profile", path: "/account", target: targetId, fallbackIds: ["profile"] });
  };


  useEffect(() => {
    if (hasReport) {
      try {
        localStorage.setItem("openingFit:landingSeen", "true");
      } catch {
        // Ignore storage failures.
      }
    }
  }, [hasReport]);

  const currentPath = getCurrentPath();
  const openingSlug = getOpeningSeoSlugFromPath(currentPath);
  const openingSeoPage = openingSlug ? getOpeningSeoPage(openingSlug) : null;
  const isOpeningHub = currentPath === "/openings";
  const isUnknownOpeningPath = Boolean(openingSlug && !openingSeoPage);
  const seoPage = SEO_PAGES[currentPath] || null;
  const seoData = useMemo(() => {
    if (isOpeningHub) {
      return {
        title: "Chess Opening Guides | OpeningFit",
        description:
          "Explore chess opening guides and discover which openings fit your playing style, from the London System and Caro-Kann to the King's Indian Defence.",
        path: "/openings",
        url: `${SITE_URL}/openings`,
      };
    }

    if (openingSeoPage) {
      return {
        title: openingSeoPage.seoTitle,
        description: openingSeoPage.seoDescription,
        path: `/openings/${openingSeoPage.slug}`,
        url: `${SITE_URL}/openings/${openingSeoPage.slug}`,
      };
    }

    if (isUnknownOpeningPath) {
      return {
        title: "Opening guide not found | OpeningFit",
        description: "This OpeningFit chess opening guide has not been published yet.",
        path: currentPath,
        url: `${SITE_URL}/openings`,
      };
    }

    return getSeoData(currentPath);
  }, [currentPath, isOpeningHub, isUnknownOpeningPath, openingSeoPage]);
  const shouldNoindex = isPrivateSeoPath(currentPath) || isUnknownOpeningPath || (currentPath === "/" && hasReport);
  const canonicalUrl = isUnknownOpeningPath ? `${SITE_URL}/openings` : shouldNoindex ? `${SITE_URL}/` : seoData.url;

  useEffect(() => {
    document.title = seoData.title;
    setCanonical(canonicalUrl);
    setMetaAttribute('meta[name="description"]', {
      name: "description",
      content: seoData.description,
    });
    setMetaAttribute('meta[name="robots"]', {
      name: "robots",
      content: shouldNoindex ? "noindex, nofollow" : "index, follow",
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
      content: canonicalUrl,
    });
    setMetaAttribute('meta[property="og:type"]', {
      property: "og:type",
      content: openingSeoPage ? "article" : "website",
    });
    setMetaAttribute('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: "OpeningFit",
    });
    setMetaAttribute('meta[property="og:image"]', {
      property: "og:image",
      content: DEFAULT_SHARE_IMAGE,
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
      content: canonicalUrl,
    });
    setMetaAttribute('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: DEFAULT_SHARE_IMAGE,
    });
    setMetaAttribute('meta[name="theme-color"]', {
      name: "theme-color",
      content: "#020617",
    });

    const existingJsonLd = document.getElementById("seo-route-jsonld");
    if (existingJsonLd) existingJsonLd.remove();

    const jsonLd = openingSeoPage ? getOpeningPageJsonLd(openingSeoPage) : getSeoJsonLd(seoData);
    if (jsonLd && !shouldNoindex) {
      const script = document.createElement("script");
      script.id = "seo-route-jsonld";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [canonicalUrl, currentPath, openingSeoPage, seoData, shouldNoindex]);

  useEffect(() => {
    const openAccountPage = () => {
      openLoginPage();
    };

    window.addEventListener("openingfit:open-account-payment", openAccountPage);

    return () => {
      window.removeEventListener("openingfit:open-account-payment", openAccountPage);
    };
  }, [openLoginPage]);

  useEffect(() => {
    const syncViewFromPath = () => {
      setActiveView(getInitialAppView());
    };

    window.addEventListener("popstate", syncViewFromPath);

    return () => {
      window.removeEventListener("popstate", syncViewFromPath);
    };
  }, []);

  if (isOpeningHub) {
    return <OpeningHubPage ThemeToggle={ThemeToggle} Analytics={Analytics} />;
  }

  if (openingSeoPage) {
    return <OpeningLandingPage opening={openingSeoPage} ThemeToggle={ThemeToggle} Analytics={Analytics} />;
  }

  if (isUnknownOpeningPath) {
    return <OpeningNotFoundPage slug={openingSlug} ThemeToggle={ThemeToggle} Analytics={Analytics} />;
  }

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
          accountUser={accountUser}
          onNavigate={handleAppNavigate}
          onExampleReport={loadDemoReport}
          onLogin={openLoginPage}
          onPricing={openPricingPage}
          theme={theme}
          onThemeToggle={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
        />
        <AccountSyncStatusBar
          user={supabaseUser || accountUser}
          isSupabaseConfigured={isSupabaseConfigured}
          authLoading={authLoading}
          profileLoading={profileLoading}
          authHydrated={authHydrated}
          hasPremiumAccess={isPremium}
          syncStatus={syncStatus || cloudSaveStatus}
          lastSavedAt={lastSavedAt}
          syncError={syncError || cloudSaveWarning}
          onAccount={syncStatus === "error" || cloudSaveStatus === "failed" ? retryAccountSync : openLoginPage}
          onSignOut={handleAccountSignOut}
        />
        <AppActionRouter onViewChange={setActiveView} />
        <MobileBottomNav
          activeView={activeView}
          hasReport={Boolean(reportData)}
          onNavigate={handleAppNavigate}
        />

        {data ? (
          <>
            <OpeningFitImportDoctor username={username} />

          </>
        ) : null}

        <FounderPassLoginUpgrade accountUser={accountUser} />

        <CheckoutStatusNotice
          onRestoreAccess={async () => {
            if (!supabaseUser?.id) {
              openLoginPage();
              return;
            }

            try {
              await refreshUserData?.(supabaseUser);
            } catch (error) {
              console.error("OpeningFit premium access refresh failed after checkout", error);
            }
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
        />

        {false ? <FloatingAppMenu
          data={data}
          activeView={activeView}
          onNavigate={handleAppNavigate}
        /> : null}

        {loading ? (
          <ImportLoadingOverlay
            platform={currentAnalysisPlatformLabel}
            username={username}
            mode="analysis"
            loadingStep={loadingStep}
            elapsedSeconds={loadingElapsedSeconds}
            showWakeupMessage={loadingElapsedSeconds >= 15}
            onCancel={cancelImport}
          />
        ) : null}

        <main className="container appShell" id="app-dashboard">
          {activeAppSection === "analyse" ? (
          <>
          <header className="hero heroCard compactImportHero analyseImportHero" aria-busy={loading}>
            <div className="heroTop">
              <div className="heroTitleWrap">
                <p className="eyebrow">Chess opening analysis app</p>
                <h1>Find the openings that actually fit your games</h1>
                <p className="subtext">
                  Turn your Chess.com or Lichess history into a clear repertoire decision:
                  what to keep, what to repair, and what to train next.
                </p>
                <div className="landingHeroProof" aria-label="OpeningFit trust summary">
                  <span>Chess.com</span>
                  <span>Lichess</span>
                  <span>One recommended action</span>
                </div>
              </div>
              <div className="analyseHeroVisual" aria-hidden="true">
                <div className="analyseHeroGlowBadge analyseHeroGlowBadgeFit">
                  <span>Fit</span>
                  <strong>72</strong>
                </div>
                <div className="analyseHeroGlowBadge analyseHeroGlowBadgeLive">
                  Live report
                </div>
                <div className="analyseHeroVisualTop">
                  <span>Live report preview</span>
                  <strong>Report for @clubplayer</strong>
                </div>
                <div className="analyseHeroPlatformRow">
                  <span>Chess.com import</span>
                  <span>Lichess ready</span>
                  <span>12 recent games</span>
                </div>
                <div className="analyseHeroPreviewHeader">
                  <div>
                    <span>Opening Fit Score</span>
                    <strong>72</strong>
                  </div>
                  <small>Analysed from Chess.com</small>
                </div>
                <div className="analyseHeroRecommendation">
                  <span>Top recommendation</span>
                  <strong>Keep the Caro-Kann</strong>
                  <small>Best recent fit as Black vs e4</small>
                </div>
                <div className="analyseHeroVerdictGrid">
                  <div className="analyseHeroVerdictKeep">
                    <span>Keep</span>
                    <strong>Caro-Kann</strong>
                    <small>61% score</small>
                  </div>
                  <div className="analyseHeroVerdictImprove">
                    <span>Improve</span>
                    <strong>London</strong>
                    <small>3 weak lines</small>
                  </div>
                  <div className="analyseHeroVerdictAvoid">
                    <span>Avoid</span>
                    <strong>Early queen</strong>
                    <small>Low sample fit</small>
                  </div>
                </div>
                <div className="analyseHeroPreviewBars">
                  <span style={{ "--bar-width": "78%" }}>Opening reliability</span>
                  <span style={{ "--bar-width": "54%" }}>Tactical conversion</span>
                  <span style={{ "--bar-width": "38%" }}>Early queen safety</span>
                </div>
                <div className="analyseHeroMoveStrip">
                  <span>1. e4 c6</span>
                  <span>2. d4 d5</span>
                  <strong>Advance line</strong>
                </div>
                <div className="analyseHeroAction">
                  <span>Recommended action</span>
                  <strong>Practise the Advance line</strong>
                </div>
              </div>
              <a
                className="analyseLoginButton"
                href={accountUser ? "/account" : "/login"}
                onClick={openLoginPage}
              >
                {accountUser ? "Account" : "Login"}
              </a>
            </div>

            <div className="searchRow topBar appActionPanel heroImportFlow" id="import">
              <div className="heroImportHeader">
                <div>
                  <span>Start with your username</span>
                  <strong>Analyse recent games from your own account</strong>
                </div>
                <small>Chess.com or Lichess</small>
              </div>

              <div className="platformSelector">
                <button
                  type="button"
                  className={`platformButton ${
                    platform === "chesscom" ? "platformButtonActive" : ""
                  }`}
                  onClick={() => selectImportPlatform("chesscom")}
                  disabled={loading}
                >
                  Chess.com
                </button>

                <button
                  type="button"
                  className={`platformButton ${
                    platform === "lichess" ? "platformButtonActive" : ""
                  }`}
                  onClick={() => selectImportPlatform("lichess")}
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
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError("");
                    if (importStatus) setImportStatus(null);
                  }}
                  disabled={loading}
                  placeholder={
                    platforms[platform]?.usernamePlaceholder || "Chess username"
                  }
                />
                <small className="heroUsernameHelp">
                  Enter a public username. OpeningFit imports recent games and returns a single next step.
                </small>
              </label>

              <div className="appActionButtons">
                <button
                  className="primaryBtn"
                  type="button"
                  onClick={() => importGames()}
                  disabled={loading}
                >
                  {loading ? `Analysing ${platforms[platform]?.label || "games"}...` : "Analyse username"}
                </button>
              </div>

              <details className="landingAdvancedOptions">
                <summary>Analysis options</summary>
                <div className="landingAdvancedGrid">
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
                      6 months {isPremium ? "" : "- Premium"}
                    </option>
                    <option value={12} disabled={!isPremium}>
                      12 months {isPremium ? "" : "- Premium"}
                    </option>
                  </select>

                  <fieldset className="analysisTimeFormatSelector">
                    <legend>Time format</legend>
                    <div className="analysisTimeFormatGrid">
                      {ANALYSIS_TIME_FORMAT_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          className={`analysisTimeFormatButton ${
                            analysisTimeFormat === option.key ? "analysisTimeFormatButtonActive" : ""
                          }`}
                          type="button"
                          onClick={() => setAnalysisTimeFormat(option.key)}
                          disabled={loading}
                          aria-pressed={analysisTimeFormat === option.key}
                        >
                          <strong>{option.label}</strong>
                          <span>{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </details>
            </div>

            <div className="compactTrustRow">
              <span>Result: opening verdicts, confidence, and one study focus</span>
              <button
                className="inlineSampleButton"
                type="button"
                onClick={loadDemoReport}
                disabled={loading}
              >
                View sample report
              </button>
            </div>

            {apiStatus === "offline" ? (
              <p className="statusMessage">
                Live import is temporarily unavailable. You can still view the sample report.
              </p>
            ) : null}

          </header>
          <section className="landingStorySection landingProblemSection" id="opening-choice-app">
            <div className="landingQuestionBlock">
              <p className="landingEyebrow">Chess opening analysis</p>
              <h2>Stop Guessing Which Openings To Play</h2>
              <p>
                Most players pick openings from YouTube or grandmaster games. OpeningFit looks at your own games and helps you choose openings that actually fit how you play.
              </p>
              <p>
                Use it for chess opening analysis, chess opening recommendations, and a chess repertoire builder workflow: analyse Chess.com games, analyse Lichess games, then shape an opening repertoire around personalised chess openings.
              </p>
            </div>

            <div className="landingProblemGrid">
              <article className="landingStoryCard">
                <h3>Personalised chess openings</h3>
                <p>
                  Analyse Chess.com games or analyse Lichess games to see which positions already match your strengths.
                </p>
              </article>
              <article className="landingStoryCard">
                <h3>Chess opening recommendations</h3>
                <p>
                  OpeningFit turns your results and weaknesses into practical recommendations instead of generic theory lists.
                </p>
              </article>
              <article className="landingStoryCard">
                <h3>Chess repertoire builder</h3>
                <p>
                  Build an opening repertoire around the lines you understand, then repair the choices that keep costing points.
                </p>
              </article>
            </div>
          </section>
          <div className="preAnalysisSupport">
            <ReturnUserDashboard
              user={supabaseUser || accountUser}
              data={reportData}
              fitData={fitData}
              reportHistory={cloudReportHistory}
              openingFitUserState={openingFitUserState}
              onAnalyse={goToAnalyseImport}
              onViewRepertoire={goToReturnUserRepertoire}
              onImproveRecommendation={goToReturnUserWeaknesses}
              onStudyPlan={goToReturnUserStudyPlan}
              onProgress={() => goToReturnUserProfileSection("openingfit-progress")}
              onHistory={() => goToReturnUserProfileSection("recommendation-history")}
              onSettings={() => goToReturnUserProfileSection("profile-account")}
            />
          </div>
          </>
          ) : null}

          {activeAppSection === "report" && !reportData && !loading ? (
            <section className="card appEmptySection" id="app-results">
              <p className="eyebrow">Report</p>
              <h2>No opening analysis yet</h2>
              <p>Import your recent Chess.com or Lichess games first, then your latest report will live here.</p>
              <button className="primaryBtn" type="button" onClick={() => handleAppNavigate("analyse")}>
                Go to Analyse
              </button>
            </section>
          ) : null}

          {activeAppSection === "train" && !reportData && !loading ? (
            <>
              <TodayTrainingCard
                data={null}
                fitData={fitData}
                onAnalyse={() => handleAppNavigate("analyse")}
                onStartTraining={(recommendation) => startOpeningPractice(recommendation?.trainingTarget || recommendation?.opening)}
              />

              <div id="opening-practice">
                <OpeningPracticeLinesPanel
                  opening="Italian Game"
                  user={supabaseUser || accountUser}
                  data={data || {}}
                  featured
                  showBrowser={false}
                  heading="Practice your recommended line"
                />
              </div>

              <section className="card appEmptySection" id="training-plan">
                <p className="eyebrow">Train</p>
                <h2>No training plan yet</h2>
                <p>Training actions are generated from your current opening report.</p>
                <button className="primaryBtn" type="button" onClick={() => handleAppNavigate("analyse")}>
                  Start an import
                </button>
              </section>
            </>
          ) : null}

          {activeAppSection === "premium" ? (
            <section className="premiumStandalonePage" id="premium">
              {reportData ? (
                <>
                  <PremiumPanel
                    data={reportData}
                    isPremium={isPremium}
                    isPremiumPreview={isPremiumPreview}
                    onUnlockDemo={unlockPremiumDemo}
                    onResetDemo={resetPremiumDemo}
                    onFounderPass={handleFounderPassClick}
                  />

                  <PremiumDashboard
                    data={reportData}
                    username={username}
                    isPremium={isPremium}
                    onFounderPass={handleFounderPassClick}
                    onUnlockDemo={unlockPremiumDemo}
                    onPractice={startOpeningPractice}
                  />

                  <SeriousPremiumStrip />
                </>
              ) : (
                <>
                  <FounderPassProfileCard isPremium={isPremium} onFounderPass={handleFounderPassClick} />
                  <section className="card premiumNoReportCard">
                    <p className="eyebrow">Premium analysis</p>
                    <h2>Unlock the upgrade, then analyse your games.</h2>
                    <p>
                      Founder Pass is built for club players who want saved reports,
                      progress tracking, deeper opening insights, and a premium training plan
                      without theory overload.
                    </p>
                    <button className="secondaryBtn" type="button" onClick={() => handleAppNavigate("analyse")}>
                      Analyse a username
                    </button>
                  </section>
                </>
              )}
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

          {practiceOpening && activeAppSection !== "train" && (
            <div id="opening-practice">
              <OpeningPracticeLinesPanel
                openingName={practiceOpeningName}
                opening={practiceOpening}
                focusLine={practiceLineFocus}
                user={supabaseUser || accountUser}
                data={reportData || data || {}}
                onClose={() => setPracticeOpening(null)}
              />
            </div>
          )}

          {importStatus || (reportData && cloudSaveStatus && !cloudSaveWarning) ? (
            <div className="postImportStatusStack" aria-label="Import status">
              {importStatus ? (
                <div
                  className={`importStatusBox importStatusBox--${importStatus.tone || "info"}`}
                  role={importStatus.tone === "warning" ? "alert" : "status"}
                >
                  <div>
                    <strong>{importStatus.title}</strong>
                    <p>{importStatus.message}</p>
                  </div>
                  {importStatus.meta ? <span>{importStatus.meta}</span> : null}
                </div>
              ) : null}

              {reportData && cloudSaveStatus && !cloudSaveWarning ? (
                <div className="cloudSaveStatusPill" role="status">
                  <div>
                    <strong>
                      {cloudSaveStatus === "saving"
                        ? "Saving report"
                        : cloudSaveStatus === "saved"
                          ? "Report saved"
                          : cloudSaveStatus === "local"
                            ? "Saved locally"
                            : "Save fallback"}
                    </strong>
                    <span>
                      {cloudSaveStatus === "saving"
                        ? "Syncing this report to your account..."
                        : cloudSaveStatus === "saved"
                          ? "Synced to your OpeningFit account."
                          : cloudSaveStatus === "local"
                            ? "Log in to sync this report across devices."
                            : "Cloud save failed, but the report is kept locally."}
                    </span>
                  </div>
                  {cloudSaveStatus === "local" || cloudSaveStatus === "failed" ? (
                    <button type="button" onClick={openLoginPage}>
                      {accountUser ? "Open account" : "Login"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="errorBox analyseErrorBox" role="alert">
              <div>
                <strong>Analysis could not finish</strong>
                <p>{error}</p>
              </div>
              <button
                className="primaryBtn"
                type="button"
                onClick={() => importGames()}
                disabled={loading}
              >
                Try again
              </button>
            </div>
          ) : null}

          {cloudSaveWarning ? (
            <div className="errorBox analyseErrorBox cloudSaveWarningBox" role="status">
              <div>
                <strong>Cloud save needs attention</strong>
                <p>{cloudSaveWarning}</p>
              </div>
              <button
                className="primaryBtn"
                type="button"
                onClick={openLoginPage}
              >
                {accountUser ? "Open account" : "Log in to save"}
              </button>
            </div>
          ) : null}

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
                  activeView={activeView}
                  onPractice={startOpeningPractice}
                  onViewChange={setActiveView}
                  onNavigate={handleAppNavigate}
                  onLoadReport={setData}
                  recentGames={filteredRecentGames}
                  isPremium={isPremium}
                  reportHistory={cloudReportHistory}
                  openingFitUserState={openingFitUserState}
                  reportFilters={reportFilters}
                  onReportFiltersChange={setReportFilters}
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
                      isPremiumPreview={isPremiumPreview}
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

              {activeAppSection === "train" ? (
                <>
                  <TodayTrainingCard
                    data={reportData}
                    fitData={fitData}
                    onAnalyse={() => handleAppNavigate("analyse")}
                    onStartTraining={(recommendation) => startOpeningPractice(recommendation?.trainingTarget || recommendation?.opening)}
                  />

                  <div id="opening-practice">
                    <OpeningPracticeLinesPanel
                      opening={practiceOpening || featuredTrainOpening}
                      focusLine={practiceLineFocus}
                      user={supabaseUser || accountUser}
                      data={reportData || data || {}}
                      onClose={practiceOpening ? () => setPracticeOpening(null) : null}
                      featured
                      showBrowser={Boolean(practiceOpening)}
                      heading={practiceOpening ? "Practice this line" : "Practice your recommended line"}
                    />
                  </div>

                  <OpeningFitRetentionCommandCenter
                    data={reportData}
                    username={username}
                    onPractice={startOpeningPractice}
                  />

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
                      isPremiumPreview={isPremiumPreview}
                      onUnlockDemo={unlockPremiumDemo}
                      onResetDemo={resetPremiumDemo}
                      onFounderPass={handleFounderPassClick}
                    />
                  </div>

                  <PremiumTrustStrip />
                </>
              ) : null}

            </div>
          )}

          {activeAppSection === "profile" && activeView !== "feedback" ? (
            <section className="profileSection" id="profile">
              <OpeningFitProfileDashboard
                data={reportData}
                fitData={fitData}
                accountUser={accountUser}
                username={username}
                platform={platform}
                isPremium={isPremium}
                isPremiumPreview={isPremiumPreview}
                onAnalyse={() => handleAppNavigate("analyse")}
                onOpenReport={() => handleAppNavigate("report")}
                onLoadReport={(report) => {
                  setData(report);
                  handleAppNavigate("report");
                }}
                onFounderPass={handleFounderPassClick}
                onUserChange={setAccountUser}
                reportHistory={cloudReportHistory}
                openingFitUserState={openingFitUserState}
                recommendationHistory={recommendationHistory}
                authLoading={authLoading}
                profileLoading={profileLoading}
                authHydrated={authHydrated}
              />
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
