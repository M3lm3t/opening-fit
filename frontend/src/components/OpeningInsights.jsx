import { useState } from "react";
import InfoHint from "./InfoHint";
import { OPENING_COPY, getOpeningRecommendationReason, sampleSizeCopy, weakLineIssueCopy } from "./openingCopy";
import { buildWeakestLineTrainingTargetFromLine } from "../services/weakestLineTraining";
import "./OpeningInsights.css";

const PATTERN_COPY = {
  delayed_castling: "You often delay castling in losses.",
  early_queen_move: "Your queen comes out early and can become a target.",
  repeated_piece_moves: "The same piece often moves twice before development is finished.",
  undeveloped_by_move_10: "Too many pieces are still undeveloped around move 10.",
  early_pawn_grabbing: "Early pawn grabs are costing time before your pieces are ready.",
  queen_trade_early: "Early queen trades are steering games into simplified positions.",
  opposite_side_castling: "Opposite-side castling is creating sharp attacking races.",
  short_loss: "Some losses end before your middlegame plan gets started.",
  long_game_conversion_issue: "Long games suggest conversion work after the opening.",
  opening_instability: "Repeated early losses point to unstable opening lines.",
};

const PHASE_COPY = {
  opening: "Your trouble appears in the first 10 moves.",
  transition: "Results drop after move 10 when the position leaves familiar theory.",
  middlegame: "You reach playable openings, then lose direction in the first middlegame plan.",
  endgame: "The opening is mostly holding; conversion is the bigger leak.",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstSentence(value, fallback) {
  const text = String(value || fallback || "").trim();
  if (!text) return "";
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

function shortTooltipText(values, fallback) {
  const sentences = values
    .flat()
    .filter(Boolean)
    .flatMap((value) => String(value).split(/\n+/))
    .map((value) => firstSentence(value, ""))
    .filter(Boolean);
  return [...new Set(sentences)].slice(0, 2).join(" ") || fallback || "";
}

function getName(item) {
  return item?.name || item?.opening || item?.line || "Opening";
}

function getMetrics(data) {
  return data?.openingFitMetrics || data?.opening_fit_metrics || {};
}

function getDiagnosis(data) {
  return data?.diagnosticSummary || data?.diagnostic_summary || {};
}

function getRecommendations(data) {
  return data?.basicOpeningRecommendations || data?.basic_opening_recommendations || {};
}

function getWeakLines(data) {
  const metrics = getMetrics(data);
  const diagnosis = getDiagnosis(data);
  const metricLines = asArray(metrics.weakLines || metrics.weak_lines);
  const diagnosticLines = asArray(diagnosis.weakVariations || diagnosis.weak_variations);

  if (metricLines.length) return metricLines;
  return diagnosticLines;
}

function getOpeningRows(data) {
  return asArray(getMetrics(data).openings).filter(Boolean);
}

function classification(item) {
  return String(item?.fitClassification || item?.fit_classification || "").toLowerCase();
}

function statusForOpening(item) {
  const value = classification(item);
  if (value === "strong_keep") return "Keep";
  if (value === "good_opening_bad_execution" || value === "needs_training_line") return "Train";
  if (value === "weak_fit") return "Side option";
  return "Review";
}

function fitScore(item) {
  return number(item?.fitScore ?? item?.fit_score ?? item?.score ?? item?.winRate ?? item?.win_rate ?? 0);
}

function confidence(item) {
  return titleCase(item?.confidence || item?.fitConfidence || item?.fit_confidence || "medium");
}

function gamesPlayed(item) {
  return number(item?.gamesPlayed ?? item?.games_played ?? item?.games);
}

function winRate(item) {
  return number(item?.winRate ?? item?.win_rate);
}

function lossRate(item) {
  return number(item?.lossRate ?? item?.loss_rate);
}

function watchOut(item) {
  const watch = asArray(item?.watchOut || item?.watch_out);
  if (watch.length) return watch[0];

  const risk = String(item?.riskLevel || item?.risk_level || "").toLowerCase();
  if (risk === "high") return "Keep the first version narrow so the theory load does not sprawl.";
  return "Review the first position where your plan becomes unclear.";
}

function whyItFits(item) {
  return (
    item?.reason ||
    item?.whyItFits ||
    item?.why_it_fits ||
    "This matches the current style read and gives you a practical next study target."
  );
}

function openingReason(item) {
  const evidence = asArray(item?.evidence || item?.fitEvidence || item?.fit_evidence);
  return firstSentence(
    item?.shortReason ||
      item?.short_reason ||
      evidence[0] ||
      item?.reason ||
      item?.fitConfidenceReason ||
      item?.fit_confidence_reason ||
      item?.fitExplanation ||
      item?.fit_explanation,
    "Use this as a practical signal from your current game sample."
  );
}

function recommendationTooltip(item) {
  const score = fitScore(item) || "unknown";
  const sample = sampleSizeCopy(gamesPlayed(item));
  const risk = watchOut(item);
  return `Why this card matters: the fit score is ${score}, based on this report's results and opening pattern. ${sample} Use it to choose the next study target, then check this risk before adding theory: ${risk}`;
}

function openingDetailsTooltip(opening, details) {
  const status = statusForOpening(opening);
  const sample = sampleSizeCopy(gamesPlayed(opening));
  const nextStep =
    status === "Keep"
      ? "Keep it in the repertoire, but still review the common reply that causes the most discomfort."
      : status === "Train"
        ? "Train the repeated branch first; the opening may be usable if execution improves."
        : status === "Side option"
          ? "Do not expand this line until the repeated problem position is understood."
          : "Treat this as a review item, not a final verdict.";
  return `${details || "OpeningFit found a repeatable signal in this opening."} ${sample} ${nextStep}`;
}

function winRateTooltip(opening) {
  const games = gamesPlayed(opening);
  const rate = winRate(opening);
  return `Win rate is ${rate}% across ${games || "no confirmed"} analysed game${games === 1 ? "" : "s"}. Use it only with the sample size: a high score from a tiny sample is weaker than a modest score from many repeated games.`;
}

function confidenceTooltip(opening) {
  const label = confidence(opening);
  const games = gamesPlayed(opening);
  return `${label} confidence means OpeningFit ${games >= 10 ? "has enough repeated games to treat this as a useful pattern" : "is still working from a small sample"}. Use high confidence for repertoire decisions; use low confidence as a watchlist item.`;
}

function RecommendationCard({ title, item, tone, data, alternatives = [] }) {
  if (!item) return null;
  const priorityReason =
    tone === "delay"
      ? getOpeningRecommendationReason(item, item, data?.styleProfile || data?.style_profile || data || {}, {
          averageOpeningScore: data?.averageOpeningScore || data?.average_opening_score,
          alternatives,
          activeOpenings: alternatives,
        })
      : null;

  return (
    <article className={`openingInsightRecommendation ${tone}`}>
      <div className="openingInsightCardTitle">
        <span>{title}</span>
        <InfoHint label={`Why ${title.toLowerCase()} was suggested`}>{recommendationTooltip(item)}</InfoHint>
      </div>
      <h3>{getName(item)}</h3>
      {priorityReason ? (
        <>
          <strong className="openingInsightPriorityLabel">{priorityReason.label}</strong>
          <p>{priorityReason.reason}</p>
          <small>{priorityReason.action}</small>
        </>
      ) : (
        <p>{firstSentence(whyItFits(item), "This is the clearest next repertoire choice from the current sample.")}</p>
      )}
    </article>
  );
}

function WeakLineCard({ line, onPractice }) {
  const name = line.line || line.name || line.opening || "Weak line";
  const opening = line.opening || name.split(":")[0];
  const likelyIssue =
    asArray(line.commonPatterns || line.common_patterns)[0] ||
    line.fitClassification ||
    line.fit_classification ||
    "needs_training_line";
  const canTrain = typeof onPractice === "function";
  const training = buildWeakestLineTrainingTargetFromLine(line);

  return (
    <article className="openingInsightWeakLine">
      <div>
        <div className="openingInsightCardTitle">
          <span>Weak line</span>
          <InfoHint label="Why this weak line matters">
            {OPENING_COPY.weakLine}
          </InfoHint>
        </div>
        <h3>{name}</h3>
      </div>
      <div className="openingInsightMeta">
        <b>{gamesPlayed(line)} games</b>
        <b>{winRate(line)}% win</b>
        <b>{lossRate(line)}% loss</b>
      </div>
      <p>{PATTERN_COPY[likelyIssue] || weakLineIssueCopy(likelyIssue, gamesPlayed(line))}</p>
      <button type="button" onClick={() => canTrain && onPractice(training.target || opening)}>
        {canTrain ? "Train This Line" : "Review this line"}
      </button>
    </article>
  );
}

function CompactOpeningCard({ opening }) {
  const status = statusForOpening(opening);
  const details = shortTooltipText(
    [
      opening?.fitExplanation || opening?.fit_explanation,
      opening?.fitConfidenceReason || opening?.fit_confidence_reason,
      asArray(opening?.evidence || opening?.fitEvidence || opening?.fit_evidence),
    ]
  );

  return (
    <article className={`openingInsightMiniCard status-${status.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="openingInsightCardTitle">
        <span>{status}</span>
        {details ? (
          <InfoHint label={`How to use the ${getName(opening)} signal`}>{openingDetailsTooltip(opening, details)}</InfoHint>
        ) : null}
      </div>
      <h4>{getName(opening)}</h4>
      <div className="openingInsightMeta">
        <b>
          {winRate(opening)}% win
          <InfoHint label={`How reliable the ${getName(opening)} win rate is`}>
            {winRateTooltip(opening)}
          </InfoHint>
        </b>
        <b>{gamesPlayed(opening)} games</b>
        <b>
          Confidence: {confidence(opening)}
          <InfoHint label={`How much weight to give ${getName(opening)}`}>
            {confidenceTooltip(opening)}
          </InfoHint>
        </b>
      </div>
      <p>{openingReason(opening)}</p>
    </article>
  );
}

function recommendationItems(recommendations) {
  const delayItems = asArray(recommendations.delayOrAvoid || recommendations.delay_or_avoid);
  const keep = recommendations.safeWhite || recommendations.safe_white;
  const tryNext =
    recommendations.ambitiousWhite ||
    recommendations.ambitious_white ||
    recommendations.blackVsE4 ||
    recommendations.black_vs_e4 ||
    recommendations.blackVsD4 ||
    recommendations.black_vs_d4;

  return [
    { key: "try", title: "Try next", item: tryNext, tone: "try" },
    { key: "keep", title: "Keep improving", item: keep, tone: "keep" },
    { key: "delay", title: "Delay for now", item: delayItems[0], tone: "delay" },
  ].filter((entry) => entry.item);
}

export default function OpeningInsights({ data, onPractice }) {
  const [showAllWeakLines, setShowAllWeakLines] = useState(false);
  if (!data) return null;

  const diagnosis = getDiagnosis(data);
  const metrics = getMetrics(data);
  const recommendations = getRecommendations(data);
  const mainPhase = diagnosis.mainIssuePhase || diagnosis.main_issue_phase;
  const confidenceLevel = diagnosis.confidence;
  const coachNotes = asArray(diagnosis.coachNotes || diagnosis.coach_notes);
  const commonPatterns = asArray(diagnosis.commonPatterns || diagnosis.common_patterns);
  const openingRows = getOpeningRows(data);
  const keepOpenings = openingRows.filter((item) => ["strong_keep", "promising_small_sample"].includes(classification(item)));
  const weakLines = getWeakLines(data);
  const visibleWeakLines = showAllWeakLines ? weakLines : weakLines.slice(0, 3);
  const recItems = recommendationItems(recommendations);
  const recommendationAlternatives = recItems
    .filter((entry) => entry.tone !== "delay")
    .map((entry) => entry.item);
  const bestOpening = keepOpenings[0] || openingRows[0] || null;
  const weakestLine = weakLines[0] || null;
  const mainDiagnosis = mainPhase ? PHASE_COPY[mainPhase] : coachNotes[0] || "Not enough evidence for a strong diagnosis yet.";
  const nextAction = weakestLine
    ? `Review ${weakestLine.line || weakestLine.name || weakestLine.opening}.`
    : recItems[0]
      ? `Try ${getName(recItems[0].item)} next.`
      : bestOpening
        ? `Keep improving ${getName(bestOpening)}.`
        : "Import a few more recent games for a cleaner recommendation.";

  const hasContent =
    mainPhase ||
    openingRows.length ||
    weakLines.length ||
    commonPatterns.length ||
    recItems.length ||
    asArray(metrics.openings).length;

  if (!hasContent) {
    return (
      <section className="openingInsights" id="opening-insights" aria-labelledby="opening-insights-title">
        <div className="openingInsightsHero">
          <div>
            <p className="eyebrow">30-second report</p>
            <h2 id="opening-insights-title">Your OpeningFit summary</h2>
            <p>Import a few more recent games and OpeningFit will turn them into a focused opening plan.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="openingInsights" id="opening-insights" aria-labelledby="opening-insights-title">
      <div className="openingInsightsHero">
        <div>
          <p className="eyebrow">30-second report</p>
          <h2 id="opening-insights-title">Your OpeningFit summary</h2>
          <p>{firstSentence(coachNotes[0], mainDiagnosis)}</p>
        </div>
        <div className="openingInsightPhase">
          <span>Main diagnosis</span>
          <strong>{mainPhase ? titleCase(mainPhase) : "Low sample"}</strong>
          {confidenceLevel ? <small>{titleCase(confidenceLevel)} confidence</small> : null}
        </div>
      </div>

      <div className="openingInsightSummaryGrid">
        <article>
          <span>Best opening to keep</span>
          <strong>{bestOpening ? getName(bestOpening) : "More games needed"}</strong>
        </article>
        <article>
          <span>Weakest line to train</span>
          <strong>{weakestLine ? weakestLine.line || weakestLine.name || weakestLine.opening : "No repeated weak line yet"}</strong>
        </article>
        <article>
          <span>Main diagnosis</span>
          <strong>{mainDiagnosis}</strong>
        </article>
        <article>
          <span>Next action</span>
          <strong>{nextAction}</strong>
        </article>
      </div>

      {openingRows.length ? (
        <div className="openingInsightBlock">
          <div className="openingInsightBlockHeader">
            <span>Opening cards</span>
            <h3>Compact verdicts from your sample.</h3>
          </div>
          <div className="openingInsightGrid">
            {openingRows.slice(0, 6).map((opening, index) => (
              <CompactOpeningCard key={`${getName(opening)}-${classification(opening)}-${index}`} opening={opening} />
            ))}
          </div>
        </div>
      ) : (
        <p className="openingInsightQuietNote">Opening cards will appear once there is enough recent game evidence.</p>
      )}

      {weakLines.length ? (
        <div className="openingInsightBlock">
          <div className="openingInsightBlockHeader">
            <span>Weak lines to train</span>
            <h3>Prioritise the variation, not just the opening name.</h3>
          </div>
          <div className="openingInsightGrid">
            {visibleWeakLines.map((line) => (
              <WeakLineCard key={line.line || line.name || line.opening} line={line} onPractice={onPractice} />
            ))}
          </div>
          {weakLines.length > 3 ? (
            <button type="button" className="openingInsightShowMore" onClick={() => setShowAllWeakLines((value) => !value)}>
              {showAllWeakLines ? "Show less" : `Show ${weakLines.length - 3} more`}
            </button>
          ) : null}
        </div>
      ) : null}

      {commonPatterns.length ? (
        <div className="openingInsightBlock">
          <div className="openingInsightBlockHeader">
            <span>Common patterns</span>
            <h3>Recurring habits.</h3>
          </div>
          <div className="openingInsightTags">
            {commonPatterns.slice(0, 3).map((pattern) => {
              const type = pattern.type || pattern;
              return <span key={type}>{PATTERN_COPY[type] || pattern.example || titleCase(type)}</span>;
            })}
          </div>
        </div>
      ) : null}

      {recItems.length ? (
        <div className="openingInsightBlock">
          <div className="openingInsightBlockHeader">
            <span>Recommendations</span>
            <h3>Simple next repertoire decisions.</h3>
          </div>
          <div className="openingInsightRecommendationGrid">
            {recItems.map((entry) => (
              <RecommendationCard
                key={`${entry.key}-${getName(entry.item)}`}
                title={entry.title}
                tone={entry.tone}
                item={entry.item}
                data={data}
                alternatives={recommendationAlternatives}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
