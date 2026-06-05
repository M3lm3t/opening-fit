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
  opening: "Your trouble appears in the first 10 moves, so make the setup more repeatable before adding new ideas.",
  transition: "Your openings are mostly fine, but results drop after move 10 when the position leaves familiar theory.",
  middlegame: "You are reaching playable openings, then losing direction once the first plan has to become a middlegame plan.",
  endgame: "The opening is not the main leak here; your longer games need cleaner conversion and simplification choices.",
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

function getKeepOpenings(data) {
  const metrics = getMetrics(data);
  return asArray(metrics.openings)
    .filter((item) =>
      ["strong_keep", "promising_small_sample"].includes(
        String(item.fitClassification || item.fit_classification || "")
      )
    )
    .slice(0, 4);
}

function fitScore(item) {
  return number(item?.fitScore ?? item?.fit_score ?? item?.score ?? item?.winRate ?? item?.win_rate ?? 0);
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

function RecommendationCard({ title, item, tone }) {
  if (!item) return null;

  return (
    <article className={`openingInsightRecommendation ${tone}`}>
      <span>{title}</span>
      <h3>{getName(item)}</h3>
      <div className="openingInsightMeta">
        <b>Fit {fitScore(item)}</b>
        <b>{titleCase(item.confidence || "medium")} confidence</b>
        <b>{titleCase(item.learningCost || item.learning_cost || "medium")} learning</b>
      </div>
      <p>{whyItFits(item)}</p>
      <small>Watch out: {watchOut(item)}</small>
    </article>
  );
}

function WeakLineCard({ line, onPractice }) {
  const name = line.line || line.name || line.opening || "Weak line";
  const opening = line.opening || name.split(":")[0];
  const likelyIssue = asArray(line.commonPatterns || line.common_patterns)[0] || line.fitClassification || line.fit_classification || "needs_training_line";
  const canTrain = typeof onPractice === "function";

  return (
    <article className="openingInsightWeakLine">
      <div>
        <span>Weak line</span>
        <h3>{name}</h3>
      </div>
      <div className="openingInsightMeta">
        <b>{number(line.gamesPlayed ?? line.games_played ?? line.games)} games</b>
        <b>{number(line.winRate ?? line.win_rate)}% win</b>
        <b>{number(line.lossRate ?? line.loss_rate)}% loss</b>
      </div>
      <p>Likely issue: {PATTERN_COPY[likelyIssue] || titleCase(likelyIssue)}</p>
      <button type="button" onClick={() => canTrain && onPractice(opening)}>
        {canTrain ? "Train this line" : "Review this line"}
      </button>
    </article>
  );
}

export default function OpeningInsights({ data, onPractice }) {
  if (!data) return null;

  const diagnosis = getDiagnosis(data);
  const metrics = getMetrics(data);
  const recommendations = getRecommendations(data);
  const mainPhase = diagnosis.mainIssuePhase || diagnosis.main_issue_phase;
  const confidence = diagnosis.confidence;
  const coachNotes = asArray(diagnosis.coachNotes || diagnosis.coach_notes);
  const commonPatterns = asArray(diagnosis.commonPatterns || diagnosis.common_patterns);
  const keepOpenings = getKeepOpenings(data);
  const weakLines = getWeakLines(data);
  const hasRecommendations = Boolean(
    recommendations.safeWhite ||
      recommendations.safe_white ||
      recommendations.ambitiousWhite ||
      recommendations.ambitious_white ||
      recommendations.blackVsE4 ||
      recommendations.black_vs_e4 ||
      recommendations.blackVsD4 ||
      recommendations.black_vs_d4 ||
      asArray(recommendations.delayOrAvoid || recommendations.delay_or_avoid).length
  );

  const hasContent =
    mainPhase ||
    keepOpenings.length ||
    weakLines.length ||
    commonPatterns.length ||
    hasRecommendations ||
    asArray(metrics.openings).length;

  if (!hasContent) return null;

  return (
    <section className="openingInsights" id="opening-insights" aria-labelledby="opening-insights-title">
      {mainPhase ? (
        <div className="openingInsightsHero">
          <div>
            <p className="eyebrow">Opening diagnosis</p>
            <h2 id="opening-insights-title">{PHASE_COPY[mainPhase] || "OpeningFit found a trainable pattern in your games."}</h2>
            <p>{coachNotes[0] || "Treat this as a practical training clue, not a final verdict."}</p>
          </div>
          <div className="openingInsightPhase">
            <span>Main phase</span>
            <strong>{titleCase(mainPhase)}</strong>
            {confidence ? <small>{titleCase(confidence)} confidence</small> : null}
          </div>
        </div>
      ) : null}

      {keepOpenings.length ? (
        <div className="openingInsightBlock">
          <div className="openingInsightBlockHeader">
            <span>Best openings to keep</span>
            <h3>Keep improving what is already scoring.</h3>
          </div>
          <div className="openingInsightGrid">
            {keepOpenings.map((opening) => (
              <article className="openingInsightMiniCard" key={getName(opening)}>
                <h4>{getName(opening)}</h4>
                <p>{titleCase(opening.fitClassification || opening.fit_classification)}</p>
                <div className="openingInsightMeta">
                  <b>{number(opening.gamesPlayed ?? opening.games_played ?? opening.games)} games</b>
                  <b>{number(opening.winRate ?? opening.win_rate)}% win</b>
                  <b>{titleCase(opening.confidence)}</b>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {weakLines.length ? (
        <div className="openingInsightBlock">
          <div className="openingInsightBlockHeader">
            <span>Weak lines to train</span>
            <h3>Work on the repeated variation, not just the opening name.</h3>
          </div>
          <div className="openingInsightGrid">
            {weakLines.slice(0, 4).map((line) => (
              <WeakLineCard key={line.line || line.name || line.opening} line={line} onPractice={onPractice} />
            ))}
          </div>
        </div>
      ) : null}

      {commonPatterns.length ? (
        <div className="openingInsightBlock">
          <div className="openingInsightBlockHeader">
            <span>Common patterns</span>
            <h3>Recurring habits from the sample.</h3>
          </div>
          <div className="openingInsightTags">
            {commonPatterns.slice(0, 6).map((pattern) => {
              const type = pattern.type || pattern;
              return <span key={type}>{PATTERN_COPY[type] || pattern.example || titleCase(type)}</span>;
            })}
          </div>
        </div>
      ) : null}

      {hasRecommendations ? (
        <div className="openingInsightBlock">
          <div className="openingInsightBlockHeader">
            <span>Recommendations</span>
            <h3>Simple next repertoire decisions.</h3>
          </div>
          <div className="openingInsightRecommendationGrid">
            <RecommendationCard title="Keep improving" tone="keep" item={recommendations.safeWhite || recommendations.safe_white} />
            <RecommendationCard title="Try next" tone="try" item={recommendations.ambitiousWhite || recommendations.ambitious_white} />
            <RecommendationCard title="Black vs e4" tone="try" item={recommendations.blackVsE4 || recommendations.black_vs_e4} />
            <RecommendationCard title="Black vs d4" tone="try" item={recommendations.blackVsD4 || recommendations.black_vs_d4} />
            {asArray(recommendations.delayOrAvoid || recommendations.delay_or_avoid).slice(0, 2).map((item) => (
              <RecommendationCard key={getName(item)} title="Delay for now" tone="delay" item={item} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
