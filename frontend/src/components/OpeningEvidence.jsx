import InfoHint from "./InfoHint";
import {
  canGiveAvoidVerdict,
  getLevelToneCopy,
  getSmartPlayerLevelProfile,
  isAdvancedOrStrongerLevel,
} from "./playerLevelLogic";

export const CONFIDENCE_THRESHOLDS = {
  highGames: 25,
  mediumGames: 10,
  lowGames: 5,
};

function normaliseConfidenceLabel(value) {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();

  if (lower.includes("too little") || lower.includes("insufficient") || lower.includes("no reliable")) {
    return "Too little data";
  }
  if (lower.includes("high") || lower.includes("strong")) return "High confidence";
  if (lower.includes("medium")) return "Medium confidence";
  if (lower.includes("low") || lower.includes("thin")) return "Low confidence";
  return text;
}

const BLACK_OPENING_NAME_PATTERNS = [
  "defence",
  "defense",
  "sicilian",
  "french",
  "caro-kann",
  "scandinavian",
  "pirc",
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
  "queen's gambit declined",
  "queen's gambit accepted",
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

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

export function getEvidenceOpeningName(opening, fallback = "this opening") {
  if (typeof opening === "string") return opening;

  return (
    opening?.displayName ||
    opening?.name ||
    opening?.opening ||
    opening?.opening_name ||
    opening?.eco_name ||
    opening?.ecoName ||
    opening?.family ||
    opening?.label ||
    fallback
  );
}

export function getEvidenceGames(opening) {
  return numberValue(
    opening?.games ?? opening?.count ?? opening?.total ?? opening?.played ?? opening?.sample,
    0
  );
}

export function getEvidenceScore(opening) {
  const direct =
    opening?.winRate ??
    opening?.win_rate ??
    opening?.scoreRate ??
    opening?.score_rate ??
    opening?.score ??
    opening?.percentage ??
    opening?.performance;

  const parsed = numberValue(direct);
  if (parsed !== null) return Math.round(parsed <= 1 ? parsed * 100 : parsed);

  const games = getEvidenceGames(opening);
  if (!games) return null;

  const wins = numberValue(opening?.wins ?? opening?.won ?? opening?.w, 0);
  const draws = numberValue(opening?.draws ?? opening?.drawn ?? opening?.d, 0);
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function textField(opening, keys) {
  for (const key of keys) {
    const value = opening?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getSmartLevel(data) {
  return getSmartPlayerLevelProfile(data).level;
}

function isAdvancedPlayer(data) {
  return isAdvancedOrStrongerLevel(getSmartLevel(data));
}

function sideFromText(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("unknown") || text.includes("mixed")) return "Mixed signal";
  if (text.includes("white")) return "White";
  if (text.includes("black")) return "Black";
  return "";
}

export function getOpeningNameSideHint(opening) {
  const name = getEvidenceOpeningName(opening, "");
  const lower = String(name || "").toLowerCase();

  if (BLACK_OPENING_NAME_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return "black";
  }

  if (WHITE_OPENING_NAME_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return "white";
  }

  return "unknown";
}

export function getOpeningContext(opening) {
  const rawContext = String(
    opening?.context ||
      opening?.repertoireContext ||
      opening?.repertoire_context ||
      opening?.contextLabel ||
      opening?.context_label ||
      opening?.category ||
      ""
  ).toLowerCase();
  const rawSide = String(
    opening?.colour ||
      opening?.color ||
      opening?.side ||
      opening?.as ||
      opening?.player_color ||
      ""
  ).toLowerCase();
  const hint = getOpeningNameSideHint(opening);
  const looksFaced =
    rawContext.includes("faced") ||
    rawContext.includes("opponent") ||
    opening?.faced === true ||
    opening?.opponentOpening === true ||
    opening?.opponent_opening === true;
  const isWhiteContext =
    rawContext.includes("played_as_white") ||
    rawContext.includes("as white") ||
    rawContext.includes("played as white") ||
    rawSide.includes("white");
  const isBlackContext =
    rawContext.includes("black_vs") ||
    rawContext.includes("as black") ||
    rawContext.includes("played as black") ||
    rawSide.includes("black");

  if (looksFaced) {
    return {
      type: "faced",
      label: "You faced this",
      detail: "opponent opening",
      canRecommend: false,
      isRepertoire: false,
    };
  }

  if (isWhiteContext && hint === "black") {
    return {
      type: "faced",
      label: "You faced this",
      detail: "facing it as White",
      canRecommend: false,
      isRepertoire: false,
    };
  }

  if (isBlackContext && hint === "white") {
    return {
      type: "faced",
      label: "You faced this",
      detail: "facing it as Black",
      canRecommend: false,
      isRepertoire: false,
    };
  }

  if (isWhiteContext) {
    return {
      type: "white",
      label: "As White",
      detail: "played as White",
      canRecommend: true,
      isRepertoire: true,
    };
  }

  if (isBlackContext) {
    const isVsOther =
      rawContext.includes("black_vs_other") ||
      rawContext.includes("other first") ||
      rawContext.includes("1.c4") ||
      rawContext.includes("1.nf3") ||
      rawContext.includes("c4") ||
      rawContext.includes("nf3");
    const isVsD4 =
      rawContext.includes("black_vs_d4") ||
      rawContext.includes("vs 1.d4") ||
      rawContext.includes("vs d4");

    return {
      type: "black",
      label: "As Black",
      detail: isVsOther
        ? "played as Black vs other first moves"
        : isVsD4
          ? "played as Black vs 1.d4"
          : rawContext.includes("e4")
          ? "played as Black vs 1.e4"
          : "played as Black",
      canRecommend: true,
      isRepertoire: true,
    };
  }

  return {
    type: "mixed",
    label: "Mixed signal",
    detail: "side/context unclear",
    canRecommend: false,
    isRepertoire: false,
  };
}

export function getEvidenceSide(opening) {
  const context = getOpeningContext(opening);
  if (context.label) return context.label;

  const explicit = sideFromText(
    opening?.contextLabel ||
      opening?.context_label ||
      opening?.context ||
      opening?.colour ||
      opening?.color ||
      opening?.side ||
      opening?.as ||
      opening?.player_color
  );

  return explicit || "Side unclear";
}

export function getEvidenceColour(opening) {
  const context = getOpeningContext(opening);

  if (context.type === "white") return "White";
  if (context.type === "black") return "Black";
  if (context.type === "faced" && String(context.detail || "").toLowerCase().includes("white")) return "White";
  if (context.type === "faced" && String(context.detail || "").toLowerCase().includes("black")) return "Black";

  return "Both / unclear";
}

export function getConfidenceDetails(opening) {
  const games = getEvidenceGames(opening);
  const score = getEvidenceScore(opening);
  const context = getOpeningContext(opening);

  if (!context.canRecommend) {
    return {
      tier: "insufficient",
      label: "Too little data",
      badge: "Too little data",
      className: "insufficient",
      canBePrimary: false,
      canBeFirm: false,
      evidenceLine:
        context.type === "faced"
          ? "Insufficient data: this appears to be an opening you faced, not a clean repertoire choice from your side."
          : "Insufficient data: the side or context is unclear, so this is not a firm recommendation.",
      explanation:
        "The current data is not clear enough to treat this as a clean repertoire recommendation.",
    };
  }

  if (!games || score === null) {
    return {
      tier: "insufficient",
      label: "Too little data",
      badge: "Too little data",
      className: "insufficient",
      canBePrimary: false,
      canBeFirm: false,
      evidenceLine: "Insufficient data: game count or score is unavailable.",
      explanation: "No reliable game sample is available yet.",
    };
  }

  if (games >= CONFIDENCE_THRESHOLDS.highGames) {
    return {
      tier: "high",
      label: "High confidence",
      badge: "High confidence",
      className: "high",
      canBePrimary: true,
      canBeFirm: true,
      evidenceLine: `High confidence: ${games} games, ${score}% score, repeated enough to treat as a reliable pattern.`,
      explanation: "25+ games in this opening or family.",
    };
  }

  if (games >= CONFIDENCE_THRESHOLDS.mediumGames) {
    return {
      tier: "medium",
      label: "Medium confidence",
      badge: "Medium confidence",
      className: "medium",
      canBePrimary: true,
      canBeFirm: false,
      evidenceLine: `Medium confidence: ${games} games, ${score}% score. Useful signal, but not definitive yet.`,
      explanation: "10-24 games: useful signal, but still worth confirming.",
    };
  }

  if (games >= CONFIDENCE_THRESHOLDS.lowGames) {
    return {
      tier: "low",
      label: "Low confidence",
      badge: "Low confidence",
      className: "low",
      canBePrimary: false,
      canBeFirm: false,
      evidenceLine: `Low confidence: ${games} games, ${score}% score. Interesting early pattern, but not enough for a firm verdict.`,
      explanation: "5-9 games: early pattern only. Useful to watch, not strong enough for a firm verdict.",
    };
  }

  return {
    tier: "tooLittle",
    label: "Too little data",
    badge: "Too little data",
    className: "insufficient",
    canBePrimary: false,
    canBeFirm: false,
    evidenceLine: `Too little data: only ${games} game${games === 1 ? "" : "s"}. Not used for a repertoire verdict.`,
    explanation: "0-4 games. Not enough data for a full verdict.",
  };
}

export function getOpeningConfidence(opening) {
  const explicit = textField(opening, [
    "confidenceLabel",
    "confidence_label",
    "confidence",
    "sampleConfidence",
    "sample_confidence",
  ]);

  if (explicit) {
    return normaliseConfidenceLabel(explicit);
  }

  const games = getEvidenceGames(opening);
  const score = getEvidenceScore(opening);

  if (!games || score === null) return "Too little data";
  if (games >= CONFIDENCE_THRESHOLDS.highGames) return "High confidence";
  if (games >= CONFIDENCE_THRESHOLDS.mediumGames) return "Medium confidence";
  if (games >= CONFIDENCE_THRESHOLDS.lowGames) return "Low confidence";
  return "Too little data";
}

export function getOpeningSignal(opening) {
  const confidence = getConfidenceDetails(opening);
  const context = getOpeningContext(opening);

  if (context.type === "faced") {
    return {
      tier: "faced",
      label: "You faced this",
      badge: "Too little data",
      className: "insufficient",
      canBePrimary: false,
      canBeFirm: false,
      evidenceLine: confidence.evidenceLine,
      explanation:
        "This looks like an opening you faced from the opponent side, so it is not a clean repertoire recommendation.",
    };
  }

  if (!context.canRecommend) {
    return {
      tier: "mixed",
      label: "Mixed signal",
      badge: "Too little data",
      className: "insufficient",
      canBePrimary: false,
      canBeFirm: false,
      evidenceLine: confidence.evidenceLine,
      explanation:
        "This opening appears in your games, but the current data is not clear enough to treat it as a clean repertoire recommendation.",
    };
  }

  if (confidence.tier === "insufficient") {
    return {
      tier: "none",
      label: "No reliable data",
      badge: "Too little data",
      className: "insufficient",
      canBePrimary: false,
      canBeFirm: false,
      evidenceLine: confidence.evidenceLine,
      explanation: "No reliable game sample is available yet.",
    };
  }

  if (confidence.tier === "high") {
    return {
      tier: "strong",
      label: "Strong signal",
      badge: "High confidence",
      className: "high",
      canBePrimary: true,
      canBeFirm: true,
      evidenceLine: confidence.evidenceLine,
      explanation: confidence.explanation,
    };
  }

  if (confidence.tier === "medium") {
    return {
      tier: "medium",
      label: "Medium signal",
      badge: "Medium confidence",
      className: "medium",
      canBePrimary: true,
      canBeFirm: false,
      evidenceLine: confidence.evidenceLine,
      explanation: confidence.explanation,
    };
  }

  if (confidence.tier === "low") {
    return {
      tier: "low",
      label: "Low confidence",
      badge: "Low confidence",
      className: "low",
      canBePrimary: false,
      canBeFirm: false,
      evidenceLine: confidence.evidenceLine,
      explanation: confidence.explanation,
    };
  }

  return {
    tier: "tooLittle",
    label: "Too little data",
    badge: "Too little data",
    className: "insufficient",
    canBePrimary: false,
    canBeFirm: false,
    evidenceLine: confidence.evidenceLine,
    explanation: confidence.explanation,
  };
}

function confidenceIsLow(opening) {
  const signal = getOpeningSignal(opening);
  return signal.tier === "low" || signal.tier === "tooLittle" || signal.tier === "none";
}

function baselineComparison(opening, data) {
  const explicit = textField(opening, [
    "comparisonText",
    "comparison_text",
    "baselineComparison",
    "baseline_comparison",
  ]);

  if (explicit && !explicit.toLowerCase().includes("unavailable")) return explicit;

  const directDelta = numberValue(
    opening?.baselineDelta ??
      opening?.baseline_delta ??
      opening?.scoreDelta ??
      opening?.score_delta
  );

  if (directDelta !== null) {
    const rounded = Math.round(directDelta);
    if (rounded > 0) return `+${rounded}% vs your baseline`;
    if (rounded < 0) return `${rounded}% vs your baseline`;
    return "Matches your baseline";
  }

  const score = getEvidenceScore(opening);
  const baseline = numberValue(
    data?.averageOpeningScore ??
      data?.average_opening_score ??
      data?.average_score ??
      data?.baselineScore ??
      data?.baseline_score
  );

  if (score === null || baseline === null) return "";

  const cleanBaseline = baseline <= 1 ? baseline * 100 : baseline;
  const delta = Math.round(score - cleanBaseline);
  if (delta > 0) return `+${delta}% vs your imported baseline`;
  if (delta < 0) return `${delta}% vs your imported baseline`;
  return "Matches your imported baseline";
}

function verdictText(opening) {
  return textField(opening, [
    "fitVerdict",
    "fit_verdict",
    "verdict",
    "recommendation",
    "status",
  ]);
}

export function getEvidenceVerdict(opening, data) {
  const signal = getOpeningSignal(opening);
  const score = getEvidenceScore(opening);
  const games = getEvidenceGames(opening);
  const explicit = verdictText(opening).toLowerCase();
  const level = getSmartLevel(data);
  const avoidAllowed = signal.canBeFirm && canGiveAvoidVerdict({ level, games, score });

  if (!signal.canBePrimary) {
    return "Not enough data";
  }

  if ((!signal.canBeFirm || !avoidAllowed) && explicit.includes("avoid")) {
    return "Improve";
  }

  if (explicit.includes("keep") || explicit.includes("reliable") || explicit.includes("main")) {
    return "Keep";
  }

  if (explicit.includes("improve") || explicit.includes("review") || explicit.includes("repair")) {
    return "Improve";
  }

  if (avoidAllowed && explicit.includes("avoid")) {
    return "Improve";
  }

  if (score === null) return "Not enough data";
  if (score >= 58) return "Keep";
  if (score >= 42) return "Improve";

  if (avoidAllowed) return "Improve";
  return "Improve";
}

export function getEvidenceReason(opening, data) {
  const games = getEvidenceGames(opening);
  const context = getOpeningContext(opening);
  const explicit = textField(opening, [
    "confidenceReason",
    "confidence_reason",
    "verdictReason",
    "verdict_reason",
    "fitExplanation",
    "fit_explanation",
    "reason",
    "recommendationCopy",
    "summary",
  ]);

  if (!context.canRecommend) {
    return context.type === "faced"
      ? "This looks like an opening you faced from the opponent side, so Opening Fit is not treating it as something you should play."
      : "This opening appears in your games, but the current data is not clear enough to treat it as a clean repertoire recommendation.";
  }

  if (games < CONFIDENCE_THRESHOLDS.mediumGames) {
    const cautious = explicit.toLowerCase();
    if (
      cautious.includes("not enough") ||
      cautious.includes("too small") ||
      cautious.includes("missing") ||
      cautious.includes("unclear") ||
      cautious.includes("low") ||
      cautious.includes("judge") ||
      cautious.includes("only reached")
    ) {
      return explicit;
    }

    return games >= CONFIDENCE_THRESHOLDS.lowGames
      ? "Early pattern from 5-9 games. Treat it as a watch signal, not a full verdict."
      : games
        ? "Fewer than 5 games. Not enough data for a full verdict."
        : "No reliable game sample is available yet.";
  }

  if (explicit) return explicit;

  const score = getEvidenceScore(opening);
  const verdict = verdictText(opening).toLowerCase();
  const level = getSmartLevel(data);
  const advanced = isAdvancedOrStrongerLevel(level);

  if (advanced && score !== null && score < 45) {
    return getLevelToneCopy(level).reason;
  }

  if (score === null) return "The report has a sample, but no score for this opening yet.";
  if (verdict.includes("keep") || verdict.includes("reliable") || score >= 58) {
    return "The score is strong enough to keep this in the current plan.";
  }
  if (verdict.includes("avoid") || verdict.includes("review") || score < 42) {
    return "The score is low enough to inspect the repeated positions before trusting this line.";
  }

  return data ? "The result is usable, but not conclusive enough to make this a settled repertoire choice." : "The result is usable, but not conclusive.";
}

export function getEvidenceNextAction(opening, slot = "", data = null) {
  const name = getEvidenceOpeningName(opening);
  const score = getEvidenceScore(opening);
  const lowConfidence = confidenceIsLow(opening);
  const context = getOpeningContext(opening);
  const explicit = textField(opening, [
    "nextStudyAction",
    "next_study_action",
    "studyAction",
    "study_action",
    "nextAction",
    "next_action",
    "action",
    "plan",
  ]);

  if (!context.canRecommend) {
    return context.type === "faced"
      ? `Review how you handled ${name}; do not add it to your repertoire unless you also play it from your side.`
      : `Track ${name} until the side/context is clear enough for a repertoire decision.`;
  }

  if (lowConfidence) {
    const cautious = explicit.toLowerCase();
    if (
      cautious.includes("collect") ||
      cautious.includes("more games") ||
      cautious.includes("track") ||
      cautious.includes("watch") ||
      cautious.includes("re-import")
    ) {
      return explicit;
    }
    return `Collect 5 more games with ${name} before changing the repertoire.`;
  }

  if (explicit) {
    const lower = explicit.toLowerCase();
    if (
      isAdvancedPlayer(data) &&
      /learn the basics|stop playing|avoid this opening|drop this opening|switch openings/i.test(lower)
    ) {
      return getLevelToneCopy(getSmartLevel(data)).action;
    }
    return explicit;
  }

  if (score !== null && score < 45 && isAdvancedPlayer(data)) {
    return `${getLevelToneCopy(getSmartLevel(data)).action.replace(/\.$/, "")} in ${name}.`;
  }

  if (score !== null && score < 45) {
    return `Review your last 3 ${name} losses and mark the first repeated problem.`;
  }

  if (slot === "black_vs_e4") return `Save one clear plan for ${name} against 1.e4.`;
  if (slot === "black_vs_d4") return `Check the first 8 moves of your ${name} games against 1.d4.`;
  if (slot === "black_vs_other" || slot === "black_vs_d4_other") return `Check the first 8 moves of your ${name} games against flank and other first-move setups.`;
  if (slot === "white_repertoire") return `Write one move-10 plan for ${name} and test it in your next White games.`;
  if (context.type === "white") return `Write one move-10 plan for ${name} and test it in your next White games.`;
  if (context.type === "black") return `Save one clear Black plan for ${name} and review the first repeated branch.`;

  return `Keep ${name} in the study queue and review the next recurring branch.`;
}

export function getOpeningEvidence(opening, data, options = {}) {
  const games = getEvidenceGames(opening);
  const score = getEvidenceScore(opening);
  const signal = getOpeningSignal(opening);
  const baseline = baselineComparison(opening, data);
  const baseVerdict = getEvidenceVerdict(opening, data);
  const verdict =
    baseVerdict === "Not enough data"
      ? "Not enough data"
      : `${baseVerdict} — ${signal.badge}`;
  const chips = [
    `Colour: ${getEvidenceColour(opening)}`,
    `Verdict: ${verdict}`,
    games ? `${games} game${games === 1 ? "" : "s"}` : "Game count unavailable",
    score !== null ? `${score}% score` : "Score unavailable",
    baseline,
    signal.badge,
  ].filter(Boolean);

  return {
    chips: [...new Set(chips)],
    verdict,
    reason: getEvidenceReason(opening, data),
    nextAction: getEvidenceNextAction(opening, options.slot || options.sectionKey || "", data),
    why: signal.evidenceLine,
    signal,
    context: getOpeningContext(opening),
  };
}

export default function OpeningEvidenceBlock({
  opening,
  data,
  slot = "",
  compact = false,
  hideReason = false,
  hideNextAction = false,
}) {
  const evidence = getOpeningEvidence(opening || {}, data, { slot });
  const chipClassName = (chip) => {
    const lower = String(chip || "").toLowerCase();
    if (lower.includes("high confidence")) return "confidenceBadge confidenceBadgeHigh";
    if (lower.includes("medium confidence")) return "confidenceBadge confidenceBadgeMedium";
    if (lower.includes("low confidence")) return "confidenceBadge confidenceBadgeLow";
    if (lower.includes("insufficient") || lower.includes("too little")) return "confidenceBadge confidenceBadgeInsufficient";
    return "";
  };

  return (
    <div className={`openingEvidenceBlock ${compact ? "openingEvidenceBlockCompact" : ""}`}>
      <div className="openingEvidenceChips" aria-label="Opening evidence">
        {evidence.chips.map((chip) => (
          <span className={chipClassName(chip)} key={chip}>{chip}</span>
        ))}
      </div>

      {compact ? null : (
        <p className="openingEvidenceHelp">
          Confidence
          <InfoHint label="Confidence details">
            Confidence is based mainly on game count, score availability, repeated use, and signal clarity.
          </InfoHint>
        </p>
      )}

      <p>
        <strong>Why this?</strong> {evidence.why}
      </p>

      {!hideReason ? (
        <p>
          <strong>Reason:</strong> {evidence.reason}
        </p>
      ) : null}

      {!hideNextAction ? (
        <p>
          <strong>Next action:</strong> {evidence.nextAction.replace(/^Next action:\s*/i, "")}
        </p>
      ) : null}
    </div>
  );
}
