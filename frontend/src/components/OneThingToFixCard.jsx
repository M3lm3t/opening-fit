import { buildTrainingRecommendations } from "../services/trainingRecommendations";
import { buildWeakestLineTrainingTargetFromLine } from "../services/weakestLineTraining";
import { mergeWeakLines } from "../services/weakLineDetection";
import "./OneThingToFixCard.css";

function safeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function openingName(item = {}) {
  if (typeof item === "string") return item;
  return item.opening || item.name || item.openingName || item.opening_name || item.trainingTarget || "Opening";
}

function variationName(item = {}) {
  if (typeof item === "string") return "";
  return item.variation || item.line || item.lineName || item.line_name || item.moveLine || item.move_line || "";
}

function getRetentionMetrics(data = {}) {
  return data.retentionMetrics || data.retention_metrics || {};
}

function getOneThingToFix(data = {}) {
  const metrics = getRetentionMetrics(data);
  return data.oneThingToFix || data.one_thing_to_fix || metrics.oneThingToFix || metrics.one_thing_to_fix || null;
}

function getWeakestTracking(data = {}) {
  const metrics = getRetentionMetrics(data);
  return data.weakestLineTracking || data.weakest_line_tracking || metrics.weakestLineTracking || metrics.weakest_line_tracking || {};
}

function enoughSample(item) {
  const games = safeNumber(item?.games ?? item?.gamesPlayed ?? item?.games_played, null);
  return games === null || games >= 2;
}

function hasExactMoves(item = {}) {
  const target = item.trainingTarget || item.training_target || {};
  const moves =
    item.moves ||
    item.sanMoves ||
    item.san_moves ||
    item.uciMoves ||
    item.uci_moves ||
    target.moves ||
    target.sanMoves ||
    target.san_moves ||
    target.uciMoves ||
    target.uci_moves;
  const moveLine =
    item.moveLine ||
    item.move_line ||
    item.linePgn ||
    item.line_pgn ||
    target.moveLine ||
    target.move_line;

  return (Array.isArray(moves) && moves.length > 0) || Boolean(String(moveLine || "").trim());
}

function lineSummary(item = {}) {
  const games = safeNumber(item.games ?? item.gamesPlayed ?? item.games_played, null);
  const winRate = safeNumber(item.winRate ?? item.win_rate, null);
  const lossRate = safeNumber(item.lossRate ?? item.loss_rate, null);
  const parts = [];

  if (games !== null) parts.push(`${games} game${games === 1 ? "" : "s"}`);
  if (winRate !== null) parts.push(`${Math.round(winRate)}% win rate`);
  if (lossRate !== null) parts.push(`${Math.round(lossRate)}% loss rate`);
  return parts.length ? parts.join(" · ") : "Opening pattern found in your analysis";
}

function explanationFor(item = {}, source = "") {
  const direct =
    item.shortExplanation ||
    item.short_explanation ||
    item.whyItMatters ||
    item.why_it_matters ||
    item.exactIssue ||
    item.exact_issue ||
    item.flagReason ||
    item.reason ||
    item.why;

  if (direct) return direct;
  if (source === "weak-line") return "You are losing this line more than your average.";
  return "This is the clearest opening target from your current report.";
}

function buildFallbackFromRecommendation(data, fitData) {
  const plan = buildTrainingRecommendations(data, fitData);
  const primary = plan.primary;
  if (!primary) return null;

  return {
    source: "training-recommendation",
    type: primary.type || "opening",
    opening: primary.opening,
    variation: primary.variation || primary.moveLine || "",
    summary: lineSummary(primary),
    explanation: primary.reason || "This is the best available training target from your current report.",
    target: primary.trainingTarget || primary.opening,
  };
}

function buildOneThing(data, fitData) {
  if (!data) {
    return {
      source: "import-more",
      type: "import-more",
      opening: "Import more games",
      variation: "",
      summary: "OpeningFit needs more recent games",
      explanation: "Import more games so the report can find a reliable opening identity and exact weak line.",
      target: null,
    };
  }

  const repeatedWeakLines = mergeWeakLines(data, { minGames: 2 }).filter(enoughSample);
  const oneGameWeakLines = mergeWeakLines(data, { minGames: 1 }).filter(Boolean);
  const exactWeakLine =
    repeatedWeakLines.find(hasExactMoves) ||
    oneGameWeakLines.find(hasExactMoves) ||
    null;
  const weakLine = exactWeakLine || repeatedWeakLines[0] || oneGameWeakLines[0] || null;

  if (weakLine) {
    const training = buildWeakestLineTrainingTargetFromLine(weakLine);
    return {
      source: "weak-line",
      opening: openingName(weakLine),
      variation: variationName(weakLine),
      summary: lineSummary(weakLine),
      explanation: explanationFor(weakLine, "weak-line"),
      target: training.target || weakLine,
      type: "weak-line",
    };
  }

  const oneFix = getOneThingToFix(data);
  if (oneFix && openingName(oneFix) && enoughSample(oneFix)) {
    const training = buildWeakestLineTrainingTargetFromLine(oneFix);
    return {
      source: "one-thing",
      opening: openingName(oneFix),
      variation: variationName(oneFix),
      summary: lineSummary(oneFix),
      explanation: explanationFor(oneFix),
      target: training.target || oneFix,
      type: variationName(oneFix) ? "weak-line" : "opening",
    };
  }

  const currentWeakest = getWeakestTracking(data).currentWeakestLine || getWeakestTracking(data).current_weakest_line;
  if (currentWeakest && openingName(currentWeakest) && enoughSample(currentWeakest)) {
    const training = buildWeakestLineTrainingTargetFromLine(currentWeakest);
    return {
      source: "weakest-tracking",
      opening: openingName(currentWeakest),
      variation: variationName(currentWeakest),
      summary: lineSummary(currentWeakest),
      explanation: explanationFor(currentWeakest),
      target: training.target || currentWeakest,
      type: "weak-line",
    };
  }

  return (
    buildFallbackFromRecommendation(data, fitData) || {
      source: "import-more",
      type: "import-more",
      opening: "Import more games",
      variation: "",
      summary: "No reliable weak opening yet",
      explanation: "OpeningFit needs a few more games before it can recommend a specific line with confidence.",
      target: null,
    }
  );
}

export default function OneThingToFixCard({ data, fitData, onPractice, onImportMore }) {
  const fix = buildOneThing(data, fitData);
  if (!data || !fix?.opening) return null;

  const title = fix.variation && fix.variation !== fix.opening ? `${fix.opening}: ${fix.variation}` : fix.opening;
  const ctaLabel =
    fix.type === "import-more"
      ? "Import more games"
      : fix.type === "weak-line"
        ? "Train this line"
        : "Review this opening";
  const handleAction = () => {
    if (fix.type === "import-more") {
      onImportMore?.();
      return;
    }
    onPractice?.(fix.target);
  };

  return (
    <section className="oneThingToFixCard" aria-labelledby="one-thing-to-fix-title">
      <div className="oneThingToFixCopy">
        <p className="eyebrow">Next action</p>
        <h2 id="one-thing-to-fix-title">Your One Thing To Fix</h2>
        <h3>{title}</h3>
        <p>{fix.explanation}</p>
      </div>

      <div className="oneThingToFixAction">
        <span>{fix.summary}</span>
        {onPractice || onImportMore ? (
          <button type="button" onClick={handleAction}>
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
