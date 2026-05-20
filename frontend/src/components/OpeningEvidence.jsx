export const CONFIDENCE_THRESHOLDS = {
  strongGames: 10,
  mediumGames: 5,
};

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

function sideFromText(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("unknown") || text.includes("mixed")) return "Mixed signal";
  if (text.includes("white")) return "White";
  if (text.includes("black")) return "Black";
  return "";
}

export function getEvidenceSide(opening) {
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

export function getOpeningConfidence(opening) {
  const explicit = textField(opening, [
    "confidenceLabel",
    "confidence_label",
    "confidence",
    "sampleConfidence",
    "sample_confidence",
  ]);

  if (explicit) {
    const lower = explicit.toLowerCase();
    if (lower.includes("strong") || lower.includes("high")) return "Strong";
    if (lower.includes("medium")) return "Medium";
    if (lower.includes("low") || lower.includes("little") || lower.includes("thin")) return "Low sample";
    return explicit;
  }

  const games = getEvidenceGames(opening);
  if (games >= CONFIDENCE_THRESHOLDS.strongGames) return "Strong";
  if (games >= CONFIDENCE_THRESHOLDS.mediumGames) return "Medium";
  if (games <= 0) return "No reliable data";
  return "Low sample";
}

export function getOpeningSignal(opening) {
  const games = getEvidenceGames(opening);
  const score = getEvidenceScore(opening);
  const confidence = getOpeningConfidence(opening);

  if (!games || score === null) {
    return {
      tier: "none",
      label: "No reliable data",
      badge: "No reliable data",
      canBePrimary: false,
      canBeFirm: false,
      explanation: "No reliable game sample is available yet.",
    };
  }

  if (games >= CONFIDENCE_THRESHOLDS.strongGames) {
    return {
      tier: "strong",
      label: "Strong signal",
      badge: "Strong",
      canBePrimary: true,
      canBeFirm: true,
      explanation: "Reliable signal from your recent games.",
    };
  }

  if (games >= CONFIDENCE_THRESHOLDS.mediumGames) {
    return {
      tier: "medium",
      label: "Medium signal",
      badge: "Medium",
      canBePrimary: true,
      canBeFirm: false,
      explanation: "Useful signal, but still worth confirming with more games.",
    };
  }

  return {
    tier: "low",
    label: confidence || "Low sample",
    badge: "Low sample",
    canBePrimary: false,
    canBeFirm: false,
    explanation: "Too few games to make a firm call. Treat this as a trend to watch, not a recommendation.",
  };
}

function confidenceIsLow(opening) {
  const signal = getOpeningSignal(opening);
  return signal.tier === "low" || signal.tier === "none";
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

export function getEvidenceReason(opening, data) {
  const games = getEvidenceGames(opening);
  const explicit = textField(opening, [
    "verdictReason",
    "verdict_reason",
    "fitExplanation",
    "fit_explanation",
    "reason",
    "recommendationCopy",
    "summary",
  ]);

  if (games < CONFIDENCE_THRESHOLDS.mediumGames) {
    const cautious = explicit.toLowerCase();
    if (
      cautious.includes("not enough") ||
      cautious.includes("too small") ||
      cautious.includes("missing") ||
      cautious.includes("unclear") ||
      cautious.includes("low")
    ) {
      return explicit;
    }

    return games
      ? "Too few games to make a firm call. Treat this as a trend to watch, not a recommendation."
      : "No reliable game sample is available yet.";
  }

  if (explicit) return explicit;

  const score = getEvidenceScore(opening);
  const verdict = verdictText(opening).toLowerCase();

  if (score === null) return "The report has a sample, but no score for this opening yet.";
  if (verdict.includes("keep") || verdict.includes("reliable") || score >= 58) {
    return "The score is strong enough to keep this in the current plan.";
  }
  if (verdict.includes("avoid") || verdict.includes("review") || score < 42) {
    return "The score is low enough to inspect the repeated positions before trusting this line.";
  }

  return data ? "The result is usable, but not conclusive enough to make this a settled repertoire choice." : "The result is usable, but not conclusive.";
}

export function getEvidenceNextAction(opening, slot = "") {
  const name = getEvidenceOpeningName(opening);
  const score = getEvidenceScore(opening);
  const lowConfidence = confidenceIsLow(opening);
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

  if (explicit) return explicit;

  if (score !== null && score < 45) {
    return `Review your last 3 ${name} losses and mark the first repeated problem.`;
  }

  if (slot === "black_vs_e4") return `Save one clear plan for ${name} against 1.e4.`;
  if (slot === "black_vs_d4_other") return `Check the first 8 moves of your ${name} games against queen-pawn or flank setups.`;
  if (slot === "white_repertoire") return `Write one move-10 plan for ${name} and test it in your next White games.`;

  return `Keep ${name} in the study queue and review the next recurring branch.`;
}

export function getOpeningEvidence(opening, data, options = {}) {
  const games = getEvidenceGames(opening);
  const score = getEvidenceScore(opening);
  const signal = getOpeningSignal(opening);
  const baseline = baselineComparison(opening, data);
  const chips = [
    getEvidenceSide(opening),
    games ? `${games} game${games === 1 ? "" : "s"}` : "Game count unavailable",
    score !== null ? `${score}% score` : "Score unavailable",
    baseline,
    `Confidence: ${signal.badge}`,
  ].filter(Boolean);

  return {
    chips: [...new Set(chips)],
    reason: getEvidenceReason(opening, data),
    nextAction: getEvidenceNextAction(opening, options.slot || options.sectionKey || ""),
    signal,
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

  return (
    <div className={`openingEvidenceBlock ${compact ? "openingEvidenceBlockCompact" : ""}`}>
      <div className="openingEvidenceChips" aria-label="Opening evidence">
        {evidence.chips.map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
      </div>

      {compact ? null : (
        <p className="openingEvidenceHelp">
          Confidence is based mainly on game count and signal clarity.
        </p>
      )}

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
