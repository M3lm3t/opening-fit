import OpeningFitStudyPlanner from "./components/OpeningFitStudyPlanner.jsx";
import OpeningFitRetentionCommandCenter from "./components/OpeningFitRetentionCommandCenter.jsx";
import OpeningFitProgressionDashboard from "./components/OpeningFitProgressionDashboard.jsx";
import OpeningFitRetentionSystems from "./components/OpeningFitRetentionSystems.jsx";
import OpeningFitImportDoctor from "./components/OpeningFitImportDoctor.jsx";
import OpeningFitPolishToast from "./components/OpeningFitPolishToast.jsx";
import "./components/OpeningFitPolish.css";
import "./components/WeakLineDetection.css";
import { Component, createElement, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import "./App.css";
import OpeningScoreInfo from "./components/OpeningScoreInfo";
import RepertoireStudyPlan from "./components/RepertoireStudyPlan";
import ImportLoadingOverlay from "./components/ImportLoadingOverlay";
import GameReplayBoard from "./components/GameReplayBoard";
import TrainingSessionQueue from "./components/TrainingSessionQueue";
import { findOpeningPracticePack } from "./data/openingPracticeLines";
import { normaliseOpeningKey } from "./data/openings";
import ResultsCommandCenter from "./components/ResultsCommandCenter";
import OpeningHealthScore from "./components/OpeningHealthScore";
import OpeningHealthTrends from "./components/OpeningHealthTrends";
import RecurringOpeningHabits from "./components/RecurringOpeningHabits";
import WeeklyOpeningSessionCard from "./components/WeeklyOpeningSessionCard";
import ProgressTracker from "./components/ProgressTracker";
import ShareReport from "./components/ShareReport";
import ReportSnapshot from "./components/ReportSnapshot";
import OpeningCoachPlan from "./components/OpeningCoachPlan";
import OpeningProgressTracker from "./components/OpeningProgressTracker";
import WeeklyOpeningReport, { buildWeeklyOpeningSnapshot } from "./components/WeeklyOpeningReport";
import OpeningGamificationProgress from "./components/OpeningGamificationProgress";
import ContinueTrainingCard from "./components/ContinueTrainingCard";
import DailyMissionCard from "./components/DailyMissionCard";
import ResumeTrainingPrompt from "./components/ResumeTrainingPrompt";
import TodayTrainingCard from "./components/TodayTrainingCard";
import ThisWeekTrainingExperience from "./components/ThisWeekTrainingExperience.jsx";
import PostReportOnboarding, { TRAINING_PREFERENCES_EDIT_EVENT } from "./components/PostReportOnboarding.jsx";
import WeeklyRecap from "./components/WeeklyRecap.jsx";
import OpeningFitVerdict from "./components/OpeningFitVerdict";
import OpeningCoachSummary from "./components/OpeningCoachSummary";
import GameAnalysisCount from "./components/GameAnalysisCount.jsx";
import OpeningJourney from "./components/OpeningJourney";
import OneThingToFixCard from "./components/OneThingToFixCard";
import WhatChangedSinceLastAnalysis from "./components/WhatChangedSinceLastAnalysis";
import "./components/LayoutDensity.css";
import WeeklyOpeningSummaryCompact from "./components/WeeklyOpeningSummary";
import RecommendedOpeningFit from "./components/RecommendedOpeningFit";
import OpeningInsights from "./components/OpeningInsights";
import OpeningEvidenceBlock, { getOpeningConfidence, getOpeningContext, getOpeningSignal } from "./components/OpeningEvidence";
import RecommendationReasonHint from "./components/RecommendationReasonHint";
import FounderPassLoginUpgrade from "./components/FounderPassLoginUpgrade";
import CheckoutStatusNotice from "./components/CheckoutStatusNotice";
import { startPremiumCheckout, syncPremiumCheckoutSession } from "./accountApi";
const Analytics = null;
import OpeningDetailsModal from "./components/OpeningDetailsModal";
import OpeningSnapshot from "./components/OpeningSnapshot";
import {
  MonthlyRecapCard,
  OpeningMilestones,
  OpeningProgressTimeline,
  OpeningScoreBreakdown,
} from "./components/OpeningScoreProgress";
import DailyOpeningHabit from "./components/DailyOpeningHabit";
import { useAuth } from "./context/AuthDataProvider";
import { getAppSection, HOME_NAVIGATION, navigateApp, scrollToAppTarget } from "./appNavigation";


import { CoachSummaryCard, SeriousAppTabs, NextBestActions } from "./components/SeriousAppUpgrade";


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
import { buildOpeningVariationOverview } from "./services/variationOverview";
import { buildOpeningGamificationSnapshot } from "./services/openingGamification";
import { buildTrainingRecommendations } from "./services/trainingRecommendations";
import {
  buildWeakestLineTrainingTarget,
  buildWeakestLineTrainingTargetFromLine,
} from "./services/weakestLineTraining";
import {
  SAMPLE_REPORT,
  SAMPLE_REPORT_CTA_SOURCES,
  SAMPLE_REPORT_PATH,
  canPersistReport,
  isSampleReport,
  isSampleReportPath,
  reportForInitialPath,
  sampleReportEntry,
  sampleReportExit,
  sampleAnalyticsContext,
} from "./fixtures/sampleReport.js";
import { buildApiUrl, logApiDiagnostic } from "./lib/apiBase";
import { importGames as importGamesFromApi } from "./lib/importClient";
import {
  IMPORT_STAGES,
  buildImportRequestKey,
  classifyImportFailure,
  runWithControlledRetry,
  validateImportUsername,
} from "./lib/importJourney";
import { buildReportDecisionModel, openingPerspective } from "./lib/reportDecisionModel";
import { adaptReportHistoryRow, buildReportSnapshot } from "./lib/reportSnapshot.js";
import { saveRecommendationFeedback } from "./lib/fitTrustModel";
import { REPERTOIRE_PENDING_KEY } from "./lib/repertoireWorkspace";
import { canUsePremiumPreview } from "./lib/premiumExperience";
import { canUseFeature, featureLimit, OPENINGFIT_FEATURES } from "./lib/premiumEntitlement.js";
import { trackProductEvent } from "./lib/productAnalytics";
import { completedAnalysisJourney, restoredReportJourney } from "./lib/postAnalysisJourney.js";
import { SUPPORT_EMAIL } from "./lib/supportConfig.js";
import OpeningFitDiagnosisFirst from "./components/OpeningFitDiagnosisFirst";
import FounderPassOutcomePanel from "./components/FounderPassOutcomePanel";
import ReportCommandBar from "./components/ReportCommandBar";
import ReportComparisonSection from "./components/ReportComparisonSection.jsx";
import TrainingImpactSection from "./components/TrainingImpactSection.jsx";
import PrimaryReportSummary from "./components/PrimaryReportSummary.jsx";
import FeatureAccessPreview from "./components/FeatureAccessPreview.jsx";
import { selectPreviousReportSnapshot } from "./lib/reportComparisonPresentation.js";
import { primaryComparisonState } from "./lib/primaryReportSummary.js";
import { buildReportGameCounts, reportCountSentence } from "./lib/reportGameCounts.js";
import { accountExperienceState, subscriptionPresentation } from "./lib/accountExperience.js";
import MobileBottomNav from "./components/MobileBottomNav.jsx";
const AccountPanel = lazy(() => import("./components/AccountPanel"));
const OpeningPracticeLinesPanel = lazy(() => import("./components/OpeningPracticeLinesPanel"));
const PremiumPanel = lazy(() => import("./components/PremiumPanel"));
const CoachDashboard = lazy(() => import("./components/CoachDashboard"));
const MyRepertoire = lazy(() => import("./components/MyRepertoire"));
const ReportHistoryVault = lazy(() => import("./components/ReportHistoryVault"));
const RetentionJourneyPage = lazy(() => import("./components/RetentionJourneyPage.jsx"));
import {
  OpeningHubPage,
  OpeningNotFoundPage,
  getOpeningPageJsonLd,
} from "./components/OpeningLandingPage.jsx";
import ChessOpeningSeoPage, {
  ChessOpeningNotFoundPage,
  getChessOpeningPageJsonLd,
} from "./components/ChessOpeningSeoPage.jsx";
import {
  GuideNotFoundPage,
  GuidesHubPage,
  OpeningSeoPage,
  SeoGuidePage,
} from "./components/SeoGuidePages.jsx";
import SeoLandingPage, {
  DEFAULT_SHARE_IMAGE,
  SEO_LINKS,
  SEO_PAGES,
  SITE_URL,
  getSeoData,
  getSeoJsonLd,
} from "./components/SeoLandingPage.jsx";
import PublicTrustPage from "./components/PublicTrustPage";
import { FEEDBACK_CATEGORIES, validateFeedback } from "./lib/trustExperience";
import {
  getOpeningSeoPage,
  getOpeningSeoSlugFromPath,
} from "./data/openingSeoPages.js";
import {
  getChessOpeningSeoPage,
  getChessOpeningSeoSlugFromPath,
} from "./data/chessOpeningSeoPages.js";
import {
  getGuideSeoPageFromPath,
  guideHubPage,
} from "./content/seoPages.js";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleCheck,
  Clock3,
  Database,
  Dumbbell,
  Gamepad2,
  History,
  Layers3,
  ListChecks,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import "./ThemePolish.css";
import "./styles/appShellExperience.css";
import "./styles/reportExperience.css";
import "./styles/productScreensExperience.css";
import "./components/ProductAppShell.css";

const STORAGE_KEY = "openingFit:lastAnalysis";
const USERNAME_KEY = "openingFit:lastUsername";
const PLATFORM_KEY = "openingFit:lastPlatform";
const IMPORT_MONTHS_KEY = "openingFit:lastImportMonths";
const OPENING_SAMPLE_PERCENT_KEY = "openingFit:openingSamplePercent";
const ANALYSIS_TIME_FORMAT_KEY = "openingFit:lastAnalysisTimeFormat";
const OPENING_SCORE_LIMITED_EVIDENCE_GAMES = 10;
const REPORT_FILTERS_KEY = "openingFit:reportFilters";
const AUTH_RETURN_PATH_KEY = "openingFit:authReturnPath";
const ACTIVE_IMPORT_KEY = "openingFit:activeImport";
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

function ChessLoadingMark() {
  return (
    <div className="chessLoadingMark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <img src="/icons/openingfit-icon.svg" alt="" width="40" height="40" />
    </div>
  );
}

function getImportedAccountUsername(report, fallback = "") {
  return (
    report?.username ||
    report?.playerName ||
    report?.player_name ||
    report?.requestedUsername ||
    report?.requested_username ||
    report?.profile?.username ||
    report?.account?.username ||
    fallback ||
    ""
  );
}

function getImportedAccountPlatform(report, fallback = "") {
  const raw =
    report?.platform ||
    report?.importPlatform ||
    report?.import_platform ||
    report?.profile?.platform ||
    report?.account?.platform ||
    fallback ||
    "";
  const value = String(raw).toLowerCase();
  if (value.includes("lichess")) return "lichess";
  if (value.includes("chess.com") || value.includes("chesscom")) return "chesscom";
  return value;
}

function isDemoAnalysis(report) {
  return isSampleReport(report);
}

function getImportedGameCount(report) {
  return buildReportGameCounts(report).imported;
}

function formatGameCount(count) {
  return `${count} game${count === 1 ? "" : "s"}`;
}

function buildImportOutcome(report, platformLabel) {
  const counts = buildReportGameCounts(report);
  const gamesImported = counts.fetchedGames;
  const openingSignals = counts.analysedGames;
  const platformName = platformLabel || "the selected platform";
  const countSentence = reportCountSentence(report);

  if (!gamesImported) {
    return {
      tone: "warning",
      title: "No recent public games found",
      message: "We found the player, but not enough recent games to build a confident report.",
      meta: `${platformName} import`,
    };
  }

  if (!openingSignals) {
    return {
      tone: "warning",
      title: "Games imported, but openings were too thin to classify",
      message: `${countSentence} There is not enough opening information to build strong verdicts yet.`,
      meta: `${counts.excludedGames} not analysed`,
    };
  }

  if (openingSignals < 3 || gamesImported < 5) {
    return {
      tone: "warning",
      title: "Import complete with a light opening sample",
      message: `${countSentence} Your report is ready, but the opening sample is still small, so recommendations are starter signals.`,
      meta: `${counts.excludedGames} not analysed`,
    };
  }

  return {
    tone: "success",
    title: `Imported ${formatGameCount(gamesImported)} from ${platformName}`,
    message: `${countSentence} Your OpeningFit report is ready with a verdict and one training focus.`,
    meta: `${counts.excludedGames} not analysed`,
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

function parseMovesFromText(value) {
  if (Array.isArray(value)) {
    return value.map((move) => String(move || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ")
    .split(/\s+/)
    .map((move) => move.trim())
    .filter(Boolean);
}

function getGameMoveHistory(game = {}) {
  const directMoves =
    game.moves ||
    game.sanMoves ||
    game.san_moves ||
    game.moveHistory ||
    game.move_history;
  const parsedDirect = parseMovesFromText(directMoves);
  if (parsedDirect.length) return parsedDirect;

  const movesText =
    game.movesText ||
    game.moves_text ||
    game.moveText ||
    game.move_text ||
    game.lineMoves ||
    game.line_moves;
  const parsedText = parseMovesFromText(movesText);
  if (parsedText.length) return parsedText;

  const pgnMoves = getMovesFromPgn(game.pgn || game.PGN || game.rawPgn || game.raw_pgn || "");
  if (pgnMoves.length) return pgnMoves;

  return parseMovesFromText(game.pgn || game.PGN || game.rawPgn || game.raw_pgn || "");
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

/* Legacy name-based ownership heuristics intentionally retired.
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

*/
function contextLabel(context = "") {
  return (
    {
      played_as_white: "played as White",
      played_as_black: "played as Black",
      faced_as_white: "faced as White",
      faced_as_black: "faced as Black",
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

function itemContext(item) {
  const perspective = openingPerspective(item || {});
  if (perspective.role === "played_as_white") return "played_as_white";
  if (perspective.role === "played_as_black") return perspective.repertoireSlot || "black_vs_other";
  if (["faced_as_white", "faced_as_black"].includes(perspective.role)) return perspective.role;

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

  if (BLACK_REPERTOIRE_CONTEXTS.has(context)) {
    return normalizeBlackRepertoireContext(context, item);
  }

  return "unknown_mixed";
}

function contextIsCompatible(_name, context, item = {}) {
  const perspective = openingPerspective(item);
  if (context === "played_as_white") return perspective.role === "played_as_white";
  if (BLACK_REPERTOIRE_CONTEXTS.has(context)) return perspective.role === "played_as_black";
  return ["faced_as_white", "faced_as_black"].includes(context) && perspective.role === context;
}

function normalizeRecommendationItem(item, fallbackContext = "unknown_mixed") {
  const source = typeof item === "string" ? { name: item } : item || {};
  const name = getOpeningName(source);
  const context = itemContext(source, fallbackContext);
  const compatible = contextIsCompatible(name, context, source);
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
      const perspective = openingPerspective(item);

      if (!contextIsCompatible(name, section.context, item)) return false;
      if (explicitContext === section.context) return true;

      if (section.context === "played_as_white") return perspective.role === "played_as_white";
      if (section.context === "black_vs_e4") {
        return perspective.role === "played_as_black" && bucket === "black_vs_e4";
      }
      if (section.context === "black_vs_d4") {
        return perspective.role === "played_as_black" && bucket === "black_vs_d4";
      }
      return perspective.role === "played_as_black" && bucket === "black_vs_other";
    });
  };

  return REPERTOIRE_SECTION_ORDER.map((section) => {
    const uncertainItems = findSectionItems("too_little_data").filter((item) => {
      const context = itemContext(item);
      const perspective = openingPerspective(item);

      if (context === section.context) return true;
      if (section.context === "played_as_white") return perspective.role === "played_as_white";
      if (section.context === "black_vs_e4") {
        return perspective.role === "played_as_black" && firstMoveBucketForOpening(item) === "black_vs_e4";
      }
      if (section.context === "black_vs_d4") {
        return perspective.role === "played_as_black" && firstMoveBucketForOpening(item) === "black_vs_d4";
      }
      return perspective.role === "played_as_black" && firstMoveBucketForOpening(item) === "black_vs_other";
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
function publicAccountCaution(data) {
  return data?.publicAccountCaution || data?.public_account_caution || PUBLIC_ACCOUNT_CAUTION_COPY;
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

function getOpeningScoreEvidenceLabel(opening) {
  const games = getOpeningGames(opening);
  if (games <= 0) return "Limited evidence";
  if (games < OPENING_SCORE_LIMITED_EVIDENCE_GAMES) return "Early estimate";
  return "";
}

function getOpeningFitScoreReason(opening) {
  if (!opening || typeof opening === "string") {
    return "OpeningFit needs more repeated games before it can explain this score clearly.";
  }

  const games = getOpeningGames(opening);
  const winRate = getWinRate(opening);
  const losses = getOpeningLosses(opening);
  const lossRate = games ? Math.round((losses / games) * 100) : null;
  const confidence = getOpeningConfidence(opening);
  const reasonText = [
    opening.fitConfidenceReason,
    opening.fitExplanation,
    opening.fitReasonBullets?.join(" "),
    opening.evidenceBullets?.join(" "),
    opening.evidence?.join(" "),
    opening.lossTimingNote,
    opening.loss_timing_note,
    opening.moveOrderNote,
    opening.move_order_note,
    opening.planClarityNote,
    opening.plan_clarity_note,
    opening.fixabilityExplanation,
    opening.fixability_explanation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (games > 0 && games < OPENING_SCORE_LIMITED_EVIDENCE_GAMES && winRate >= 55) {
    return "Strong results, but too few games for high confidence.";
  }

  if (games > 0 && games < OPENING_SCORE_LIMITED_EVIDENCE_GAMES) {
    return "Early estimate from a small sample. Use it as a watch signal, not a verdict.";
  }

  if (/opening|early|move.?order|mistake|loss/.test(reasonText) && lossRate !== null && lossRate >= 40) {
    return "The score is lower mainly because of recurring early difficulty, not because the opening is bad.";
  }

  if (/variation|line|branch/.test(reasonText) && lossRate !== null && lossRate >= 35) {
    return "Your results drop most often after entering a specific variation.";
  }

  if (games >= OPENING_SCORE_LIMITED_EVIDENCE_GAMES && winRate >= 55 && /plan|familiar|consistent|stable|clarity/.test(reasonText)) {
    return "You play this regularly and usually reach familiar positions.";
  }

  if (games >= OPENING_SCORE_LIMITED_EVIDENCE_GAMES && winRate >= 55) {
    return "Good results across a useful sample make this a reliable current signal.";
  }

  if (games >= OPENING_SCORE_LIMITED_EVIDENCE_GAMES && winRate < 45) {
    return "Less reliable in your recent games; worth revisiting after strengthening the repeated line.";
  }

  return `${confidence}. OpeningFit is weighing results, sample size, consistency, and fit with your current games.`;
}

function getOpeningCoachInsights(data) {
  const insights = data?.openingCoachInsights || data?.opening_coach_insights;
  return insights && typeof insights === "object" ? insights : null;
}

function getOpeningCoachDiagnostics(data) {
  const insights = getOpeningCoachInsights(data);
  return Array.isArray(insights?.openingDiagnostics) ? insights.openingDiagnostics : [];
}

function normaliseCoachOpeningName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findOpeningCoachDiagnostic(data, opening) {
  const name = normaliseCoachOpeningName(getOpeningName(opening));
  if (!name) return null;
  return (
    getOpeningCoachDiagnostics(data).find(
      (item) => normaliseCoachOpeningName(item?.openingName || item?.name) === name
    ) || null
  );
}

function coachInsightConfidenceLabel(diagnostic, opening) {
  const direct = diagnostic?.confidence || opening?.confidenceLabel || opening?.confidence_label || opening?.confidence;
  if (!direct) return getOpeningConfidence(opening);
  return String(direct).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function coachIssueLabel(issueType) {
  if (issueType === "opening") return "Opening issue";
  if (issueType === "transition") return "Transition issue";
  if (issueType === "middlegame") return "Later-game issue";
  if (issueType === "mixed") return "Mixed issue";
  if (issueType === "insufficient_data") return "Still gathering evidence";
  return "Report signal";
}

function coachVerdictLabel(status, diagnostic = null) {
  const verdict = String(diagnostic?.verdict || status || "").toLowerCase();
  if (verdict.includes("avoid") || verdict.includes("park")) return "Park for now";
  if (verdict.includes("keep")) return "Keep";
  if (verdict.includes("improve") || verdict.includes("repair")) return "Improve";
  if (verdict.includes("watch") || verdict.includes("not enough")) return "Watch";
  return status || "Review";
}

function coachWhyText(opening, data, status, diagnostic = null) {
  if (diagnostic?.explanation) return diagnostic.explanation;
  const supportive = getSupportiveOpeningContext(opening, status);
  const reason = getOpeningFitScoreReason(opening);
  return `${supportive} ${reason}`;
}

function coachNextAction(opening, status, diagnostic = null) {
  return (
    diagnostic?.recommendation ||
    diagnostic?.recurringIssue?.practicePrompt ||
    opening?.suggestedTrainingAction ||
    opening?.suggested_training_action ||
    getOpeningCardAction(opening) ||
    getSupportiveOpeningContext(opening, status)
  );
}

function OpeningScoreInfoButton({ opening = null, score = null, nextStep = "", className = "" }) {
  return (
    <OpeningScoreInfo
      opening={opening || {}}
      score={score}
      nextStep={nextStep}
      className={className}
      label="How this opening score works"
    />
  );
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
          ? "This recent online sample is too small for a firm opening call. It may be an experiment, a content game, or a one-off opponent-specific choice."
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
      const baseSmartVerdict = getSmartOpeningVerdict(opening, data, rank);
      const variationOverview = buildOpeningVariationOverview(data, opening);
      const smartVerdict =
        variationOverview.status === "generally_solid_branch_weakness" && baseSmartVerdict.category !== "keep"
          ? {
              ...baseSmartVerdict,
              label: "Generally solid",
              category: "review",
              tone: "warning",
              severity: "warning",
              message: variationOverview.summary,
            }
          : baseSmartVerdict;
      const signal = getOpeningSignal(opening);
      const fitReasonBullets = getOpeningFitReasonBullets(opening, data, smartVerdict, playerStyle);
      const fitScore =
        signal.tier === "low" || signal.tier === "none"
          ? Math.min(score, 54)
          : smartVerdict.label === "Main weapon" ||
              smartVerdict.label === "Reliable choice"
            ? Math.max(score, signal.tier === "strong" ? 78 : 68)
            : smartVerdict.category === "review"
              ? variationOverview.status === "generally_solid_branch_weakness"
                ? Math.max(score, 56)
                : Math.max(score, 58)
              : score;
      const variationReason =
        variationOverview.status === "needs_more_evidence"
          ? null
          : variationOverview.displayStatus;

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
        fitReasonBullets: variationReason
          ? [variationReason, ...fitReasonBullets.filter((item) => item !== variationReason)].slice(0, 4)
          : fitReasonBullets,
        fitSignalTier: signal.tier,
        fitSignalExplanation: signal.explanation,
        fitSampleTier: getOpeningSampleTier(getOpeningGames(opening)),
        variationOverview,
        variationStatus: variationOverview.displayStatus,
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
      <div className="emptyStateIcon" aria-hidden="true"><Search size={19} /></div>
      <div>
        <span className="emptyStateLabel"><Sparkles size={13} /> Next best action</span>
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
        <span className="premiumBadge">OpeningFit Plus</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <span className="lockIcon" aria-hidden="true"><LockKeyhole size={18} /></span>
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
  const overallScoreInfo = {
    name: "OpeningFit Score",
    games: scoredOpenings.reduce((total, opening) => total + getOpeningGames(opening), 0),
    fitScore: overallScore,
    confidence: scoredOpenings.length ? "Report-level estimate" : "Limited confidence",
    nextAction: recommendedAction,
  };

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

        <div className="fitScoreCircle fitScoreCircleWithInfo">
          <OpeningScoreInfoButton opening={overallScoreInfo} score={overallScore} className="openingScoreInfoButton--circle" />
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

function getSupportiveOpeningContext(opening, status) {
  const games = getOpeningGames(opening);
  const winRate = getWinRate(opening);
  const confidence = getOpeningConfidence(opening);
  const lowerStatus = String(status || "").toLowerCase();
  const reasonText = [
    opening?.recommendationReason,
    opening?.recommendation_reason,
    opening?.fitConfidenceReason,
    opening?.fitExplanation,
    opening?.fitReasonBullets?.[0],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (lowerStatus.includes("avoid")) {
    if (games > 0 && games < 8) {
      return "Pause this as a main study choice until there are more repeated games behind it.";
    }

    if (reasonText.includes("overload") || reasonText.includes("too many")) {
      return "Pause this for now so your repertoire does not spread across too many unrelated lines.";
    }

    if (reasonText.includes("style")) {
      return "This may not match your current style signals as well as the higher-priority options.";
    }

    if (winRate && winRate < 45) {
      return "Treat it as a repair target first because recent results are below your stronger openings.";
    }

    if (String(confidence).toLowerCase().includes("low")) {
      return "This is not a verdict on the opening itself; OpeningFit needs clearer evidence before recommending it.";
    }

    return "Pause it as a priority for now because another opening gives you a clearer next improvement step.";
  }

  if (lowerStatus.includes("improve") || lowerStatus.includes("review")) {
    if (games > 0 && games < 8) {
      return "Useful signal, but the sample is still small. Review one game before making it a major project.";
    }

    return "Keep it in the repertoire, but fix one repeated branch before adding new theory.";
  }

  if (lowerStatus.includes("not enough")) {
    return "There is not enough repeated data yet, so use this as a watch item rather than a training priority.";
  }

  if (lowerStatus.includes("keep")) {
    return "Keep this as a stable anchor and compare weaker lines against it.";
  }

  return "Use this as context for your next training choice.";
}

function OpeningFitScoreList({ data, fitData, onPractice }) {
  if (!fitData || !fitData.scoredOpenings?.length) return null;
  const publicMode = fitData.reportMode !== "normal_user";

  return (
    <section className="card openingFitScoreCard">
      <div className="sectionHeaderSimple">
        <div>
          <p className="eyebrow">Repertoire</p>
          <h2>Your repertoire</h2>
          <p className="muted">
            {publicMode
              ? "Recent online samples only."
              : "Fit labels from your games and style."}
          </p>
        </div>
      </div>

      <div className="fitOpeningList">
        {fitData.scoredOpenings.slice(0, 10).map((opening, index) => {
          const name = getOpeningName(opening);
          const canPractice = canTreatAsRepertoireOpening(opening);
          const status = getOpeningStatusLabel(opening);
          const coachDiagnostic = findOpeningCoachDiagnostic(data, opening);
          const displayStatus = coachVerdictLabel(status, coachDiagnostic);
          const coachOpening = coachDiagnostic
            ? {
                ...opening,
                confidence: coachInsightConfidenceLabel(coachDiagnostic, opening),
                fitScoreBreakdown: coachDiagnostic.scoreBreakdown,
                evidenceBullets: coachDiagnostic.evidence,
                nextAction: coachNextAction(opening, status, coachDiagnostic),
              }
            : opening;
          const action = getOpeningCardAction(opening);
          const games = getOpeningGames(opening);
          const winRate = getWinRate(opening);
          const fitScore = safeNumber(opening.fitScore ?? opening.openingFitScore ?? winRate, 0);
          const evidenceLabel = getOpeningScoreEvidenceLabel(opening);
          const scoreReason = getOpeningFitScoreReason(opening);
          const variationOverview = opening.variationOverview;
          const coachText =
            opening.fitReasonBullets?.[0] ||
            opening.fitConfidenceReason ||
            opening.fitExplanation ||
            getOpeningConfidenceReason(opening);
          const supportiveContext = getSupportiveOpeningContext(opening, status);
          const practiceOpening = () => {
            if (canPractice) onPractice(name);
          };
          const handleRowKeyDown = (event) => {
            if (!canPractice) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              practiceOpening();
            }
          };

          return (
            <article
              className={`fitOpeningRow openingRecommendationCard status-${status.toLowerCase().replace(/\s+/g, "-")}`}
              key={`${name}-${index}`}
              role={canPractice ? "button" : undefined}
              tabIndex={canPractice ? 0 : undefined}
              aria-disabled={!canPractice}
              onClick={practiceOpening}
              onKeyDown={handleRowKeyDown}
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
                        {displayStatus}
                      </span>
                      <span className="openingCoachConfidenceBadge">
                        {coachInsightConfidenceLabel(coachDiagnostic, opening)} confidence
                      </span>
                    </div>
                    <strong>{getOpeningContextTitle(opening, name)}</strong>
                  </div>
                </div>
                <div className="openingFitScorePill">
                  <span>{fitScore ? "Fit" : "Confidence"}</span>
                  <OpeningScoreInfoButton opening={coachOpening} />
                  <strong>{fitScore || getOpeningConfidence(opening)}</strong>
                  {evidenceLabel ? <small>{evidenceLabel}</small> : null}
                </div>
              </div>

              <div className="openingRecommendationMetrics">
                <div>
                  <span>Fit score</span>
                  <strong>{fitScore || "—"}{fitScore ? "/100" : ""}</strong>
                  {evidenceLabel ? <small className="openingScoreEvidenceLabel">{evidenceLabel}</small> : null}
                  <p className="openingScoreReason">{scoreReason}</p>
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
                {displayStatus}. {supportiveContext} {coachText}
              </p>

              <details
                className="openingCoachWhyDetails"
                onClick={(event) => event.stopPropagation()}
              >
                <summary aria-label={`Why ${name} is labelled ${displayStatus}`}>
                  <span>Why?</span>
                  <strong>{coachIssueLabel(coachDiagnostic?.issueType)}</strong>
                </summary>
                <div className="openingCoachWhyBody">
                  <dl>
                    <div>
                      <dt>Games analysed</dt>
                      <dd>{coachDiagnostic?.games || games || "Not enough opening-specific games"}</dd>
                    </div>
                    <div>
                      <dt>Issue type</dt>
                      <dd>{coachIssueLabel(coachDiagnostic?.issueType)}</dd>
                    </div>
                    <div>
                      <dt>Why this verdict</dt>
                      <dd>{coachWhyText(opening, data, status, coachDiagnostic)}</dd>
                    </div>
                    <div>
                      <dt>Next action</dt>
                      <dd>{coachNextAction(opening, status, coachDiagnostic)}</dd>
                    </div>
                  </dl>
                </div>
              </details>

              {variationOverview?.displayStatus ? (
                <div className="variationStatusInline">
                  <span>{variationOverview.displayStatus}</span>
                  {variationOverview.summary ? <p>{variationOverview.summary}</p> : null}
                </div>
              ) : null}

              <FitReasonList opening={opening} />

              <div className="openingRecommendationAction">
                <span>{getOpeningConfidence(opening)}</span>
                <strong>{action}</strong>
              </div>
            </article>
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
  const counts = buildReportGameCounts(data);
  const archives = data?.archivesChecked || data?.archives_checked || [];
  const archiveGames = Array.isArray(archives)
    ? archives.reduce(
        (total, item) =>
          total +
          (numberOrNull(item?.gamesFound ?? item?.games_found ?? item?.games) || 0),
        0
      )
    : 0;
  const gamesAnalysed = counts.analysedGames;
  const gamesFound = counts.fetchedGames || archiveGames || gamesAnalysed;
  const skipped = counts.excludedGames;
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
    return `${games} games had enough opening information to analyse. Strong sample size for a reliable opening report.`;
  }

  if (games >= 50) {
    return `${games} games had enough opening information to analyse. Enough data for a useful opening report.`;
  }

  if (games >= 15) {
    return `Only ${games} games had enough opening information to analyse. Treat this as a light snapshot, not a final repertoire recommendation.`;
  }

  return `Only ${games} game${games === 1 ? "" : "s"} had enough opening information to analyse. Import more games before making repertoire decisions from this report.`;
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
  { key: "all", label: "All Games" },
  { key: "bullet", label: "Bullet" },
  { key: "blitz", label: "Blitz" },
  { key: "rapid", label: "Rapid" },
  { key: "classical", label: "Classical" },
  { key: "daily", label: "Daily" },
  { key: "unknown", label: "Unknown" },
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

const DATE_RANGE_FILTERS = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "180", label: "Last 6 months", days: 180 },
  { key: "365", label: "Last 12 months", days: 365 },
  { key: "all", label: "All Time", days: null },
];

const COLOUR_FILTERS = [
  { key: "all", label: "All" },
  { key: "white", label: "White" },
  { key: "black", label: "Black" },
  { key: "unknown", label: "Unknown" },
];

const DEFAULT_REPORT_FILTERS = {
  timeControl: "all",
  dateRange: "all",
  colour: "all",
  openingQuery: "",
};

function normalizeReportFilters(filters = {}) {
  const timeControl = TIME_CONTROL_FILTERS.some((item) => item.key === filters.timeControl)
    ? filters.timeControl
    : DEFAULT_REPORT_FILTERS.timeControl;
  const dateRange = DATE_RANGE_FILTERS.some((item) => item.key === filters.dateRange)
    ? filters.dateRange
    : DEFAULT_REPORT_FILTERS.dateRange;
  const colour = COLOUR_FILTERS.some((item) => item.key === (filters.colour || filters.color))
    ? filters.colour || filters.color
    : DEFAULT_REPORT_FILTERS.colour;

  return {
    timeControl,
    dateRange,
    colour,
    openingQuery: typeof filters.openingQuery === "string" ? filters.openingQuery : "",
  };
}

function loadStoredReportFilters() {
  if (typeof window === "undefined") return DEFAULT_REPORT_FILTERS;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(REPORT_FILTERS_KEY) || "null");
    return normalizeReportFilters(parsed || DEFAULT_REPORT_FILTERS);
  } catch {
    return DEFAULT_REPORT_FILTERS;
  }
}

function getGameTimeControl(game) {
  return normalizeTimeControl(game);
}

function getPgnHeaderValue(pgnText, headerName) {
  const pattern = new RegExp(`\\[${headerName}\\s+"([^"]+)"\\]`, "i");
  return String(pgnText || "").match(pattern)?.[1] || "";
}

function normalizePgnDateValue(value) {
  const clean = String(value || "").trim();
  if (!clean || clean.includes("?")) return "";
  return clean.replace(/\./g, "-");
}

function playedDateFromPgn(pgnText) {
  const utcDate = normalizePgnDateValue(getPgnHeaderValue(pgnText, "UTCDate"));
  const utcTime = String(getPgnHeaderValue(pgnText, "UTCTime") || "").trim();
  const date = utcDate || normalizePgnDateValue(getPgnHeaderValue(pgnText, "Date"));

  if (!date) return "";
  if (utcTime && !utcTime.includes("?")) return `${date}T${utcTime}Z`;
  return date;
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

function normalizeTimeControl(gameOrValue) {
  if (!gameOrValue || typeof gameOrValue !== "object") {
    return classifyTimeControlValue(gameOrValue) || "unknown";
  }

  const game =
    gameOrValue.game && typeof gameOrValue.game === "object"
      ? { ...gameOrValue.game, ...(gameOrValue.analysis || {}) }
      : gameOrValue;
  const candidates = [
    game.time_control_normalized,
    game.timeControlNormalized,
    game.time_class,
    game.timeClass,
    game.time_control_class,
    game.timeControlClass,
    game.speed,
    game.perf,
    game.perfType,
    game.time_control,
    game.timeControl,
    game.time_control_raw,
    game.timeControlRaw,
    game.rawTimeControl,
  ];

  for (const candidate of candidates) {
    const normalized = classifyTimeControlValue(candidate);
    if (normalized) return normalized;
  }

  return detectTimeControlFromPgn(game.pgn || game.PGN || game.rawPgn || "")?.key || "unknown";
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
  const timeFilter = filters?.timeControl || "all";

  if (timeFilter !== "all" && timeClass !== timeFilter) return false;
  if (!gamePassesColourFilter(game, filters)) return false;
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

function gamePassesColourFilter(game, filters) {
  const colourFilter = filters?.colour || filters?.color || "all";
  if (colourFilter === "all") return true;

  const context = itemContext(game, "unknown_mixed");
  const side = String(
    game?.colour ||
      game?.color ||
      game?.player_color ||
      game?.playerColour ||
      getOpeningSide(game)
  ).toLowerCase();

  if (colourFilter === "unknown") {
    return context === "unknown_mixed" && !side.includes("white") && !side.includes("black");
  }

  if (colourFilter === "white") {
    return context === "played_as_white" || side.includes("white");
  }

  if (colourFilter === "black") {
    return context.startsWith("black") || side.includes("black");
  }

  return true;
}

function normalizeGameColour(game) {
  const side = String(
    game?.colour ||
      game?.color ||
      game?.player_color ||
      game?.playerColour ||
      game?.player_colour ||
      ""
  ).toLowerCase();

  if (side.includes("white")) return "white";
  if (side.includes("black")) return "black";

  const context = itemContext(game, "unknown_mixed");
  if (context === "played_as_white") return "white";
  if (context.startsWith("black")) return "black";

  return "unknown";
}

function unwrapPersistedGameRow(row) {
  if (!row || typeof row !== "object") return row;
  if (!row.game || typeof row.game !== "object") return row;

  const analysis = row.analysis && typeof row.analysis === "object" ? row.analysis : {};
  return {
    ...row.game,
    ...analysis,
    id: row.game.id || row.game.game_id || row.game.gameId || row.game.url || row.game.link || row.game.id || row.id,
    game_id: row.game.game_id || row.game.gameId || row.game.id || row.game.url || row.game.link || row.game_id || row.id,
    gameId: row.game.gameId || row.game.game_id || row.game.id || row.game.url || row.game.link || row.game_id || row.id,
    platform: row.platform || row.game.platform,
    username: row.username || row.game.username,
    updated_at: row.updated_at || row.game.updated_at,
  };
}

function normalizeGameMetadata(game) {
  game = unwrapPersistedGameRow(game);
  if (!game || typeof game !== "object") return game;

  const moves = getGameMoveHistory(game);
  const normalizedTimeControl = normalizeTimeControl(game);
  const rawTimeControl =
    game.time_control_raw ||
    game.timeControlRaw ||
    game.rawTimeControl ||
    game.time_control ||
    game.timeControl ||
    game.time_class ||
    game.timeClass ||
    game.speed ||
    game.perf ||
    "unknown";
  const pgnPlayedAt = playedDateFromPgn(game.pgn || game.PGN || game.rawPgn || "");
  const timestamp = normaliseTimestamp(
    game.end_time ||
      game.endTime ||
      game.played_at ||
      game.playedAt ||
      game.played_date ||
      game.playedDate ||
      game.date ||
      pgnPlayedAt ||
      game.createdAt ||
      game.created_at
  );
  const playedAt =
    game.played_at ||
    game.playedAt ||
    game.played_date ||
    game.playedDate ||
    pgnPlayedAt ||
    (timestamp ? new Date(timestamp).toISOString() : "");
  const colour = normalizeGameColour(game);

  return {
    ...game,
    time_class: normalizedTimeControl,
    timeClass: normalizedTimeControl,
    time_control_normalized: normalizedTimeControl,
    timeControlNormalized: normalizedTimeControl,
    time_control_raw: rawTimeControl,
    timeControlRaw: rawTimeControl,
    moves,
    move_count: safeNumber(game.move_count ?? game.moveCount, Math.ceil(moves.length / 2)),
    moveCount: safeNumber(game.moveCount ?? game.move_count, Math.ceil(moves.length / 2)),
    movesText: game.movesText || game.moves_text || moves.join(" "),
    moves_text: game.moves_text || game.movesText || moves.join(" "),
    played_at: playedAt,
    playedAt,
    played_date: playedAt,
    playedDate: playedAt,
    colour,
    color: colour,
  };
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
        move_line: line.moveLine,
        moves: line.moveLine ? line.moveLine.replace(/\d+\.(\.\.)?/g, " ").split(/\s+/).filter(Boolean) : [],
        line: line.line,
        colour: line.context === "played_as_white" ? "white" : line.context?.startsWith("black") ? "black" : "unknown",
        color: line.context === "played_as_white" ? "white" : line.context?.startsWith("black") ? "black" : "unknown",
        reason: line.flagReason,
        flagReason: line.flagReason,
        weakLine: true,
        source: "weakest-line",
      },
    }))
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      if (b.lossRate !== a.lossRate) return b.lossRate - a.lossRate;
      return a.winRate - b.winRate;
    })
    .slice(0, 12);
}

function buildPerformanceByTimeControl(games, filters) {
  if (!Array.isArray(games) || !games.length) return [];

  const rows = new Map();
  games.forEach((game) => {
    if (!gamePassesColourFilter(game, filters)) return;
    if (!lineMatchesOpeningFilter(game, filters)) return;

    const days = DATE_RANGE_FILTERS.find((item) => item.key === filters?.dateRange)?.days;
    if (days) {
      const timestamp = normaliseTimestamp(
        game?.end_time ||
          game?.endTime ||
          game?.played_at ||
          game?.playedAt ||
          game?.date
      );
      if (timestamp && timestamp < Date.now() - days * 24 * 60 * 60 * 1000) return;
    }

    const key = getGameTimeControl(game) || "unknown";
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        format: TIME_CONTROL_FILTERS.find((item) => item.key === key)?.label || reportTitleCase(key || "Unknown"),
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      });
    }

    const row = rows.get(key);
    const resultStats = gameResultStats(game?.result);
    row.games += 1;
    row.wins += resultStats.wins;
    row.draws += resultStats.draws;
    row.losses += resultStats.losses;
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      winRate: row.games ? Math.round(((row.wins + row.draws * 0.5) / row.games) * 100) : 0,
      win_rate: row.games ? Math.round(((row.wins + row.draws * 0.5) / row.games) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games);
}

function buildFilteredOpeningFitScore(openings, weakLines) {
  const rows = Array.isArray(openings) ? openings.filter((item) => getOpeningGames(item) > 0) : [];
  if (!rows.length) return null;

  const totalGames = rows.reduce((sum, item) => sum + getOpeningGames(item), 0);
  const weightedScore = rows.reduce((sum, item) => sum + getWinRate(item) * getOpeningGames(item), 0) / Math.max(1, totalGames);
  const sampleBonus = Math.min(15, Math.round(Math.log10(Math.max(1, totalGames)) * 8));
  const weakPenalty = Math.min(18, (weakLines?.length || 0) * 4);

  return Math.max(0, Math.min(100, Math.round(weightedScore * 0.82 + sampleBonus - weakPenalty)));
}

function buildFilteredOpeningIdentity(openings, weakLines, filters) {
  const rows = Array.isArray(openings) ? openings.filter((item) => getOpeningGames(item) > 0) : [];
  const strongest = [...rows].sort((a, b) => getWinRate(b) - getWinRate(a) || getOpeningGames(b) - getOpeningGames(a))[0];
  const mostPlayed = [...rows].sort((a, b) => getOpeningGames(b) - getOpeningGames(a))[0];
  const weakest = weakLines?.[0] || [...rows].sort((a, b) => getWinRate(a) - getWinRate(b))[0];
  const avgWinRate = rows.length
    ? Math.round(rows.reduce((sum, item) => sum + getWinRate(item), 0) / rows.length)
    : null;
  const label =
    avgWinRate === null
      ? "Developing"
      : weakLines?.length >= 3
        ? "Tactical Explorer"
        : avgWinRate >= 58
          ? "Solid Builder"
          : avgWinRate <= 45
            ? "Repair Mode"
            : "Balanced Repertoire";

  return {
    label,
    confidence: rows.length >= 4 ? 75 : rows.length >= 2 ? 55 : 35,
    reasons: [
      strongest ? `Best filtered signal: ${getOpeningContextTitle(strongest)}.` : null,
      weakest ? `Main filtered repair target: ${getOpeningContextTitle(weakest)}.` : null,
      filters?.timeControl && filters.timeControl !== "all"
        ? `This identity only uses ${TIME_CONTROL_FILTERS.find((item) => item.key === filters.timeControl)?.label || filters.timeControl} games.`
        : null,
    ].filter(Boolean),
    suggestedOpeningDirection: mostPlayed
      ? `Use ${getOpeningName(mostPlayed)} as the reference point for this filtered report.`
      : "Analyse more games to build a clearer opening identity.",
  };
}

function buildFilteredTrainingPlan(weakLines, openings) {
  const weakTargets = Array.isArray(weakLines) ? weakLines : [];
  const fallback = Array.isArray(openings)
    ? [...openings].sort((a, b) => getWinRate(a) - getWinRate(b) || getOpeningGames(b) - getOpeningGames(a)).slice(0, 3)
    : [];

  return (weakTargets.length ? weakTargets : fallback).slice(0, 3).map((item, index) => ({
    id: `filtered-training-${index + 1}`,
    title: index === 0 ? "Train this filtered weakness" : "Review this filtered line",
    opening: getOpeningName(item),
    variation: item?.variation || item?.line || "",
    games: getOpeningGames(item),
    winRate: getWinRate(item),
    reason: item?.flagReason || `${getOpeningContextTitle(item)} is one of the weakest filtered results.`,
    action: "Train this line",
    trainingTarget: item?.trainingTarget || item,
    source: "filtered-report",
  }));
}

function aggregateFilteredOpeningGames(data, filters) {
  const allGames = [
    ...(Array.isArray(data?.analysis_game_index) ? data.analysis_game_index : []),
    ...(Array.isArray(data?.analysisGameIndex) ? data.analysisGameIndex : []),
    ...(Array.isArray(data?.opening_games) ? data.opening_games : []),
    ...(Array.isArray(data?.openingGames) ? data.openingGames : []),
    ...(Array.isArray(data?.recent_games) ? data.recent_games : []),
    ...(Array.isArray(data?.recentGames) ? data.recentGames : []),
    ...(Array.isArray(data?.games) ? data.games : []),
    ...(Array.isArray(data?.saved_games) ? data.saved_games : []),
    ...(Array.isArray(data?.savedGames) ? data.savedGames : []),
    ...(Array.isArray(data?.cloudAnalysedGames) ? data.cloudAnalysedGames : []),
    ...(Array.isArray(data?.cloud_analysed_games) ? data.cloud_analysed_games : []),
    ...(Array.isArray(data?.restoredAnalysedGames) ? data.restoredAnalysedGames : []),
    ...(Array.isArray(data?.restored_analysed_games) ? data.restored_analysed_games : []),
  ].map(normalizeGameMetadata);
  const uniqueGames = [];
  const seen = new Set();

  allGames.forEach((game, index) => {
    const key =
      game?.game_id ||
      game?.gameId ||
      game?.url ||
      `${game?.opening || game?.name}-${game?.end_time || game?.endTime || game?.played_at || game?.playedAt || index}`;
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
  const performanceByTimeControl = buildPerformanceByTimeControl(uniqueGames, filters);

  return {
    topOpenings: byGames,
    bestOpenings: byScore,
    preferredWhite,
    preferredBlack,
    weakLines,
    filteredGames,
    performanceByTimeControl,
    totalGames: filteredGames.length,
    sourceGames: uniqueGames.length,
  };
}

function applyReportFilters(data, filters) {
  if (!data) return null;
  if (isSampleReport(data)) {
    return {
      ...data,
      reportFilters: { ...filters, sampleMode: true, limited: false },
      filterSummary: "Example data",
    };
  }

  const normalizedFilters = normalizeReportFilters(filters);
  const isUnfiltered =
    normalizedFilters.timeControl === "all" &&
    normalizedFilters.dateRange === "all" &&
    normalizedFilters.colour === "all" &&
    !normalizedFilters.openingQuery.trim();
  if (isUnfiltered) {
    return {
      ...data,
      reportFilters: { ...normalizedFilters, limited: false },
      filterSummary: "All Games, All Time, All",
    };
  }

  const aggregate = aggregateFilteredOpeningGames(data, normalizedFilters);
  const originalCounts = buildReportGameCounts(data);
  const timeLabel = TIME_CONTROL_FILTERS.find((item) => item.key === normalizedFilters.timeControl)?.label || "All Games";
  const dateLabel = DATE_RANGE_FILTERS.find((item) => item.key === normalizedFilters.dateRange)?.label || "All Time";
  const colourLabel = COLOUR_FILTERS.find((item) => item.key === (normalizedFilters.colour || "all"))?.label || "All";
  const openingLabel = normalizedFilters.openingQuery ? `, ${normalizedFilters.openingQuery}` : "";
  const filterSummary = `${timeLabel}, ${dateLabel}, ${colourLabel}${openingLabel}`;

  if (!aggregate) {
    return {
      ...data,
      reportFilters: { ...normalizedFilters, timeLabel, dateLabel, colourLabel, limited: true },
      filterSummary,
    };
  }

  const openingFitScore = buildFilteredOpeningFitScore(aggregate.topOpenings, aggregate.weakLines);
  const openingIdentity = buildFilteredOpeningIdentity(aggregate.topOpenings, aggregate.weakLines, normalizedFilters);
  const trainingPlan = buildFilteredTrainingPlan(aggregate.weakLines, aggregate.topOpenings);
  const weakestLine = aggregate.weakLines?.[0] || null;
  const oneThingToFix = weakestLine
    ? {
        opening: weakestLine.opening,
        variation: weakestLine.variation || weakestLine.line,
        exactIssue: weakestLine.flagReason,
        whyItMatters: "This line is underperforming inside the current filtered game set.",
        suggestedTrainingAction: "Train this line from the filtered report.",
        displayText: `Train ${weakestLine.variation || weakestLine.line || weakestLine.opening}`,
        trainingTarget: weakestLine.trainingTarget,
      }
    : data?.retentionMetrics?.oneThingToFix || data?.oneThingToFix || null;
  // Report exploration filters change the visible slice, not the completed
  // import totals. Keeping the authoritative contract intact prevents the
  // lightweight evidence payload from being misreported as an analysis cap.
  const gameCounts = data.gameCounts || data.game_counts || originalCounts;

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
    recent_games: aggregate.filteredGames,
    recentGames: aggregate.filteredGames,
    training_plan: trainingPlan.length ? trainingPlan : data.training_plan,
    trainingPlan: trainingPlan.length ? trainingPlan : data.trainingPlan,
    performanceByTimeControl: aggregate.performanceByTimeControl,
    performance_by_time_control: aggregate.performanceByTimeControl,
    timeControlPerformance: aggregate.performanceByTimeControl,
    openingFitScore,
    opening_fit_score: openingFitScore,
    openingIdentity,
    opening_identity: openingIdentity,
    oneThingToFix,
    one_thing_to_fix: oneThingToFix,
    weakestLine,
    weakest_line: weakestLine,
    retentionMetrics: {
      ...(data.retentionMetrics || data.retention_metrics || {}),
      openingFitScore,
      opening_fit_score: openingFitScore,
      openingIdentity,
      opening_identity: openingIdentity,
      weakestLine,
      weakest_line: weakestLine,
      oneThingToFix,
      one_thing_to_fix: oneThingToFix,
    },
    filteredGames: aggregate.totalGames,
    filtered_games: aggregate.totalGames,
    gamesImported: originalCounts.fetchedGames,
    gamesAnalysed: originalCounts.analysedGames,
    gamesAnalyzed: originalCounts.analysedGames,
    gamesEligible: originalCounts.timeControlEligibleGames ?? originalCounts.analysedGames,
    games_eligible: originalCounts.timeControlEligibleGames ?? originalCounts.analysedGames,
    gamesClassified: originalCounts.analysedGames,
    games_classified: originalCounts.analysedGames,
    gamesExcluded: originalCounts.excludedGames,
    games_excluded: originalCounts.excludedGames,
    gameCounts,
    game_counts: gameCounts,
    skippedGames: originalCounts.excludedGames,
    skipped_games: originalCounts.excludedGames,
    filterSummary,
    timeRange: dateLabel,
    dateRange: dateLabel,
    reportFilters: {
      ...normalizedFilters,
      timeLabel,
      dateLabel,
      colourLabel,
      limited: false,
      sourceGames: aggregate.sourceGames,
    },
  };
}

function buildReportHistorySummary(data, fitData = null) {
  const reportCounts = buildReportGameCounts(data);
  const playerProfile = data?.playerProfile || data?.player_profile || null;
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
    username: playerProfile?.username || data?.username || data?.playerName || data?.player_name || "Unknown player",
    displayName: playerProfile?.displayName || playerProfile?.display_name || data?.displayName || data?.display_name || null,
    display_name: playerProfile?.display_name || playerProfile?.displayName || data?.display_name || data?.displayName || null,
    playerProfile: playerProfile,
    player_profile: playerProfile,
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
    games: reportCounts.analysedGames,
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
  const counts = buildReportGameCounts(data);
  const months =
    data.importMonths ||
    data.import_months ||
    data.monthsChecked ||
    data.months_checked ||
    "Recent";
  const quality = importQualityLabel(counts.classified);
  const skippedReasons = counts.exclusionReasons.length ? counts.exclusionReasons : normaliseSkippedReasons(data, counts.excluded);

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
          <span>Imported games</span>
          <strong>{counts.imported}</strong>
        </div>
        <div>
          <span>Eligible games</span>
          <strong>{counts.eligible}</strong>
        </div>
        <div>
          <span>Classified games</span>
          <strong>{counts.classified}</strong>
        </div>
        <div>
          <span>Excluded games</span>
          <strong>{counts.excluded}</strong>
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

      <p className="importQualityCopy">{importQualityCopy(counts.classified)}</p>

      {skippedReasons.length ? (
        <div className="skippedReasons">
          <span>Excluded-game reasons</span>
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
        <button type="button" onClick={() => onPractice?.(target.opening || target.name)}>
          Train This Line
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
          onClick={() => onPractice?.(fitData.bestOpening)}
        >
          Train This Line
        </button>
      ) : null}
    </section>
  );
}

function EvidenceTableSection({ data, fitData, entitlement = null, onPractice }) {
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
  const hasFullEvidence = canUseFeature(entitlement, OPENINGFIT_FEATURES.FULL_RECOMMENDATION_EVIDENCE);
  const evidenceLimit = hasFullEvidence ? rows.length : featureLimit(entitlement, OPENINGFIT_FEATURES.GAME_HISTORY, "evidenceGames", 8);
  const visibleRows = rows.slice(0, evidenceLimit);

  return (
    <section className="evidenceTableSection finalReportBlock" id="evidence-table">
      <div className="commandPanelHeader">
        <p className="eyebrow">Opening statistics</p>
        <h2>Opening table</h2>
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
                        onClick={() => onPractice?.(opening)}
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

      {!hasFullEvidence && rows.length > visibleRows.length ? (
        <LockedPremiumCard
          title="Full evidence table available with OpeningFit Plus"
          text={`The free report shows the first ${visibleRows.length} rows. OpeningFit Plus shows all ${rows.length} openings so you can compare confidence, score, and weak lines over time.`}
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
        Found in the import, but not driving the main verdict yet.
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
    analysisDate: progress?.lastAnalysisDate || new Date().toISOString(),
    gamesAnalysed: progress?.gamesAnalysed || 0,
    detectedOpenings,
    recommendedOpenings,
    confidenceScore: progress?.repertoireConfidenceScore ?? null,
    styleProfile: data?.styleProfile || data?.style_profile || null,
    styleProfileSummary: progress?.styleProfileSummary || "Developing style profile",
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
    currentRecommendation: recommendedOpenings[0]?.name || progress?.mainOpeningRecommendation || "No clear recommendation yet",
    recommendationConfidence: progress?.recommendationConfidence || "Low Confidence",
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

  const currentScore = current?.confidenceScore ?? null;
  const previousScore = previous?.confidenceScore ?? null;
  const confidenceDelta =
    currentScore !== null && previousScore !== null
      ? currentScore - previousScore
      : null;

  if (Number.isFinite(confidenceDelta) && confidenceDelta !== 0) {
    return `${current.currentRecommendation} fit score ${confidenceDelta > 0 ? "increased" : "changed"} from ${previousScore}% to ${currentScore}%.`;
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
  const games = buildReportGameCounts(data).classified;
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
      : "Real opening data from classified games",
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
          <span>Classified games</span>
          <strong>{trust.games || 0}</strong>
          <p>Eligible games with a usable opening classification.</p>
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
      cta: "Train This Line",
      onClick: () => (strength ? onPractice?.(strength) : onViewChange?.("train")),
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
      cta: "Train This Line",
      onClick: () => (weakness ? onPractice?.(weakness) : onViewChange?.("train")),
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
      problem: "What should I train next?",
      explanation:
        actionOpening?.whyItFits ||
        studyTarget?.why ||
        "This is the most useful next step from your current report.",
      action:
        actionOpening?.studyTask ||
        studyTarget?.goal ||
        `Play 5 games with ${actionName}, then come back to update your OpeningFit profile.`,
      cta: weakness ? "Compare options" : "Start training",
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
        <h2>Train what costs you games</h2>
        <p>Fix one weak line, keep one strength, then analyse again after more games.</p>
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
                <dt>Why it matters</dt>
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
            <strong>Training plan</strong>
          </div>
          <p className="postAnalysisLabel">This week's training plan</p>
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
              <dt>Why it matters</dt>
              <dd>A focused week gives OpeningFit clearer evidence when you come back.</dd>
            </div>
            <div>
              <dt>Recommended action</dt>
              <dd>Train once, play 5 games, then reanalyse to see what changed.</dd>
            </div>
          </dl>
          <button type="button" className="primaryBtn" onClick={() => onViewChange?.("train")}>
            Train this line
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
    { label: "Training", target: "analysis-next-steps" },
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
      cta: "Train This Line",
      target: "mobile-report-strengths",
      onClick: () => (keepOpening ? onPractice?.(keepOpening) : onViewChange?.("train")),
    },
    {
      key: "improve",
      label: "Improve",
      opening: improveOpening,
      fallback: "Repair target pending",
      score: improveOpening ? getWinRate(improveOpening) : null,
      reason: improveOpening ? "Repeated early losses" : "We need a few more games",
      cta: "Train This Line",
      target: "mobile-report-weaknesses",
      onClick: () => (improveOpening ? onPractice?.(improveOpening) : onViewChange?.("train")),
    },
    {
      key: "replace",
      label: "Replace",
      opening: replaceOpening,
      fallback: "No replacement needed yet",
      score: replaceOpening ? getWinRate(replaceOpening) : null,
      reason: replaceOpening ? "Creating avoidable risk" : "Current data is not clear enough",
      cta: "Compare options",
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
          Train weak lines
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
            <button type="button" className="primaryBtn" onClick={() => onPractice?.(featuredOpening)}>
              Train This Line
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
          Train This Line
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
        {(openings.length ? openings : [normaliseNextStepOpening({ name: "Italian Game" }, data, fitData)]).map((opening, index) => (
          <article className="analysisNextOpeningCard" key={`${opening.name}-${opening.context || opening.side || index}`}>
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
          <h2>Filter this report</h2>
        </div>
        <span>{data?.filterSummary || "Current report"}</span>
      </div>

      <div className="reportFilterControls">
        <label>
          <span>Time control</span>
          <select
            className="input reportFilterSelect"
            value={activeFilters.timeControl || "all"}
            onChange={(event) => updateFilter("timeControl", event.target.value)}
          >
            {TIME_CONTROL_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Time range</span>
          <select
            className="input reportFilterSelect"
            value={activeFilters.dateRange || "all"}
            onChange={(event) => updateFilter("dateRange", event.target.value)}
          >
            {DATE_RANGE_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Colour</span>
          <select
            className="input reportFilterSelect"
            value={activeFilters.colour || "all"}
            onChange={(event) => updateFilter("colour", event.target.value)}
          >
            {COLOUR_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

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
      </div>

      {data?.performanceByTimeControl?.length ? (
        <div className="performanceByTimeControlCard" aria-label="Performance by time control">
          <span>Performance by time control</span>
          <div>
            {data.performanceByTimeControl.slice(0, 5).map((item) => (
              <article key={item.key || item.format}>
                <strong>{item.format}</strong>
                <small>{item.games} games</small>
                <em>{item.winRate ?? item.win_rate ?? 0}%</em>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <p>
        {hasOpeningQuery
          ? "Only matching games are included below."
          : "Filters recalculate the report from available game data."}
        {hasOpeningQuery ? (
          <button className="inlineFilterClear" type="button" onClick={clearOpeningQuery}>
            Clear opening filter
          </button>
        ) : null}
      </p>
    </section>
  );
}

function getWeakLineMoves(line = {}) {
  const target = line.trainingTarget || line.training_target || {};
  const moves =
    line.moves ||
    line.sanMoves ||
    line.san_moves ||
    line.uciMoves ||
    line.uci_moves ||
    target.moves ||
    target.sanMoves ||
    target.san_moves ||
    target.uciMoves ||
    target.uci_moves;
  const moveLine =
    line.moveLine ||
    line.move_line ||
    line.linePgn ||
    line.line_pgn ||
    target.moveLine ||
    target.move_line ||
    "";

  if (Array.isArray(moves) && moves.length) return moves.join(" ");
  return String(moveLine || "").trim();
}

function WeakLineSpotlightCard({ data, onPractice }) {
  const weakLines = mergeWeakLines(data, { minGames: 1 }).filter(Boolean);
  const line = weakLines.find((item) => getWeakLineMoves(item)) || weakLines[0] || null;

  if (!data) return null;

  if (!line) {
    return (
      <article className="weakLineSpotlightCard reportPriorityCard">
        <p className="eyebrow">Weak Line Spotlight</p>
        <h2>No exact weak line yet</h2>
        <p>Import more recent games to let OpeningFit find the repeated branch that needs work.</p>
      </article>
    );
  }

  const training = buildWeakestLineTrainingTargetFromLine(line);
  const title = getOpeningName(line) || line.opening || "Weak line";
  const variation = line.variation || line.line || line.lineName || line.line_name || "";
  const moves = getWeakLineMoves(line);
  const games = line.games || line.gamesPlayed || line.games_played || 0;
  const reason =
    line.flagReason ||
    line.reason ||
    line.why ||
    line.exactIssue ||
    "This is the clearest repeated line underperforming in your current report.";

  return (
    <article className="weakLineSpotlightCard reportPriorityCard">
      <div>
        <p className="eyebrow">Weak Line Spotlight</p>
        <h2>{variation && variation !== title ? `${title}: ${variation}` : title}</h2>
        <p>{reason}</p>
      </div>

      {moves ? <code>{moves}</code> : <span>Exact moves are not available for this line yet.</span>}

      <div className="weakLineSpotlightMeta">
        <small>{games ? `${games} game${Number(games) === 1 ? "" : "s"}` : "Current report signal"}</small>
        {onPractice ? (
          <button type="button" onClick={() => onPractice(training.target || line)}>
            Train this line
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ReportSectionGroup({ id, eyebrow, title, children }) {
  return (
    <section className="reportSectionGroup" id={id} aria-labelledby={`${id}-title`}>
      <div className="reportSectionGroupHeader">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      <div className="reportSectionGroupBody">{children}</div>
    </section>
  );
}

function reportTitleCase(value) {
  return String(value || "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function simpleStyleLabel(value) {
  const text = String(value || "").toLowerCase();
  if (/gambit|sacrifice|sharp|attack|aggressive/.test(text)) return "Aggressive";
  if (/tactic|tactical|dynamic|initiative/.test(text)) return "Tactical";
  if (/solid|defend|safe|stable|classical/.test(text)) return "Solid";
  if (/position|structure|builder|strategic/.test(text)) return "Positional";
  if (/experiment|explorer|rare|creative/.test(text)) return "Experimental";
  if (/endgame|grind|technical/.test(text)) return "Technical";
  return value ? reportTitleCase(value) : "Developing";
}

function reportOpeningStat(opening) {
  const games = getOpeningGames(opening);
  const winRate = getWinRate(opening);
  const lossRate = safeNumber(opening?.lossRate ?? opening?.loss_rate, Math.max(0, 100 - winRate));
  return {
    games,
    winRate,
    lossRate,
    confidence: getOpeningConfidence(opening),
  };
}

function openingCardKey(opening, index) {
  return `${getOpeningContextTitle(opening)}-${itemContext(opening, "any")}-${index}`;
}

function buildKeepPlayingCards(data, fitData, sections) {
  const sectionPrimaries = sections.map((section) => getRolePrimaryOpening(section)).filter(Boolean);
  const candidates = uniqueOpeningsByNameAndContext([
    ...sectionPrimaries,
    ...(fitData?.scoredOpenings || []),
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.bestOpenings) ? data.bestOpenings : []),
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.topOpenings) ? data.topOpenings : []),
  ])
    .filter((opening) => !isUnknownOpeningName(getOpeningName(opening)))
    .filter((opening) => getOpeningGames(opening) >= 1)
    .sort((a, b) => {
      const rateDelta = getWinRate(b) - getWinRate(a);
      if (rateDelta) return rateDelta;
      return getOpeningGames(b) - getOpeningGames(a);
    })
    .slice(0, 3);

  return candidates.map((opening) => {
    const stat = reportOpeningStat(opening);
    return {
      opening,
      title: getOpeningContextTitle(opening),
      meta: `${stat.games} game${stat.games === 1 ? "" : "s"} · ${stat.winRate}% win rate`,
      reason:
        opening.fitSummary ||
        opening.fitExplanation ||
        opening.fitReasonBullets?.[0] ||
        "This is one of your best-scoring repeated opening choices.",
      confidence: stat.confidence,
    };
  });
}

function buildFixTheseCards(data, fitData) {
  const weakLineCards = mergeWeakLines(data)
    .slice(0, 3)
    .map((line) => ({
      line,
      opening: line.trainingTarget || line,
      title: line.variation || line.line || line.opening,
      subtitle: line.opening,
      meta: `${line.games || 0} game${line.games === 1 ? "" : "s"} · ${line.winRate ?? 0}% win rate`,
      confidence: line.games >= 5 ? "Medium confidence" : "Low confidence",
      reason: line.flagReason || "This repeated line is scoring below your other opening choices.",
    }));

  if (weakLineCards.length >= 3) return weakLineCards;

  const used = new Set(weakLineCards.map((card) => String(card.subtitle || card.title).toLowerCase()));
  const openingCards = [...(fitData?.scoredOpenings || [])]
    .filter((opening) => canTreatAsRepertoireOpening(opening))
    .filter((opening) => {
      const label = String(opening.fitCategory || opening.fitVerdict || opening.verdict || "").toLowerCase();
      return ["avoid", "review", "improve"].includes(opening.fitCategory) || label.includes("improve") || label.includes("review") || getWinRate(opening) < 50;
    })
    .filter((opening) => !used.has(getOpeningName(opening).toLowerCase()))
    .sort((a, b) => {
      const confidenceDelta = confidencePriority(b) - confidencePriority(a);
      if (confidenceDelta) return confidenceDelta;
      return getWinRate(a) - getWinRate(b);
    })
    .slice(0, 3 - weakLineCards.length)
    .map((opening) => {
      const stat = reportOpeningStat(opening);
      return {
        opening,
        title: getOpeningContextTitle(opening),
        subtitle: stat.games < 4 ? "Low-confidence opening signal" : "Opening-level weakness",
        meta: `${stat.games} game${stat.games === 1 ? "" : "s"} · ${stat.winRate}% win rate`,
        confidence: stat.confidence,
        reason:
          stat.games < 4
            ? "Small sample, so treat this as something to watch rather than a hard verdict."
            : opening.fitReasonBullets?.[0] || opening.fitExplanation || "This opening is underperforming compared with your stronger choices.",
      };
    });

  return [...weakLineCards, ...openingCards];
}

function buildTrainNextCards(data, fitData, studyTarget) {
  const weakestTraining = buildWeakestLineTrainingTarget(data);
  const plan = buildTrainingRecommendations(data, fitData);
  const actions = [];

  if (weakestTraining.available && weakestTraining.target) {
    actions.push({
      title: weakestTraining.target.trainingSet?.openingName || weakestTraining.target.opening || "Weakest line",
      meta: "Weakest-line drill",
      reason: weakestTraining.target.trainingSet?.shortExplanation || "Practice the repeated line causing the clearest trouble.",
      target: weakestTraining.target,
    });
  }

  if (plan?.primary?.opening) {
    actions.push({
      title: plan.primary.variation || plan.primary.opening,
      meta: plan.primary.opening,
      reason: plan.primary.reason || plan.primary.why || "This is the next opening action from your current report.",
      target: plan.primary,
    });
  }

  if (studyTarget?.opening) {
    actions.push({
      title: studyTarget.name,
      meta: studyTarget.timeNeeded || "Focused review",
      reason: studyTarget.goal || studyTarget.why || "Review this before adding more theory.",
      target: studyTarget.opening,
    });
  }

  const seen = new Set();
  return actions
    .filter((action) => {
      const key = String(`${action.title}-${action.meta}`).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function buildSuggestedRepertoireCards(sections) {
  const labels = {
    white_repertoire: "White recommendation",
    black_vs_e4: "Black vs 1.e4",
    black_vs_d4: "Black vs 1.d4",
  };

  return ["white_repertoire", "black_vs_e4", "black_vs_d4"].map((key) => {
    const section = sections.find((item) => item.key === key);
    const opening = section?.primary || null;
    return {
      key,
      label: labels[key],
      opening,
      title: opening ? getOpeningContextTitle(opening) : "Needs more games",
      meta: opening
        ? `${getOpeningGames(opening)} game${getOpeningGames(opening) === 1 ? "" : "s"} · ${getOpeningConfidence(opening)}`
        : "Import more colour-specific games",
      reason: opening
        ? colourAwareBucketCopy(key, repertoireBucketForOpening(opening))
        : "OpeningFit needs more games in this role before recommending a line.",
    };
  });
}

function OpeningFitReportOverview({ data, fitData, studyTarget, onPractice, onNavigate }) {
  const sections = useMemo(() => buildRepertoireReportSections(data), [data]);
  const keepCards = useMemo(() => buildKeepPlayingCards(data, fitData, sections), [data, fitData, sections]);
  const fixCards = useMemo(() => buildFixTheseCards(data, fitData), [data, fitData]);
  const trainCards = useMemo(() => buildTrainNextCards(data, fitData, studyTarget), [data, fitData, studyTarget]);
  const repertoireCards = useMemo(() => buildSuggestedRepertoireCards(sections), [sections]);
  const identity = data?.openingIdentity || data?.opening_identity || data?.retentionMetrics?.openingIdentity || {};
  const styleProfile = data?.styleProfile || data?.style_profile || {};
  const identityLabel = simpleStyleLabel(
    identity.label ||
      identity.name ||
      styleProfile.primaryStyle ||
      styleProfile.primary_style ||
      styleProfile.label ||
      styleProfile.primary ||
      styleProfile.summary
  );
  const identityReasons = [
    ...(Array.isArray(identity.reasons) ? identity.reasons : []),
    styleProfile.summary,
    fitData?.bestOpening ? `Best current signal: ${getOpeningContextTitle(fitData.bestOpening)}.` : null,
    fitData?.weakestOpening ? `Main repair target: ${getOpeningContextTitle(fitData.weakestOpening)}.` : null,
  ].filter(Boolean).slice(0, 2);

  return (
    <section className="openingFitReportOverview" aria-label="OpeningFit report overview">
      <article className="reportOverviewIdentity">
        <div>
          <p className="eyebrow">Opening Identity</p>
          <h2>{identityLabel} opening profile</h2>
        </div>
        <p>
          {identityReasons[0] ||
            "OpeningFit needs a few more repeated games before it can describe your opening style clearly."}
        </p>
        {identityReasons[1] ? <small>{identityReasons[1]}</small> : <small>Keep the next import focused on recent rapid or blitz games.</small>}
      </article>

      <div className="reportOverviewGrid reportOverviewGrid--two">
        <section className="reportOverviewPanel">
          <div className="reportOverviewPanelHeader">
            <h3>Keep Playing</h3>
            <span>Top 3</span>
          </div>
          {keepCards.length ? (
            <div className="reportOverviewList">
              {keepCards.map((card, index) => (
                <article className="reportOverviewMiniCard" key={openingCardKey(card.opening, index)}>
                  <strong>{card.title}</strong>
                  <span>{card.meta}</span>
                  <p>{card.reason}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="reportOverviewEmpty">Analyse more games to reveal your strongest repeated openings.</p>
          )}
        </section>

        <section className="reportOverviewPanel">
          <div className="reportOverviewPanelHeader">
            <h3>Fix These</h3>
            <span>Weakest lines first</span>
          </div>
          {fixCards.length ? (
            <div className="reportOverviewList">
              {fixCards.map((card, index) => (
                <article className="reportOverviewMiniCard reportOverviewMiniCard--warning" key={`${card.title}-${index}`}>
                  <strong>{card.title}</strong>
                  {card.subtitle ? <em>{card.subtitle}</em> : null}
                  <span>{card.meta} · {card.confidence}</span>
                  <p>{card.reason}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="reportOverviewEmpty">No repeated weak line is clear yet. Keep playing and reanalyse after more games.</p>
          )}
        </section>
      </div>

      <div className="reportOverviewGrid reportOverviewGrid--train">
        <section className="reportOverviewPanel">
          <div className="reportOverviewPanelHeader">
            <h3>Train Next</h3>
            <span>1-3 actions</span>
          </div>
          {trainCards.length ? (
            <div className="reportOverviewActionGrid">
              {trainCards.map((action, index) => (
                <article className="reportOverviewMiniCard reportOverviewMiniCard--action" key={`${action.title}-${index}`}>
                  <strong>{action.title}</strong>
                  <span>{action.meta}</span>
                  <p>{action.reason}</p>
                  <button type="button" className="primaryBtn" onClick={() => onPractice?.(action.target) || onNavigate?.("training")}>
                    Train This Line
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="reportOverviewEmptyAction">
              <p>Analyse more games to unlock a reliable training target.</p>
              <button type="button" className="secondaryBtn" onClick={() => onNavigate?.("training")}>
                Open training
              </button>
            </div>
          )}
        </section>

        <section className="reportOverviewPanel">
          <div className="reportOverviewPanelHeader">
            <h3>Suggested Repertoire</h3>
            <span>Current logic</span>
          </div>
          <div className="reportOverviewRepertoireGrid">
            {repertoireCards.map((card) => (
              <article className="reportOverviewMiniCard" key={card.key}>
                <span>{card.label}</span>
                <strong>{card.title}</strong>
                <em>{card.meta}</em>
                <p>{card.reason}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
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
  retentionSnapshots = [],
  reportFilters,
  onReportFiltersChange,
  onAnalytics,
  authenticated = false,
  comparisonLoading = false,
  comparisonError = "",
  entitlement = null,
}) {
  const decisionModel = useMemo(
    () => buildReportDecisionModel(data, fitData, reportHistory),
    [data, fitData, reportHistory]
  );
  const [reportMode, setReportMode] = useState(() => isSampleReport(data) ? "full" : "summary");
  const showFullReport = reportMode === "full";
  const showOpeningTable = reportMode === "table";
  const currentComparisonSnapshot = useMemo(
    () => buildReportSnapshot({ report: data, summary: buildReportHistorySummary(data, fitData) }),
    [data, fitData]
  );
  const comparisonSnapshots = useMemo(
    () => (Array.isArray(reportHistory) ? reportHistory : []).map((item) => adaptReportHistoryRow(item)),
    [reportHistory]
  );
  const previousComparisonSnapshot = useMemo(
    () => selectPreviousReportSnapshot(currentComparisonSnapshot, comparisonSnapshots),
    [comparisonSnapshots, currentComparisonSnapshot]
  );
  const hasComparisonAccess = canUseFeature(entitlement, OPENINGFIT_FEATURES.REPORT_COMPARISON);
  const primaryComparison = hasComparisonAccess
    ? primaryComparisonState({ authenticated, previousReport: previousComparisonSnapshot, loading: comparisonLoading, error: comparisonError })
    : authenticated ? "preview" : "hidden";

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

  useEffect(() => {
    if (isSampleReport(data)) setReportMode("full");
  }, [data]);

  useEffect(() => {
    if (typeof window === "undefined" || !import.meta.env?.DEV) return undefined;

    const checkVerdictCardWidths = () => {
      if (window.innerWidth < 900) return;
      const cards = document.querySelectorAll(
        "#report-verdict .verdict-summary-card"
      );
      cards.forEach((card) => {
        const width = Math.round(card.getBoundingClientRect().width);
        if (width > 0 && width < 240) {
          console.warn("OpeningFit report verdict card is too narrow", {
            className: card.className,
            width,
          });
        }
      });
    };

    window.requestAnimationFrame(checkVerdictCardWidths);
    window.addEventListener("resize", checkVerdictCardWidths);
    return () => window.removeEventListener("resize", checkVerdictCardWidths);
  }, [activeView, data, fitData, reportMode]);

  const openOpeningBreakdown = useCallback(() => {
    setReportMode("table");
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      document.getElementById("evidence-table")?.scrollIntoView({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
        block: "start",
      });
    }, 60);
  }, []);

  const openFullReport = useCallback(() => {
    setReportMode("full");
    if (typeof window === "undefined") return;
    window.setTimeout(() => document.getElementById("full-report-details")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, []);

  return (
    <div className="finalReportFlow decisionReportFlow">
      <PrimaryReportSummary
        model={decisionModel}
        report={data}
        previousReport={hasComparisonAccess ? previousComparisonSnapshot : null}
        comparison={primaryComparison === "preview" ? <FeatureAccessPreview feature={OPENINGFIT_FEATURES.REPORT_COMPARISON} title="See what changed since your last report" onUpgrade={() => onNavigate?.("premium")} /> : primaryComparison !== "hidden" ? (
          <ReportComparisonSection
            currentSnapshot={currentComparisonSnapshot}
            reportSnapshots={comparisonSnapshots}
            loading={comparisonLoading}
            error={comparisonError}
            onViewHistory={() => onNavigate?.("history")}
            onAnalytics={onAnalytics}
          />
        ) : null}
        onTraining={() => onNavigate?.({ view: "train", path: "/train", target: "training-plan" })}
        onFullReport={openFullReport}
        onUpgrade={() => onNavigate?.("premium")}
        entitlement={entitlement}
      />

      <ReportCommandBar
        data={data}
        activeView={activeView}
        reportMode={reportMode}
        onReportModeChange={setReportMode}
        onNavigate={onNavigate}
        isPremium={isPremium}
        onUpgrade={() => onNavigate?.("premium")}
      />

      <details className="reportFullDisclosure" id="full-report-details" open={showFullReport || showOpeningTable} onToggle={(event) => { if (event.currentTarget.open && reportMode === "summary") setReportMode("full"); else if (!event.currentTarget.open && reportMode !== "summary") setReportMode("summary"); }}>
        <summary><span>Full report</span><strong>View recommendations, evidence, training detail and report tools</strong></summary>
        <div className="reportFullDisclosureBody">
          <details className="reportSupportingDataDetails" open={showOpeningTable}>
            <summary><span>Supporting evidence</span><strong>Results, confidence, time controls, and supporting games</strong></summary>
            <ReportOpeningFilters filters={reportFilters} onFiltersChange={onReportFiltersChange} data={data} />
            <EvidenceTableSection data={data} fitData={fitData} entitlement={entitlement} onPractice={onPractice} />
            <AnalysisTrustSignalsPanel data={data} fitData={fitData} />
            <ImportQualitySummary data={data} />
          </details>

          <details className="reportAdvancedRecommendations">
            <summary><span>Advanced recommendations</span><strong>Detailed decision cards, repertoire map and additional practice tools</strong></summary>
            <DecisionReportHeader model={decisionModel} onReanalyse={() => onNavigate?.("analyse") || onViewChange?.("analyse")} />
            <CoachDecisionVerdict model={decisionModel} />
            <FiniteTrainingSession model={decisionModel} recentGames={recentGames} onPractice={onPractice} />
            <ReportDecisionCards model={decisionModel} onPractice={onPractice} onEvidence={openOpeningBreakdown} onRepertoire={() => onNavigate?.("repertoire")} onFeedback={onAnalytics} />
            <CompactOpeningHealth model={decisionModel} />
            <DecisionRepertoireMap model={decisionModel} onPractice={onPractice} onEvidence={openOpeningBreakdown} />
            <CostlyIssuesSection model={decisionModel} onPractice={onPractice} onEvidence={openOpeningBreakdown} />
          </details>

          <details className="reportSecondaryDetails">
            <summary><span>Progress and details</span><strong>Optional secondary metrics, achievements, detailed tables and tools</strong></summary>
            <div className="reportSecondaryDetailsBody">
              {!decisionModel.baseline.comparisonClaimsAllowed ? <p className="reportBaselineDetailsNotice">This is your baseline report. Progress deltas, improvement achievements, streak claims and comparison-only metrics stay unavailable until a comparable later report exists.</p> : null}
              {decisionModel.baseline.comparisonClaimsAllowed && authenticated && canUseFeature(entitlement, OPENINGFIT_FEATURES.PROGRESS_OUTCOMES) ? <TrainingImpactSection report={data} reportHistory={reportHistory} source="report" onViewHistory={() => onNavigate?.("journey")} onAnalytics={onAnalytics} /> : decisionModel.baseline.comparisonClaimsAllowed && authenticated ? <FeatureAccessPreview feature={OPENINGFIT_FEATURES.PROGRESS_OUTCOMES} title="See training impact in later games" onUpgrade={() => onNavigate?.("premium")} /> : null}
              {decisionModel.baseline.comparisonClaimsAllowed && reportHistory.length ? <OpeningHealthTrends reportHistory={reportHistory} /> : null}
              {decisionModel.baseline.comparisonClaimsAllowed ? <WhatChangedSinceLastAnalysis data={data} fitData={fitData} retentionSnapshots={retentionSnapshots} decisionModel={decisionModel} /> : null}
              {decisionModel.baseline.comparisonClaimsAllowed ? <OpeningJourney data={data} fitData={fitData} retentionSnapshots={retentionSnapshots} onPractice={onPractice} onNavigate={onNavigate} /> : null}
              <OpeningScoreBreakdown data={data} fitData={fitData} reportHistory={reportHistory} openingFitUserState={openingFitUserState} onAction={(route) => onNavigate?.(route)} decisionModel={decisionModel} />
              <InterestingThinDataSection data={data} fitData={fitData} />
              {decisionModel.baseline.comparisonClaimsAllowed ? <WeeklyOpeningReport data={data} savedHistory={openingFitUserState.flatMap((row) => row?.coach_progress?.weeklyOpeningSnapshots || []).filter(Boolean)} decisionModel={decisionModel} /> : null}
              {decisionModel.baseline.comparisonClaimsAllowed ? <OpeningGamificationProgress data={data} fitData={fitData} savedProgress={openingFitUserState.map((row) => row?.coach_progress?.openingGamification || null).filter(Boolean)[0] || null} /> : null}
            </div>
          </details>

          <ReportExportAndHistory data={data} entitlement={entitlement} onUpgrade={() => onNavigate?.("premium")} onLoadReport={onLoadReport} />
        </div>
      </details>
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
        <p className="eyebrow">Primary next action</p>
        <h2>{action.opening ? "Train this line" : "Review your repertoire"}</h2>
        <p>
          <strong>{action.opening}</strong>
          {action.variation ? ` · ${action.variation}` : ""}. {action.reason}. {action.why}
        </p>
      </div>
      <button type="button" onClick={() => onStartTraining?.(action)}>
        {action.opening ? "Train this line" : "Review repertoire"}
      </button>
    </section>
  );
}

function ReportTrainingPreview({ data, fitData, studyTarget, recentGames = [], onPractice, onNavigate }) {
  if (!data) return null;

  const plan = buildTrainingRecommendations(data, fitData);
  const primaryTarget = plan.primary;
  const weakestTraining = buildWeakestLineTrainingTarget(data);
  const targetName =
    primaryTarget?.opening ||
    weakestTraining.target?.opening ||
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
        <h2>Practice and replay</h2>
        <p>Practice the main target first. Replay and raw game details are available after the advice.</p>
      </div>

      <div className="reportTrainingPreviewGrid">
        <article>
          <span>Practice board</span>
          <strong>
            {primaryTarget?.sideLabel ? `${primaryTarget.sideLabel}: ` : ""}
            {targetName}
            {primaryTarget?.variation ? `, ${primaryTarget.variation}` : ""}
          </strong>
          <p>
            {primaryTarget
              ? `${primaryTarget.reason} ${primaryTarget.why}`
              : weakestTraining.available
              ? weakestTraining.target.trainingSet?.shortExplanation
              : studyTarget?.goal || weakestTraining.message || "Learn one clean line and the first middlegame plan."}
          </p>
          {primaryTarget ? (
            <>
              <p className="trainingTargetMeta">
                {primaryTarget.confidence || "Limited evidence"} · exact point {primaryTarget.startLabel || "from the saved sequence"}
              </p>
              <button type="button" className="primaryBtn" onClick={() => onPractice?.(primaryTarget.trainingTarget || primaryTarget)}>
                Train targeted line
              </button>
            </>
          ) : weakestTraining.available ? (
            <button type="button" className="primaryBtn" onClick={() => onPractice?.(weakestTraining.target)}>
              Train This Line
            </button>
          ) : (
            <button type="button" className="primaryBtn" onClick={() => onPractice?.(targetName)}>
              Train This Line
            </button>
          )}
        </article>

        <article>
          <span>Training plan</span>
          <strong>{studyTarget?.timeNeeded || "10-15 minutes"}</strong>
          <p>{studyTarget?.why || "Keep the session focused so your next import has clearer evidence."}</p>
          <button type="button" className="secondaryBtn" onClick={() => onNavigate?.("training")}>
            Train this line
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
        onClick={() => canPractice && onPractice?.(opening)}
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
        <h2>Your repertoire</h2>
        <p>The clearest keep, improve, and avoid verdicts.</p>
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
          <p className="eyebrow">Opening report</p>
          <h1>{playerName}'s opening plan</h1>
          <div className="currentReportMetaInline" aria-label="Report details">
            <span>{platformLabel}</span>
            <span>{games || "—"} games</span>
            <span>{analysedDate}</span>
          </div>
          <p>{verdict.profile}</p>
        </div>

        <div className="commandCentreScore" aria-label="Opening Fit Score">
          <span>
            Opening Fit Score{" "}
            <OpeningScoreInfoButton
              opening={{
                name: "Opening Fit Score",
                games: scoredOpenings.reduce((total, opening) => total + getOpeningGames(opening), 0),
                fitScore: score,
                confidence: score ? "Report-level estimate" : "Not enough data",
                nextAction: "Open the training plan and review the lowest-scoring repeated line first.",
              }}
              score={score}
            />
          </span>
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
          <span>Next action</span>
          <h2>{mainRecommendation}</h2>
          <p>{nextBestMove}</p>
        </div>

        {reportMode !== "summary" ? (
          <div className="nextBestMoveActions">
            <button type="button" className="primaryBtn" onClick={() => chooseReportMode("table")}>
              View evidence
            </button>
            <button type="button" className="secondaryBtn" onClick={() => onViewChange?.("training")}>
              Train this line
            </button>
            <button type="button" className="secondaryBtn" onClick={() => chooseReportMode("full")}>
              Review repertoire
            </button>
          </div>
        ) : null}
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

  const playerName = getImportedAccountUsername(data, username) || "OpeningFit player";
  const platformLabel =
    getImportedAccountPlatform(data, platform).includes("lichess")
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
          <strong>{isPremium ? "OpeningFit Plus active" : "Free"}</strong>
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
  const importedUsername = getImportedAccountUsername(data, fallback) || fallback;
  return getPlayerIdentity(data, importedUsername).displayName || importedUsername || "OpeningFit player";
}

function getProfilePlatformLabel(data, fallback = "") {
  const raw = getImportedAccountPlatform(data, fallback);
  if (raw.includes("lichess")) return "Lichess";
  if (raw.includes("chesscom") || raw.includes("chess.com")) return "Chess.com";
  return "Connected chess account";
}

function formatProfileUsername(username) {
  const clean = String(username || "").trim().replace(/^@+/, "");
  return clean ? `@${clean}` : "";
}

function getPlayerProfileData(data = {}) {
  return (
    data?.playerProfile ||
    data?.player_profile ||
    data?.summary?.playerProfile ||
    data?.summary?.player_profile ||
    data?.report?.playerProfile ||
    data?.report?.player_profile ||
    null
  );
}

function normalizePlayerName(value = "") {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

function getPlayerInitials(value = "") {
  const words = String(value || "OF")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.length > 1
    ? `${words[0][0]}${words[1][0]}`
    : (words[0] || "OF").slice(0, 2);
  return initials.toUpperCase();
}

function getPlayerIdentity(data = {}, fallback = "") {
  const playerProfile = getPlayerProfileData(data);
  const username =
    playerProfile?.username ||
    data?.username ||
    data?.playerName ||
    data?.player_name ||
    data?.requestedUsername ||
    data?.requested_username ||
    fallback ||
    "OpeningFit player";
  const displayName =
    playerProfile?.displayName ||
    playerProfile?.display_name ||
    data?.displayName ||
    data?.display_name ||
    username;
  const platform = playerProfile?.platform || data?.platform || data?.importPlatform || data?.import_platform || "";
  const avatarUrl = playerProfile?.avatarUrl || playerProfile?.avatar_url || "";
  const profileUrl = playerProfile?.profileUrl || playerProfile?.profile_url || data?.playerUrl || data?.player_url || "";

  return {
    username,
    displayName,
    platform,
    avatarUrl,
    profileUrl,
    hasDistinctDisplayName: normalizePlayerName(displayName) !== normalizePlayerName(username),
  };
}

function getPlayerIdentitySecondary(identity, platformLabel) {
  if (identity?.hasDistinctDisplayName && identity?.username) {
    return `@${identity.username} · ${platformLabel}`;
  }

  return platformLabel;
}

function PlayerIdentity({ identity, platformLabel, compact = false }) {
  const secondary = getPlayerIdentitySecondary(identity, platformLabel);

  return (
    <div className={`playerIdentity ${compact ? "playerIdentityCompact" : ""}`}>
      <div className="playerIdentityAvatar" aria-hidden="true">
        {identity?.avatarUrl ? (
          <img src={identity.avatarUrl} alt="" width="48" height="48" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <span>{getPlayerInitials(identity?.displayName || identity?.username)}</span>
        )}
      </div>
      <div className="playerIdentityText">
        <strong>{identity?.displayName || identity?.username || "OpeningFit player"}</strong>
        <small>{secondary}</small>
      </div>
    </div>
  );
}

function ProfileDisclosure({ eyebrow, title, children, defaultOpen = false }) {
  return (
    <details
      className="profileSecondaryDetails profileDisclosure"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </summary>
      <div className="profileDisclosureBody">
        {children}
      </div>
    </details>
  );
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

function getProfileOpeningCandidates(data, fitData) {
  const recommendations = data?.opening_recommendations || data?.openingRecommendations || {};
  return uniqueOpeningsByNameAndContext([
    fitData?.bestOpening,
    fitData?.weakestOpening,
    ...(Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []),
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.bestOpenings) ? data.bestOpenings : []),
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.topOpenings) ? data.topOpenings : []),
    ...(Array.isArray(data?.weak_openings) ? data.weak_openings : []),
    ...(Array.isArray(data?.weakOpenings) ? data.weakOpenings : []),
    ...(Array.isArray(data?.preferred_white) ? normalizeRecommendationSection(data.preferred_white, "played_as_white") : []),
    ...(Array.isArray(data?.preferredWhite) ? normalizeRecommendationSection(data.preferredWhite, "played_as_white") : []),
    ...(Array.isArray(data?.preferred_black) ? normalizeRecommendationSection(data.preferred_black, "black_vs_e4") : []),
    ...(Array.isArray(data?.preferredBlack) ? normalizeRecommendationSection(data.preferredBlack, "black_vs_e4") : []),
    ...(Array.isArray(recommendations.white_repertoire) ? normalizeRecommendationSection(recommendations.white_repertoire, "played_as_white") : []),
    ...(Array.isArray(recommendations.whiteDetailed) ? normalizeRecommendationSection(recommendations.whiteDetailed, "played_as_white") : []),
    ...(Array.isArray(recommendations.black_vs_e4) ? normalizeRecommendationSection(recommendations.black_vs_e4, "black_vs_e4") : []),
    ...(Array.isArray(recommendations.blackVsE4Detailed) ? normalizeRecommendationSection(recommendations.blackVsE4Detailed, "black_vs_e4") : []),
    ...(Array.isArray(recommendations.black_vs_d4) ? normalizeRecommendationSection(recommendations.black_vs_d4, "black_vs_d4") : []),
    ...(Array.isArray(recommendations.blackVsD4Detailed) ? normalizeRecommendationSection(recommendations.blackVsD4Detailed, "black_vs_d4") : []),
    ...(Array.isArray(recommendations.black_vs_other) ? normalizeRecommendationSection(recommendations.black_vs_other, "black_vs_other") : []),
    ...(Array.isArray(recommendations.blackVsOtherDetailed) ? normalizeRecommendationSection(recommendations.blackVsOtherDetailed, "black_vs_other") : []),
  ].filter(Boolean)).filter((opening) => !isUnknownOpeningName(getOpeningName(opening)));
}

function isReliableProfileOpening(opening) {
  return Boolean(opening && canTreatAsRepertoireOpening(opening) && getOpeningGames(opening) >= 10);
}

function verdictLooksLike(opening, data, words = []) {
  const verdict = String(openingVerdictLabel(opening, data, opening?.fitVerdict || opening?.verdict)).toLowerCase();
  const raw = String(opening?.fitCategory || opening?.fitVerdict || opening?.verdict || "").toLowerCase();
  return words.some((word) => verdict.includes(word) || raw.includes(word));
}

function getPreferredOpening(data, fitData, side) {
  const context = side === "white" ? "played_as_white" : null;
  const candidates = getProfileOpeningCandidates(data, fitData)
    .filter((opening) => {
      const itemCtx = itemContext(opening, "unknown_mixed");
      if (side === "white") return itemCtx === context;
      return BLACK_REPERTOIRE_CONTEXTS.has(itemCtx);
    })
    .sort((a, b) => {
      const gamesDelta = getOpeningGames(b) - getOpeningGames(a);
      if (gamesDelta) return gamesDelta;
      return getWinRate(b) - getWinRate(a);
    });

  return candidates[0] || null;
}

function getStrongestOpening(data, fitData) {
  const candidates = getProfileOpeningCandidates(data, fitData)
    .filter((opening) => {
      if (!isReliableProfileOpening(opening)) return false;
      return getWinRate(opening) >= 55 || verdictLooksLike(opening, data, ["keep", "main", "reliable"]);
    })
    .sort((a, b) => {
      const scoreDelta = getWinRate(b) - getWinRate(a);
      if (scoreDelta) return scoreDelta;
      const confidenceDelta = confidencePriority(b) - confidencePriority(a);
      if (confidenceDelta) return confidenceDelta;
      return getOpeningGames(b) - getOpeningGames(a);
    });

  return candidates[0] || null;
}

function getNeedsWorkOpening(data, fitData, usedOpenings = []) {
  const candidates = getProfileOpeningCandidates(data, fitData)
    .filter((opening) => {
      if (!isReliableProfileOpening(opening)) return false;
      return getWinRate(opening) < 55 || verdictLooksLike(opening, data, ["improve", "avoid", "review", "unstable"]);
    })
    .sort((a, b) => {
      const scoreDelta = getWinRate(a) - getWinRate(b);
      if (scoreDelta) return scoreDelta;
      const gamesDelta = getOpeningGames(b) - getOpeningGames(a);
      if (gamesDelta) return gamesDelta;
      return confidencePriority(b) - confidencePriority(a);
    });

  return pickDistinctOpening(candidates, usedOpenings) || null;
}

function avoidDuplicateProfileInsights({ strongest, needsWork, candidates }) {
  if (!strongest || !needsWork || !isSameOpeningContext(strongest, needsWork)) {
    return { strongest, needsWork, needsWorkFallback: "" };
  }

  const replacement = pickDistinctOpening(
    candidates
      .filter((opening) => isReliableProfileOpening(opening))
      .sort((a, b) => {
        const scoreDelta = getWinRate(a) - getWinRate(b);
        if (scoreDelta) return scoreDelta;
        return getOpeningGames(b) - getOpeningGames(a);
      }),
    [strongest]
  );

  if (replacement) return { strongest, needsWork: replacement, needsWorkFallback: "" };

  const lowerVolume = candidates.some(
    (opening) =>
      opening &&
      !isSameOpeningContext(opening, strongest) &&
      canTreatAsRepertoireOpening(opening) &&
      getOpeningGames(opening) > 0 &&
      getOpeningGames(opening) < 10
  );

  return {
    strongest,
    needsWork: null,
    needsWorkFallback: lowerVolume ? "Review your lower-volume openings" : "No clear weak opening yet",
  };
}

function getProfileOpeningFacts(data, fitData) {
  const candidates = getProfileOpeningCandidates(data, fitData);
  const preferredWhite = getPreferredOpening(data, fitData, "white");
  const preferredBlack = getPreferredOpening(data, fitData, "black");
  const strongestCandidate =
    getStrongestOpening(data, fitData) ||
    (isReliableProfileOpening(fitData?.bestOpening) ? fitData.bestOpening : null);
  const needsWorkCandidate =
    getNeedsWorkOpening(data, fitData, strongestCandidate ? [strongestCandidate] : []) ||
    (isReliableProfileOpening(fitData?.weakestOpening) && !isSameOpeningContext(fitData.weakestOpening, strongestCandidate)
      ? fitData.weakestOpening
      : null);
  const deduped = avoidDuplicateProfileInsights({
    strongest: strongestCandidate,
    needsWork: needsWorkCandidate,
    candidates,
  });

  return {
    preferredWhite: preferredWhite ? getOpeningContextTitle(preferredWhite) : "Not enough White games yet",
    preferredBlack: preferredBlack ? getOpeningContextTitle(preferredBlack) : "Not enough Black games yet",
    strongest: deduped.strongest ? getOpeningContextTitle(deduped.strongest) : "No clear strongest opening yet",
    needsWork: deduped.needsWork
      ? getOpeningContextTitle(deduped.needsWork)
      : deduped.needsWorkFallback || "Needs more games to identify",
  };
}

function getPlayerSummaryOpeningReason(opening, fallback) {
  if (!opening || typeof opening === "string") return fallback;

  const reason =
    opening.fitReasonBullets?.[0] ||
    opening.reason ||
    opening.why ||
    opening.recommendationReason ||
    opening.recommendation_reason ||
    opening.explanation ||
    fallback;

  return String(reason || fallback).replace(/\s+/g, " ").replace(/[.]+$/, "");
}

function buildPlayerSummary(data, fitData) {
  const username = getProfilePlayerName(data, data?.username || data?.playerName || data?.player_name);
  const archetype = getProfileStyleLabel(data, fitData);
  const styleSummary = getProfileStyleSummary(data, fitData);
  const facts = getProfileOpeningFacts(data, fitData);
  const bestOpening =
    fitData?.bestOpening ||
    (Array.isArray(data?.best_openings) ? data.best_openings[0] : null) ||
    (Array.isArray(data?.bestOpenings) ? data.bestOpenings[0] : null);
  const studyTarget = buildStudyThisNextTarget(fitData);
  const recommendedOpening = studyTarget?.opening || bestOpening;
  const score = fitData?.overallScore ?? data?.openingFitScore ?? data?.opening_fit_score ?? null;
  const bestName = bestOpening ? getOpeningContextTitle(bestOpening) : facts.strongest;
  const recommendedName = recommendedOpening
    ? getOpeningContextTitle(recommendedOpening)
    : studyTarget?.name || facts.strongest;
  const weakness = facts.needsWork.includes("No clear")
    ? "there is not one obvious leak yet; they need a bigger sample before making a huge repertoire change"
    : facts.needsWork;
  const finalVerdict = score !== null && score !== undefined && Number(score) >= 70
    ? "this player has a real opening identity. Patch the leak, and the repertoire starts looking dangerous."
    : "the profile has promise, but the next jump comes from fixing one repeat opening problem.";

  return [
    "Player Summary",
    "",
    "Opening Identity:",
    `${username} profiles as a ${archetype}. ${styleSummary}`,
    "",
    "Best Fit:",
    `${bestName} currently suits this player best because ${getPlayerSummaryOpeningReason(bestOpening, "it is the clearest positive signal in their current games")}.`,
    "",
    "Main Leak:",
    `${weakness}.`,
    "",
    "Recommended Next Step:",
    `Focus on ${recommendedName}. ${studyTarget?.why || getPlayerSummaryOpeningReason(recommendedOpening, "It gives them the most practical next training target")}.`,
    "",
    "Coach Verdict:",
    finalVerdict,
  ].join("\n");
}

function getProfilePlanLabel({ isPremium, isPremiumPreview, accountUser, entitlement }) {
  if (entitlement?.hasPremiumAccess) return subscriptionPresentation(entitlement).planName;
  if (isPremium || isPremiumPreview) return "OpeningFit Plus";
  return accountUser ? "Free account" : "Free account";
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
  const playerProfile =
    summary.playerProfile ||
    summary.player_profile ||
    item?.playerProfile ||
    item?.player_profile ||
    report?.playerProfile ||
    report?.player_profile ||
    null;
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
      playerProfile?.username ||
      summary.username ||
      item?.username ||
      item?.playerName ||
      report?.username ||
      report?.playerName ||
      "OpeningFit player",
    playerProfile,
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

function getProfileProgressSummary(data, openingFitUserState = [], savedProgress = null) {
  const rows = Array.isArray(openingFitUserState) ? openingFitUserState : [];
  const openingTrainingRows = rows
    .map((row) => row?.coach_progress?.openingTraining || row?.coach_progress?.opening_training || null)
    .filter(Boolean);
  const trainedOpenings = new Set();
  openingTrainingRows.forEach((progress) => {
    Object.values(progress?.progressByOpening || progress?.progress_by_opening || {}).forEach((item) => {
      const name = item?.openingName || item?.opening_name || item?.openingId || item?.opening_id;
      if (name) trainedOpenings.add(String(name));
    });
  });

  const metrics = data?.retentionMetrics || data?.retention_metrics || {};
  const masteryRows =
    data?.openingMastery ||
    data?.opening_mastery ||
    metrics.openingMastery ||
    metrics.opening_mastery ||
    [];
  const masteredFromReport = Array.isArray(masteryRows)
    ? masteryRows.filter((item) => Number(item?.masteryScore ?? item?.mastery_score ?? item?.mastery ?? 0) >= 75).length
    : 0;
  const trainedFromXp = Array.isArray(savedProgress?.openingXp) ? savedProgress.openingXp.length : 0;
  const masteredFromXp = Array.isArray(savedProgress?.openingXp)
    ? savedProgress.openingXp.filter((item) => Number(item?.score ?? item?.mastery ?? item?.masteryScore ?? 0) >= 75).length
    : 0;
  const streakValues = Object.values(savedProgress?.streaks || {})
    .map((streak) => Number(streak?.current || 0))
    .filter((value) => Number.isFinite(value));
  const bestStreak = streakValues.length ? Math.max(...streakValues) : 0;

  return {
    streak: bestStreak,
    trainedOpenings: Math.max(trainedOpenings.size, trainedFromXp),
    masteredOpenings: Math.max(masteredFromReport, masteredFromXp),
  };
}

function ProfileSummaryCard({
  data,
  fitData,
  accountUser,
  username,
  platform,
  isPremium,
  isPremiumPreview,
  openingFitUserState = [],
  savedOpeningGamificationProgress = null,
  onAnalyse,
  onOpenReport,
}) {
  const hasReport = Boolean(data);
  const playerIdentity = getPlayerIdentity(data, username);
  const platformLabel = hasReport || username ? getProfilePlatformLabel(data, platform) : "No saved report yet";
  const planLabel = getProfilePlanLabel({ isPremium, isPremiumPreview, accountUser });
  const analysedAt = getProfileImportDate(data);
  const games = getProfileGameCount(data);
  const displayName = hasReport ? playerIdentity.displayName || "Name not available" : "Name not available";
  const formattedUsername =
    hasReport || username ? formatProfileUsername(playerIdentity.username) || "No saved report yet" : "No saved report yet";
  const styleLabel = hasReport ? getProfileStyleLabel(data, fitData) : "Analyse a username to build your profile";
  const lastAnalysed = hasReport ? formatProfileDate(analysedAt) : "No saved report yet";
  const contact = accountUser?.email || formattedUsername;
  const progress = getProfileProgressSummary(data, openingFitUserState, savedOpeningGamificationProgress);

  return (
    <section className="profileHeroDashboard profileChessIdentityHero">
      <div className="profileHeroCopy">
        <p className="eyebrow">Chess identity</p>
        <h1>{displayName}</h1>
        <p>
          {hasReport
            ? "Your saved chess profile: style, repertoire anchors, and latest report status."
            : "Analyse a username to build your profile."}
        </p>
        <div className="profileHeroIdentityInline">
          {hasReport ? (
            <PlayerIdentity identity={playerIdentity} platformLabel={platformLabel} />
          ) : (
            <strong>{contact || "No account connected"}</strong>
          )}
          <small>
            {hasReport
              ? `${platformLabel} - ${styleLabel} - ${lastAnalysed}`
              : accountUser?.email
                ? accountUser.email
                : "Analyse a username to build your profile"}
          </small>
        </div>
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

      <div className="profileStatusStrip" aria-label="Account status summary">
        <article>
          <span>Account</span>
          <strong>{contact || "Not signed in"}</strong>
        </article>
        <article>
          <span>Plan</span>
          <strong>{planLabel}</strong>
        </article>
        <article>
          <span>Streak</span>
          <strong>{progress.streak ? `${progress.streak} day${progress.streak === 1 ? "" : "s"}` : "No streak yet"}</strong>
        </article>
        <article>
          <span>Trained</span>
          <strong>{progress.trainedOpenings ? `${progress.trainedOpenings} openings` : "No training yet"}</strong>
        </article>
        <article>
          <span>Mastered</span>
          <strong>{progress.masteredOpenings ? `${progress.masteredOpenings} openings` : "No mastery yet"}</strong>
        </article>
        <article>
          <span>Games</span>
          <strong>{hasReport ? games || 0 : "No report yet"}</strong>
        </article>
      </div>
    </section>
  );
}

function ProfileKeyStatsCard({
  data,
  accountUser,
  reportHistory = [],
  recommendationHistory = [],
  retentionSnapshots = [],
}) {
  const savedReports = accountUser?.id
    ? (Array.isArray(reportHistory) ? reportHistory.length : 0)
    : readLocalProfileHistory().length;
  const savedSnapshots = Array.isArray(retentionSnapshots) ? retentionSnapshots.length : 0;
  const recommendationSnapshots = Array.isArray(recommendationHistory) ? recommendationHistory.length : 0;
  const games = getProfileGameCount(data);
  const lastAnalysed = data ? formatProfileDate(getProfileImportDate(data)) : "No saved report yet";

  return (
    <section className="profileDashboardCard profileKeyStatsCard" aria-label="Profile key stats">
      <div className="profileCardHeader">
        <p className="eyebrow">Key stats</p>
        <h2>Your OpeningFit activity</h2>
      </div>
      <div className="profileKeyStatsGrid">
        <article>
          <span>Saved reports</span>
          <strong>{savedReports || 0}</strong>
        </article>
        <article>
          <span>Games analysed</span>
          <strong>{games || 0}</strong>
        </article>
        <article>
          <span>Last analysed</span>
          <strong>{lastAnalysed}</strong>
        </article>
        <article>
          <span>History snapshots</span>
          <strong>{savedSnapshots + recommendationSnapshots}</strong>
        </article>
      </div>
    </section>
  );
}

function ChessProfileCard({ data, fitData }) {
  const style = getProfileStyleLabel(data, fitData);
  const summary = getProfileStyleSummary(data, fitData);
  const facts = getProfileOpeningFacts(data, fitData);
  const [playerSummary, setPlayerSummary] = useState("");

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

      <div className="playerSummaryActions">
        <p>Turn this report into a clear summary of the player's opening style, strengths, weaknesses, and next steps.</p>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => setPlayerSummary(buildPlayerSummary(data || {}, fitData || {}))}
        >
          Create Player Summary
        </button>
      </div>

      {playerSummary ? (
        <div className="playerSummaryPanel" aria-live="polite">
          <pre>{playerSummary}</pre>
        </div>
      ) : null}
    </section>
  );
}

function LatestReportCard({ data, fitData, username, platform, onOpenReport }) {
  const playerIdentity = getPlayerIdentity(data, username);
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
          <PlayerIdentity identity={playerIdentity} platformLabel={platformLabel} compact />
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
          {reports.map((item) => {
            const identity = getPlayerIdentity(item, item.username);
            const platformLabel = getProfilePlatformLabel({ platform: item.platform });

            return (
              <article className="profileSavedReportRow" key={item.id}>
                <div>
                  <strong>{formatProfileDate(item.createdAt)}</strong>
                  <span>
                    {identity.displayName}
                    {identity.hasDistinctDisplayName ? ` · @${identity.username}` : ""}
                    {" · "}
                    {platformLabel}
                  </span>
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
            );
          })}
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
      title: "OpeningFit Plus member",
      text: isPremium ? "OpeningFit Plus is active on this profile." : "Save reports and compare opening progress over time.",
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
          <p>Create a free account or log in to keep recommendation history across devices. You can still analyse games locally.</p>
        </div>
        <div className="stateActionRow">
          <a className="primaryBtn" href="/login">Login</a>
          <button type="button" className="secondaryButton" onClick={onAnalyse}>
            Analyse locally
          </button>
        </div>
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
    const sameScore = row?.confidenceScore === current?.confidenceScore;
    return !(sameDate && sameRecommendation && sameScore);
  }) || null;

  if (!current) {
    return (
      <section className="profileDashboardCard recommendationHistoryCard" id="recommendation-history">
        <div className="profileCardHeader">
          <p className="eyebrow">Recommendation History</p>
          <h2>Track how your OpeningFit profile changes</h2>
          <p>No saved recommendation snapshots yet. Analyse your games to create one.</p>
        </div>
        <button type="button" className="primaryBtn" onClick={onAnalyse}>
          Analyse your first games
        </button>
      </section>
    );
  }

  const currentConfidenceScore = current?.confidenceScore ?? null;
  const previousConfidenceScore = previous?.confidenceScore ?? null;
  const confidenceChange =
    currentConfidenceScore !== null && previousConfidenceScore !== null
      ? currentConfidenceScore - previousConfidenceScore
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
            {currentConfidenceScore !== null ? `${currentConfidenceScore}% confidence` : current.recommendationConfidence}
          </p>
        </article>
        <article>
          <span>Previous recommendation</span>
          <strong>{previous?.currentRecommendation || "No previous snapshot yet"}</strong>
          <p>
            {previousConfidenceScore !== null
              ? `${previousConfidenceScore}% confidence`
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

function getCloudSavedGames(snapshot = {}) {
  return (Array.isArray(snapshot.analysed_games) ? snapshot.analysed_games : [])
    .map((row) => row?.game || row?.analysis || null)
    .filter((game) => game && typeof game === "object")
    .map(normalizeGameMetadata);
}

function hydrateReportWithCloudGames(report, snapshot = {}) {
  if (!report || typeof report !== "object") return report;

  const cloudGames = getCloudSavedGames(snapshot);
  if (!cloudGames.length) return report;

  const existingSavedGames = Array.isArray(report.saved_games)
    ? report.saved_games
    : Array.isArray(report.savedGames)
      ? report.savedGames
      : [];
  const savedGames = [...existingSavedGames.map(normalizeGameMetadata), ...cloudGames];

  return {
    ...report,
    saved_games: savedGames,
    savedGames,
  };
}

function getRestoredCloudReport(snapshot = {}) {
  const workspaceReport =
    (snapshot.openingfit_user_state || []).find((row) => row?.last_report)?.last_report ||
    null;
  if (workspaceReport && typeof workspaceReport === "object") {
    const report = hydrateReportWithCloudGames(workspaceReport, snapshot);
    return {
      report,
      username:
        snapshot.openingfit_user_state?.find((row) => row?.last_report)?.username ||
        report.username ||
        report.playerName ||
        "",
      platform:
        snapshot.openingfit_user_state?.find((row) => row?.last_report)?.platform ||
        report.platform ||
        report.importPlatform ||
        "",
    };
  }

  if (snapshot.profile?.last_report && typeof snapshot.profile.last_report === "object") {
    const report = hydrateReportWithCloudGames(snapshot.profile.last_report, snapshot);
    return {
      report,
      username: snapshot.profile.username || report.username || report.playerName || "",
      platform: snapshot.profile.platform || report.platform || report.importPlatform || "",
    };
  }

  const latestReport = getLatestCloudReport(snapshot.report_history || []);
  if (latestReport?.report && typeof latestReport.report === "object") {
    const report = hydrateReportWithCloudGames(latestReport.report, snapshot);
    return {
      report,
      username: latestReport.username || latestReport.summary?.username || report.username || "",
      platform: latestReport.platform || latestReport.summary?.platform || report.platform || "",
    };
  }

  return null;
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

function getRetentionOpeningRows(data, fitData, latestReport) {
  const summaryTopOpenings = Array.isArray(latestReport?.summary?.topOpenings)
    ? latestReport.summary.topOpenings
    : [];
  return uniqueOpeningsByNameAndContext([
    ...(Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []),
    fitData?.bestOpening,
    fitData?.weakestOpening,
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.bestOpenings) ? data.bestOpenings : []),
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.topOpenings) ? data.topOpenings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...summaryTopOpenings,
  ].filter(Boolean)).filter((opening) => !isUnknownOpeningName(getOpeningName(opening)));
}

function getExistingOpeningFitScore(data, fitData, progress) {
  const raw =
    progress?.repertoireConfidenceScore ??
    fitData?.overallScore ??
    data?.openingFitScore ??
    data?.opening_fit_score ??
    data?.retentionMetrics?.openingFitScore ??
    data?.retention_metrics?.opening_fit_score ??
    data?.retentionMetrics?.repertoireHealth?.score ??
    data?.retention_metrics?.repertoire_health?.score ??
    null;
  if (raw === null || raw === undefined || raw === "") return null;
  const number = safeNumber(raw, null);
  if (number === null) return null;
  return Math.max(0, Math.min(100, Math.round(number > 100 ? number / 10 : number)));
}

function calculateRetentionScore({ data, fitData, progress, latestReport, openingFitUserState }) {
  const existing = getExistingOpeningFitScore(data, fitData, progress);
  if (existing !== null) return existing;

  const rows = getRetentionOpeningRows(data, fitData, latestReport);
  const games = getProfileGameCount(data) || progress?.gamesAnalysed || latestReport?.summary?.games || 0;
  const weakLineCount = mergeWeakLines(data || latestReport?.report || {}).length;
  const trainingCompleted = getProfileTrainingCompletedCount(openingFitUserState);

  if (!rows.length && !games && !trainingCompleted) return null;

  // Safe heuristic placeholder: when the backend has no single score yet, blend only existing signals:
  // opening performance, sample size, weak-line count, and completed training. No fake data is invented.
  const scoredRows = rows.filter((opening) => getOpeningGames(opening) > 0 || getWinRate(opening) > 0);
  const averagePerformance = scoredRows.length
    ? Math.round(scoredRows.reduce((total, opening) => total + getWinRate(opening), 0) / scoredRows.length)
    : 50;
  const sampleBonus = Math.min(14, Math.floor(Number(games || 0) / 8));
  const trainingBonus = Math.min(8, Number(trainingCompleted || 0) * 2);
  const weakPenalty = Math.min(24, weakLineCount * 5);

  return Math.max(0, Math.min(100, Math.round(averagePerformance + sampleBonus + trainingBonus - weakPenalty)));
}

function buildWeeklyFocus({ strength, weakness, data, progress }) {
  if (weakness && getOpeningName(weakness) !== "Unknown Opening") {
    const name = getOpeningName(weakness);
    const context = roleNameForAction(weakness);
    if (context.includes("Black vs 1.d4")) return "Review your Black vs d4 repertoire";
    return `Train your ${name} weaknesses`;
  }

  if (progress?.suggestedNextAction) return progress.suggestedNextAction;

  if (strength && getOpeningName(strength) !== "Unknown Opening") {
    return `Keep playing the ${getOpeningName(strength)}`;
  }

  if (getProfileGameCount(data)) return "Review repertoire";
  return "Analyse games to unlock a weekly focus";
}

function getRetentionLastAnalysed(data, progress, latestReport) {
  const raw =
    getProfileImportDate(data) ||
    progress?.lastAnalysisDate ||
    latestReport?.summary?.reportDate ||
    latestReport?.created_at ||
    latestReport?.updated_at ||
    "";
  return raw ? formatProfileDate(raw) : "Not available yet";
}

function OpeningFitRetentionSection({
  data,
  fitData,
  reportHistory = [],
  openingFitUserState = [],
  onAnalyse,
  onTrain,
  compact = false,
}) {
  const latestReport = getLatestCloudReport(reportHistory);
  const progress = getReturnDashboardProgress({ data, fitData, reportHistory, openingFitUserState });
  const sourceData = data || latestReport?.report || null;
  const hasAnySignal = Boolean(sourceData || progress || latestReport);

  if (!hasAnySignal) return null;

  const { strength, weakness } = getDashboardOpeningSignals(sourceData, fitData, latestReport);
  const score = calculateRetentionScore({ data: sourceData, fitData, progress, latestReport, openingFitUserState });
  const games = getProfileGameCount(sourceData) || progress?.gamesAnalysed || latestReport?.summary?.games || 0;
  const strengthName = strength ? getOpeningName(strength) : "Not available yet";
  const weaknessName = weakness ? getOpeningName(weakness) : "Not available yet";
  const weeklyFocus = buildWeeklyFocus({ strength, weakness, data: sourceData, progress });
  const returnPrompt = games
    ? "Come back after 10 more games to see what changed."
    : "Analyse recent games to start tracking progress.";

  return (
    <section className={`openingFitRetentionSection ${compact ? "openingFitRetentionSectionCompact" : ""}`} aria-label="OpeningFit retention dashboard">
      <div className="retentionScoreCard">
        <span>
          OpeningFit Score{" "}
          <OpeningScoreInfoButton
            opening={{
              name: "OpeningFit Score",
              games,
              fitScore: score,
              confidence: score === null ? "Not enough data" : "Report-level estimate",
              nextAction: "Play a few more games, then reanalyse to see whether the same weakness repeats.",
            }}
            score={score}
          />
        </span>
        <strong>{score === null ? "—" : score}</strong>
        <small>{score === null ? "Not enough data yet" : "out of 100"}</small>
      </div>

      <div className="retentionMainCard">
        <p className="eyebrow">Weekly Focus</p>
        <h2>{weeklyFocus}</h2>
        <p>{returnPrompt}</p>
        <div className="retentionActions">
          {weakness ? (
            <button type="button" className="primaryBtn" onClick={() => onTrain?.(weakness)}>
              Train this week
            </button>
          ) : null}
          <button type="button" className={weakness ? "secondaryButton" : "primaryBtn"} onClick={onAnalyse}>
            Analyse new games
          </button>
        </div>
      </div>

      <div className="retentionSnapshotGrid" aria-label="Progress snapshot">
        <article>
          <span>Last analysed</span>
          <strong>{getRetentionLastAnalysed(sourceData, progress, latestReport)}</strong>
        </article>
        <article>
          <span>Games analysed</span>
          <strong>{games || "Not available yet"}</strong>
        </article>
        <article>
          <span>Biggest strength</span>
          <strong>{strengthName}</strong>
        </article>
        <article>
          <span>Biggest weakness</span>
          <strong>{weaknessName}</strong>
        </article>
      </div>
    </section>
  );
}

function OpeningFitVerdictPanel({
  data,
  fitData,
  reportHistory = [],
  openingFitUserState = [],
}) {
  const latestReport = getLatestCloudReport(reportHistory);
  const progress = getReturnDashboardProgress({ data, fitData, reportHistory, openingFitUserState });
  const sourceData = data || latestReport?.report || null;
  const { strength, weakness } = getDashboardOpeningSignals(sourceData, fitData, latestReport);
  const score = calculateRetentionScore({ data: sourceData, fitData, progress, latestReport, openingFitUserState });
  const identity = sourceData?.openingIdentity || sourceData?.opening_identity || sourceData?.retentionMetrics?.openingIdentity || {};
  const styleProfile = sourceData?.styleProfile || sourceData?.style_profile || {};
  const identityLabel = simpleStyleLabel(
    identity.label ||
      identity.name ||
      styleProfile.primaryStyle ||
      styleProfile.primary_style ||
      styleProfile.label ||
      styleProfile.primary ||
      styleProfile.summary
  );
  const identityReasons = [
    ...(Array.isArray(identity.reasons) ? identity.reasons : []),
    styleProfile.summary,
    strength ? `Best current signal: ${getOpeningContextTitle(strength)}.` : null,
    weakness ? `Main repair target: ${getOpeningContextTitle(weakness)}.` : null,
  ].filter(Boolean);
  const games = getProfileGameCount(sourceData) || progress?.gamesAnalysed || latestReport?.summary?.games || 0;

  return (
    <section className="verdict-panel" aria-label="Verdict summary">
      <div className="verdict-card-grid">
        <article className="verdict-summary-card verdict-summary-card--identity">
          <p className="eyebrow">Opening Identity</p>
          <h2>{identityLabel} opening profile</h2>
          <p>
            {identityReasons[0] ||
              "OpeningFit needs a few more repeated games before it can describe your opening style clearly."}
          </p>
          <span>{identityReasons[1] || "Keep the next import focused on recent rapid or blitz games."}</span>
        </article>

        <article className="verdict-summary-card verdict-summary-card--score">
          <p className="eyebrow openingScoreEyebrow">
            OpeningFit Score{" "}
            <OpeningScoreInfoButton
              opening={{
                name: "OpeningFit Score",
                games: (Array.isArray(fitData?.scoredOpenings) ? fitData.scoredOpenings : []).reduce(
                  (total, opening) => total + getOpeningGames(opening),
                  0
                ),
                fitScore: score,
                confidence: score === null ? "Not enough data" : "Report-level estimate",
                nextAction: "Use the score to pick one opening to keep and one repeated line to repair next.",
              }}
              score={score}
            />
          </p>
          <strong>{score === null ? "--" : score}</strong>
          <span>{score === null ? "Not enough data yet" : "out of 100"}</span>
          <p>Scores, journeys, and previous-analysis changes are kept below for review.</p>
        </article>

        <article className="verdict-summary-card verdict-summary-card--snapshot">
          <p className="eyebrow">Progress Snapshot</p>
          <dl className="verdict-snapshot-list">
            <div>
              <dt>Last analysed</dt>
              <dd>{getRetentionLastAnalysed(sourceData, progress, latestReport)}</dd>
            </div>
            <div>
              <dt>Games analysed</dt>
              <dd>{games || "Not available yet"}</dd>
            </div>
            <div>
              <dt>Biggest strength</dt>
              <dd>{strength ? getOpeningName(strength) : "Not available yet"}</dd>
            </div>
            <div>
              <dt>Biggest weakness</dt>
              <dd>{weakness ? getOpeningName(weakness) : "Not available yet"}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
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
    { label: "Training plan", action: onStudyPlan },
    { label: "Progress", action: onProgress },
    { label: "History", action: onHistory },
    { label: "Settings", action: onSettings },
  ];

  return (
    <section className="returnUserDashboard" id="return-user-dashboard">
      <div className="returnDashboardHero">
        <div>
          <p className="eyebrow">OpeningFit home</p>
          <h1>{hasPreviousData ? `Welcome back, ${displayName}` : "Find your best openings"}</h1>
          <p>
            {hasPreviousData
              ? "Check your focus, train one line, then come back after more games."
              : "Analyse your games and build a repertoire from your own results."}
          </p>
        </div>
        <div className="returnDashboardScore" aria-label={`Current repertoire score ${score ?? confidence}`}>
          <span>
            OpeningFit Score{" "}
            <OpeningScoreInfoButton
              opening={{
                name: "OpeningFit Score",
                games: getProfileGameCount(data) || 0,
                fitScore: score,
                confidence: score !== null && score !== undefined ? "Saved progress estimate" : "Not enough data",
                nextAction: "Continue from the saved training target, then compare the next report.",
              }}
              score={score}
            />
          </span>
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
            Train this line
          </button>
        </article>
        <article className="returnDashboardTileWeapon">
          <span>Best opening</span>
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
          <span>Next action</span>
          <strong>{hasPreviousData ? "Analyse your games" : "Analyse your first games"}</strong>
          <p>Last import: {lastImportCopy}. {games ? `${games} games feed this profile.` : "Your first import starts the loop."}</p>
          <button type="button" className="primaryBtn" onClick={onAnalyse}>
            Analyse your games
          </button>
        </article>
      </div>

      <div className="returnDashboardActions">
        <button type="button" className="primaryBtn" onClick={onAnalyse}>
          Analyse your games
        </button>
        <button type="button" className="secondaryButton" onClick={onViewRepertoire} disabled={!hasPreviousData}>
          Review repertoire
        </button>
        <button type="button" className="secondaryButton" onClick={onStudyPlan}>
          Train weak lines
        </button>
      </div>
    </section>
  );
}

function FounderPassProfileCard({ isPremium, entitlement, onFounderPass }) {
  const valueBullets = [
    "Save every report",
    "Compare progress over time",
    "Track weak lines",
    "Personal repertoire plan",
    "Weekly review tracking",
  ];
  const trustItems = ["Built for club players", "Monthly or annual billing", "Cancel in account settings"];

  return (
    <section className={isPremium ? "profileFounderCard profileFounderCardActive" : "profileFounderCard"}>
      <div className="profileFounderMain">
        <p className="eyebrow">OpeningFit Plus</p>
        <h2>{isPremium ? subscriptionPresentation(entitlement).planName : "Save and compare your opening progress"}</h2>
        <p>
          {isPremium
            ? "Your profile has Plus or preserved lifetime access. Saved reports and progress tracking stay attached to this account."
            : "Turn the free snapshot into saved reports, weak-line tracking, and a personal repertoire plan."}
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
        <span>Subscription plans</span>
        <strong>From £4.99/month</strong>
        <div className="profileFounderOfferBadges" aria-label="OpeningFit Plus offer details">
          <span>Monthly or annual</span>
          <span>Cancel in settings</span>
        </div>
        <small>Existing lifetime members retain lifetime access.</small>
        {!isPremium ? (
          <button type="button" className="primaryBtn" onClick={onFounderPass}>
            View Plus plans
          </button>
        ) : (
          <span className="profileFounderStatus">Active</span>
        )}
      </div>
    </section>
  );
}

function readLocalJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function getProfileSavedReportCount(accountUser, reportHistory = []) {
  if (accountUser?.id) return Array.isArray(reportHistory) ? reportHistory.length : 0;
  return readLocalProfileHistory().length;
}

function getProfileTrainingCompletedCount(openingFitUserState = []) {
  const rows = Array.isArray(openingFitUserState) ? openingFitUserState : [];
  const cloudCompleted = rows.reduce((total, row) => {
    const progress = row?.coach_progress?.openingTraining || row?.coach_progress?.opening_training || {};
    const completedLines = progress.completedLines || progress.completed_lines || {};
    const weakestHistory = row?.coach_progress?.weakestLineTrainingHistory || row?.coach_progress?.weakest_line_training_history || [];
    return total + Object.keys(completedLines).length + (Array.isArray(weakestHistory) ? weakestHistory.filter((item) => item?.completed).length : 0);
  }, 0);
  const localProgress = readLocalJson("openingFit:openingTrainingProgress", {});
  const localCompleted = Object.keys(localProgress?.completedLines || {}).length;
  return Math.max(cloudCompleted, localCompleted);
}

function getProfileBoardThemeLabel() {
  const key = typeof window !== "undefined" ? localStorage.getItem("openingFit:boardTheme") : "";
  const labels = {
    classic: "Classic",
    tournament: "Tournament",
    ocean: "Ocean",
    forest: "Forest",
    slate: "Slate",
  };
  return labels[key] || (key ? reportTitleCase(key) : "Not available yet");
}

function SimpleProfileCard({ eyebrow, title, children, actions, className = "" }) {
  return (
    <section className={`simpleProfileCard ${className}`}>
      <div className="simpleProfileCardHeader">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
      {actions ? <div className="simpleProfileActions">{actions}</div> : null}
    </section>
  );
}

function ProfileAccountSimpleCard({
  data,
  accountUser,
  username,
  platform,
  onUserChange,
  onCloudRestore,
  defaultOpen = false,
}) {
  const identity = getPlayerIdentity(data || {}, username || accountUser?.email || "");
  const platformLabel = data || username ? getProfilePlatformLabel(data || {}, platform) : "Not available yet";
  const displayName =
    accountUser?.user_metadata?.full_name ||
    accountUser?.user_metadata?.display_name ||
    identity.displayName ||
    "Name not available";
  const email = accountUser?.email || "Not signed in";

  return (
    <SimpleProfileCard eyebrow="Account" title="Account" className="simpleProfileCard--account">
      <span className="profileLoginAnchor" id="profile-account" aria-hidden="true" />
      <span className="profileLoginAnchor" id="login" aria-hidden="true" />
      <div className="simpleAccountRow">
        {identity.avatarUrl ? (
          <img src={identity.avatarUrl} alt="" className="simpleProfileAvatar" width="64" height="64" loading="lazy" decoding="async" />
        ) : (
          <span className="simpleProfileAvatar simpleProfileAvatarFallback">{getPlayerInitials(displayName || email)}</span>
        )}
        <div>
          <strong>{displayName}</strong>
          <span>{email}</span>
          <small>{identity.username ? `${formatProfileUsername(identity.username)} · ${platformLabel}` : platformLabel}</small>
        </div>
      </div>

      <details className="simpleProfileNestedDetails" open={defaultOpen || undefined}>
        <summary>{accountUser?.id ? "Account controls" : "Sign in or create account"}</summary>
        <AccountPanel variant="screen" onUserChange={onUserChange} onCloudRestore={onCloudRestore} />
      </details>
    </SimpleProfileCard>
  );
}

function ProfileStatsSimpleCard({
  data,
  accountUser,
  reportHistory = [],
  openingFitUserState = [],
}) {
  const games = data ? getProfileGameCount(data) : 0;
  const savedReports = getProfileSavedReportCount(accountUser, reportHistory);
  const trainingCompleted = getProfileTrainingCompletedCount(openingFitUserState);
  const lastAnalysed = data ? formatProfileDate(getProfileImportDate(data)) : "Not available yet";

  return (
    <SimpleProfileCard eyebrow="Stats" title="Stats" className="simpleProfileCard--stats">
      <div className="simpleProfileStatGrid">
        <article>
          <span>Total games analysed</span>
          <strong>{games || "Not available yet"}</strong>
        </article>
        <article>
          <span>Reports saved</span>
          <strong>{savedReports || "Not available yet"}</strong>
        </article>
        <article>
          <span>Training completed</span>
          <strong>{trainingCompleted || "Not available yet"}</strong>
        </article>
        <article>
          <span>Last analysis date</span>
          <strong>{lastAnalysed}</strong>
        </article>
      </div>
    </SimpleProfileCard>
  );
}

function ProfilePreferencesSimpleCard({ theme, onThemeToggle, onTrainingPreferences }) {
  return (
    <SimpleProfileCard
      eyebrow="Preferences"
      title="Preferences"
      className="simpleProfileCard--preferences"
      actions={
        <div className="simpleProfileCardActions">
          {onTrainingPreferences ? <button type="button" className="secondaryButton" onClick={onTrainingPreferences}>Training preferences</button> : null}
          {onThemeToggle ? <button type="button" className="secondaryButton" onClick={onThemeToggle}>Switch to {theme === "light" ? "dark" : "light"} mode</button> : null}
        </div>
      }
    >
      <div className="simpleProfileStatGrid simpleProfileStatGridCompact">
        <article>
          <span>Board theme</span>
          <strong>{getProfileBoardThemeLabel()}</strong>
        </article>
        <article>
          <span>Piece style</span>
          <strong>Not available yet</strong>
        </article>
        <article>
          <span>Display mode</span>
          <strong>{theme ? reportTitleCase(theme) : "Not available yet"}</strong>
        </article>
      </div>
    </SimpleProfileCard>
  );
}

function ProfileSubscriptionSimpleCard({ isPremium, isPremiumPreview, accountUser, entitlement, onFounderPass }) {
  const plan = getProfilePlanLabel({ isPremium, isPremiumPreview, accountUser, entitlement });
  return (
    <SimpleProfileCard
      eyebrow="Subscription"
      title="Subscription"
      className="simpleProfileCard--subscription"
      actions={
        <button type="button" className={isPremium ? "secondaryButton" : "primaryBtn"} onClick={onFounderPass}>
          {isPremium ? "Manage access" : "Upgrade"}
        </button>
      }
    >
      <div className="simpleProfileSubscription">
        <span>Current tier</span>
        <strong>{plan}</strong>
        <p>{isPremium ? "Saved reports and progress tracking are active on this account." : "Free account. Upgrade when you want saved reports, weak-line tracking, and progress comparisons."}</p>
      </div>
    </SimpleProfileCard>
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
  entitlement,
  onAnalyse,
  onOpenReport,
  onPractice,
  onReviewSession,
  onSeeSessionPlan,
  onLoadReport,
  onFounderPass,
  onCloudRestore,
  onUserChange,
  reportHistory = [],
  openingFitUserState = [],
  retentionSnapshots = [],
  recommendationHistory = [],
  authLoading = false,
  profileLoading = false,
  authHydrated = true,
  profileError = "",
  restoreError = "",
  theme = "dark",
  onThemeToggle,
  onTrainingPreferences,
  activeView = "profile",
  onAnalytics,
}) {
  const accountState = accountExperienceState({ authLoading, authHydrated, profileLoading, user: accountUser });
  if (accountState === "checking_session" || accountState === "restoring_account") {
    return <section className="profileAccountLoading" aria-busy="true" aria-live="polite"><span>Account</span><h1>{accountState === "checking_session" ? "Checking your session…" : "Restoring your account…"}</h1><p>OpeningFit is securely checking your session and saved account data.</p></section>;
  }
  if (accountState === "signed_out") {
    return <section className="profileSignedOutAuth" id="login" aria-label="OpeningFit login"><AccountPanel variant="screen" onUserChange={onUserChange} onCloudRestore={onCloudRestore} /></section>;
  }
  const hasStoredProgress =
    accountUser?.id &&
    (Array.isArray(openingFitUserState) ? openingFitUserState : []).some(
      (row) => row?.coach_progress?.openingFitProgress || row?.coach_progress?.opening_fit_progress
    );
  const savedOpeningGamificationProgress =
    (Array.isArray(openingFitUserState) ? openingFitUserState : [])
      .map((row) => row?.coach_progress?.openingGamification || null)
      .filter(Boolean)[0] || null;
  const connectedUsername =
    username ||
    accountUser?.user_metadata?.lichess_username ||
    accountUser?.user_metadata?.chess_username ||
    accountUser?.user_metadata?.preferred_username ||
    "";
  const currentPath = getCurrentPath();
  const shouldOpenAccountDetails = currentPath === "/login" || currentPath === "/account";
  const showHistoryPage = activeView === "history";
  const profileLoadMessage = profileError || restoreError || "";

  return (
    <div className={`profileDashboard profileDashboardSimple ${data ? "" : "profileDashboardNoReport"}`}>
      {profileLoadMessage ? (
        <div className="profileLoadNotice" role="status">
          <strong>Profile loaded with limited cloud data</strong>
          <span>{profileLoadMessage}</span>
        </div>
      ) : null}

      <div className="simpleProfileGrid">
        <ProfileAccountSimpleCard
          data={data}
          accountUser={accountUser}
          username={data ? username : connectedUsername}
          platform={platform}
          onUserChange={onUserChange}
          onCloudRestore={onCloudRestore}
          defaultOpen={shouldOpenAccountDetails}
        />
        <div className="simpleProfileSideColumn">
          <ProfileStatsSimpleCard
            data={data}
            accountUser={accountUser}
            reportHistory={reportHistory}
            openingFitUserState={openingFitUserState}
          />
          <ProfilePreferencesSimpleCard theme={theme} onThemeToggle={onThemeToggle} onTrainingPreferences={onTrainingPreferences} />
          <ProfileSubscriptionSimpleCard
            isPremium={isPremium}
            isPremiumPreview={isPremiumPreview}
            accountUser={accountUser}
            entitlement={entitlement}
            onFounderPass={onFounderPass}
          />
        </div>
      </div>

      <div className="simpleProfilePrimaryActions">
        <button type="button" className="primaryBtn" onClick={onAnalyse}>
          Analyse new games
        </button>
        {data ? (
          <button type="button" className="secondaryButton" onClick={onOpenReport}>
            View latest report
          </button>
        ) : null}
      </div>

      <ProfileInsightsBoundary>
      <WeeklyOpeningSessionCard
        data={data}
        fitData={fitData}
        onPractice={onPractice}
        onReview={(route) => onReviewSession?.(route)}
        onFullPlan={onSeeSessionPlan}
        showEmptyState
      />

      {data ? (
        <DailyMissionCard
          data={data}
          fitData={fitData}
          onStartTraining={(recommendation) => {
            onAnalytics?.("coach_mission_started", {
              opening: getOpeningName(recommendation),
              source: "profile_mission",
            });
            onPractice?.(recommendation);
          }}
        />
      ) : null}

      {accountUser?.id ? <OpeningHealthTrends reportHistory={reportHistory} /> : null}

      <OpeningProgressTimeline
        data={data}
        fitData={fitData}
        reportHistory={reportHistory}
        openingFitUserState={openingFitUserState}
        onAction={(route) => {
          if (route === "analyse") onAnalyse?.();
          else if (route === "report") onOpenReport?.();
        }}
      />

      <OpeningMilestones
        data={data}
        fitData={fitData}
        reportHistory={reportHistory}
        openingFitUserState={openingFitUserState}
      />

      <MonthlyRecapCard
        data={data}
        fitData={fitData}
        reportHistory={reportHistory}
        openingFitUserState={openingFitUserState}
      />

      {showHistoryPage ? (
        <ReportHistoryVault data={data} fitData={fitData} onLoadReport={onLoadReport} />
      ) : null}

      <details className="profileSecondaryDetails profileAdvancedDetails">
        <summary>
          <span>Saved data</span>
          <strong>Saved reports, progress, and advanced settings</strong>
        </summary>
        <div className="profileDisclosureBody">
          {data ? (
            <>
              <LatestReportCard
                data={data}
                fitData={fitData}
                username={username}
                platform={platform}
                onOpenReport={onOpenReport}
              />
              <ChessProfileCard data={data} fitData={fitData} />
            </>
          ) : null}

          <WeeklyOpeningSummaryCompact retentionSnapshots={retentionSnapshots} onAnalyse={onAnalyse} />
          <SavedReportsProfileCard onLoadReport={onLoadReport} onCreateReport={onAnalyse} />

          {accountUser?.id || hasStoredProgress ? (
            <OpeningFitProgressCard
              data={data}
              fitData={fitData}
              accountUser={accountUser}
              reportHistory={reportHistory}
              openingFitUserState={openingFitUserState}
              onAnalyse={onAnalyse}
              onOpenReport={onOpenReport}
            />
          ) : null}

          {data || savedOpeningGamificationProgress ? (
            <OpeningGamificationProgress
              data={data}
              fitData={fitData}
              savedProgress={savedOpeningGamificationProgress}
            />
          ) : null}

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

          {data ? <ProfileAchievementsCard data={data} fitData={fitData} isPremium={isPremium} /> : null}
          <FounderPassProfileCard isPremium={isPremium} entitlement={entitlement} onFounderPass={onFounderPass} />
        </div>
      </details>
      </ProfileInsightsBoundary>
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
                        <em>
                          Lower priority
                          <RecommendationReasonHint item={item} label="Lower priority" />
                        </em>
                      ) : null}
                      <button type="button" onClick={() => onPractice?.(item)}>
                        Train This Line
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
                  .map((item, index) => (
                    <span key={`${item.name}-${item.context || item.side || index}`}>
                      {item.name}
                      <RecommendationReasonHint item={item} label="Lower priority" />
                    </span>
                  ))}
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
            Found in your games, but too thin for the main verdict.
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
          <span>OpeningFit Plus</span>
          <h3>Want to save and compare this repertoire plan?</h3>
          <p>
            Your free report shows the headline patterns. OpeningFit Plus adds
            saved report history, colour-split repertoire review, weak-line
            tracking, and a practical training plan.
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
        <h2>Your repertoire</h2>
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
                      onClick={() => onPractice?.(first)}
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

class ProfileInsightsBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn("OpeningFit optional profile insights failed safely", {
      name: error?.name,
      message: error?.message,
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="profileLoadNotice" role="status">
          <strong>Some profile insights could not be displayed</strong>
          <span>Your account controls and login remain available. Refresh after your next analysis to rebuild these insights.</span>
        </section>
      );
    }
    return this.props.children;
  }
}

function DecisionReportHeader({ model, onReanalyse }) {
  const { header } = model;
  const identity = header.username && header.username !== header.displayName
    ? `${header.displayName} · @${header.username}`
    : header.displayName;
  return (
    <header className="decisionReportHeader">
      <div>
        <p className="eyebrow">OpeningFit report</p>
        <h1>{identity}</h1>
        <div className="decisionReportMeta" aria-label="Report context">
          <span>{header.platform}</span>
          {header.rating ? <span>{header.rating} rating</span> : null}
          {header.timeControl ? <span>{header.timeControl}</span> : null}
          <span>{header.games} analysed game{header.games === 1 ? "" : "s"}</span>
          <span>{header.period}</span>
          <span>{header.date ? safeDate(header.date) : "Report date unavailable"}</span>
        </div>
      </div>
      <button type="button" className="secondaryBtn" onClick={onReanalyse}>Reanalyse</button>
    </header>
  );
}

function CoachDecisionVerdict({ model }) {
  return (
    <section className="coachDecisionVerdict" id="report-verdict" aria-labelledby="coach-decision-title">
      <div>
        <p className="eyebrow">Coach verdict</p>
        <h2 id="coach-decision-title">Your opening situation</h2>
        <p>{model.verdict.paragraph}</p>
      </div>
      <dl>
        <div><dt>Strongest area</dt><dd>{model.verdict.strongest}</dd></div>
        <div><dt>Most important weakness</dt><dd>{model.verdict.weakness}</dd></div>
        <div><dt>Next decision</dt><dd>{model.verdict.nextDecision}</dd></div>
      </dl>
    </section>
  );
}

function RecommendationFeedback({ decision, onFeedback }) {
  const [state, setState] = useState("idle");
  const choices = [["helpful", "Helpful"], ["not_helpful", "Not helpful"], ["already_know", "I already know this"], ["do_not_want", "I do not want to play this"], ["misidentified", "This opening was misidentified"]];
  const submit = async (feedback) => {
    setState("saving");
    const saved = await saveRecommendationFeedback(onFeedback, { feedback, opening: decision.opening, decision: decision.type, confidence: decision.confidenceDetail.level, games: decision.games });
    setState(saved ? "saved" : "error");
  };
  return <fieldset className="recommendationFeedback" disabled={state === "saving"}><legend>Was this useful?</legend><div>{choices.map(([value, label]) => <button type="button" key={value} onClick={() => submit(value)}>{label}</button>)}</div><small role="status">{state === "saved" ? "Feedback saved. Thank you." : state === "error" ? "Feedback was not saved. Please try again." : ""}</small></fieldset>;
}

function ReportDecisionCards({ model, onPractice, onEvidence, onRepertoire, onFeedback }) {
  const labels = { keep: "Keep", repair: "Repair", reduce: "Choose, reduce or replace" };
  if (!model.decisions.length) return null;
  const sendToRepertoire = (decision, type) => {
    const section = ({ black_e4: "blackE4", black_d4: "blackD4", black_other: "other", unresolved: "other" })[decision.contextKey] || decision.contextKey;
    try { localStorage.setItem(REPERTOIRE_PENDING_KEY, JSON.stringify({ type, item: { section, sectionLabel: decision.context, name: decision.opening, opening: decision.source, games: decision.games, fit: decision.score } })); } catch { /* Navigation still works when storage is unavailable. */ }
    onRepertoire?.(decision);
  };
  return (
    <section className="reportDecisionSection" aria-labelledby="report-decisions-title">
      <header><p className="eyebrow">Repertoire decisions</p><h2 id="report-decisions-title">Three decisions, ordered by priority</h2></header>
      <div className="reportDecisionGrid">
        {model.decisions.map((decision) => (
          <article className={`reportDecisionCard reportDecisionCard--${decision.type}`} key={decision.type}>
            <span className="reportDecisionLabel">{labels[decision.type]}</span>
            <h3>{decision.opening}</h3>
            <strong>{decision.context}</strong>
            <p>{decision.reason}</p>
            <div className="reportDecisionEvidence"><span>{decision.fitLabel}</span><span>{decision.confidence}</span><span>{decision.games} game{decision.games === 1 ? "" : "s"}</span></div>
            <p className="reportDecisionPerformance"><strong>Performance:</strong> {decision.performance}{decision.score !== null ? ` · Fit ${decision.score}/100` : ""}</p>
            <div className="reportDecisionActions">
              <button type="button" onClick={() => { void onFeedback?.("evidence_viewed", { source: "recommendation", openingCategory: decision.contextKey }); onEvidence?.(decision); }}>View evidence</button>
              <button type="button" onClick={() => sendToRepertoire(decision, "add")}>Add to repertoire</button>
              <button type="button" onClick={() => sendToRepertoire(decision, "replace")}>Replace current</button>
              <button type="button" onClick={() => sendToRepertoire(decision, "add")}>Save as alternative</button>
              {decision.type === "repair" ? <button type="button" onClick={() => onPractice?.(decision.source)}>Practise this line</button> : null}
              <button type="button" onClick={() => { void onFeedback?.("recommendation_dismissed", { decision: decision.type, openingCategory: decision.contextKey }); void saveRecommendationFeedback(onFeedback, { feedback: "dismissed", opening: decision.opening, decision: decision.type }); }}>Dismiss</button>
              <button type="button" onClick={() => saveRecommendationFeedback(onFeedback, { feedback: "already_know", opening: decision.opening, decision: decision.type })}>Already known</button>
            </div>
            <details onToggle={(event) => { if (event.currentTarget.open) { void onFeedback?.("recommendation_expanded", { decision: decision.type, openingCategory: decision.contextKey }); void onFeedback?.("fit_explanation_opened", { source: "recommendation", openingCategory: decision.contextKey }); } }}>
              <summary>Why this recommendation?</summary>
              <dl>
                <div><dt>Sample</dt><dd>{decision.games || "Unavailable"} games</dd></div>
                <div><dt>Performance</dt><dd>{decision.performance}</dd></div>
                <div><dt>Confidence</dt><dd>{decision.confidence}</dd></div>
                {decision.evidence.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                {model.header.period ? <div><dt>Analysis period</dt><dd>{model.header.period}</dd></div> : null}
                {model.header.timeControl ? <div><dt>Time controls</dt><dd>{model.header.timeControl}</dd></div> : null}
              </dl>
            </details>
            <RecommendationFeedback decision={decision} onFeedback={onFeedback} />
          </article>
        ))}
      </div>
    </section>
  );
}

function CompactOpeningHealth({ model }) {
  const { health } = model;
  return (
    <section className="compactOpeningHealth" aria-labelledby="opening-health-title">
      <header><p className="eyebrow">Opening health</p><h2 id="opening-health-title">Overall repertoire signal</h2></header>
      <div className="compactOpeningHealthGrid">
        <div className="compactOpeningHealthScore"><span>Fit</span><strong>{health.score ?? "—"}</strong><small>{health.score !== null ? "/100" : "Unavailable"}</small></div>
        <dl>
          <div><dt>Confidence</dt><dd>{health.confidence}</dd></div>
          <div><dt>Games</dt><dd>{health.games}</dd></div>
          <div><dt>Strongest</dt><dd>{health.strongest}</dd></div>
          <div><dt>Weakest</dt><dd>{health.weakest}</dd></div>
          {health.trend !== null ? <div><dt>Trend</dt><dd>{health.trend > 0 ? "+" : ""}{health.trend} since the previous report</dd></div> : null}
        </dl>
      </div>
      <details className="fitMetricDefinitions">
        <summary>What these metrics mean</summary>
        <dl>
          <div><dt>Opening Fit</dt><dd>A suitability signal from available results, repetition, plan clarity and behavioural-fit inputs. It is not chess strength or objective opening quality.</dd></div>
          <div><dt>Performance</dt><dd>The results achieved in the analysed games.</dd></div>
          <div><dt>Confidence</dt><dd>The amount of opening-specific evidence. A high Fit from few games remains low confidence.</dd></div>
          <div><dt>Trend</dt><dd>Change between comparable reports when prior data exists; it is separate from Fit.</dd></div>
        </dl>
      </details>
    </section>
  );
}

function CostlyIssuesSection({ model, onPractice, onEvidence }) {
  if (!model.issues.length) return null;
  return (
    <section className="costlyIssuesSection" id="weak-lines" aria-labelledby="costly-issues-title">
      <header><p className="eyebrow">What is costing you games</p><h2 id="costly-issues-title">Recurring issues ranked by affected and lost games</h2></header>
      <ol>
        {model.issues.map((issue, index) => (
          <li key={`${issue.opening}-${index}`}>
            <span>{index + 1}</span>
            <div><h3>{issue.opening}</h3>{issue.line ? <strong>{issue.line}</strong> : null}<p>{issue.explanation}</p><small>{issue.affectedGames} affected game{issue.affectedGames === 1 ? "" : "s"}{issue.lostGames ? ` · ${issue.lostGames} losses` : ""}</small></div>
            <div><button type="button" onClick={() => onEvidence?.(issue)}>Supporting games</button><button type="button" onClick={() => onPractice?.(issue.source)}>Train</button></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DecisionRepertoireMap({ model, onPractice, onEvidence }) {
  if (!model.repertoire.length) return null;
  return (
    <section className="decisionRepertoireMap" id="repertoire-map" aria-labelledby="decision-map-title">
      <header><p className="eyebrow">Repertoire map</p><h2 id="decision-map-title">Your current opening roles</h2></header>
      <div>
        {model.repertoire.map((area) => (
          <article key={area.key}>
            <span>{area.label}</span><h3>{area.opening}</h3>
            <dl><div><dt>Verdict</dt><dd>{area.verdict}</dd></div>{area.fit !== null ? <div><dt>Fit</dt><dd>{area.fit}%</dd></div> : null}<div><dt>Confidence</dt><dd>{area.confidence}</dd></div>{area.weakestLine ? <div><dt>Weakest recurring line</dt><dd>{area.weakestLine}</dd></div> : null}</dl>
            <p>{area.nextAction}</p>
            <div><button type="button" onClick={() => onEvidence?.(area)}>Evidence</button><button type="button" onClick={() => onPractice?.(area.source)}>Train next</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FiniteTrainingSession({ model, recentGames, onPractice }) {
  const training = model.training;
  if (!training) return null;
  const recent = recentGames?.[0] || null;
  return (
    <section className="finiteTrainingSession" id="report-training-plan" aria-labelledby="finite-training-title">
      <div><p className="eyebrow">Next training session</p><h2 id="finite-training-title">One focused review before your next games</h2><p>A short session should be enough to review this target once; take longer if the position is unfamiliar.</p></div>
      <ol>
        <li><span>Line</span><strong>{training.line || `Specific ${training.opening} line unavailable in this report`}</strong></li>
        <li><span>Position</span><strong>{recent?.opening ? `Review the recent ${recent.opening} game` : "No recent position is attached to this report"}</strong></li>
        <li><span>Repetition</span><strong>Play the line from memory, then correct it once</strong></li>
        <li><span>Next-game objective</span><strong>{training.objective}</strong></li>
      </ol>
      <button type="button" className="primaryBtn" onClick={() => onPractice?.(training.source)}>Start this session</button>
    </section>
  );
}

function getFocusedRepertoirePlan(data) {
  const sections = buildRepertoireReportSections(data);
  const coachPlan = getOpeningCoachInsights(data)?.repertoireRecommendation || {};
  const maintenance = data?.repertoireMaintenanceCost || data?.repertoire_maintenance_cost || {};
  const pickFromSection = (key, limit) => {
    const section = sections.find((item) => item.key === key);
    const candidates = uniqueOpeningsByNameAndContext([
      ...(section?.buckets?.bestFit || []),
      ...(section?.buckets?.needsReview || []),
      ...(section?.buckets?.risky || []),
      ...(section?.buckets?.notEnoughData || []),
    ])
      .filter((opening) => opening && getOpeningName(opening) && !isUnknownOpeningName(getOpeningName(opening)))
      .sort((a, b) => {
        const verdictDelta = confidencePriority(b) - confidencePriority(a);
        if (verdictDelta) return verdictDelta;
        const gamesDelta = getOpeningGames(b) - getOpeningGames(a);
        if (gamesDelta) return gamesDelta;
        return getWinRate(b) - getWinRate(a);
      });

    return candidates.slice(0, limit);
  };
  const row = (slot, question, opening, sectionKey) => ({
    slot,
    question,
    opening,
    sectionKey,
    name: opening ? getOpeningName(opening) : "",
    verdict: opening ? coachVerdictLabel(getOpeningStatusLabel(opening, data), findOpeningCoachDiagnostic(data, opening)) : "Not enough data",
    score: opening ? safeNumber(opening.fitScore ?? opening.openingFitScore ?? getWinRate(opening), null) : null,
    games: opening ? getOpeningGames(opening) : 0,
    reason: opening
      ? findOpeningCoachDiagnostic(data, opening)?.recommendation ||
        opening?.recommendationCopy ||
        opening?.recommendationReason ||
        roleOpeningExplanation(opening, sections.find((section) => section.key === sectionKey) || { empty: "" })
      : "No reliable recommendation yet. Keep importing games in this role.",
  });

  const white = pickFromSection("white_repertoire", 2);
  const e4 = pickFromSection("black_vs_e4", 1);
  const d4 = pickFromSection("black_vs_d4", 1);
  const later = uniqueOpeningsByNameAndContext([
    ...(sections.flatMap((section) => section.buckets.notEnoughData || [])),
    ...(sections.flatMap((section) => section.buckets.risky || [])),
  ])
    .filter((opening) => getOpeningGames(opening) > 0)
    .slice(0, 2);
  const tooManySystems =
    String(maintenance.category || "").toLowerCase().includes("high") ||
    safeNumber(maintenance.familyCount ?? maintenance.family_count, 0) > 3;
  const focusOpening =
    getOpeningCoachInsights(data)?.focusMission?.openingName ||
    getOpeningCoachInsights(data)?.repertoireRecommendation?.focus ||
    white[0]?.name ||
    e4[0]?.name ||
    d4[0]?.name ||
    "";
  const coachWhite = Array.isArray(coachPlan.white) ? coachPlan.white.map((item) => getOpeningName(item)).filter(Boolean) : [];
  const coachE4 = Array.isArray(coachPlan.blackVsE4) ? coachPlan.blackVsE4.map((item) => getOpeningName(item)).filter(Boolean) : [];
  const coachD4 = Array.isArray(coachPlan.blackVsD4) ? coachPlan.blackVsD4.map((item) => getOpeningName(item)).filter(Boolean) : [];
  const byName = (name, fallbackItems) =>
    fallbackItems.find((opening) => normaliseCoachOpeningName(getOpeningName(opening)) === normaliseCoachOpeningName(name)) || fallbackItems[0] || null;
  const coachFallback = (name, context) =>
    name
      ? normalizeRecommendationItem(
          {
            name,
            context,
            games: 0,
            recommendationCopy: "Recommended by the current coach insight object, but the detailed game sample is still thin.",
          },
          context
        )
      : null;

  return {
    rows: [
      ...white.map((opening, index) => row(index === 0 ? "White" : "White backup", "What should I play as White?", opening, "white_repertoire")),
      row("Vs 1.e4", "What should I play against 1.e4?", byName(coachE4[0], e4) || coachFallback(coachE4[0], "black_vs_e4"), "black_vs_e4"),
      row("Vs 1.d4", "What should I play against 1.d4?", byName(coachD4[0], d4) || coachFallback(coachD4[0], "black_vs_d4"), "black_vs_d4"),
    ].filter((item) => item.opening),
    later: later.map((opening) => row("Later", "Not now", opening, itemContext(opening))),
    focusBanner: tooManySystems
      ? maintenance.advice ||
        "You do not need another opening yet. Your fastest improvement is making your current repertoire more reliable."
      : focusOpening
        ? `Before learning something new, make ${focusOpening} more reliable.`
        : "Before learning something new, build a clearer sample in your current openings.",
    coachRationale: coachPlan.rationale || "",
    hasCoachPlan: Boolean(coachWhite.length || coachE4.length || coachD4.length),
  };
}

function movesForReportGame(game = {}) {
  const raw = game.moves;
  if (Array.isArray(raw)) return raw.map((move) => String(move).trim()).filter(Boolean);
  const text = String(game.movesText || game.moves_text || game.moves || game.pgn || "").trim();
  if (!text) return [];
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((token) => token && !/^\d+\.(\.\.)?$/.test(token) && !["1-0", "0-1", "1/2-1/2", "*"].includes(token));
}

function resultScoreForGame(game = {}) {
  const result = String(game.result || "").toLowerCase();
  if (result.includes("win")) return 1;
  if (result.includes("draw")) return 0.5;
  if (result.includes("loss")) return 0;
  return null;
}

function allReportGames(data = {}) {
  const games = [
    ...(Array.isArray(data.recentGames) ? data.recentGames : []),
    ...(Array.isArray(data.recent_games) ? data.recent_games : []),
    ...(Array.isArray(data.openingGames) ? data.openingGames : []),
    ...(Array.isArray(data.opening_games) ? data.opening_games : []),
  ].filter(Boolean);
  const seen = new Set();
  return games.filter((game, index) => {
    const key = game.url || game.gameUrl || game.id || `${getOpeningName(game)}-${movesForReportGame(game).slice(0, 8).join(" ")}-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function opponentReplyForGame(game = {}) {
  const moves = movesForReportGame(game);
  const colour = String(game.colour || game.color || getOpeningSide(game)).toLowerCase();
  if (moves.length < 2 && colour.includes("white")) return null;
  if (!moves.length) return null;

  if (colour.includes("white")) {
    return {
      reply: moves[1],
      branch: moves.slice(0, Math.min(8, moves.length)).join(" "),
      confidence: moves.length >= 4 ? "usable" : "thin",
    };
  }

  if (colour.includes("black")) {
    return {
      reply: moves[0],
      branch: moves.slice(0, Math.min(8, moves.length)).join(" "),
      confidence: moves.length >= 4 ? "usable" : "thin",
    };
  }

  return null;
}

function buildOpponentResponsePrep(data = {}) {
  const grouped = new Map();
  allReportGames(data).forEach((game) => {
    const name = getOpeningName(game);
    if (!name || isUnknownOpeningName(name)) return;
    const replyInfo = opponentReplyForGame(game);
    if (!replyInfo || replyInfo.confidence !== "usable") return;
    const key = `${normaliseCoachOpeningName(name)}::${replyInfo.reply}`;
    const score = resultScoreForGame(game);
    if (!grouped.has(key)) {
      grouped.set(key, {
        openingName: name,
        reply: replyInfo.reply,
        branch: replyInfo.branch,
        games: 0,
        scoreSum: 0,
        scoredGames: 0,
      });
    }
    const row = grouped.get(key);
    row.games += 1;
    if (score !== null) {
      row.scoreSum += score;
      row.scoredGames += 1;
    }
  });

  const byOpening = new Map();
  Array.from(grouped.values())
    .filter((row) => row.games >= 2)
    .forEach((row) => {
      const score = row.scoredGames ? Math.round((row.scoreSum / row.scoredGames) * 100) : null;
      const next = { ...row, score };
      const key = normaliseCoachOpeningName(row.openingName);
      byOpening.set(key, [...(byOpening.get(key) || []), next]);
    });

  return Array.from(byOpening.values())
    .map((branches) => {
      const sorted = [...branches].sort((a, b) => b.games - a.games || (a.score ?? 100) - (b.score ?? 100));
      const hardest = branches
        .filter((branch) => branch.games >= 3 && branch.score !== null)
        .sort((a, b) => a.score - b.score || b.games - a.games)[0];
      const common = sorted[0];
      return {
        ...common,
        isHardest: Boolean(hardest && hardest.reply === common.reply),
        hardestReply: hardest?.reply || "",
        recommendation: hardest && hardest.reply === common.reply
          ? `Practise the first 8 moves against ${common.reply}; this is both common and your hardest response.`
          : `Practise the first 8 moves against ${common.reply} so this common branch feels routine.`,
      };
    })
    .filter((row) => row.games >= 2)
    .sort((a, b) => b.games - a.games)
    .slice(0, 4);
}

function FocusedRepertoireSection({ data, onPractice, onViewEvidence, onAnalytics }) {
  const plan = getFocusedRepertoirePlan(data || {});
  const responses = buildOpponentResponsePrep(data || {});

  useEffect(() => {
    if (plan.rows.length || responses.length) {
      onAnalytics?.("coach_repertoire_opened", {
        rows: plan.rows.length,
        opponentResponses: responses.length,
      });
    }
  }, [onAnalytics, plan.rows.length, responses.length]);

  if (!plan.rows.length && !responses.length) return null;

  const practiceTarget = (row) => ({
    ...(row.opening || {}),
    name: row.name,
    opening: row.name,
    openingName: row.name,
    selectedReason: row.reason,
    source: "focused-repertoire",
  });
  const responsePracticeTarget = (row) => ({
    name: row.openingName,
    opening: row.openingName,
    openingName: row.openingName,
    opponentReply: row.reply,
    moveLine: row.branch,
    selectedReason: row.recommendation,
    source: "opponent-response-prep",
  });

  return (
    <section className="focusedRepertoireSection" id="focused-repertoire" aria-labelledby="focused-repertoire-title">
      <div className="focusedRepertoireHeader">
        <div>
          <p className="eyebrow">Focused repertoire</p>
          <h2 id="focused-repertoire-title">Your focused repertoire</h2>
          <p>One practical answer for each main role, using the recommendations already present in this report.</p>
        </div>
      </div>

      <div className="focusedRepertoireBanner">
        <strong>Focus before learning something new</strong>
        <span>{plan.focusBanner}</span>
        {plan.coachRationale ? <small>{plan.coachRationale}</small> : null}
      </div>

      <div className="focusedRepertoireGrid">
        {plan.rows.map((row) => (
          <article className="focusedRepertoireCard" key={`${row.slot}-${row.name}`}>
            <span>{row.slot}</span>
            <h3>{row.name}</h3>
            <p>{row.question}</p>
            <dl>
              <div>
                <dt>Verdict</dt>
                <dd>{row.verdict}</dd>
              </div>
              <div>
                <dt>Fit</dt>
                <dd>{row.score !== null && row.score !== undefined ? `${Math.round(row.score)}/100` : "Pending"}</dd>
              </div>
              <div>
                <dt>Sample</dt>
                <dd>{row.games} game{row.games === 1 ? "" : "s"}</dd>
              </div>
            </dl>
            <p>{row.reason}</p>
            <div className="focusedRepertoireActions">
              <button
                type="button"
                className="primaryBtn"
                onClick={() => {
                  onAnalytics?.("coach_practice_started", {
                    opening: row.name,
                    source: "focused_repertoire",
                    slot: row.slot,
                  });
                  onPractice?.(practiceTarget(row));
                }}
              >
                Practise
              </button>
              <button
                type="button"
                className="secondaryBtn"
                onClick={() => {
                  onAnalytics?.("coach_diagnostic_opened", {
                    opening: row.name,
                    source: "focused_repertoire",
                    slot: row.slot,
                  });
                  onViewEvidence?.(row.opening);
                }}
              >
                View evidence
              </button>
            </div>
          </article>
        ))}
      </div>

      {plan.later.length ? (
        <details className="focusedRepertoireLater">
          <summary>Later / not now</summary>
          <div>
            {plan.later.map((row) => (
              <span key={`${row.name}-${row.sectionKey}`}>{row.name}: {row.reason}</span>
            ))}
          </div>
        </details>
      ) : null}

      {responses.length ? (
        <div className="opponentResponsePrep">
          <div className="opponentResponsePrepHeader">
            <p className="eyebrow">Opponent response prep</p>
            <h3>What opponents actually play against you</h3>
            <p>Only repeated replies with usable move data are shown.</p>
          </div>
          <div className="opponentResponseGrid">
            {responses.map((row) => (
              <article className="opponentResponseCard" key={`${row.openingName}-${row.reply}`}>
                <span>{row.openingName}</span>
                <h4>Most common reply: {row.reply}</h4>
                <p>{row.score !== null ? `${row.score}% result in this branch` : "Result is not calculable yet"} across {row.games} games.</p>
                {row.isHardest ? <strong>Hardest response in this sample</strong> : null}
                <small>{row.recommendation}</small>
                <code>{row.branch}</code>
                <button
                  type="button"
                  className="secondaryBtn"
                  onClick={() => {
                    onAnalytics?.("coach_practice_started", {
                      opening: row.openingName,
                      reply: row.reply,
                      source: "opponent_response",
                    });
                    onPractice?.(responsePracticeTarget(row));
                  }}
                >
                  Practise this response
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function reportFromHistoryItem(item = {}) {
  return item.report || item.analysis || item.last_report || item.data || item.snapshot?.report || item.snapshot || item;
}

function reportDateValue(report = {}, historyItem = null) {
  return new Date(
    report.importedAt ||
      report.imported_at ||
      report.lastUpdated ||
      report.last_updated ||
      report.savedAt ||
      report.createdAt ||
      report.created_at ||
      historyItem?.summary?.reportDate ||
      historyItem?.summary?.createdAt ||
      historyItem?.summary?.created_at ||
      historyItem?.createdAt ||
      historyItem?.created_at ||
      historyItem?.updatedAt ||
      historyItem?.updated_at ||
      0
  ).getTime() || 0;
}

function previousReportForComparison(current, reportHistory = []) {
  const currentStamp = reportDateValue(current);
  return (Array.isArray(reportHistory) ? reportHistory : [])
    .map((item) => ({
      item,
      report: reportFromHistoryItem(item),
      stamp: reportDateValue(reportFromHistoryItem(item), item),
    }))
    .filter(({ report }) => report && report !== current)
    .sort((a, b) => b.stamp - a.stamp)
    .find(({ stamp }) => !currentStamp || stamp < currentStamp || stamp !== currentStamp)?.report || null;
}

function focusedMissionOpening(data = {}) {
  const mission = getOpeningCoachInsights(data)?.focusMission || {};
  const direct =
    mission.openingName ||
    mission.opening_name ||
    mission.opening ||
    getOpeningCoachInsights(data)?.biggestLeak?.openingName;
  if (direct) return direct;

  const candidates = openingStatCandidatesFromReport(data)
    .filter((item) => !isUnknownOpeningName(getOpeningName(item)))
    .sort((a, b) => getOpeningGames(b) - getOpeningGames(a));

  return getOpeningName(candidates[0]) || "";
}

function openingGamesFromReport(data = {}, openingName = "") {
  data = data || {};
  const key = normaliseCoachOpeningName(openingName);
  if (!key) return [];
  const games = [
    ...(Array.isArray(data.recentGames) ? data.recentGames : []),
    ...(Array.isArray(data.recent_games) ? data.recent_games : []),
    ...(Array.isArray(data.openingGames) ? data.openingGames : []),
    ...(Array.isArray(data.opening_games) ? data.opening_games : []),
  ];
  return games.filter((game) => normaliseCoachOpeningName(getOpeningName(game)) === key);
}

function openingStatCandidatesFromReport(data = {}) {
  data = data || {};
  return [
    ...(Array.isArray(data.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data.bestOpenings) ? data.bestOpenings : []),
    ...(Array.isArray(data.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data.topOpenings) ? data.topOpenings : []),
    ...(Array.isArray(data.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data.openingStats) ? data.openingStats : []),
    ...(Array.isArray(data.preferred_white) ? data.preferred_white : []),
    ...(Array.isArray(data.preferredWhite) ? data.preferredWhite : []),
    ...(Array.isArray(data.preferred_black) ? data.preferred_black : []),
    ...(Array.isArray(data.preferredBlack) ? data.preferredBlack : []),
  ].filter(Boolean);
}

function findOpeningStatInReport(data = {}, openingName = "") {
  const key = normaliseCoachOpeningName(openingName);
  if (!key) return null;
  return (
    openingStatCandidatesFromReport(data).find(
      (item) => normaliseCoachOpeningName(getOpeningName(item)) === key
    ) || null
  );
}

function resultScoreForReportGame(game = {}) {
  const result = String(game.result || "").toLowerCase();
  if (result.includes("win")) return 1;
  if (result.includes("draw")) return 0.5;
  if (result.includes("loss")) return 0;
  return null;
}

function earlyIssueCountForOpening(data = {}, openingName = "") {
  return openingGamesFromReport(data, openingName).filter((game) => {
    const result = String(game.result || "").toLowerCase();
    const moveCount = safeNumber(game.moveCount ?? game.move_count, null);
    const lossTiming = game.lossTiming || game.loss_timing || {};
    const bucket = String(lossTiming.bucket || lossTiming.phase || "").toLowerCase();
    return (
      bucket === "opening" ||
      bucket === "early" ||
      (result.includes("loss") && Number.isFinite(moveCount) && moveCount <= 12)
    );
  }).length;
}

function openingComparisonStats(data = {}, openingName = "") {
  const games = openingGamesFromReport(data, openingName);
  const scored = games.map(resultScoreForReportGame).filter((score) => score !== null);
  const direct = findOpeningCoachDiagnostic(data, { name: openingName });
  const stat = findOpeningStatInReport(data, openingName);
  const winRate = direct?.winRate ?? (scored.length ? Math.round((scored.reduce((sum, score) => sum + score, 0) / scored.length) * 100) : null);
  return {
    games: safeNumber(direct?.games ?? stat?.games ?? stat?.count ?? stat?.total ?? games.length, 0),
    winRate: winRate ?? (stat ? getWinRate(stat) : null),
    earlyIssues: earlyIssueCountForOpening(data, openingName),
  };
}

function buildMissionImprovementComparison(data, reportHistory = []) {
  const openingName = focusedMissionOpening(data);
  const localHistory =
    typeof window !== "undefined"
      ? [
          ...readLocalJson("openingFit:reportHistory", []),
          ...readLocalJson("openingFit:reportHistory:v1", []),
        ]
      : [];
  const previous = previousReportForComparison(data, [
    ...(Array.isArray(reportHistory) ? reportHistory : []),
    ...(Array.isArray(localHistory) ? localHistory : []),
  ]);
  if (!openingName || !previous) return null;

  const current = openingComparisonStats(data, openingName);
  const before = openingComparisonStats(previous, openingName);
  if ((current.games || 0) + (before.games || 0) < 5) return null;

  const metrics = [];
  if (current.winRate !== null && before.winRate !== null && before.games >= 2 && current.games >= 2) {
    const delta = Math.round(current.winRate - before.winRate);
    metrics.push({
      label: "Opening result trend",
      value: delta === 0 ? "No clear change" : `${delta > 0 ? "+" : ""}${delta} pts`,
      copy:
        Math.abs(delta) < 5
          ? "More data needed before calling this a result trend."
          : delta > 0
            ? "Early signs of improvement in the focused opening."
            : "This pattern is still appearing in results.",
    });
  }

  metrics.push({
    label: "Focused games",
    value: `${current.games} game${current.games === 1 ? "" : "s"}`,
    copy:
      current.games > before.games
        ? "Your focused opening has more analysed games than last report."
        : "More data needed to make this comparison stronger.",
  });

  if (before.earlyIssues >= 1 || current.earlyIssues >= 1) {
    const delta = current.earlyIssues - before.earlyIssues;
    metrics.push({
      label: "Early recurring issue",
      value: `${current.earlyIssues} seen`,
      copy:
        delta < 0
          ? "Since your last report, this issue appeared in fewer analysed games."
          : delta === 0
            ? "This pattern is still appearing."
            : "This issue appeared in more analysed games; keep the mission narrow.",
    });
  }

  if (!metrics.length) return null;
  return {
    openingName,
    metrics: metrics.slice(0, 3),
  };
}

function MissionImprovementCard({ data, reportHistory = [] }) {
  const comparison = buildMissionImprovementComparison(data, reportHistory);
  if (!comparison) return null;

  return (
    <section className="missionImprovementCard" aria-label="Since your last report">
      <div>
        <p className="eyebrow">Since your last report</p>
        <h2>{comparison.openingName}</h2>
        <p>Conservative comparison from saved reports. This does not claim the drills caused the change.</p>
      </div>
      <div className="missionImprovementGrid">
        {comparison.metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.copy}</p>
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

function repertoireMapDisplayTitle(section) {
  if (section.key === "white_repertoire") return "White repertoire";
  if (section.key === "black_vs_e4") return "Black vs e4";
  if (section.key === "black_vs_d4") return "Black vs d4";
  return "Other / unclear";
}

function repertoireMapMasteryRows(data = {}) {
  const metrics = data?.retentionMetrics || data?.retention_metrics || {};
  const rows =
    data?.openingMastery ||
    data?.opening_mastery ||
    metrics.openingMastery ||
    metrics.opening_mastery ||
    [];
  return Array.isArray(rows) ? rows : [];
}

function repertoireMapMasteryForOpening(data, opening) {
  const openingKey = getOpeningName(opening).toLowerCase();
  const row = repertoireMapMasteryRows(data).find((item) => {
    const itemName = String(item?.opening || item?.name || "").toLowerCase();
    return itemName && (openingKey.includes(itemName) || itemName.includes(openingKey));
  });
  if (!row) return null;

  const score = safeNumber(row.masteryScore ?? row.mastery_score, null);
  const level = safeNumber(row.masteryLevel ?? row.mastery_level, null);

  return {
    score: Number.isFinite(score) ? Math.round(score) : null,
    level: Number.isFinite(level) ? Math.round(level) : null,
    weakLineCount: safeNumber(row.weakLineCount ?? row.weak_line_count, 0),
    decayRisk: String(row.decayRisk || row.decay_risk || "none").toLowerCase(),
    confidence: row.confidence || row.confidenceLevel || row.confidence_level || "",
    confidenceText: row.confidenceText || row.confidence_text || "",
    confidenceGames: safeNumber(row.confidenceGames ?? row.confidence_games ?? row.gamesPlayed ?? row.games_played, null),
  };
}

function repertoireMapScoreValue(data, opening) {
  const mastery = repertoireMapMasteryForOpening(data, opening);
  if (mastery?.score !== null && mastery?.score !== undefined) return mastery.score;
  return getOpeningGames(opening) ? getWinRate(opening) : null;
}

function repertoireMapConfidenceLevel(opening) {
  const confidence = String(getOpeningConfidence(opening) || "").toLowerCase();
  if (confidence.includes("high")) return "high";
  if (confidence.includes("low") || confidence.includes("too little")) return "low";
  if (confidence.includes("none")) return "low";
  return "medium";
}

function repertoireMapConfidenceText(data, opening) {
  const mastery = repertoireMapMasteryForOpening(data, opening);
  if (mastery?.confidenceText) return mastery.confidenceText;
  if (mastery?.confidence) {
    const games = mastery.confidenceGames ?? getOpeningGames(opening);
    return `${mastery.confidence} confidence - based on ${games} game${games === 1 ? "" : "s"}`;
  }

  const games = getOpeningGames(opening);
  const level = games >= 30 ? "High" : games >= 10 ? "Medium" : "Low";
  return `${level} confidence - based on ${games} game${games === 1 ? "" : "s"}`;
}

function repertoireMapStatus(opening, bucketKey, data) {
  if (!opening) {
    return {
      key: "watch",
      label: "watch",
      legend: "watch",
    };
  }

  const games = getOpeningGames(opening);
  const score = repertoireMapScoreValue(data, opening);
  const mastery = repertoireMapMasteryForOpening(data, opening);
  const confidence = repertoireMapConfidenceLevel(opening);
  const stale = ["medium", "high"].includes(mastery?.decayRisk);

  if (games >= 4 && (bucketKey === "risky" || mastery?.weakLineCount > 0 || (score !== null && score !== undefined && score < 45))) {
    return { key: "weak", label: "weak", legend: "weak" };
  }

  if (confidence === "low" || stale || bucketKey === "notEnoughData" || games < 4) {
    return { key: "watch", label: "watch", legend: "watch" };
  }

  if (games >= 10 && score >= 68 && confidence === "high") {
    return { key: "strong", label: "strong", legend: "strong" };
  }

  if (games >= 4 && score >= 50) {
    return { key: "stable", label: "stable", legend: "stable" };
  }

  return { key: "watch", label: "watch", legend: "watch" };
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

function repertoireMapUnknownRows(data, usedKeys = new Set()) {
  const candidates = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.topOpenings) ? data.topOpenings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openingStats) ? data.openingStats : []),
    ...(Array.isArray(data?.best_openings) ? data.best_openings : []),
    ...(Array.isArray(data?.bestOpenings) ? data.bestOpenings : []),
  ];

  return uniqueOpeningsByNameAndContext(candidates)
    .filter((opening) => {
      const key = getOpeningIdentityKey(opening);
      if (!key || usedKeys.has(key)) return false;
      const context = itemContext(opening, "unknown_mixed");
      const side = String(getOpeningSide(opening)).toLowerCase();
      return context === "unknown_mixed" || (!side.includes("white") && !side.includes("black"));
    })
    .slice(0, 4)
    .map((opening) => ({ opening, bucketKey: "needsReview" }));
}

function repertoireMapMasteryText(data, opening) {
  const mastery = repertoireMapMasteryForOpening(data, opening);
  if (mastery?.level) return `Level ${mastery.level}/10`;
  if (mastery?.score !== null && mastery?.score !== undefined) return `${mastery.score}%`;
  if (!opening || getOpeningGames(opening) === 0) return "Unavailable";
  return `${getWinRate(opening)}% score`;
}

function RepertoireMap({ data }) {
  const baseSections = buildRepertoireReportSections(data);
  const usedKeys = new Set(
    baseSections.flatMap((section) => repertoireMapRows(section).map(({ opening }) => getOpeningIdentityKey(opening)))
  );
  const sections = baseSections.map((section) => {
    if (section.key !== "black_vs_other") return section;
    const unknownRows = repertoireMapUnknownRows(data, usedKeys).map(({ opening }) => opening);
    return {
      ...section,
      title: "Other / unclear",
      empty: "No clean signal for other or unclear openings yet.",
      buckets: {
        ...section.buckets,
        needsReview: uniqueOpeningsByNameAndContext([
          ...(section.buckets.needsReview || []),
          ...unknownRows,
        ]),
      },
      totalItems: section.totalItems + unknownRows.length,
    };
  });
  const totalItems = sections.reduce((total, section) => total + section.totalItems, 0);

  return (
    <section className="repertoireMapSection" id="repertoire-map">
      <div className="repertoireMapHeader">
        <div>
          <p className="eyebrow">Repertoire map</p>
          <h2>Your current repertoire</h2>
          <p>
            A compact map of your openings, split by colour and first move when the report can detect it.
          </p>
          <span className="repertoireMapCount">
            {totalItems
              ? `${totalItems} recognised repertoire signal${totalItems === 1 ? "" : "s"}`
              : "No recognised repertoire signals yet"}
          </span>
        </div>

        <div className="repertoireMapLegend" aria-label="Repertoire map legend">
          <span><i className="mapDot mapDotStrong" />strong</span>
          <span><i className="mapDot mapDotStable" />stable</span>
          <span><i className="mapDot mapDotWatch" />watch</span>
          <span><i className="mapDot mapDotWeak" />weak</span>
        </div>
      </div>

      <div className="repertoireMapGrid">
        {sections.map((section) => {
          const rows = repertoireMapRows(section);

          return (
            <article className="repertoireMapLane" key={section.key}>
              <div className="repertoireMapLaneHeader">
                <span>{repertoireMapDisplayTitle(section)}</span>
                <strong>{sectionHealth(section)}</strong>
              </div>

              <div className="repertoireMapTree">
                {rows.length ? (
                  rows.map(({ opening, bucketKey }) => {
                    const status = repertoireMapStatus(opening, bucketKey, data);

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
                            <dt>Mastery</dt>
                            <dd>{repertoireMapMasteryText(data, opening)}</dd>
                          </div>
                          <div>
                            <dt>Confidence</dt>
                            <dd>{repertoireMapConfidenceText(data, opening)}</dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>{status.label}</dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })
                ) : (
                  <div className="repertoireMapNode mapStatus-grey">
                    <div className="repertoireMapNodeTop">
                      <div className="repertoireMapPath">
                        <span>{repertoireMapDisplayTitle(section)}</span>
                        <b aria-hidden="true">&rarr;</b>
                        <strong>{section.empty}</strong>
                      </div>
                      <div className="repertoireMapStatus">
                        <i className="mapDot mapDotWatch" />
                        watch
                      </div>
                    </div>
                    <dl className="repertoireMapMeta">
                      <div>
                        <dt>Games</dt>
                        <dd>0</dd>
                      </div>
                      <div>
                        <dt>Mastery</dt>
                        <dd>Unavailable</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>No confidence yet</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>watch</dd>
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
            <button type="button" className="secondaryBtn rolePracticeBtn" onClick={() => onPractice?.(opening)}>
              Train This Line
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
  const weakestTraining = buildWeakestLineTrainingTarget(data);
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
  const trainWeakLine = async (line) => {
    if (!line) return;

    if (user?.id && recordActivity) {
      try {
        await recordActivity("weak_line_training_started", {
          opening: line.opening,
          variation: line.variation || line.line,
          move_line: line.moveLine,
          games: line.games,
          win_rate: line.winRate,
          loss_rate: line.lossRate,
          points: 40,
        });
      } catch (error) {
        console.warn("OpeningFit could not record weak-line training activity.", error);
      }
    }

    const selectedTraining = buildWeakestLineTrainingTargetFromLine(line);
    onPractice?.(selectedTraining.target || line.trainingTarget || line);
  };

  const trainSelectedLine = () => {
    trainWeakLine(selectedLine);
  };

  return (
    <section className="commandPanel weakLinesSection" id="weak-lines">
      <div className="commandPanelHeader">
        <p className="eyebrow">Weak lines</p>
        <h2>What to fix</h2>
          <p>
            Repeated variations worth reviewing before blaming the whole opening.
          </p>
          {weakestTraining.available ? (
            <button type="button" className="primaryBtn" onClick={() => onPractice?.(weakestTraining.target)}>
              Train This Line
            </button>
          ) : (
            <small>{weakestTraining.message}</small>
          )}
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

              <button type="button" onClick={() => trainWeakLine(line)}>
                Train This Line
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
              Train This Line
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
          <button type="button" onClick={() => onPractice?.(focus) || onViewChange?.("train")}>
            Train This Line
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
            onClick={() => onPractice?.(item)}
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
          <button type="button" onClick={() => onPractice?.(target)}>
            Train This Line
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
            <span>{hasFocusedSession ? `${studyScore}% score` : "No firm verdict yet"}</span>
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
function AppPrimaryNav({
  mode = "marketing",
  activeView,
  accountUser,
  hasReport,
  onNavigate,
  onExampleReport,
  onLogin,
  theme,
  onThemeToggle,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef(null);
  const isAppNavigation = mode === "app";
  const profileLabel = accountUser ? "Account" : "Sign in";
  const items = isAppNavigation
    ? [
        { key: "report", label: "Report", path: "/report" },
        { key: "repertoire", label: "Repertoire", path: "/repertoire" },
        { key: "training", label: "Train", path: "/train" },
        { key: "progress", label: "Progress", path: "/progress", target: "openingfit-progress" },
      ]
    : [
        { key: "analyse", label: "Analyse", path: hasReport ? "/" : "/#import", native: !hasReport },
        { key: "how", label: "How it works", path: "/#how-it-works-app", native: true },
        { key: "example", label: "Sample report", path: SAMPLE_REPORT_PATH, target: "app-results", action: onExampleReport },
        { key: "learn", label: "Learn", path: "/guides", native: true },
        { key: "pricing", label: "Pricing", path: "/premium" },
      ];
  const accountAction = accountUser
    ? { key: "account", label: "Account", path: "/account" }
    : { key: "login", label: "Sign in", path: "/login", target: "login", action: onLogin };
  const brandAction = HOME_NAVIGATION;
  const primaryAction = accountUser
    ? { key: "analyse", label: "New analysis" }
    : { key: "analyse", label: "Analyse games" };
  const mobileMenuId = "openingfit-mobile-menu";
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  const isPrimaryNavItemActive = (item) => {
    const isPremiumPath = currentPath === "/premium" || currentPath === "/upgrade";
    if (item.key === activeView) return true;

    const activeViewsByKey = {
      analyse: ["analyse", "home", "import"],
      dashboard: ["dashboard"],
      report: ["report", "overview", "recommendations", "openings", "weakspots", "verdicts", "progress"],
      repertoire: ["repertoire"],
      recommendations: ["recommendations", "openings", "weakspots", "verdicts"],
      example: ["report", "overview", "recommendations", "openings", "weakspots", "verdicts"],
      training: ["train", "training", "interactive", "practice"],
      journey: ["journey"],
      games: ["games", "data"],
      history: ["history"],
      account: ["profile", "account", "progress"],
      progress: ["progress"],
      premium: ["premium", "upgrade"],
      pricing: ["premium", "upgrade"],
      login: ["login", "profile", "account", "progress"],
    };

    if (
      item.key === "openingsHub" &&
      (currentPath === "/openings" || currentPath.startsWith("/openings/") || currentPath.startsWith("/chess-openings/"))
    ) {
      return true;
    }
    if (activeViewsByKey[item.key]?.includes(activeView)) return true;
    if (item.key === "account" && isPremiumPath) return false;
    if ((item.key === "premium" || item.key === "pricing") && isPremiumPath && ["premium", "upgrade"].includes(activeView)) return true;
    if (item.key === "login" && currentPath === "/login") return true;
    if (item.key === "account" && currentPath === "/account" && !["history"].includes(activeView)) return true;

    return false;
  };

  const navigate = (event, item) => {
    if (item.native) {
      setMobileMenuOpen(false);
      return;
    }

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
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMobileMenuOpen(false);
      window.requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus());
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <nav className={`appPrimaryNav appPrimaryNav--${mode}`} aria-label={isAppNavigation ? "OpeningFit application" : "OpeningFit website"}>
      <div className="appPrimaryNavInner">
        <a className="appPrimaryBrand" href={HOME_NAVIGATION.path} onClick={(event) => navigate(event, brandAction)} aria-label={HOME_NAVIGATION.label}>
          <img className="appPrimaryBrandLogo" src="/icons/openingfit-icon.svg" alt="" width="36" height="36" aria-hidden="true" />
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

        {isAppNavigation ? (
          <a className="appPrimaryGetStarted" href="/" onClick={(event) => navigate(event, primaryAction)}>
            {primaryAction.label}
          </a>
        ) : null}

        <a
          className="appPrimaryAccount"
          href={accountAction.path || "/account"}
          onClick={(event) => navigate(event, accountAction)}
        >
          <span aria-hidden="true">{accountUser ? "OF" : "→"}</span>
          {accountAction.label}
        </a>

        <button
          ref={mobileMenuTriggerRef}
          className="appPrimaryMenuToggle"
          type="button"
          aria-controls={mobileMenuId}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close OpeningFit menu" : "Open OpeningFit menu"}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{mobileMenuOpen ? <X size={20} strokeWidth={2.4} /> : <Menu size={20} strokeWidth={2.4} />}</span>
        </button>
      </div>

      <div
        className="appPrimaryMobileBackdrop"
        hidden={!mobileMenuOpen}
        aria-hidden="true"
        onPointerDown={() => setMobileMenuOpen(false)}
      />

      <div
        className={`appPrimaryMobilePanel ${mobileMenuOpen ? "appPrimaryMobilePanelOpen" : ""}`}
        id={mobileMenuId}
        hidden={!mobileMenuOpen}
      >
        <div className="appPrimaryMobileHeader">
          <strong>OpeningFit</strong>
          <span>{isAppNavigation ? "Your OpeningFit workspace" : "Analyse games and learn from your report."}</span>
        </div>

        <div className="appPrimaryMobileLinks">
          {[...items, accountAction].map((item) => {
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

        <div className="appPrimaryMobileUtilityLinks" aria-label="Account and support links">
          <a href="/login" onClick={(event) => navigate(event, { key: "login", action: onLogin })}>
            {profileLabel}
          </a>
          {isAppNavigation && hasReport ? (
            <a href="/account" onClick={(event) => navigate(event, { key: "history" })}>History</a>
          ) : null}
          <a href="#privacy" onClick={() => setMobileMenuOpen(false)}>Privacy</a>
          <a href="#terms" onClick={() => setMobileMenuOpen(false)}>Terms</a>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=OpeningFit%20support`}>Support</a>
        </div>
      </div>
    </nav>
  );
}

function AppStoreReadinessFooter({ onAccount }) {
  return (
    <footer className="appStoreReadinessFooter" aria-label="OpeningFit legal and support">
      <section id="privacy" className="appLegalPanel">
        <div>
          <span>Privacy Policy</span>
          <h2>Your chess data stays focused on OpeningFit.</h2>
        </div>
        <p>
          OpeningFit analyses public Chess.com or Lichess games you choose to import. If you create an account,
          saved reports, profile settings, and purchase access can sync securely across devices.
        </p>
      </section>

      <section id="terms" className="appLegalPanel">
        <div>
          <span>Terms</span>
          <h2>Use OpeningFit as training guidance.</h2>
        </div>
        <p>
          OpeningFit provides opening recommendations from game history. It is not engine analysis, coaching certification,
          or a guarantee of results.
        </p>
      </section>

      <section id="support" className="appLegalPanel">
        <div>
          <span>Support</span>
          <h2>Need help with login, saved data, or account deletion?</h2>
        </div>
        <div className="appLegalActions">
          <a href={`mailto:${SUPPORT_EMAIL}?subject=OpeningFit%20support`}>Email support</a>
          <button type="button" onClick={onAccount}>Open account settings</button>
        </div>
      </section>
    </footer>
  );
}

function AccountSyncStatusBar({
  user,
  isSupabaseConfigured,
  authLoading,
  profileLoading,
  profileLoaded = true,
  authHydrated,
  restoreInProgress,
  hasPremiumAccess,
  entitlement,
  syncStatus,
  lastSavedAt,
  syncError,
  onAccount,
  onCloudRestore,
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
  const paidPlanLabel = subscriptionPresentation(entitlement).planName;

  if (!isSupabaseConfigured) {
    label = "Logged out";
    identity = "Cloud off";
    detail = "Cloud save is not connected in this environment. You can still analyse and continue locally.";
    tone = "error";
    action = "Account";
  } else if (authLoading || !authHydrated) {
    label = "Checking account...";
    identity = "Checking";
    detail = "OpeningFit is checking your account session.";
    tone = "loading";
    action = "Account";
  } else if (profileLoading || (user?.id && !profileLoaded)) {
    label = "Restoring saved data...";
    identity = "Restoring";
    detail = "Looking for your saved reports, profile, and settings...";
    tone = "loading";
    action = "Account";
  } else if (user?.id) {
    identity = user.email || "OpeningFit user";
    label = "Logged in";
    plan = hasPremiumAccess ? paidPlanLabel : "Free";
    action = "Account";

    if (syncStatus === "saving") {
      detail = "Saving...";
      tone = "saving";
    } else if (syncStatus === "error") {
      detail = syncError || "Save failed. Try again or continue locally.";
      tone = "error";
    } else {
      detail = savedTime ? `Cloud sync active - Saved ${savedTime}` : "Cloud sync active - Saved";
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

  const handleCloudRestore = async (event) => {
    event.stopPropagation();
    await onCloudRestore?.(event);
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
            <dd>{hasPremiumAccess ? `${paidPlanLabel} active` : "Free account"}</dd>
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
            <button
              type="button"
              onClick={handleCloudRestore}
              disabled={
                authLoading ||
                !authHydrated ||
                profileLoading ||
                !profileLoaded ||
                restoreInProgress
              }
            >
              {restoreInProgress ? "Restoring..." : "Restore cloud data"}
            </button>
          ) : null}
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

function getCurrentPath() {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : "/";
}

function isPrivateSeoPath(path) {
  return ["/account", "/profile", "/login", "/dashboard", "/report", SAMPLE_REPORT_PATH, "/repertoire", "/progress", "/journey", "/train", "/premium", "/upgrade"].includes(path);
}

function getInitialAppView() {
  const path = getCurrentPath();
  if (path === "/dashboard") return "dashboard";
  if (path === "/account" || path === "/profile" || path === "/login") return "profile";
  if (path === "/upgrade" || path === "/premium") return "upgrade";
  if (path === "/train") return "train";
  if (path === "/report" || isSampleReportPath(path)) return "report";
  if (path === "/repertoire") return "repertoire";
  if (path === "/progress") return "progress";
  if (path === "/journey") return "journey";
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
        Free reports and optional OpeningFit Plus subscriptions.
      </p>
    </footer>
  );
}

function PopularChessOpeningGuides() {
  const popularLinks = [
    { label: "Which Chess Opening Should I Play?", href: "/guides/which-chess-opening-should-i-play", text: "Choose by rating, style, confidence, and real results." },
    { label: "Best Chess Openings for Beginners", href: "/guides/best-chess-openings-for-beginners", text: "Simple White and Black openings with clear plans." },
    { label: "Best Chess Openings for 1000 Rated Players", href: "/guides/best-chess-openings-for-1000-rated-players", text: "Reduce early blunders with familiar structures." },
    { label: "Best Chess Openings for 1200 Rated Players", href: "/guides/best-chess-openings-for-1200-rated-players", text: "Start choosing openings by style and evidence." },
    { label: "Vienna Game Guide", href: "/openings/vienna-game", text: "An attacking 1.e4 option with early initiative." },
    { label: "Caro-Kann Defence Guide", href: "/openings/caro-kann-defense", text: "A solid Black defence against 1.e4." },
    { label: "Scandinavian Defence Guide", href: "/openings/scandinavian-defense", text: "A direct defence with clear central contact." },
  ];

  return (
    <section className="popularOpeningGuides" aria-label="Popular chess opening guides">
      <div className="popularOpeningGuidesHeader">
        <p className="eyebrow">Popular chess opening guides</p>
        <h2>Learn the opening, then test it on your games.</h2>
      </div>
      <div className="popularOpeningGuidesGrid">
        {popularLinks.map((link) => (
          <a key={link.href} href={link.href}>
            <strong>{link.label}</strong>
            <span>{link.text}</span>
          </a>
        ))}
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

function HomepageVisualStory() {
  const benefits = [
    ["Built from your real games", "Recommendations start with positions you actually reach.", Database, "cyan"],
    ["Simple club-player advice", "Clear verdicts show what to keep, improve, watch, or replace.", MessageSquareText, "green"],
    ["No endless theory", "Focus on useful plans and recurring trouble spots.", Layers3, "gold"],
    ["Practical training actions", "Finish with a short study queue for your next session.", ListChecks, "blue"],
  ];

  const steps = [
    ["Import your games", "Connect a public Chess.com or Lichess username.", Gamepad2, "import"],
    ["Find your opening fit", "See which openings suit your results and habits.", Target, "fit"],
    ["Build a simple repertoire", "Turn the evidence into a focused plan for White and Black.", BookOpenCheck, "plan"],
  ];

  return (
    <div className="homepageVisualStory">
      <section className="landingStorySection landingDifferenceSection" id="why-opening-fit-app">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Why OpeningFit</p>
          <h2>Opening advice that feels personal, practical, and finishable.</h2>
          <p>Your recent games become a small set of confident repertoire decisions.</p>
        </div>

        <div className="landingWhyProduct">
          <div className="landingBenefitGrid">
            {benefits.map(([title, text, icon, accent]) => {
              const BenefitIcon = icon;
              return (
                <article className={`landingBenefitCard landingBenefitCard-${accent}`} key={title}>
                  <span className="landingBenefitIcon"><BenefitIcon size={21} strokeWidth={2.2} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              );
            })}
          </div>

          <div className="landingRepertoireMock" aria-label="Sample repertoire dashboard">
            <div className="landingMockTopbar">
              <div><span>Repertoire snapshot</span><strong>Three decisions. One clear plan.</strong></div>
              <span className="landingMockScore"><ChartNoAxesCombined size={15} /> 84 fit</span>
            </div>
            <div className="landingMockRows">
              <div><span className="landingMockPiece">W</span><p><strong>White</strong><small>Italian Game</small></p><span className="verdict keep">Keep</span></div>
              <div><span className="landingMockPiece landingMockPieceDark">B</span><p><strong>Black vs 1.e4</strong><small>Caro-Kann Defence</small></p><span className="verdict keep">Keep</span></div>
              <div><span className="landingMockPiece landingMockPieceGold">B</span><p><strong>Black vs 1.d4</strong><small>Too many systems</small></p><span className="verdict improve">Focus</span></div>
            </div>
            <div className="landingMockAction">
              <CircleCheck size={18} />
              <p><span>Next training action</span><strong>Choose one response to 1.d4 and review its first plan.</strong></p>
              <ArrowRight size={18} />
            </div>
          </div>
        </div>
      </section>

      <section className="landingContentSection homepageHowSection" id="how-it-works-app">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">How it works</p>
          <h2>Build a repertoire from your own results.</h2>
          <p>OpeningFit does the sorting. You make three useful decisions.</p>
        </div>
        <div className="landingStepsList landingVisualSteps">
          {steps.map(([title, text, icon, visual], index) => {
            const StepIcon = icon;
            return (
            <article className="landingStepCard landingVisualStepCard" key={title}>
              <div className="landingStepTop">
                <div className="landingStepNumber">{index + 1}</div>
                <span className="landingStepIcon"><StepIcon size={20} strokeWidth={2.2} /></span>
              </div>
              <div className="landingStepCopy"><h3>{title}</h3><p>{text}</p></div>
              <div className={`landingStepVisual landingStepVisual-${visual}`} aria-hidden="true">
                {visual === "import" ? <><span className="landingPlatformChip">Chess.com</span><span className="landingPlatformChip">Lichess</span><div className="landingImportProgress"><i /></div></> : null}
                {visual === "fit" ? <><div><span>Italian</span><i style={{ width: "84%" }} /></div><div><span>Caro-Kann</span><i style={{ width: "76%" }} /></div><div><span>Dutch</span><i style={{ width: "38%" }} /></div></> : null}
                {visual === "plan" ? <><div><CircleCheck size={15} /><span>Keep Italian</span></div><div><CircleCheck size={15} /><span>Repair Caro-Kann</span></div><div><CircleCheck size={15} /><span>Choose vs 1.d4</span></div></> : null}
              </div>
              <div className="landingStepMeta"><CircleCheck size={15} /> Ready for your next session</div>
            </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SimplifiedHomepageStory({ onSampleReport }) {
  const steps = [
    ["Import games", "Choose Chess.com or Lichess and enter a public username.", Gamepad2],
    ["Receive a clear repertoire verdict", "See the openings to keep, the issue to repair, and the evidence behind each call.", Target],
    ["Train the line that matters most", "Start with one practical line selected from positions that recur in the player's games.", Dumbbell],
  ];
  const outcomes = [
    ["Know what to keep", "Protect the openings already producing reliable positions.", CheckCircle2, "success"],
    ["Know what to repair", "Separate a weak branch from an opening that may still be worth playing.", AlertTriangle, "warning"],
    ["Build a manageable repertoire", "Choose a clear role for White, Black against 1.e4, and Black against 1.d4.", Layers3, "info"],
    ["Practise positions from your games", "Train familiar move orders instead of collecting unrelated theory.", Gamepad2, "info"],
    ["Track whether you improve", "Compare later reports when you return with more games.", ChartNoAxesCombined, "success"],
  ];

  return (
    <div className="homepageOutcomeStory">
      <section className="homepageProofSection" aria-labelledby="homepage-proof-title">
        <div>
          <p className="eyebrow">Built on real game imports</p>
          <h2 id="homepage-proof-title">Evidence shown only when it is available.</h2>
          <p>OpeningFit labels small samples instead of turning them into confident recommendations.</p>
        </div>
        <GameAnalysisCount copy="sentence" className="homepageVerifiedCount" />
      </section>

      <section className="homepageHowSection" id="how-it-works-app" aria-labelledby="homepage-how-title">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">How it works</p>
          <h2 id="homepage-how-title">Username in. Practical opening plan out.</h2>
        </div>
        <div className="homepageStepGrid">
          {steps.map(([title, text, Icon], index) => (
            <article key={title} className="homepageStep">
              <span className="homepageStepNumber">{index + 1}</span>
              {createElement(Icon, { size: 21, "aria-hidden": "true" })}
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="homepageOutcomesSection" aria-labelledby="homepage-outcomes-title">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">What changes</p>
          <h2 id="homepage-outcomes-title">Make fewer, better opening decisions.</h2>
        </div>
        <div className="homepageOutcomeList">
          {outcomes.map(([title, text, Icon, tone]) => (
            <article className={`homepageOutcome homepageOutcome--${tone}`} key={title}>
              <span>{createElement(Icon, { size: 19, "aria-hidden": "true" })}</span>
              <div><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="homepageSampleCta" aria-labelledby="homepage-sample-title">
        <div>
          <p className="eyebrow">Sample report</p>
          <h2 id="homepage-sample-title">See the full report before importing.</h2>
          <p>The sample demonstrates the report structure and is clearly separated from your personalised analysis.</p>
        </div>
        <button className="primaryBtn" type="button" onClick={() => onSampleReport?.(SAMPLE_REPORT_CTA_SOURCES.landingStory)}>Open full sample report</button>
      </section>

      <section className="homepageFounderSection" id="about" aria-labelledby="homepage-founder-title">
        <div>
          <p className="eyebrow">About OpeningFit</p>
          <h2 id="homepage-founder-title">An independent product for practical chess improvement.</h2>
        </div>
        <p>OpeningFit is built for players who want opening decisions grounded in the games they actually play. It is training guidance, not a substitute for a coach or engine review.</p>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=About%20OpeningFit`}>Contact the founder</a>
      </section>

      <section className="homepageGuidesLink" aria-label="Opening guides">
        <div><strong>Want to learn before importing?</strong><span>Browse concise guides, then test those ideas against your own games.</span></div>
        <a href="/guides">Explore opening guides</a>
      </section>
    </div>
  );
}

function PublicHomepageFooter({ onAccount }) {
  const links = [
    ["About", "/about"],
    ["How it works", "/how-it-works"],
    ["Opening guides", "/guides"],
    ["Pricing", "/premium"],
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
    ["Changelog", "/changelog"],
    ["Contact", `mailto:${SUPPORT_EMAIL}?subject=OpeningFit%20support`],
  ];
  return (
    <footer className="homepageFooter" aria-label="OpeningFit footer">
      <div className="homepageFooterBrand">
        <img src="/icons/openingfit-icon.svg" alt="" width="36" height="36" aria-hidden="true" />
        <div><strong>OpeningFit</strong><span>Personalised opening reports from public games.</span></div>
      </div>
      <nav aria-label="Footer links">
        {links.map(([label, href]) => <a key={label} href={href}>{label}</a>)}
        <button type="button" onClick={onAccount}>Account and data deletion</button>
      </nav>
      <div className="homepageFooterLegal">
        <section id="privacy"><strong>Privacy</strong><span>OpeningFit uses the public chess username you submit. Saved account data can be managed from Account.</span></section>
        <section id="terms"><strong>Terms</strong><span>Recommendations are training guidance and do not guarantee chess results.</span></section>
      </div>
    </footer>
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
      title: "Import your games",
      text: "Connect a public Chess.com or Lichess username. No PGN sorting required.",
      meta: "Recent games ready",
      icon: Gamepad2,
      visual: "import",
    },
    {
      title: "Find your opening fit",
      text: "See which openings suit your results, habits, and recurring positions.",
      meta: "Fit signals found",
      icon: Target,
      visual: "fit",
    },
    {
      title: "Build a simple repertoire",
      text: "Turn the evidence into a focused plan for White and Black.",
      meta: "3 clear priorities",
      icon: BookOpenCheck,
      visual: "plan",
    },
  ];

  const heroSteps = [
    {
      title: "Import games",
      text: "Enter a public username.",
    },
    {
      title: "Find best openings",
      text: "See what already works.",
    },
    {
      title: "Fix weak lines",
      text: "Train what costs you games.",
    },
    {
      title: "Train repertoire",
      text: "Practice the next line.",
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
    "Built for practical club players.",
    "Uses your own games, not generic grandmaster theory.",
    "Works best once you have enough recent games.",
    "Your report is based on actual results.",
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

  const benefitCards = [
    {
      title: "Built from your real games",
      text: "Recommendations start with positions you actually reach, not a generic course.",
      icon: Database,
      accent: "cyan",
    },
    {
      title: "Simple club-player advice",
      text: "Clear verdicts explain what to keep, improve, watch, or replace.",
      icon: MessageSquareText,
      accent: "green",
    },
    {
      title: "No endless theory",
      text: "Focus on useful plans and recurring trouble spots without drowning in lines.",
      icon: Layers3,
      accent: "gold",
    },
    {
      title: "Practical training actions",
      text: "Finish with a short study queue you can use before your next rated session.",
      icon: ListChecks,
      accent: "blue",
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
            <a href="#app-dashboard">Analyse your games</a>
          </nav>
        </div>

        <div className="landingHeroGrid">
          <div className="landingHeroCopy">
            <div className="landingPill">
              <span>Opening report tool</span>
              <span className="landingDot">•</span>
              <span>Chess.com and Lichess</span>
            </div>

            <h1>Discover the openings you already win with.</h1>

            <p className="landingSubtext">
              OpeningFit analyses your recent games, finds your strongest openings, and shows the weak lines to train next.
            </p>

            <div className="landingHeroActions">
              <a className="landingPrimaryBtn" href="#app-dashboard">
                Analyse my games
              </a>
              <a className="landingSecondaryBtn" href="#how-it-works">
                See how it works
              </a>
            </div>

            <p className="landingTrustLine">
              No PGN upload · Public games only · Confidence labels
            </p>

            <GameAnalysisCount className="landingGamesAnalysedCount" />

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
          Analyse my games
        </a>
        <a className="landingSecondaryBtn" href="#how-it-works">
          How it works
        </a>
      </div>

      <section className="landingStorySection landingProblemSection" id="problem">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Opening choices</p>
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
          <h2>Opening advice that feels personal, practical, and finishable.</h2>
          <p>
            Your report turns recent games into a small set of confident repertoire decisions.
          </p>
        </div>

        <div className="landingWhyProduct">
          <div className="landingBenefitGrid">
            {benefitCards.map((benefit) => {
              const BenefitIcon = benefit.icon;
              return (
                <article className={`landingBenefitCard landingBenefitCard-${benefit.accent}`} key={benefit.title}>
                  <span className="landingBenefitIcon"><BenefitIcon size={21} strokeWidth={2.2} /></span>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </article>
              );
            })}
          </div>

          <div className="landingRepertoireMock" aria-label="Sample repertoire dashboard">
            <div className="landingMockTopbar">
              <div>
                <span>Repertoire snapshot</span>
                <strong>Three decisions. One clear plan.</strong>
              </div>
              <span className="landingMockScore"><ChartNoAxesCombined size={15} /> 84 fit</span>
            </div>
            <div className="landingMockRows">
              <div>
                <span className="landingMockPiece">W</span>
                <p><strong>White</strong><small>Italian Game</small></p>
                <span className="verdict keep">Keep</span>
              </div>
              <div>
                <span className="landingMockPiece landingMockPieceDark">B</span>
                <p><strong>Black vs 1.e4</strong><small>Caro-Kann Defence</small></p>
                <span className="verdict keep">Keep</span>
              </div>
              <div>
                <span className="landingMockPiece landingMockPieceGold">B</span>
                <p><strong>Black vs 1.d4</strong><small>Too many systems</small></p>
                <span className="verdict improve">Focus</span>
              </div>
            </div>
            <div className="landingMockAction">
              <CircleCheck size={18} />
              <p><span>Next training action</span><strong>Choose one response to 1.d4 and review its first plan.</strong></p>
              <ArrowRight size={18} />
            </div>
          </div>
        </div>
      </section>

      <section className="landingStorySection landingDemoSection" id="product-demo">
        <div className="landingDemoCopy">
          <p className="landingEyebrow">What you see</p>
          <h2>A report that turns messy games into opening decisions.</h2>
          <p>
            See strengths, weak lines, confidence, and one next study target.
          </p>
          <a className="landingSecondaryBtn" href={SAMPLE_REPORT_PATH}>
            View sample report
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
          <p className="landingEyebrow">After you submit</p>
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
          <h2>Build a repertoire from your own results.</h2>
          <p>OpeningFit does the sorting. You make three useful decisions.</p>
        </div>

        <div className="landingStepsList landingVisualSteps">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
            <article className="landingStepCard landingVisualStepCard" key={step.title}>
              <div className="landingStepTop">
                <div className="landingStepNumber">{index + 1}</div>
                <span className="landingStepIcon"><StepIcon size={20} strokeWidth={2.2} /></span>
              </div>
              <div className="landingStepCopy">
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
              <div className={`landingStepVisual landingStepVisual-${step.visual}`} aria-hidden="true">
                {step.visual === "import" && (
                  <>
                    <span className="landingPlatformChip">Chess.com</span>
                    <span className="landingPlatformChip">Lichess</span>
                    <div className="landingImportProgress"><i /></div>
                  </>
                )}
                {step.visual === "fit" && (
                  <>
                    <div><span>Italian</span><i style={{ width: "84%" }} /></div>
                    <div><span>Caro-Kann</span><i style={{ width: "76%" }} /></div>
                    <div><span>Dutch</span><i style={{ width: "38%" }} /></div>
                  </>
                )}
                {step.visual === "plan" && (
                  <>
                    <div><CircleCheck size={15} /><span>Keep Italian</span></div>
                    <div><CircleCheck size={15} /><span>Repair Caro-Kann</span></div>
                    <div><CircleCheck size={15} /><span>Choose vs 1.d4</span></div>
                  </>
                )}
              </div>
              <div className="landingStepMeta"><CircleCheck size={15} /> {step.meta}</div>
            </article>
            );
          })}
        </div>
      </section>

      <section className="landingStorySection landingBeforeAfterSection" id="before-after">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Why it helps</p>
          <h2>Turn opening confusion into one clear next action.</h2>
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
          <p className="landingEyebrow">What you get</p>
          <h2>Clear opening decisions, not a wall of numbers.</h2>
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
          <p className="landingEyebrow">Messy data</p>
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
          <p className="landingEyebrow">Trust the result</p>
          <h2>Built from your own games.</h2>
          <p>
            OpeningFit uses public game history and labels low-confidence samples clearly.
          </p>
        </div>

        <div className="landingProofList">
          {proofItems.map((item) => (
            <div key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>

        <article className="landingOutcomeExample">
          <span>Example outcome</span>
          <h3>Your Italian may be working, but your Sicilian Dragon line may be costing you games.</h3>
          <p>
            The report separates strong openings from weak lines, so you know what to keep and what to train next.
          </p>
        </article>
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
          <p className="landingEyebrow">When to use it</p>
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
          <h2>Find your best openings</h2>
          <p>
            OpeningFit looks at your own games and shows which openings are helping, hurting, or need more evidence.
          </p>
          <p>
            Analyse Chess.com or Lichess games, then build a repertoire from your own results.
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
          <p className="landingEyebrow">Pricing</p>
          <h2>Start with a free snapshot. Upgrade when you want to track progress.</h2>
        </div>

        <div className="landingPricingGrid">
          <article className="landingPriceCard">
            <p className="landingMiniLabel">Free</p>
            <h3>Useful opening snapshot</h3>
            <p>
              Enough to find your best openings and one line to fix from recent games.
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
                <p className="landingMiniLabel">OpeningFit Plus</p>
                <h3>Saved progress and repertoire planning</h3>
              </div>

              <span className="landingPriceBadge">From £4.99/month</span>
            </div>

            <p>
              OpeningFit Plus keeps the free report useful, then adds saved reports,
              weak-line tracking, and progress comparisons over time.
            </p>

            <ul>
              <li>Save every report and compare progress</li>
              <li>Track weak lines over time</li>
              <li>Full opening table and advanced filters</li>
              <li>Personal repertoire plan</li>
              <li>Weekly personalised training from your games</li>
              <li>Own-game opening drills and training outcomes</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="landingStorySection landingFaqSection" id="faq">
        <div className="landingQuestionBlock">
          <p className="landingEyebrow">Before you start</p>
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
          <p className="landingEyebrow">Start here</p>
          <h2>Get your opening plan from real games.</h2>
          <p>
            Use your public username, get the snapshot, then pick what to study next.
          </p>
        </div>

        <div className="landingFinalActions">
          <a className="landingPrimaryBtn" href="#app-dashboard">
            Analyse your games
          </a>
          <a className="landingSecondaryBtn" href={SAMPLE_REPORT_PATH}>
            View sample report
          </a>
        </div>
      </section>
    </div>
  );
}





const REPORT_HISTORY_KEY = "openingFit:reportHistory";

function ReportExportAndHistory({ data, onLoadReport, entitlement = null, onUpgrade }) {
  const {
    user: cloudUser,
    profileLoading: cloudProfileLoading,
    reportHistory: cloudReportHistory,
    saveReport: saveCloudReportFromAuth,
    deleteUserData,
    refreshUserData,
  } = useAuth();
  const [savedReports, setSavedReports] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const hasSavedHistory = canUseFeature(entitlement, OPENINGFIT_FEATURES.SAVED_REPORT_HISTORY);

  useEffect(() => {
    if (!hasSavedHistory) {
      setSavedReports([]);
      return;
    }
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
  }, [cloudReportHistory, cloudUser?.id, hasSavedHistory]);

  if (!data) return null;
  if (isSampleReport(data)) {
    return (
      <section className="exportHistoryShell" id="report-history" aria-label="Sample report history notice">
        <div className="exportHistoryIntro">
          <span>Sample report · Example data</span>
          <h2>This example stays separate from your report history.</h2>
          <p>OpeningFit does not save, sync, export, or compare the fictional sample as if it were your analysis.</p>
        </div>
      </section>
    );
  }

  const playerName =
    data.username ||
    data.playerName ||
    data.player_name ||
    data.requestedUsername ||
    data.requested_username ||
    "Opening Fit report";

  const reportCounts = buildReportGameCounts(data);
  const gamesImported = reportCounts.analysedGames || "Recent";

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
    if (!canPersistReport(data)) {
      setHistoryStatus("Sample reports are example data and cannot be added to report history.");
      return;
    }
    if (!hasSavedHistory) {
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
        const saved = await saveCloudReportFromAuth(data, {
          username: playerName,
          platform: data.platform || data.importPlatform || data.import_platform || "unknown",
          games: gamesImported,
          styleLabel,
          savedAt: reportRecord.savedAt,
        });
        if (!saved) {
          setHistoryStatus("Only a completed analysis created while signed in can be saved to account history.");
          return;
        }
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
    if (!hasSavedHistory) {
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
        <span>{hasSavedHistory ? "Export & history" : "Paid progress tracking"}</span>
        <h2>{hasSavedHistory ? "Save this report or export it as a study plan." : "Save every report and compare progress with paid access."}</h2>
        <p>
          {hasSavedHistory
            ? "Keep a local copy of your Opening Fit reports so you can compare your opening progress over time."
            : "The free report gives the verdict and first actions. OpeningFit Plus adds saved reports, weak-line tracking, and exportable study plans."}
        </p>

        <div className="exportHistoryActions">
          <button type="button" onClick={exportPdf} className="exportPrimaryBtn">
            {hasSavedHistory ? "Export study plan" : "Unlock export"}
          </button>

          <button type="button" onClick={handleSaveReport} className="exportSecondaryBtn">
            {hasSavedHistory ? "Save report" : "Unlock saved history"}
          </button>
        </div>

        <small>
          {hasSavedHistory
            ? cloudUser?.id
              ? "Saved reports are stored in your OpeningFit account and restored after login."
              : "Saved reports are stored in this browser until you sign in."
            : "Plus adds saved cloud history and the complete supporting evidence available today."}
        </small>
        {historyStatus ? <small>{historyStatus}</small> : null}
      </div>

      <div className="currentReportSummary">
        <span>Current report</span>
        <strong>{playerName}</strong>
        <p>
          {gamesImported} games analysed · {styleLabel} · {reportDate}
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
            <h3>
              {cloudUser?.id && cloudProfileLoading
                ? "Loading saved reports..."
                : savedReports.length
                  ? "Previous reports"
                  : "No saved reports yet"}
            </h3>
          </div>

          {savedReports.length && !(cloudUser?.id && cloudProfileLoading) ? (
            <button type="button" onClick={clearReports}>
              Clear
            </button>
          ) : null}
        </div>

        {cloudUser?.id && cloudProfileLoading ? (
          <p className="emptySavedReports">
            Restoring your OpeningFit account history...
          </p>
        ) : savedReports.length ? (
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

  const gamesImported = buildReportGameCounts(data).analysedGames || openings.reduce((sum, item) => sum + item.games, 0);

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
          <small>{gamesImported || "Recent"} games analysed</small>
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


export default function App() {
  const {
    user: supabaseUser,
    session: authSession,
    profile: supabaseProfile,
    loading: authLoading,
    hydrated: authHydrated,
    hasPremiumAccess,
    entitlement,
    saveReport: saveCloudReport,
    saveAnalysedGames: saveCloudAnalysedGames,
    recordActivity: recordCloudActivity,
    saveSettings: saveCloudSettings,
    history: activityHistory,
    settings: userSettings,
    reportHistory: cloudReportHistory,
    analysedGames: cloudAnalysedGames,
    retentionSnapshots,
    recommendationHistory,
    saveRecommendationHistory,
    openingFitUserState,
    upsertUserData: upsertCloudUserData,
    refreshUserData,
    profileLoading,
    profileLoaded,
    syncStatus,
    lastSavedAt,
    syncError,
    profileError,
    restoreError,
    restoreInProgress,
    restoreCloudSnapshot,
    isSupabaseConfigured,
    signOut: signOutAccount,
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
  const canUseOwnGameDrills = canUseFeature(entitlement, OPENINGFIT_FEATURES.OWN_GAME_DRILLS);
  const gameHistoryMonths = featureLimit(entitlement, OPENINGFIT_FEATURES.GAME_HISTORY, "months", 3);
  const [isPremiumPreview, setIsPremiumPreview] = useState(false);
  const [premiumCheckoutLoading, setPremiumCheckoutLoading] = useState(false);
  const [premiumCheckoutError, setPremiumCheckoutError] = useState("");

  const unlockPremiumDemo = () => {
    setIsPremiumPreview(canUsePremiumPreview({ isDevelopment: import.meta.env.DEV, requested: true }));
  };

  const resetPremiumDemo = () => {
    setIsPremiumPreview(false);
  };

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("openingFit:theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  });
  const [username, setUsername] = useState("");
  const [accountUser, setAccountUser] = useState(null);
  const [platform, setPlatform] = useState("chesscom");
  const [importMonths, setImportMonths] = useState(3);
  const [analysisTimeFormat, setAnalysisTimeFormat] = useState(() =>
    normalizeAnalysisTimeFormat(localStorage.getItem(ANALYSIS_TIME_FORMAT_KEY) || "custom")
  );
  const [reportFilters, setReportFilters] = useState(loadStoredReportFilters);
  const [openingSamplePercent, setOpeningSamplePercent] = useState(() =>
    clampOpeningSamplePercent(localStorage.getItem(OPENING_SAMPLE_PERCENT_KEY) ?? 2)
  );
  const [apiStatus, setApiStatus] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [importStage, setImportStage] = useState(IMPORT_STAGES.IDLE);
  const [loadingElapsedSeconds, setLoadingElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const [data, setData] = useState(() => reportForInitialPath(getCurrentPath()));
  const [activeView, setActiveView] = useState(getInitialAppView);
  const [forceAnalyseImportFlow, setForceAnalyseImportFlow] = useState(false);
  const importAbortRef = useRef(null);
  const activeImportKeyRef = useRef("");
  const reportRedirectKeyRef = useRef("");
  const sampleEntrySourceRef = useRef(isSampleReportPath(getCurrentPath()) ? "direct_sample_url" : "");
  const parsedPgnMovesCacheRef = useRef(new Map());

  useEffect(() => {
    setAccountUser(supabaseUser || null);
  }, [supabaseUser]);

  const loadDemoReport = (source = "landing_sample_cta") => {
    const entry = sampleReportEntry(typeof source === "string" ? source : "sample_report");
    sampleEntrySourceRef.current = entry.analytics.source;
    setData(entry.report);
    setShowPublicLanding(false);
    setImportStatus(null);
    setError("");
    setActiveView(entry.view);
    if (window.location.pathname !== entry.path) {
      window.history.pushState({}, "", entry.path);
    }
    setTimeout(() => {
      scrollToAppTarget("app-results");
    }, 80);
  };

  const exitSampleReport = () => {
    const exit = sampleReportExit();
    setData(exit.report);
    setImportStatus(null);
    setError("");
    setForceAnalyseImportFlow(true);
    setActiveView(exit.view);
    window.history.pushState({}, "", exit.path);
    window.setTimeout(() => scrollToAppTarget(exit.target, { fallbackIds: ["app-dashboard"] }), 80);
  };

  const handleFounderPassClick = async (source = "pricing_page", billingInterval = "annual") => {
    void trackEvent("premium_upgrade_prompt_selected", { source: typeof source === "string" ? source : "pricing_page" });
    setPremiumCheckoutError("");

    if (!supabaseUser?.id) {
      try {
        localStorage.setItem(AUTH_RETURN_PATH_KEY, "/premium");
      } catch {
        // Login still works if return-path storage is unavailable.
      }
      setImportStatus({
        tone: "info",
        title: "Log in to get OpeningFit Plus",
        message: "Create an account or log in first, then OpeningFit will return you to the secure purchase page.",
        meta: "OpeningFit Plus",
      });
      setActiveView("profile");
      if (window.location.pathname !== "/login") {
        window.history.pushState({}, "", "/login");
      }
      setTimeout(() => scrollToAppTarget("login", { fallbackIds: ["profile"] }), 120);
      return;
    }

    if (isPremium || premiumCheckoutLoading) return;
    try {
      setPremiumCheckoutLoading(true);
      await startPremiumCheckout(supabaseUser, billingInterval);
    } catch (error) {
      console.error("OpeningFit Plus checkout failed", error);
      setPremiumCheckoutError(error?.message || "We could not start secure checkout. Please try again.");
    } finally {
      setPremiumCheckoutLoading(false);
    }
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
      setCloudSaveWarning(retryError?.message || "Could not restore account sync.");
    }
  };

  const handleAccountSignOut = async () => {
    if (!signOutAccount) return;
    await signOutAccount();
    setAccountUser(null);
  };


  const [showUnknownOpenings] = useState(false);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [replayOpeningFilter, setReplayOpeningFilter] = useState("");
  const [practiceOpening, setPracticeOpening] = useState(null);
  const [openSections, setOpenSections] = useState(closedSections);
  const [, setSavedProfileMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("General product feedback");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [, setLocalSavedAt] = useState("");
  const [cloudSaveWarning, setCloudSaveWarning] = useState("");
  const [cloudSaveStatus, setCloudSaveStatus] = useState("");
  const previousAuthUserIdRef = useRef(undefined);
  const shouldShowLandingIntro = () => {
    if (isPrivateSeoPath(getCurrentPath())) return false;

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
    if (importStage === IMPORT_STAGES.IDLE) return;
    logApiDiagnostic("import stage", { platform, stage: importStage });
  }, [importStage, platform]);

  useEffect(() => {
    try {
      const interrupted = JSON.parse(sessionStorage.getItem(ACTIVE_IMPORT_KEY) || "null");
      if (!interrupted?.requestKey) return;
      sessionStorage.removeItem(ACTIVE_IMPORT_KEY);
      setImportStage(IMPORT_STAGES.RECOVERABLE_ERROR);
      setImportStatus({
        tone: "warning",
        title: "Analysis was interrupted",
        message: interrupted.jobId
          ? "The background job may still be running. Start the same refresh again to reconnect to it; your last completed report was not changed."
          : "The previous request did not finish in this tab. Your last completed report was not changed.",
        meta: interrupted.platform === "lichess" ? "Lichess" : "Chess.com",
        category: "interrupted_refresh",
        canRetry: true,
        recoveryActions: ["retry", "last_report"],
      });
    } catch {
      sessionStorage.removeItem(ACTIVE_IMPORT_KEY);
    }
  }, []);

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
      setData(isSampleReportPath(getCurrentPath()) ? SAMPLE_REPORT : null);
      setSelectedGameIndex(0);
      setReplayOpeningFilter("");
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
    const nextTheme = theme === "light" ? "light" : "dark";
    if (nextTheme !== theme) {
      setTheme(nextTheme);
      return;
    }

    localStorage.setItem("openingFit:theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.body.classList.remove("light", "dark");
    document.body.classList.add(nextTheme);
  }, [theme]);

  useEffect(() => {
    if (authLoading || !authHydrated) return;
    if (supabaseUser?.id) return;
    if (isSampleReportPath(getCurrentPath())) {
      setData(SAMPLE_REPORT);
      setShowPublicLanding(false);
      return;
    }

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
          const restoredUsername = getImportedAccountUsername(parsed.analysis, parsed.username || savedUsername);
          const restoredPlatform = getImportedAccountPlatform(parsed.analysis, parsed.platform || savedPlatform);
          const restoredAnalysis = {
            ...parsed.analysis,
            ...(restoredUsername ? { username: restoredUsername } : {}),
          };
          setData(restoredAnalysis);
          if (restoredUsername) setUsername(restoredUsername);
          if (restoredPlatform && platforms[restoredPlatform]) setPlatform(restoredPlatform);
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
        const response = await fetch(buildApiUrl("/api/health"));

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
  }, [analysisTimeFormat]);

  useEffect(() => {
    localStorage.setItem(REPORT_FILTERS_KEY, JSON.stringify(normalizeReportFilters(reportFilters)));
  }, [reportFilters]);

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
    return trackProductEvent(event, { authenticated: Boolean(supabaseUser?.id), access: isPremium ? "premium" : "free", ...eventData });
  }

  function _getFriendlyError(errorText, selectedPlatformKey = platform) {
    if (!errorText) {
      return "Something went wrong. Please try again.";
    }

    const lower = String(errorText).toLowerCase();
    const platformLabel = platforms[selectedPlatformKey]?.label || "the selected platform";

    if (
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("connection refused") ||
      lower.includes("could not connect") ||
      lower.includes("load failed") ||
      lower.includes("500") ||
      lower.includes("502") ||
      lower.includes("503") ||
      lower.includes("504")
    ) {
      return "We could not reach the import server right now. Please try again in a minute.";
    }

    if (lower.includes("no games") || lower.includes("not enough games")) {
      return "We found the player, but not enough recent games to build a confident report.";
    }

    if (lower.includes("not found") || lower.includes("could not find") || lower.includes("404")) {
      return "Please check the username and platform.";
    }

    if (lower.includes("timeout") || lower.includes("too long")) {
      return "We could not reach the import server right now. Please try again in a minute.";
    }

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
      return `We couldn’t find that ${platformLabel} username.`;
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
      return "The chess platform is rate limiting requests. Please try again shortly.";
    }

    if (
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("connection refused") ||
      lower.includes("could not connect") ||
      lower.includes("load failed")
    ) {
      return "OpeningFit could not reach the analysis server. Please try again in a moment.";
    }

    if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504")) {
      return "We could not reach the import server right now. Please try again in a minute.";
    }

    if (lower.includes("404") && selectedPlatformKey === "lichess") {
      return "We couldn’t find that Lichess username.";
    }

    try {
      const parsed = JSON.parse(errorText);
      return _getFriendlyError(parsed.detail || parsed.message || "", selectedPlatformKey);
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
    const recentGameSource = Array.isArray(incoming.recent_games)
      ? incoming.recent_games
      : Array.isArray(incoming.recentGames)
        ? incoming.recentGames
        : [];
    const openingGameSource = Array.isArray(incoming.opening_games)
      ? incoming.opening_games
      : Array.isArray(incoming.openingGames)
        ? incoming.openingGames
        : [];
    const analysisGameIndexSource = Array.isArray(incoming.analysis_game_index)
      ? incoming.analysis_game_index
      : Array.isArray(incoming.analysisGameIndex)
        ? incoming.analysisGameIndex
        : [];
    const savedGameSource = Array.isArray(incoming.saved_games)
      ? incoming.saved_games
      : Array.isArray(incoming.savedGames)
        ? incoming.savedGames
        : [];
    const gamesSource = Array.isArray(incoming.games) ? incoming.games : [];
    const recentGames = recentGameSource.map(normalizeGameMetadata);
    const openingGames = openingGameSource.map(normalizeGameMetadata);
    const analysisGameIndex = analysisGameIndexSource.map(normalizeGameMetadata);
    const savedGames = savedGameSource.map(normalizeGameMetadata);
    const games = gamesSource.map(normalizeGameMetadata);

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
      recent_games: recentGames,
      recentGames,
      opening_games: openingGames,
      openingGames,
      analysis_game_index: analysisGameIndex,
      analysisGameIndex,
      saved_games: savedGames,
      savedGames,
      games: Array.isArray(incoming.games) ? games : incoming.games,
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
      recommended_openings:
        incoming.recommended_openings ??
        incoming.recommendedOpeningsByStyle ??
        {},
      recommendedOpeningsByStyle:
        incoming.recommendedOpeningsByStyle ??
        incoming.recommended_openings ??
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
    if (!canPersistReport(analysis)) return false;
    const savedAt = new Date().toISOString();
    const importedUsername = getImportedAccountUsername(analysis, cleanUsername) || cleanUsername;
    const importedPlatform = getImportedAccountPlatform(analysis, selectedPlatformKey) || selectedPlatformKey;

    const payload = {
      username: importedUsername,
      platform: importedPlatform,
      savedAt,
      analysis: {
        ...analysis,
        username: importedUsername,
        importPlatform: analysis.importPlatform || importedPlatform,
        import_platform: analysis.import_platform || importedPlatform,
        platform: analysis.platform || importedPlatform,
        lastUpdated: analysis.lastUpdated || savedAt,
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(USERNAME_KEY, importedUsername);
    localStorage.setItem(PLATFORM_KEY, importedPlatform);
    localStorage.setItem(
      ANALYSIS_TIME_FORMAT_KEY,
      normalizeAnalysisTimeFormat(analysis.analysisTimeFormat || analysisTimeFormat)
    );
    setLocalSavedAt(savedAt);
    return true;
  };

  const handleCloudRestore = async (event) => {
    event?.preventDefault?.();

    if (restoreInProgress) return;

    if (!isSupabaseConfigured) {
      setCloudSaveStatus("failed");
      setCloudSaveWarning("Cloud restore is not connected in this environment.");
      setImportStatus({
        tone: "warning",
        title: "Cloud restore unavailable",
        message: "Cloud restore is not connected in this environment. You can continue locally.",
      });
      return { ok: false, reason: "Cloud restore is not connected in this environment.", restoredCounts: { history: 0, progress: 0, savedGames: 0, reports: 0 } };
    }

    if (authLoading || !authHydrated) {
      setCloudSaveStatus("saving");
      setCloudSaveWarning("");
      setImportStatus({
        tone: "info",
        title: "Checking account",
        message: "OpeningFit is still checking your login session. Try restore again in a moment, or continue locally.",
      });
      return { ok: false, reason: "not logged in", restoredCounts: { history: 0, progress: 0, savedGames: 0, reports: 0 } };
    }

    if (!supabaseUser?.id) {
      setCloudSaveStatus("failed");
      setCloudSaveWarning("Log in to restore cloud data.");
      setImportStatus({
        tone: "warning",
        title: "Login required",
        message: "Log in to restore cloud data, or continue locally on this device.",
      });
      openLoginPage(event);
      return { ok: false, reason: "not logged in", restoredCounts: { history: 0, progress: 0, savedGames: 0, reports: 0 } };
    }

    setCloudSaveStatus("saving");
    setCloudSaveWarning("");
    setImportStatus({
      tone: "info",
      title: "Restoring cloud data",
      message: "Looking for your saved reports, progress, and settings...",
    });

    const result = await restoreCloudSnapshot?.(supabaseUser.id);

    if (!result?.ok) {
      const reason = result?.reason || "Cloud restore failed.";
      setCloudSaveStatus("failed");
      setCloudSaveWarning(reason);
      setImportStatus({
        tone: reason === "No cloud backup found for this account yet." ? "info" : "warning",
        title:
          reason === "No cloud backup found for this account yet."
            ? "No cloud backup found"
            : "Cloud restore failed",
        message:
          reason === "No cloud backup found for this account yet."
            ? "No saved cloud data was found for this account yet. Analyse games to create your first saved report."
            : "We could not restore your cloud data. Try again or continue locally.",
      });
      return result;
    }

    const restored = getRestoredCloudReport(result.snapshot || {});
    if (restored?.report) {
      const restoredUsername =
        getImportedAccountUsername(restored.report, restored.username || username) || "Unknown player";
      const restoredPlatform =
        platforms[restored.platform]
          ? restored.platform
          : getImportedAccountPlatform(restored.report, platform);

      setData({
        ...restored.report,
        username: restoredUsername,
      });
      setUsername(restoredUsername);
      if (platforms[restoredPlatform]) {
        setPlatform(restoredPlatform);
      }
      saveLocalAnalysis({ ...restored.report, username: restoredUsername }, restoredUsername, restoredPlatform);
      setShowPublicLanding(false);
      setActiveView("report");
      if (getCurrentPath() === "/" || getCurrentPath() === "/login" || getCurrentPath() === "/account") {
        window.history.replaceState({}, "", "/report");
      }
    }

    setCloudSaveStatus("saved");
    setCloudSaveWarning("");
    setImportStatus({
      tone: "success",
      title: "Cloud data restored.",
      message: restored?.report
        ? "Your saved report and account data are loaded."
        : "Your saved account data is loaded.",
      meta: result.restoredCounts
        ? `${result.restoredCounts.reports} reports · ${result.restoredCounts.progress} progress rows`
        : null,
    });
    return result;
  };

  const saveOpeningFitProgressState = async (report, summary, progressSnapshot) => {
    if (!supabaseUser?.id || !upsertCloudUserData || !progressSnapshot) return null;
    const openingHealth = progressSnapshot.openingHealth || summary?.openingHealth || null;
    const weakLines = summary?.weakLines || mergeWeakLines(report);

    const nextUsername =
      getImportedAccountUsername(report, username) || "Unknown player";
    const nextPlatform =
      getImportedAccountPlatform(report, platform) || "unknown";
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
      { onConflict: "user_id,platform,username", required: false }
    );
  };

  const runOptionalCloudSyncStep = async (label, work) => {
    try {
      return {
        ok: true,
        label,
        value: await work(),
      };
    } catch (cloudError) {
      console.warn(`OpeningFit optional cloud sync failed: ${label}`, cloudError);
      return {
        ok: false,
        label,
        error: cloudError,
      };
    }
  };

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const sectionRouteMap = {
    "dashboard": { view: "dashboard", path: "/dashboard", target: "coach-dashboard" },
    "journey": { view: "journey", path: "/journey", target: "journey-page" },
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
    "my-repertoire": { view: "repertoire", path: "/repertoire", target: "my-repertoire" },
    "progress-tracker": { view: "profile", target: "profile" },
    "share-report": { view: "profile", target: "report-history" },
    "report-history": { view: "profile", target: "report-history" },
    "top-openings-table": { view: "report", target: "evidence-table", reportMode: "table" },
    "section-top": { view: "report", target: "evidence-table", reportMode: "table" },
    "section-chart": { view: "report", target: "evidence-table", reportMode: "table" },
  };

  const handleAppNavigate = (routeOrKey, options = {}) => {
    let requested =
      typeof routeOrKey === "string"
        ? sectionRouteMap[routeOrKey] || routeOrKey
        : routeOrKey;
    const requestedRoute = typeof requested === "string" ? null : requested;
    const requestedSection = typeof requested === "string" ? getAppSection(requested) : getAppSection(requestedRoute?.view);
    if (isSampleReport(data) && requestedSection === "report") {
      requested = typeof requested === "string"
        ? { view: "report", path: SAMPLE_REPORT_PATH, target: "app-results" }
        : { ...requested, path: SAMPLE_REPORT_PATH };
    }
    const requestedView = typeof requested === "string" ? requested : requested?.view;
    setForceAnalyseImportFlow(requestedView === "analyse");
    if (requested && typeof requested === "object" && "replayOpening" in requested) {
      setReplayOpeningFilter(requested.replayOpening || "");
      setSelectedGameIndex(0);
    }
    navigateApp(requested, {
      ...options,
      setView: setActiveView,
    });
  };

  const startOpeningPractice = (openingTarget) => {
    if (!openingTarget) return;
    const sampleMode = isSampleReport(data);
    void trackEvent("training_started", { source: sampleMode ? "sample_report" : "report_or_repertoire", sample: sampleMode, reportKind: sampleMode ? "sample" : "user", openingCategory: openingTarget.contextKey || openingTarget.section || openingTarget.side || "opening" });
    setPracticeOpening(openingTarget);
    if (sampleMode) {
      window.setTimeout(() => scrollToAppTarget("opening-practice", { fallbackIds: ["report-training-plan", "app-results"] }), 60);
      return;
    }
    handleAppNavigate({
      view: "train",
      path: "/train",
      target: "opening-practice",
      fallbackIds: ["today-training", "training-plan"],
    });
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

  const monthsToImport = Math.min(importMonths, gameHistoryMonths);

  const selectImportPlatform = (nextPlatform) => {
    void trackEvent("platform_selected", { platform: nextPlatform, source: "analysis_form" });
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
    setImportStage(IMPORT_STAGES.IDLE);
    activeImportKeyRef.current = "";
    try {
      sessionStorage.removeItem(ACTIVE_IMPORT_KEY);
    } catch {
      // Session storage can be unavailable in private browser contexts.
    }
    setLoadingStep("");
    setError("");
    setImportStatus({
      tone: "info",
      title: "Import cancelled",
      message: "No changes were made to your current report. You can edit the username or switch platform and try again.",
      meta: "Stopped by you",
    });
  };

  const redirectToReportAfterSuccessfulImport = (redirectKey) => {
    if (!redirectKey) return;
    const alreadyRedirected = reportRedirectKeyRef.current === redirectKey;
    reportRedirectKeyRef.current = redirectKey;
    const journey = completedAnalysisJourney();
    setActiveView(journey.view);
    if (typeof window !== "undefined" && window.location.pathname !== journey.path) {
      window.history.pushState({}, "", journey.path);
    }
    if (typeof window !== "undefined" && !alreadyRedirected) {
      window.requestAnimationFrame(() => {
        scrollToAppTarget("app-results", { behavior: "auto" });
      });
    }
  };

  const importGames = async (usernameOverride, platformOverride) => {
    const selectedPlatformKey = platforms[platformOverride] ? platformOverride : platform;
    const cleanUsername = String(usernameOverride ?? username).trim();
    const selectedPlatform = platforms[selectedPlatformKey] || platforms.chesscom;
    const validation = validateImportUsername(cleanUsername);
    const hadPreviousReport = Boolean(data);

    setImportStage(IMPORT_STAGES.VALIDATING);
    if (!validation.ok) {
      const failure = classifyImportFailure({ error: validation, platform: selectedPlatformKey, hadPreviousReport: Boolean(data) });
      setError("");
      setImportStatus({
        tone: "warning",
        title: failure.title,
        message: `${failure.message} ${failure.lossMessage}`,
        meta: selectedPlatform.label,
        category: failure.category,
        canRetry: failure.canRetry,
      });
      setImportStage(IMPORT_STAGES.RECOVERABLE_ERROR);
      return;
    }

    const requestKey = buildImportRequestKey({
      platform: selectedPlatformKey,
      username: cleanUsername,
      months: monthsToImport,
      timeControl: normalizeAnalysisTimeFormat(analysisTimeFormat),
    });
    if (loading || activeImportKeyRef.current === requestKey) {
      setImportStatus({
        tone: "info",
        title: "Analysis already running",
        message: `OpeningFit is already analysing this ${selectedPlatform.label} account. A duplicate request was not sent.`,
        meta: selectedPlatform.label,
        category: "duplicate_submission",
      });
      return;
    }
    activeImportKeyRef.current = requestKey;
    const importSessionKey = requestKey;
    const dailySessionStartedKey = `${supabaseUser?.id || cleanUsername || "guest"}:${new Date()
      .toISOString()
      .slice(0, 10)}`;
    const abortController = new AbortController();
    importAbortRef.current = abortController;
    let importRequestDetails = {
      platform: selectedPlatformKey,
      username: cleanUsername,
      months: monthsToImport,
      url: "",
      status: null,
      responseText: "",
    };
    let successfulReportRedirectKey = "";

    setLoading(true);
    void trackEvent("username_submitted", { platform: selectedPlatformKey, source: "analysis_form" });
    void trackEvent("analysis_started", { platform: selectedPlatformKey, source: "analysis_form", refresh: hadPreviousReport });
    if (data) void trackEvent("reanalysis_started", { platform: selectedPlatformKey, source: "analysis_form" });
    setImportStage(IMPORT_STAGES.FETCHING);
    setLoadingStep("Finding your games...");
    setError("");
    setImportStatus({
      tone: "info",
      title: hadPreviousReport ? "Refreshing report in the background" : `Importing ${selectedPlatform.label} games`,
      message: hadPreviousReport
        ? `You can keep using OpeningFit while new ${selectedPlatform.label} games for ${cleanUsername} are analysed.`
        : `Checking public games for ${cleanUsername}. This can take a little longer for large imports.`,
      meta: hadPreviousReport ? "Background analysis" : "Import started",
    });
    setCloudSaveWarning("");
    setCloudSaveStatus("");
    setSavedProfileMessage("");
    if (!hadPreviousReport) {
      setSelectedGameIndex(0);
      setPracticeOpening(null);
      setOpenSections(closedSections);
    }
    try {
      sessionStorage.setItem(ACTIVE_IMPORT_KEY, JSON.stringify({
        requestKey,
        platform: selectedPlatformKey,
        username: cleanUsername,
        months: monthsToImport,
        startedAt: new Date().toISOString(),
      }));
    } catch {
      // The import still works when refresh recovery cannot be recorded.
    }

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

      setLoadingStep("Finding your games...");

      const importResult = await runWithControlledRetry(
        () => importGamesFromApi({
          platform: selectedPlatform.apiPath,
          username: cleanUsername,
          months: monthsToImport,
          timeControl: normalizeAnalysisTimeFormat(analysisTimeFormat),
          controller: abortController,
          accessToken: authSession?.access_token || "",
          onJobStarted: (job) => {
            try {
              const activeImport = JSON.parse(sessionStorage.getItem(ACTIVE_IMPORT_KEY) || "{}");
              sessionStorage.setItem(ACTIVE_IMPORT_KEY, JSON.stringify({
                ...activeImport,
                jobId: job.jobId,
                jobStatus: job.status,
              }));
            } catch {
              // Background analysis continues if session storage is unavailable.
            }
          },
        }),
        {
          maxRetries: 2,
          onRetry: ({ attempt, error: retryError }) => {
            setImportStatus({
              tone: "info",
              title: `Retrying ${selectedPlatform.label}`,
              message: `The service did not respond cleanly. OpeningFit is making controlled retry ${attempt} of 2.`,
              meta: retryError?.status ? `HTTP ${retryError.status}` : "Connection retry",
              category: retryError?.type || "retry",
            });
          },
        }
      );
      void trackEvent("account_lookup_succeeded", { platform: selectedPlatformKey, resultCategory: "public_account" });
      const json = importResult.data;
      importRequestDetails = {
        ...importRequestDetails,
        url: importResult.url,
        status: importResult.status,
        responseText: importResult.responseText,
      };

      logApiDiagnostic("import response", {
        url: importResult.url,
        platform: selectedPlatformKey,
        months: monthsToImport,
        status: importResult.status,
        ok: true,
      });

      try {
      setImportStage(IMPORT_STAGES.ACCOUNT_FOUND);
      setLoadingStep(`${selectedPlatform.label} account found.`);
      await new Promise((resolve) => setTimeout(resolve, 120));
      setImportStage(IMPORT_STAGES.FILTERING);
      setLoadingStep("Checking eligible time controls...");
      await new Promise((resolve) => setTimeout(resolve, 250));

      setImportStage(IMPORT_STAGES.IDENTIFYING);
      setLoadingStep("Identifying recurring opening positions...");
      await new Promise((resolve) => setTimeout(resolve, 250));

      const normalizedImportData = normaliseData(json);
      const importedUsername =
        getImportedAccountUsername(normalizedImportData, cleanUsername) || cleanUsername;
      const importedPlatform =
        getImportedAccountPlatform(normalizedImportData, selectedPlatformKey) || selectedPlatformKey;
      const cleanData = {
        ...normalizedImportData,
        username: importedUsername,
        importPlatform: normalizedImportData.importPlatform || importedPlatform,
        import_platform: normalizedImportData.import_platform || importedPlatform,
        platform: normalizedImportData.platform || importedPlatform,
      };
      const importOutcome = buildImportOutcome(cleanData, selectedPlatform.label);

      if (!buildReportGameCounts(cleanData).classified) {
        setImportStage(IMPORT_STAGES.RECOVERABLE_ERROR);
        setError("");
        setImportStatus({
          ...importOutcome,
          message: `${importOutcome.message} Your previous successful report, if any, is still available.`,
          category: "no_public_games",
          canRetry: false,
          recoveryActions: [
            ...(monthsToImport < gameHistoryMonths ? ["expand_period"] : []),
            "switch_platform",
            "sample",
            ...(data ? ["last_report"] : []),
          ],
        });
        setLoadingStep("No public games found.");
        await trackEvent("frontend_import_no_games", {
          username: cleanUsername,
          platform: selectedPlatformKey,
          months: monthsToImport,
        });
        return;
      }

      setImportStage(IMPORT_STAGES.RECOMMENDING);
      setLoadingStep("Preparing recommendations...");
      await new Promise((resolve) => setTimeout(resolve, 180));
      const reportRetentionKey = buildReportRetentionKey(cleanData, {
        username: cleanUsername,
        platform: selectedPlatformKey,
        games: cleanData.gamesImported ?? cleanData.total_games,
      });
      cleanData.analysisId = cleanData.analysisId || reportRetentionKey;
      cleanData.analysis_id = cleanData.analysisId;
      cleanData.analysisCompleted = true;
      cleanData.analysis_completed = true;
      cleanData.analysisOwnerUserId = supabaseUser?.id || null;
      cleanData.analysis_owner_user_id = cleanData.analysisOwnerUserId;
      const userReportRetentionKey = `${supabaseUser?.id || "guest"}:${reportRetentionKey}`;
      setImportStage(IMPORT_STAGES.SAVING);
      setLoadingStep("Saving your completed report...");
      setData(cleanData);
      setUsername(importedUsername);
      setImportStatus(
        importOutcome.tone === "warning"
          ? {
              ...importOutcome,
              category: "too_few_games",
              recoveryActions: [
                ...(monthsToImport < gameHistoryMonths ? ["expand_period"] : []),
                "switch_platform",
              ],
            }
          : importOutcome
      );
      saveLocalAnalysis(cleanData, importedUsername, selectedPlatformKey);
      successfulReportRedirectKey = userReportRetentionKey;
      setImportStage(IMPORT_STAGES.COMPLETE);
      const completedCounts = buildReportGameCounts(cleanData);
      void trackEvent("analysis_completed", {
        platform: selectedPlatformKey,
        source: "analysis_form",
        refresh: hadPreviousReport,
        games: completedCounts.analysedGames,
        fetchedGames: completedCounts.fetchedGames,
        dateRangeEligibleGames: completedCounts.dateRangeEligibleGames,
        timeControlEligibleGames: completedCounts.timeControlEligibleGames,
        analysisCandidateGames: completedCounts.analysisCandidateGames,
        analysedGames: completedCounts.analysedGames,
        excludedGames: completedCounts.excludedGames,
        analysisId: cleanData.analysisId,
      });

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

      rememberLandingSeen({ keepPublicLanding: false });

      setSavedProfileMessage(
        `${importOutcome.title}. Saved ${supabaseUser?.id ? "to your account" : "locally"} so you can load it next time.`
      );

      if (supabaseUser?.id) {
        setCloudSaveStatus("saving");
        const importFitData = buildOpeningFitData(cleanData);
        const reportSummary = buildReportHistorySummary(cleanData, importFitData);
        reportSummary.analysisId = cleanData.analysisId;
        reportSummary.analysisCompleted = true;
        reportSummary.analysisOwnerUserId = supabaseUser.id;
        reportSummary.newGamesSincePrevious = cleanData.newEligibleGames ?? cleanData.new_games_since_previous ?? null;
        reportSummary.activeRepertoire =
          openingFitUserState?.[0]?.coach_progress?.repertoireWorkspace ||
          openingFitUserState?.[0]?.coach_progress?.repertoire_workspace ||
          null;
        const progressSnapshot = buildOpeningFitProgressSnapshot(
          cleanData,
          importFitData,
          cloudReportHistory || []
        );
        const recommendationSnapshot = buildRecommendationHistorySnapshot(cleanData, importFitData);
        const openingGamification = buildOpeningGamificationSnapshot(cleanData, importFitData);
        const weeklyOpeningReport = buildWeeklyOpeningSnapshot(
          cleanData,
          openingFitUserState?.[0]?.coach_progress?.weeklyOpeningSnapshots || []
        );
        reportSummary.openingFitProgress = progressSnapshot;
        reportSummary.openingGamification = openingGamification;

        void (async () => {
          const cloudSyncResults = await Promise.allSettled([
            runOptionalCloudSyncStep("report history", () => saveCloudReport?.(cleanData, reportSummary)),
            runOptionalCloudSyncStep("analysed games", () => saveCloudAnalysedGames?.(cleanData, reportSummary)),
            runOptionalCloudSyncStep("progress state", () => saveOpeningFitProgressState(cleanData, reportSummary, progressSnapshot)),
            runOptionalCloudSyncStep("recommendation history", () => saveRecommendationHistory?.(recommendationSnapshot)),
            runOptionalCloudSyncStep("activity", () =>
              recordCloudActivity?.("report_imported", {
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
              })
            ),
          ]);
          const cloudSyncFailures = cloudSyncResults.filter(
            (result) => result.status === "rejected" || result.value?.ok === false
          );
          const reportSaveFailed = cloudSyncFailures.some(
            (result) =>
              result.status === "rejected" ||
              result.value?.label === "report history"
          );
          const cloudSyncSuccesses = cloudSyncResults.filter(
            (result) => result.status === "fulfilled" && result.value?.ok
          );

          if (cloudSyncSuccesses.length) {
            await runOptionalCloudSyncStep("refresh user data", () => refreshUserData?.(supabaseUser));
          }

          if (!reportSaveFailed) {
            setCloudSaveStatus("saved");
            setCloudSaveWarning("");
          } else {
            const authExpired = cloudSyncFailures.some((result) =>
              /jwt|session|auth|unauthorized|401/i.test(String(result.value?.error?.message || result.reason?.message || ""))
            );
            const saveFailure = classifyImportFailure({
              error: { category: authExpired ? "authentication_expired" : "cloud_save_failure" },
              platform: selectedPlatformKey,
              reportCreated: true,
            });
            setCloudSaveStatus("failed");
            setCloudSaveWarning(`${saveFailure.title}. ${saveFailure.message}`);
          }
        })();
      } else {
        console.info("Skipping cloud save: user is not signed in");
        setCloudSaveStatus("local");
      }
      } catch (postImportError) {
        console.warn("OpeningFit post-import handling failed", {
          platform: selectedPlatformKey,
          username: cleanUsername,
          months: monthsToImport,
          errorName: postImportError?.name,
          errorMessage: postImportError?.message,
          error: postImportError,
        });
        setLoadingStep("");
        setCloudSaveStatus((current) => current || "local");
        setCloudSaveWarning(
          "Analysis complete, but some post-import actions could not finish. Your report is kept locally."
        );
      }
    } catch (err) {
      if (err?.name !== "ImportClientError") {
        console.warn("OpeningFit import setup failed before backend import", {
          platform: selectedPlatformKey,
          username: cleanUsername,
          months: monthsToImport,
          errorName: err?.name,
          errorMessage: err?.message,
          error: err,
        });
        setImportStage(IMPORT_STAGES.FATAL_ERROR);
        setError("OpeningFit could not start the import. Please refresh and try again.");
        setImportStatus({
          tone: "warning",
          title: "Import did not start",
          message: `OpeningFit hit a local app error before contacting the analysis server. ${data ? "Your last successful report is still available." : "No completed report was replaced."}`,
          meta: selectedPlatform.label,
          category: "fatal_local_error",
          canRetry: true,
          recoveryActions: ["retry", ...(data ? ["last_report"] : [])],
        });
        return;
      }

      importRequestDetails = {
        ...importRequestDetails,
        url: err?.url || importRequestDetails.url,
        status: err?.status ?? importRequestDetails.status,
        responseText: err?.responseText || importRequestDetails.responseText,
      };

      console.error("OpeningFit import failed", {
        platform: selectedPlatformKey,
        stage: importStage,
        months: monthsToImport,
        status: importRequestDetails.status,
        errorName: err?.errorName || err?.name,
        errorType: err?.type || "unknown",
      });

      logApiDiagnostic("import failure", {
        name: err?.name,
        message: err?.message,
        type: err?.type,
        status: err?.status,
        platform: selectedPlatformKey,
      });

      if (err?.name === "AbortError" || err?.message === "Import cancelled.") {
        setError("");
        setImportStatus({
          tone: "info",
          title: "Import cancelled",
          message: "No changes were made to your current report. You can adjust the username or platform and try again.",
          meta: "Stopped by you",
        });
        return;
      }

      const failure = classifyImportFailure({
        error: err,
        platform: selectedPlatformKey,
        hadPreviousReport: Boolean(data),
      });
      void trackEvent("account_lookup_failed", { platform: selectedPlatformKey, errorCategory: failure.category });
      void trackEvent("analysis_failed", { platform: selectedPlatformKey, errorCategory: failure.category });
      setImportStage(failure.fatal ? IMPORT_STAGES.FATAL_ERROR : IMPORT_STAGES.RECOVERABLE_ERROR);
      setError(failure.message);
      setImportStatus({
        tone: "warning",
        title: failure.title,
        message: `${failure.message} ${failure.lossMessage}`,
        meta: selectedPlatform.label,
        category: failure.category,
        canRetry: failure.canRetry,
        recoveryActions: [
          ...(failure.canRetry ? ["retry"] : []),
          ...(["no_public_games", "too_few_games"].includes(failure.category) ? ["expand_period", "switch_platform", "sample"] : []),
          ...(data ? ["last_report"] : []),
        ],
      });
    } finally {
      if (importAbortRef.current === abortController) {
        importAbortRef.current = null;
      }
      if (activeImportKeyRef.current === requestKey) {
        activeImportKeyRef.current = "";
      }
      try {
        sessionStorage.removeItem(ACTIVE_IMPORT_KEY);
      } catch {
        // Ignore unavailable session storage.
      }
      setLoading(false);
      setLoadingStep("");
      if (successfulReportRedirectKey) {
        setForceAnalyseImportFlow(false);
        redirectToReportAfterSuccessfulImport(successfulReportRedirectKey);
      }
    }
  };

  const submitFeedback = async () => {
    const reportIdentifier = reportData ? [getImportedAccountPlatform(reportData, platform), getImportedAccountUsername(reportData, username), reportDateValue(reportData), getImportedGameCount(reportData)].join(":") : "";
    const validation = validateFeedback({ category: feedbackCategory, message: feedbackMessage, route: window.location.pathname, platform, reportIdentifier, contact: feedbackContact.trim() || supabaseUser?.email || "" });
    if (!validation.valid) {
      setFeedbackStatus(validation.error);
      return;
    }

    setFeedbackSending(true);
    setFeedbackStatus("Sending feedback...");

    try {
      const createdAt = new Date().toISOString();
      const { message, contact, category, route, reportIdentifier: safeReportIdentifier } = validation.value;
      const payload = {
        message,
        category,
        contact,
        email: contact,
        username: username.trim() || null,
        platform,
        page: route,
        route,
        report_identifier: safeReportIdentifier || null,
        createdAt,
        created_at: createdAt,
      };

      let lastError = null;

      for (const endpoint of ["/api/feedback", "/api/feedback-local"]) {
        try {
          const response = await fetch(buildApiUrl(endpoint), {
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
      void trackEvent(feedbackCategory === "Broken game import" ? "import_problem_reported" : "general_feedback_submitted", { platform, resultCategory: feedbackCategory, source: "feedback_form" });
    } catch (err) {
      setFeedbackStatus(getFeedbackError(err.message));
    } finally {
      setFeedbackSending(false);
    }
  };

  const reportData = useMemo(() => {
    const sourceData = data
      ? {
          ...data,
          cloudAnalysedGames,
          cloud_analysed_games: cloudAnalysedGames,
        }
      : data;
    return applyReportFilters(sourceData, reportFilters) || sourceData;
  }, [cloudAnalysedGames, data, reportFilters]);

  useEffect(() => {
    setSelectedGameIndex(0);
  }, [reportFilters.timeControl, reportFilters.dateRange, reportFilters.colour, reportFilters.openingQuery]);

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
    const replayOpeningKey = normaliseOpeningKey(replayOpeningFilter);
    const baseGames = filterUnknownOpenings(
      (reportData?.recent_games || []).filter((game) => gamePassesReportFilters(game, reportFilters))
    );
    if (!replayOpeningKey) return baseGames;

    return baseGames.filter((game) => {
      const gameOpeningKey = normaliseOpeningKey(game?.opening || game?.name || game?.openingName || game?.opening_name || "");
      return gameOpeningKey && (gameOpeningKey.includes(replayOpeningKey) || replayOpeningKey.includes(gameOpeningKey));
    });
  }, [filterUnknownOpenings, reportData, reportFilters, replayOpeningFilter]);

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

    const previewLimit = featureLimit(entitlement, OPENINGFIT_FEATURES.WEEKLY_PLAN_PREVIEW, "tasks", 1);
    const planLimit = featureLimit(entitlement, OPENINGFIT_FEATURES.WEEKLY_PLAN, "tasks", previewLimit);
    return uniquePlan.slice(0, planLimit);
  }, [
    reportData,
    fitData,
    filteredTopOpenings,
    filteredPreferredWhite,
    filteredPreferredBlack,
    entitlement,
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
  const currentPath = getCurrentPath();
  const resolvedAccountUser = supabaseUser || accountUser;
  const loginAccountState = accountExperienceState({ authLoading, authHydrated, profileLoading, user: resolvedAccountUser });
  const isSignedOutLoginPage = currentPath === "/login" && loginAccountState === "signed_out";
  const analyticsViewRef = useRef("");
  useEffect(() => {
    const key = `${activeAppSection}:${currentPath}`;
    if (analyticsViewRef.current === key) return;
    analyticsViewRef.current = key;
    const sampleMode = isSampleReport(reportData);
    const common = {
      authenticated: Boolean(supabaseUser?.id),
      access: isPremium ? "premium" : "free",
      ...(sampleMode ? sampleAnalyticsContext(sampleEntrySourceRef.current || "sample_route") : { sample: false, reportKind: "user" }),
      ...(reportData ? (() => { const counts = buildReportGameCounts(reportData); return { fetchedGames: counts.fetchedGames, dateRangeEligibleGames: counts.dateRangeEligibleGames, timeControlEligibleGames: counts.timeControlEligibleGames, analysisCandidateGames: counts.analysisCandidateGames, analysedGames: counts.analysedGames, excludedGames: counts.excludedGames }; })() : {}),
    };
    if (isPublicLanding) void trackProductEvent("homepage_viewed", { ...common, route: currentPath });
    if (activeAppSection === "report" && reportData) { const reportPlatform = sampleMode ? "example" : platform; void trackProductEvent("report_viewed", { ...common, platform: reportPlatform, source: sampleMode ? common.source : "navigation" }); void trackProductEvent("coach_verdict_viewed", { ...common, platform: reportPlatform, source: sampleMode ? "sample_report" : "report" }); sampleEntrySourceRef.current = ""; }
    if (activeAppSection === "repertoire") void trackProductEvent("repertoire_viewed", { ...common, platform, source: "navigation" });
    if (activeAppSection === "journey") { const reportCount = cloudReportHistory?.length || 0; void trackProductEvent("returning_dashboard_viewed", { ...common, platform, reportCount }); if (reportCount >= 2) void trackProductEvent("report_comparison_viewed", { ...common, reportCount }); }
  }, [activeAppSection, cloudReportHistory?.length, currentPath, isPremium, isPublicLanding, platform, reportData, supabaseUser?.id]);
  useEffect(() => {
    if (activeAppSection === "premium") void trackProductEvent("premium_page_viewed", { route: window.location.pathname, authenticated: Boolean(supabaseUser?.id), access: isPremium ? "premium" : "free" }, { onceKey: window.location.pathname });
  }, [activeAppSection, isPremium, supabaseUser?.id]);
  const showCoachDashboard =
    !forceAnalyseImportFlow &&
    (activeView === "dashboard" || Boolean((supabaseUser || accountUser) && reportData && activeAppSection === "analyse"));
  const showAnalyseImportFlow = forceAnalyseImportFlow || !showCoachDashboard || !reportData;
  const currentAnalysisPlatformLabel = platforms[platform]?.label || "your chess platform";
  const effectiveReportHistory = useMemo(() => {
    const history = Array.isArray(cloudReportHistory) ? cloudReportHistory : [];
    if (!data || isDemoAnalysis(data)) return history;

    const currentStamp = reportDateValue(data);
    const alreadyPresent = history.some((item) => {
      const report = reportFromHistoryItem(item);
      if (report === data) return true;
      const samePlayer =
        String(getImportedAccountUsername(report, "")).toLowerCase() ===
          String(getImportedAccountUsername(data, "")).toLowerCase() &&
        String(getImportedAccountPlatform(report, "")).toLowerCase() ===
          String(getImportedAccountPlatform(data, "")).toLowerCase();
      const sameStamp = currentStamp && reportDateValue(report, item) === currentStamp;
      const sameGames = getImportedGameCount(report) === getImportedGameCount(data);
      return samePlayer && sameStamp && sameGames;
    });

    if (alreadyPresent) return history;

    return [
      {
        id: "current-analysis-preview",
        createdAt:
          data.importedAt ||
          data.imported_at ||
          data.lastUpdated ||
          data.last_updated ||
          new Date().toISOString(),
        username: getImportedAccountUsername(data, username),
        platform: getImportedAccountPlatform(data, platform),
        report: data,
        summary: buildReportHistorySummary(data, fitData),
      },
      ...history,
    ];
  }, [cloudReportHistory, data, fitData, platform, username]);
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
    handleAppNavigate("repertoire");
  };

  const goToReturnUserWeaknesses = () => {
    loadLatestCloudReport();
    handleAppNavigate("weakspots");
  };

  const goToReturnUserStudyPlan = () => {
    loadLatestCloudReport();
    handleAppNavigate({ view: "train", path: "/train", target: "opening-practice" });
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

  const trustPageKey = ({ "/about": "about", "/how-it-works": "how", "/privacy": "privacy", "/terms": "terms", "/changelog": "changelog" })[currentPath] || null;
  const chessOpeningSlug = getChessOpeningSeoSlugFromPath(currentPath);
  const chessOpeningSeoPage = chessOpeningSlug ? getChessOpeningSeoPage(chessOpeningSlug) : null;
  const openingSlug = getOpeningSeoSlugFromPath(currentPath);
  const openingSeoPage = openingSlug ? getOpeningSeoPage(openingSlug) : null;
  const isOpeningHub = currentPath === "/openings";
  const isGuidesHub = currentPath === "/guides";
  const guideSeoPage = getGuideSeoPageFromPath(currentPath);
  const isUnknownGuidePath = /^\/guides\/[^/]+$/.test(currentPath) && !guideSeoPage;
  const isUnknownChessOpeningPath = Boolean(chessOpeningSlug && !chessOpeningSeoPage);
  const isUnknownOpeningPath = Boolean(openingSlug && !openingSeoPage);
  const seoPage = SEO_PAGES[currentPath] || null;
  const seoData = useMemo(() => {
    if (trustPageKey) return { title: `${trustPageKey === "how" ? "How analysis works" : trustPageKey[0].toUpperCase() + trustPageKey.slice(1)} | OpeningFit`, description: "OpeningFit product, analysis, privacy and support information.", path: currentPath, url: `${SITE_URL}${currentPath}` };
    if (isGuidesHub) {
      return {
        title: guideHubPage.title,
        description: guideHubPage.metaDescription,
        path: "/guides",
        url: `${SITE_URL}/guides`,
      };
    }

    if (guideSeoPage) {
      return {
        title: guideSeoPage.title,
        description: guideSeoPage.metaDescription,
        path: `/guides/${guideSeoPage.slug}`,
        url: `${SITE_URL}/guides/${guideSeoPage.slug}`,
      };
    }

    if (isUnknownGuidePath) {
      return {
        title: "Opening guide not found | OpeningFit",
        description: "This OpeningFit chess opening guide has not been published yet.",
        path: currentPath,
        url: `${SITE_URL}/guides`,
      };
    }

    if (chessOpeningSeoPage) {
      return {
        title: `${chessOpeningSeoPage.name}: does it fit your chess style? | OpeningFit`,
        description: chessOpeningSeoPage.shortDescription || chessOpeningSeoPage.description,
        path: currentPath,
        url: `${SITE_URL}${currentPath}`,
      };
    }

    if (isUnknownChessOpeningPath) {
      return {
        title: "Opening guide not found | OpeningFit",
        description: "This OpeningFit chess opening guide has not been published yet.",
        path: currentPath,
        url: `${SITE_URL}/chess-openings/vienna-game`,
      };
    }

    if (isOpeningHub) {
      return {
        title: "Chess Openings by Playing Style | OpeningFit",
        description:
          "Browse chess openings by playing style, rating, and role, then use OpeningFit to see which openings fit your real games.",
        path: "/openings",
        url: `${SITE_URL}/openings`,
      };
    }

    if (openingSeoPage) {
      return {
        title: openingSeoPage.seoTitle,
        description: openingSeoPage.seoDescription,
        path: currentPath,
        url: `${SITE_URL}${currentPath}`,
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
  }, [
    chessOpeningSeoPage,
    currentPath,
    guideSeoPage,
    isGuidesHub,
    isOpeningHub,
    isUnknownChessOpeningPath,
    isUnknownGuidePath,
    isUnknownOpeningPath,
    openingSeoPage,
    trustPageKey,
  ]);
  const shouldNoindex =
    isPrivateSeoPath(currentPath) ||
    isUnknownGuidePath ||
    isUnknownChessOpeningPath ||
    isUnknownOpeningPath ||
    (currentPath === "/" && hasReport);
  const canonicalUrl =
    isUnknownGuidePath
      ? `${SITE_URL}/guides`
      : isUnknownChessOpeningPath
        ? `${SITE_URL}/chess-openings/vienna-game`
        : isUnknownOpeningPath
          ? `${SITE_URL}/openings`
          : shouldNoindex
            ? `${SITE_URL}/`
            : seoData.url;

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
      content: chessOpeningSeoPage || openingSeoPage || guideSeoPage ? "article" : "website",
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

    const jsonLd = chessOpeningSeoPage
      ? getChessOpeningPageJsonLd(chessOpeningSeoPage, seoData.url)
      : openingSeoPage
        ? getOpeningPageJsonLd(openingSeoPage, seoData.url)
        : getSeoJsonLd(seoData);
    if (jsonLd && !shouldNoindex) {
      const script = document.createElement("script");
      script.id = "seo-route-jsonld";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [canonicalUrl, chessOpeningSeoPage, currentPath, guideSeoPage, openingSeoPage, seoData, shouldNoindex]);

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
      const path = getCurrentPath();
      setData((current) => isSampleReportPath(path) ? SAMPLE_REPORT : isSampleReport(current) ? null : current);
      if (isSampleReportPath(path)) setShowPublicLanding(false);
      setActiveView(getInitialAppView());
    };

    window.addEventListener("popstate", syncViewFromPath);

    return () => {
      window.removeEventListener("popstate", syncViewFromPath);
    };
  }, []);

  const PublicAppTopNav = () => (
    <AppPrimaryNav
      mode="marketing"
      activeView={activeView}
      accountUser={accountUser}
      hasReport={Boolean(reportData)}
      onNavigate={handleAppNavigate}
      onExampleReport={loadDemoReport}
      onLogin={openLoginPage}
      theme={theme}
      onThemeToggle={() =>
        setTheme((current) => (current === "dark" ? "light" : "dark"))
      }
    />
  );

  if (isGuidesHub) {
    return <GuidesHubPage ThemeToggle={ThemeToggle} Analytics={Analytics} AppTopNav={PublicAppTopNav} />;
  }

  if (trustPageKey) return <PublicTrustPage page={trustPageKey} appTopNav={PublicAppTopNav} />;

  if (guideSeoPage) {
    return <SeoGuidePage page={guideSeoPage} ThemeToggle={ThemeToggle} Analytics={Analytics} AppTopNav={PublicAppTopNav} />;
  }

  if (isUnknownGuidePath) {
    return <GuideNotFoundPage ThemeToggle={ThemeToggle} Analytics={Analytics} AppTopNav={PublicAppTopNav} />;
  }

  if (chessOpeningSeoPage) {
    return <ChessOpeningSeoPage opening={chessOpeningSeoPage} ThemeToggle={ThemeToggle} Analytics={Analytics} AppTopNav={PublicAppTopNav} />;
  }

  if (isUnknownChessOpeningPath) {
    return <ChessOpeningNotFoundPage ThemeToggle={ThemeToggle} Analytics={Analytics} AppTopNav={PublicAppTopNav} />;
  }

  if (isOpeningHub) {
    return <OpeningHubPage ThemeToggle={ThemeToggle} Analytics={Analytics} AppTopNav={PublicAppTopNav} />;
  }

  if (openingSeoPage) {
    return <OpeningSeoPage opening={openingSeoPage} ThemeToggle={ThemeToggle} Analytics={Analytics} AppTopNav={PublicAppTopNav} />;
  }

  if (isUnknownOpeningPath) {
    return <OpeningNotFoundPage slug={openingSlug} ThemeToggle={ThemeToggle} Analytics={Analytics} AppTopNav={PublicAppTopNav} />;
  }

  if (seoPage) {
    return <SeoLandingPage page={seoData} ThemeToggle={ThemeToggle} Analytics={Analytics} AppTopNav={PublicAppTopNav} />;
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
          mode={resolvedAccountUser && !isPublicLanding && !isSampleReport(reportData) ? "app" : "marketing"}
          activeView={activeView}
          accountUser={resolvedAccountUser}
          hasReport={Boolean(reportData)}
          onNavigate={handleAppNavigate}
          onExampleReport={loadDemoReport}
          onLogin={openLoginPage}
          theme={theme}
          onThemeToggle={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
        />
        {!isSignedOutLoginPage ? <AccountSyncStatusBar
          user={supabaseUser || accountUser}
          isSupabaseConfigured={isSupabaseConfigured}
          authLoading={authLoading}
          profileLoading={profileLoading}
          profileLoaded={profileLoaded}
          authHydrated={authHydrated}
          restoreInProgress={restoreInProgress}
          hasPremiumAccess={isPremium}
          entitlement={entitlement}
          syncStatus={syncStatus || cloudSaveStatus}
          lastSavedAt={lastSavedAt}
          syncError={syncError || cloudSaveWarning}
          onAccount={syncStatus === "error" || cloudSaveStatus === "failed" ? retryAccountSync : openLoginPage}
          onCloudRestore={handleCloudRestore}
          onSignOut={handleAccountSignOut}
        /> : null}
        <AppActionRouter onViewChange={setActiveView} />
        {!isSampleReport(reportData) && !isSignedOutLoginPage ? <MobileBottomNav
          activeView={activeView}
          hasReport={Boolean(reportData)}
          onNavigate={handleAppNavigate}
        /> : null}

        {data ? (
          <>
            <OpeningFitImportDoctor username={username} />

          </>
        ) : null}

        <FounderPassLoginUpgrade accountUser={resolvedAccountUser} isPremium={isPremium} />

        <CheckoutStatusNotice
          onAnalytics={trackEvent}
          onRestoreAccess={async (checkoutSessionId) => {
            if (!supabaseUser?.id) {
              openLoginPage();
              return;
            }

            try {
              const synced = checkoutSessionId ? await syncPremiumCheckoutSession(supabaseUser, checkoutSessionId) : null;
              const refreshed = await refreshUserData?.(supabaseUser);
              return Boolean(synced?.hasPremiumAccess || refreshed?.hasPremiumAccess || hasPremiumAccess);
            } catch (error) {
              console.error("OpeningFit premium access refresh failed after checkout", error);
              return false;
            }
          }}
        />

        <AccountRestoreSync
          user={supabaseUser || accountUser}
          username={username}
          setUsername={setUsername}
          platform={platform}
          setPlatform={setPlatform}
          data={data}
          setData={setData}
          onRestoredReport={({ report, username: restoredUsername, platform: restoredPlatform, source }) => {
            setShowPublicLanding(false);
            setImportStatus({
              tone: "success",
              title: "Account restored",
              message: restoredUsername
                ? `Loaded your saved OpeningFit report for ${restoredUsername}.`
                : "Loaded your saved OpeningFit report.",
              meta: restoredPlatform || null,
            });
            void report;
            void source;
            const journey = restoredReportJourney();
            setActiveView(journey.view);
            if (getCurrentPath() !== journey.path) window.history.replaceState({}, "", journey.path);
          }}
        />

        {loading && data ? (
          <aside className="backgroundAnalysisNotice" role="status" aria-live="polite">
            <span className="backgroundAnalysisPulse" aria-hidden="true" />
            <div>
              <strong>Refreshing your report in the background</strong>
              <small>{loadingStep || `Analysing ${currentAnalysisPlatformLabel} games`}. You can keep browsing.</small>
            </div>
            <button type="button" onClick={cancelImport}>Cancel</button>
          </aside>
        ) : loading ? (
          <ImportLoadingOverlay
            platform={currentAnalysisPlatformLabel}
            username={username}
            mode="analysis"
            loadingStep={loadingStep}
            stage={importStage}
            elapsedSeconds={loadingElapsedSeconds}
            showWakeupMessage={loadingElapsedSeconds >= 15}
            onCancel={cancelImport}
          />
        ) : null}

        <main className="container appShell" id="app-dashboard">
          {activeAppSection === "analyse" ? (
          <>
          {showCoachDashboard ? (
            <>
            <WeeklyRecap
              data={data || reportData}
              fitData={fitData}
              reportHistory={effectiveReportHistory}
              active
              onTraining={() => handleAppNavigate("training")}
              onReport={() => handleAppNavigate("report")}
            />
            <CoachDashboard
              data={data || reportData}
              fitData={fitData}
              user={supabaseUser || accountUser}
              profile={supabaseProfile}
              settings={userSettings}
              reportHistory={effectiveReportHistory}
              openingFitUserState={openingFitUserState}
              activityHistory={activityHistory}
              onRecordActivity={recordCloudActivity}
              onSaveSettings={saveCloudSettings}
              onAnalyse={goToAnalyseImport}
              onPractice={startOpeningPractice}
              onReport={() => handleAppNavigate("report")}
              onTraining={() => handleAppNavigate("training")}
              onRecommendations={() => handleAppNavigate("repertoire")}
              onProgress={() => goToReturnUserProfileSection("openingfit-progress")}
              onJourney={() => handleAppNavigate("journey")}
              onScoreAction={(route) => handleAppNavigate(route)}
            />
            </>
          ) : null}

          {showAnalyseImportFlow ? (
          <>
          <ResumeTrainingPrompt data={reportData || data} onResume={startOpeningPractice} />

          <header className="hero heroCard compactImportHero analyseImportHero" aria-busy={loading}>
            <div className="heroTop">
              <div className="heroTitleWrap">
                <p className="eyebrow">Personalised opening report</p>
                <h1>Stop guessing which chess openings you should play.</h1>
                <p className="subtext">
                  OpeningFit analyses your real Chess.com or Lichess games and builds a practical repertoire around your strengths, weaknesses, and playing style.
                </p>
                <div className="landingHeroProof" aria-label="OpeningFit trust summary">
                  <span>No password required</span>
                  <span>First report free</span>
                  <span>Public game data only</span>
                </div>
              </div>
              <div className="analyseHeroVisual homepageSamplePreview" aria-label="Sample OpeningFit report preview">
                <div className="analyseHeroVisualTop">
                  <span>Sample report</span>
                  <strong>Three useful decisions</strong>
                </div>
                <div className="homepageSampleRows">
                  <div className="homepageSampleRow homepageSampleRow--keep">
                    <span>Best fit</span><strong>Caro-Kann Defence</strong>
                  </div>
                  <div className="homepageSampleRow homepageSampleRow--repair">
                    <span>Biggest issue</span><strong>Unclear plan against 1.d4</strong>
                  </div>
                  <div className="homepageSampleRow homepageSampleRow--action">
                    <span>Next action</span><strong>Train one reliable 1.d4 response</strong>
                  </div>
                </div>
                <small className="homepageSampleDisclaimer">Illustrative sample. Your report is built from your own games.</small>
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
                  <strong>Enter a public chess username</strong>
                </div>
                <small>We review available games before building the report.</small>
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
                    if (!username && e.target.value) void trackEvent("username_started", { platform, source: "analysis_form" });
                    setUsername(e.target.value);
                    if (error) setError("");
                    if (importStatus) setImportStatus(null);
                  }}
                  disabled={loading}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "username-help username-error" : "username-help"}
                  placeholder={
                    platforms[platform]?.usernamePlaceholder || "Chess username"
                  }
                />
                <small className="heroUsernameHelp" id="username-help">Check the platform and spelling, then start your report.</small>
                <div className="usernameTrustStrip" aria-label="Username import trust notes">
                  <span>No password required</span>
                  <span>First report free</span>
                  <span>Uses public game data</span>
                  <span>Processing varies with account history and service availability</span>
                </div>
              </label>

              <div className="appActionButtons">
                <button
                  className="primaryBtn"
                  type="button"
                  onClick={() => importGames()}
                  disabled={loading}
                >
                  {loading ? `Analysing ${platforms[platform]?.label || "games"}...` : "Get my opening report"}
                </button>
                <small className="primaryActionMicrocopy">
                  <ShieldCheck size={14} /> No account connection or PGN upload required.
                </small>
              </div>

              <details className="landingAdvancedOptions">
                <summary>Analysis settings</summary>
                <div className="landingAdvancedGrid">
                  <p className="analysisSettingsIntro">The default recent-game mix is recommended because rapid and blitz usually provide the clearest practical opening patterns. Change this only when you want a narrower review.</p>
                  <select
                    className="input monthSelect"
                    value={importMonths}
                    onChange={(e) => setImportMonths(Number(e.target.value))}
                    aria-label="Months to import"
                    disabled={loading}
                  >
                    <option value={1}>1 month</option>
                    <option value={3}>3 months</option>
                    <option value={6} disabled={gameHistoryMonths < 6}>
                      6 months {gameHistoryMonths >= 6 ? "" : "- Paid"}
                    </option>
                    <option value={12} disabled={gameHistoryMonths < 12}>
                      12 months {gameHistoryMonths >= 12 ? "" : "- Paid"}
                    </option>
                  </select>

                  <fieldset className="analysisTimeFormatSelector">
                    <legend>Change time controls</legend>
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
              <span>Your report shows what to keep, what to repair, and what to train next.</span>
              <button
                className="inlineSampleButton"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  loadDemoReport(SAMPLE_REPORT_CTA_SOURCES.importHero);
                }}
                disabled={loading}
              >
                Open full sample report
              </button>
            </div>

            {apiStatus === "offline" ? (
              <div className="statusMessage productStatus productStatusInfo">
                <Clock3 size={18} />
                <p><strong>Live import is taking a break</strong><span>You can still explore the complete sample report.</span></p>
                <button className="inlineSampleButton" type="button" onClick={loadDemoReport}>Open sample</button>
              </div>
            ) : null}

          </header>
          </>
          ) : null}
          {error ? (
            <div className="errorBox analyseErrorBox" role="alert" id="username-error">
              <span className="productFeedbackIcon" aria-hidden="true"><AlertTriangle size={19} /></span>
              <div>
                <strong>Analysis could not finish</strong>
                <p>{error}</p>
                <small>Check the username and platform, then try once more.</small>
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
          {showAnalyseImportFlow ? <SimplifiedHomepageStory onSampleReport={loadDemoReport} /> : null}
          {showAnalyseImportFlow ? (
          <div className="preAnalysisSupport">
            <ReturnUserDashboard
              user={supabaseUser || accountUser}
              data={reportData}
              fitData={fitData}
              reportHistory={effectiveReportHistory}
              openingFitUserState={openingFitUserState}
              onAnalyse={goToAnalyseImport}
              onViewRepertoire={goToReturnUserRepertoire}
              onImproveRecommendation={goToReturnUserWeaknesses}
              onStudyPlan={goToReturnUserStudyPlan}
              onProgress={() => goToReturnUserProfileSection("openingfit-progress")}
              onHistory={() => goToReturnUserProfileSection("recommendation-history")}
              onSettings={() => goToReturnUserProfileSection("profile-account")}
            />
            <OpeningFitRetentionSection
              data={reportData}
              fitData={fitData}
              reportHistory={effectiveReportHistory}
              openingFitUserState={openingFitUserState}
              onAnalyse={goToAnalyseImport}
              onTrain={startOpeningPractice}
              compact
            />
          </div>
          ) : null}
          </>
          ) : null}

          {activeAppSection === "report" && !reportData && !loading ? (
            <section className="card appEmptySection productEmptyState" id="app-results">
              <span className="productStateIcon"><ChartNoAxesCombined size={22} /></span>
              <div><p className="eyebrow">Your report</p><h2>Your opening profile starts with one import.</h2>
              <p>OpeningFit will turn recent games into opening verdicts, confidence labels, and one clear line to study.</p></div>
              <div className="productStatePreview" aria-label="Report contents">
                <span><CheckCircle2 size={15} /> Opening fit score</span>
                <span><CheckCircle2 size={15} /> Keep and improve verdicts</span>
                <span><CheckCircle2 size={15} /> Personal training action</span>
              </div>
              <div className="productStateAction"><button className="primaryBtn" type="button" onClick={() => handleAppNavigate("analyse")}>Analyse your games</button>
              <small>Uses public Chess.com or Lichess games.</small></div>
            </section>
          ) : null}

          {activeAppSection === "repertoire" && !loading ? (
            <MyRepertoire
              data={reportData}
              reportHistory={effectiveReportHistory}
              onAnalyse={() => handleAppNavigate("analyse")}
              onPractice={startOpeningPractice}
              onReport={() => handleAppNavigate("report")}
              onAccount={() => handleAppNavigate("account")}
              onTrainingHistory={() => handleAppNavigate("journey")}
              onUpgrade={() => handleAppNavigate("premium")}
            />
          ) : null}

          {activeAppSection === "journey" && !loading && canUseFeature(entitlement, OPENINGFIT_FEATURES.TRAINING_HISTORY) ? (
            <RetentionJourneyPage
              user={supabaseUser || accountUser}
              data={reportData}
              reportHistory={effectiveReportHistory}
              activityHistory={activityHistory}
              settings={userSettings}
              onRecordActivity={recordCloudActivity}
              onSaveSettings={saveCloudSettings}
              onNavigate={handleAppNavigate}
            />
          ) : activeAppSection === "journey" && !loading ? <FeatureAccessPreview feature={OPENINGFIT_FEATURES.TRAINING_HISTORY} title="See your training history" onUpgrade={() => handleAppNavigate("premium")} /> : null}

          {activeAppSection === "train" && !reportData && !loading ? (
            <>
              <ThisWeekTrainingExperience
                report={null}
                onPractice={startOpeningPractice}
                onAnalyse={() => handleAppNavigate("analyse")}
                onReport={() => handleAppNavigate("report")}
                onUpgrade={() => handleAppNavigate("premium")}
              />
              {canUseOwnGameDrills ? <div id="opening-practice">
                <OpeningPracticeLinesPanel
                  opening={practiceOpening || "Italian Game"}
                  user={supabaseUser || accountUser}
                  data={data || {}}
                  featured
                  showBrowser={false}
                  heading="Practice your recommended line"
                />
              </div> : null}
            </>
          ) : null}

          {activeAppSection === "premium" ? (
            <section className="premiumStandalonePage" id="premium">
              {reportData ? (
                <>
                  <PremiumPanel
                    data={reportData}
                    isPremium={isPremium}
                    entitlement={entitlement}
                    authenticated={Boolean(supabaseUser?.id)}
                    isPremiumPreview={isPremiumPreview}
                    onUnlockDemo={unlockPremiumDemo}
                    onResetDemo={resetPremiumDemo}
                    onFounderPass={handleFounderPassClick}
                    checkoutLoading={premiumCheckoutLoading}
                    checkoutError={premiumCheckoutError}
                  />

                </>
              ) : (
                <>
                  <PremiumPanel data={{}} isPremium={isPremium} entitlement={entitlement} authenticated={Boolean(supabaseUser?.id)} isPremiumPreview={false} onFounderPass={handleFounderPassClick} checkoutLoading={premiumCheckoutLoading} checkoutError={premiumCheckoutError} />
                </>
              )}
            </section>
          ) : null}

          {loading && activeAppSection !== "analyse" && (
            <section className="card loadingCard">
              <ChessLoadingMark />
              <div>
                <h3>Preparing your report</h3>
                <p>{loadingStep || "OpeningFit is checking your games and building the report. Large imports can take a little longer."}</p>
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
                  <span className="productFeedbackIcon" aria-hidden="true">
                    {importStatus.tone === "warning" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                  </span>
                  <div>
                    <strong>{importStatus.title}</strong>
                    <p>{importStatus.message}</p>
                    {importStatus.recoveryActions?.length ? (
                      <div className="importRecoveryActions" aria-label="Import recovery options">
                        {importStatus.recoveryActions.includes("retry") ? (
                          <button type="button" onClick={() => importGames()} disabled={loading}>Retry analysis</button>
                        ) : null}
                        {importStatus.recoveryActions.includes("expand_period") ? (
                          <button
                            type="button"
                            onClick={() => {
                              const nextMonths = importMonths < 3 ? 3 : importMonths < 6 ? 6 : 12;
                              setImportMonths(Math.min(nextMonths, gameHistoryMonths));
                              setImportStatus(null);
                            }}
                          >
                            Expand analysis period
                          </button>
                        ) : null}
                        {importStatus.recoveryActions.includes("switch_platform") ? (
                          <button type="button" onClick={() => selectImportPlatform(platform === "lichess" ? "chesscom" : "lichess")}>Switch platform</button>
                        ) : null}
                        {importStatus.recoveryActions.includes("sample") ? (
                          <button type="button" onClick={loadDemoReport}>Open sample report</button>
                        ) : null}
                        {importStatus.recoveryActions.includes("last_report") && data ? (
                          <button type="button" onClick={() => handleAppNavigate("report")}>View last successful report</button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {importStatus.meta ? <span>{importStatus.meta}</span> : null}
                </div>
              ) : null}

              {reportData && cloudSaveStatus && !cloudSaveWarning ? (
                <div className="cloudSaveStatusPill" role="status">
                  <span className="productFeedbackIcon" aria-hidden="true">
                    {cloudSaveStatus === "saving" ? <Clock3 size={18} /> : <CheckCircle2 size={18} />}
                  </span>
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

          {cloudSaveWarning ? (
            <div className="errorBox analyseErrorBox cloudSaveWarningBox" role="status">
              <span className="productFeedbackIcon" aria-hidden="true"><History size={19} /></span>
              <div>
                <strong>Cloud save needs attention</strong>
                <p>{cloudSaveWarning}</p>
                <small>Your report remains available on this device.</small>
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

          {reportData && ["report", "train"].includes(activeAppSection) && (
            <div
              id="app-results"
              className={activeAppSection === "train" ? "appResultsShell appResultsShellTrain" : "appResultsShell"}
              data-report-kind={isSampleReport(reportData) ? "sample" : "user"}
            >
              {activeAppSection === "report" ? (
                <>
                  {isSampleReport(reportData) ? (
                    <section className="sampleReportNotice" aria-label="Sample report — example data">
                      <div>
                        <strong>Sample report</strong>
                        <span>Example data for a fictional player. This is not your analysis and will not be saved to your history.</span>
                      </div>
                      <button type="button" className="primaryBtn" onClick={exitSampleReport}>Analyse my games</button>
                    </section>
                  ) : null}
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
                    reportHistory={effectiveReportHistory}
                    openingFitUserState={openingFitUserState}
                    retentionSnapshots={retentionSnapshots}
                    reportFilters={reportFilters}
                    onReportFiltersChange={setReportFilters}
                    onAnalytics={trackEvent}
                    authenticated={Boolean(supabaseUser?.id)}
                    comparisonLoading={Boolean(supabaseUser?.id && profileLoading)}
                    comparisonError={profileError && !cloudReportHistory?.length ? profileError : ""}
                    entitlement={entitlement}
                  />
                </>
              ) : null}

              {activeAppSection === "train" ? (
                <>
                  <ThisWeekTrainingExperience
                    report={reportData}
                    onPractice={startOpeningPractice}
                    onAnalyse={() => handleAppNavigate("analyse")}
                    onReport={() => handleAppNavigate("report")}
                    onUpgrade={() => handleAppNavigate("premium")}
                  />
                  {canUseOwnGameDrills ? <>
                  <ReportOpeningFilters filters={reportFilters} onFiltersChange={setReportFilters} data={reportData} />

                  <div id="opening-practice">
                    <TrainingSessionQueue data={reportData} selectedTarget={practiceOpening} onStart={startOpeningPractice} onReport={() => handleAppNavigate("report")} onAnalyse={() => handleAppNavigate("analyse")} />
                    <ContinueTrainingCard
                      data={reportData}
                      fitData={fitData}
                      onAnalyse={() => handleAppNavigate("analyse")}
                      onStartTraining={(recommendation) => startOpeningPractice(recommendation)}
                    />

                    <DailyMissionCard
                      data={reportData}
                      fitData={fitData}
                      onStartTraining={(recommendation) => {
                        startOpeningPractice(recommendation);
                      }}
                    />

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

                  <TodayTrainingCard
                    data={reportData}
                    fitData={fitData}
                    onAnalyse={() => handleAppNavigate("analyse")}
                    onStartTraining={(recommendation) => startOpeningPractice(recommendation?.trainingTarget || recommendation?.opening)}
                  />

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

                </Section>
              </div>
              </div>
                  </> : null}
                </>
              ) : null}

              {activeAppSection === "train" && canUseOwnGameDrills ? (
                <>
                  <div id="game-replay">
                  <div id="section-replay">
                <Section
                  title="Game Replay"
                  isOpen={openSections.replay}
                  onToggle={() => toggleSection("replay")}
                  badge={replayOpeningFilter || (selectedGame ? selectedGame.opening : null)}
                >
                  <div className="analysisGrid boardSection">
                    <div className="movesPanel">
                      <h3>{replayOpeningFilter ? `${replayOpeningFilter} games` : "Recent Games"}</h3>
                      {replayOpeningFilter ? (
                        <button
                          type="button"
                          className="secondaryButton"
                          onClick={() => {
                            setReplayOpeningFilter("");
                            setSelectedGameIndex(0);
                          }}
                        >
                          Show all recent games
                        </button>
                      ) : null}

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

            </div>
          )}

          {activeAppSection === "profile" && activeView !== "feedback" ? (
            <section className="profileSection" id="profile">
              {resolvedAccountUser?.id && loginAccountState === "authenticated" ? <ResumeTrainingPrompt data={reportData || data} onResume={startOpeningPractice} /> : null}
              <OpeningFitProfileDashboard
                data={reportData}
                fitData={fitData}
                accountUser={resolvedAccountUser}
                username={username}
                platform={platform}
                isPremium={isPremium}
                isPremiumPreview={isPremiumPreview}
                entitlement={entitlement}
                onAnalyse={() => handleAppNavigate("analyse")}
                onOpenReport={() => handleAppNavigate("report")}
                onPractice={startOpeningPractice}
                onReviewSession={(route) => handleAppNavigate(route || "weakspots")}
                onSeeSessionPlan={() => handleAppNavigate("training")}
                onLoadReport={(report) => {
                  setData(report);
                  handleAppNavigate("report");
                }}
                onFounderPass={handleFounderPassClick}
                onUserChange={setAccountUser}
                reportHistory={effectiveReportHistory}
                openingFitUserState={openingFitUserState}
                retentionSnapshots={retentionSnapshots}
                recommendationHistory={recommendationHistory}
                authLoading={authLoading}
                profileLoading={profileLoading}
                authHydrated={authHydrated}
                profileError={profileError}
                restoreError={restoreError}
                onCloudRestore={handleCloudRestore}
                theme={theme}
                onThemeToggle={() =>
                  setTheme((current) => (current === "dark" ? "light" : "dark"))
                }
                onTrainingPreferences={() => window.dispatchEvent(new Event(TRAINING_PREFERENCES_EDIT_EVENT))}
                activeView={activeView}
                onAnalytics={trackEvent}
              />
            </section>
          ) : null}

          {activeView === "feedback" ? (
            <section className="card feedbackCard" id="feedback">
            <h2>Help improve Opening Fit</h2>
            <p>
              Found a bug, confusing result, or feature idea? Send quick feedback to the OpeningFit team.
            </p>

            <label className="feedbackField">
              <span>Feedback type</span>
              <select value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)}>{FEEDBACK_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
            </label>

            <label className="feedbackField">
              <span>Feedback</span>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="What should be improved?"
              rows={4}
            />
            </label>

            <label className="feedbackField">
              <span>Contact, optional</span>
            <input
              value={feedbackContact}
              onChange={(e) => setFeedbackContact(e.target.value)}
              placeholder="Email optional"
            />
            </label>

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
            <div className="feedbackSupportLinks" aria-label="Direct support paths"><a href={`mailto:${SUPPORT_EMAIL}?subject=Broken%20game%20import`}>Import failure</a><a href={`mailto:${SUPPORT_EMAIL}?subject=Missing%20premium%20access`}>Payment access</a><a href={`mailto:${SUPPORT_EMAIL}?subject=Incorrect%20recommendation`}>Recommendation issue</a><a href="/privacy">Data question</a><a href="/account">Account deletion</a></div>
            </section>
          ) : null}

          {isSignedOutLoginPage ? null : isPublicLanding ? (
            <PublicHomepageFooter onAccount={openLoginPage} />
          ) : (
            <AppStoreReadinessFooter onAccount={openLoginPage} />
          )}
        </main>
        <PostReportOnboarding />
      </div>

    </>
  );
}
