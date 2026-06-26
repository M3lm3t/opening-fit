import InfoHint from "./InfoHint";

function text(value) {
  return String(value || "").trim();
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  if (!Number.isFinite(number)) return fallback;
  return number <= 1 && number >= 0 ? Math.round(number * 100) : Math.round(number);
}

function openingName(opening = {}) {
  if (typeof opening === "string") return opening;
  return opening.name || opening.opening || opening.openingName || opening.opening_name || "this opening";
}

function gamesFor(opening = {}, fallback = null) {
  return numberValue(opening.games ?? opening.games_played ?? opening.gamesPlayed ?? opening.count ?? opening.total, fallback);
}

function scoreFor(opening = {}, fallback = null) {
  return numberValue(
    opening.fitScore ??
      opening.fit_score ??
      opening.openingFitScore ??
      opening.opening_fit_score ??
      opening.score ??
      opening.winRate ??
      opening.win_rate ??
      opening.percentage,
    fallback
  );
}

function winRateFor(opening = {}) {
  return numberValue(opening.winRate ?? opening.win_rate ?? opening.scoreRate ?? opening.score_rate ?? opening.score, null);
}

function lossRateFor(opening = {}) {
  const direct = numberValue(opening.lossRate ?? opening.loss_rate, null);
  if (direct !== null) return direct;
  const games = gamesFor(opening, 0);
  const losses = numberValue(opening.losses ?? opening.l, null);
  return games && losses !== null ? Math.round((losses / games) * 100) : null;
}

function bestNextStep(opening = {}, fallback = "") {
  return (
    text(opening.next_action) ||
    text(opening.nextAction) ||
    text(opening.recommendationReasonNextStep) ||
    text(opening.recommendation_reason_next_step) ||
    text(opening.suggestedTrainingAction) ||
    text(opening.suggested_training_action) ||
    text(opening.recommendedAction) ||
    text(opening.recommended_action) ||
    text(fallback) ||
    `Review one recent ${openingName(opening)} game and note the first position that felt unclear.`
  );
}

function styleFitText(opening = {}) {
  const breakdown = opening.fitScoreBreakdown || opening.fit_score_breakdown || {};
  const styleValue = numberValue(
    breakdown.styleFit ??
      breakdown.style_fit ??
      opening.styleFitScore ??
      opening.style_fit_score ??
      opening.traitFitScore ??
      opening.trait_fit_score,
    null
  );
  const reason = text(opening.styleFitReason || opening.style_fit_reason || opening.styleReason || opening.style_reason);
  if (styleValue === null && !reason) return "";
  return reason || `The report includes a style-fit signal for this opening (${styleValue}/100).`;
}

function strongestSignal(opening = {}, score = null) {
  const games = gamesFor(opening, 0);
  const winRate = winRateFor(opening);
  const plan = text(opening.planClarityStatus || opening.plan_clarity_status);
  const frequency = games >= 10 ? `${games} games gives this more weight than a one-off result.` : "";
  const result =
    winRate !== null
      ? `The clearest results signal is ${winRate}% over ${games || "the available"} game${games === 1 ? "" : "s"}.`
      : "";
  const clarity = plan ? `The report labels plan clarity as "${plan}".` : "";
  return result || clarity || frequency || (score !== null ? `The current score shown is ${score}/100.` : "The report has limited score detail for this card.");
}

function holdingBack(opening = {}) {
  const games = gamesFor(opening, 0);
  const lossRate = lossRateFor(opening);
  const earlyLoss = numberValue(opening.earlyLossRate ?? opening.early_loss_rate, null);
  const planScore = numberValue(opening.planClarityScore ?? opening.plan_clarity_score, null);
  const notes = [
    text(opening.lossTimingNote || opening.loss_timing_note),
    text(opening.moveOrderNote || opening.move_order_note),
    text(opening.planClarityNote || opening.plan_clarity_note),
    text(opening.fixabilityExplanation || opening.fixability_explanation),
    text(opening.reason || opening.short_reason || opening.shortReason),
  ].filter(Boolean);

  if (games > 0 && games < 5) return "The main limit is sample size. Treat this as a watch signal, not a firm verdict.";
  if (earlyLoss !== null && earlyLoss >= 35) return `Early losses are a drag on the score: ${earlyLoss}% of this sample ended badly early.`;
  if (lossRate !== null && lossRate >= 45) return `Loss rate is the main warning signal here (${lossRate}% in this sample).`;
  if (planScore !== null && planScore < 52) return `Plan clarity is holding it back (${planScore}/100), so the repeated setup may still be unstable.`;
  if (notes.length) return notes[0];
  return "No single cause is isolated in the report. Use the score as a prioritisation signal, not a precise diagnosis.";
}

function confidenceText(opening = {}) {
  const games = gamesFor(opening, 0);
  const direct = text(opening.confidence || opening.confidence_label || opening.confidenceLabel || opening.fitConfidence);
  if (games >= 10) return `${direct || "Useful confidence"}: ${games} games is enough to show a pattern, but still not proof of a cause.`;
  if (games >= 5) return `${direct || "Medium confidence"}: ${games} games is an early pattern. Confirm it after more games.`;
  if (games >= 1) return `${direct || "Limited confidence"}: ${games} game${games === 1 ? "" : "s"} is too small for a hard verdict.`;
  return "Not enough data: this card does not include a usable game count.";
}

export function buildOpeningScoreExplanation({ opening = {}, score, nextStep = "" } = {}) {
  const resolvedScore = scoreFor(opening, score ?? null);
  const games = gamesFor(opening, 0);
  const styleFit = styleFitText(opening);
  const breakdown = opening.fitScoreBreakdown || opening.fit_score_breakdown || {};
  const components = asArray(opening.fitReasonBullets || opening.fit_reason_bullets || opening.evidenceBullets || opening.evidence_bullets);
  const componentSummary = components.length
    ? components.slice(0, 2).join(" ")
    : text(breakdown.resultComponent || breakdown.result_component || breakdown.performance || "");

  return {
    title: `Why this score?`,
    basedOn:
      games > 0
        ? `This score is based on ${games} game${games === 1 ? "" : "s"} in the current report, plus any available result, repetition, and consistency signals saved with this opening.`
        : "This score is based on the limited report fields available for this card. There is not enough game-count data for a confident explanation.",
    strongest: strongestSignal(opening, resolvedScore),
    holdingBack: holdingBack(opening),
    confidence: confidenceText(opening),
    styleFit,
    componentSummary,
    nextStep: bestNextStep(opening, nextStep),
  };
}

export default function OpeningScoreInfo({ opening = {}, score, nextStep = "", label = "Why this score?", className = "" }) {
  const explanation = buildOpeningScoreExplanation({ opening, score, nextStep });
  const name = openingName(opening);

  return (
    <InfoHint label={`${label} for ${name}`} className={`openingScoreInfoHint ${className}`.trim()}>
      <span className="openingScoreInfoContent">
        <strong>{explanation.title}</strong>
        <span><b>This score is based on...</b> {explanation.basedOn}</span>
        {explanation.componentSummary ? <span><b>Score details found:</b> {explanation.componentSummary}</span> : null}
        <span><b>Your strongest signal...</b> {explanation.strongest}</span>
        <span><b>What is holding it back...</b> {explanation.holdingBack}</span>
        {explanation.styleFit ? <span><b>Style fit...</b> {explanation.styleFit}</span> : null}
        <span><b>Confidence in this score...</b> {explanation.confidence}</span>
        <small><b>Best next step...</b> {explanation.nextStep}</small>
      </span>
    </InfoHint>
  );
}
